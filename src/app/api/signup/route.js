import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function POST(req) {
  try {
    const { username, email, password } = await req.json();

    // Check if user already exists by email
    const existingUser = await prisma.user.findUnique({
      where: { email }, // Check by email to align with login
    });

    if (existingUser) {
      return new Response(JSON.stringify({ message: 'User already exists' }), {
        status: 400,
      });
    }

    // Create new user
    const newUser = await prisma.user.create({
      data: { username, email, password }, // Store both username and email
    });

    return new Response(
      JSON.stringify({
        message: 'Account created successfully!',
        username: newUser.username,
        email: newUser.email,
      }),
      { status: 201 }
    );
  } catch (err) {
    console.error(err);
    return new Response(JSON.stringify({ message: 'Error creating account' }), {
      status: 500,
    });
  }
}