export const runtime = "nodejs";

import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { authenticateRequest } from '../middleware/auth-postgres.js';

// Use singleton pattern to avoid multiple PrismaClient instances
const globalForPrisma = globalThis;
const prisma = globalForPrisma.__safesensePrismaGroups || new PrismaClient({
  log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
});

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.__safesensePrismaGroups = prisma;
}

// Ensure Prisma client is connected
prisma.$connect().catch(() => {
  // Connection already exists or will be established on first query
});

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
      // Verify Prisma client has the sensorGroup model
      if (!prisma.sensorGroup || typeof prisma.sensorGroup.findMany !== 'function') {
        console.warn('Prisma client does not have sensorGroup model. Available models:', Object.keys(prisma).filter(k => !k.startsWith('$') && !k.startsWith('_')));
        return NextResponse.json({ groups: [] });
      }

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
        sensors: (group.members || []).map(m => ({
          sensorId: m.sensor?.sensorId || null,
          sensorName: m.sensor?.sensorName || null
        })).filter(s => s.sensorId !== null)
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

    let body;
    try {
      body = await request.json();
    } catch (parseError) {
      return NextResponse.json(
        { error: 'Invalid JSON in request body' },
        { status: 400 }
      );
    }
    const { name, sensorIds } = body;

    if (!name || !name.trim()) {
      return NextResponse.json(
        { error: 'Group name is required' },
        { status: 400 }
      );
    }

    // Verify user owns all sensors
    if (sensorIds && sensorIds.length > 0) {
      // Validate sensorIds is an array
      if (!Array.isArray(sensorIds)) {
        return NextResponse.json(
          { error: 'sensorIds must be an array' },
          { status: 400 }
        );
      }

      // Filter out any invalid sensor IDs
      const validSensorIds = sensorIds.filter(id => id && typeof id === 'string' && id.trim().length > 0);
      
      if (validSensorIds.length === 0) {
        return NextResponse.json(
          { error: 'No valid sensor IDs provided' },
          { status: 400 }
        );
      }

      if (validSensorIds.length !== sensorIds.length) {
        return NextResponse.json(
          { error: 'Some sensor IDs are invalid' },
          { status: 400 }
        );
      }

      try {
        const sensors = await prisma.$queryRaw`
          SELECT s.sensor_id
          FROM public.sensors s
          JOIN public.devices d ON s.device_id = d.device_id
          WHERE s.sensor_id = ANY(${validSensorIds}::text[])
          AND d.owner_id = ${user.id}::uuid
        `;

        if (sensors.length !== validSensorIds.length) {
          return NextResponse.json(
            { error: 'You do not own all the specified sensors' },
            { status: 403 }
          );
        }
      } catch (dbError) {
        console.error('Database error verifying sensor ownership:', dbError);
        return NextResponse.json(
          { error: 'Failed to verify sensor ownership. Please try again.' },
          { status: 500 }
        );
      }
    }

    // Create group with members
    let group;
    try {
      // Verify Prisma client has the sensorGroup model
      if (!prisma.sensorGroup || typeof prisma.sensorGroup.create !== 'function') {
        console.error('Prisma client does not have sensorGroup model. Available models:', Object.keys(prisma).filter(k => !k.startsWith('$') && !k.startsWith('_')));
        return NextResponse.json(
          { error: 'Database models not available. Please regenerate Prisma client and restart the server.' },
          { status: 500 }
        );
      }

      group = await prisma.sensorGroup.create({
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
    } catch (createError) {
      console.error('Error creating sensor group:', createError);
      console.error('Error details:', {
        message: createError.message,
        code: createError.code,
        meta: createError.meta,
        stack: createError.stack
      });
      
      // Check if it's a foreign key constraint error
      if (createError.code === 'P2003' || createError.message?.includes('foreign key') || createError.message?.includes('constraint')) {
        return NextResponse.json(
          { error: 'One or more sensors do not exist. Please refresh and try again.' },
          { status: 400 }
        );
      }
      
      // Check if table doesn't exist
      if (createError.message?.includes('does not exist') || createError.message?.includes('relation') || createError.message?.includes('Table')) {
        return NextResponse.json(
          { error: 'Sensor groups feature is not available. Please run database migrations.' },
          { status: 503 }
        );
      }
      
      throw createError;
    }

    const formattedGroup = {
      id: group.id,
      name: group.name,
      ownerId: group.ownerId,
      created_at: group.created_at,
      updated_at: group.updated_at,
      sensors: (group.members || []).map(m => ({
        sensorId: m.sensor?.sensorId || null,
        sensorName: m.sensor?.sensorName || null
      })).filter(s => s.sensorId !== null)
    };

    return NextResponse.json({ group: formattedGroup });
  } catch (error) {
    console.error('Create sensor group error:', error);
    console.error('Error details:', {
      message: error.message,
      stack: error.stack,
      name: error.name,
      code: error.code
    });
    
    // Handle database connection errors
    if (error.message && (
      error.message.includes('Can\'t reach database server') ||
      error.message.includes('database server') ||
      error.message.includes('ECONNREFUSED') ||
      error.message.includes('ETIMEDOUT') ||
      error.message.includes('P1001')
    )) {
      return NextResponse.json(
        { 
          error: 'Unable to connect to the database. Please try again later or contact support.',
          code: 'DATABASE_ERROR'
        },
        { status: 503 }
      );
    }
    
    // Handle Prisma validation errors
    if (error.code && error.code.startsWith('P')) {
      return NextResponse.json(
        { 
          error: 'Database operation failed. Please check your input and try again.',
          code: 'DATABASE_OPERATION_ERROR',
          details: process.env.NODE_ENV === 'development' ? error.message : undefined
        },
        { status: 400 }
      );
    }
    
    // Generic error with more details in development
    return NextResponse.json(
      { 
        error: process.env.NODE_ENV === 'development' 
          ? `Internal server error: ${error.message}` 
          : 'An error occurred while creating the group. Please try again later.',
        code: 'INTERNAL_ERROR',
        details: process.env.NODE_ENV === 'development' ? error.stack : undefined
      },
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

    let body;
    try {
      body = await request.json();
    } catch (parseError) {
      return NextResponse.json(
        { error: 'Invalid JSON in request body' },
        { status: 400 }
      );
    }
    const { id, name, sensorIds } = body;

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
      sensors: (group.members || []).map(m => ({
        sensorId: m.sensor?.sensorId || null,
        sensorName: m.sensor?.sensorName || null
      })).filter(s => s.sensorId !== null)
    };

    return NextResponse.json({ group: formattedGroup });
  } catch (error) {
    console.error('Update sensor group error:', error);
    console.error('Error details:', {
      message: error.message,
      stack: error.stack,
      name: error.name,
      code: error.code
    });
    
    // Handle database connection errors
    if (error.message && (
      error.message.includes('Can\'t reach database server') ||
      error.message.includes('database server') ||
      error.message.includes('ECONNREFUSED') ||
      error.message.includes('ETIMEDOUT') ||
      error.message.includes('P1001')
    )) {
      return NextResponse.json(
        { 
          error: 'Unable to connect to the database. Please try again later or contact support.',
          code: 'DATABASE_ERROR'
        },
        { status: 503 }
      );
    }
    
    // Handle Prisma validation errors
    if (error.code && error.code.startsWith('P')) {
      return NextResponse.json(
        { 
          error: 'Database operation failed. Please check your input and try again.',
          code: 'DATABASE_OPERATION_ERROR',
          details: process.env.NODE_ENV === 'development' ? error.message : undefined
        },
        { status: 400 }
      );
    }
    
    // Generic error
    return NextResponse.json(
      { 
        error: process.env.NODE_ENV === 'development' 
          ? `Internal server error: ${error.message}` 
          : 'An error occurred while updating the group. Please try again later.',
        code: 'INTERNAL_ERROR',
        details: process.env.NODE_ENV === 'development' ? error.stack : undefined
      },
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
    console.error('Error details:', {
      message: error.message,
      stack: error.stack,
      name: error.name,
      code: error.code
    });
    
    // Handle database connection errors
    if (error.message && (
      error.message.includes('Can\'t reach database server') ||
      error.message.includes('database server') ||
      error.message.includes('ECONNREFUSED') ||
      error.message.includes('ETIMEDOUT') ||
      error.message.includes('P1001')
    )) {
      return NextResponse.json(
        { 
          error: 'Unable to connect to the database. Please try again later or contact support.',
          code: 'DATABASE_ERROR'
        },
        { status: 503 }
      );
    }
    
    // Handle Prisma validation errors
    if (error.code && error.code.startsWith('P')) {
      return NextResponse.json(
        { 
          error: 'Database operation failed. Please check your input and try again.',
          code: 'DATABASE_OPERATION_ERROR',
          details: process.env.NODE_ENV === 'development' ? error.message : undefined
        },
        { status: 400 }
      );
    }
    
    // Generic error
    return NextResponse.json(
      { 
        error: process.env.NODE_ENV === 'development' 
          ? `Internal server error: ${error.message}` 
          : 'An error occurred while deleting the group. Please try again later.',
        code: 'INTERNAL_ERROR',
        details: process.env.NODE_ENV === 'development' ? error.stack : undefined
      },
      { status: 500 }
    );
  }
}

