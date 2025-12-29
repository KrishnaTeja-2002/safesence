export const runtime = "nodejs";

import { NextResponse } from 'next/server';
import { prisma, ensurePrismaConnected } from '../../../../lib/prismaClient.js';

await ensurePrismaConnected();

/**
 * POST /api/setup-auth-tables
 * Creates authentication-related tables if they don't exist
 * This is a one-time setup endpoint
 */
export async function POST(request) {
  try {
    console.log('🚀 Setting up authentication tables...');
    
    // Create signup_pending table
    console.log('Creating signup_pending table...');
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
    console.log('Creating otp_codes table...');
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
    console.log('Creating user_devices table...');
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
    
    console.log('✅ All authentication tables created successfully');
    
    return NextResponse.json({ 
      success: true, 
      message: 'Authentication tables created successfully!',
      tables: ['signup_pending', 'otp_codes', 'user_devices']
    });
  } catch (error) {
    console.error('❌ Error setting up tables:', error);
    console.error('Error details:', {
      message: error.message,
      code: error.code,
      meta: error.meta
    });
    
    return NextResponse.json({ 
      success: false, 
      message: error.message || 'Failed to create tables',
      error: process.env.NODE_ENV === 'development' ? {
        message: error.message,
        code: error.code,
        stack: error.stack
      } : undefined
    }, { status: 500 });
  }
}

