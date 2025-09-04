-- Migration: Convert meter fields from BOOLEAN to INTEGER and add negotiation field
-- Created: 2025-09-03
-- Purpose: Support numeric meter counts instead of boolean presence

BEGIN;

-- Add negotiation column first
ALTER TABLE business_info 
ADD COLUMN IF NOT EXISTS negotiation VARCHAR(255);

-- Convert BOOLEAN meter fields to INTEGER (count-based)
-- Step 1: Add new INTEGER columns
ALTER TABLE business_info 
ADD COLUMN ph_meter_new INTEGER DEFAULT 0,
ADD COLUMN differential_pressure_meter_new INTEGER DEFAULT 0,
ADD COLUMN temperature_meter_new INTEGER DEFAULT 0,
ADD COLUMN discharge_current_meter INTEGER DEFAULT 0,
ADD COLUMN fan_current_meter INTEGER DEFAULT 0,
ADD COLUMN pump_current_meter INTEGER DEFAULT 0,
ADD COLUMN gateway_new INTEGER DEFAULT 0,
ADD COLUMN vpn_wired_new INTEGER DEFAULT 0,
ADD COLUMN vpn_wireless_new INTEGER DEFAULT 0,
ADD COLUMN multiple_stack_new INTEGER DEFAULT 0;

-- Step 2: Migrate data (convert true/false and strings to integers)
UPDATE business_info SET 
  ph_meter_new = CASE WHEN ph_meter = true THEN 1 ELSE 0 END,
  differential_pressure_meter_new = CASE WHEN differential_pressure_meter = true THEN 1 ELSE 0 END,
  temperature_meter_new = CASE WHEN temperature_meter = true THEN 1 ELSE 0 END,
  gateway_new = CASE 
    WHEN gateway IS NOT NULL AND gateway != '' THEN COALESCE(CAST(gateway AS INTEGER), 1)
    ELSE 0 
  END,
  vpn_wired_new = CASE 
    WHEN vpn_wired = true THEN 1 
    WHEN vpn_wired IS NOT NULL THEN COALESCE(CAST(vpn_wired AS INTEGER), 0)
    ELSE 0 
  END,
  vpn_wireless_new = CASE 
    WHEN vpn_wireless = true THEN 1
    WHEN vpn_wireless IS NOT NULL THEN COALESCE(CAST(vpn_wireless AS INTEGER), 0)
    ELSE 0 
  END,
  multiple_stack_new = CASE 
    WHEN multiple_stack = true THEN 1
    WHEN multiple_stack IS NOT NULL THEN COALESCE(CAST(multiple_stack AS INTEGER), 0)
    ELSE 0 
  END;

-- Step 3: Drop old columns and rename new ones
ALTER TABLE business_info 
DROP COLUMN ph_meter,
DROP COLUMN differential_pressure_meter,
DROP COLUMN temperature_meter,
DROP COLUMN gateway,
DROP COLUMN vpn_wired,
DROP COLUMN vpn_wireless,
DROP COLUMN multiple_stack;

-- Step 4: Rename new columns to original names
ALTER TABLE business_info 
RENAME COLUMN ph_meter_new TO ph_meter;

ALTER TABLE business_info 
RENAME COLUMN differential_pressure_meter_new TO differential_pressure_meter;

ALTER TABLE business_info 
RENAME COLUMN temperature_meter_new TO temperature_meter;

ALTER TABLE business_info 
RENAME COLUMN gateway_new TO gateway;

ALTER TABLE business_info 
RENAME COLUMN vpn_wired_new TO vpn_wired;

ALTER TABLE business_info 
RENAME COLUMN vpn_wireless_new TO vpn_wireless;

ALTER TABLE business_info 
RENAME COLUMN multiple_stack_new TO multiple_stack;

COMMIT;

-- Verify the changes
SELECT column_name, data_type, column_default 
FROM information_schema.columns 
WHERE table_name = 'business_info' 
  AND column_name IN ('ph_meter', 'differential_pressure_meter', 'temperature_meter', 
                      'gateway', 'vpn_wired', 'vpn_wireless', 'multiple_stack', 'negotiation')
ORDER BY column_name;