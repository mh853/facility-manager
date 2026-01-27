-- Verify Database Table Structures
-- Run this in Supabase SQL Editor to check actual column names and types

-- 1. Check employees table structure
SELECT
    column_name,
    data_type,
    is_nullable,
    column_default,
    character_maximum_length
FROM information_schema.columns
WHERE table_schema = 'public'
    AND table_name = 'employees'
ORDER BY ordinal_position;

-- 2. Check if permission_level column exists in employees
SELECT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
        AND table_name = 'employees'
        AND column_name = 'permission_level'
) AS permission_level_exists;

-- 3. Check if role column exists in employees
SELECT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
        AND table_name = 'employees'
        AND column_name = 'role'
) AS role_exists;

-- 4. Check subsidy_announcements table structure
SELECT
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_schema = 'public'
    AND table_name = 'subsidy_announcements'
ORDER BY ordinal_position;

-- 5. Check if is_manual and created_by columns exist
SELECT
    column_name,
    EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
            AND table_name = 'subsidy_announcements'
            AND column_name = 'is_manual'
    ) AS is_manual_exists,
    EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
            AND table_name = 'subsidy_announcements'
            AND column_name = 'created_by'
    ) AS created_by_exists;

-- 6. Check foreign key constraints on subsidy_announcements
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
    AND tc.constraint_type = 'FOREIGN KEY';

-- 7. Check RLS policies on subsidy_announcements
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

-- 8. Check sample employee data (permission levels)
SELECT
    id,
    name,
    email,
    permission_level,
    is_active
FROM public.employees
WHERE is_active = true
ORDER BY permission_level DESC
LIMIT 5;

-- 9. Check auth.uid() function availability
SELECT current_setting('request.jwt.claims', true)::json->>'sub' AS auth_uid_test;
