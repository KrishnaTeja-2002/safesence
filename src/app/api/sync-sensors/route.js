export const runtime = "nodejs";

import { PrismaClient } from '@prisma/client';

// GET /api/sync-sensors - Manually sync sensor data from mqtt_consumer_test to public.sensors
export async function GET(request) {
  const prisma = new PrismaClient();
  
  try {
    console.log('🔄 Starting manual sensor sync...');
    
    // Get all sensors from public.sensors
    const sensors = await prisma.$queryRaw`
      SELECT sensor_id FROM public.sensors
    `;
    
    let updatedCount = 0;
    const results = [];
    
    // For each sensor, find the latest reading from mqtt_consumer_test
    for (const sensor of sensors) {
      const sensorId = sensor.sensor_id;
      
      try {
        // Get the latest reading for this sensor (try both patterns)
        const latestReading = await prisma.$queryRaw`
          SELECT * FROM public.mqtt_consumer_test
          WHERE sensor_id LIKE ${sensorId + '/%'}
             OR sensor_id LIKE ${'%/' + sensorId}
          ORDER BY time DESC
          LIMIT 1
        `;
        
        if (latestReading && latestReading.length > 0) {
          const reading = latestReading[0];
          
          // Calculate status
          let status = 'ok';
          const now = new Date();
          const readingTime = new Date(reading.time);
          const timeDiffMinutes = (now - readingTime) / (1000 * 60);
          
          // Check if offline (30+ minutes without data)
          if (timeDiffMinutes > 30) {
            status = 'offline';
          } else {
            // Get sensor limits to calculate status based on value
            const sensorData = await prisma.$queryRaw`
              SELECT min_limit, max_limit, warning_limit FROM public.sensors 
              WHERE sensor_id = ${sensorId}
              LIMIT 1
            `;
            
            if (sensorData && sensorData.length > 0) {
              const limits = sensorData[0];
              const value = parseFloat(reading.reading_value);
              
              if (limits.min_limit !== null && limits.max_limit !== null) {
                if (value < limits.min_limit || value > limits.max_limit) {
                  status = 'alert';
                } else if (limits.warning_limit !== null) {
                  const range = limits.max_limit - limits.min_limit;
                  const warningThreshold = limits.warning_limit / 100;
                  if (value < (limits.min_limit + range * warningThreshold) || 
                      value > (limits.max_limit - range * warningThreshold)) {
                    status = 'warning';
                  }
                }
              }
            }
          }
          
          // Update the sensor
          await prisma.$executeRaw`
            UPDATE public.sensors 
            SET 
              latest_temp = ${reading.reading_value},
              last_fetched_time = ${reading.time},
              status = ${status}::sensor_status
            WHERE sensor_id = ${sensorId}
          `;
          
          updatedCount++;
          results.push({
            sensor_id: sensorId,
            reading_value: reading.reading_value,
            time: reading.time,
            status: status
          });
          
          console.log(`✅ Updated sensor ${sensorId} with reading ${reading.reading_value} at ${reading.time} (status: ${status})`);
        } else {
          console.log(`⚠️  No recent readings found for sensor ${sensorId}`);
          results.push({
            sensor_id: sensorId,
            reading_value: null,
            time: null,
            status: 'offline'
          });
        }
      } catch (sensorError) {
        console.error(`Error processing sensor ${sensorId}:`, sensorError);
        // Continue with next sensor even if one fails
        results.push({
          sensor_id: sensorId,
          reading_value: null,
          time: null,
          status: 'offline',
          error: sensorError.message
        });
      }
    }
    
    console.log(`✅ Sync completed! Updated ${updatedCount} sensors.`);
    
    return Response.json({
      success: true,
      message: `Successfully synced ${updatedCount} sensors`,
      updated_count: updatedCount,
      results: results
    });
    
  } catch (error) {
    console.error('❌ Error syncing sensors:', error);
    return Response.json({
      success: false,
      error: error.message
    }, { status: 500 });
  } finally {
    // Always disconnect Prisma, even on error
    try {
      await prisma.$disconnect();
    } catch (disconnectError) {
      console.error('Error disconnecting Prisma:', disconnectError);
    }
  }
}
