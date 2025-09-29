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
    return new Response(JSON.stringify({ message: err.message || 'Login failed' }), { status: 400 });
  }
}
