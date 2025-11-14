-- ============================================================================
-- Air Permit 페이지 성능 최적화를 위한 인덱스 생성
-- ============================================================================
-- 목적: Air Permit 리스트 페이지의 쿼리 성능 향상
-- 적용 대상: air_permit_info 테이블
-- 예상 효과: 쿼리 응답 시간 30-50% 개선
-- ============================================================================

-- 1. business_id 기반 조회 최적화 (가장 중요)
-- 용도: WHERE business_id = ? AND is_active = true AND is_deleted = false
-- 빈도: 매우 높음 (사업장별 대기필증 조회 시마다 실행)
CREATE INDEX IF NOT EXISTS idx_air_permit_business_active
  ON air_permit_info(business_id, is_active, is_deleted)
  WHERE is_active = true AND is_deleted = false;

-- 2. 전체 대기필증 조회 최적화 (created_at 정렬)
-- 용도: ORDER BY created_at DESC WHERE is_active = true AND is_deleted = false
-- 빈도: 높음 (페이지 초기 로드 시)
CREATE INDEX IF NOT EXISTS idx_air_permit_active_created
  ON air_permit_info(is_active, is_deleted, created_at DESC)
  WHERE is_active = true AND is_deleted = false;

-- 3. 복합 조회 최적화 (business_id + created_at)
-- 용도: 사업장별 대기필증을 최신순으로 조회
-- 빈도: 중간 (상세 페이지 진입 시)
CREATE INDEX IF NOT EXISTS idx_air_permit_business_created
  ON air_permit_info(business_id, created_at DESC)
  WHERE is_active = true AND is_deleted = false;

-- ============================================================================
-- 인덱스 효과 검증 쿼리
-- ============================================================================

-- 검증 1: 생성된 인덱스 목록 확인
SELECT
  schemaname,
  tablename,
  indexname,
  indexdef
FROM pg_indexes
WHERE tablename = 'air_permit_info'
ORDER BY indexname;

-- 검증 2: 인덱스 사용 통계 확인 (일정 시간 후 실행)
SELECT
  schemaname,
  tablename,
  indexname,
  idx_scan as index_scans,
  idx_tup_read as tuples_read,
  idx_tup_fetch as tuples_fetched
FROM pg_stat_user_indexes
WHERE tablename = 'air_permit_info'
ORDER BY idx_scan DESC;

-- 검증 3: 쿼리 실행 계획 확인 (인덱스 사용 여부)
EXPLAIN ANALYZE
SELECT
  id,
  business_id,
  permit_number,
  permit_date,
  permit_classification,
  created_at,
  updated_at,
  is_active,
  is_deleted
FROM air_permit_info
WHERE is_active = true
  AND is_deleted = false
ORDER BY created_at DESC;

-- ============================================================================
-- 롤백 스크립트 (문제 발생 시)
-- ============================================================================
-- DROP INDEX IF EXISTS idx_air_permit_business_active;
-- DROP INDEX IF EXISTS idx_air_permit_active_created;
-- DROP INDEX IF EXISTS idx_air_permit_business_created;

-- ============================================================================
-- 성능 모니터링 (배포 후 확인)
-- ============================================================================

-- 모니터링 1: 테이블 크기 및 인덱스 크기 확인
SELECT
  pg_size_pretty(pg_total_relation_size('air_permit_info')) as total_size,
  pg_size_pretty(pg_relation_size('air_permit_info')) as table_size,
  pg_size_pretty(pg_total_relation_size('air_permit_info') - pg_relation_size('air_permit_info')) as indexes_size;

-- 모니터링 2: 인덱스 히트율 확인 (95% 이상이 이상적)
SELECT
  schemaname,
  tablename,
  ROUND(100.0 * idx_scan / (seq_scan + idx_scan), 2) AS index_hit_rate_percent,
  idx_scan as index_scans,
  seq_scan as sequential_scans
FROM pg_stat_user_tables
WHERE tablename = 'air_permit_info'
  AND (seq_scan + idx_scan) > 0;

-- ============================================================================
-- 사용 가이드
-- ============================================================================
--
-- 1. Supabase Dashboard에서 실행:
--    - SQL Editor에서 이 파일 내용 복사
--    - "Run" 버튼 클릭하여 인덱스 생성
--
-- 2. 인덱스 생성 확인:
--    - 검증 1 쿼리 실행하여 3개 인덱스 확인
--
-- 3. 성능 모니터링:
--    - 배포 후 24시간 뒤 검증 2, 모니터링 쿼리 실행
--    - index_hit_rate_percent가 95% 이상인지 확인
--
-- 4. 문제 발생 시:
--    - 롤백 스크립트 주석 해제 후 실행
--
-- ============================================================================
