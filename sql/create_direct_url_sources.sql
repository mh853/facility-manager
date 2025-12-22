-- =====================================================
-- 직접 URL 소스 관리 테이블 (direct_url_sources)
-- =====================================================
-- 목적: 211개 직접 URL 관리 및 실패 추적
-- 사용처: GitHub Actions Direct Crawler, URL 관리 UI
-- =====================================================

CREATE TABLE IF NOT EXISTS direct_url_sources (
  -- 기본 정보
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  url TEXT UNIQUE NOT NULL,

  -- URL 메타데이터 (CSV에서 가져옴)
  region_code VARCHAR(10),
  region_name VARCHAR(50),
  category VARCHAR(50),
  notes TEXT,

  -- 크롤링 상태
  last_crawled_at TIMESTAMP,
  last_success_at TIMESTAMP,
  consecutive_failures INTEGER DEFAULT 0,
  total_attempts INTEGER DEFAULT 0,
  total_successes INTEGER DEFAULT 0,

  -- 에러 정보
  last_error TEXT,
  error_count INTEGER DEFAULT 0,

  -- Circuit Breaker (연속 실패 시 비활성화)
  is_active BOOLEAN DEFAULT true,

  -- 생성 및 수정 시간
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- =====================================================
-- 인덱스
-- =====================================================

-- URL 중복 방지 (UNIQUE 제약)
CREATE UNIQUE INDEX idx_direct_url_sources_url ON direct_url_sources(url);

-- 활성 URL 필터링 (크롤링 대상 선택)
CREATE INDEX idx_direct_url_sources_active ON direct_url_sources(is_active)
WHERE is_active = true;

-- 지역 코드별 조회
CREATE INDEX idx_direct_url_sources_region ON direct_url_sources(region_code);

-- 카테고리별 조회
CREATE INDEX idx_direct_url_sources_category ON direct_url_sources(category);

-- 마지막 크롤링 시간 조회 (오래된 URL 우선 크롤링)
CREATE INDEX idx_direct_url_sources_last_crawled ON direct_url_sources(last_crawled_at NULLS FIRST);

-- 연속 실패 추적 (재시도 대상 선택)
CREATE INDEX idx_direct_url_sources_failures ON direct_url_sources(consecutive_failures)
WHERE consecutive_failures > 0;

-- =====================================================
-- 트리거: updated_at 자동 갱신
-- =====================================================

CREATE OR REPLACE FUNCTION update_direct_url_sources_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_direct_url_sources_updated_at
  BEFORE UPDATE ON direct_url_sources
  FOR EACH ROW
  EXECUTE FUNCTION update_direct_url_sources_updated_at();

-- =====================================================
-- 뷰: 문제 URL 목록
-- =====================================================

CREATE OR REPLACE VIEW problem_urls AS
SELECT
  id,
  url,
  region_name,
  category,
  consecutive_failures,
  last_error,
  last_crawled_at,
  is_active,
  CASE
    WHEN consecutive_failures >= 5 THEN 'critical'
    WHEN consecutive_failures >= 3 THEN 'warning'
    ELSE 'normal'
  END as severity
FROM direct_url_sources
WHERE consecutive_failures > 0
ORDER BY consecutive_failures DESC, last_crawled_at DESC;

-- =====================================================
-- 뷰: 크롤링 통계 (지역별)
-- =====================================================

CREATE OR REPLACE VIEW crawl_stats_by_region AS
SELECT
  region_name,
  COUNT(*) as total_urls,
  SUM(CASE WHEN is_active THEN 1 ELSE 0 END) as active_urls,
  SUM(total_successes) as total_successes,
  SUM(error_count) as total_errors,
  ROUND(AVG(total_successes::NUMERIC / NULLIF(total_attempts, 0) * 100), 2) as avg_success_rate
FROM direct_url_sources
GROUP BY region_name
ORDER BY region_name;

-- =====================================================
-- 함수: 크롤링 성공 기록
-- =====================================================

CREATE OR REPLACE FUNCTION record_crawl_success(p_url TEXT)
RETURNS void AS $$
BEGIN
  UPDATE direct_url_sources
  SET
    last_crawled_at = NOW(),
    last_success_at = NOW(),
    consecutive_failures = 0,
    total_attempts = total_attempts + 1,
    total_successes = total_successes + 1,
    last_error = NULL
  WHERE url = p_url;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- 함수: 크롤링 실패 기록
-- =====================================================

CREATE OR REPLACE FUNCTION record_crawl_failure(p_url TEXT, p_error TEXT)
RETURNS void AS $$
DECLARE
  v_consecutive_failures INTEGER;
BEGIN
  UPDATE direct_url_sources
  SET
    last_crawled_at = NOW(),
    consecutive_failures = consecutive_failures + 1,
    total_attempts = total_attempts + 1,
    error_count = error_count + 1,
    last_error = p_error,
    -- 5회 연속 실패 시 비활성화 (Circuit Breaker)
    is_active = CASE WHEN consecutive_failures + 1 >= 5 THEN false ELSE true END
  WHERE url = p_url
  RETURNING consecutive_failures INTO v_consecutive_failures;

  -- 로그 출력 (디버깅용)
  RAISE NOTICE 'URL % failed % times: %', p_url, v_consecutive_failures, p_error;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- 함수: 비활성 URL 재활성화
-- =====================================================

CREATE OR REPLACE FUNCTION reactivate_url(p_url TEXT)
RETURNS void AS $$
BEGIN
  UPDATE direct_url_sources
  SET
    is_active = true,
    consecutive_failures = 0,
    error_count = 0,
    last_error = NULL
  WHERE url = p_url;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- 함수: 오래된 URL 가져오기 (크롤링 우선순위)
-- =====================================================

CREATE OR REPLACE FUNCTION get_urls_for_crawling(p_limit INTEGER DEFAULT 10)
RETURNS TABLE (
  id UUID,
  url TEXT,
  region_name VARCHAR,
  category VARCHAR
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    dus.id,
    dus.url,
    dus.region_name,
    dus.category
  FROM direct_url_sources dus
  WHERE dus.is_active = true
  ORDER BY
    dus.last_crawled_at NULLS FIRST,
    dus.consecutive_failures ASC
  LIMIT p_limit;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- CSV 데이터 임포트 함수
-- =====================================================

CREATE OR REPLACE FUNCTION import_urls_from_csv(
  p_csv_data JSONB
) RETURNS INTEGER AS $$
DECLARE
  v_row JSONB;
  v_count INTEGER := 0;
BEGIN
  FOR v_row IN SELECT * FROM jsonb_array_elements(p_csv_data)
  LOOP
    INSERT INTO direct_url_sources (url, region_code, region_name, category, notes)
    VALUES (
      v_row->>'url',
      v_row->>'region_code',
      v_row->>'region_name',
      v_row->>'category',
      v_row->>'notes'
    )
    ON CONFLICT (url) DO NOTHING;

    v_count := v_count + 1;
  END LOOP;

  RETURN v_count;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- 예시 데이터 (테스트용)
-- =====================================================

-- 주석 해제하여 테스트 데이터 삽입
-- INSERT INTO direct_url_sources (url, region_code, region_name, category, notes)
-- VALUES
--   ('https://www.seoul.go.kr', '11000', '서울특별시', 'IoT지원', '테스트 URL 1'),
--   ('https://www.busan.go.kr', '26000', '부산광역시', 'IoT지원', '테스트 URL 2'),
--   ('https://www.daegu.go.kr', '27000', '대구광역시', 'IoT지원', '테스트 URL 3');

-- =====================================================
-- 권한 설정
-- =====================================================

-- Service Role: 모든 권한
GRANT ALL ON direct_url_sources TO service_role;

-- Anon/Authenticated: 읽기만 가능
GRANT SELECT ON direct_url_sources TO anon, authenticated;
GRANT SELECT ON problem_urls TO anon, authenticated;
GRANT SELECT ON crawl_stats_by_region TO anon, authenticated;

-- =====================================================
-- Row Level Security (RLS)
-- =====================================================

ALTER TABLE direct_url_sources ENABLE ROW LEVEL SECURITY;

-- Service Role: 전체 접근
CREATE POLICY "Service role full access" ON direct_url_sources
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Anon/Authenticated: 읽기만 가능
CREATE POLICY "Public read access" ON direct_url_sources
  FOR SELECT
  TO anon, authenticated
  USING (true);

-- =====================================================
-- 완료
-- =====================================================
-- 실행 방법:
-- 1. Supabase Dashboard → SQL Editor
-- 2. 이 파일 내용 복사/붙여넣기
-- 3. "Run" 클릭
--
-- CSV 데이터 임포트 방법:
-- 1. CSV를 JSON으로 변환
-- 2. SELECT import_urls_from_csv('[{...}]'::JSONB);
-- =====================================================
