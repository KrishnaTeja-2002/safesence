export const runtime = "nodejs";

import { authenticateRequest } from '../middleware/auth-postgres.js';

// GET /api/sensors - Fetch all sensors with latest readings and user access roles
export async function GET(request) {
  try {
    const { PrismaClient } = await import('@prisma/client');
    const prisma = new PrismaClient();
    
    // Get current user from token if available
    let currentUserId = null;
    try {
      const authHeader = request.headers.get('authorization');
      const cookieHeader = request.headers.get('cookie');
      
      let token = null;
      if (authHeader && authHeader.startsWith('Bearer ')) {
        token = authHeader.substring(7);
      } else if (cookieHeader) {
        const cookies = cookieHeader.split(';').reduce((acc, cookie) => {
          const [key, value] = cookie.trim().split('=');
          acc[key] = value;
          return acc;
        }, {});
        token = cookies['auth-token'];
      }
      
      if (token) {
        // Try to verify token by checking if it exists in auth.users
        const userResult = await prisma.$queryRaw`
          SELECT id FROM auth.users 
          WHERE id = ${token}::uuid 
          AND deleted_at IS NULL 
          LIMIT 1
        `;
        
        if (userResult && userResult.length > 0) {
          currentUserId = userResult[0].id;
          console.log('User authenticated via token:', currentUserId);
        }
      }
    } catch (e) {
      console.log('Token verification failed, proceeding without role info:', e.message);
    }
    
    // Get sensors with access roles for the current user (device-based structure)
    let sensors;
    if (currentUserId) {
      // Get user's email for team invitation lookup
      const userResult = await prisma.$queryRaw`
        SELECT email FROM auth.users 
        WHERE id = ${currentUserId}::uuid 
        AND deleted_at IS NULL 
        LIMIT 1
      `;
      const userEmail = userResult && userResult.length > 0 ? userResult[0].email : null;

      sensors = await prisma.$queryRaw`
        WITH user_devices AS (
          SELECT device_id FROM public.devices 
          WHERE owner_id = ${currentUserId}::uuid
        ),
        owned_sensors AS (
          SELECT 
            s.sensor_id, 
            s.sensor_name, 
            s.metric, 
            s.sensor_type, 
            s.latest_temp, 
            s.last_fetched_time,
            s.min_limit,
            s.max_limit,
            s.warning_limit,
            s.status,
            s.email_alert,
            s.mobile_alert,
            s.device_id,
            d.device_name,
            'owner' as access_role
          FROM public.sensors s
          JOIN public.devices d ON s.device_id = d.device_id
          WHERE d.device_id IN (SELECT device_id FROM user_devices)
        ),
        shared_sensors AS (
          SELECT 
            s.sensor_id, 
            s.sensor_name, 
            s.metric, 
            s.sensor_type, 
            s.latest_temp, 
            s.last_fetched_time,
            s.min_limit,
            s.max_limit,
            s.warning_limit,
            s.status,
            s.email_alert,
            s.mobile_alert,
            s.device_id,
            d.device_name,
            CASE 
              WHEN ti.role ILIKE '%admin%' OR ti.role ILIKE '%full%' THEN 'admin'
              WHEN ti.role ILIKE '%owner%' THEN 'owner'
              ELSE 'viewer'
            END as access_role
          FROM public.sensors s
          JOIN public.devices d ON s.device_id = d.device_id
          JOIN public.team_invitations ti ON s.sensor_id = ti.sensor_id
          WHERE ti.status = 'accepted'
            AND (ti.user_id = ${currentUserId}::uuid OR ti.email = ${userEmail})
            AND d.device_id NOT IN (SELECT device_id FROM user_devices)
        )
        SELECT * FROM owned_sensors
        UNION ALL
        SELECT * FROM shared_sensors
        ORDER BY sensor_name
      `;
    } else {
      // Fallback: return sensors with device info but default to viewer
      sensors = await prisma.$queryRaw`
        SELECT 
          s.sensor_id, 
          s.sensor_name, 
          s.metric, 
          s.sensor_type, 
          s.latest_temp, 
          s.last_fetched_time,
          s.min_limit,
          s.max_limit,
          s.warning_limit,
          s.status,
          s.email_alert,
          s.mobile_alert,
          s.device_id,
          d.device_name,
          'viewer' as access_role
        FROM public.sensors s
        JOIN public.devices d ON s.device_id = d.device_id
        ORDER BY s.sensor_name
      `;
    }

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
    const { sensor_id, min_limit, max_limit, warning_limit, latest_temp } = body;

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

    // Update sensor data (thresholds and/or latest reading)
    const updateData = {};
    if (min_limit !== undefined) updateData.minLimit = min_limit;
    if (max_limit !== undefined) updateData.maxLimit = max_limit;
    if (warning_limit !== undefined) updateData.warningLimit = warning_limit;
    if (latest_temp !== undefined) updateData.latestTemp = latest_temp;

    // Use the new updateSensorData method which will trigger status updates
    const updatedSensor = await db.updateSensorData(sensor_id, updateData);

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
