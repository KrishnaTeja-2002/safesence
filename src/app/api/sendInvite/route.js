export const runtime = "nodejs";

import { NextResponse } from 'next/server';
import nodemailer from 'nodemailer';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

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
    const { email, role, sensorId } = await request.json();

    if (!email || !role || !sensorId) {
      return NextResponse.json(
        { error: 'Email, role, and sensorId are required' },
        { status: 400 }
      );
    }

    // Check if user is already a team member
    const existingUser = await prisma.user.findFirst({
      where: { email }
    });

    if (existingUser) {
      // Check if they already have access to this sensor
      const existingInvitation = await prisma.teamInvitation.findFirst({
        where: {
          email,
          sensorId,
          status: { in: ['accepted', 'pending'] }
        }
      });

      if (existingInvitation) {
        return NextResponse.json({
          alreadyMember: true,
          message: 'User already has access to this sensor'
        });
      }
    }

    // Check for pending invitations
    const pendingInvite = await prisma.teamInvitation.findFirst({
      where: {
        email,
        sensorId,
        status: 'pending'
      }
    });

    if (pendingInvite) {
      return NextResponse.json({
        pendingInvite: true,
        message: 'There is already a pending invitation for this email'
      });
    }

    // Generate token and create invitation
    const token = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
    
    // For now, we'll use a placeholder inviterId - in a real app, this would come from the authenticated user
    const inviterId = '00000000-0000-0000-0000-000000000000'; // Placeholder UUID

    await prisma.teamInvitation.create({
      data: {
        email,
        role,
        token,
        sensorId,
        inviterId,
        status: 'pending'
      }
    });

    // Send email
    const transporter = nodemailer.createTransporter({
      service: 'gmail',
      auth: {
        user: 'safesencewinwinlabs@gmail.com',
        pass: 'tprw plda fxec pzqt',
      },
      secure: false,
      port: 587,
      requireTLS: true,
    });

    const acceptLink = `http://localhost:3001/api/sendInvite?token=${token}`;
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
    
    return NextResponse.json({ 
      success: true, 
      message: 'Invitation sent',
      token 
    });
  } catch (error) {
    console.error('Send invite error:', error);
    return NextResponse.json({ 
      success: false, 
      error: error.message 
    }, { status: 500 });
  } finally {
    await prisma.$disconnect();
  }
}

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const token = searchParams.get('token');
  const action = searchParams.get('action');
  const name = searchParams.get('name');
  const role = searchParams.get('role');

  // Handle accept/reject actions
  if (action === 'accept' || action === 'reject') {
    try {
      const invitation = await prisma.teamInvitation.findUnique({
        where: { token },
        select: { email: true, status: true, role: true, sensorId: true }
      });

      if (!invitation || invitation.status !== 'pending') {
        return NextResponse.redirect(`http://localhost:3001/teams?error=invalid_token`);
      }

      if (action === 'accept') {
        const invitedEmail = invitation.email;
        const targetSensorId = invitation.sensorId;

        // Resolve user_id by email (if possible)
        let targetUserId = null;
        try {
          const authUser = await prisma.user.findFirst({
            where: { email: invitedEmail }
          });
          targetUserId = authUser?.id || null;
        } catch (e) {
          console.error('Lookup by email failed:', e?.message || e);
          console.log('Continuing with user_id as null - access will be email-based');
        }

        // Update invitation status and store user_id (if resolved)
        await prisma.teamInvitation.update({
          where: { token },
          data: { 
            status: 'accepted', 
            userId: targetUserId,
            acceptedName: name,
            acceptedRole: role
          }
        });

        return NextResponse.redirect(`http://localhost:3001/teams?accepted=true&name=${encodeURIComponent(name)}&role=${encodeURIComponent(role)}&token=${token}`);
      } else if (action === 'reject') {
        await prisma.teamInvitation.update({ 
          where: { token }, 
          data: { status: 'rejected' } 
        });

        return NextResponse.redirect(`http://localhost:3001/teams?rejected=true&name=${encodeURIComponent(name)}&token=${token}`);
      }
    } catch (error) {
      console.error('Action processing error:', error);
      return NextResponse.redirect(`http://localhost:3001/teams?error=processing_failed`);
    }
  }

  // Display invitation page
  try {
    const invitation = await prisma.teamInvitation.findUnique({
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
  } finally {
    await prisma.$disconnect();
  }
}