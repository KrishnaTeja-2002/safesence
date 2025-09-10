import { authenticateRequest } from '../middleware/auth.js';

// GET /api/alert-preferences - Get alert preferences for a sensor
export async function GET(request) {
  try {
    console.log('GET /api/alert-preferences - Request received');
    
    const authResult = await authenticateRequest(request);
    if (authResult.error) {
      console.error('Authentication failed:', authResult.error);
      return new Response(JSON.stringify({ error: authResult.error }), {
        status: authResult.status,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const { supabaseAdmin, user } = authResult;
    const { searchParams } = new URL(request.url);
    const sensorId = searchParams.get('sensor_id');

    console.log('Request params - sensorId:', sensorId, 'userId:', user.id);

    if (!sensorId) {
      console.error('Missing sensor_id parameter');
      return new Response(JSON.stringify({ error: 'sensor_id is required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Check if user has access to this sensor (either as owner or through team_invitations)
    const { data: sensor, error: sensorError } = await supabaseAdmin
      .from('sensors')
      .select('owner_id')
      .eq('sensor_id', sensorId)
      .maybeSingle();

    console.log('Sensor query result:', { sensor, sensorError });

    if (sensorError) {
      console.error('Sensor query error:', sensorError);
      return new Response(JSON.stringify({ error: sensorError.message }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    if (!sensor) {
      console.error('Sensor not found for sensorId:', sensorId);
      return new Response(JSON.stringify({ error: 'Sensor not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Check if user is owner or has team invitation
    const isOwner = sensor.owner_id === user.id;
    console.log('User ownership check:', { isOwner, sensorOwnerId: sensor.owner_id, userId: user.id });
    let preferences = null;

    if (isOwner) {
      // For owners, get preferences from sensors table
      console.log('Fetching owner preferences from sensors table');
      const { data: ownerPreferences, error: ownerError } = await supabaseAdmin
        .from('sensors')
        .select('email_alert, mobile_alert')
        .eq('sensor_id', sensorId)
        .maybeSingle();

      console.log('Owner preferences query result:', { ownerPreferences, ownerError });

      if (ownerError) {
        console.error('Owner preferences query error:', ownerError);
        return new Response(JSON.stringify({ error: ownerError.message }), {
          status: 500,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      // Format for consistency with team_invitations response
      preferences = ownerPreferences ? {
        email_alert: ownerPreferences.email_alert,
        mobile_alert: ownerPreferences.mobile_alert,
        role: 'owner',
        email: user.email,
        user_id: user.id
      } : null;
      
      console.log('Formatted owner preferences:', preferences);
    } else {
      // For team members, get their invitation preferences
      console.log('Fetching team member preferences from team_invitations table');
      console.log('Looking for user_id:', user.id, 'or email:', user.email);
      const { data: teamPreferences, error: teamError } = await supabaseAdmin
        .from('team_invitations')
        .select('email_alert, mobile_alert, role, email, user_id')
        .eq('sensor_id', sensorId)
        .eq('status', 'accepted')
        .or(`user_id.eq.${user.id},email.ilike.${user.email}`)
        .maybeSingle();

      console.log('Team preferences query result:', { teamPreferences, teamError });

      if (teamError) {
        console.error('Team preferences query error:', teamError);
        return new Response(JSON.stringify({ error: teamError.message }), {
          status: 500,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      if (!teamPreferences) {
        console.error('No team invitation found for user:', user.id, 'sensor:', sensorId);
        
        // Debug: Check what team invitations exist for this sensor
        const { data: allInvitations, error: debugError } = await supabaseAdmin
          .from('team_invitations')
          .select('user_id, email, status, role')
          .eq('sensor_id', sensorId);
        
        console.log('Debug - All invitations for this sensor:', allInvitations);
        console.log('Debug - Looking for user_id:', user.id);
        
        return new Response(JSON.stringify({ error: 'No access to this sensor' }), {
          status: 403,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      preferences = teamPreferences;
      console.log('Team member preferences found:', preferences);
    }

    // Return default values if no preferences found (for owners who haven't set preferences yet)
    const result = preferences || {
      email_alert: true,
      mobile_alert: true,
      role: isOwner ? 'owner' : null,
      email: user.email,
      user_id: user.id
    };

    console.log('Final result being returned:', result);

    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Error fetching alert preferences:', error);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

// PUT /api/alert-preferences - Update alert preferences for a sensor
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
    const { sensor_id, email_alert, mobile_alert } = body;

    if (!sensor_id) {
      return new Response(JSON.stringify({ error: 'sensor_id is required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Check if user has access to this sensor (either as owner or through team_invitations)
    const { data: sensor, error: sensorError } = await supabaseAdmin
      .from('sensors')
      .select('owner_id')
      .eq('sensor_id', sensor_id)
      .maybeSingle();

    if (sensorError) {
      return new Response(JSON.stringify({ error: sensorError.message }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    if (!sensor) {
      return new Response(JSON.stringify({ error: 'Sensor not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Check if user is owner or has team invitation
    const isOwner = sensor.owner_id === user.id;
    let invitation = null;

    if (!isOwner) {
      const { data: teamInvitation, error: checkError } = await supabaseAdmin
        .from('team_invitations')
        .select('id, role, status')
        .eq('sensor_id', sensor_id)
        .eq('status', 'accepted')
        .or(`user_id.eq.${user.id},email.ilike.${user.email}`)
        .maybeSingle();

      if (checkError) {
        return new Response(JSON.stringify({ error: checkError.message }), {
          status: 500,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      if (!teamInvitation) {
        return new Response(JSON.stringify({ error: 'No access to this sensor' }), {
          status: 403,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      invitation = teamInvitation;
    }

    // Update alert preferences
    const updateData = {};
    if (email_alert !== undefined) updateData.email_alert = email_alert;
    if (mobile_alert !== undefined) updateData.mobile_alert = mobile_alert;

    let updated;

    if (isOwner) {
      // For owners, update preferences in sensors table
      const { data: updatedSensor, error: updateError } = await supabaseAdmin
        .from('sensors')
        .update(updateData)
        .eq('sensor_id', sensor_id)
        .select('email_alert, mobile_alert')
        .single();

      if (updateError) {
        return new Response(JSON.stringify({ error: updateError.message }), {
          status: 500,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      // Format for consistency with team_invitations response
      updated = {
        email_alert: updatedSensor.email_alert,
        mobile_alert: updatedSensor.mobile_alert,
        role: 'owner',
        email: user.email,
        user_id: user.id
      };
    } else {
      // For team members, update their existing invitation record
      const { data: updatedInvitation, error: updateError } = await supabaseAdmin
        .from('team_invitations')
        .update(updateData)
        .eq('id', invitation.id)
        .select('email_alert, mobile_alert, role, email, user_id')
        .single();

      if (updateError) {
        return new Response(JSON.stringify({ error: updateError.message }), {
          status: 500,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      updated = updatedInvitation;
    }

    return new Response(JSON.stringify(updated), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Error updating alert preferences:', error);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
