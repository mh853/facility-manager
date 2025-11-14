-- ============================================================================
-- Air Permit 인덱스 생성 (간소화 버전 - Supabase 안전)
-- ============================================================================
-- 이 파일은 Supabase에서 안전하게 실행 가능한 최소 버전입니다.
-- 인덱스 생성만 수행하며, 시스템 뷰 접근 권한이 필요 없습니다.
-- ============================================================================

-- 인덱스 생성
-- 1. business_id 기반 조회 최적화
CREATE INDEX IF NOT EXISTS idx_air_permit_business_active
  ON air_permit_info(business_id, is_active, is_deleted)
  WHERE is_active = true AND is_deleted = false;

-- 2. 전체 대기필증 조회 최적화 (created_at 정렬)
CREATE INDEX IF NOT EXISTS idx_air_permit_active_created
  ON air_permit_info(is_active, is_deleted, created_at DESC)
  WHERE is_active = true AND is_deleted = false;

-- 3. 복합 조회 최적화 (business_id + created_at)
CREATE INDEX IF NOT EXISTS idx_air_permit_business_created
  ON air_permit_info(business_id, created_at DESC)
  WHERE is_active = true AND is_deleted = false;

-- 인덱스 생성 확인 (이 쿼리는 항상 작동)
SELECT
  schemaname,
  tablename,
  indexname,
  indexdef
FROM pg_indexes
WHERE tablename = 'air_permit_info'
  AND indexname LIKE 'idx_air_permit%'
ORDER BY indexname;

-- ============================================================================
-- 사용법
-- ============================================================================
-- 1. Supabase Dashboard → SQL Editor
-- 2. 이 파일 내용 전체 복사
-- 3. "Run" 버튼 클릭
-- 4. 마지막 SELECT 쿼리 결과에서 3개 인덱스 확인
--    - idx_air_permit_business_active
--    - idx_air_permit_active_created
--    - idx_air_permit_business_created
-- ============================================================================

-- 롤백 (필요시)
-- DROP INDEX IF EXISTS idx_air_permit_business_active;
-- DROP INDEX IF EXISTS idx_air_permit_active_created;
-- DROP INDEX IF EXISTS idx_air_permit_business_created;
-- ============================================================================
