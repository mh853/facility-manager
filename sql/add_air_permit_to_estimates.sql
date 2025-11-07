-- sql/add_air_permit_to_estimates.sql
-- Add air_permit column to estimate_history table

-- Add air_permit column to store permit data as JSONB
ALTER TABLE estimate_history
ADD COLUMN IF NOT EXISTS air_permit JSONB DEFAULT NULL;

-- Add index for air_permit queries
CREATE INDEX IF NOT EXISTS idx_estimate_history_air_permit
ON estimate_history USING gin(air_permit)
WHERE air_permit IS NOT NULL;

-- Update comment
COMMENT ON COLUMN estimate_history.air_permit IS '대기배출시설 허가증 정보 (JSONB): business_type, category, first_report_date, operation_start_date, emission_facilities, prevention_facilities';

-- Verify the column was added
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'estimate_history'
  AND column_name = 'air_permit';
