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
      // Build the SQL query with proper time filtering
      let whereClause = 'WHERE sensor_id = $1';
      let params = [sensorId];
      let paramIndex = 2;
      
      if (startTime) {
        whereClause += ` AND fetched_at >= $${paramIndex}`;
        params.push(new Date(startTime));
        paramIndex++;
      }
      
      if (endTime) {
        whereClause += ` AND fetched_at <= $${paramIndex}`;
        params.push(new Date(endTime));
        paramIndex++;
      }
      
      const query = `
        SELECT 
          id,
          sensor_id,
          reading_value,
          fetched_at,
          approx_time,
          timestamp
        FROM raw_readings_v2 
        ${whereClause}
        ORDER BY fetched_at DESC
        LIMIT $${paramIndex}
      `;
      
      params.push(limit);
      
      
      const results = await prisma.$queryRawUnsafe(query, ...params);
      
      // Convert BigInt to string for JSON serialization
      const processedResults = results.map(record => ({
        id: record.id.toString(),
        sensor_id: record.sensor_id,
        reading_value: record.reading_value,
        fetched_at: record.fetched_at?.toISOString(),
        approx_time: record.approx_time?.toISOString(),
        timestamp: record.timestamp?.toString()
      }));
      
      
      return new Response(JSON.stringify(processedResults), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
      
    } catch (error) {
      console.error('Database query error:', error);
      return new Response(JSON.stringify({ error: 'Failed to fetch sensor readings' }), {
        status: 500,
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
