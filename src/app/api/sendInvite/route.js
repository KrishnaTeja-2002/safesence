

export const runtime = "nodejs";

import { NextResponse } from 'next/server';
import nodemailer from 'nodemailer';
import { DatabaseClient } from '../../../../lib/database.js';

const db = new DatabaseClient();

// Helper function to get initials (same as in dashboard)
const getInitials = (name) => {
  return name
    .split(' ')
    .map(word => word[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
};

export async function POST(request) {
  try {
    const { email, role, token, sensor_id } = await request.json();

    // Option 1: Using Gmail SMTP with custom "from" name and reply-to
    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: 'safesencewinwinlabs@gmail.com',
        pass: 'tprw plda fxec pzqt',
      },
      secure: false,
      port: 587,
      requireTLS: true,
    });

    const acceptLink = `http://localhost:3000/api/sendInvite?token=${token}${sensor_id ? `&sensor_id=${encodeURIComponent(sensor_id)}` : ''}`;
    const mailOptions = {
      from: {
        name: 'SafeSense Team',
        address: 'safesencewinwinlabs@gmail.com'
      },
      replyTo: 'safesense@winwinlabs.org',
      to: email,
      subject: 'Team Invitation - SafeSense',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="text-align: center; margin-bottom: 30px;">
            <h1 style="color: #1f2937; margin-bottom: 10px;">SafeSense</h1>
            <p style="color: #6b7280; margin: 0;">Team Invitation</p>
          </div>
          
          <div style="background-color: #f9fafb; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
            <h2 style="color: #1f2937; margin-top: 0;">You're Invited!</h2>
            <p style="color: #374151; line-height: 1.6;">
              You have been invited to join the SafeSense team with the role: <strong>${role}</strong>.
            </p>
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

    await transporter.verify();
    await transporter.sendMail(mailOptions);
    console.log(`Email sent to ${email} with token ${token}`);
    return NextResponse.json({ success: true, message: 'Invitation sent' });
  } catch (error) {
    console.error('SMTP Error:', error.message);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

// Alternative configuration for actual custom domain email
// Uncomment and configure this if you have SMTP credentials for safesense@winwinlabs.org
/*
export async function POST(request) {
  try {
    const { email, role, token } = await request.json();

    // Option 2: Using custom domain SMTP (requires SMTP credentials from your hosting provider)
    const transporter = nodemailer.createTransport({
      host: 'mail.winwinlabs.org', // Replace with your actual SMTP host
      port: 587,
      secure: false,
      auth: {
        user: 'safesense@winwinlabs.org',
        pass: 'your_email_password_here', // Replace with actual password
      },
    });

    const acceptLink = `http://localhost:3000/api/sendInvite?token=${token}`;
    const mailOptions = {
      from: {
        name: 'SafeSense Team',
        address: 'safesense@winwinlabs.org'
      },
      to: email,
      subject: 'Team Invitation - SafeSense',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="text-align: center; margin-bottom: 30px;">
            <h1 style="color: #1f2937; margin-bottom: 10px;">SafeSense</h1>
            <p style="color: #6b7280; margin: 0;">Team Invitation</p>
          </div>
          
          <div style="background-color: #f9fafb; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
            <h2 style="color: #1f2937; margin-top: 0;">You're Invited!</h2>
            <p style="color: #374151; line-height: 1.6;">
              You have been invited to join the SafeSense team with the role: <strong>${role}</strong>.
            </p>
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
              safesense@winwinlabs.org
            </p>
          </div>
        </div>
      `,
    };

    await transporter.verify();
    await transporter.sendMail(mailOptions);
    console.log(`Email sent to ${email} with token ${token}`);
    return NextResponse.json({ success: true, message: 'Invitation sent' });
  } catch (error) {
    console.error('SMTP Error:', error.message);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
*/

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const token = searchParams.get('token');
  const action = searchParams.get('action');
  const name = searchParams.get('name');
  const role = searchParams.get('role');
  const sensorIdParam = searchParams.get('sensor_id');

  // Handle accept/reject actions
  if (action === 'accept' || action === 'reject') {
    try {
      const invitation = await db.prisma.teamInvitation.findUnique({
        where: { token },
        select: { email: true, status: true, role: true, sensorId: true }
      });

      if (!invitation || invitation.status !== 'pending') {
        return NextResponse.redirect(`http://localhost:3000/teams?error=invalid_token`);
      }

      if (action === 'accept') {
        const invitedEmail = invitation.email;
        const targetSensorId = invitation.sensorId || sensorIdParam || null;

        // Resolve user_id by email (if possible)
        let targetUserId = null;
        try {
          const authUser = await db.findAuthUserByEmail(invitedEmail);
          targetUserId = authUser?.id || null;
        } catch (e) {
          console.error('Lookup by email failed:', e?.message || e);
          // If getUserByEmail fails, we'll still accept the invitation but with user_id as null
          // The user can still access the sensor via email-based lookup in the access checks
          console.log('Continuing with user_id as null - access will be email-based');
        }

        // Update invitation status and store user_id (if resolved)
        await db.prisma.teamInvitation.update({
          where: { token },
          data: { status: 'accepted', userId: targetUserId }
        });

        // Access is now managed entirely through team_invitations table
        // No need for separate sensor_access table

        return NextResponse.redirect(`http://localhost:3000/login?accepted=true`);
      } else if (action === 'reject') {
        await db.prisma.teamInvitation.update({ where: { token }, data: { status: 'rejected' } });

        return NextResponse.redirect(`http://localhost:3000/login?rejected=true`);
      }
    } catch (error) {
      console.error('Action processing error:', error);
      return NextResponse.redirect(`http://localhost:3000/teams?error=processing_failed`);
    }
  }

  // Display invitation page
  try {
    const invitation = await db.prisma.teamInvitation.findUnique({
      where: { token },
      select: { email: true, role: true, status: true }
    });

    if (!invitation || invitation.status !== 'pending') {
      return new NextResponse(`
        <!DOCTYPE html>
        <html>
          <head>
            <title>Invalid Invitation</title>
            <style>body { font-family: Arial, sans-serif; text-align: center; padding: 50px; }</style>
          </head>
          <body>
            <h2>Invalid or Expired Invitation</h2>
            <p>This invitation link is no longer valid.</p>
          </body>
        </html>
      `, {
        headers: { 'Content-Type': 'text/html' },
        status: 400,
      });
    }

    const { email, role } = invitation;
    const username = email.split('@')[0];
    const userInitials = getInitials(username);

    return new NextResponse(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>SafeSense - Team Invitation</title>
          <style>
            body { 
              font-family: Arial, sans-serif; 
              text-align: center; 
              padding: 50px; 
              background-color: #f8f9fa; 
              margin: 0; 
            }
            .container {
              max-width: 500px;
              margin: 0 auto;
              background: white;
              padding: 40px;
              border-radius: 10px;
              box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
            }
            .header {
              display: flex;
              justify-content: space-between;
              align-items: center;
              margin-bottom: 30px;
              padding-bottom: 20px;
              border-bottom: 1px solid #e9ecef;
            }
            .brand {
              font-size: 24px;
              font-weight: bold;
              color: #1f2937;
            }
            .user-avatar {
              width: 40px;
              height: 40px;
              border-radius: 50%;
              background-color: #d97706;
              display: flex;
              align-items: center;
              justify-content: center;
              color: white;
              font-size: 14px;
              font-weight: bold;
            }
            .welcome-text {
              color: #6b7280;
              font-size: 14px;
              margin: 0;
            }
            h2 {
              color: #1f2937;
              margin-bottom: 20px;
            }
            button { 
              padding: 12px 24px; 
              margin: 10px; 
              cursor: pointer; 
              border: none;
              border-radius: 6px;
              font-size: 16px;
              font-weight: 500;
              transition: all 0.2s;
            }
            .btn-accept {
              background-color: #10b981;
              color: white;
            }
            .btn-accept:hover {
              background-color: #059669;
            }
            .btn-reject {
              background-color: #ef4444;
              color: white;
            }
            .btn-reject:hover {
              background-color: #dc2626;
            }
            input { 
              padding: 12px; 
              margin: 10px; 
              width: 200px; 
              border: 1px solid #d1d5db;
              border-radius: 6px;
              font-size: 16px;
            }
            input:focus {
              outline: none;
              border-color: #3b82f6;
              box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
            }
            .role-badge {
              background-color: #3b82f6;
              color: white;
              padding: 4px 8px;
              border-radius: 4px;
              font-size: 12px;
              font-weight: 500;
            }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <div>
                <div class="brand">SafeSense</div>
                <p class="welcome-text">Welcome, ${username}</p>
              </div>
              <div class="user-avatar">
                ${userInitials}
              </div>
            </div>
            
            <h2>Team Invitation</h2>
            <p>You've been invited to join the SafeSense team with role: <span class="role-badge">${role}</span></p>
            
            <div>
              <button class="btn-accept" onclick="handleAccept()">Accept Invitation</button>
              <button class="btn-reject" onclick="handleReject()">Decline</button>
            </div>
          </div>

          <script>
            function handleAccept() {
              const name = '${username}';
              window.location.href = '/api/sendInvite?token=${token}&action=accept&name=' + encodeURIComponent(name) + '&role=${role}';
            }
            
            function handleReject() {
              const name = '${username}';
              window.location.href = '/api/sendInvite?token=${token}&action=reject&name=' + encodeURIComponent(name);
            }
          </script>
        </body>
      </html>
    `, {
      headers: { 'Content-Type': 'text/html' },
      status: 200,
    });
  } catch (error) {
    console.error('GET request error:', error);
    return new NextResponse(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Error</title>
          <style>body { font-family: Arial, sans-serif; text-align: center; padding: 50px; }</style>
        </head>
        <body>
          <h2>Error Processing Invitation</h2>
          <p>There was an error processing your invitation. Please try again.</p>
        </body>
      </html>
    `, {
      headers: { 'Content-Type': 'text/html' },
      status: 500,
    });
  }
}