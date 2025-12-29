export const runtime = "nodejs";

import { AuthService } from '../../../../lib/auth.js';
import deviceService from '../../../../lib/deviceService.js';

const authService = new AuthService();

/**
 * POST /api/login
 * Login with email and password
 * 
 * Body: { email, password, deviceFingerprint? (optional, for device tracking) }
 * Response: { token, user }
 */
export async function POST(req) {
  try {
    const { email, password, deviceFingerprint } = await req.json();
    const userAgent = req.headers.get('user-agent') || '';
    const ipAddress = req.headers.get('x-forwarded-for')?.split(',')[0] || 
                     req.headers.get('x-real-ip') || '';

    if (!email || !password) {
      return new Response(JSON.stringify({ 
        message: 'Email and password are required' 
      }), { status: 400 });
    }

    // Authenticate user
    let result;
    try {
      result = await authService.login(email, password);
    } catch (authError) {
      return new Response(JSON.stringify({ 
        message: authError.message || 'Login failed',
        code: authError.message?.includes('verify') ? 'VERIFICATION_REQUIRED' : 'LOGIN_ERROR'
      }), { status: 400 });
    }

    const userId = result.user.id;

    // Optional: Track device for analytics (no OTP required)
    // Just register/update device info silently without blocking login
    try {
      const fingerprint = deviceFingerprint || 
                         deviceService.generateDeviceFingerprint(userAgent, ipAddress);
      await deviceService.registerDevice(
        userId, 
        fingerprint, 
        deviceService.getDeviceName(userAgent),
        userAgent,
        ipAddress
      );
    } catch (deviceError) {
      // Log but don't block login if device tracking fails
      console.warn('Failed to register device, but allowing login:', deviceError.message);
    }

    // Successful login
    return new Response(JSON.stringify({ 
      message: 'Logged in successfully!', 
      email: result.user.email,
      token: result.token,
      user: result.user
    }), { 
      status: 200,
      headers: {
        'Set-Cookie': `auth-token=${result.token}; HttpOnly; Path=/; Max-Age=${7 * 24 * 60 * 60}; SameSite=Strict`
      }
    });
  } catch (err) {
    console.error('Login error:', err);
    
    // Handle database connection errors
    if (err.message && (
      err.message.includes('Can\'t reach database server') ||
      err.message.includes('database server') ||
      err.message.includes('ECONNREFUSED') ||
      err.message.includes('ETIMEDOUT')
    )) {
      return new Response(JSON.stringify({ 
        message: 'Unable to connect to the server. Please try again later or contact support.',
        code: 'DATABASE_ERROR'
      }), { status: 503 });
    }
    
    // Handle other errors
    return new Response(JSON.stringify({ 
      message: err.message || 'Login failed',
      code: 'LOGIN_ERROR'
    }), { status: 500 });
  }
}
