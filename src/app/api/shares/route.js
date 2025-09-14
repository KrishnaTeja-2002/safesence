export const runtime = "nodejs";

import { authenticateRequest } from '../middleware/auth-postgres.js';

// POST /api/shares -> create invitation for a user to a sensor (owner/admin)
// Body: { sensor_id: string, email: string, role: 'viewer'|'admin' }
export async function POST(request) {
  try {
    const authResult = await authenticateRequest(request);
    if (authResult.error) {
      return new Response(JSON.stringify({ error: authResult.error }), {
        status: authResult.status,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const { db, user } = authResult;
    const { sensor_id, email, role } = await request.json();

    if (!sensor_id || !role || !email) {
      return new Response(JSON.stringify({ error: 'sensor_id, role and email are required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Check if sensor exists and user has permission to invite
    const sensor = await db.getSensorById(sensor_id);
    if (!sensor) {
      return new Response(JSON.stringify({ error: 'Sensor not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Check if user can invite (owner or admin)
    const canWrite = await db.canUserWriteToSensor(user.id, sensor_id);
    if (!canWrite) {
      return new Response(JSON.stringify({ error: 'Only owners or admins can invite' }), {
        status: 403,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Check for existing pending invitation
    const existingInvitation = await db.prisma.teamInvitation.findFirst({
      where: {
        sensorId: sensor_id,
        email: email,
        status: 'pending'
      }
    });

    if (existingInvitation) {
      return new Response(JSON.stringify({ invited: false, reason: 'already_pending' }), {
        status: 409,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Create invitation
    const token = Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2);
    const roleLabel = role === 'admin' ? 'Full access' : 'Access';
    const origin = request.headers.get('origin') || `${request.headers.get('x-forwarded-proto') || 'http'}://${request.headers.get('host')}`;
    const acceptLink = `${origin}/api/sendInvite?token=${token}&sensor_id=${encodeURIComponent(sensor_id)}`;

    const invitation = await db.createTeamInvitation({
      token,
      email,
      role: roleLabel,
      status: 'pending',
      inviterId: user.id,
      sensorId: sensor_id,
      inviteLink: acceptLink
    });

    // Send email via internal route
    try {
      await fetch(`${origin}/api/sendInvite`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, role: roleLabel, token, sensor_id })
      });
    } catch (error) {
      console.error('Failed to send invitation email:', error);
    }

    return new Response(JSON.stringify({ invited: true, token }), {
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

// GET /api/shares?sensor_id=...
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
    const { searchParams } = new URL(request.url);
    const sensor_id = searchParams.get('sensor_id');

    if (!sensor_id) {
      return new Response(JSON.stringify({ error: 'sensor_id is required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Load sensor owner
    const { data: sensor, error: sensorErr } = await supabaseAdmin
      .from('sensors')
      .select('sensor_id, sensor_name, owner_id')
      .eq('sensor_id', sensor_id)
      .maybeSingle();
    if (sensorErr || !sensor) {
      return new Response(JSON.stringify({ error: sensorErr?.message || 'Sensor not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Ensure requester has at least viewer access
    let requesterHasAccess = sensor.owner_id === user.id;
    if (!requesterHasAccess) {
      // Check by user_id first
      const { data: inv } = await supabaseAdmin
        .from('team_invitations')
        .select('id, email')
        .eq('sensor_id', sensor_id)
        .eq('status', 'accepted')
        .eq('user_id', user.id)
        .maybeSingle();
      
      if (inv) {
        requesterHasAccess = true;
      } else {
        // Fallback: check by email (in case user_id wasn't set properly)
        const { data: invByEmail } = await supabaseAdmin
          .from('team_invitations')
          .select('id')
          .eq('sensor_id', sensor_id)
          .eq('status', 'accepted')
          .eq('email', user.email)
          .maybeSingle();
        requesterHasAccess = !!invByEmail;
      }
    }
    if (!requesterHasAccess) {
      return new Response(JSON.stringify({ error: 'Forbidden: no access to this sensor' }), {
        status: 403,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Load all invitations for this sensor (pending and accepted)
    const { data: invites, error: invitesErr } = await supabaseAdmin
      .from('team_invitations')
      .select('email, role, status, user_id')
      .eq('sensor_id', sensor_id)
      .in('status', ['pending','accepted']);
    if (invitesErr) {
      return new Response(JSON.stringify({ error: invitesErr.message }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Try to enrich with usernames from user_preferences
    const userIds = new Set([sensor.owner_id, ...(invites?.map(inv => inv.user_id).filter(Boolean) || [])]);
    let profilesMap = new Map();
    if (userIds.size > 0) {
      try {
        const { data: prefs } = await supabaseAdmin
          .from('user_preferences')
          .select('user_id, username')
          .in('user_id', Array.from(userIds));
        if (prefs) profilesMap = new Map(prefs.map(p => [p.user_id, p.username]));
      } catch {}
    }

    const result = [];
    if (sensor.owner_id) {
      result.push({ user_id: sensor.owner_id, role: 'owner', username: profilesMap.get(sensor.owner_id) || null });
    }
    
    // Process invitations
    (invites || []).forEach(inv => {
      const mappedRole = /full/i.test(inv.role || '') || /admin/i.test(inv.role || '') ? 'admin' : 'viewer';
      const mappedStatus = inv.status === 'pending' ? 'invited' : 'accepted';
      
      // Avoid duplicating owner
      if (inv.user_id === sensor.owner_id) return;
      
      result.push({ 
        email: inv.email, 
        role: mappedRole, 
        status: mappedStatus, 
        user_id: inv.user_id || null,
        username: inv.user_id ? profilesMap.get(inv.user_id) || null : null
      });
    });

    return new Response(JSON.stringify({ sensor_id, sensor_name: sensor.sensor_name || null, access: result }), {
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

// DELETE /api/shares?sensor_id=...&user_id=...
export async function DELETE(request) {
  try {
    const authResult = await authenticateRequest(request);
    if (authResult.error) {
      return new Response(JSON.stringify({ error: authResult.error }), {
        status: authResult.status,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const { supabaseAdmin, user } = authResult;
    const { searchParams } = new URL(request.url);
    const sensor_id = searchParams.get('sensor_id');
    const target_user_id = searchParams.get('user_id');
    const email = searchParams.get('email');

    if (!sensor_id || (!target_user_id && !email)) {
      return new Response(JSON.stringify({ error: 'sensor_id and (user_id or email) are required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const { data: sensor, error: metaErr } = await supabaseAdmin
      .from('sensors')
      .select('owner_id')
      .eq('sensor_id', sensor_id)
      .maybeSingle();
    if (metaErr || !sensor) {
      return new Response(JSON.stringify({ error: metaErr?.message || 'Sensor not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    // Determine requester role on this sensor
    let requesterRole = 'viewer';
    if (sensor.owner_id === user.id) {
      requesterRole = 'owner';
    } else {
      // Check for accepted invitation
      const { data: inv } = await supabaseAdmin
        .from('team_invitations')
        .select('role')
        .eq('sensor_id', sensor_id)
        .eq('status', 'accepted')
        .eq('user_id', user.id)
        .maybeSingle();
      
      if (inv?.role && (/full/i.test(inv.role) || /admin/i.test(inv.role))) {
        requesterRole = 'admin';
      }
    }

    // If email is provided, cancel invite (pending or accepted)
    if (email) {
      // Allow users to remove themselves, or owners/admins to remove others
      const isSelfEmail = user.email && user.email.toLowerCase() === email.toLowerCase();
      const canManageOthers = requesterRole === 'owner' || requesterRole === 'admin';
      
      if (!isSelfEmail && !canManageOthers) {
        return new Response(JSON.stringify({ error: 'Forbidden' }), { status: 403, headers: { 'Content-Type': 'application/json' } });
      }
      
      const { error } = await supabaseAdmin
        .from('team_invitations')
        .delete()
        .eq('sensor_id', sensor_id)
        .eq('email', email)
        .in('status', ['pending', 'accepted']);
      if (error) {
        return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { 'Content-Type': 'application/json' } });
      }
    } else {
      // Revoke accepted access or self-leave
      if (String(target_user_id) === String(sensor.owner_id)) {
        return new Response(JSON.stringify({ error: 'Owner cannot be removed' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
      }
      const isSelf = String(target_user_id) === String(user.id);
      const canManageOthers = requesterRole === 'owner' || requesterRole === 'admin';
      if (!isSelf && !canManageOthers) {
        return new Response(JSON.stringify({ error: 'Forbidden' }), { status: 403, headers: { 'Content-Type': 'application/json' } });
      }
      
      const { error } = await supabaseAdmin
        .from('team_invitations')
        .delete()
        .eq('sensor_id', sensor_id)
        .eq('user_id', target_user_id)
        .eq('status', 'accepted');
      if (error) {
        return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { 'Content-Type': 'application/json' } });
      }
    }

    return new Response(JSON.stringify({ success: true }), {
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



