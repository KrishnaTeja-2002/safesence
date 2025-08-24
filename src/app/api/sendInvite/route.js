import { NextResponse } from 'next/server';
import nodemailer from 'nodemailer';
import { createClient } from '@supabase/supabase-js';

// Supabase configuration
const supabaseUrl = 'https://kwaylmatpkcajsctujor.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt3YXlsbWF0cGtjYWpzY3R1am9yIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTUyNDAwMjQsImV4cCI6MjA3MDgxNjAyNH0.-ZICiwnXTGWgPNTMYvirIJ3rP7nQ9tIRC1ZwJBZM96M';
const supabase = createClient(supabaseUrl, supabaseAnonKey);

export async function POST(request) {
  const { email, role, token } = await request.json();

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
    from: 'krishnatejarangavajjala@gmail.com',
    to: email,
    subject: 'Team Invitation',
    html: `
      <p>You have been invited to join the team with role: ${role}.</p>
      <p>Please <a href="${acceptLink}">click here to accept</a> the invitation.</p>
    `,
  };

  try {
    await transporter.verify();
    await transporter.sendMail(mailOptions);
    console.log(`Email sent to ${email} with token ${token}`);
    return NextResponse.json({ success: true, message: 'Invitation sent' });
  } catch (error) {
    console.error('SMTP Error:', error.message);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const token = searchParams.get('token');

  const { data: invitation, error } = await supabase
    .from('team_invitations')
    .select('email, role, status')
    .eq('token', token)
    .single();

  if (error || !invitation || invitation.status !== 'pending') {
    return NextResponse.json({ success: false, message: 'Invalid or expired token' }, { status: 400 });
  }

  const { email, role } = invitation;
  return new NextResponse(`
    <!DOCTYPE html>
    <html>
      <head>
        <title>Invitation Confirmation</title>
        <style>
          body { font-family: Arial, sans-serif; text-align: center; padding: 50px; }
          button { padding: 10px 20px; margin: 10px; cursor: pointer; }
          input { padding: 10px; margin: 10px; width: 200px; }
        </style>
      </head>
      <body>
        <h2>Do you want to join the team?</h2>
        <input type="text" id="customName" placeholder="Enter your name" value="${email.split('@')[0]}" />
        <br />
        <button onclick="handleAccept()">Yes</button>
        <button onclick="window.location.href='/api/sendInvite?token=${token}&action=reject&name=${email.split('@')[0]}'">No</button>
        <script>
          function handleAccept() {
            const name = document.getElementById('customName').value;
            window.location.href = '/api/sendInvite?token=${token}&action=accept&name=' + encodeURIComponent(name) + '&role=${role}';
          }
        </script>
      </body>
    </html>
  `, {
    headers: { 'Content-Type': 'text/html' },
    status: 200,
  });
}

export async function PATCH(request) {
  const { searchParams } = new URL(request.url);
  const token = searchParams.get('token');
  const action = searchParams.get('action');
  const name = searchParams.get('name');
  const role = searchParams.get('role');

  const { data: invitation, error } = await supabase
    .from('team_invitations')
    .select('email, status')
    .eq('token', token)
    .single();

  if (error || !invitation || invitation.status !== 'pending') {
    return NextResponse.json({ success: false, message: 'Invalid or expired token' }, { status: 400 });
  }

  if (action === 'accept') {
    const { error: updateError } = await supabase
      .from('team_invitations')
      .update({ status: 'accepted' })
      .eq('token', token);

    if (updateError) {
      console.error('Update invitation error:', updateError);
      return NextResponse.json({ success: false, error: updateError.message }, { status: 500 });
    }

    const { error: insertError } = await supabase
      .from('team_members')
      .insert([{ name: decodeURIComponent(name), role: decodeURIComponent(role), status: 'accepted' }]);

    if (insertError) {
      console.error('Insert member error:', insertError);
      return NextResponse.json({ success: false, error: insertError.message }, { status: 500 });
    }

    return NextResponse.redirect(`http://localhost:3000/team?accepted=true&name=${encodeURIComponent(name)}&role=${role}&token=${token}`);
  } else if (action === 'reject') {
    const { error: updateError } = await supabase
      .from('team_invitations')
      .update({ status: 'rejected' })
      .eq('token', token);

    if (updateError) {
      console.error('Update invitation error:', updateError);
      return NextResponse.json({ success: false, error: updateError.message }, { status: 500 });
    }

    return NextResponse.redirect(`http://localhost:3000/team?rejected=true&name=${encodeURIComponent(name)}&token=${token}`);
  }

  return NextResponse.json({ success: false, message: 'Invalid action' }, { status: 400 });
}