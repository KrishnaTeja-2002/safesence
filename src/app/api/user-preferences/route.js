export const runtime = "nodejs";

import { authenticateRequest } from '../middleware/auth-postgres.js';

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

    const { db, user } = authResult;

    // Fetch user preferences
    let preferences = await db.getUserPreferences(user.id);

    // If no preferences found, create default values
    if (!preferences) {
      const defaultPreferences = {
        tempScale: 'F',
        showTemp: true,
        showHumidity: false,
        showSensors: true,
        showUsers: true,
        showAlerts: true,
        showNotifications: true,
        timeZone: 'America/Anchorage',
        darkMode: false,
        username: user.email ? user.email.split('@')[0] : null
      };

      preferences = await db.upsertUserPreferences(user.id, defaultPreferences);
    }

    return new Response(JSON.stringify(preferences), { 
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('User preferences GET error:', error);
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

    const { db, user } = authResult;
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
      tempScale: temp_scale || 'F',
      showTemp: show_temp !== undefined ? show_temp : true,
      showHumidity: show_humidity !== undefined ? show_humidity : false,
      showSensors: show_sensors !== undefined ? show_sensors : true,
      showUsers: show_users !== undefined ? show_users : true,
      showAlerts: show_alerts !== undefined ? show_alerts : true,
      showNotifications: show_notifications !== undefined ? show_notifications : true,
      timeZone: time_zone || 'America/Anchorage',
      darkMode: dark_mode !== undefined ? dark_mode : false,
      username: username ? username.trim() : null
    };

    // Upsert user preferences
    const preferences = await db.upsertUserPreferences(user.id, updateData);

    return new Response(JSON.stringify(preferences), { 
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('User preferences PUT error:', error);
    try {
      console.error('Error details:', {
        message: error?.message,
        stack: error?.stack,
        meta: error?.meta
      });
    } catch {}
    const message = error?.message || 'Internal server error';
    return new Response(JSON.stringify({ error: message }), { 
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
