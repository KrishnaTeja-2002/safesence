export const runtime = "nodejs";

import { AuthService } from '../../../../lib/auth.js';

const authService = new AuthService();

export async function POST(req) {
  try {
    const { email, password } = await req.json();

    if (!email || !password) {
      return new Response(JSON.stringify({ message: 'Email and password are required' }), { status: 400 });
    }

    // Use custom authentication
    const result = await authService.login(email, password);

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
      code: err.message?.includes('verify') ? 'VERIFICATION_REQUIRED' : 'LOGIN_ERROR'
    }), { status: 400 });
  }
}
