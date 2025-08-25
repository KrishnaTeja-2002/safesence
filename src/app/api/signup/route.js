import { supabase } from '@/lib/supabaseClient';

export async function POST(req) {
  try {
    const { email, password, username } = await req.json();

    // Use Supabase signup
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
    });

    if (error) {
      return new Response(JSON.stringify({ message: error.message }), { status: 400 });
    }

    // Optional: Store extra user info (username) in a profile table if needed
    // await supabase.from('profiles').insert({ id: data.user.id, username });

    return new Response(JSON.stringify({ message: 'Account created successfully!', email: data.user.email }), { status: 200 });
  } catch (err) {
    return new Response(JSON.stringify({ message: err.message }), { status: 500 });
  }
}