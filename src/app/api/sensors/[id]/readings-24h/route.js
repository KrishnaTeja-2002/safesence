export const runtime = "nodejs";

import { prisma, ensurePrismaConnected } from '../../../../../../lib/prismaClient.js';

// Optimized 24h readings with intelligent aggregation for <4s load
export async function GET(request, context) {
  try {
    const { id: sensorId } = await context.params;
    const { searchParams } = new URL(request.url);
    
    // Option to include/exclude replay data
    const includeReplay = searchParams.get('include_replay') === 'true';
    
    if (!sensorId) {
      return new Response(JSON.stringify({ error: 'Sensor ID is required' }), { 
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    await ensurePrismaConnected();

    const now = new Date();
    const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    // Strategy: Use time-series bucketing for fast aggregation
    // - Last 1 hour: 1-minute buckets (60 points)
    // - 1-6 hours ago: 5-minute buckets (~60 points)
    // - 6-24 hours ago: 15-minute buckets (~72 points)
    // Total: ~192 points max for smooth chart with fast load
    
    const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
    const sixHoursAgo = new Date(now.getTime() - 6 * 60 * 60 * 1000);

    try {
      // Build replay filter
      const replayFilter = includeReplay ? '' : 'AND COALESCE(replay, false) = false';

      // Three parallel queries for different time ranges
      const [recent, medium, older] = await Promise.all([
        // Last hour: 1-minute buckets
        prisma.$queryRawUnsafe(`
          SELECT 
            date_trunc('minute', time) as bucket,
            AVG(reading_value) as value,
            COUNT(*) as count
          FROM public.mqtt_consumer_test
          WHERE (sensor_id ILIKE $1 OR sensor_id ILIKE $2)
            AND time >= $3
            AND time <= $4
            ${replayFilter}
          GROUP BY bucket
          ORDER BY bucket DESC
        `, `${sensorId}/%`, `%/${sensorId}`, oneHourAgo, now),

        // 1-6 hours: 5-minute buckets
        prisma.$queryRawUnsafe(`
          SELECT 
            date_trunc('minute', time) - 
            (EXTRACT(minute FROM time)::int % 5) * interval '1 minute' as bucket,
            AVG(reading_value) as value,
            COUNT(*) as count
          FROM public.mqtt_consumer_test
          WHERE (sensor_id ILIKE $1 OR sensor_id ILIKE $2)
            AND time >= $3
            AND time < $4
            ${replayFilter}
          GROUP BY bucket
          ORDER BY bucket DESC
        `, `${sensorId}/%`, `%/${sensorId}`, sixHoursAgo, oneHourAgo),

        // 6-24 hours: 15-minute buckets
        prisma.$queryRawUnsafe(`
          SELECT 
            date_trunc('minute', time) - 
            (EXTRACT(minute FROM time)::int % 15) * interval '1 minute' as bucket,
            AVG(reading_value) as value,
            COUNT(*) as count
          FROM public.mqtt_consumer_test
          WHERE (sensor_id ILIKE $1 OR sensor_id ILIKE $2)
            AND time >= $3
            AND time < $4
            ${replayFilter}
          GROUP BY bucket
          ORDER BY bucket DESC
        `, `${sensorId}/%`, `%/${sensorId}`, twentyFourHoursAgo, sixHoursAgo)
      ]);

      // Combine and format
      const combined = [...recent, ...medium, ...older]
        .map(r => ({
          time: r.bucket ? new Date(r.bucket).toISOString() : null,
          value: r.value != null ? parseFloat(Number(r.value).toFixed(2)) : null,
          count: parseInt(r.count || 0, 10)
        }))
        .filter(r => r.time && r.value != null)
        .sort((a, b) => new Date(a.time) - new Date(b.time));

      return new Response(JSON.stringify({
        sensor_id: sensorId,
        start_time: twentyFourHoursAgo.toISOString(),
        end_time: now.toISOString(),
        data: combined,
        total_points: combined.length
      }), {
        status: 200,
        headers: { 
          'Content-Type': 'application/json',
          'Cache-Control': 'public, max-age=30, s-maxage=30' // 30s cache
        }
      });
      
    } catch (error) {
      console.error('Database query error:', error);
      return new Response(JSON.stringify({ 
        sensor_id: sensorId,
        data: [],
        error: 'Query failed'
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    }

  } catch (error) {
    console.error('24h readings API error:', error);
    return new Response(JSON.stringify({ error: 'Internal server error' }), { 
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

