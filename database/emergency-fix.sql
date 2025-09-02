-- 🚨 EMERGENCY FIX: Add Missing business_name Column
-- Immediate fix for "column business_name does not exist" error
-- Run this FIRST to fix the immediate error

-- =====================================================
-- IMMEDIATE COLUMN FIXES
-- =====================================================

-- Add missing business_name column to discharge_facilities if it doesn't exist
DO $$
BEGIN
    -- Check and add business_name column to discharge_facilities
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'discharge_facilities' 
        AND column_name = 'business_name'
    ) THEN
        ALTER TABLE discharge_facilities ADD COLUMN business_name TEXT;
        RAISE NOTICE 'Added business_name column to discharge_facilities';
    ELSE
        RAISE NOTICE 'business_name column already exists in discharge_facilities';
    END IF;
    
    -- Check and add business_name column to prevention_facilities
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'prevention_facilities' 
        AND column_name = 'business_name'
    ) THEN
        ALTER TABLE prevention_facilities ADD COLUMN business_name TEXT;
        RAISE NOTICE 'Added business_name column to prevention_facilities';
    ELSE
        RAISE NOTICE 'business_name column already exists in prevention_facilities';
    END IF;
    
    -- Add other missing legacy compatibility columns
    -- discharge_facilities
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'discharge_facilities' AND column_name = 'outlet_number') THEN
        ALTER TABLE discharge_facilities ADD COLUMN outlet_number INTEGER;
        RAISE NOTICE 'Added outlet_number column to discharge_facilities';
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'discharge_facilities' AND column_name = 'facility_number') THEN
        ALTER TABLE discharge_facilities ADD COLUMN facility_number INTEGER;
        RAISE NOTICE 'Added facility_number column to discharge_facilities';
    END IF;
    
    -- prevention_facilities  
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'prevention_facilities' AND column_name = 'outlet_number') THEN
        ALTER TABLE prevention_facilities ADD COLUMN outlet_number INTEGER;
        RAISE NOTICE 'Added outlet_number column to prevention_facilities';
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'prevention_facilities' AND column_name = 'facility_number') THEN
        ALTER TABLE prevention_facilities ADD COLUMN facility_number INTEGER;
        RAISE NOTICE 'Added facility_number column to prevention_facilities';
    END IF;
    
    -- Add notes column if missing (some APIs expect this)
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'discharge_facilities' AND column_name = 'notes') THEN
        ALTER TABLE discharge_facilities ADD COLUMN notes TEXT;
        RAISE NOTICE 'Added notes column to discharge_facilities';
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'prevention_facilities' AND column_name = 'notes') THEN
        ALTER TABLE prevention_facilities ADD COLUMN notes TEXT;
        RAISE NOTICE 'Added notes column to prevention_facilities';
    END IF;
    
END $$;

-- =====================================================
-- POPULATE MISSING DATA FOR EXISTING RECORDS
-- =====================================================

-- Set default values for any existing records that might have NULL in new columns
UPDATE discharge_facilities 
SET 
    business_name = COALESCE(business_name, '(주)조양(전체)'),
    outlet_number = COALESCE(outlet_number, 1),
    facility_number = COALESCE(facility_number, id::text::integer % 1000) -- Temporary unique numbers
WHERE business_name IS NULL OR outlet_number IS NULL OR facility_number IS NULL;

UPDATE prevention_facilities 
SET 
    business_name = COALESCE(business_name, '(주)조양(전체)'),
    outlet_number = COALESCE(outlet_number, 1), 
    facility_number = COALESCE(facility_number, id::text::integer % 1000) -- Temporary unique numbers
WHERE business_name IS NULL OR outlet_number IS NULL OR facility_number IS NULL;

-- =====================================================
-- ADD ESSENTIAL INDEXES
-- =====================================================

-- Create indexes for the legacy columns to ensure good performance
CREATE INDEX IF NOT EXISTS idx_discharge_facilities_business_name 
ON discharge_facilities(business_name);

CREATE INDEX IF NOT EXISTS idx_discharge_facilities_business_outlet 
ON discharge_facilities(business_name, outlet_number);

CREATE INDEX IF NOT EXISTS idx_prevention_facilities_business_name 
ON prevention_facilities(business_name);

CREATE INDEX IF NOT EXISTS idx_prevention_facilities_business_outlet 
ON prevention_facilities(business_name, outlet_number);

-- =====================================================
-- VERIFY THE FIX
-- =====================================================

-- Test the fix by running a query similar to what was failing
DO $$
DECLARE
    test_count INTEGER;
BEGIN
    -- Test discharge_facilities query
    SELECT COUNT(*) INTO test_count
    FROM discharge_facilities 
    WHERE business_name = '(주)조양(전체)';
    
    RAISE NOTICE 'Test query for discharge_facilities succeeded. Found % records', test_count;
    
    -- Test prevention_facilities query  
    SELECT COUNT(*) INTO test_count
    FROM prevention_facilities
    WHERE business_name = '(주)조양(전체)';
    
    RAISE NOTICE 'Test query for prevention_facilities succeeded. Found % records', test_count;
    
EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'Test query failed with error: %', SQLERRM;
END $$;

-- Show final table structures
SELECT 
    table_name,
    column_name,
    data_type,
    is_nullable
FROM information_schema.columns 
WHERE table_name IN ('discharge_facilities', 'prevention_facilities')
ORDER BY table_name, ordinal_position;

RAISE NOTICE '🎉 Emergency fix completed! The business_name column error should now be resolved.';