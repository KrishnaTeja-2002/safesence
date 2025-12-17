export const runtime = "nodejs";

import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { authenticateRequest } from '../../middleware/auth-postgres.js';

// Use singleton pattern to avoid multiple PrismaClient instances
const globalForPrisma = globalThis;
const prisma = globalForPrisma.__safesensePrismaBatch || new PrismaClient({
  log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
});

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.__safesensePrismaBatch = prisma;
}

// Ensure Prisma client is connected
prisma.$connect().catch(() => {
  // Connection already exists or will be established on first query
});

// POST /api/shares/batch - Batch assign access to multiple sensors/groups
export async function POST(request) {
  try {
    const authResult = await authenticateRequest(request);
    if (authResult.error) {
      return NextResponse.json(
        { error: authResult.error },
        { status: authResult.status || 401 }
      );
    }
    const user = authResult.user;

    let body;
    try {
      body = await request.json();
    } catch (parseError) {
      return NextResponse.json(
        { error: 'Invalid JSON in request body' },
        { status: 400 }
      );
    }
    const { email, role, selectAll, groupIds, sensorIds } = body;

    console.log('Batch assign request received:', {
      email,
      role,
      selectAll: !!selectAll,
      groupIds: groupIds?.length || 0,
      sensorIds: sensorIds?.length || 0
    });

    if (!email || !role) {
      return NextResponse.json(
        { error: 'email and role are required' },
        { status: 400 }
      );
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const normalizedEmail = email.trim().toLowerCase();
    if (!emailRegex.test(normalizedEmail)) {
      return NextResponse.json(
        { error: 'Invalid email format' },
        { status: 400 }
      );
    }

    // Validate role
    if (!['viewer', 'admin'].includes(role)) {
      return NextResponse.json(
        { error: 'Role must be either "viewer" or "admin"' },
        { status: 400 }
      );
    }

    // Get all sensors user owns
    let userSensors;
    try {
      userSensors = await prisma.$queryRaw`
      SELECT s.sensor_id
      FROM public.sensors s
      JOIN public.devices d ON s.device_id = d.device_id
      WHERE d.owner_id = ${user.id}::uuid
    `;
    } catch (dbError) {
      console.error('Database error fetching user sensors:', dbError);
      return NextResponse.json(
        { error: 'Failed to fetch your sensors. Please try again.' },
        { status: 500 }
      );
    }

    const userSensorIds = userSensors.map(s => s.sensor_id);

    let targetSensorIds = [];

    if (selectAll === true) {
      // Grant access to all sensors
      console.log('Select All is true, using all user sensors:', userSensorIds.length);
      targetSensorIds = userSensorIds;
    } else {
      // Collect sensors from groups
      if (groupIds && groupIds.length > 0) {
        // Validate groupIds is an array
        if (!Array.isArray(groupIds)) {
          return NextResponse.json(
            { error: 'groupIds must be an array' },
            { status: 400 }
          );
        }

        try {
          // Verify Prisma client has the sensorGroupMember model
          if (!prisma.sensorGroupMember || typeof prisma.sensorGroupMember.findMany !== 'function') {
            console.error('Prisma client does not have sensorGroupMember model. Available models:', Object.keys(prisma).filter(k => !k.startsWith('$') && !k.startsWith('_')));
            return NextResponse.json(
              { error: 'Sensor groups feature is not available. Please regenerate Prisma client and restart the server.' },
              { status: 503 }
            );
          }

        const groupSensors = await prisma.sensorGroupMember.findMany({
          where: {
            groupId: { in: groupIds },
            group: {
              ownerId: user.id
            }
          },
          select: {
            sensorId: true
          }
        });

        const groupSensorIds = groupSensors.map(gs => gs.sensorId);
        targetSensorIds.push(...groupSensorIds);
        } catch (dbError) {
          console.error('Database error fetching group sensors:', dbError);
          console.error('Error details:', {
            message: dbError.message,
            code: dbError.code,
            meta: dbError.meta
          });
          
          // Check if table doesn't exist
          if (dbError.message?.includes('does not exist') || dbError.message?.includes('relation') || dbError.message?.includes('Table')) {
            return NextResponse.json(
              { error: 'Sensor groups feature is not available. Please run database migrations.' },
              { status: 503 }
            );
          }
          
          return NextResponse.json(
            { error: 'Failed to fetch sensors from selected groups. Please try again.' },
            { status: 500 }
          );
        }
      }

      // Add individual sensors
      if (sensorIds && sensorIds.length > 0) {
        // Validate sensorIds is an array
        if (!Array.isArray(sensorIds)) {
          return NextResponse.json(
            { error: 'sensorIds must be an array' },
            { status: 400 }
          );
        }

        // Verify user owns these sensors
        const validSensorIds = sensorIds.filter(id => id && typeof id === 'string' && userSensorIds.includes(id));
        if (validSensorIds.length !== sensorIds.length) {
          return NextResponse.json(
            { error: 'You do not own all the specified sensors' },
            { status: 403 }
          );
        }
        targetSensorIds.push(...validSensorIds);
      }

      // Remove duplicates
      targetSensorIds = [...new Set(targetSensorIds)];
    }

    console.log('Final target sensor IDs count:', targetSensorIds.length);

    if (targetSensorIds.length === 0) {
      return NextResponse.json(
        { error: 'No valid sensors to assign' },
        { status: 400 }
      );
    }

    // Check for existing pending invitations and expire them
    const existingInvitations = await prisma.teamInvitation.findMany({
      where: {
        sensorId: { in: targetSensorIds },
        email: normalizedEmail,
        status: 'pending'
      }
    });

    if (existingInvitations.length > 0) {
      await prisma.teamInvitation.updateMany({
        where: {
          id: { in: existingInvitations.map(inv => inv.id) }
        },
        data: { status: 'expired' }
      });
    }

    // Create invitations for all target sensors
    const roleLabel = role === 'admin' ? 'Full access' : 'Access';
    const origin = request.headers.get('origin') || `${request.headers.get('x-forwarded-proto') || 'http'}://${request.headers.get('host')}`;

    // Create invitations one by one to better handle errors
    // Each invitation needs a unique token due to database constraint
    const invitations = [];
    const errors = [];
    
    for (const sensorId of targetSensorIds) {
      try {
        // Generate a unique token for each invitation
        const token = Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2) + Date.now().toString(36);
        const acceptLink = `${origin}/api/sendInvite?token=${token}`;
        
        const invitation = await prisma.teamInvitation.create({
          data: {
            token,
            email: normalizedEmail,
            role: roleLabel,
            status: 'pending',
            inviterId: user.id,
            sensorId: sensorId,
            inviteLink: acceptLink
          }
        });
        invitations.push(invitation);
      } catch (inviteError) {
        console.error(`Failed to create invitation for sensor ${sensorId}:`, inviteError);
        errors.push({
          sensorId,
          error: inviteError.message,
          code: inviteError.code
        });
      }
    }
    
    // If all invitations failed, throw an error
    if (invitations.length === 0 && errors.length > 0) {
      const firstError = errors[0];
      const error = new Error(`Failed to create invitations: ${firstError.error}`);
      error.code = firstError.code;
      throw error;
    }
    
    // Log partial failures
    if (errors.length > 0) {
      console.warn(`Created ${invitations.length} invitations, ${errors.length} failed:`, errors);
    }

    // Send email with invitation
    try {
      const nodemailer = await import('nodemailer');
      
      const transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: {
          user: 'safesencewinwinlabs@gmail.com',
          pass: 'tprw plda fxec pzqt',
        },
        secure: false,
        port: 587,
        requireTLS: true,
        tls: {
          rejectUnauthorized: false
        }
      });

      await transporter.verify();

      const sensorList = targetSensorIds.length <= 5 
        ? targetSensorIds.join(', ')
        : `${targetSensorIds.slice(0, 5).join(', ')} and ${targetSensorIds.length - 5} more`;

      // Use the first invitation's link for the email (all invitations will be processed when user accepts)
      const acceptLink = invitations.length > 0 ? invitations[0].inviteLink : `${origin}/teams`;

      const mailOptions = {
        from: {
          name: 'SafeSense Team',
          address: 'safesencewinwinlabs@gmail.com'
        },
        replyTo: 'safesense@winwinlabs.org',
        to: normalizedEmail,
        subject: 'Team Invitation - SafeSense',
        headers: {
          'X-Mailer': 'SafeSense',
          'X-Priority': '3',
          'X-MSMail-Priority': 'Normal',
          'Importance': 'Normal'
        },
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
            <div style="text-align: center; margin-bottom: 30px;">
              <h1 style="color: #1f2937; margin-bottom: 10px;">SafeSense</h1>
              <p style="color: #6b7280; margin: 0;">Team Invitation</p>
            </div>
            
            <div style="background-color: #f9fafb; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
              <h2 style="color: #1f2937; margin-top: 0;">You're Invited!</h2>
              <p style="color: #374151; line-height: 1.6;">
                You have been invited to join SafeSense sensor monitoring with the role: <strong>${roleLabel}</strong>.
              </p>
              <div style="background-color: white; padding: 15px; border-radius: 6px; border-left: 4px solid #10b981; margin-top: 15px;">
                <p style="margin: 0; color: #374151; font-weight: 500;">Access granted to ${invitations.length} sensor(s)</p>
                <p style="margin: 5px 0 0 0; color: #6b7280; font-size: 14px;">Role: ${roleLabel}</p>
                ${targetSensorIds.length <= 10 ? `<p style="margin: 10px 0 0 0; color: #6b7280; font-size: 12px;">Sensors: ${sensorList}</p>` : ''}
              </div>
            </div>
            
            <div style="text-align: center; margin: 30px 0;">
              <a href="${acceptLink}" 
                 style="background-color: #10b981; color: white; padding: 12px 30px; 
                        text-decoration: none; border-radius: 6px; font-weight: 500;
                        display: inline-block;">
                Accept Invitation
              </a>
            </div>
            
            <div style="border-top: 1px solid #e5e7eb; padding-top: 20px; margin-top: 30px;">
              <p style="color: #6b7280; font-size: 14px; text-align: center; margin: 0;">
                This invitation was sent by SafeSense Team<br>
                If you have any questions, please reply to this email.
              </p>
            </div>
          </div>
        `,
      };

      await transporter.sendMail(mailOptions);
      console.log('Batch invitation email sent successfully to', normalizedEmail);
    } catch (error) {
      console.error('Failed to send batch invitation email:', error);
    }

    return NextResponse.json({ 
      success: true, 
      invited: true, 
      sensorCount: invitations.length,
      totalRequested: targetSensorIds.length,
      failedCount: errors.length,
      warnings: errors.length > 0 ? `Some invitations failed (${errors.length} of ${targetSensorIds.length})` : undefined
    });
  } catch (error) {
    console.error('Batch assign error:', error);
    console.error('Error details:', {
      message: error.message,
      stack: error.stack,
      name: error.name
    });
    
    // Handle database connection errors
    if (error.message && (
      error.message.includes('Can\'t reach database server') ||
      error.message.includes('database server') ||
      error.message.includes('ECONNREFUSED') ||
      error.message.includes('ETIMEDOUT') ||
      error.message.includes('P1001')
    )) {
      return NextResponse.json(
        { 
          error: 'Unable to connect to the database. Please try again later or contact support.',
          code: 'DATABASE_ERROR'
        },
        { status: 503 }
      );
    }
    
    // Handle Prisma validation errors
    if (error.code && error.code.startsWith('P')) {
      console.error('Prisma error code:', error.code);
      console.error('Prisma error message:', error.message);
      console.error('Prisma error meta:', error.meta);
      
      // Provide more specific error messages based on Prisma error codes
      let userMessage = 'Database operation failed. Please check your input and try again.';
      if (error.code === 'P2002') {
        userMessage = 'A record with this information already exists. Please check for duplicate entries.';
      } else if (error.code === 'P2003') {
        userMessage = 'Invalid reference. One or more selected sensors may not exist.';
      } else if (error.code === 'P2025') {
        userMessage = 'Record not found. Please refresh and try again.';
      }
      
      return NextResponse.json(
        { 
          error: userMessage,
          code: 'DATABASE_OPERATION_ERROR',
          prismaCode: error.code,
          details: process.env.NODE_ENV === 'development' ? error.message : undefined,
          meta: process.env.NODE_ENV === 'development' ? error.meta : undefined
        },
        { status: 400 }
      );
    }
    
    // Handle specific known errors
    if (error.message && error.message.includes('Unique constraint')) {
      return NextResponse.json(
        { 
          error: 'An invitation already exists for this user and sensor combination.',
          code: 'DUPLICATE_INVITATION'
        },
        { status: 409 }
      );
    }
    
    // Generic error with more details in development
    return NextResponse.json(
      { 
        error: process.env.NODE_ENV === 'development' 
          ? `Internal server error: ${error.message}` 
          : 'An error occurred while processing your request. Please try again later.',
        code: 'INTERNAL_ERROR',
        details: process.env.NODE_ENV === 'development' ? error.stack : undefined
      },
      { status: 500 }
    );
  }
}

