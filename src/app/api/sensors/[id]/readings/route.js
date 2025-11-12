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

    // Query real data from mqtt_consumer_test (with replay support)
    const { PrismaClient } = await import('@prisma/client');
    const prisma = new PrismaClient();
    
    // Check if we should include replay data (default: false for live data only)
    const includeReplay = searchParams.get('include_replay') === 'true';
    
    try {
      // Build common parts
      const orderBy = (startTime || endTime) ? 'ASC' : 'DESC';

      // Try mqtt_consumer_test first (has replay field and deduplication)
      // Match rows where sensor_id starts with `${sensorId}/` OR ends with `/${sensorId}`
      let idx = 1;
      const whereParts = [`(sensor_id ILIKE $${idx++} OR sensor_id ILIKE $${idx++})`];
      const params = [`${sensorId}/%`, `%/${sensorId}`];
      if (startTime) { whereParts.push(`time >= $${idx++}`); params.push(new Date(startTime)); }
      if (endTime) { whereParts.push(`time <= $${idx++}`); params.push(new Date(endTime)); }
      
      // Add replay filter unless explicitly requested
      if (!includeReplay) {
        whereParts.push('COALESCE(replay, false) = false');
      }

      const q = `
        SELECT 
          sensor_id,
          reading_value,
          time,
          COALESCE(replay, false) as is_replay
        FROM public.mqtt_consumer_test
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
