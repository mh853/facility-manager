-- Fix outlet_id NOT NULL constraint issue for facility import
-- This allows the import API to work with nullable outlet_id values

-- Make outlet_id nullable in discharge_facilities table
ALTER TABLE discharge_facilities ALTER COLUMN outlet_id DROP NOT NULL;

-- Make outlet_id nullable in prevention_facilities table  
ALTER TABLE prevention_facilities ALTER COLUMN outlet_id DROP NOT NULL;

-- Verify the changes
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name IN ('discharge_facilities', 'prevention_facilities') 
AND column_name = 'outlet_id';