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

    const { supabaseAdmin, user } = authResult;
    const userId = user.id;
    const userEmail = (user.email || '').toLowerCase();

    const sensorFields = [
      'sensor_id', 'sensor_name', 'metric', 'sensor_type', 'latest_temp', 'approx_time',
      'last_fetched_time', 'updated_at', 'min_limit', 'max_limit', 'warning_limit', 'status', 'owner_id'
    ];

    // 1) Owned sensors
    const { data: owned, error: ownedErr } = await supabaseAdmin
      .from('sensors')
      .select(sensorFields.join(','))
      .eq('owner_id', userId);
    if (ownedErr) {
      return new Response(JSON.stringify({ error: ownedErr.message }), { status: 500, headers: { 'Content-Type': 'application/json' } });
    }

    // 2) Shared sensor ids via accepted invitations
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

    // Map roles to shared sensors
    const roleById = new Map((accessRows || []).map(r => [r.sensor_id, (/full/i.test(r.role||'')||/admin/i.test(r.role||''))?'admin':(/owner/i.test(r.role||'')?'owner':'viewer')]));

    const byId = new Map();
    (owned || []).forEach(s => byId.set(s.sensor_id, { ...s, access_role: 'owner' }));
    sharedSensors.forEach(s => {
      if (!byId.has(s.sensor_id)) byId.set(s.sensor_id, { ...s, access_role: roleById.get(s.sensor_id) || 'viewer' });
    });

    // Build final list, drop owner_id from response for cleanliness
    const sensors = Array.from(byId.values())
      .map(({ owner_id, ...rest }) => rest)
      .sort((a, b) => (a.sensor_name || '').localeCompare(b.sensor_name || ''));

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

    const { supabaseAdmin, user } = authResult;
    const body = await request.json();
    const { sensor_id, min_limit, max_limit, warning_limit } = body;

    if (!sensor_id) {
      return new Response(JSON.stringify({ error: 'sensor_id is required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Enforce write permissions (owner or admin)
    const { data: sensorRow, error: loadErr } = await supabaseAdmin
      .from('sensors')
      .select('sensor_id, owner_id')
      .eq('sensor_id', sensor_id)
      .maybeSingle();

    if (loadErr || !sensorRow) {
      return new Response(JSON.stringify({ error: loadErr?.message || 'Sensor not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    let canWrite = sensorRow.owner_id === user.id;
    if (!canWrite) {
      const { data: access, error: accErr } = await supabaseAdmin
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
      canWrite = access?.role === 'admin' || access?.role === 'owner';
    }

    if (!canWrite) {
      return new Response(JSON.stringify({ error: 'Forbidden: insufficient permissions' }), {
        status: 403,
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
