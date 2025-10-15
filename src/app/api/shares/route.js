export const runtime = "nodejs";


import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// POST /api/shares -> create invitation for a user to a sensor (owner/admin)
// Body: { sensor_id: string, email: string, role: 'viewer'|'admin' }
export async function POST(request) {
  try {
    // Get authentication token from headers
    const authHeader = request.headers.get('authorization');
    const cookieHeader = request.headers.get('cookie');
    
    let authToken = null;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      authToken = authHeader.substring(7);
    } else if (cookieHeader) {
      const cookies = cookieHeader.split(';').reduce((acc, cookie) => {
        const [key, value] = cookie.trim().split('=');
        acc[key] = value;
        return acc;
      }, {});
      authToken = cookies['auth-token'];
    }

    const { sensor_id, email, role } = await request.json();

    if (!sensor_id || !role || !email) {
      return NextResponse.json(
        { error: 'sensor_id, role and email are required' },
        { status: 400 }
      );
    }

    // Check if sensor exists and resolve owner via device
    const sensorResult = await prisma.$queryRaw`
      SELECT s.sensor_id, d.owner_id
      FROM public.sensors s
      JOIN public.devices d ON s.device_id = d.device_id
      WHERE s.sensor_id = ${sensor_id}
    `;

    if (!sensorResult || sensorResult.length === 0) {
      return NextResponse.json(
        { error: 'Sensor not found' },
        { status: 404 }
      );
    }

    const sensor = sensorResult[0];

    // Check for existing pending invitation and expire it
    const existingInvitation = await prisma.teamInvitation.findFirst({
      where: {
        sensorId: sensor_id,
        email: email,
        status: 'pending'
      }
    });

    if (existingInvitation) {
      // Expire the old invitation
      await prisma.teamInvitation.update({
        where: { id: existingInvitation.id },
        data: { status: 'expired' }
      });
      console.log('Expired old invitation for', email);
    }

    // Create invitation
    const token = Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2);
    const roleLabel = role === 'admin' ? 'Full access' : 'Access';
    const origin = request.headers.get('origin') || `${request.headers.get('x-forwarded-proto') || 'http'}://${request.headers.get('host')}`;
    const acceptLink = `${origin}/api/sendInvite?token=${token}`;

    const invitation = await prisma.teamInvitation.create({
      data: {
        token,
        email: email,
        role: roleLabel,
        status: 'pending',
        inviterId: sensor.owner_id, // Device owner is inviter
        sensorId: sensor_id,
        inviteLink: acceptLink
      }
    });

    // Send email directly using nodemailer
    try {
      console.log('Sending invitation email directly...');
      
      // Import nodemailer
      const nodemailer = await import('nodemailer');
      
      // Create transporter
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

      // Verify connection
      await transporter.verify();
      console.log('SMTP connection verified successfully');

      // Send email
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
                You have been invited to join a SafeSense sensor monitoring team with the role: <strong>${roleLabel}</strong>.
              </p>
              <div style="background-color: white; padding: 15px; border-radius: 6px; border-left: 4px solid #10b981; margin-top: 15px;">
                <p style="margin: 0; color: #374151; font-weight: 500;">Sensor ID: ${sensor_id}</p>
                <p style="margin: 5px 0 0 0; color: #6b7280; font-size: 14px;">Role: ${roleLabel}</p>
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

      const emailResult = await transporter.sendMail(mailOptions);
      console.log('Email sent successfully to', email);
      console.log('Message ID:', emailResult.messageId);
      
    } catch (error) {
      console.error('Failed to send invitation email:', error);
    }

    return NextResponse.json({ invited: true, token });
  } catch (error) {
    console.error('Create invitation error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// GET /api/shares?sensor_id=...
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const sensor_id = searchParams.get('sensor_id');

    if (!sensor_id) {
      return NextResponse.json(
        { error: 'sensor_id is required' },
        { status: 400 }
      );
    }

    // Load sensor and owner via device join
    const sensorResult = await prisma.$queryRaw`
      SELECT s.sensor_id, s.sensor_name, d.owner_id, u.email as owner_email
      FROM public.sensors s
      JOIN public.devices d ON s.device_id = d.device_id
      LEFT JOIN auth.users u ON d.owner_id = u.id
      WHERE s.sensor_id = ${sensor_id}
    `;

    if (!sensorResult || sensorResult.length === 0) {
      return NextResponse.json(
        { error: 'Sensor not found' },
        { status: 404 }
      );
    }

    const sensor = sensorResult[0];

    // Load all invitations for this sensor (pending and accepted)
    const invitations = await prisma.$queryRaw`
      SELECT ti.email, ti.role, ti.status, ti.user_id, u.email as invitee_email
      FROM public.team_invitations ti
      LEFT JOIN auth.users u ON ti.user_id = u.id
      WHERE ti.sensor_id = ${sensor_id}
      AND ti.status IN ('pending', 'accepted')
    `;

    const result = [];
    
    // Add owner
    if (sensor.owner_id) {
      result.push({ 
        user_id: sensor.owner_id, 
        role: 'owner', 
        username: sensor.owner_email?.split('@')[0] || null,
        email: sensor.owner_email
      });
    }
    
    // Process invitations
    invitations.forEach(inv => {
      const mappedRole = /full/i.test(inv.role || '') || /admin/i.test(inv.role || '') ? 'admin' : 'viewer';
      const mappedStatus = inv.status === 'pending' ? 'invited' : 'accepted';
      
      // Avoid duplicating owner
      if (inv.user_id === sensor.owner_id) return;
      
      result.push({ 
        email: inv.email, 
        role: mappedRole, 
        status: mappedStatus, 
        user_id: inv.user_id || null,
        username: inv.invitee_email?.split('@')[0] || null
      });
    });

    return NextResponse.json({ 
      sensor_id, 
      sensor_name: sensor.sensor_name || null, 
      access: result 
    });
  } catch (error) {
    console.error('Get shares error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// DELETE /api/shares?sensor_id=...&user_id=... or &email=...
export async function DELETE(request) {
  try {
    const { searchParams } = new URL(request.url);
    const sensor_id = searchParams.get('sensor_id');
    const target_user_id = searchParams.get('user_id');
    const email = searchParams.get('email');

    if (!sensor_id || (!target_user_id && !email)) {
      return NextResponse.json(
        { error: 'sensor_id and (user_id or email) are required' },
        { status: 400 }
      );
    }

    const sensorResult = await prisma.$queryRaw`
      SELECT s.sensor_id, d.owner_id
      FROM public.sensors s
      JOIN public.devices d ON s.device_id = d.device_id
      WHERE s.sensor_id = ${sensor_id}
    `;

    if (!sensorResult || sensorResult.length === 0) {
      return NextResponse.json(
        { error: 'Sensor not found' },
        { status: 404 }
      );
    }

    const sensor = sensorResult[0];

    if (email) {
      // Cancel invite (pending or accepted) by email
      await prisma.teamInvitation.deleteMany({
        where: {
          sensorId: sensor_id,
          email: email,
          status: { in: ['pending', 'accepted'] }
        }
      });
    } else {
      // Revoke accepted access by user_id
      if (String(target_user_id) === String(sensor.owner_id)) {
        return NextResponse.json(
          { error: 'Owner cannot be removed' },
          { status: 400 }
        );
      }
      
      await prisma.teamInvitation.deleteMany({
        where: {
          sensorId: sensor_id,
          userId: target_user_id,
          status: 'accepted'
        }
      });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Delete share error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}