export const runtime = "nodejs";

import { NextResponse } from 'next/server';
import { prisma, ensurePrismaConnected } from '../../../../lib/prismaClient.js';
import bcrypt from 'bcrypt';
import crypto from 'crypto';
import otpService from '../../../../lib/otpService.js';

await ensurePrismaConnected();

/**
 * POST /api/signup
 * Step 1: Validate signup data and send OTP
 * 
 * Body: { name, email, password, retypePassword }
 * Response: { success: true, message: 'OTP sent to email' }
 */
export async function POST(request) {
  try {
    const body = await request.json().catch(() => ({}));
    const name = (body?.name || '').trim();
    const email = (body?.email || '').trim().toLowerCase();
    const password = (body?.password || '').trim();
    const retypePassword = (body?.retypePassword || '').trim();

    // Validation
    if (!name || name.length < 2) {
      return NextResponse.json({ 
        success: false, 
        message: 'Name must be at least 2 characters' 
      }, { status: 400 });
    }

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json({ 
        success: false, 
        message: 'Valid email is required' 
      }, { status: 400 });
    }

    if (!password || password.length < 8) {
      return NextResponse.json({ 
        success: false, 
        message: 'Password must be at least 8 characters' 
      }, { status: 400 });
    }

    if (password !== retypePassword) {
      return NextResponse.json({ 
        success: false, 
        message: 'Passwords do not match' 
      }, { status: 400 });
    }

    // Check password strength (optional but recommended)
    const hasUpperCase = /[A-Z]/.test(password);
    const hasLowerCase = /[a-z]/.test(password);
    const hasNumbers = /\d/.test(password);
    const hasSpecialChar = /[!@#$%^&*(),.?":{}|<>]/.test(password);

    if (!hasUpperCase || !hasLowerCase || !hasNumbers) {
      return NextResponse.json({ 
        success: false, 
        message: 'Password must contain uppercase, lowercase, and numbers' 
      }, { status: 400 });
    }

    // Check if account already exists
    try {
      const exists = await prisma.$queryRaw`
        SELECT 1 FROM auth.users 
        WHERE lower(email) = lower(${email}) 
        AND deleted_at IS NULL
        LIMIT 1
      `;
      if (Array.isArray(exists) && exists.length > 0) {
        return NextResponse.json({ 
          success: false, 
          message: 'An account with this email already exists' 
        }, { status: 409 });
      }
    } catch (dbError) {
      console.error('Database error checking existing user:', dbError);
      return NextResponse.json({ 
        success: false, 
        message: 'Database error. Please try again.' 
      }, { status: 500 });
    }

    // Hash password and store temporarily in signup_pending table
    // We'll create the actual account after OTP verification
    const hashedPassword = await bcrypt.hash(password, 12);
    const signupToken = crypto.randomBytes(32).toString('hex');

    try {
      // Store pending signup data
      // First, delete any existing pending signup for this email
      await prisma.$executeRaw`
        DELETE FROM public.signup_pending 
        WHERE email = ${email}
      `;

      // Insert new pending signup
      await prisma.$executeRaw`
        INSERT INTO public.signup_pending (
          email, 
          name, 
          password_hash, 
          signup_token, 
          expires_at, 
          created_at
        ) VALUES (
          ${email},
          ${name},
          ${hashedPassword},
          ${signupToken},
          NOW() + INTERVAL '30 minutes',
          NOW()
        )
      `;
    } catch (dbError) {
      console.error('Failed to store pending signup:', dbError);
      console.error('Error details:', {
        message: dbError.message,
        code: dbError.code,
        meta: dbError.meta
      });
      
      // Check if table doesn't exist
      if (dbError.message?.includes('does not exist') || 
          dbError.message?.includes('relation') || 
          dbError.message?.includes('Table') ||
          dbError.code === '42P01') {
        // Try to create all required tables automatically
        try {
          console.log('Attempting to create authentication tables...');
          
          // Create signup_pending table
          await prisma.$executeRawUnsafe(`
            CREATE TABLE IF NOT EXISTS public.signup_pending (
              id BIGSERIAL PRIMARY KEY,
              email VARCHAR(255) NOT NULL UNIQUE,
              name VARCHAR(255) NOT NULL,
              password_hash VARCHAR(255) NOT NULL,
              signup_token VARCHAR(64) NOT NULL,
              expires_at TIMESTAMPTZ NOT NULL,
              created_at TIMESTAMPTZ DEFAULT NOW()
            )
          `);
          await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS idx_signup_pending_token ON public.signup_pending(signup_token)`);
          await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS idx_signup_pending_expires ON public.signup_pending(expires_at)`);
          
          // Create otp_codes table
          await prisma.$executeRawUnsafe(`
            CREATE TABLE IF NOT EXISTS public.otp_codes (
              id BIGSERIAL PRIMARY KEY,
              email VARCHAR(255) NOT NULL,
              otp VARCHAR(6) NOT NULL,
              purpose VARCHAR(50) DEFAULT 'signup',
              expires_at TIMESTAMPTZ NOT NULL,
              attempts INTEGER DEFAULT 0,
              created_at TIMESTAMPTZ DEFAULT NOW()
            )
          `);
          await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS idx_otp_email_purpose ON public.otp_codes(email, purpose)`);
          await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS idx_otp_expires ON public.otp_codes(expires_at)`);
          
          // Create user_devices table
          await prisma.$executeRawUnsafe(`
            CREATE TABLE IF NOT EXISTS public.user_devices (
              id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
              user_id UUID NOT NULL,
              device_fingerprint VARCHAR(255) NOT NULL,
              device_name VARCHAR(255),
              last_used_at TIMESTAMPTZ DEFAULT NOW(),
              created_at TIMESTAMPTZ DEFAULT NOW(),
              user_agent TEXT,
              ip_address VARCHAR(45),
              UNIQUE(user_id, device_fingerprint)
            )
          `);
          await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS idx_user_device_user ON public.user_devices(user_id)`);
          await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS idx_user_device_last_used ON public.user_devices(last_used_at)`);
          
          console.log('All authentication tables created successfully');
          
          // Retry the insert
          await prisma.$executeRaw`
            INSERT INTO public.signup_pending (
              email, 
              name, 
              password_hash, 
              signup_token, 
              expires_at, 
              created_at
            ) VALUES (
              ${email},
              ${name},
              ${hashedPassword},
              ${signupToken},
              NOW() + INTERVAL '30 minutes',
              NOW()
            )
          `;
          console.log('Signup data stored successfully after table creation');
        } catch (createError) {
          console.error('Failed to create tables:', createError);
          console.error('Create error details:', {
            message: createError.message,
            code: createError.code,
            meta: createError.meta
          });
          return NextResponse.json({ 
            success: false, 
            message: 'Database setup failed. Please contact support or run: node scripts/setup-auth-tables.js',
            code: 'MIGRATION_REQUIRED',
            error: process.env.NODE_ENV === 'development' ? createError.message : undefined
          }, { status: 500 });
        }
      } else {
        return NextResponse.json({ 
          success: false, 
          message: 'Failed to process signup. Please try again.' 
        }, { status: 500 });
      }
    }

    // Generate and send OTP
    try {
      await otpService.generateAndSendOTP(email, 'signup');
    } catch (otpError) {
      console.error('Failed to send OTP:', otpError);
      // Clean up pending signup
      await prisma.$executeRaw`
        DELETE FROM public.signup_pending 
        WHERE email = ${email}
      `;
      return NextResponse.json({ 
        success: false, 
        message: otpError.message || 'Failed to send verification code. Please try again.' 
      }, { status: 500 });
    }

    return NextResponse.json({ 
      success: true, 
      message: 'Verification code sent to your email. Please check your inbox.',
      signupToken // Return token for client to use in verification
    });
  } catch (error) {
    console.error('Signup error:', error);
    return NextResponse.json({ 
      success: false, 
      message: error.message || 'Signup failed. Please try again.' 
    }, { status: 500 });
  }
}
