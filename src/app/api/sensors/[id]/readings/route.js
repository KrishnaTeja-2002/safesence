export const runtime = "nodejs";

import { authenticateRequest } from '../../../middleware/auth-postgres.js';

// GET /api/sensors/[id]/readings - Fetch sensor readings/history
export async function GET(request, context) {
  try {
    const { id: sensorId } = await context.params;
    const { searchParams } = new URL(request.url);

    // Get query parameters
    const startTime = searchParams.get('start_time');
    const endTime = searchParams.get('end_time');
    const limitStr = searchParams.get('limit');
    const parsedLimit = limitStr != null ? parseInt(limitStr, 10) : undefined;
    const limit = Math.min(parsedLimit || 10, 50000); // Increased limit to 50,000 for better data coverage

    if (!sensorId) {
      return new Response(JSON.stringify({ error: 'Sensor ID is required' }), { 
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Query real data from raw_readings_v2 table
    const { PrismaClient } = await import('@prisma/client');
    const prisma = new PrismaClient();
    
    try {
      // Build common parts
      const orderBy = (startTime || endTime) ? 'ASC' : 'DESC';

      // We only use mqtt_consumer. Columns: time, sensor_id (composite), mqtt_topic, reading_value
      // Match rows where sensor_id starts with `${sensorId}/` OR ends with `/${sensorId}`
      let idx = 1;
      const whereParts = [`(sensor_id ILIKE $${idx++} OR sensor_id ILIKE $${idx++})`];
      const params = [`${sensorId}/%`, `%/${sensorId}`];
      if (startTime) { whereParts.push(`time >= $${idx++}`); params.push(new Date(startTime)); }
      if (endTime) { whereParts.push(`time <= $${idx++}`); params.push(new Date(endTime)); }

      const q = `
        SELECT 
          sensor_id,
          reading_value,
          time
        FROM mqtt_consumer
        WHERE ${whereParts.join(' AND ')}
        ORDER BY time ${orderBy}
        LIMIT $${idx}
      `;
      params.push(limit);

      const results = await prisma.$queryRawUnsafe(q, ...params);

      const processed = (results || []).map(r => ({
        sensor_id: r.sensor_id,
        reading_value: r.reading_value,
        fetched_at: r.time ? new Date(r.time).toISOString() : null
      }));

      return new Response(JSON.stringify(processed), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
      
    } catch (error) {
      console.error('Database query error:', error);
      // Return empty array instead of 500 to avoid UI error noise
      return new Response(JSON.stringify([]), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    } finally {
      await prisma.$disconnect();
    }

  } catch (error) {
    console.error('Sensor readings API error:', error);
    return new Response(JSON.stringify({ error: 'Internal server error' }), { 
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
