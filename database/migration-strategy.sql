-- 🔄 Migration Strategy: Fix Schema Mismatch & Preserve Data
-- Safe migration from flat to normalized structure with backward compatibility
-- Created: 2025-09-01

-- =====================================================
-- PHASE 1: DIAGNOSTIC - Check Current State
-- =====================================================

-- 1.1: Check existing tables and their structures
DO $$
DECLARE
    table_exists BOOLEAN;
    column_exists BOOLEAN;
BEGIN
    -- Check if discharge_facilities exists and its structure
    SELECT EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_name = 'discharge_facilities'
    ) INTO table_exists;
    
    IF table_exists THEN
        RAISE NOTICE 'discharge_facilities table exists';
        
        -- Check if business_name column exists
        SELECT EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_name = 'discharge_facilities' 
            AND column_name = 'business_name'
        ) INTO column_exists;
        
        IF column_exists THEN
            RAISE NOTICE 'business_name column exists in discharge_facilities';
        ELSE
            RAISE NOTICE 'business_name column MISSING in discharge_facilities - this is the error source';
        END IF;
    ELSE
        RAISE NOTICE 'discharge_facilities table does NOT exist';
    END IF;
    
    -- Check prevention_facilities
    SELECT EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_name = 'prevention_facilities'
    ) INTO table_exists;
    
    IF table_exists THEN
        RAISE NOTICE 'prevention_facilities table exists';
        
        SELECT EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_name = 'prevention_facilities' 
            AND column_name = 'business_name'
        ) INTO column_exists;
        
        IF column_exists THEN
            RAISE NOTICE 'business_name column exists in prevention_facilities';
        ELSE
            RAISE NOTICE 'business_name column MISSING in prevention_facilities - this is the error source';
        END IF;
    ELSE
        RAISE NOTICE 'prevention_facilities table does NOT exist';
    END IF;
END $$;

-- =====================================================
-- PHASE 2: BACKUP EXISTING DATA
-- =====================================================

-- 2.1: Create backup tables for existing data
CREATE TABLE IF NOT EXISTS migration_backup_discharge_facilities AS
SELECT * FROM discharge_facilities WHERE 1=0; -- Structure only initially

CREATE TABLE IF NOT EXISTS migration_backup_prevention_facilities AS  
SELECT * FROM prevention_facilities WHERE 1=0; -- Structure only initially

-- 2.2: Backup existing data if tables exist
DO $$
BEGIN
    -- Backup discharge_facilities if it exists
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'discharge_facilities') THEN
        INSERT INTO migration_backup_discharge_facilities SELECT * FROM discharge_facilities;
        RAISE NOTICE 'Backed up % rows from discharge_facilities', (SELECT COUNT(*) FROM discharge_facilities);
    END IF;
    
    -- Backup prevention_facilities if it exists
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'prevention_facilities') THEN
        INSERT INTO migration_backup_prevention_facilities SELECT * FROM prevention_facilities;
        RAISE NOTICE 'Backed up % rows from prevention_facilities', (SELECT COUNT(*) FROM prevention_facilities);
    END IF;
END $$;

-- =====================================================
-- PHASE 3: CREATE MISSING CORE TABLES
-- =====================================================

-- 3.1: Ensure business_info exists (foundation table)
CREATE TABLE IF NOT EXISTS business_info (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Core fields
    business_name VARCHAR(255) NOT NULL UNIQUE,
    local_government VARCHAR(100),
    address TEXT,
    manager_name VARCHAR(100),
    manager_position VARCHAR(50),
    manager_contact VARCHAR(20),
    business_contact VARCHAR(20),
    fax_number VARCHAR(20),
    email VARCHAR(255),
    representative_name VARCHAR(100),
    business_registration_number VARCHAR(20),
    
    -- Equipment quantities
    manufacturer VARCHAR(20) DEFAULT 'ecosense',
    vpn VARCHAR(10) DEFAULT 'wired',
    ph_sensor INTEGER DEFAULT 0,
    differential_pressure_meter INTEGER DEFAULT 0,
    temperature_meter INTEGER DEFAULT 0,
    discharge_current_meter INTEGER DEFAULT 0,
    fan_current_meter INTEGER DEFAULT 0,
    pump_current_meter INTEGER DEFAULT 0,
    gateway INTEGER DEFAULT 0,
    
    -- Extensible field
    additional_info JSONB DEFAULT '{}',
    
    -- Status
    is_active BOOLEAN DEFAULT true,
    is_deleted BOOLEAN DEFAULT false
);

