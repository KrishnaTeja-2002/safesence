export const runtime = "nodejs";

import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { authenticateRequest } from '../../middleware/auth-postgres.js';

const prisma = new PrismaClient();

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

    const { email, role, selectAll, groupIds, sensorIds } = await request.json();

    if (!email || !role) {
      return NextResponse.json(
        { error: 'email and role are required' },
        { status: 400 }
      );
    }

    // Get all sensors user owns
    const userSensors = await prisma.$queryRaw`
      SELECT s.sensor_id
      FROM public.sensors s
      JOIN public.devices d ON s.device_id = d.device_id
      WHERE d.owner_id = ${user.id}::uuid
    `;

    const userSensorIds = userSensors.map(s => s.sensor_id);

    let targetSensorIds = [];

    if (selectAll) {
      // Grant access to all sensors
      targetSensorIds = userSensorIds;
    } else {
      // Collect sensors from groups
      if (groupIds && groupIds.length > 0) {
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
      }

      // Add individual sensors
      if (sensorIds && sensorIds.length > 0) {
        // Verify user owns these sensors
        const validSensorIds = sensorIds.filter(id => userSensorIds.includes(id));
        targetSensorIds.push(...validSensorIds);
      }

      // Remove duplicates
      targetSensorIds = [...new Set(targetSensorIds)];
    }

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
        email: email,
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

    // Create a single token for all invitations (they can share the same token)
    const token = Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2);
    const acceptLink = `${origin}/api/sendInvite?token=${token}`;

    const invitations = await Promise.all(
      targetSensorIds.map(sensorId =>
        prisma.teamInvitation.create({
          data: {
            token,
            email: email,
            role: roleLabel,
            status: 'pending',
            inviterId: user.id,
            sensorId: sensorId,
            inviteLink: acceptLink
          }
        })
      )
    );

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

      const mailOptions = {
        from: {
          name: 'SafeSense Team',
          address: 'safesencewinwinlabs@gmail.com'
        },
        replyTo: 'safesense@winwinlabs.org',
        to: email,
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
                <p style="margin: 0; color: #374151; font-weight: 500;">Access granted to ${targetSensorIds.length} sensor(s)</p>
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
      console.log('Batch invitation email sent successfully to', email);
    } catch (error) {
      console.error('Failed to send batch invitation email:', error);
    }

    return NextResponse.json({ 
      success: true, 
      invited: true, 
      token,
      sensorCount: targetSensorIds.length 
    });
  } catch (error) {
    console.error('Batch assign error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

