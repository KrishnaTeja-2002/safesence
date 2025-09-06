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

    const { supabaseAdmin, user } = authResult;
    const userId = user.id;
    const userEmail = (user.email || '').toLowerCase();

    const sensorFields = [
      'sensor_id','sensor_name','metric','sensor_type','min_limit','max_limit','warning_limit','latest_temp','last_fetched_time','status','owner_id'
    ];

    const { data: owned, error: ownedErr } = await supabaseAdmin
      .from('sensors')
      .select(sensorFields.join(','))
      .eq('owner_id', userId);
    if (ownedErr) {
      return new Response(JSON.stringify({ error: ownedErr.message }), { status: 500, headers: { 'Content-Type': 'application/json' } });
    }

    const { data: accessRows, error: accErr } = await supabaseAdmin
      .from('team_invitations')
      .select('sensor_id, role, email, user_id, status')
      .eq('status', 'accepted')
      .or(`user_id.eq.${userId},email.ilike.${userEmail}`);
    if (accErr) {
      return new Response(JSON.stringify({ error: accErr.message }), { status: 500, headers: { 'Content-Type': 'application/json' } });
    }

    const ownedIds = new Set((owned || []).map(s => s.sensor_id));
    const shareIds = (accessRows || [])
      .map(r => r.sensor_id)
      .filter(id => id && !ownedIds.has(id));

    let sharedSensors = [];
    if (shareIds.length > 0) {
      const { data: sharedFetch, error: sharedErr } = await supabaseAdmin
        .from('sensors')
        .select(sensorFields.join(','))
        .in('sensor_id', shareIds);
      if (sharedErr) {
        return new Response(JSON.stringify({ error: sharedErr.message }), { status: 500, headers: { 'Content-Type': 'application/json' } });
      }
      sharedSensors = sharedFetch || [];
    }

    const roleById = new Map((accessRows || []).map(r => [r.sensor_id, (/full/i.test(r.role||'')||/admin/i.test(r.role||''))?'admin':(/owner/i.test(r.role||'')?'owner':'viewer')]));
    const byId = new Map();
    (owned || []).forEach(s => byId.set(s.sensor_id, { ...s, access_role: 'owner' }));
    sharedSensors.forEach(s => { if (!byId.has(s.sensor_id)) byId.set(s.sensor_id, { ...s, access_role: roleById.get(s.sensor_id) || 'viewer' }); });

    const sensors = Array.from(byId.values()).map(({ owner_id, ...rest }) => rest);

    return new Response(JSON.stringify(sensors), {
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
    const { supabaseAdmin, user } = authResult;
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

    // Permission check: owner or admin on this sensor
    const { data: meta, error: metaErr } = await supabaseAdmin
      .from('sensors')
      .select('owner_id')
      .eq('sensor_id', sensor_id)
      .maybeSingle();
    if (metaErr || !meta) {
      return new Response(JSON.stringify({ error: metaErr?.message || 'Sensor not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    let canWrite = meta.owner_id === user.id;
    if (!canWrite) {
      const { data: acc, error: accErr } = await supabaseAdmin
        .from('sensor_access')
        .select('role')
        .eq('sensor_id', sensor_id)
        .eq('user_id', user.id)
        .maybeSingle();
      if (accErr) {
        return new Response(JSON.stringify({ error: accErr.message }), {
          status: 500,
          headers: { 'Content-Type': 'application/json' }
        });
      }
      canWrite = acc?.role === 'admin' || acc?.role === 'owner';
    }

    if (!canWrite) {
      return new Response(JSON.stringify({ error: 'Forbidden: insufficient permissions' }), {
        status: 403,
        headers: { 'Content-Type': 'application/json' }
      });
    }

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
