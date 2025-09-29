export const runtime = "nodejs";

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// POST /api/test-sensor-status - Test sensor status calculation
export async function POST(request) {
  try {
    const { sensorId, latestTemp, minLimit, maxLimit, warningLimit } = await request.json();

    if (!sensorId) {
      return new Response(JSON.stringify({ error: 'sensorId is required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Test the status calculation function
    const result = await prisma.$queryRaw`
      SELECT 
        calculate_sensor_status(
          ${latestTemp || null}::DECIMAL(10,2),
          ${minLimit || null}::DECIMAL(10,2),
          ${maxLimit || null}::DECIMAL(10,2),
          ${warningLimit || 10}::INTEGER
        ) as calculated_status,
        check_sensor_offline_status(
          ${latestTemp ? 'NOW()' : 'NOW() - INTERVAL \'35 minutes\''}::TIMESTAMP WITH TIME ZONE
        ) as time_status
    `;

    // Update the sensor with test data
    const updatedSensor = await prisma.sensor.update({
      where: { sensorId },
      data: {
        latestTemp: latestTemp || null,
        minLimit: minLimit || null,
        maxLimit: maxLimit || null,
        warningLimit: warningLimit || 10,
        lastFetchedTime: latestTemp ? new Date() : new Date(Date.now() - 35 * 60 * 1000) // 35 minutes ago if no temp
      }
    });

    return new Response(JSON.stringify({ 
      success: true,
      test_data: {
        sensorId,
        latestTemp,
        minLimit,
        maxLimit,
        warningLimit
      },
      calculated_status: result[0]?.calculated_status,
      time_status: result[0]?.time_status,
      final_status: updatedSensor.status,
      updated_sensor: {
        sensorId: updatedSensor.sensorId,
        sensorName: updatedSensor.sensorName,
        latestTemp: updatedSensor.latestTemp,
        minLimit: updatedSensor.minLimit,
        maxLimit: updatedSensor.maxLimit,
        warningLimit: updatedSensor.warningLimit,
        status: updatedSensor.status,
        lastFetchedTime: updatedSensor.lastFetchedTime
      }
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('Error testing sensor status:', error);
    return new Response(JSON.stringify({ 
      success: false, 
      error: error.message 
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

// GET /api/test-sensor-status - Get current sensor statuses
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const sensorId = searchParams.get('sensorId');

    let query;
    if (sensorId) {
      query = prisma.$queryRaw`
        SELECT 
          sensor_id,
          sensor_name,
          latest_temp,
          min_limit,
          max_limit,
          warning_limit,
          status,
          last_fetched_time,
          EXTRACT(EPOCH FROM (NOW() - last_fetched_time))/60 as minutes_since_last_data
        FROM public.sensors 
        WHERE sensor_id = ${sensorId}
      `;
    } else {
      query = prisma.$queryRaw`
        SELECT 
          sensor_id,
          sensor_name,
          latest_temp,
          min_limit,
          max_limit,
          warning_limit,
          status,
          last_fetched_time,
          EXTRACT(EPOCH FROM (NOW() - last_fetched_time))/60 as minutes_since_last_data
        FROM public.sensors 
        ORDER BY sensor_name
        LIMIT 10
      `;
    }

    const sensors = await query;

    return new Response(JSON.stringify({ 
      success: true,
      sensors: sensors,
      timestamp: new Date().toISOString()
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('Error getting sensor statuses:', error);
    return new Response(JSON.stringify({ 
      success: false, 
      error: error.message 
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

