export const runtime = "nodejs";

import { AuthService } from '../../../../lib/auth.js';

const authService = new AuthService();

export async function POST(req) {
  try {
    const { token } = await req.json();

    if (!token) {
      return new Response(JSON.stringify({ error: 'Token is required' }), { status: 400 });
    }

    // Verify the JWT token
    const user = await authService.getUserByToken(token);

    if (!user) {
      return new Response(JSON.stringify({ error: 'Invalid or expired token' }), { status: 401 });
    }

    return new Response(JSON.stringify({ 
      user: {
        id: user.id,
        email: user.email,
        created_at: user.createdAt
      }
    }), { status: 200 });
  } catch (err) {
    console.error('Token verification error:', err);
    return new Response(JSON.stringify({ error: 'Token verification failed' }), { status: 500 });
  }
}
