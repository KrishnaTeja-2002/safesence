import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function POST(req) {
  try {
    const { username, password } = await req.json();

    // Find user
    const user = await prisma.user.findUnique({
      where: { username }, // works now
    });
    if (!user || user.password !== password) {
      return new Response(JSON.stringify({ message: 'Invalid credentials' }), {
        status: 401,
      });
    }

    return new Response(
      JSON.stringify({ message: 'Login successful!', username: user.username }),
      { status: 200 }
    );
  } catch (err) {
    console.error(err);
    return new Response(JSON.stringify({ message: 'Error logging in' }), {
      status: 500,
    });
  }
}