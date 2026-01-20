-- Migration: Add crawl_run_id to subsidy_announcements table
-- Purpose: Link announcements back to their crawl runs for monitoring dashboard
-- Created: 2026-01-20

-- Add crawl_run_id column
ALTER TABLE subsidy_announcements
ADD COLUMN IF NOT EXISTS crawl_run_id TEXT;

-- Add foreign key constraint to crawl_runs
ALTER TABLE subsidy_announcements
ADD CONSTRAINT fk_crawl_run
FOREIGN KEY (crawl_run_id)
REFERENCES crawl_runs(run_id)
ON DELETE SET NULL;

-- Create index for faster queries by crawl_run_id
CREATE INDEX IF NOT EXISTS idx_announcements_crawl_run
ON subsidy_announcements(crawl_run_id);

-- Add comment
COMMENT ON COLUMN subsidy_announcements.crawl_run_id IS 'Reference to crawl_runs.run_id for tracking which crawl session discovered this announcement';
