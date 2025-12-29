export const runtime = "nodejs";

import otpService from '../../../../lib/otpService.js';
import { prisma } from '../../../../lib/prismaClient.js';
import bcrypt from 'bcrypt';

/**
 * POST /api/reset-password
 * Verify OTP and reset password
 * 
 * Body: { email, otp, newPassword, retypePassword }
 * Response: { success: true, message: "Password reset successful" }
 */
export async function POST(request) {
  try {
    const { email, otp, newPassword, retypePassword } = await request.json();

    // Validation
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

    if (!newPassword || newPassword.length < 8) {
      return new Response(JSON.stringify({ 
        success: false,
        message: 'Password must be at least 8 characters' 
      }), { 
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    if (newPassword !== retypePassword) {
      return new Response(JSON.stringify({ 
        success: false,
        message: 'Passwords do not match' 
      }), { 
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Password strength check
    const hasUpperCase = /[A-Z]/.test(newPassword);
    const hasLowerCase = /[a-z]/.test(newPassword);
    const hasNumbers = /\d/.test(newPassword);

    if (!hasUpperCase || !hasLowerCase || !hasNumbers) {
      return new Response(JSON.stringify({ 
        success: false,
        message: 'Password must contain uppercase, lowercase, and numbers' 
      }), { 
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Verify OTP
    try {
      await otpService.verifyOTP(email, otp, 'password_reset');
    } catch (otpError) {
      return new Response(JSON.stringify({ 
        success: false,
        message: otpError.message || 'Invalid or expired verification code'
      }), { 
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Check if user exists
    const userResult = await prisma.$queryRaw`
      SELECT id, email
      FROM auth.users
      WHERE lower(email) = lower(${email})
      AND deleted_at IS NULL
      LIMIT 1
    `;

    if (!Array.isArray(userResult) || userResult.length === 0) {
      return new Response(JSON.stringify({ 
        success: false,
        message: 'User not found'
      }), { 
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const user = userResult[0];

    // Hash new password
    const saltRounds = 12;
    const passwordHash = await bcrypt.hash(newPassword, saltRounds);

    console.log('Password reset - hashing new password:', {
      email,
      userId: user.id,
      hashLength: passwordHash.length,
      hashPrefix: passwordHash.substring(0, 20)
    });

    // Update password in database
    try {
      // Update password - ensure proper UUID casting
      const updateResult = await prisma.$executeRaw`
        UPDATE auth.users
        SET encrypted_password = ${passwordHash},
            updated_at = NOW()
        WHERE id = ${user.id}::uuid
          AND deleted_at IS NULL
      `;

      console.log('Password update result:', updateResult);

      // Verify the password was actually saved
      const verifyResult = await prisma.$queryRaw`
        SELECT encrypted_password
        FROM auth.users
        WHERE id = ${user.id}::uuid
          AND deleted_at IS NULL
        LIMIT 1
      `;

      if (Array.isArray(verifyResult) && verifyResult.length > 0) {
        const savedHash = verifyResult[0].encrypted_password;
        console.log('Password reset - verification:', {
          savedHashLength: savedHash?.length,
          savedHashPrefix: savedHash?.substring(0, 20),
          matches: savedHash === passwordHash
        });
      }

      return new Response(JSON.stringify({ 
        success: true,
        message: 'Password has been reset successfully. You can now log in with your new password.'
      }), { 
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    } catch (updateError) {
      console.error('Failed to update password:', updateError);
      console.error('Update error details:', {
        message: updateError.message,
        code: updateError.code,
        meta: updateError.meta,
        stack: updateError.stack,
        userId: user.id,
        email: email
      });
      
      // Return more detailed error message for debugging
      const errorMessage = updateError.message || 'Unknown error';
      return new Response(JSON.stringify({ 
        success: false,
        message: process.env.NODE_ENV === 'development' 
          ? `Failed to reset password: ${errorMessage}`
          : 'Failed to reset password. Please try again.'
      }), { 
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }
  } catch (error) {
    console.error('Reset password error:', error);
    return new Response(JSON.stringify({ 
      success: false,
      message: 'An error occurred. Please try again later.'
    }), { 
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

