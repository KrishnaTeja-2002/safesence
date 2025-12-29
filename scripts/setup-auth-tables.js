#!/usr/bin/env node

/**
 * Script to create authentication-related tables
 * Run this script to set up OTP, device tracking, and signup pending tables
 */

import { PrismaClient } from '@prisma/client';
import { config } from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

// Load environment variables from .env file
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootDir = join(__dirname, '..');
config({ path: join(rootDir, '.env') });

// Check if DATABASE_URL is set
if (!process.env.DATABASE_URL) {
  console.error('❌ ERROR: DATABASE_URL environment variable is not set');
  console.error('Please set DATABASE_URL in your .env file or environment variables');
  process.exit(1);
}

const prisma = new PrismaClient();

async function setupAuthTables() {
  try {
    console.log('🚀 Setting up authentication tables...\n');
    
    // Create OTP codes table
    console.log('📝 Creating otp_codes table...');
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS public.otp_codes (
        id BIGSERIAL PRIMARY KEY,
        email VARCHAR(255) NOT NULL,
        otp VARCHAR(6) NOT NULL,
        purpose VARCHAR(50) DEFAULT 'signup',
        expires_at TIMESTAMPTZ NOT NULL,
        attempts INTEGER DEFAULT 0,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);
    console.log('✅ Created otp_codes table');
    
    // Create indexes for OTP table
    console.log('📝 Creating indexes for otp_codes...');
    await prisma.$executeRawUnsafe(`
      CREATE INDEX IF NOT EXISTS idx_otp_email_purpose ON public.otp_codes(email, purpose);
      CREATE INDEX IF NOT EXISTS idx_otp_expires ON public.otp_codes(expires_at);
    `);
    console.log('✅ Created indexes for otp_codes\n');
    
    // Create user devices table
    console.log('📝 Creating user_devices table...');
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
      );
    `);
    console.log('✅ Created user_devices table');
    
    // Create indexes for user_devices table
    console.log('📝 Creating indexes for user_devices...');
    await prisma.$executeRawUnsafe(`
      CREATE INDEX IF NOT EXISTS idx_user_device_user ON public.user_devices(user_id);
      CREATE INDEX IF NOT EXISTS idx_user_device_last_used ON public.user_devices(last_used_at);
    `);
    console.log('✅ Created indexes for user_devices\n');
    
    // Create signup pending table
    console.log('📝 Creating signup_pending table...');
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS public.signup_pending (
        id BIGSERIAL PRIMARY KEY,
        email VARCHAR(255) NOT NULL UNIQUE,
        name VARCHAR(255) NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        signup_token VARCHAR(64) NOT NULL,
        expires_at TIMESTAMPTZ NOT NULL,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);
    console.log('✅ Created signup_pending table');
    
    // Create indexes for signup_pending table
    console.log('📝 Creating indexes for signup_pending...');
    await prisma.$executeRawUnsafe(`
      CREATE INDEX IF NOT EXISTS idx_signup_pending_token ON public.signup_pending(signup_token);
      CREATE INDEX IF NOT EXISTS idx_signup_pending_expires ON public.signup_pending(expires_at);
    `);
    console.log('✅ Created indexes for signup_pending\n');
    
    console.log('🎉 All authentication tables created successfully!');
    
  } catch (error) {
    console.error('❌ Error setting up tables:', error.message);
    console.error('Full error:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the setup
setupAuthTables().catch(console.error);

