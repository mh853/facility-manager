-- ============================================
-- Performance Optimization - Database Indexes
-- ============================================
-- 실행 시간: 약 5-10분 (데이터 양에 따라)
-- 실행 시점: 피크 시간대를 피해서 실행 (야간 또는 주말 권장)
-- 영향: 읽기 성능 향상, 쓰기 성능에 미세한 영향 (거의 없음)
-- ============================================

-- CONCURRENTLY 옵션: 테이블 잠금 없이 인덱스 생성
-- 백그라운드에서 실행되어 서비스 중단 없음

-- ============================================
-- 1. document_history 테이블 인덱스
-- ============================================

-- business_id 인덱스 (가장 자주 사용되는 필터)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_document_history_business_id
  ON document_history(business_id);

-- document_type 인덱스 (계약서/견적서/발주서 필터)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_document_history_document_type
  ON document_history(document_type);

-- created_at 인덱스 (최신순 정렬)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_document_history_created_at
  ON document_history(created_at DESC);

-- created_by 인덱스 (작성자별 조회)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_document_history_created_by
  ON document_history(created_by);

-- 복합 인덱스 (가장 자주 함께 사용되는 조합)
-- 예: 특정 사업장의 특정 문서 타입을 최신순으로 조회
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_document_history_composite
  ON document_history(business_id, document_type, created_at DESC);

-- ============================================
-- 2. contract_history 테이블 인덱스
-- ============================================

-- business_id 인덱스
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_contract_history_business_id
  ON contract_history(business_id);

-- created_at 인덱스
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_contract_history_created_at
  ON contract_history(created_at DESC);

-- contract_type 인덱스 (보조금/자비 구분)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_contract_history_contract_type
  ON contract_history(contract_type);

-- contract_number 인덱스 (계약서 번호로 검색)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_contract_history_contract_number
  ON contract_history(contract_number);

-- ============================================
-- 3. business_info 테이블 인덱스
-- ============================================

-- business_name 인덱스 (사업장명 검색)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_business_info_business_name
  ON business_info(business_name);

-- business_name 패턴 검색용 (LIKE 쿼리 최적화)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_business_info_business_name_pattern
  ON business_info(business_name text_pattern_ops);

-- created_at 인덱스
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_business_info_created_at
  ON business_info(created_at DESC);

-- ============================================
-- 4. facility_tasks 테이블 인덱스
-- ============================================

-- status 인덱스 (진행상태별 조회)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_facility_tasks_status
  ON facility_tasks(status);

-- assigned_to 인덱스 (담당자별 조회)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_facility_tasks_assigned_to
  ON facility_tasks(assigned_to);

-- business_id 인덱스 (사업장별 업무 조회)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_facility_tasks_business_id
  ON facility_tasks(business_id);

-- due_date 인덱스 (마감일 기준 정렬)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_facility_tasks_due_date
  ON facility_tasks(due_date);

-- 복합 인덱스 (담당자의 진행 중인 업무)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_facility_tasks_assignee_status
  ON facility_tasks(assigned_to, status);

-- ============================================
-- 5. 기타 자주 조회되는 테이블 인덱스
-- ============================================

-- air_permits 테이블
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_air_permits_business_id
  ON air_permits(business_id)
  WHERE business_id IS NOT NULL;

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_air_permits_created_at
  ON air_permits(created_at DESC);

-- employees 테이블
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_employees_email
  ON employees(email);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_employees_is_active
  ON employees(is_active);

-- ============================================
-- 인덱스 생성 확인 쿼리
-- ============================================

-- 생성된 인덱스 목록 확인
SELECT
  tablename,
  indexname,
  indexdef
FROM pg_indexes
WHERE schemaname = 'public'
  AND indexname LIKE 'idx_%'
ORDER BY tablename, indexname;

-- 인덱스 크기 확인
SELECT
  schemaname,
  tablename,
  indexname,
  pg_size_pretty(pg_relation_size(indexrelid)) AS index_size
FROM pg_stat_user_indexes
WHERE schemaname = 'public'
  AND indexrelname LIKE 'idx_%'
ORDER BY pg_relation_size(indexrelid) DESC;

-- ============================================
-- 성능 테스트 쿼리 (인덱스 효과 확인)
-- ============================================

-- 실행 계획 확인 (인덱스 사용 여부)
EXPLAIN ANALYZE
SELECT * FROM document_history
WHERE business_id = 'test-business-id'
  AND document_type = 'contract'
ORDER BY created_at DESC
LIMIT 20;

-- 예상 결과:
-- Before: Seq Scan (전체 스캔) - 느림
-- After: Index Scan using idx_document_history_composite - 빠름

-- ============================================
-- 롤백 스크립트 (필요시 사용)
-- ============================================

-- 모든 성능 인덱스 삭제 (주의: 성능 저하됨)
/*
DROP INDEX IF EXISTS idx_document_history_business_id;
DROP INDEX IF EXISTS idx_document_history_document_type;
DROP INDEX IF EXISTS idx_document_history_created_at;
DROP INDEX IF EXISTS idx_document_history_created_by;
DROP INDEX IF EXISTS idx_document_history_composite;

DROP INDEX IF EXISTS idx_contract_history_business_id;
DROP INDEX IF EXISTS idx_contract_history_created_at;
DROP INDEX IF EXISTS idx_contract_history_contract_type;
DROP INDEX IF EXISTS idx_contract_history_contract_number;

DROP INDEX IF EXISTS idx_business_info_business_name;
DROP INDEX IF EXISTS idx_business_info_business_name_pattern;
DROP INDEX IF EXISTS idx_business_info_created_at;

DROP INDEX IF EXISTS idx_facility_tasks_status;
DROP INDEX IF EXISTS idx_facility_tasks_assigned_to;
DROP INDEX IF EXISTS idx_facility_tasks_business_id;
DROP INDEX IF EXISTS idx_facility_tasks_due_date;
DROP INDEX IF EXISTS idx_facility_tasks_assignee_status;

DROP INDEX IF EXISTS idx_air_permits_business_id;
DROP INDEX IF EXISTS idx_air_permits_created_at;

DROP INDEX IF EXISTS idx_employees_email;
DROP INDEX IF EXISTS idx_employees_is_active;
*/

-- ============================================
-- 사용 방법
-- ============================================

/*
1. Supabase Dashboard 접속
2. SQL Editor 메뉴 선택
3. 이 스크립트 복사/붙여넣기
4. Run 버튼 클릭
5. 완료까지 대기 (5-10분)
6. 확인 쿼리 실행하여 인덱스 생성 검증

주의사항:
- CONCURRENTLY 옵션으로 서비스 중단 없이 생성
- 테이블이 클 경우 시간이 오래 걸릴 수 있음
- 실행 중 에러 발생 시 해당 인덱스는 생성되지 않음
- 에러 메시지 확인 후 개별 재실행 가능
*/
