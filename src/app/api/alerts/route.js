import { authenticateRequest } from '../middleware/auth.js';

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

    const { supabaseAdmin } = authResult;

    // Fetch sensors with thresholds and latest readings
    const { data: sensors, error } = await supabaseAdmin
      .from('sensors')
      .select(`
        sensor_id,
        sensor_name,
        metric,
        sensor_type,
        min_limit,
        max_limit,
        warning_limit,
        latest_temp,
        last_fetched_time,
        status
      `);

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
    const { supabaseAdmin } = authResult;
    const body = await request.json();
    console.log('Request body:', body);

    const { sensor_id, min_limit, max_limit, warning_limit, sensor_name, metric, sensor_type, updated_at } = body;

    if (!sensor_id) {
      console.error('Missing sensor_id');
      return new Response(JSON.stringify({ error: 'sensor_id is required' }), { 
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Update sensor data (thresholds and settings)
    const updateData = {};
    if (min_limit !== undefined) updateData.min_limit = min_limit;
    if (max_limit !== undefined) updateData.max_limit = max_limit;
    if (warning_limit !== undefined) updateData.warning_limit = warning_limit;
    if (sensor_name !== undefined) updateData.sensor_name = sensor_name;
    if (metric !== undefined) updateData.metric = metric;
    if (sensor_type !== undefined) updateData.sensor_type = sensor_type;
    if (updated_at !== undefined) updateData.updated_at = updated_at;

    console.log('Updating sensor with data:', { sensor_id, updateData });

    const { data: sensor, error } = await supabaseAdmin
      .from('sensors')
      .update(updateData)
      .eq('sensor_id', sensor_id)
      .select(`
        sensor_id,
        sensor_name,
        metric,
        sensor_type,
        min_limit,
        max_limit,
        warning_limit,
        latest_temp,
        last_fetched_time,
        status,
        updated_at
      `)
      .single();

    if (error) {
      console.error('Database update error:', error);
      return new Response(JSON.stringify({ error: error.message }), { 
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    console.log('Update successful:', sensor);
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
