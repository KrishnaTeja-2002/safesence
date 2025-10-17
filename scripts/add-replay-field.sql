-- Add replay field to mqtt_consumer_test table
-- This field tracks whether data is backfilled (replay=true) or live (replay=false/null)

-- Add replay column with default false
ALTER TABLE public.mqtt_consumer_test
ADD COLUMN IF NOT EXISTS replay BOOLEAN DEFAULT false;

-- Create optimized index for 24h sensor queries
CREATE INDEX IF NOT EXISTS idx_mqtt_consumer_test_sensor_time 
ON public.mqtt_consumer_test (sensor_id, time DESC);

-- Create index for replay filtering
CREATE INDEX IF NOT EXISTS idx_mqtt_consumer_test_replay 
ON public.mqtt_consumer_test (replay, time DESC) 
WHERE replay IS NOT NULL;

-- Create partial index for live data only (most common query)
CREATE INDEX IF NOT EXISTS idx_mqtt_consumer_test_live 
ON public.mqtt_consumer_test (sensor_id, time DESC) 
WHERE COALESCE(replay, false) = false;

-- Add comment explaining the field
COMMENT ON COLUMN public.mqtt_consumer_test.replay IS 
'Indicates if this reading is backfilled data (true) or live data (false/null). Used to filter duplicate data during ESP32 reconnections.';

-- Vacuum analyze to update statistics
VACUUM ANALYZE public.mqtt_consumer_test;

