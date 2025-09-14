export const runtime = "nodejs";

// Signup disabled: using existing Supabase auth.users data
export async function POST() {
  return new Response(JSON.stringify({ message: 'Signup disabled. Ask admin to invite you.' }), { status: 403 });
}