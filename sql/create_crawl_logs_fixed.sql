-- =====================================================
-- 크롤링 실행 로그 테이블 (crawl_logs) - 수정 버전
-- =====================================================
-- 목적: 모든 크롤링 실행 추적 및 성공률 모니터링
-- 사용처: GitHub Actions 워크플로우, 관리자 대시보드
-- 수정: GENERATED ALWAYS 제거 (Supabase 호환성)
-- =====================================================

-- 기존 테이블/뷰 삭제 (재실행 대비)
DROP VIEW IF EXISTS crawl_stats_recent CASCADE;
DROP FUNCTION IF EXISTS get_running_crawls() CASCADE;
DROP TABLE IF EXISTS crawl_logs CASCADE;

-- 테이블 생성
CREATE TABLE crawl_logs (
  -- 기본 정보
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  crawl_type VARCHAR(20) NOT NULL CHECK (crawl_type IN ('auto', 'direct')),

  -- 실행 시간 추적
  started_at TIMESTAMP NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMP,
  -- duration_seconds는 뷰에서 계산 (GENERATED 제거)

  -- 실행 결과
  total_urls INTEGER DEFAULT 0,
  successful_urls INTEGER DEFAULT 0,
  failed_urls INTEGER DEFAULT 0,
  new_announcements INTEGER DEFAULT 0,
  relevant_announcements INTEGER DEFAULT 0,

  -- 에러 정보
  errors JSONB DEFAULT '[]'::JSONB,
  -- 예시: [{"url": "https://...", "error": "timeout", "retry_count": 2}]

  -- GitHub Actions 메타데이터
  workflow_run_id VARCHAR(100),
  workflow_job_id VARCHAR(100),

  -- 생성 시간
  created_at TIMESTAMP DEFAULT NOW()
);

-- =====================================================
-- 인덱스
-- =====================================================

-- 크롤링 타입별 조회 (대시보드 필터링)
CREATE INDEX idx_crawl_logs_type ON crawl_logs(crawl_type);

-- 시간 범위 조회 (최근 7일 통계)
CREATE INDEX idx_crawl_logs_started_at ON crawl_logs(started_at DESC);

-- 완료 여부 조회 (진행 중인 작업 추적)
CREATE INDEX idx_crawl_logs_completed ON crawl_logs(completed_at)
WHERE completed_at IS NULL;

-- =====================================================
-- 뷰: 최근 크롤링 통계 (duration_seconds 계산 추가)
-- =====================================================

CREATE OR REPLACE VIEW crawl_stats_recent AS
SELECT
  crawl_type,
  COUNT(*) as total_runs,
  SUM(successful_urls) as total_successful,
  SUM(failed_urls) as total_failed,
  ROUND(AVG(successful_urls::NUMERIC / NULLIF(total_urls, 0) * 100), 2) as avg_success_rate,
  -- duration_seconds를 여기서 계산
  ROUND(AVG(EXTRACT(EPOCH FROM (completed_at - started_at)))) as avg_duration_seconds,
  SUM(new_announcements) as total_new_announcements,
  SUM(relevant_announcements) as total_relevant_announcements
FROM crawl_logs
WHERE started_at >= NOW() - INTERVAL '7 days'
  AND completed_at IS NOT NULL
GROUP BY crawl_type;

-- =====================================================
-- 뷰: 상세 크롤링 로그 (duration_seconds 포함)
-- =====================================================

CREATE OR REPLACE VIEW crawl_logs_detailed AS
SELECT
  id,
  crawl_type,
  started_at,
  completed_at,
  EXTRACT(EPOCH FROM (completed_at - started_at))::INTEGER as duration_seconds,
  total_urls,
  successful_urls,
  failed_urls,
  new_announcements,
  relevant_announcements,
  errors,
  workflow_run_id,
  workflow_job_id,
  created_at
FROM crawl_logs;

-- =====================================================
-- 함수: 실행 중인 크롤링 확인
-- =====================================================

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

-- =====================================================
-- 권한 설정
-- =====================================================

-- Service Role: 모든 권한
GRANT ALL ON crawl_logs TO service_role;

-- Anon/Authenticated: 읽기만 가능
GRANT SELECT ON crawl_logs TO anon, authenticated;
GRANT SELECT ON crawl_stats_recent TO anon, authenticated;
GRANT SELECT ON crawl_logs_detailed TO anon, authenticated;

-- =====================================================
-- Row Level Security (RLS)
-- =====================================================

ALTER TABLE crawl_logs ENABLE ROW LEVEL SECURITY;

-- Service Role: 전체 접근
CREATE POLICY "Service role full access" ON crawl_logs
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Anon/Authenticated: 읽기만 가능
CREATE POLICY "Public read access" ON crawl_logs
  FOR SELECT
  TO anon, authenticated
  USING (true);

-- =====================================================
-- 테스트 데이터 (선택 사항)
-- =====================================================

-- 주석 해제하여 테스트
-- INSERT INTO crawl_logs (crawl_type, started_at, completed_at, total_urls, successful_urls, failed_urls, new_announcements, relevant_announcements)
-- VALUES
--   ('auto', NOW() - INTERVAL '1 hour', NOW() - INTERVAL '55 minutes', 181, 125, 56, 15, 8),
--   ('direct', NOW() - INTERVAL '30 minutes', NOW() - INTERVAL '20 minutes', 10, 10, 0, 3, 2);

-- =====================================================
-- 검증 쿼리
-- =====================================================

-- 주석 해제하여 테스트
-- SELECT * FROM crawl_logs;
-- SELECT * FROM crawl_stats_recent;
-- SELECT * FROM crawl_logs_detailed;
-- SELECT * FROM get_running_crawls();

-- =====================================================
-- 완료
-- =====================================================
