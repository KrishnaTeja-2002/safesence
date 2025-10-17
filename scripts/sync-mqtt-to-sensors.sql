-- Sync data from mqtt_consumer_test to public.sensors table
-- This ensures dashboard shows correct online status

-- Function to sync latest readings from mqtt_consumer_test to sensors table
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

-- Create trigger to automatically sync data when new readings arrive
DROP TRIGGER IF EXISTS sync_sensor_trigger ON public.mqtt_consumer_test;
CREATE TRIGGER sync_sensor_trigger
    AFTER INSERT ON public.mqtt_consumer_test
    FOR EACH ROW
    EXECUTE FUNCTION sync_sensor_from_mqtt();

-- Function to manually sync all recent data (run this to catch up)
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

-- Add comment explaining the sync system
COMMENT ON FUNCTION sync_sensor_from_mqtt() IS 
'Syncs latest sensor readings from mqtt_consumer_test to public.sensors table for dashboard display';

COMMENT ON FUNCTION sync_all_recent_sensors() IS 
'Manually sync all sensors with their latest readings from mqtt_consumer_test table';
