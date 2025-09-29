export const runtime = "nodejs";


import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// POST /api/shares -> create invitation for a user to a sensor (owner/admin)
// Body: { sensor_id: string, email: string, role: 'viewer'|'admin' }
export async function POST(request) {
  try {
    const { sensor_id, email, role } = await request.json();

    if (!sensor_id || !role || !email) {
      return NextResponse.json(
        { error: 'sensor_id, role and email are required' },
        { status: 400 }
      );
    }

    // Check if sensor exists using raw SQL
    const sensorResult = await prisma.$queryRaw`
      SELECT sensor_id, owner_id FROM public.sensors WHERE sensor_id = ${sensor_id}
    `;

    if (!sensorResult || sensorResult.length === 0) {
      return NextResponse.json(
        { error: 'Sensor not found' },
        { status: 404 }
      );
    }

    const sensor = sensorResult[0];

    // Check for existing pending invitation
    const existingInvitation = await prisma.teamInvitation.findFirst({
      where: {
        sensorId: sensor_id,
        email: email,
        status: 'pending'
      }
    });

    if (existingInvitation) {
      return NextResponse.json(
        { invited: false, reason: 'already_pending' },
        { status: 409 }
      );
    }

    // Create invitation
    const token = Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2);
    const roleLabel = role === 'admin' ? 'Full access' : 'Access';
    const origin = request.headers.get('origin') || `${request.headers.get('x-forwarded-proto') || 'http'}://${request.headers.get('host')}`;
    const acceptLink = `${origin}/api/sendInvite?token=${token}`;

    const invitation = await prisma.teamInvitation.create({
      data: {
        token,
        email,
        role: roleLabel,
        status: 'pending',
        inviterId: sensor.owner_id, // Use sensor owner as inviter
        sensorId: sensor_id,
        inviteLink: acceptLink
      }
    });

    // Send email via internal route
    try {
      await fetch(`${origin}/api/sendInvite`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, role: roleLabel, token, sensorId: sensor_id })
      });
    } catch (error) {
      console.error('Failed to send invitation email:', error);
    }

    return NextResponse.json({ invited: true, token });
  } catch (error) {
    console.error('Create invitation error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// GET /api/shares?sensor_id=...
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const sensor_id = searchParams.get('sensor_id');

    if (!sensor_id) {
      return NextResponse.json(
        { error: 'sensor_id is required' },
        { status: 400 }
      );
    }

    // Load sensor and owner using raw SQL to avoid type conversion issues
    const sensorResult = await prisma.$queryRaw`
      SELECT s.sensor_id, s.sensor_name, s.owner_id, u.email as owner_email
      FROM public.sensors s
      LEFT JOIN auth.users u ON s.owner_id = u.id
      WHERE s.sensor_id = ${sensor_id}
    `;

    if (!sensorResult || sensorResult.length === 0) {
      return NextResponse.json(
        { error: 'Sensor not found' },
        { status: 404 }
      );
    }

    const sensor = sensorResult[0];

    // Load all invitations for this sensor (pending and accepted)
    const invitations = await prisma.$queryRaw`
      SELECT ti.email, ti.role, ti.status, ti.user_id, u.email as invitee_email
      FROM public.team_invitations ti
      LEFT JOIN auth.users u ON ti.user_id = u.id
      WHERE ti.sensor_id = ${sensor_id}
      AND ti.status IN ('pending', 'accepted')
    `;

    const result = [];
    
    // Add owner
    if (sensor.owner_id) {
      result.push({ 
        user_id: sensor.owner_id, 
        role: 'owner', 
        username: sensor.owner_email?.split('@')[0] || null,
        email: sensor.owner_email
      });
    }
    
    // Process invitations
    invitations.forEach(inv => {
      const mappedRole = /full/i.test(inv.role || '') || /admin/i.test(inv.role || '') ? 'admin' : 'viewer';
      const mappedStatus = inv.status === 'pending' ? 'invited' : 'accepted';
      
      // Avoid duplicating owner
      if (inv.user_id === sensor.owner_id) return;
      
      result.push({ 
        email: inv.email, 
        role: mappedRole, 
        status: mappedStatus, 
        user_id: inv.user_id || null,
        username: inv.invitee_email?.split('@')[0] || null
      });
    });

    return NextResponse.json({ 
      sensor_id, 
      sensor_name: sensor.sensor_name || null, 
      access: result 
    });
  } catch (error) {
    console.error('Get shares error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// DELETE /api/shares?sensor_id=...&user_id=... or &email=...
export async function DELETE(request) {
  try {
    const { searchParams } = new URL(request.url);
    const sensor_id = searchParams.get('sensor_id');
    const target_user_id = searchParams.get('user_id');
    const email = searchParams.get('email');

    if (!sensor_id || (!target_user_id && !email)) {
      return NextResponse.json(
        { error: 'sensor_id and (user_id or email) are required' },
        { status: 400 }
      );
    }

    const sensorResult = await prisma.$queryRaw`
      SELECT sensor_id, owner_id FROM public.sensors WHERE sensor_id = ${sensor_id}
    `;

    if (!sensorResult || sensorResult.length === 0) {
      return NextResponse.json(
        { error: 'Sensor not found' },
        { status: 404 }
      );
    }

    const sensor = sensorResult[0];

    if (email) {
      // Cancel invite (pending or accepted) by email
      await prisma.teamInvitation.deleteMany({
        where: {
          sensorId: sensor_id,
          email: email,
          status: { in: ['pending', 'accepted'] }
        }
      });
    } else {
      // Revoke accepted access by user_id
      if (String(target_user_id) === String(sensor.owner_id)) {
        return NextResponse.json(
          { error: 'Owner cannot be removed' },
          { status: 400 }
        );
      }
      
      await prisma.teamInvitation.deleteMany({
        where: {
          sensorId: sensor_id,
          userId: target_user_id,
          status: 'accepted'
        }
      });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Delete share error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}