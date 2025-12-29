export const runtime = "nodejs";

import otpService from '../../../../lib/otpService.js';
import { prisma } from '../../../../lib/prismaClient.js';

/**
 * POST /api/verify-reset-otp
 * Verify OTP for password reset (before allowing password change)
 * 
 * Body: { email, otp }
 * Response: { success: true, message: "OTP verified" }
 */
export async function POST(request) {
  try {
    const { email, otp } = await request.json();

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return new Response(JSON.stringify({ 
        success: false,
        message: 'Valid email is required' 
      }), { 
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    if (!otp || !/^\d{6}$/.test(otp)) {
      return new Response(JSON.stringify({ 
        success: false,
        message: 'Valid 6-digit verification code is required' 
      }), { 
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Verify OTP (check without deleting - will be deleted when password is reset)
    try {
      await otpService.checkOTP(email, otp, 'password_reset');
      
      return new Response(JSON.stringify({ 
        success: true,
        message: 'Verification code is valid. You can now set your new password.'
      }), { 
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    } catch (otpError) {
      return new Response(JSON.stringify({ 
        success: false,
        message: otpError.message || 'Invalid or expired verification code'
      }), { 
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }
  } catch (error) {
    console.error('Verify reset OTP error:', error);
    return new Response(JSON.stringify({ 
      success: false,
      message: 'An error occurred. Please try again later.'
    }), { 
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

