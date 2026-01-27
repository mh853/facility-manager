-- Migration: Add manual subsidy upload support
-- Description: Adds is_manual and created_by fields to subsidy_announcements table
-- Date: 2026-01-27

-- Add new columns
ALTER TABLE subsidy_announcements
ADD COLUMN IF NOT EXISTS is_manual BOOLEAN DEFAULT false NOT NULL,
ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES public.employees(id);

-- Add comment for documentation
COMMENT ON COLUMN subsidy_announcements.is_manual IS 'True if manually registered by admin, false if crawled automatically';
COMMENT ON COLUMN subsidy_announcements.created_by IS 'User ID of admin who created this announcement (null for crawled)';

-- Create index for filtering by is_manual
CREATE INDEX IF NOT EXISTS idx_announcements_is_manual
ON subsidy_announcements(is_manual);

-- Create index for filtering by creator
CREATE INDEX IF NOT EXISTS idx_announcements_created_by
ON subsidy_announcements(created_by);

-- RLS Policy: Allow all authenticated users (permission_level >= 1) to insert manual announcements
-- Drop existing policy if it exists, then create
DROP POLICY IF EXISTS "Allow manual insert for admin users" ON subsidy_announcements;
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

-- RLS Policy: Allow creators to update their own manual announcements
DROP POLICY IF EXISTS "Allow creators to update their manual announcements" ON subsidy_announcements;
CREATE POLICY "Allow creators to update their manual announcements"
ON subsidy_announcements
FOR UPDATE
TO authenticated
USING (
  is_manual = true
  AND created_by::text = auth.uid()::text
)
WITH CHECK (
  is_manual = true
  AND created_by::text = auth.uid()::text
);

-- RLS Policy: Allow creators to delete their own manual announcements
DROP POLICY IF EXISTS "Allow creators to delete their manual announcements" ON subsidy_announcements;
CREATE POLICY "Allow creators to delete their manual announcements"
ON subsidy_announcements
FOR DELETE
TO authenticated
USING (
  is_manual = true
  AND created_by::text = auth.uid()::text
);

-- Update existing rows to have is_manual = false (already default, but explicit for clarity)
UPDATE subsidy_announcements
SET is_manual = false
WHERE is_manual IS NULL;
