export const runtime = "nodejs";

import { authenticateRequest } from '../middleware/auth-postgres.js';

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

    const { db, user } = authResult;
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

    // Get alert preferences using database client
    const preferences = await db.getAlertPreferences(user.id, user.email, sensorId);

    if (!preferences) {
      console.error('No access to sensor or sensor not found:', sensorId);
      return new Response(JSON.stringify({ error: 'Sensor not found or no access' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    console.log('Final result being returned:', preferences);

    return new Response(JSON.stringify(preferences), {
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

    const { db, user } = authResult;
    const body = await request.json();
    const { sensor_id, email_alert, mobile_alert } = body;

    if (!sensor_id) {
      return new Response(JSON.stringify({ error: 'sensor_id is required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Update alert preferences using database client
    try {
      const updated = await db.updateAlertPreferences(user.id, user.email, sensor_id, {
        email_alert,
        mobile_alert
      });

      return new Response(JSON.stringify(updated), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    } catch (dbError) {
      console.error('Database error:', dbError);
      
      if (dbError.message === 'Sensor not found') {
        return new Response(JSON.stringify({ error: 'Sensor not found' }), {
          status: 404,
          headers: { 'Content-Type': 'application/json' }
        });
      }
      
      if (dbError.message === 'No access to this sensor') {
        return new Response(JSON.stringify({ error: 'No access to this sensor' }), {
          status: 403,
          headers: { 'Content-Type': 'application/json' }
        });
      }
      
      throw dbError;
    }

  } catch (error) {
    console.error('Error updating alert preferences:', error);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}