export const runtime = "nodejs";

import { NextResponse } from 'next/server';
import { prisma, ensurePrismaConnected } from '../../../../lib/prismaClient.js';
import { AuthService } from '../../../../lib/auth.js';

await ensurePrismaConnected();

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const token = searchParams.get('token');
    const email = searchParams.get('email');
    const choice = searchParams.get('choice');

    console.log('Verification attempt:', { token, email });

    if (!token || !email) {
      console.log('Missing token or email');
      return NextResponse.redirect(new URL('/login?verified=fail', request.url));
    }
    if (!choice) {
      console.log('Missing chosen number for verification');
      return NextResponse.redirect(new URL('/login?verified=fail', request.url));
    }

    // Check token and fetch metadata in auth.users table
    const row = await prisma.$queryRaw`
      select confirmation_token, email_confirmed_at, confirmed_at, raw_user_meta_data 
      from auth.users 
      where lower(email) = lower(${email}) 
      and deleted_at is null
      limit 1
    `;
    console.log('Database row:', row);
    
    const tokenOk = Array.isArray(row) && row.length && String(row[0].confirmation_token) === String(token);
    console.log('Token match:', tokenOk, 'Expected:', token, 'Found:', row[0]?.confirmation_token);
    let choiceOk = false;
    try {
      const meta = row?.[0]?.raw_user_meta_data || null;
      const parsed = typeof meta === 'string' ? JSON.parse(meta) : meta;
      const expected = parsed?.emailVerificationChallenge?.correct;
      choiceOk = expected != null && String(expected) === String(choice);
    } catch (e) {
      console.log('Failed to parse raw_user_meta_data for choice validation');
      choiceOk = false;
    }
    
    if (!tokenOk || !choiceOk) {
      console.log('Verification failed due to token or choice mismatch');
      return NextResponse.redirect(new URL('/login?verified=fail', request.url));
    }

    // Mark verified by setting email_confirmed_at and clearing confirmation_token
    await prisma.$executeRaw`
      update auth.users 
      set email_confirmed_at = now(), 
          confirmation_token = null,
          updated_at = now()
      where lower(email) = lower(${email}) 
      and deleted_at is null
    `;
    console.log('Email verified successfully');

    // Fetch user id to generate token
    const userRow = await prisma.$queryRaw`
      select id, email, created_at from auth.users where lower(email) = lower(${email}) and deleted_at is null limit 1
    `;
    const user = Array.isArray(userRow) && userRow.length ? userRow[0] : null;
    let jwtToken = null;
    if (user) {
      const authService = new AuthService();
      jwtToken = authService.generateToken({ id: user.id, email: user.email, created_at: user.created_at });
    }

    const verifiedUrl = new URL('/verified', request.url);
    if (jwtToken) verifiedUrl.searchParams.set('token', jwtToken);
    return NextResponse.redirect(verifiedUrl);
  } catch (e) {
    console.error('Verification error:', e);
    return NextResponse.redirect(new URL('/login?verified=error', request.url));
  }
}