-- 3.2: Create air_permit_info if missing
CREATE TABLE IF NOT EXISTS air_permit_info (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id UUID NOT NULL REFERENCES business_info(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    business_type VARCHAR(100),
    annual_emission_amount DECIMAL(10,2),
    first_report_date DATE,
    operation_start_date DATE,
    
    additional_info JSONB DEFAULT '{}',
    is_active BOOLEAN DEFAULT true,
    is_deleted BOOLEAN DEFAULT false
);

-- 3.3: Create discharge_outlets if missing
CREATE TABLE IF NOT EXISTS discharge_outlets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    air_permit_id UUID NOT NULL REFERENCES air_permit_info(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    outlet_number INTEGER NOT NULL,
    outlet_name VARCHAR(100),
    additional_info JSONB DEFAULT '{}',
    
    UNIQUE(air_permit_id, outlet_number)
);

-- =====================================================
-- PHASE 4: SAFE SCHEMA MIGRATION
-- =====================================================

-- 4.1: Add missing columns to existing tables (if they exist)
DO $$
BEGIN
    -- Add business_name to discharge_facilities if missing
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'discharge_facilities') THEN
        -- Add missing columns for backward compatibility
        ALTER TABLE discharge_facilities ADD COLUMN IF NOT EXISTS business_name TEXT;
        ALTER TABLE discharge_facilities ADD COLUMN IF NOT EXISTS outlet_number INTEGER;
        ALTER TABLE discharge_facilities ADD COLUMN IF NOT EXISTS facility_number INTEGER;
        ALTER TABLE discharge_facilities ADD COLUMN IF NOT EXISTS outlet_id UUID REFERENCES discharge_outlets(id);
        
        RAISE NOTICE 'Added missing columns to discharge_facilities';
    END IF;
    
    -- Add business_name to prevention_facilities if missing  
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'prevention_facilities') THEN
        -- Add missing columns for backward compatibility
        ALTER TABLE prevention_facilities ADD COLUMN IF NOT EXISTS business_name TEXT;
        ALTER TABLE prevention_facilities ADD COLUMN IF NOT EXISTS outlet_number INTEGER;
        ALTER TABLE prevention_facilities ADD COLUMN IF NOT EXISTS facility_number INTEGER;
        ALTER TABLE prevention_facilities ADD COLUMN IF NOT EXISTS outlet_id UUID REFERENCES discharge_outlets(id);
        
        RAISE NOTICE 'Added missing columns to prevention_facilities';
    END IF;
END $$;

