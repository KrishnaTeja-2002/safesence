import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function POST(request) {
  try {
    const { token, name, role } = await request.json();

    if (!token || !name || !role) {
      return NextResponse.json(
        { error: 'Token, name, and role are required' },
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

    if (invitation.status === 'accepted') {
      return NextResponse.json({
        alreadyAccepted: true,
        message: 'Invitation already accepted'
      });
    }

    if (invitation.status !== 'pending') {
      return NextResponse.json(
        { error: 'Invitation is no longer valid' },
        { status: 400 }
      );
    }

    // Check if user already exists in the system
    const existingUser = await prisma.user.findFirst({
      where: {
        OR: [
          { email: invitation.email },
          { email: { contains: name } }
        ]
      }
    });

    if (existingUser) {
      // Update invitation status to accepted
      await prisma.teamInvitation.update({
        where: { token },
        data: { status: 'accepted' }
      });

      return NextResponse.json({
        alreadyMember: true,
        name: existingUser.email?.split('@')[0] || name,
        message: 'User is already a team member'
      });
    }

    // Update invitation status to accepted
    await prisma.teamInvitation.update({
      where: { token },
      data: { 
        status: 'accepted',
        acceptedName: name,
        acceptedRole: role
      }
    });

    return NextResponse.json({
      success: true,
      name,
      role,
      message: 'Invitation accepted successfully'
    });

  } catch (error) {
    console.error('Accept invitation error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  } finally {
    await prisma.$disconnect();
  }
}
