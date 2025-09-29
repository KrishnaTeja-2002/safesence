-- Backfill ALL sensor limits (including empty ones) with min_limit=20.0, max_limit=80.0
-- Run this directly on your Coolify database

-- Show current status before update
SELECT 
  'BEFORE UPDATE' as status,
  COUNT(*) as total_sensors,
  COUNT(CASE WHEN min_limit IS NOT NULL THEN 1 END) as sensors_with_min_limit,
  COUNT(CASE WHEN max_limit IS NOT NULL THEN 1 END) as sensors_with_max_limit,
  COUNT(CASE WHEN min_limit IS NULL THEN 1 END) as sensors_missing_min_limit,
  COUNT(CASE WHEN max_limit IS NULL THEN 1 END) as sensors_missing_max_limit
FROM public.sensors;

-- Show current sensor data
SELECT 
  sensor_id,
  sensor_name,
  latest_temp,
  min_limit,
  max_limit,
  warning_limit,
  status
FROM public.sensors 
ORDER BY sensor_name;

-- Update ALL sensors with default limits (this will overwrite existing values too)
UPDATE public.sensors 
SET 
  min_limit = 20.0,
  max_limit = 80.0;

-- Show updated status
SELECT 
  'AFTER UPDATE' as status,
  COUNT(*) as total_sensors,
  COUNT(CASE WHEN min_limit IS NOT NULL THEN 1 END) as sensors_with_min_limit,
  COUNT(CASE WHEN max_limit IS NOT NULL THEN 1 END) as sensors_with_max_limit,
  COUNT(CASE WHEN min_limit IS NULL THEN 1 END) as sensors_missing_min_limit,
  COUNT(CASE WHEN max_limit IS NULL THEN 1 END) as sensors_missing_max_limit
FROM public.sensors;

-- Show updated sensor data
SELECT 
  sensor_id,
  sensor_name,
  latest_temp,
  min_limit,
  max_limit,
  warning_limit,
  status
FROM public.sensors 
ORDER BY sensor_name;

-- Show summary
SELECT 
  'SUMMARY' as info,
  'All sensors now have min_limit=20.0 and max_limit=80.0' as message;