-- 4.2: Create facility tables with full schema if they don't exist
CREATE TABLE IF NOT EXISTS discharge_facilities (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    outlet_id UUID REFERENCES discharge_outlets(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Core facility data
    facility_name VARCHAR(200) NOT NULL,
    capacity VARCHAR(50),
    quantity INTEGER DEFAULT 1,
    
    -- Legacy compatibility fields
    business_name TEXT, -- Populated automatically via trigger
    outlet_number INTEGER, -- Populated automatically via trigger  
    facility_number INTEGER, -- Auto-increment per outlet
    
    -- Extended attributes
    device_ids UUID[] DEFAULT '{}',
    measurement_points JSONB DEFAULT '[]',
    operating_conditions JSONB DEFAULT '{}',
    additional_info JSONB DEFAULT '{}'
);

CREATE TABLE IF NOT EXISTS prevention_facilities (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    outlet_id UUID REFERENCES discharge_outlets(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Core facility data
    facility_name VARCHAR(200) NOT NULL,
    capacity VARCHAR(50),
    quantity INTEGER DEFAULT 1,
    
    -- Legacy compatibility fields
    business_name TEXT, -- Populated automatically via trigger
    outlet_number INTEGER, -- Populated automatically via trigger
    facility_number INTEGER, -- Auto-increment per outlet
    
    -- Extended attributes
    efficiency_rating DECIMAL(5,2),
    device_ids UUID[] DEFAULT '{}',
    measurement_points JSONB DEFAULT '[]',
    operating_conditions JSONB DEFAULT '{}',
    additional_info JSONB DEFAULT '{}'
);

-- =====================================================
-- PHASE 5: DATA MIGRATION & POPULATION
-- =====================================================

-- 5.1: Create default business and permit records for existing flat data
INSERT INTO business_info (business_name, additional_info)
SELECT DISTINCT 
    business_name,
    jsonb_build_object('migrated_from_legacy', true, 'migration_date', NOW())
FROM (
    SELECT business_name FROM discharge_facilities WHERE business_name IS NOT NULL
    UNION
    SELECT business_name FROM prevention_facilities WHERE business_name IS NOT NULL
) AS existing_businesses
WHERE NOT EXISTS (
    SELECT 1 FROM business_info bi WHERE bi.business_name = existing_businesses.business_name
)
ON CONFLICT (business_name) DO NOTHING;

-- 5.2: Create default air permits for businesses that have facilities but no permits
INSERT INTO air_permit_info (business_id, business_type, additional_info)
SELECT 
    bi.id,
    '기타',
    jsonb_build_object('auto_created_for_migration', true, 'migration_date', NOW())
FROM business_info bi
WHERE NOT EXISTS (
    SELECT 1 FROM air_permit_info api WHERE api.business_id = bi.id
)
AND EXISTS (
    SELECT 1 FROM discharge_facilities df WHERE df.business_name = bi.business_name
    UNION
    SELECT 1 FROM prevention_facilities pf WHERE pf.business_name = bi.business_name
);

-- 5.3: Create discharge outlets for each unique outlet_number per business
INSERT INTO discharge_outlets (air_permit_id, outlet_number, outlet_name, additional_info)
SELECT DISTINCT
    api.id,
    COALESCE(facilities.outlet_number, 1),
    CONCAT('배출구 ', COALESCE(facilities.outlet_number, 1)),
    jsonb_build_object('auto_created_for_migration', true)
FROM air_permit_info api
JOIN business_info bi ON api.business_id = bi.id
JOIN (
    SELECT business_name, outlet_number FROM discharge_facilities WHERE outlet_number IS NOT NULL
    UNION
    SELECT business_name, outlet_number FROM prevention_facilities WHERE outlet_number IS NOT NULL
    UNION
    SELECT business_name, 1 as outlet_number FROM discharge_facilities WHERE outlet_number IS NULL
    UNION 
    SELECT business_name, 1 as outlet_number FROM prevention_facilities WHERE outlet_number IS NULL
) facilities ON bi.business_name = facilities.business_name
WHERE NOT EXISTS (
    SELECT 1 FROM discharge_outlets do 
    WHERE do.air_permit_id = api.id 
    AND do.outlet_number = COALESCE(facilities.outlet_number, 1)
)
ON CONFLICT (air_permit_id, outlet_number) DO NOTHING;

-- =====================================================
-- PHASE 6: POPULATE NORMALIZED RELATIONSHIPS
-- =====================================================

-- 6.1: Update existing discharge_facilities with outlet_id references
UPDATE discharge_facilities 
SET outlet_id = do.id
FROM discharge_outlets do
JOIN air_permit_info api ON do.air_permit_id = api.id
JOIN business_info bi ON api.business_id = bi.id
WHERE discharge_facilities.business_name = bi.business_name
AND discharge_facilities.outlet_number = do.outlet_number
AND discharge_facilities.outlet_id IS NULL;

-- 6.2: Update existing prevention_facilities with outlet_id references  
UPDATE prevention_facilities
SET outlet_id = do.id
FROM discharge_outlets do
JOIN air_permit_info api ON do.air_permit_id = api.id
JOIN business_info bi ON api.business_id = bi.id
WHERE prevention_facilities.business_name = bi.business_name
AND prevention_facilities.outlet_number = do.outlet_number
AND prevention_facilities.outlet_id IS NULL;

-- 6.3: Auto-populate legacy fields where missing
UPDATE discharge_facilities 
SET 
    business_name = bi.business_name,
    outlet_number = do.outlet_number
FROM discharge_outlets do
JOIN air_permit_info api ON do.air_permit_id = api.id
JOIN business_info bi ON api.business_id = bi.id
WHERE discharge_facilities.outlet_id = do.id
AND (discharge_facilities.business_name IS NULL OR discharge_facilities.outlet_number IS NULL);

UPDATE prevention_facilities
SET 
    business_name = bi.business_name,
    outlet_number = do.outlet_number
FROM discharge_outlets do
JOIN air_permit_info api ON do.air_permit_id = api.id  
JOIN business_info bi ON api.business_id = bi.id
WHERE prevention_facilities.outlet_id = do.id
AND (prevention_facilities.business_name IS NULL OR prevention_facilities.outlet_number IS NULL);

-- =====================================================
-- PHASE 7: CREATE COMPATIBILITY VIEWS
-- =====================================================

-- 7.1: Legacy-compatible views for existing API endpoints
CREATE OR REPLACE VIEW legacy_discharge_facilities AS
SELECT 
    df.id,
    df.created_at,
    df.updated_at,
    df.facility_name,
    df.capacity,
    df.quantity,
    df.additional_info::text as notes,
    
    -- Legacy fields (always populated)
    COALESCE(df.business_name, bi.business_name) as business_name,
    COALESCE(df.outlet_number, do.outlet_number) as outlet_number,
    COALESCE(df.facility_number, row_number() OVER (PARTITION BY df.outlet_id ORDER BY df.created_at)) as facility_number,
    
    -- Normalized fields
    df.outlet_id,
    api.id as air_permit_id,
    bi.id as business_id
FROM discharge_facilities df
LEFT JOIN discharge_outlets do ON df.outlet_id = do.id
LEFT JOIN air_permit_info api ON do.air_permit_id = api.id
LEFT JOIN business_info bi ON api.business_id = bi.id;

CREATE OR REPLACE VIEW legacy_prevention_facilities AS
SELECT 
    pf.id,
    pf.created_at,
    pf.updated_at,
    pf.facility_name,
    pf.capacity,
    pf.quantity,
    pf.additional_info::text as notes,
    
    -- Legacy fields (always populated)
    COALESCE(pf.business_name, bi.business_name) as business_name,
    COALESCE(pf.outlet_number, do.outlet_number) as outlet_number,
    COALESCE(pf.facility_number, row_number() OVER (PARTITION BY pf.outlet_id ORDER BY pf.created_at)) as facility_number,
    
    -- Normalized fields
    pf.outlet_id,
    api.id as air_permit_id,
    bi.id as business_id
FROM prevention_facilities pf
LEFT JOIN discharge_outlets do ON pf.outlet_id = do.id
LEFT JOIN air_permit_info api ON do.air_permit_id = api.id
LEFT JOIN business_info bi ON api.business_id = bi.id;

-- =====================================================
-- PHASE 8: VALIDATION & INTEGRITY CHECKS
-- =====================================================

-- 8.1: Validation function to check data integrity
CREATE OR REPLACE FUNCTION validate_migration_integrity()
RETURNS TABLE(
    check_name TEXT,
    status TEXT,
    details TEXT
) AS $$
BEGIN
    -- Check 1: All facilities have business_name
    RETURN QUERY
    SELECT 
        'discharge_facilities_business_name'::TEXT,
        CASE WHEN COUNT(*) = 0 THEN 'PASS' ELSE 'FAIL' END::TEXT,
        'Rows missing business_name: ' || COUNT(*)::TEXT
    FROM discharge_facilities 
    WHERE business_name IS NULL;
    
    RETURN QUERY
    SELECT 
        'prevention_facilities_business_name'::TEXT,
        CASE WHEN COUNT(*) = 0 THEN 'PASS' ELSE 'FAIL' END::TEXT,
        'Rows missing business_name: ' || COUNT(*)::TEXT
    FROM prevention_facilities 
    WHERE business_name IS NULL;
    
    -- Check 2: All facilities have outlet references
    RETURN QUERY
    SELECT 
        'discharge_facilities_outlet_refs'::TEXT,
        CASE WHEN COUNT(*) = 0 THEN 'PASS' ELSE 'FAIL' END::TEXT,
        'Rows missing outlet_id: ' || COUNT(*)::TEXT
    FROM discharge_facilities 
    WHERE outlet_id IS NULL AND business_name IS NOT NULL;
    
    -- Check 3: Business continuity
    RETURN QUERY
    SELECT 
        'business_continuity'::TEXT,
        CASE WHEN COUNT(DISTINCT business_name) = (SELECT COUNT(*) FROM business_info WHERE is_active = true) 
             THEN 'PASS' ELSE 'WARN' END::TEXT,
        'Unique businesses in facilities: ' || COUNT(DISTINCT business_name)::TEXT || 
        ', Business_info records: ' || (SELECT COUNT(*)::TEXT FROM business_info WHERE is_active = true)
    FROM (
        SELECT business_name FROM discharge_facilities WHERE business_name IS NOT NULL
        UNION
        SELECT business_name FROM prevention_facilities WHERE business_name IS NOT NULL
    ) all_businesses;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- PHASE 9: COMPATIBILITY FUNCTIONS
-- =====================================================

-- 9.1: Function to safely insert facilities using legacy format
CREATE OR REPLACE FUNCTION insert_legacy_discharge_facility(
    p_business_name TEXT,
    p_outlet_number INTEGER,
    p_facility_number INTEGER,
    p_facility_name TEXT,
    p_capacity TEXT DEFAULT NULL,
    p_quantity INTEGER DEFAULT 1,
    p_notes TEXT DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
    business_id_val UUID;
    air_permit_id_val UUID;
    outlet_id_val UUID;
    facility_id_val UUID;
BEGIN
    -- Find or create business
    SELECT id INTO business_id_val FROM business_info WHERE business_name = p_business_name;
    
    IF business_id_val IS NULL THEN
        INSERT INTO business_info (business_name) VALUES (p_business_name) RETURNING id INTO business_id_val;
    END IF;
    
    -- Find or create air permit
    SELECT id INTO air_permit_id_val FROM air_permit_info WHERE business_id = business_id_val LIMIT 1;
    
    IF air_permit_id_val IS NULL THEN
        INSERT INTO air_permit_info (business_id, business_type) 
        VALUES (business_id_val, '기타') 
        RETURNING id INTO air_permit_id_val;
    END IF;
    
    -- Find or create outlet
    SELECT id INTO outlet_id_val 
    FROM discharge_outlets 
    WHERE air_permit_id = air_permit_id_val AND outlet_number = p_outlet_number;
    
    IF outlet_id_val IS NULL THEN
        INSERT INTO discharge_outlets (air_permit_id, outlet_number, outlet_name)
        VALUES (air_permit_id_val, p_outlet_number, CONCAT('배출구 ', p_outlet_number))
        RETURNING id INTO outlet_id_val;
    END IF;
    
    -- Insert facility with both normalized and legacy fields
    INSERT INTO discharge_facilities (
        outlet_id, facility_name, capacity, quantity,
        business_name, outlet_number, facility_number,
        additional_info
    ) VALUES (
        outlet_id_val, p_facility_name, p_capacity, p_quantity,
        p_business_name, p_outlet_number, p_facility_number,
        CASE WHEN p_notes IS NOT NULL THEN jsonb_build_object('notes', p_notes) ELSE '{}' END
    ) RETURNING id INTO facility_id_val;
    
    RETURN facility_id_val;
END;
$$ LANGUAGE plpgsql;

-- 9.2: Similar function for prevention facilities
CREATE OR REPLACE FUNCTION insert_legacy_prevention_facility(
    p_business_name TEXT,
    p_outlet_number INTEGER,
    p_facility_number INTEGER,
    p_facility_name TEXT,
    p_capacity TEXT DEFAULT NULL,
    p_quantity INTEGER DEFAULT 1,
    p_notes TEXT DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
    business_id_val UUID;
    air_permit_id_val UUID;
    outlet_id_val UUID;
    facility_id_val UUID;
BEGIN
    -- Find or create business
    SELECT id INTO business_id_val FROM business_info WHERE business_name = p_business_name;
    
    IF business_id_val IS NULL THEN
        INSERT INTO business_info (business_name) VALUES (p_business_name) RETURNING id INTO business_id_val;
    END IF;
    
    -- Find or create air permit
    SELECT id INTO air_permit_id_val FROM air_permit_info WHERE business_id = business_id_val LIMIT 1;
    
    IF air_permit_id_val IS NULL THEN
        INSERT INTO air_permit_info (business_id, business_type) 
        VALUES (business_id_val, '기타') 
        RETURNING id INTO air_permit_id_val;
    END IF;
    
    -- Find or create outlet
    SELECT id INTO outlet_id_val 
    FROM discharge_outlets 
    WHERE air_permit_id = air_permit_id_val AND outlet_number = p_outlet_number;
    
    IF outlet_id_val IS NULL THEN
        INSERT INTO discharge_outlets (air_permit_id, outlet_number, outlet_name)
        VALUES (air_permit_id_val, p_outlet_number, CONCAT('배출구 ', p_outlet_number))
        RETURNING id INTO outlet_id_val;
    END IF;
    
    -- Insert facility
    INSERT INTO prevention_facilities (
        outlet_id, facility_name, capacity, quantity,
        business_name, outlet_number, facility_number,
        additional_info
    ) VALUES (
        outlet_id_val, p_facility_name, p_capacity, p_quantity,
        p_business_name, p_outlet_number, p_facility_number,
        CASE WHEN p_notes IS NOT NULL THEN jsonb_build_object('notes', p_notes) ELSE '{}' END
    ) RETURNING id INTO facility_id_val;
    
    RETURN facility_id_val;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- PHASE 10: MIGRATION EXECUTION SCRIPT
-- =====================================================

-- 10.1: Execute the migration
DO $$
DECLARE
    rec RECORD;
    migration_summary TEXT := '';
BEGIN
    RAISE NOTICE 'Starting facility data migration...';
    
    -- Migrate existing flat discharge facility data
    FOR rec IN 
        SELECT * FROM migration_backup_discharge_facilities 
        WHERE business_name IS NOT NULL
    LOOP
        PERFORM insert_legacy_discharge_facility(
            rec.business_name,
            COALESCE(rec.outlet_number, 1),
            COALESCE(rec.facility_number, 1), 
            rec.facility_name,
            rec.capacity,
            COALESCE(rec.quantity, 1),
            rec.notes
        );
    END LOOP;
    
    -- Migrate existing flat prevention facility data
    FOR rec IN 
        SELECT * FROM migration_backup_prevention_facilities
        WHERE business_name IS NOT NULL  
    LOOP
        PERFORM insert_legacy_prevention_facility(
            rec.business_name,
            COALESCE(rec.outlet_number, 1),
            COALESCE(rec.facility_number, 1),
            rec.facility_name, 
            rec.capacity,
            COALESCE(rec.quantity, 1),
            rec.notes
        );
    END LOOP;
    
    RAISE NOTICE 'Migration completed successfully';
END $$;

-- =====================================================
-- PHASE 11: POST-MIGRATION VALIDATION
-- =====================================================

-- Run validation
SELECT * FROM validate_migration_integrity();

-- Show migration summary
SELECT 
    'Migration Summary' as report_type,
    (SELECT COUNT(*) FROM business_info) as total_businesses,
    (SELECT COUNT(*) FROM air_permit_info) as total_permits,
    (SELECT COUNT(*) FROM discharge_outlets) as total_outlets,
    (SELECT COUNT(*) FROM discharge_facilities) as total_discharge_facilities,
    (SELECT COUNT(*) FROM prevention_facilities) as total_prevention_facilities;

COMMENT ON DATABASE postgres IS 'Unified Extensible Facility Management System - Migration completed';