export const runtime = "nodejs";

import otpService from '../../../../lib/otpService.js';
import { prisma } from '../../../../lib/prismaClient.js';

/**
 * POST /api/forgot-password
 * Request password reset - sends OTP to user's email
 * 
 * Body: { email }
 * Response: { success: true, message: "OTP sent" }
 */
export async function POST(request) {
  try {
    const { email } = await request.json();

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return new Response(JSON.stringify({ 
        success: false,
        message: 'Valid email is required' 
      }), { 
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Check if user exists
    const userResult = await prisma.$queryRaw`
      SELECT id, email, email_confirmed_at
      FROM auth.users
      WHERE lower(email) = lower(${email})
      AND deleted_at IS NULL
      LIMIT 1
    `;

    if (!Array.isArray(userResult) || userResult.length === 0) {
      // Don't reveal if user exists or not for security
      return new Response(JSON.stringify({ 
        success: true,
        message: 'If an account exists with this email, a password reset code has been sent.'
      }), { 
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const user = userResult[0];

    // Check if email is confirmed
    if (!user.email_confirmed_at) {
      return new Response(JSON.stringify({ 
        success: false,
        message: 'Please verify your email address before resetting your password.'
      }), { 
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Generate and send OTP for password reset
    try {
      await otpService.generateAndSendOTP(email, 'password_reset');
      
      return new Response(JSON.stringify({ 
        success: true,
        message: 'Password reset code has been sent to your email.'
      }), { 
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    } catch (otpError) {
      console.error('Failed to send password reset OTP:', otpError);
      return new Response(JSON.stringify({ 
        success: false,
        message: 'Failed to send password reset code. Please try again later.'
      }), { 
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }
  } catch (error) {
    console.error('Forgot password error:', error);
    return new Response(JSON.stringify({ 
      success: false,
      message: 'An error occurred. Please try again later.'
    }), { 
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

