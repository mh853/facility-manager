-- Sequential Facility Numbering Migration
-- This script adds sequential numbering fields and calculates initial values

-- Step 1: Add sequential_number column to both facility tables
ALTER TABLE discharge_facilities 
ADD COLUMN IF NOT EXISTS sequential_number INTEGER;

ALTER TABLE prevention_facilities 
ADD COLUMN IF NOT EXISTS sequential_number INTEGER;

-- Step 2: Calculate and populate sequential numbers for discharge facilities
-- Sequential across ALL outlets: 배1, 배2, 배3...
WITH discharge_sequential AS (
  SELECT 
    id,
    ROW_NUMBER() OVER (
      ORDER BY outlet_number ASC, facility_number ASC
    ) as seq_num
  FROM discharge_facilities
  WHERE sequential_number IS NULL
)
UPDATE discharge_facilities 
SET sequential_number = discharge_sequential.seq_num
FROM discharge_sequential
WHERE discharge_facilities.id = discharge_sequential.id;

-- Step 3: Calculate and populate sequential numbers for prevention facilities  
-- Sequential across ALL outlets: 방1, 방2, 방3...
WITH prevention_sequential AS (
  SELECT 
    id,
    ROW_NUMBER() OVER (
      ORDER BY outlet_number ASC, facility_number ASC
    ) as seq_num
  FROM prevention_facilities
  WHERE sequential_number IS NULL
)
UPDATE prevention_facilities 
SET sequential_number = prevention_sequential.seq_num
FROM prevention_sequential
WHERE prevention_facilities.id = prevention_sequential.id;

-- Step 4: Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_discharge_facilities_sequential 
ON discharge_facilities(sequential_number);

CREATE INDEX IF NOT EXISTS idx_prevention_facilities_sequential 
ON prevention_facilities(sequential_number);

-- Step 5: Add constraints to ensure uniqueness within facility type
ALTER TABLE discharge_facilities 
ADD CONSTRAINT IF NOT EXISTS unique_discharge_sequential 
UNIQUE (sequential_number);

ALTER TABLE prevention_facilities 
ADD CONSTRAINT IF NOT EXISTS unique_prevention_sequential 
UNIQUE (sequential_number);