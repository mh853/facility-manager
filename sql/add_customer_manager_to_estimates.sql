-- sql/add_customer_manager_to_estimates.sql
-- Add customer_manager and customer_manager_contact columns to estimate_history

ALTER TABLE estimate_history
ADD COLUMN IF NOT EXISTS customer_manager TEXT,
ADD COLUMN IF NOT EXISTS customer_manager_contact TEXT;

COMMENT ON COLUMN estimate_history.customer_manager IS '고객 담당자 이름';
COMMENT ON COLUMN estimate_history.customer_manager_contact IS '고객 담당자 연락처';

-- Verify columns were added
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'estimate_history'
  AND column_name IN ('customer_manager', 'customer_manager_contact')
ORDER BY column_name;
