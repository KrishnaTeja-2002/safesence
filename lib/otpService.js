import { prisma } from './prismaClient.js';
import nodemailer from 'nodemailer';
import crypto from 'crypto';

const OTP_EXPIRY_MINUTES = 10;
const OTP_MAX_ATTEMPTS = 5;

/**
 * OTP Service for secure authentication
 * Generates, stores, and verifies 6-digit OTP codes
 */
export class OTPService {
  /**
   * Generate a secure 6-digit OTP
   */
  generateOTP() {
    // Generate cryptographically secure random number
    const randomBytes = crypto.randomBytes(3);
    const otp = (parseInt(randomBytes.toString('hex'), 16) % 1000000)
      .toString()
      .padStart(6, '0');
    return otp;
  }

  /**
   * Send OTP via email
   */
  async sendOTP(email, otp, purpose = 'signup') {
    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.SMTP_USER || 'safesencewinwinlabs@gmail.com',
        pass: process.env.SMTP_PASS || 'tprw plda fxec pzqt',
      },
      secure: false,
      port: 587,
      requireTLS: true,
      tls: {
        rejectUnauthorized: false
      }
    });

    const subject = purpose === 'signup' 
      ? 'SafeSense - Verify Your Email' 
      : purpose === 'password_reset'
      ? 'SafeSense - Password Reset Code'
      : 'SafeSense - Login Verification Code';

    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="text-align: center; margin-bottom: 30px;">
          <h1 style="color: #1f2937; margin-bottom: 10px;">SafeSense</h1>
        </div>
        
        <div style="background-color: #f9fafb; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
          <h2 style="color: #1f2937; margin-top: 0;">Your Verification Code</h2>
          <p style="color: #374151; line-height: 1.6;">
            ${purpose === 'signup' 
              ? 'Thank you for signing up! Use this code to verify your email address:' 
              : purpose === 'password_reset'
              ? 'You requested to reset your password. Use this code to verify your identity:'
              : 'Use this code to complete your login:'}
          </p>
          <div style="text-align: center; margin: 30px 0;">
            <div style="display: inline-block; background-color: #1f2937; color: #ffffff; padding: 20px 40px; border-radius: 8px; font-size: 32px; font-weight: bold; letter-spacing: 8px;">
              ${otp}
            </div>
          </div>
          <p style="color: #6b7280; font-size: 14px; margin: 0;">
            This code will expire in ${OTP_EXPIRY_MINUTES} minutes.
          </p>
          <p style="color: #6b7280; font-size: 14px; margin-top: 10px;">
            If you didn't request this code, please ignore this email.
          </p>
        </div>
        
        <div style="border-top: 1px solid #e5e7eb; padding-top: 20px; margin-top: 30px;">
          <p style="color: #6b7280; font-size: 14px; text-align: center; margin: 0;">
            This email was sent by SafeSense Team<br>
            If you have any questions, please contact support.
          </p>
        </div>
      </div>
    `;

    try {
      await transporter.sendMail({
        from: {
          name: 'SafeSense Team',
          address: process.env.SMTP_USER || 'safesencewinwinlabs@gmail.com'
        },
        to: email,
        subject,
        html
      });
      return true;
    } catch (error) {
      console.error('Failed to send OTP email:', error);
      throw new Error('Failed to send verification code. Please try again.');
    }
  }

  /**
   * Store OTP in database
   */
  async storeOTP(email, otp, purpose = 'signup') {
    const expiresAt = new Date(Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000);
    
    try {
      // Delete any existing OTPs for this email and purpose
      await prisma.$executeRaw`
        DELETE FROM public.otp_codes 
        WHERE email = ${email} AND purpose = ${purpose}
      `;

      // Insert new OTP
      await prisma.$executeRaw`
        INSERT INTO public.otp_codes (email, otp, purpose, expires_at, attempts, created_at)
        VALUES (${email}, ${otp}, ${purpose}, ${expiresAt}, 0, NOW())
      `;

      return true;
    } catch (error) {
      console.error('Failed to store OTP:', error);
      
      // Check if table doesn't exist
      if (error.message?.includes('does not exist') || 
          error.message?.includes('relation') || 
          error.message?.includes('Table') ||
          error.code === '42P01') {
        // Try to create the table automatically
        try {
          console.log('Attempting to create otp_codes table...');
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
            CREATE INDEX IF NOT EXISTS idx_otp_email_purpose ON public.otp_codes(email, purpose);
            CREATE INDEX IF NOT EXISTS idx_otp_expires ON public.otp_codes(expires_at);
          `);
          
          // Retry the insert
          await prisma.$executeRaw`
            INSERT INTO public.otp_codes (email, otp, purpose, expires_at, attempts, created_at)
            VALUES (${email}, ${otp}, ${purpose}, ${expiresAt}, 0, NOW())
          `;
          console.log('OTP table created and OTP stored successfully');
          return true;
        } catch (createError) {
          console.error('Failed to create OTP table:', createError);
          throw new Error('Database setup required. Please run the migration script.');
        }
      }
      
      throw new Error('Failed to generate verification code');
    }
  }

  /**
   * Verify OTP (checks without deleting - for password reset flow)
   */
  async checkOTP(email, otp, purpose = 'signup') {
    try {
      // Get OTP record
      const result = await prisma.$queryRaw`
        SELECT otp, expires_at, attempts, purpose
        FROM public.otp_codes
        WHERE email = ${email} AND purpose = ${purpose}
        ORDER BY created_at DESC
        LIMIT 1
      `;

      if (!result || result.length === 0) {
        throw new Error('Verification code not found. Please request a new code.');
      }

      const otpRecord = result[0];

      // Check if expired
      if (new Date(otpRecord.expires_at) < new Date()) {
        throw new Error('Verification code has expired. Please request a new code.');
      }

      // Check attempts
      if (otpRecord.attempts >= OTP_MAX_ATTEMPTS) {
        throw new Error('Too many failed attempts. Please request a new code.');
      }

      // Verify OTP
      if (otpRecord.otp !== otp) {
        // Increment attempts
        await prisma.$executeRaw`
          UPDATE public.otp_codes
          SET attempts = attempts + 1
          WHERE email = ${email} AND purpose = ${purpose}
        `;
        throw new Error('Invalid verification code. Please try again.');
      }

      // OTP is valid but don't delete it yet
      return true;
    } catch (error) {
      if (error.message.includes('not found') || 
          error.message.includes('expired') || 
          error.message.includes('attempts') ||
          error.message.includes('Invalid')) {
        throw error;
      }
      console.error('OTP check error:', error);
      throw new Error('Failed to verify code. Please try again.');
    }
  }

  /**
   * Verify OTP (and delete after verification)
   */
  async verifyOTP(email, otp, purpose = 'signup') {
    try {
      // First check the OTP
      await this.checkOTP(email, otp, purpose);
      
      // OTP verified - delete it
      await this.deleteOTP(email, purpose);
      return true;
    } catch (error) {
      throw error;
    }
  }

  /**
   * Delete OTP record
   */
  async deleteOTP(email, purpose) {
    try {
      await prisma.$executeRaw`
        DELETE FROM public.otp_codes
        WHERE email = ${email} AND purpose = ${purpose}
      `;
    } catch (error) {
      console.error('Failed to delete OTP:', error);
    }
  }

  /**
   * Generate and send OTP
   */
  async generateAndSendOTP(email, purpose = 'signup') {
    const otp = this.generateOTP();
    await this.storeOTP(email, otp, purpose);
    await this.sendOTP(email, otp, purpose);
    return otp; // Return for testing purposes only
  }
}

export default new OTPService();

