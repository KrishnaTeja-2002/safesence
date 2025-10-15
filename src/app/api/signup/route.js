export const runtime = "nodejs";

import { NextResponse } from 'next/server';
import nodemailer from 'nodemailer';
import { prisma, ensurePrismaConnected } from '../../../../lib/prismaClient.js';
import bcrypt from 'bcrypt';
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
    const password = (body?.password || '').trim();
    const username = (body?.username || (email ? email.split('@')[0] : '')).trim();

    if (!email) {
      return NextResponse.json({ message: 'Email is required' }, { status: 400 });
    }
    if (!password) {
      return NextResponse.json({ message: 'Password is required' }, { status: 400 });
    }

    // Check if account already exists in auth.users (case-insensitive)
    try {
      const exists = await prisma.$queryRaw`select 1 from auth.users where lower(email) = lower(${email}) limit 1`;
      if (Array.isArray(exists) && exists.length > 0) {
        return NextResponse.json({ success: false, message: 'Account already exists' }, { status: 409 });
      }
    } catch {}

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
        console.log('Auto-detected app URL from headers:', appUrl);
      } else {
        // Fallback: use the request URL to extract the domain
        try {
          const requestUrl = new URL(request.url);
          appUrl = `${requestUrl.protocol}//${requestUrl.host}`;
          console.log('Using request URL for app URL:', appUrl);
        } catch (error) {
          // Last resort fallback based on environment
          appUrl = process.env.NODE_ENV === 'production' 
            ? 'https://your-coolify-domain.com' // Replace with your actual Coolify domain
            : 'http://localhost:3000';
          console.error('Using environment-based fallback URL:', appUrl);
        }
      }
    }
    
    // CRITICAL: Validate that appUrl is NOT a database URL
    if (appUrl.includes('postgres://') || appUrl.includes('postgresql://') || appUrl.includes('161.97.170.64:5401')) {
      console.error('CRITICAL ERROR: appUrl is a database URL!', appUrl);
      // Force use of request URL
      try {
        const requestUrl = new URL(request.url);
        appUrl = `${requestUrl.protocol}//${requestUrl.host}`;
        console.log('Forced correction to request URL:', appUrl);
      } catch (error) {
        // Environment-based fallback
        appUrl = process.env.NODE_ENV === 'production' 
          ? 'https://your-coolify-domain.com' // Replace with your actual Coolify domain
          : 'http://localhost:3000';
        console.error('Using emergency environment-based fallback URL:', appUrl);
      }
    }
    
    // Log final URL for debugging
    console.log('Final app URL for verification link:', appUrl);
    console.log('Environment:', process.env.NODE_ENV);

    const fromName = process.env.SMTP_FROM_NAME || 'SafeSense Team';
    const fromAddr = process.env.SMTP_FROM || (process.env.SMTP_USER || 'safesencewinwinlabs@gmail.com');

    // Prepare three-number verification challenge
    const generateOptions = () => {
      const set = new Set();
      while (set.size < 3) {
        set.add(Math.floor(10 + Math.random() * 90)); // 10-99
      }
      return Array.from(set);
    };
    const options = generateOptions();
    const correct = options[Math.floor(Math.random() * options.length)];

    // Create account directly in auth.users table
    let verifyToken = Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2);
    try {
      const hashed = await bcrypt.hash(password, 12);
      const userId = crypto.randomUUID();
      
      // Create user directly in auth.users with all required fields
      await prisma.$executeRaw`
        INSERT INTO auth.users (
          id, 
          email, 
          encrypted_password, 
          confirmation_token,
          confirmation_sent_at,
          created_at, 
          updated_at,
          aud,
          role,
          is_sso_user,
          is_anonymous,
          raw_user_meta_data
        ) VALUES (
          ${userId}::uuid,
          ${email},
          ${hashed},
          ${verifyToken},
          now(),
          now(),
          now(),
          'authenticated',
          'authenticated',
          false,
          false,
          ${JSON.stringify({ emailVerificationChallenge: { options, correct } })}::jsonb
        )
      `;
      
      console.log('Created user in auth.users:', { userId, email, verifyToken });
      
    } catch (e) {
      return NextResponse.json({ success: false, message: 'Failed to create account: ' + (e?.message || e) }, { status: 500 });
    }

    // 1) Send verification link to the user
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
          <h2 style="margin: 0 0 16px;">Welcome, ${username || 'there'} 👋</h2>
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

    // 2) Notify admin mailbox
    const adminTo = process.env.SIGNUP_NOTIFY_TO || fromAddr;
    const adminMail = {
      from: { name: fromName, address: fromAddr },
      to: adminTo,
      subject: 'New SafeSense signup request',
      text: `New signup request\nEmail: ${email}\nUsername: ${username}`,
    };

    await transporter.verify().catch(() => {});
    await Promise.all([
      transporter.sendMail(userMail),
      transporter.sendMail(adminMail),
    ]);

    return NextResponse.json({ success: true, message: 'Verification email sent. Please verify to sign in.', challengeCorrect: correct });
  } catch (error) {
    return NextResponse.json({ success: false, message: error.message || 'Signup failed' }, { status: 500 });
  }
}