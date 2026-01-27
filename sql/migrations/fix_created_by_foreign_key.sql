-- Fix created_by Foreign Key Constraint
-- Description: Change foreign key from users table to employees table
-- Date: 2026-01-27
-- Reason: Project uses employees table, not users table

-- 1. Drop the incorrect foreign key constraint
ALTER TABLE subsidy_announcements
DROP CONSTRAINT IF EXISTS subsidy_announcements_created_by_fkey;

-- 2. Add the correct foreign key constraint pointing to employees table
ALTER TABLE subsidy_announcements
ADD CONSTRAINT subsidy_announcements_created_by_fkey
FOREIGN KEY (created_by)
REFERENCES public.employees(id)
ON DELETE SET NULL;

-- 3. Verify the fix
SELECT
    tc.constraint_name,
    tc.table_name,
    kcu.column_name,
    ccu.table_name AS foreign_table_name,
    ccu.column_name AS foreign_column_name
FROM information_schema.table_constraints AS tc
JOIN information_schema.key_column_usage AS kcu
    ON tc.constraint_name = kcu.constraint_name
JOIN information_schema.constraint_column_usage AS ccu
    ON ccu.constraint_name = tc.constraint_name
WHERE tc.table_name = 'subsidy_announcements'
    AND tc.constraint_type = 'FOREIGN KEY'
    AND kcu.column_name = 'created_by';
