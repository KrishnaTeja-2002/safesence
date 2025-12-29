-- Migration: Create OTP and device tracking tables
-- Run this SQL script in your PostgreSQL database

-- Create OTP codes table
CREATE TABLE IF NOT EXISTS public.otp_codes (
  id BIGSERIAL PRIMARY KEY,
  email VARCHAR(255) NOT NULL,
  otp VARCHAR(6) NOT NULL,
  purpose VARCHAR(50) DEFAULT 'signup',
  expires_at TIMESTAMPTZ NOT NULL,
  attempts INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_otp_email_purpose ON public.otp_codes(email, purpose);
CREATE INDEX IF NOT EXISTS idx_otp_expires ON public.otp_codes(expires_at);

-- Create user devices table for login security
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

CREATE INDEX IF NOT EXISTS idx_user_device_user ON public.user_devices(user_id);
CREATE INDEX IF NOT EXISTS idx_user_device_last_used ON public.user_devices(last_used_at);

-- Create signup pending table
CREATE TABLE IF NOT EXISTS public.signup_pending (
  id BIGSERIAL PRIMARY KEY,
  email VARCHAR(255) NOT NULL UNIQUE,
  name VARCHAR(255) NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  signup_token VARCHAR(64) NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_signup_pending_token ON public.signup_pending(signup_token);
CREATE INDEX IF NOT EXISTS idx_signup_pending_expires ON public.signup_pending(expires_at);

-- Cleanup expired records (optional - can be run periodically)
-- DELETE FROM public.otp_codes WHERE expires_at < NOW();
-- DELETE FROM public.signup_pending WHERE expires_at < NOW();

