-- Verify Manual Subsidy Policies
-- Check current RLS policies for subsidy_announcements table

-- 1. Check all policies on subsidy_announcements table
SELECT
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd,
    qual,
    with_check
FROM pg_policies
WHERE tablename = 'subsidy_announcements'
ORDER BY policyname;

-- 2. Check if is_manual and created_by columns exist
SELECT
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_name = 'subsidy_announcements'
    AND column_name IN ('is_manual', 'created_by')
ORDER BY column_name;

-- 3. Check foreign key constraint
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
