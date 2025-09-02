import { createClient } from '@supabase/supabase-js';

// Create a client using the anon key (requires proper RLS setup)
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://kwaylmatpkcajsctujor.supabase.co';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt3YXlsbWF0cGtjYWpzY3R1am9yIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTUyNDAwMjQsImV4cCI6MjA3MDgxNjAyNH0.-ZICiwnXTGWgPNTMYvirIJ3rP7nQ9tIRC1ZwJBZM96M';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

export async function authenticateRequest(request) {
  try {
    // Get the authorization header
    const authHeader = request.headers.get('authorization');
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return { error: 'Missing or invalid authorization header', status: 401 };
    }

    const token = authHeader.substring(7); // Remove 'Bearer ' prefix

    // Create a client with the user's token
    const supabaseWithAuth = createClient(supabaseUrl, supabaseAnonKey, {
      global: {
        headers: {
          Authorization: `Bearer ${token}`
        }
      }
    });

    // Verify the user by getting their session
    const { data: { user }, error } = await supabaseWithAuth.auth.getUser();

    if (error || !user) {
      return { error: 'Invalid or expired token', status: 401 };
    }

    return { user, supabase: supabaseWithAuth };
  } catch (error) {
    return { error: 'Authentication failed', status: 500 };
  }
}
