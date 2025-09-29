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
      },
      include: {
        sensors: true
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

    // Update device
    const updatedDevice = await db.prisma.device.update({
      where: { deviceId },
      data: {
        deviceName: deviceName || device.deviceName
      },
      include: {
        sensors: true
      }
    });

    return new Response(JSON.stringify(updatedDevice), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('Update device error:', error);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
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

