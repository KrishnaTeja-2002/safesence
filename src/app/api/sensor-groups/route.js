export const runtime = "nodejs";

import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { authenticateRequest } from '../middleware/auth-postgres.js';

const prisma = new PrismaClient();

// GET /api/sensor-groups - Get all sensor groups for the current user
export async function GET(request) {
  try {
    const authResult = await authenticateRequest(request);
    if (authResult.error) {
      return NextResponse.json(
        { error: authResult.error },
        { status: authResult.status || 401 }
      );
    }
    const user = authResult.user;

    try {
      const groups = await prisma.sensorGroup.findMany({
        where: {
          ownerId: user.id
        },
        include: {
          members: {
            include: {
              sensor: {
                select: {
                  sensorId: true,
                  sensorName: true
                }
              }
            }
          }
        },
        orderBy: {
          created_at: 'desc'
        }
      });

      const formattedGroups = groups.map(group => ({
        id: group.id,
        name: group.name,
        ownerId: group.ownerId,
        created_at: group.created_at,
        updated_at: group.updated_at,
        sensors: group.members.map(m => ({
          sensorId: m.sensor.sensorId,
          sensorName: m.sensor.sensorName
        }))
      }));

      return NextResponse.json({ groups: formattedGroups });
    } catch (dbError) {
      // If table doesn't exist yet, return empty array
      if (dbError.message && (
        dbError.message.includes('does not exist') || 
        dbError.message.includes('relation') ||
        dbError.message.includes('Table') ||
        dbError.message.includes('model')
      )) {
        console.warn('Sensor groups table does not exist yet. Run database migration.');
        return NextResponse.json({ groups: [] });
      }
      throw dbError;
    }
  } catch (error) {
    console.error('Get sensor groups error:', error);
    // Return empty array instead of error to prevent UI crashes
    return NextResponse.json({ groups: [] });
  }
}

// POST /api/sensor-groups - Create a new sensor group
export async function POST(request) {
  try {
    const authResult = await authenticateRequest(request);
    if (authResult.error) {
      return NextResponse.json(
        { error: authResult.error },
        { status: authResult.status || 401 }
      );
    }
    const user = authResult.user;

    const { name, sensorIds } = await request.json();

    if (!name || !name.trim()) {
      return NextResponse.json(
        { error: 'Group name is required' },
        { status: 400 }
      );
    }

    // Verify user owns all sensors
    if (sensorIds && sensorIds.length > 0) {
      const sensors = await prisma.$queryRaw`
        SELECT s.sensor_id
        FROM public.sensors s
        JOIN public.devices d ON s.device_id = d.device_id
        WHERE s.sensor_id = ANY(${sensorIds}::text[])
        AND d.owner_id = ${user.id}::uuid
      `;

      if (sensors.length !== sensorIds.length) {
        return NextResponse.json(
          { error: 'You do not own all the specified sensors' },
          { status: 403 }
        );
      }
    }

    // Create group with members
    const group = await prisma.sensorGroup.create({
      data: {
        name: name.trim(),
        ownerId: user.id,
        members: sensorIds && sensorIds.length > 0 ? {
          create: sensorIds.map(sensorId => ({
            sensorId: sensorId
          }))
        } : undefined
      },
      include: {
        members: {
          include: {
            sensor: {
              select: {
                sensorId: true,
                sensorName: true
              }
            }
          }
        }
      }
    });

    const formattedGroup = {
      id: group.id,
      name: group.name,
      ownerId: group.ownerId,
      created_at: group.created_at,
      updated_at: group.updated_at,
      sensors: group.members.map(m => ({
        sensorId: m.sensor.sensorId,
        sensorName: m.sensor.sensorName
      }))
    };

    return NextResponse.json({ group: formattedGroup });
  } catch (error) {
    console.error('Create sensor group error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// PUT /api/sensor-groups - Update a sensor group
export async function PUT(request) {
  try {
    const authResult = await authenticateRequest(request);
    if (authResult.error) {
      return NextResponse.json(
        { error: authResult.error },
        { status: authResult.status || 401 }
      );
    }
    const user = authResult.user;

    const { id, name, sensorIds } = await request.json();

    if (!id) {
      return NextResponse.json(
        { error: 'Group ID is required' },
        { status: 400 }
      );
    }

    // Verify user owns the group
    const existingGroup = await prisma.sensorGroup.findFirst({
      where: {
        id: id,
        ownerId: user.id
      }
    });

    if (!existingGroup) {
      return NextResponse.json(
        { error: 'Group not found or you do not have permission' },
        { status: 404 }
      );
    }

    // Verify user owns all sensors if provided
    if (sensorIds && sensorIds.length > 0) {
      const sensors = await prisma.$queryRaw`
        SELECT s.sensor_id
        FROM public.sensors s
        JOIN public.devices d ON s.device_id = d.device_id
        WHERE s.sensor_id = ANY(${sensorIds}::text[])
        AND d.owner_id = ${user.id}::uuid
      `;

      if (sensors.length !== sensorIds.length) {
        return NextResponse.json(
          { error: 'You do not own all the specified sensors' },
          { status: 403 }
        );
      }
    }

    // Update group (updated_at is auto-updated by Prisma @updatedAt)
    const updateData = {};
    
    if (name && name.trim()) {
      updateData.name = name.trim();
    }

    // Update members if sensorIds provided
    if (sensorIds !== undefined) {
      // Delete existing members
      await prisma.sensorGroupMember.deleteMany({
        where: {
          groupId: id
        }
      });

      // Create new members
      if (sensorIds.length > 0) {
        await prisma.sensorGroupMember.createMany({
          data: sensorIds.map(sensorId => ({
            groupId: id,
            sensorId: sensorId
          })),
          skipDuplicates: true
        });
      }
    }

    const group = await prisma.sensorGroup.update({
      where: { id: id },
      data: updateData,
      include: {
        members: {
          include: {
            sensor: {
              select: {
                sensorId: true,
                sensorName: true
              }
            }
          }
        }
      }
    });

    const formattedGroup = {
      id: group.id,
      name: group.name,
      ownerId: group.ownerId,
      created_at: group.created_at,
      updated_at: group.updated_at,
      sensors: group.members.map(m => ({
        sensorId: m.sensor.sensorId,
        sensorName: m.sensor.sensorName
      }))
    };

    return NextResponse.json({ group: formattedGroup });
  } catch (error) {
    console.error('Update sensor group error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// DELETE /api/sensor-groups?id=... - Delete a sensor group
export async function DELETE(request) {
  try {
    const authResult = await authenticateRequest(request);
    if (authResult.error) {
      return NextResponse.json(
        { error: authResult.error },
        { status: authResult.status || 401 }
      );
    }
    const user = authResult.user;

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json(
        { error: 'Group ID is required' },
        { status: 400 }
      );
    }

    // Verify user owns the group
    const existingGroup = await prisma.sensorGroup.findFirst({
      where: {
        id: id,
        ownerId: user.id
      }
    });

    if (!existingGroup) {
      return NextResponse.json(
        { error: 'Group not found or you do not have permission' },
        { status: 404 }
      );
    }

    // Delete group (members will be cascade deleted)
    await prisma.sensorGroup.delete({
      where: { id: id }
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Delete sensor group error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

