-- Add revenue_source column to business_info table
-- Migration: add_revenue_source_to_business_info
-- Created: 2025-11-07
-- Description: 블루온이 계산서를 발행하는 사업체(매출처) 정보를 저장하기 위한 컬럼 추가

-- Add revenue_source column
ALTER TABLE business_info
ADD COLUMN IF NOT EXISTS revenue_source TEXT;

-- Add comment for documentation
COMMENT ON COLUMN business_info.revenue_source IS '매출처 (블루온이 계산서를 발행하는 사업체)';

-- Create index for faster queries (optional, if needed for filtering/searching)
CREATE INDEX IF NOT EXISTS idx_business_info_revenue_source
ON business_info(revenue_source)
WHERE revenue_source IS NOT NULL;

-- Verify the column was added
DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_name = 'business_info'
        AND column_name = 'revenue_source'
    ) THEN
        RAISE NOTICE '✅ revenue_source column added successfully';
    ELSE
        RAISE EXCEPTION '❌ Failed to add revenue_source column';
    END IF;
END $$;
