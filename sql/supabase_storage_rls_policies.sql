-- Supabase Storage RLS (Row Level Security) Policies
-- For facility-files bucket
--
-- Run these policies in Supabase SQL Editor after creating the bucket

-- ============================================
-- 1. Storage Bucket Configuration
-- ============================================

-- Create the bucket (if not already exists)
INSERT INTO storage.buckets (id, name, public)
VALUES ('facility-files', 'facility-files', true)
ON CONFLICT (id) DO NOTHING;

-- ============================================
-- 2. Public Access Policies (READ)
-- ============================================

-- Allow public users to view/download all files
-- This enables public URL access for uploaded photos
CREATE POLICY "Allow public reads on facility-files"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'facility-files');

-- ============================================
-- 3. Authenticated Upload Policies (INSERT)
-- ============================================

-- Allow authenticated users to upload files
-- Browser uploads use NEXT_PUBLIC_SUPABASE_ANON_KEY
CREATE POLICY "Allow authenticated uploads to facility-files"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'facility-files');

-- Allow service role (server-side) uploads
-- Used by server-side API routes
CREATE POLICY "Allow service role uploads to facility-files"
ON storage.objects FOR INSERT
TO service_role
WITH CHECK (bucket_id = 'facility-files');

-- ============================================
-- 4. Authenticated Delete Policies (DELETE)
-- ============================================

-- Allow authenticated users to delete files
-- For future implementation of photo deletion feature
CREATE POLICY "Allow authenticated deletes from facility-files"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'facility-files');

-- Allow service role deletes
CREATE POLICY "Allow service role deletes from facility-files"
ON storage.objects FOR DELETE
TO service_role
USING (bucket_id = 'facility-files');

-- ============================================
-- 5. Update Policies (UPDATE)
-- ============================================

-- Allow authenticated users to update file metadata
CREATE POLICY "Allow authenticated updates on facility-files"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'facility-files')
WITH CHECK (bucket_id = 'facility-files');

-- ============================================
-- 6. Verification Queries
-- ============================================

-- Check bucket configuration
-- SELECT * FROM storage.buckets WHERE id = 'facility-files';

-- Check active policies
-- SELECT * FROM pg_policies WHERE tablename = 'objects' AND schemaname = 'storage';

-- Test upload permission (run as authenticated user)
-- Should return true if policies are correct:
-- SELECT has_table_privilege('storage.objects', 'INSERT');

-- ============================================
-- 7. Additional Security Notes
-- ============================================

-- Current Implementation:
-- - Public bucket (public = true) for easy photo access via public URLs
-- - All users can VIEW photos (required for business photo display)
-- - Only authenticated users can UPLOAD/DELETE (requires Supabase auth)
-- - Service role has full access (used by API routes)

-- Security Considerations:
-- - Browser uploads use anon key (limited to authenticated role)
-- - Server uploads use service role key (full access)
-- - RLS policies prevent unauthorized modifications
-- - Public read access is intentional for photo viewing

-- Future Improvements:
-- - Add row-level ownership checks (auth.uid() = owner_id)
-- - Implement business-specific access controls
-- - Add file size limits at policy level
-- - Consider private bucket with signed URLs for sensitive data
