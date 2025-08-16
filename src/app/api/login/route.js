import { supabase } from '@/lib/supabaseClient';

export async function POST(req) {
  try {
    const { email, password } = await req.json();

    // Use Supabase login
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      return new Response(JSON.stringify({ message: error.message }), { status: 400 });
    }

    return new Response(JSON.stringify({ message: 'Logged in successfully!', email: data.user.email }), { status: 200 });
  } catch (err) {
    return new Response(JSON.stringify({ message: err.message }), { status: 500 });
  }
}
