import { authenticateRequest } from '../middleware/auth.js';

// GET /api/sensors - Fetch all sensors with latest readings
export async function GET(request) {
  try {
    const authResult = await authenticateRequest(request);
    if (authResult.error) {
      return new Response(JSON.stringify({ error: authResult.error }), { 
        status: authResult.status,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const { supabaseAdmin } = authResult;

    // Fetch sensors with all needed data
    const { data: sensors, error } = await supabaseAdmin
      .from('sensors')
      .select(`
        sensor_id,
        sensor_name,
        metric,
        sensor_type,
        latest_temp,
        approx_time,
        last_fetched_time,
        updated_at,
        min_limit,
        max_limit,
        warning_limit,
        status
      `)
      .order('sensor_name');

    if (error) {
      return new Response(JSON.stringify({ error: error.message }), { 
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    return new Response(JSON.stringify(sensors || []), { 
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

    const { supabaseAdmin } = authResult;
    const body = await request.json();

    const { sensor_id, min_limit, max_limit, warning_limit } = body;

    if (!sensor_id) {
      return new Response(JSON.stringify({ error: 'sensor_id is required' }), { 
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Update sensor thresholds
    const updateData = {};
    if (min_limit !== undefined) updateData.min_limit = min_limit;
    if (max_limit !== undefined) updateData.max_limit = max_limit;
    if (warning_limit !== undefined) updateData.warning_limit = warning_limit;

    const { data: sensor, error } = await supabaseAdmin
      .from('sensors')
      .update(updateData)
      .eq('sensor_id', sensor_id)
      .select()
      .single();

    if (error) {
      return new Response(JSON.stringify({ error: error.message }), { 
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    return new Response(JSON.stringify(sensor), { 
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
