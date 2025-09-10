import { createClient } from '@supabase/supabase-js';

// Create a server-side Supabase client with service role key for API routes
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://kwaylmatpkcajsctujor.supabase.co';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt3YXlsbWF0cGtjYWpzY3R1am9yIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTUyNDAwMjQsImV4cCI6MjA3MDgxNjAyNH0.-ZICiwnXTGWgPNTMYvirIJ3rP7nQ9tIRC1ZwJBZM96M';

// For API routes, we need to use the service role key to bypass RLS
// In production, make sure to set SUPABASE_SERVICE_ROLE_KEY in your environment variables
if (!supabaseServiceKey) {
  console.error('SUPABASE_SERVICE_ROLE_KEY is not set in environment variables');
}
const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey || supabaseAnonKey);
// Separate client for auth verification (anon is sufficient)
const supabaseAuth = createClient(supabaseUrl, supabaseAnonKey);

export async function authenticateRequest(request) {
  try {
    console.log('Authenticating request...');
    // First try to get token from Authorization header
    const authHeader = request.headers.get('authorization');
    let token = null;
    
    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.substring(7); // Remove 'Bearer ' prefix
    } else {
      // Fallback to cookie-based authentication
      const cookieHeader = request.headers.get('cookie');
      if (cookieHeader) {
        const cookies = cookieHeader.split(';').reduce((acc, cookie) => {
          const [key, value] = cookie.trim().split('=');
          acc[key] = value;
          return acc;
        }, {});
        
        // Try different possible cookie names
        token = cookies['sb-kwaylmatpkcajsctujor-auth-token'] || 
                cookies['supabase-auth-token'] ||
                cookies['sb-auth-token'];
      }
    }
    
    if (!token) {
      console.error('No authentication token found');
      return { error: 'No authentication token found', status: 401 };
    }

    console.log('Token found, verifying...');
    // Verify the JWT token with Supabase (use anon client for auth)
    const { data: { user }, error } = await supabaseAuth.auth.getUser(token);

    if (error || !user) {
      console.error('Token verification failed:', error);
      return { error: 'Invalid or expired token', status: 401 };
    }

    console.log('Authentication successful for user:', user.id);
    return { user, supabaseAdmin };
  } catch (error) {
    return { error: 'Authentication failed', status: 500 };
  }
}

// Alternative method using session from cookies (if you prefer cookie-based auth)
export async function authenticateFromSession(request) {
  try {
    // Get session from cookies
    const cookieHeader = request.headers.get('cookie');
    if (!cookieHeader) {
      return { error: 'No session found', status: 401 };
    }

    // Parse cookies to find Supabase session
    const cookies = cookieHeader.split(';').reduce((acc, cookie) => {
      const [key, value] = cookie.trim().split('=');
      acc[key] = value;
      return acc;
    }, {});

    const sessionToken = cookies['sb-kwaylmatpkcajsctujor-auth-token'];
    if (!sessionToken) {
      return { error: 'No session token found', status: 401 };
    }

    // Verify the session
    const { data: { user }, error } = await supabaseAuth.auth.getUser(sessionToken);

    if (error || !user) {
      return { error: 'Invalid session', status: 401 };
    }

    return { user, supabaseAdmin };
  } catch (error) {
    return { error: 'Session authentication failed', status: 500 };
  }
}
