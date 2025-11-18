export const runtime = "nodejs";

import { AuthService } from '../../../../../lib/auth.js';

const authService = new AuthService();

export async function POST(req) {
  try {
    const { credential } = await req.json();

    if (!credential) {
      return new Response(JSON.stringify({ message: 'Google credential is required' }), { status: 400 });
    }

    // Verify the Google ID token
    // In production, you should verify the token with Google's servers
    // For now, we'll decode it to get user info
    let googleUserData;
    try {
      // Decode JWT without verification (for development)
      // In production, use Google's token verification endpoint
      const base64Url = credential.split('.')[1];
      const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
      const buffer = Buffer.from(base64, 'base64');
      const jsonPayload = buffer.toString('utf-8');
      googleUserData = JSON.parse(jsonPayload);
    } catch (error) {
      console.error('Failed to decode Google token:', error);
      return new Response(JSON.stringify({ message: 'Invalid Google token' }), { status: 400 });
    }

    // Use custom authentication service
    const result = await authService.loginWithGoogle(googleUserData);

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
    console.error('Google SSO error:', err);
    return new Response(JSON.stringify({ message: err.message || 'Google login failed' }), { status: 400 });
  }
}

