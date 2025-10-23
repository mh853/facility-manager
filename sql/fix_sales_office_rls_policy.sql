-- Fix: Add missing RLS policy for sales_office_cost_settings table
-- This allows users with permission level 2+ to read commission rates
-- Required for business detail modal revenue calculations

-- Drop existing policy if it exists (just in case)
DROP POLICY IF EXISTS "sales_office_cost_settings_select_policy" ON sales_office_cost_settings;

-- Create SELECT policy for sales_office_cost_settings
-- Allow permission level 2+ (same as revenue_view_policy)
CREATE POLICY "sales_office_cost_settings_select_policy" ON sales_office_cost_settings
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM employees
            WHERE employees.id = auth.uid()
            AND employees.permission_level >= 2
            AND employees.is_active = true
            AND employees.is_deleted = false
        )
    );

-- Optional: Add INSERT/UPDATE policies for permission level 3+
-- (for future use when implementing cost settings management UI)

DROP POLICY IF EXISTS "sales_office_cost_settings_insert_policy" ON sales_office_cost_settings;
CREATE POLICY "sales_office_cost_settings_insert_policy" ON sales_office_cost_settings
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM employees
            WHERE employees.id = auth.uid()
            AND employees.permission_level >= 3
            AND employees.is_active = true
            AND employees.is_deleted = false
        )
    );

DROP POLICY IF EXISTS "sales_office_cost_settings_update_policy" ON sales_office_cost_settings;
CREATE POLICY "sales_office_cost_settings_update_policy" ON sales_office_cost_settings
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM employees
            WHERE employees.id = auth.uid()
            AND employees.permission_level >= 3
            AND employees.is_active = true
            AND employees.is_deleted = false
        )
    );

-- Verify RLS is enabled (should already be from schema)
ALTER TABLE sales_office_cost_settings ENABLE ROW LEVEL SECURITY;

-- Query to verify policies are created
SELECT
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd,
    qual
FROM pg_policies
WHERE tablename = 'sales_office_cost_settings'
ORDER BY policyname;
