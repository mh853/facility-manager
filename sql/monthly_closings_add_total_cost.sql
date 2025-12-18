-- Add total_cost column to monthly_closings table
-- This column stores the aggregated purchase cost (매입금액) from revenue_calculations

ALTER TABLE monthly_closings
ADD COLUMN IF NOT EXISTS total_cost NUMERIC(12,2) NOT NULL DEFAULT 0;

-- Add comment for documentation
COMMENT ON COLUMN monthly_closings.total_cost IS '총 매입금액 (원가): revenue_calculations.total_cost의 합계';
