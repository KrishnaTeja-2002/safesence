import { authenticateRequest } from '../../../middleware/auth.js';

// GET /api/sensors/[id]/readings - Fetch sensor readings/history
export async function GET(request, { params }) {
  try {
    const authResult = await authenticateRequest(request);
    if (authResult.error) {
      return new Response(JSON.stringify({ error: authResult.error }), { 
        status: authResult.status,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const { supabaseAdmin } = authResult;
    const { id: sensorId } = params;
    const { searchParams } = new URL(request.url);

    // Get query parameters
    const startTime = searchParams.get('start_time');
    const endTime = searchParams.get('end_time');
    const limit = parseInt(searchParams.get('limit')) || 20000;

    if (!sensorId) {
      return new Response(JSON.stringify({ error: 'Sensor ID is required' }), { 
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Build the query
    let query = supabaseAdmin
      .from('raw_readings_v2')
      .select('reading_value, fetched_at, approx_time, timestamp')
      .eq('sensor_id', sensorId)
      .order('fetched_at', { ascending: true })
      .limit(limit);

    // Add time filters if provided
    if (startTime) {
      query = query.gte('fetched_at', startTime);
    }
    if (endTime) {
      query = query.lte('fetched_at', endTime);
    }

    const { data: readings, error } = await query;

    if (error) {
      return new Response(JSON.stringify({ error: error.message }), { 
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    return new Response(JSON.stringify(readings || []), { 
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
