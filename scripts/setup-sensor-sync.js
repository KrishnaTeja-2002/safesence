#!/usr/bin/env node

/**
 * Script to sync sensor data from mqtt_consumer_test to public.sensors table
 * This ensures the dashboard shows correct online status
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function setupSensorSync() {
  console.log('🔄 Setting up sensor sync from mqtt_consumer_test to public.sensors...\n');

  try {
    // Create the sync function
    console.log('📝 Creating sync function...');
    await prisma.$executeRaw`
      CREATE OR REPLACE FUNCTION sync_sensor_from_mqtt()
      RETURNS TRIGGER AS $$
      DECLARE
          sensor_id_clean TEXT;
          sensor_record RECORD;
      BEGIN
          -- Extract sensor ID from composite sensor_id (e.g., "DHT22_Temp/esp32-F83AA61F8A3C" -> "DHT22_Temp")
          sensor_id_clean := split_part(NEW.sensor_id, '/', 1);
          
          -- Find the corresponding sensor in public.sensors table
          SELECT * INTO sensor_record 
          FROM public.sensors 
          WHERE sensor_id = sensor_id_clean 
          LIMIT 1;
          
          -- If sensor exists, update with latest reading
          IF FOUND THEN
              UPDATE public.sensors 
              SET 
                  latest_temp = NEW.reading_value,
                  last_fetched_time = NEW.time,
                  status = CASE 
                      -- Check if sensor should be offline (no data for 30+ minutes)
                      WHEN NEW.time < (NOW() - INTERVAL '30 minutes') THEN 'offline'::sensor_status
                      -- Calculate status based on limits (if any)
                      WHEN sensor_record.min_limit IS NOT NULL AND sensor_record.max_limit IS NOT NULL THEN
                          CASE 
                              WHEN NEW.reading_value < sensor_record.min_limit OR NEW.reading_value > sensor_record.max_limit THEN 'alert'::sensor_status
                              WHEN sensor_record.warning_limit IS NOT NULL THEN
                                  CASE 
                                      WHEN NEW.reading_value < (sensor_record.min_limit + (sensor_record.max_limit - sensor_record.min_limit) * sensor_record.warning_limit / 100) OR
                                           NEW.reading_value > (sensor_record.max_limit - (sensor_record.max_limit - sensor_record.min_limit) * sensor_record.warning_limit / 100) THEN 'warning'::sensor_status
                                      ELSE 'ok'::sensor_status
                                  END
                              ELSE 'ok'::sensor_status
                          END
                      ELSE 'ok'::sensor_status
                  END,
                  updated_at = NOW()
              WHERE sensor_id = sensor_id_clean;
              
              RAISE NOTICE 'Updated sensor % with reading % at %', sensor_id_clean, NEW.reading_value, NEW.time;
          ELSE
              RAISE NOTICE 'Sensor % not found in public.sensors table', sensor_id_clean;
          END IF;
          
          RETURN NEW;
      END;
      $$ LANGUAGE plpgsql;
    `;

    // Create the trigger
    console.log('🔗 Creating trigger...');
    await prisma.$executeRaw`DROP TRIGGER IF EXISTS sync_sensor_trigger ON public.mqtt_consumer_test;`;
    await prisma.$executeRaw`
      CREATE TRIGGER sync_sensor_trigger
          AFTER INSERT ON public.mqtt_consumer_test
          FOR EACH ROW
          EXECUTE FUNCTION sync_sensor_from_mqtt();
    `;

    // Create manual sync function
    console.log('🔄 Creating manual sync function...');
    await prisma.$executeRaw`
      CREATE OR REPLACE FUNCTION sync_all_recent_sensors()
      RETURNS INTEGER AS $$
      DECLARE
          updated_count INTEGER := 0;
          sensor_record RECORD;
          latest_reading RECORD;
      BEGIN
          -- For each sensor, find the latest reading from mqtt_consumer_test and update public.sensors
          FOR sensor_record IN 
              SELECT sensor_id FROM public.sensors
          LOOP
              -- Get the latest reading for this sensor
              SELECT * INTO latest_reading
              FROM public.mqtt_consumer_test
              WHERE sensor_id LIKE sensor_record.sensor_id || '/%'
                 OR sensor_id LIKE '%/' || sensor_record.sensor_id
              ORDER BY time DESC
              LIMIT 1;
              
              -- Update the sensor if we found a reading
              IF FOUND THEN
                  UPDATE public.sensors 
                  SET 
                      latest_temp = latest_reading.reading_value,
                      last_fetched_time = latest_reading.time,
                      status = CASE 
                          WHEN latest_reading.time < (NOW() - INTERVAL '30 minutes') THEN 'offline'::sensor_status
                          WHEN min_limit IS NOT NULL AND max_limit IS NOT NULL THEN
                              CASE 
                                  WHEN latest_reading.reading_value < min_limit OR latest_reading.reading_value > max_limit THEN 'alert'::sensor_status
                                  WHEN warning_limit IS NOT NULL THEN
                                      CASE 
                                          WHEN latest_reading.reading_value < (min_limit + (max_limit - min_limit) * warning_limit / 100) OR
                                               latest_reading.reading_value > (max_limit - (max_limit - min_limit) * warning_limit / 100) THEN 'warning'::sensor_status
                                          ELSE 'ok'::sensor_status
                                      END
                                  ELSE 'ok'::sensor_status
                              END
                          ELSE 'ok'::sensor_status
                      END,
                      updated_at = NOW()
                  WHERE sensor_id = sensor_record.sensor_id;
                  
                  updated_count := updated_count + 1;
                  RAISE NOTICE 'Synced sensor % with latest reading %', sensor_record.sensor_id, latest_reading.reading_value;
              ELSE
                  RAISE NOTICE 'No recent readings found for sensor %', sensor_record.sensor_id;
              END IF;
          END LOOP;
          
          RETURN updated_count;
      END;
      $$ LANGUAGE plpgsql;
    `;

    console.log('\n✅ Sync setup completed successfully!');
    console.log('\n📋 What was set up:');
    console.log('  • Trigger function to auto-sync new readings');
    console.log('  • Manual sync function for existing data');
    console.log('  • Automatic trigger on mqtt_consumer_test table');
    
    console.log('\n🚀 Next steps:');
    console.log('  1. Your dashboard should now show correct online status');
    console.log('  2. New readings will automatically update sensor status');
    console.log('  3. Run manual sync if needed: SELECT sync_all_recent_sensors();');
    
    console.log('\n💡 Dashboard Status:');
    console.log('  • Sensors will now show "online" if they have recent data');
    console.log('  • Status updates automatically every time new data arrives');
    console.log('  • Offline detection: 30+ minutes without data');

    // Run initial sync to update current sensors
    console.log('\n🔄 Running initial sync to update current sensors...');
    const result = await prisma.$queryRaw`SELECT sync_all_recent_sensors() as updated_count;`;
    console.log(`✅ Initial sync completed! Updated ${result[0].updated_count} sensors.`);

  } catch (error) {
    console.error('❌ Error setting up sensor sync:', error.message);
    console.log('\n🔧 Troubleshooting:');
    console.log('  • Check your database connection');
    console.log('  • Ensure you have access to create functions and triggers');
    console.log('  • Verify the mqtt_consumer_test table exists');
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the setup
setupSensorSync();
