-- Update Manual Subsidy Permissions
-- Description: Change manual subsidy insert policy from permission_level >= 4 to permission_level >= 1
-- Date: 2026-01-27
-- Reason: Allow all authenticated users (not just super admins) to create manual announcements

-- Drop the old restrictive policy
DROP POLICY IF EXISTS "Allow manual insert for admin users" ON subsidy_announcements;

-- Create new policy allowing all authenticated users (permission_level >= 1)
CREATE POLICY "Allow manual insert for authenticated users"
ON subsidy_announcements
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.employees
    WHERE id::text = auth.uid()::text
    AND permission_level >= 1
  )
);

-- Verify the policy was created
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
FROM pg_policies
WHERE tablename = 'subsidy_announcements'
AND policyname = 'Allow manual insert for authenticated users';
