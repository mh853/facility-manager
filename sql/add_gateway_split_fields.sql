-- Migration: Split gateway field into gateway_1_2 and gateway_3_4
-- Date: 2025-12-19
-- Purpose: Separate gateway field to support different purchase prices for Ecosense manufacturer
-- - gateway_1_2: 게이트웨이(1,2) - Ecosense purchase price: 1,000,000원
-- - gateway_3_4: 게이트웨이(3,4) - Ecosense purchase price: 1,420,000원
-- - Both have same sales price: 1,600,000원

-- Step 1: Add new columns to business_info table
ALTER TABLE business_info
ADD COLUMN IF NOT EXISTS gateway_1_2 INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS gateway_3_4 INTEGER DEFAULT 0;

-- Step 2: Add comments for documentation
COMMENT ON COLUMN business_info.gateway IS 'DEPRECATED: Use gateway_1_2 and gateway_3_4 instead';
COMMENT ON COLUMN business_info.gateway_1_2 IS '게이트웨이(1,2) 개수 - 에코센스 매입금액: 1,000,000원';
COMMENT ON COLUMN business_info.gateway_3_4 IS '게이트웨이(3,4) 개수 - 에코센스 매입금액: 1,420,000원';

-- Step 3: Data migration - migrate existing gateway values to gateway_1_2
-- ✅ gateway 컬럼이 VARCHAR 타입이므로 CAST 필요
UPDATE business_info
SET gateway_1_2 = CAST(gateway AS INTEGER)
WHERE gateway IS NOT NULL
  AND gateway != ''
  AND gateway ~ '^[0-9]+$'  -- 숫자 문자열만 처리
  AND CAST(gateway AS INTEGER) > 0
  AND gateway_1_2 = 0;

-- Step 4: Log migration results
DO $$
DECLARE
  migrated_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO migrated_count
  FROM business_info
  WHERE gateway IS NOT NULL
    AND gateway != ''
    AND gateway ~ '^[0-9]+$'
    AND gateway_1_2 > 0;

  RAISE NOTICE '✅ Migration completed: % businesses migrated from gateway to gateway_1_2', migrated_count;
END $$;

-- Step 4: Verify the migration
SELECT
    column_name,
    data_type,
    column_default,
    is_nullable
FROM information_schema.columns
WHERE table_name = 'business_info'
AND column_name IN ('gateway', 'gateway_1_2', 'gateway_3_4')
ORDER BY ordinal_position;
