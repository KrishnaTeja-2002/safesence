-- Execute these commands in order to safely remove unused tables

-- ============================================
-- WARNING: BACKUP YOUR DATABASE FIRST!
-- ============================================

-- Step 1: Drop foreign key constraints first (if any exist)
-- Note: Supabase/PostgreSQL will handle most constraint drops automatically
-- when dropping tables, but it's good practice to be explicit

-- Step 2: Drop the unused tables
-- Order matters due to potential foreign key dependencies

-- Drop sensor_access table first (it references sensors and auth.users)
DROP TABLE IF EXISTS sensor_access CASCADE;

-- Drop team_members table (it references auth.users)
DROP TABLE IF EXISTS team_members CASCADE;

-- ============================================
-- Verification Queries (run these after deletion)
-- ============================================

-- Check that tables were successfully dropped
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
  AND table_name IN ('sensor_access', 'team_members');

-- This should return no rows if the tables were successfully deleted

-- ============================================
-- Optional: Clean up any related sequences or types
-- ============================================

-- Drop any custom types that might only be used by these tables
-- (Check if these types are used elsewhere before dropping)
-- DROP TYPE IF EXISTS sensor_access_role CASCADE;

-- ============================================
-- Notes:
-- ============================================
-- 1. CASCADE will automatically drop dependent objects
-- 2. IF EXISTS prevents errors if tables don't exist
-- 3. The auth.users table is managed by Supabase Auth and should NOT be dropped
-- 4. Make sure to test your application after running this script
