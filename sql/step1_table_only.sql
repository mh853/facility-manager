-- =====================================================
-- STEP 1: 테이블만 생성 (테스트용)
-- =====================================================

DROP TABLE IF EXISTS crawl_logs CASCADE;

CREATE TABLE crawl_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  crawl_type VARCHAR(20) NOT NULL CHECK (crawl_type IN ('auto', 'direct')),
  started_at TIMESTAMP NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMP,
  total_urls INTEGER DEFAULT 0,
  successful_urls INTEGER DEFAULT 0,
  failed_urls INTEGER DEFAULT 0,
  new_announcements INTEGER DEFAULT 0,
  relevant_announcements INTEGER DEFAULT 0,
  errors JSONB DEFAULT '[]'::JSONB,
  workflow_run_id VARCHAR(100),
  workflow_job_id VARCHAR(100),
  created_at TIMESTAMP DEFAULT NOW()
);

-- 인덱스 생성
CREATE INDEX idx_crawl_logs_type ON crawl_logs(crawl_type);
CREATE INDEX idx_crawl_logs_started_at ON crawl_logs(started_at DESC);

-- 테이블 생성 확인
SELECT 'crawl_logs 테이블 생성 완료' as status;
SELECT * FROM crawl_logs LIMIT 1;
