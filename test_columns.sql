-- Test script to check if the new columns exist
-- Run this to verify the columns were added successfully

-- Check if columns exist in sensors table
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns 
WHERE table_name = 'sensors' 
  AND column_name IN ('email_alert', 'mobile_alert');

-- Check if columns exist in team_invitations table
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns 
WHERE table_name = 'team_invitations' 
  AND column_name IN ('email_alert', 'mobile_alert');

-- Test query to see if we can select the new columns
SELECT sensor_id, email_alert, mobile_alert 
FROM sensors 
LIMIT 1;

-- Test query for team_invitations
SELECT sensor_id, email_alert, mobile_alert 
FROM team_invitations 
LIMIT 1;
