export const runtime = "nodejs";

import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const token = searchParams.get('token');
    const email = searchParams.get('email');

    console.log('Verification attempt:', { token, email });

    if (!token || !email) {
      console.log('Missing token or email');
      return NextResponse.redirect('/login?verified=fail');
    }

    // Check token in auth.users table
    const row = await prisma.$queryRaw`
      select confirmation_token, email_confirmed_at, confirmed_at 
      from auth.users 
      where lower(email) = lower(${email}) 
      and deleted_at is null
      limit 1
    `;
    console.log('Database row:', row);
    
    const ok = Array.isArray(row) && row.length && String(row[0].confirmation_token) === String(token);
    console.log('Token match:', ok, 'Expected:', token, 'Found:', row[0]?.confirmation_token);
    
    if (!ok) {
      console.log('Token verification failed');
      return NextResponse.redirect('/login?verified=fail');
    }

    // Mark verified by setting email_confirmed_at and clearing confirmation_token
    await prisma.$executeRaw`
      update auth.users 
      set email_confirmed_at = now(), 
          confirmed_at = now(),
          confirmation_token = null,
          updated_at = now()
      where lower(email) = lower(${email}) 
      and deleted_at is null
    `;
    console.log('Email verified successfully');

    return NextResponse.redirect('/login?verified=success');
  } catch (e) {
    console.error('Verification error:', e);
    return NextResponse.redirect('/login?verified=error');
  }
}


