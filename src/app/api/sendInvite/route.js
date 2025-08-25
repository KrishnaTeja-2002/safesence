import { NextResponse } from 'next/server';
import nodemailer from 'nodemailer';
import { createClient } from '@supabase/supabase-js';

// Supabase configuration
const supabaseUrl = 'https://kwaylmatpkcajsctujor.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt3YXlsbWF0cGtjYWpzY3R1am9yIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTUyNDAwMjQsImV4cCI6MjA3MDgxNjAyNH0.-ZICiwnXTGWgPNTMYvirIJ3rP7nQ9tIRC1ZwJBZM96M';
const supabase = createClient(supabaseUrl, supabaseAnonKey);

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
    const { email, role, token } = await request.json();

    // Option 1: Using Gmail SMTP with custom "from" name and reply-to
    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: 'krishnatejarangavajjala@gmail.com',
        pass: 'dquf iexf izmw pszu',
      },
      secure: false,
      port: 587,
      requireTLS: true,
    });

    const acceptLink = `http://localhost:3000/api/sendInvite?token=${token}`;
    const mailOptions = {
      from: {
        name: 'SafeSense Team',
        address: 'krishnatejarangavajjala@gmail.com'
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

  // Handle accept/reject actions
  if (action === 'accept' || action === 'reject') {
    try {
      const { data: invitation, error } = await supabase
        .from('team_invitations')
        .select('email, status')
        .eq('token', token)
        .single();

      if (error || !invitation || invitation.status !== 'pending') {
        return NextResponse.redirect(`http://localhost:3000/team?error=invalid_token`);
      }

      if (action === 'accept') {
        const { error: updateError } = await supabase
          .from('team_invitations')
          .update({ status: 'accepted' })
          .eq('token', token);

        if (updateError) {
          console.error('Update invitation error:', updateError);
          return NextResponse.redirect(`http://localhost:3000/team?error=update_failed`);
        }

        const { error: insertError } = await supabase
          .from('team_members')
          .insert([{ name: decodeURIComponent(name), role: decodeURIComponent(role), status: 'accepted' }]);

        if (insertError) {
          console.error('Insert member error:', insertError);
          return NextResponse.redirect(`http://localhost:3000/team?error=insert_failed`);
        }

        return NextResponse.redirect(`http://localhost:3000/team?accepted=true&name=${encodeURIComponent(name)}&role=${role}&token=${token}`);
      } else if (action === 'reject') {
        const { error: updateError } = await supabase
          .from('team_invitations')
          .update({ status: 'rejected' })
          .eq('token', token);

        if (updateError) {
          console.error('Update invitation error:', updateError);
          return NextResponse.redirect(`http://localhost:3000/team?error=update_failed`);
        }

        return NextResponse.redirect(`http://localhost:3000/team?rejected=true&name=${encodeURIComponent(name)}&token=${token}`);
      }
    } catch (error) {
      console.error('Action processing error:', error);
      return NextResponse.redirect(`http://localhost:3000/team?error=processing_failed`);
    }
  }

  // Display invitation page
  try {
    const { data: invitation, error } = await supabase
      .from('team_invitations')
      .select('email, role, status')
      .eq('token', token)
      .single();

    if (error || !invitation || invitation.status !== 'pending') {
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
            
            <div style="margin: 30px 0;">
              <input type="text" id="customName" placeholder="Enter your display name" value="${username}" />
            </div>
            
            <div>
              <button class="btn-accept" onclick="handleAccept()">Accept Invitation</button>
              <button class="btn-reject" onclick="handleReject()">Decline</button>
            </div>
          </div>

          <script>
            function handleAccept() {
              const name = document.getElementById('customName').value;
              if (!name.trim()) {
                alert('Please enter a display name');
                return;
              }
              window.location.href = '/api/sendInvite?token=${token}&action=accept&name=' + encodeURIComponent(name) + '&role=${role}';
            }
            
            function handleReject() {
              const name = document.getElementById('customName').value || '${username}';
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