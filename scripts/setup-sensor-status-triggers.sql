-- Setup sensor status management with triggers and functions
-- This script creates functions and triggers to automatically manage sensor status

-- First, add the missing columns to sensors table if they don't exist
DO $$ 
BEGIN
    -- Add min_limit column if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_schema = 'public' 
                   AND table_name = 'sensors' 
                   AND column_name = 'min_limit') THEN
        ALTER TABLE public.sensors ADD COLUMN min_limit DECIMAL(10,2);
    END IF;
    
    -- Add max_limit column if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_schema = 'public' 
                   AND table_name = 'sensors' 
                   AND column_name = 'max_limit') THEN
        ALTER TABLE public.sensors ADD COLUMN max_limit DECIMAL(10,2);
    END IF;
END $$;

-- Function to calculate sensor status based on value and limits
CREATE OR REPLACE FUNCTION calculate_sensor_status(
    sensor_value DECIMAL(10,2),
    min_limit DECIMAL(10,2),
    max_limit DECIMAL(10,2),
    warning_limit INTEGER DEFAULT 10
) RETURNS TEXT AS $$
DECLARE
    status TEXT := 'ok';
    threshold_percent DECIMAL(5,2);
BEGIN
    -- If no value, return offline
    IF sensor_value IS NULL THEN
        RETURN 'offline';
    END IF;
    
    -- If no limits set, return ok
    IF min_limit IS NULL AND max_limit IS NULL THEN
        RETURN 'ok';
    END IF;
    
    -- Check min limit
    IF min_limit IS NOT NULL THEN
        IF sensor_value < min_limit THEN
            RETURN 'alert';
        END IF;
        
        -- Check warning threshold (within 10% of min limit)
        threshold_percent := (min_limit * warning_limit / 100);
        IF sensor_value < (min_limit + threshold_percent) THEN
            RETURN 'warning';
        END IF;
    END IF;
    
    -- Check max limit
    IF max_limit IS NOT NULL THEN
        IF sensor_value > max_limit THEN
            RETURN 'alert';
        END IF;
        
        -- Check warning threshold (within 10% of max limit)
        threshold_percent := (max_limit * warning_limit / 100);
        IF sensor_value > (max_limit - threshold_percent) THEN
            RETURN 'warning';
        END IF;
    END IF;
    
    RETURN 'ok';
END;
$$ LANGUAGE plpgsql;

-- Function to check if sensor should be marked as offline (no data for 30 minutes)
CREATE OR REPLACE FUNCTION check_sensor_offline_status(
    last_fetched_time TIMESTAMP WITH TIME ZONE
) RETURNS TEXT AS $$
BEGIN
    -- If no last_fetched_time, consider offline
    IF last_fetched_time IS NULL THEN
        RETURN 'offline';
    END IF;
    
    -- If last data was more than 30 minutes ago, mark as offline
    IF last_fetched_time < (NOW() - INTERVAL '30 minutes') THEN
        RETURN 'offline';
    END IF;
    
    RETURN 'online';
END;
$$ LANGUAGE plpgsql;

-- Function to update sensor status based on value and time
CREATE OR REPLACE FUNCTION update_sensor_status()
RETURNS TRIGGER AS $$
DECLARE
    value_status TEXT;
    time_status TEXT;
    final_status TEXT;
BEGIN
    -- Calculate status based on value and limits
    value_status := calculate_sensor_status(
        NEW.latest_temp,
        NEW.min_limit,
        NEW.max_limit,
        COALESCE(NEW.warning_limit, 10)
    );
    
    -- Check if sensor should be offline due to time
    time_status := check_sensor_offline_status(NEW.last_fetched_time);
    
    -- Determine final status
    IF time_status = 'offline' THEN
        final_status := 'offline';
    ELSE
        final_status := value_status;
    END IF;
    
    -- Update the status
    NEW.status := final_status;
    
    -- Update last_fetched_time if we have new data
    IF NEW.latest_temp IS NOT NULL THEN
        NEW.last_fetched_time := NOW();
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Function to periodically check for offline sensors (for scheduled job)
CREATE OR REPLACE FUNCTION check_all_sensors_offline()
RETURNS INTEGER AS $$
DECLARE
    updated_count INTEGER := 0;
    sensor_record RECORD;
BEGIN
    -- Find sensors that should be marked as offline
    FOR sensor_record IN 
        SELECT sensor_id, status
        FROM public.sensors 
        WHERE status != 'offline' 
        AND (
            last_fetched_time IS NULL 
            OR last_fetched_time < (NOW() - INTERVAL '30 minutes')
        )
    LOOP
        -- Update status to offline
        UPDATE public.sensors 
        SET status = 'offline', updated_at = NOW()
        WHERE sensor_id = sensor_record.sensor_id;
        
        updated_count := updated_count + 1;
    END LOOP;
    
    RETURN updated_count;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for automatic status updates
DROP TRIGGER IF EXISTS sensor_status_trigger ON public.sensors;
CREATE TRIGGER sensor_status_trigger
    BEFORE UPDATE ON public.sensors
    FOR EACH ROW
    EXECUTE FUNCTION update_sensor_status();

-- Create trigger for INSERT operations as well
DROP TRIGGER IF EXISTS sensor_status_insert_trigger ON public.sensors;
CREATE TRIGGER sensor_status_insert_trigger
    BEFORE INSERT ON public.sensors
    FOR EACH ROW
    EXECUTE FUNCTION update_sensor_status();

-- Create an index on last_fetched_time for better performance
CREATE INDEX IF NOT EXISTS idx_sensors_last_fetched_time 
ON public.sensors(last_fetched_time);

-- Create an index on status for better performance
CREATE INDEX IF NOT EXISTS idx_sensors_status 
ON public.sensors(status);

-- Add comments to explain the system
COMMENT ON FUNCTION calculate_sensor_status IS 'Calculates sensor status based on value and min/max limits with warning thresholds';
COMMENT ON FUNCTION check_sensor_offline_status IS 'Checks if sensor should be marked offline based on last data time (30 min threshold)';
COMMENT ON FUNCTION update_sensor_status IS 'Trigger function to automatically update sensor status on INSERT/UPDATE';
COMMENT ON FUNCTION check_all_sensors_offline IS 'Function to check all sensors and mark offline ones (for scheduled jobs)';

-- Example: Update existing sensors to have proper status
UPDATE public.sensors 
SET status = CASE 
    WHEN last_fetched_time IS NULL OR last_fetched_time < (NOW() - INTERVAL '30 minutes') THEN 'offline'
    ELSE calculate_sensor_status(latest_temp, min_limit, max_limit, COALESCE(warning_limit, 10))
END,
updated_at = NOW()
WHERE status IS NULL OR status = '';

-- Show summary of what was created
SELECT 
    'Sensor status management system installed successfully!' as message,
    COUNT(*) as total_sensors,
    COUNT(CASE WHEN status = 'ok' THEN 1 END) as ok_sensors,
    COUNT(CASE WHEN status = 'warning' THEN 1 END) as warning_sensors,
    COUNT(CASE WHEN status = 'alert' THEN 1 END) as alert_sensors,
    COUNT(CASE WHEN status = 'offline' THEN 1 END) as offline_sensors
FROM public.sensors;





