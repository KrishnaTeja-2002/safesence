export const runtime = "nodejs";

import { authenticateRequest } from '../middleware/auth-postgres.js';

// GET /api/alerts - Fetch alerts and sensor thresholds
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
    const userId = user.id;
    const userEmail = (user.email || '').toLowerCase();

    // Get sensors for user (owned + shared) - same as sensors endpoint
    const sensors = await db.getSensorsForUser(userId, userEmail);

    return new Response(JSON.stringify(sensors), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

// PUT /api/alerts - Update sensor thresholds/limits
export async function PUT(request) {
  try {
    console.log('PUT /api/alerts - Request received');
    
    const authResult = await authenticateRequest(request);
    if (authResult.error) {
      console.error('Authentication failed:', authResult.error);
      return new Response(JSON.stringify({ error: authResult.error }), { 
        status: authResult.status,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    console.log('Authentication successful');
    const { db, user } = authResult;
    let body;
    try {
      body = await request.json();
    } catch (parseError) {
      console.error('Failed to parse request body:', parseError);
      return new Response(JSON.stringify({ error: 'Invalid JSON in request body' }), { 
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    console.log('Request body:', body);
    console.log('Request headers:', Object.fromEntries(request.headers.entries()));

    const { sensor_id, device_id, min_limit, max_limit, warning_limit, sensor_name, metric, sensor_type } = body;
    console.log('Extracted parameters:', { sensor_id, device_id, min_limit, max_limit, warning_limit, sensor_name, metric, sensor_type });

    if (!sensor_id || !device_id) {
      console.error('Missing sensor_id');
      return new Response(JSON.stringify({ error: 'sensor_id and device_id are required' }), { 
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Check if sensor exists
    const sensor = await db.getSensorById(sensor_id, device_id);
    if (!sensor) {
      return new Response(JSON.stringify({ error: 'Sensor not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Check write permissions
    const userEmail = (user.email || '').toLowerCase();
    const canWrite = await db.canUserWriteToSensor(user.id, sensor_id, device_id, userEmail);
    if (!canWrite) {
      return new Response(JSON.stringify({ error: 'Forbidden: insufficient permissions' }), {
        status: 403,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Update sensor data (thresholds and settings)
    const updateData = {};
    if (min_limit !== undefined) updateData.minLimit = min_limit;
    if (max_limit !== undefined) updateData.maxLimit = max_limit;
    if (warning_limit !== undefined) updateData.warningLimit = warning_limit;
    if (sensor_name !== undefined) updateData.sensorName = sensor_name;
    if (metric !== undefined) updateData.metric = metric;
    
    // Validate and update sensor_type if provided - only allow 'temperature' or 'humidity'
    if (sensor_type !== undefined) {
      const normalizedType = (sensor_type || "").toLowerCase().trim();
      if (normalizedType === "humidity" || normalizedType === "temperature") {
        // Update via raw SQL to avoid Prisma enum/string mismatch errors
        try {
          await db.prisma.$executeRaw`
            UPDATE public.sensors 
            SET sensor_type = ${normalizedType}
            WHERE sensor_id = ${sensor_id}::text 
            AND device_id = ${device_id}::text
          `;
        } catch (typeError) {
          console.error('Error updating sensor_type:', typeError);
          // Don't fail the whole request if sensor_type update fails
        }
      } else if (normalizedType !== "") {
        console.warn(`Invalid sensor_type provided: ${sensor_type}. Only 'temperature' or 'humidity' are allowed.`);
      }
    }
    // Do not set updatedAt; column does not exist on sensors table in Prisma schema

    console.log('Updating sensor with data:', { sensor_id, updateData });

    const updatedSensor = await db.updateSensorThresholds(sensor_id, device_id, updateData);

    console.log('Update successful:', updatedSensor);
    return new Response(JSON.stringify(updatedSensor), { 
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    return new Response(JSON.stringify({ error: 'Internal server error' }), { 
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
