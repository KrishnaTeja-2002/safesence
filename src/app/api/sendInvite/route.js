import { NextResponse } from 'next/server';
import nodemailer from 'nodemailer';
import { setInvitation, getInvitations } from '../../lib/invitations';

export async function POST(request) {
  const { email, role } = await request.json();
  const token = Math.random().toString(36).substring(2, 15); // Unique token
  setInvitation(token, { email, role, accepted: false });

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

  const acceptLink = `http://localhost:3000/api/sendInvite?token=${token}`; // Same route for confirmation
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
    return NextResponse.json({ success: false, error: error.message });
  }
}

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const token = searchParams.get('token');

  const invitations = getInvitations();
  if (invitations.has(token)) {
    const { email, role } = invitations.get(token);
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
  return NextResponse.json({ success: false, message: 'Invalid token' }, { status: 400 });
}

export async function PATCH(request) {
  const { searchParams } = new URL(request.url);
  const token = searchParams.get('token');
  const action = searchParams.get('action');
  const name = searchParams.get('name');
  const role = searchParams.get('role');

  const invitations = getInvitations();
  if (invitations.has(token)) {
    const { email, accepted } = invitations.get(token);
    if (!accepted) {
      if (action === 'accept') {
        invitations.set(token, { email, role, accepted: true });
        return NextResponse.redirect(`http://localhost:3000/team?accepted=true&name=${encodeURIComponent(name)}&role=${role}`);
      } else if (action === 'reject') {
        return NextResponse.redirect(`http://localhost:3000/team?rejected=true&name=${encodeURIComponent(name)}`);
      }
    }
  }
  return NextResponse.json({ success: false, message: 'Invalid action or token' }, { status: 400 });
}