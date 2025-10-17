export const runtime = "nodejs";

import { authenticateRequest } from '../middleware/auth-postgres.js';

// GET /api/devices - Fetch all devices owned by the user
export async function GET(request) {
  try {
    const authResult = await authenticateRequest(request);
    if (authResult.error) {
      return new Response(JSON.stringify({ error: authResult.error }), {
        status: authResult.status,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const { db, user } = authResult;
    
    // Get devices owned by the user
    const devices = await db.getDevicesForUser(user.id);
    
    return new Response(JSON.stringify(devices), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('Devices API error:', error);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

// POST /api/devices - Create a new device
export async function POST(request) {
  try {
    const authResult = await authenticateRequest(request);
    if (authResult.error) {
      return new Response(JSON.stringify({ error: authResult.error }), {
        status: authResult.status,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const { db, user } = authResult;
    const body = await request.json();
    const { deviceId, deviceName } = body;

    if (!deviceId) {
      return new Response(JSON.stringify({ error: 'deviceId is required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Create the device
    const device = await db.prisma.device.create({
      data: {
        deviceId,
        deviceName: deviceName || '',
        ownerId: user.id
      }
    });

    return new Response(JSON.stringify(device), {
      status: 201,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('Create device error:', error);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

// PUT /api/devices - Update device information
export async function PUT(request) {
  try {
    console.log('PUT /api/devices - Starting device update...');
    
    const authResult = await authenticateRequest(request);
    if (authResult.error) {
      console.error('Authentication failed:', authResult.error);
      return new Response(JSON.stringify({ error: authResult.error }), {
        status: authResult.status,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const { db, user } = authResult;
    const body = await request.json();
    const { deviceId, deviceName } = body;

    console.log('Update request body:', { deviceId, deviceName, userId: user.id });

    if (!deviceId) {
      console.error('Missing deviceId in request');
      return new Response(JSON.stringify({ error: 'deviceId is required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    if (!deviceName || deviceName.trim() === '') {
      console.error('Missing or empty deviceName in request');
      return new Response(JSON.stringify({ error: 'deviceName is required and cannot be empty' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Check if device exists
    console.log('Looking up device:', deviceId);
    let device;
    try {
      device = await db.getDeviceById(deviceId);
    } catch (dbError) {
      console.error('Database error getting device:', dbError);
      return new Response(JSON.stringify({ 
        error: 'Database error', 
        details: dbError.message 
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    if (!device) {
      console.error('Device not found:', deviceId);
      return new Response(JSON.stringify({ error: 'Device not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    console.log('Device found:', { deviceId: device.deviceId, ownerId: device.ownerId, requestedBy: user.id });

    // If device has no owner, assign current user as owner
    if (!device.ownerId) {
      console.log('Device has no owner, assigning to current user:', user.id);
      try {
        await db.prisma.device.update({
          where: { deviceId },
          data: { ownerId: user.id }
        });
        device.ownerId = user.id;
      } catch (ownerError) {
        console.error('Error assigning owner:', ownerError);
        // Continue anyway - we'll allow the update
      }
    }

    // Check if user owns the device
    if (device.ownerId && device.ownerId !== user.id) {
      console.error('Permission denied:', { deviceOwner: device.ownerId, requestedBy: user.id });
      return new Response(JSON.stringify({ error: 'Forbidden: insufficient permissions' }), {
        status: 403,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Update device
    const trimmedDeviceName = deviceName.trim();
    console.log('Updating device with name:', trimmedDeviceName);
    
    let updatedDevice;
    try {
      updatedDevice = await db.prisma.device.update({
        where: { deviceId },
        data: {
          deviceName: trimmedDeviceName
        }
      });
    } catch (updateError) {
      console.error('Database error updating device:', updateError);
      return new Response(JSON.stringify({ 
        error: 'Failed to update device', 
        details: updateError.message 
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    console.log('Device updated successfully:', updatedDevice);
    return new Response(JSON.stringify(updatedDevice), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('Update device error:', error);
    return new Response(JSON.stringify({ 
      error: 'Internal server error', 
      details: error.message 
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

// DELETE /api/devices - Delete a device
export async function DELETE(request) {
  try {
    const authResult = await authenticateRequest(request);
    if (authResult.error) {
      return new Response(JSON.stringify({ error: authResult.error }), {
        status: authResult.status,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const { db, user } = authResult;
    const { searchParams } = new URL(request.url);
    const deviceId = searchParams.get('deviceId');

    if (!deviceId) {
      return new Response(JSON.stringify({ error: 'deviceId is required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Check if device exists and user owns it
    const device = await db.getDeviceById(deviceId);
    if (!device) {
      return new Response(JSON.stringify({ error: 'Device not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    if (device.ownerId !== user.id) {
      return new Response(JSON.stringify({ error: 'Forbidden: insufficient permissions' }), {
        status: 403,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Delete device (this will cascade delete sensors due to foreign key constraints)
    await db.prisma.device.delete({
      where: { deviceId }
    });

    return new Response(JSON.stringify({ message: 'Device deleted successfully' }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('Delete device error:', error);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

