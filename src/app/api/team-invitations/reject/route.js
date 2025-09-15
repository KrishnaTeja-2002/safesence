import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function POST(request) {
  try {
    const { token } = await request.json();

    if (!token) {
      return NextResponse.json(
        { error: 'Token is required' },
        { status: 400 }
      );
    }

    // Find the invitation
    const invitation = await prisma.teamInvitation.findUnique({
      where: { token }
    });

    if (!invitation) {
      return NextResponse.json(
        { error: 'Invalid token' },
        { status: 404 }
      );
    }

    if (invitation.status === 'rejected') {
      return NextResponse.json({
        alreadyRejected: true,
        message: 'Invitation already rejected'
      });
    }

    if (invitation.status !== 'pending') {
      return NextResponse.json(
        { error: 'Invitation is no longer valid' },
        { status: 400 }
      );
    }

    // Update invitation status to rejected
    await prisma.teamInvitation.update({
      where: { token },
      data: { status: 'rejected' }
    });

    return NextResponse.json({
      success: true,
      message: 'Invitation rejected successfully'
    });

  } catch (error) {
    console.error('Reject invitation error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  } finally {
    await prisma.$disconnect();
  }
}
