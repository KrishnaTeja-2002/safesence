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

    const { supabaseAdmin, user } = authResult;
    const { id: sensorId } = params;
    const { searchParams } = new URL(request.url);

    // Get query parameters
    const startTime = searchParams.get('start_time');
    const endTime = searchParams.get('end_time');
    const limit = searchParams.get('limit') ? parseInt(searchParams.get('limit')) : null;

    if (!sensorId) {
      return new Response(JSON.stringify({ error: 'Sensor ID is required' }), { 
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Permission check: ensure the user can view this sensor
    const { data: sensorMeta, error: metaErr } = await supabaseAdmin
      .from('sensors')
      .select('owner_id')
      .eq('sensor_id', sensorId)
      .maybeSingle();
    if (metaErr || !sensorMeta) {
      return new Response(JSON.stringify({ error: metaErr?.message || 'Sensor not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    let canRead = sensorMeta.owner_id === user.id;
    if (!canRead) {
      const userEmail = (user.email || '').toLowerCase();
      const { data: access, error: accErr } = await supabaseAdmin
        .from('team_invitations')
        .select('id')
        .eq('sensor_id', sensorId)
        .eq('status', 'accepted')
        .or(`user_id.eq.${user.id},email.ilike.${userEmail}`)
        .maybeSingle();
      if (accErr) {
        return new Response(JSON.stringify({ error: accErr.message }), { status: 500, headers: { 'Content-Type': 'application/json' } });
      }
      canRead = !!access; // accepted invite grants read
    }

    if (!canRead) {
      return new Response(JSON.stringify({ error: 'Forbidden: no access to this sensor' }), {
        status: 403,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Build the query
    let query = supabaseAdmin
      .from('raw_readings_v2')
      .select('reading_value, fetched_at, approx_time, timestamp')
      .eq('sensor_id', sensorId);

    // Add time filters if provided
    if (startTime) {
      query = query.gte('fetched_at', startTime);
    }
    if (endTime) {
      query = query.lte('fetched_at', endTime);
    }

    // Order by time - ascending for time ranges, descending for latest data
    if (startTime || endTime) {
      query = query.order('fetched_at', { ascending: true }); // Chronological order for time ranges
    } else {
      query = query.order('fetched_at', { ascending: false }); // Most recent first for latest data
    }
    
    // Apply limit - use provided limit or default to 10000 for chunked requests
    const finalLimit = limit || 10000; // Default limit for chunked requests
    query = query.limit(finalLimit);

    console.log(`API: Fetching readings for sensor ${sensorId}:`, {
      startTime,
      endTime,
      requestedLimit: limit,
      finalLimit,
      hasTimeRange: !!(startTime || endTime),
      orderDirection: (startTime || endTime) ? 'ascending' : 'descending'
    });

    const { data: readings, error } = await query;

    console.log(`API: Query result:`, {
      readingsCount: readings?.length || 0,
      latestReading: readings?.[readings.length - 1]?.fetched_at,
      error: error?.message
    });

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
