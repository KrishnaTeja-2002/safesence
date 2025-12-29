export const runtime = "nodejs";

import { NextResponse } from 'next/server';
import { prisma, ensurePrismaConnected } from '../../../../../lib/prismaClient.js';
import crypto from 'crypto';
import otpService from '../../../../../lib/otpService.js';

await ensurePrismaConnected();

/**
 * POST /api/signup/verify
 * Step 2: Verify OTP and create user account
 * 
 * Body: { email, otp, signupToken }
 * Response: { success: true, token, user }
 */
export async function POST(request) {
  try {
    const body = await request.json().catch(() => ({}));
    const email = (body?.email || '').trim().toLowerCase();
    const otp = (body?.otp || '').trim();
    const signupToken = (body?.signupToken || '').trim();

    // Validation
    if (!email || !otp || !signupToken) {
      return NextResponse.json({ 
        success: false, 
        message: 'Email, OTP, and signup token are required' 
      }, { status: 400 });
    }

    if (!/^\d{6}$/.test(otp)) {
      return NextResponse.json({ 
        success: false, 
        message: 'OTP must be a 6-digit number' 
      }, { status: 400 });
    }

    // Verify OTP
    try {
      await otpService.verifyOTP(email, otp, 'signup');
    } catch (otpError) {
      return NextResponse.json({ 
        success: false, 
        message: otpError.message || 'Invalid or expired verification code' 
      }, { status: 400 });
    }

    // Get pending signup data
    let pendingSignup;
    try {
      const result = await prisma.$queryRaw`
        SELECT email, name, password_hash, signup_token, expires_at
        FROM public.signup_pending
        WHERE email = ${email} AND signup_token = ${signupToken}
        AND expires_at > NOW()
        LIMIT 1
      `;

      if (!result || result.length === 0) {
        return NextResponse.json({ 
          success: false, 
          message: 'Signup session expired. Please start over.' 
        }, { status: 400 });
      }

      pendingSignup = result[0];
    } catch (dbError) {
      console.error('Failed to retrieve pending signup:', dbError);
      return NextResponse.json({ 
        success: false, 
        message: 'Failed to verify signup. Please try again.' 
      }, { status: 500 });
    }

    // Check if user already exists (race condition check)
    try {
      const exists = await prisma.$queryRaw`
        SELECT 1 FROM auth.users 
        WHERE lower(email) = lower(${email}) 
        AND deleted_at IS NULL
        LIMIT 1
      `;
      if (Array.isArray(exists) && exists.length > 0) {
        // Clean up pending signup
        await prisma.$executeRaw`
          DELETE FROM public.signup_pending 
          WHERE email = ${email}
        `;
        return NextResponse.json({ 
          success: false, 
          message: 'An account with this email already exists' 
        }, { status: 409 });
      }
    } catch (dbError) {
      console.error('Database error checking existing user:', dbError);
    }

    // Create user account in auth.users
    const userId = crypto.randomUUID();
    const username = email.split('@')[0];
    const userMetaData = { name: pendingSignup.name, username };

    try {
      // Insert user first without JSON, then update JSON separately (to avoid casting issues)
      // Note: confirmed_at is a generated column, so we don't insert it
      await prisma.$executeRaw`
        INSERT INTO auth.users (
          id, 
          email, 
          encrypted_password, 
          email_confirmed_at,
          created_at, 
          updated_at,
          aud,
          role,
          is_sso_user,
          is_anonymous
        ) VALUES (
          ${userId}::uuid,
          ${email},
          ${pendingSignup.password_hash},
          NOW(),
          NOW(),
          NOW(),
          'authenticated',
          'authenticated',
          false,
          false
        )
      `;

      // Update JSON metadata separately using the || operator pattern
      await prisma.$executeRaw`
        UPDATE auth.users
        SET raw_user_meta_data = coalesce(raw_user_meta_data, '{}'::jsonb) || ${JSON.stringify(userMetaData)}::jsonb
        WHERE id = ${userId}::uuid
      `;

      console.log('Created user account:', { userId, email });
    } catch (dbError) {
      console.error('Failed to create user account:', dbError);
      console.error('Error details:', {
        message: dbError.message,
        code: dbError.code,
        meta: dbError.meta,
        userId,
        email
      });
      
      // Provide more specific error message
      let errorMessage = 'Failed to create account. Please try again.';
      if (dbError.message?.includes('duplicate') || dbError.message?.includes('unique')) {
        errorMessage = 'An account with this email already exists. Please try logging in.';
      } else if (dbError.message?.includes('constraint')) {
        errorMessage = 'Account creation failed due to database constraint. Please contact support.';
      } else if (process.env.NODE_ENV === 'development') {
        errorMessage = `Failed to create account: ${dbError.message}`;
      }
      
      return NextResponse.json({ 
        success: false, 
        message: errorMessage,
        code: dbError.code,
        details: process.env.NODE_ENV === 'development' ? dbError.message : undefined
      }, { status: 500 });
    }

    // Create user preferences
    try {
      await prisma.$executeRaw`
        INSERT INTO public.user_preferences (
          user_id,
          temp_scale,
          show_temp,
          show_humidity,
          show_sensors,
          show_users,
          show_alerts,
          show_notifications,
          time_zone,
          dark_mode,
          username,
          created_at,
          updated_at
        ) VALUES (
          ${userId}::uuid,
          'F',
          true,
          false,
          true,
          true,
          true,
          true,
          'America/Anchorage',
          false,
          ${username},
          NOW(),
          NOW()
        )
        ON CONFLICT (user_id) DO NOTHING
      `;
    } catch (prefError) {
      console.error('Failed to create user preferences:', prefError);
      // Non-critical, continue
    }

    // Clean up pending signup
    await prisma.$executeRaw`
      DELETE FROM public.signup_pending 
      WHERE email = ${email}
    `;

    // Generate JWT token
    const jwt = await import('jsonwebtoken');
    const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';
    const token = jwt.sign(
      { 
        id: userId, 
        email: email,
        iat: Math.floor(Date.now() / 1000)
      },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    return NextResponse.json({ 
      success: true, 
      message: 'Account created successfully!',
      token,
      user: {
        id: userId,
        email: email,
        name: pendingSignup.name
      }
    });
  } catch (error) {
    console.error('Signup verification error:', error);
    return NextResponse.json({ 
      success: false, 
      message: error.message || 'Verification failed. Please try again.' 
    }, { status: 500 });
  }
}

