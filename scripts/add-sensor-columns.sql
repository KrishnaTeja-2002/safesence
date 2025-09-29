-- Simple script to add the missing columns to sensors table
-- Run this directly on your Coolify database

-- Add min_limit column if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_schema = 'public' 
                   AND table_name = 'sensors' 
                   AND column_name = 'min_limit') THEN
        ALTER TABLE public.sensors ADD COLUMN min_limit DECIMAL(10,2);
        RAISE NOTICE 'Added min_limit column to sensors table';
    ELSE
        RAISE NOTICE 'min_limit column already exists';
    END IF;
END $$;

-- Add max_limit column if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_schema = 'public' 
                   AND table_name = 'sensors' 
                   AND column_name = 'max_limit') THEN
        ALTER TABLE public.sensors ADD COLUMN max_limit DECIMAL(10,2);
        RAISE NOTICE 'Added max_limit column to sensors table';
    ELSE
        RAISE NOTICE 'max_limit column already exists';
    END IF;
END $$;

-- Show current columns
SELECT column_name, data_type, is_nullable
FROM information_schema.columns 
WHERE table_schema = 'public' 
  AND table_name = 'sensors'
ORDER BY ordinal_position;

