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
    
    // Get sensors with access roles for the current user
    let sensors;
    if (currentUserId) {
      sensors = await prisma.$queryRaw`
        SELECT 
          s.sensor_id, 
          s.sensor_name, 
          s.metric, 
          s.sensor_type, 
          s.latest_temp, 
          s.last_fetched_time,
          s.owner_id,
          CASE 
            WHEN s.owner_id = ${currentUserId}::uuid THEN 'owner'
            WHEN ti.role IS NOT NULL AND ti.status = 'accepted' THEN 
              CASE 
                WHEN ti.role ILIKE '%admin%' OR ti.role ILIKE '%full%' THEN 'admin'
                ELSE 'viewer'
              END
            ELSE 'viewer'
          END as access_role
        FROM public.sensors s
        LEFT JOIN public.team_invitations ti ON s.sensor_id = ti.sensor_id 
          AND ti.user_id = ${currentUserId}::uuid
          AND ti.status = 'accepted'
        ORDER BY s.sensor_name
      `;
    } else {
      // Fallback: return sensors with owner info but default to viewer
      sensors = await prisma.$queryRaw`
        SELECT 
          s.sensor_id, 
          s.sensor_name, 
          s.metric, 
          s.sensor_type, 
          s.latest_temp, 
          s.last_fetched_time,
          s.owner_id,
          'viewer' as access_role
        FROM public.sensors s
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
