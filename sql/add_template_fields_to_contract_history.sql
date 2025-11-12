-- Add template fields to contract_history table
-- Store template content at contract creation time so existing contracts are not affected when templates change

-- Add supplier information fields
ALTER TABLE contract_history
ADD COLUMN IF NOT EXISTS supplier_company_name TEXT,
ADD COLUMN IF NOT EXISTS supplier_representative TEXT,
ADD COLUMN IF NOT EXISTS supplier_address TEXT,
ADD COLUMN IF NOT EXISTS terms_and_conditions TEXT;

-- Set default values for existing records
UPDATE contract_history
SET
  supplier_company_name = COALESCE(supplier_company_name, 'BlueOn Co., Ltd.'),
  supplier_representative = COALESCE(supplier_representative, 'Kim Kyeong Soo'),
  supplier_address = COALESCE(supplier_address, 'Gyeongsangbuk-do Goryeong-gun Daegaya-eup Netjil-ro 285 (1661-5543)'),
  terms_and_conditions = COALESCE(terms_and_conditions, '')
WHERE supplier_company_name IS NULL
   OR supplier_representative IS NULL
   OR supplier_address IS NULL
   OR terms_and_conditions IS NULL;

-- Verification query
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'contract_history'
  AND column_name IN ('supplier_company_name', 'supplier_representative', 'supplier_address', 'terms_and_conditions')
ORDER BY column_name;
