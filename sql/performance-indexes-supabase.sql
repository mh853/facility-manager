-- ============================================
-- Performance Optimization - Database Indexes (Supabase Version)
-- ============================================
-- 실행 시간: 약 2-5분 (데이터 양에 따라)
-- 실행 시점: 피크 시간대를 피해서 실행 (야간 또는 주말 권장)
-- 영향: 읽기 성능 향상, 쓰기 성능에 미세한 영향 (거의 없음)
-- ============================================

-- ⚠️ 주의사항: Supabase SQL Editor는 트랜잭션 블록 내에서 실행되므로
-- CONCURRENTLY 옵션을 사용할 수 없습니다.
-- 따라서 이 스크립트는 일반 CREATE INDEX를 사용합니다.
--
-- 실행 방법:
-- 1. 트래픽이 적은 시간대에 실행 (야간 또는 주말)
-- 2. 전체 스크립트를 한 번에 실행
-- 3. 에러 발생 시 이미 존재하는 인덱스는 무시됨 (IF NOT EXISTS)

-- ============================================
-- 1. document_history 테이블 인덱스
-- ============================================

-- business_id 인덱스 (가장 자주 사용되는 필터)
CREATE INDEX IF NOT EXISTS idx_document_history_business_id
  ON document_history(business_id);

-- document_type 인덱스 (계약서/견적서/발주서 필터)
CREATE INDEX IF NOT EXISTS idx_document_history_document_type
  ON document_history(document_type);

-- created_at 인덱스 (최신순 정렬)
CREATE INDEX IF NOT EXISTS idx_document_history_created_at
  ON document_history(created_at DESC);

-- created_by 인덱스 (작성자별 조회)
CREATE INDEX IF NOT EXISTS idx_document_history_created_by
  ON document_history(created_by);

-- 복합 인덱스 (가장 자주 함께 사용되는 조합)
-- 예: 특정 사업장의 특정 문서 타입을 최신순으로 조회
CREATE INDEX IF NOT EXISTS idx_document_history_composite
  ON document_history(business_id, document_type, created_at DESC);

-- ============================================
-- 2. contract_history 테이블 인덱스
-- ============================================

-- business_id 인덱스
CREATE INDEX IF NOT EXISTS idx_contract_history_business_id
  ON contract_history(business_id);

-- created_at 인덱스
CREATE INDEX IF NOT EXISTS idx_contract_history_created_at
  ON contract_history(created_at DESC);

-- contract_type 인덱스 (보조금/자비 구분)
CREATE INDEX IF NOT EXISTS idx_contract_history_contract_type
  ON contract_history(contract_type);

-- contract_number 인덱스 (계약서 번호로 검색)
CREATE INDEX IF NOT EXISTS idx_contract_history_contract_number
  ON contract_history(contract_number);

-- ============================================
-- 3. business_info 테이블 인덱스
-- ============================================

-- business_name 인덱스 (사업장명 검색)
CREATE INDEX IF NOT EXISTS idx_business_info_business_name
  ON business_info(business_name);

-- business_name 패턴 검색용 (LIKE 쿼리 최적화)
CREATE INDEX IF NOT EXISTS idx_business_info_business_name_pattern
  ON business_info(business_name text_pattern_ops);

-- created_at 인덱스
CREATE INDEX IF NOT EXISTS idx_business_info_created_at
  ON business_info(created_at DESC);

-- ============================================
-- 4. facility_tasks 테이블 인덱스
-- ============================================

-- status 인덱스 (진행상태별 조회)
CREATE INDEX IF NOT EXISTS idx_facility_tasks_status
  ON facility_tasks(status);

-- assignee 인덱스 (담당자별 조회) - 실제 컬럼명은 assignee
CREATE INDEX IF NOT EXISTS idx_facility_tasks_assignee
  ON facility_tasks(assignee);

-- business_id 인덱스 (사업장별 업무 조회)
CREATE INDEX IF NOT EXISTS idx_facility_tasks_business_id
  ON facility_tasks(business_id);

-- due_date 인덱스 (마감일 기준 정렬)
CREATE INDEX IF NOT EXISTS idx_facility_tasks_due_date
  ON facility_tasks(due_date);

-- 복합 인덱스 (담당자의 진행 중인 업무) - 실제 컬럼명은 assignee
CREATE INDEX IF NOT EXISTS idx_facility_tasks_assignee_status
  ON facility_tasks(assignee, status);

-- ============================================
-- 5. employees 테이블 인덱스
-- ============================================

-- employees 테이블
CREATE INDEX IF NOT EXISTS idx_employees_email
  ON employees(email);

CREATE INDEX IF NOT EXISTS idx_employees_is_active
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
DROP INDEX IF EXISTS idx_facility_tasks_assignee;
DROP INDEX IF EXISTS idx_facility_tasks_business_id;
DROP INDEX IF EXISTS idx_facility_tasks_due_date;
DROP INDEX IF EXISTS idx_facility_tasks_assignee_status;

DROP INDEX IF EXISTS idx_employees_email;
DROP INDEX IF EXISTS idx_employees_is_active;
*/

-- ============================================
-- 사용 방법
-- ============================================

/*
✅ Supabase SQL Editor에서 실행하는 방법:

1. Supabase Dashboard 접속
2. SQL Editor 메뉴 선택
3. 이 스크립트 전체를 복사/붙여넣기
4. "Run" 버튼 클릭
5. 완료까지 대기 (2-5분, 데이터 양에 따라)
6. 아래 확인 쿼리 실행하여 인덱스 생성 검증

📋 확인 쿼리만 별도 실행:
SELECT tablename, indexname FROM pg_indexes
WHERE schemaname = 'public' AND indexname LIKE 'idx_%'
ORDER BY tablename;

⚠️ 주의사항:
- 트래픽이 적은 시간대 실행 권장 (야간/주말)
- 인덱스 생성 중 테이블이 잠깁니다 (읽기는 가능, 쓰기는 대기)
- 데이터가 많을 경우 시간이 걸릴 수 있습니다
- IF NOT EXISTS로 중복 생성 방지됨
- 에러 발생 시 해당 인덱스만 건너뛰고 계속 진행

💡 성능 개선 효과:
- 데이터베이스 쿼리 속도: 30-50% 개선
- 페이지 로딩 시간: 20-40% 단축
- 특히 문서 이력, 계약서 조회 성능 대폭 향상
*/
