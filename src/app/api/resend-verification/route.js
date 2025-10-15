export const runtime = "nodejs";

import { NextResponse } from 'next/server';
import nodemailer from 'nodemailer';
import { prisma, ensurePrismaConnected } from '../../../../lib/prismaClient.js';
import crypto from 'crypto';

await ensurePrismaConnected();

function buildTransport() {
  const host = process.env.SMTP_HOST || 'smtp.gmail.com';
  const port = Number(process.env.SMTP_PORT || 587);
  const user = process.env.SMTP_USER || 'safesencewinwinlabs@gmail.com';
  const pass = process.env.SMTP_PASS || 'tprw plda fxec pzqt';

  return nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: { user, pass },
  });
}

export async function POST(request) {
  try {
    const body = await request.json().catch(() => ({}));
    const email = (body?.email || '').trim();

    if (!email) {
      return NextResponse.json({ message: 'Email is required' }, { status: 400 });
    }

    // Check if user exists and needs verification
    try {
      const user = await prisma.$queryRaw`
        select id, email, email_confirmed_at, confirmed_at, confirmation_token 
        from auth.users 
        where lower(email) = lower(${email}) 
        and deleted_at is null
        limit 1
      `;
      
      if (!Array.isArray(user) || user.length === 0) {
        return NextResponse.json({ success: false, message: 'No account found with this email address' }, { status: 404 });
      }
      
      // Check if user is already verified
      const isVerified = !!(user[0].email_confirmed_at || user[0].confirmed_at);
      if (isVerified) {
        return NextResponse.json({ success: false, message: 'Email is already verified' }, { status: 400 });
      }
    } catch (e) {
      return NextResponse.json({ success: false, message: 'Error checking user account' }, { status: 500 });
    }

    const transporter = buildTransport();
    // Generate app URL - works for both local development and Coolify production
    let appUrl = process.env.APP_BASE_URL || process.env.NEXT_PUBLIC_APP_URL;
    
    if (!appUrl) {
      // Auto-detect URL from request headers (works in both local and production)
      const host = request.headers.get('x-forwarded-host') || request.headers.get('host');
      const protocol = request.headers.get('x-forwarded-proto') || 'https';
      
      // Validate that we have a proper host (not database URL)
      if (host && !host.includes('postgres') && !host.includes('database') && !host.includes('161.97.170.64:5401')) {
        appUrl = `${protocol}://${host}`;
        console.log('Auto-detected resend app URL from headers:', appUrl);
      } else {
        // Fallback: use the request URL to extract the domain
        try {
          const requestUrl = new URL(request.url);
          appUrl = `${requestUrl.protocol}//${requestUrl.host}`;
          console.log('Using request URL for resend app URL:', appUrl);
        } catch (error) {
          // Environment-based fallback
          appUrl = process.env.NODE_ENV === 'production' 
            ? 'https://your-coolify-domain.com' // Replace with your actual Coolify domain
            : 'http://localhost:3000';
          console.error('Using environment-based fallback URL for resend:', appUrl);
        }
      }
    }
    
    // CRITICAL: Validate that appUrl is NOT a database URL
    if (appUrl.includes('postgres://') || appUrl.includes('postgresql://') || appUrl.includes('161.97.170.64:5401')) {
      console.error('CRITICAL ERROR: resend appUrl is a database URL!', appUrl);
      try {
        const requestUrl = new URL(request.url);
        appUrl = `${requestUrl.protocol}//${requestUrl.host}`;
        console.log('Forced correction to request URL for resend:', appUrl);
      } catch (error) {
        // Environment-based fallback
        appUrl = process.env.NODE_ENV === 'production' 
          ? 'https://your-coolify-domain.com' // Replace with your actual Coolify domain
          : 'http://localhost:3000';
        console.error('Using emergency environment-based fallback URL for resend:', appUrl);
      }
    }
    
    console.log('Final app URL for resend verification link:', appUrl);
    const fromName = process.env.SMTP_FROM_NAME || 'SafeSense Team';
    const fromAddr = process.env.SMTP_FROM || (process.env.SMTP_USER || 'safesencewinwinlabs@gmail.com');

    // Generate new verification token and three-number challenge
    const verifyToken = Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2);
    const options = (() => {
      const set = new Set();
      while (set.size < 3) set.add(Math.floor(10 + Math.random() * 90));
      return Array.from(set);
    })();
    const correct = options[Math.floor(Math.random() * options.length)];
    const username = email.split('@')[0];

    try {
      // Update verification token and store challenge in auth.users table
      await prisma.$executeRaw`
        update auth.users 
        set confirmation_token = ${verifyToken},
            confirmation_sent_at = now(),
            updated_at = now(),
            raw_user_meta_data = coalesce(raw_user_meta_data, '{}'::jsonb) || ${JSON.stringify({ emailVerificationChallenge: { options, correct } })}::jsonb
        where lower(email) = lower(${email}) 
        and deleted_at is null
      `;
      
      console.log('Resent verification token:', { email, verifyToken });
    } catch (e) {
      return NextResponse.json({ success: false, message: 'Failed to update verification token: ' + (e?.message || e) }, { status: 500 });
    }

    // Send verification email
    const buildLink = (n) => `${appUrl}/api/verify-email?token=${verifyToken}&email=${encodeURIComponent(email)}&choice=${encodeURIComponent(n)}`;
    const [n1, n2, n3] = options;
    const link1 = buildLink(n1);
    const link2 = buildLink(n2);
    const link3 = buildLink(n3);
    
    const userMail = {
      from: { name: fromName, address: fromAddr },
      to: email,
      subject: 'Verify your SafeSense account',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <h2 style="margin: 0 0 16px;">Welcome back, ${username} 👋</h2>
          <p style="margin: 0 0 12px; color: #374151;">Verify your email by clicking the number shown in the app.</p>
          <div style="display:flex; gap:12px; margin: 16px 0;">
            <a href="${link1}" style="background:#111827;color:#fff;padding:10px 16px;border-radius:6px;text-decoration:none;">${n1}</a>
            <a href="${link2}" style="background:#111827;color:#fff;padding:10px 16px;border-radius:6px;text-decoration:none;">${n2}</a>
            <a href="${link3}" style="background:#111827;color:#fff;padding:10px 16px;border-radius:6px;text-decoration:none;">${n3}</a>
          </div>
          <p style="margin:0; color:#6b7280; font-size: 12px;">If you didn't request this, you can ignore this email.</p>
        </div>
      `,
    };

    await transporter.verify().catch(() => {});
    await transporter.sendMail(userMail);

    return NextResponse.json({ success: true, message: 'Verification email sent successfully' });
  } catch (error) {
    console.error('Resend verification error:', error);
    return NextResponse.json({ success: false, message: error.message || 'Failed to resend verification email' }, { status: 500 });
  }
}
