-- =====================================================
-- STEP 2: 뷰와 함수 생성 (STEP 1 실행 후)
-- =====================================================

-- 뷰 생성
CREATE OR REPLACE VIEW crawl_stats_recent AS
SELECT
  crawl_type,
  COUNT(*) as total_runs,
  SUM(successful_urls) as total_successful,
  SUM(failed_urls) as total_failed,
  ROUND(AVG(successful_urls::NUMERIC / NULLIF(total_urls, 0) * 100), 2) as avg_success_rate,
  ROUND(AVG(EXTRACT(EPOCH FROM (completed_at - started_at)))) as avg_duration_seconds,
  SUM(new_announcements) as total_new_announcements,
  SUM(relevant_announcements) as total_relevant_announcements
FROM crawl_logs
WHERE started_at >= NOW() - INTERVAL '7 days'
  AND completed_at IS NOT NULL
GROUP BY crawl_type;

-- 함수 생성
CREATE OR REPLACE FUNCTION get_running_crawls()
RETURNS TABLE (
  id UUID,
  crawl_type VARCHAR,
  started_at TIMESTAMP,
  elapsed_seconds INTEGER
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    cl.id,
    cl.crawl_type,
    cl.started_at,
    EXTRACT(EPOCH FROM (NOW() - cl.started_at))::INTEGER as elapsed_seconds
  FROM crawl_logs cl
  WHERE cl.completed_at IS NULL
  ORDER BY cl.started_at DESC;
END;
$$ LANGUAGE plpgsql;

-- RLS 설정
ALTER TABLE crawl_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access" ON crawl_logs
  FOR ALL TO service_role
  USING (true) WITH CHECK (true);

CREATE POLICY "Public read access" ON crawl_logs
  FOR SELECT TO anon, authenticated
  USING (true);

-- 권한 부여
GRANT ALL ON crawl_logs TO service_role;
GRANT SELECT ON crawl_logs TO anon, authenticated;
GRANT SELECT ON crawl_stats_recent TO anon, authenticated;

-- 검증
SELECT 'crawl_stats_recent 뷰 생성 완료' as status;
SELECT * FROM crawl_stats_recent;
