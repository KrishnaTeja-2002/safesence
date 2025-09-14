export const runtime = "nodejs";

import { authenticateRequest } from '../middleware/auth-postgres.js';

// GET /api/sensors - Fetch all sensors with latest readings
export async function GET(request) {
  try {
    // TEMPORARY: Bypass authentication for testing
    const { PrismaClient } = await import('@prisma/client');
    const prisma = new PrismaClient();
    
    // Get sensors directly from database
    const sensors = await prisma.$queryRaw`
      SELECT sensor_id, sensor_name, metric, sensor_type, latest_temp, last_fetched_time
      FROM public.sensors 
      ORDER BY sensor_name
    `;

    await prisma.$disconnect();

    return new Response(JSON.stringify(sensors), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('Sensors API error:', error);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

// PUT /api/sensors - Update sensor thresholds
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
    const { sensor_id, min_limit, max_limit, warning_limit } = body;

    if (!sensor_id) {
      return new Response(JSON.stringify({ error: 'sensor_id is required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Check if sensor exists
    const sensor = await db.getSensorById(sensor_id);
    if (!sensor) {
      return new Response(JSON.stringify({ error: 'Sensor not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Check write permissions
    const canWrite = await db.canUserWriteToSensor(user.id, sensor_id);
    if (!canWrite) {
      return new Response(JSON.stringify({ error: 'Forbidden: insufficient permissions' }), {
        status: 403,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Update sensor thresholds
    const updateData = {};
    if (min_limit !== undefined) updateData.minLimit = min_limit;
    if (max_limit !== undefined) updateData.maxLimit = max_limit;
    if (warning_limit !== undefined) updateData.warningLimit = warning_limit;

    const updatedSensor = await db.updateSensorThresholds(sensor_id, updateData);

    return new Response(JSON.stringify(updatedSensor), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('Update sensor error:', error);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
