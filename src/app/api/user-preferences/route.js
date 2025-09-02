import { authenticateRequest } from '../middleware/auth-simple.js';

// GET /api/user-preferences - Fetch user preferences
export async function GET(request) {
  try {
    const authResult = await authenticateRequest(request);
    if (authResult.error) {
      return new Response(JSON.stringify({ error: authResult.error }), { 
        status: authResult.status,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const { user, supabase } = authResult;

    // Fetch user preferences
    const { data: preferences, error } = await supabase
      .from('user_preferences')
      .select('*')
      .eq('user_id', user.id)
      .single();

    if (error && error.code !== 'PGRST116') {
      return new Response(JSON.stringify({ error: error.message }), { 
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // If no preferences found, return default values
    if (!preferences) {
      const defaultPreferences = {
        user_id: user.id,
        temp_scale: 'F',
        show_temp: true,
        show_humidity: false,
        show_sensors: true,
        show_users: true,
        show_alerts: true,
        show_notifications: true,
        time_zone: 'America/Anchorage',
        dark_mode: false,
        username: user.email ? user.email.split('@')[0] : null
      };

      // Create default preferences
      const { data: newPreferences, error: insertError } = await supabase
        .from('user_preferences')
        .insert(defaultPreferences)
        .select()
        .single();

      if (insertError) {
        return new Response(JSON.stringify({ error: insertError.message }), { 
          status: 500,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      return new Response(JSON.stringify(newPreferences), { 
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    return new Response(JSON.stringify(preferences), { 
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

// PUT /api/user-preferences - Update user preferences
export async function PUT(request) {
  try {
    const authResult = await authenticateRequest(request);
    if (authResult.error) {
      return new Response(JSON.stringify({ error: authResult.error }), { 
        status: authResult.status,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const { user, supabase } = authResult;
    const body = await request.json();

    // Validate required fields
    const {
      temp_scale,
      show_temp,
      show_humidity,
      show_sensors,
      show_users,
      show_alerts,
      show_notifications,
      time_zone,
      dark_mode,
      username
    } = body;

    const updateData = {
      user_id: user.id,
      temp_scale: temp_scale || 'F',
      show_temp: show_temp !== undefined ? show_temp : true,
      show_humidity: show_humidity !== undefined ? show_humidity : false,
      show_sensors: show_sensors !== undefined ? show_sensors : true,
      show_users: show_users !== undefined ? show_users : true,
      show_alerts: show_alerts !== undefined ? show_alerts : true,
      show_notifications: show_notifications !== undefined ? show_notifications : true,
      time_zone: time_zone || 'America/Anchorage',
      dark_mode: dark_mode !== undefined ? dark_mode : false,
      username: username ? username.trim() : null
    };

    // Upsert user preferences
    const { data: preferences, error } = await supabase
      .from('user_preferences')
      .upsert(updateData, { onConflict: 'user_id' })
      .select()
      .single();

    if (error) {
      return new Response(JSON.stringify({ error: error.message }), { 
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    return new Response(JSON.stringify(preferences), { 
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
