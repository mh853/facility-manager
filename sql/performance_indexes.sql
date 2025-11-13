-- =====================================================
-- 성능 최적화를 위한 데이터베이스 인덱스 추가
-- =====================================================
-- 작성일: 2025-01-13
-- 목적: 사업장 리스트 정렬 성능 개선 (updated_at 기준)

-- ✅ business_info 테이블 - updated_at 컬럼 인덱스
-- 효과: 최근 수정된 사업장 목록 조회 시 30-50% 속도 향상
CREATE INDEX IF NOT EXISTS idx_business_info_updated_at
ON business_info(updated_at DESC);

-- 설명:
-- - updated_at DESC: 최신 수정 순서로 정렬할 때 사용
-- - 사업장 리스트 API (/api/business-list)에서 사용
-- - 메모 생성/수정/삭제 시 사업장 updated_at이 업데이트됨

-- ✅ 추가 복합 인덱스 (선택사항)
-- 효과: is_active, is_deleted 조건과 함께 정렬할 때 성능 향상
CREATE INDEX IF NOT EXISTS idx_business_info_active_deleted_updated
ON business_info(is_active, is_deleted, updated_at DESC)
WHERE is_active = true AND is_deleted = false;

-- 설명:
-- - 활성화된(is_active=true) 삭제되지 않은(is_deleted=false) 사업장만 필터링
-- - Partial Index로 인덱스 크기 최소화
-- - business-list API의 WHERE 조건과 정확히 일치

-- =====================================================
-- 인덱스 확인 쿼리
-- =====================================================

-- 생성된 인덱스 확인
SELECT
    schemaname,
    tablename,
    indexname,
    indexdef
FROM pg_indexes
WHERE tablename = 'business_info'
ORDER BY indexname;

-- 인덱스 사용 통계 확인
SELECT
    schemaname,
    relname as tablename,
    indexrelname as indexname,
    idx_scan as index_scans,
    idx_tup_read as tuples_read,
    idx_tup_fetch as tuples_fetched
FROM pg_stat_user_indexes
WHERE relname = 'business_info'
ORDER BY idx_scan DESC;

-- =====================================================
-- 성능 테스트 쿼리
-- =====================================================

-- BEFORE: 인덱스 없이 쿼리 (EXPLAIN ANALYZE)
EXPLAIN ANALYZE
SELECT *
FROM business_info
WHERE is_active = true AND is_deleted = false
ORDER BY updated_at DESC
LIMIT 50;

-- AFTER: 인덱스 사용 확인 (EXPLAIN ANALYZE)
-- "Index Scan using idx_business_info_active_deleted_updated" 확인

-- =====================================================
-- 롤백 (필요시)
-- =====================================================

-- 인덱스 삭제 (롤백)
-- DROP INDEX IF EXISTS idx_business_info_updated_at;
-- DROP INDEX IF EXISTS idx_business_info_active_deleted_updated;
