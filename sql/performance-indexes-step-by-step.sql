-- ============================================
-- Performance Optimization - Database Indexes
-- 단계별 실행 버전 (Supabase 트랜잭션 블록 우회)
-- ============================================

-- ⚠️ 사용 방법:
-- 1. 각 CREATE INDEX 문을 한 줄씩 개별 실행
-- 2. Supabase SQL Editor에서 한 줄 선택 → Run 버튼
-- 3. 에러 없이 완료되면 다음 줄 실행
-- 4. 이미 존재하는 인덱스는 "already exists" 메시지 출력됨 (정상)

-- ============================================
-- Step 1: document_history 테이블 인덱스 (5개)
-- ============================================

-- 1-1. business_id 인덱스
CREATE INDEX IF NOT EXISTS idx_document_history_business_id ON document_history(business_id);

-- 1-2. document_type 인덱스
CREATE INDEX IF NOT EXISTS idx_document_history_document_type ON document_history(document_type);

-- 1-3. created_at 인덱스
CREATE INDEX IF NOT EXISTS idx_document_history_created_at ON document_history(created_at DESC);

-- 1-4. created_by 인덱스
CREATE INDEX IF NOT EXISTS idx_document_history_created_by ON document_history(created_by);

-- 1-5. 복합 인덱스 (가장 중요!)
CREATE INDEX IF NOT EXISTS idx_document_history_composite ON document_history(business_id, document_type, created_at DESC);

-- ============================================
-- Step 2: contract_history 테이블 인덱스 (4개)
-- ============================================

-- 2-1. business_id 인덱스
CREATE INDEX IF NOT EXISTS idx_contract_history_business_id ON contract_history(business_id);

-- 2-2. created_at 인덱스
CREATE INDEX IF NOT EXISTS idx_contract_history_created_at ON contract_history(created_at DESC);

-- 2-3. contract_type 인덱스
CREATE INDEX IF NOT EXISTS idx_contract_history_contract_type ON contract_history(contract_type);

-- 2-4. contract_number 인덱스
CREATE INDEX IF NOT EXISTS idx_contract_history_contract_number ON contract_history(contract_number);

-- ============================================
-- Step 3: business_info 테이블 인덱스 (3개)
-- ============================================

-- 3-1. business_name 인덱스
CREATE INDEX IF NOT EXISTS idx_business_info_business_name ON business_info(business_name);

-- 3-2. business_name 패턴 검색용
CREATE INDEX IF NOT EXISTS idx_business_info_business_name_pattern ON business_info(business_name text_pattern_ops);

-- 3-3. created_at 인덱스
CREATE INDEX IF NOT EXISTS idx_business_info_created_at ON business_info(created_at DESC);

-- ============================================
-- Step 4: facility_tasks 테이블 인덱스 (5개)
-- ============================================

-- 4-1. status 인덱스
CREATE INDEX IF NOT EXISTS idx_facility_tasks_status ON facility_tasks(status);

-- 4-2. assigned_to 인덱스
CREATE INDEX IF NOT EXISTS idx_facility_tasks_assigned_to ON facility_tasks(assigned_to);

-- 4-3. business_id 인덱스
CREATE INDEX IF NOT EXISTS idx_facility_tasks_business_id ON facility_tasks(business_id);

-- 4-4. due_date 인덱스
CREATE INDEX IF NOT EXISTS idx_facility_tasks_due_date ON facility_tasks(due_date);

-- 4-5. 복합 인덱스
CREATE INDEX IF NOT EXISTS idx_facility_tasks_assignee_status ON facility_tasks(assigned_to, status);

-- ============================================
-- Step 5: 기타 테이블 인덱스 (4개)
-- ============================================

-- 5-1. air_permits - business_id
CREATE INDEX IF NOT EXISTS idx_air_permits_business_id ON air_permits(business_id) WHERE business_id IS NOT NULL;

-- 5-2. air_permits - created_at
CREATE INDEX IF NOT EXISTS idx_air_permits_created_at ON air_permits(created_at DESC);

-- 5-3. employees - email
CREATE INDEX IF NOT EXISTS idx_employees_email ON employees(email);

-- 5-4. employees - is_active
CREATE INDEX IF NOT EXISTS idx_employees_is_active ON employees(is_active);

-- ============================================
-- 확인 쿼리: 생성된 인덱스 목록
-- ============================================

SELECT tablename, indexname, indexdef FROM pg_indexes WHERE schemaname = 'public' AND indexname LIKE 'idx_%' ORDER BY tablename, indexname;

-- ============================================
-- 우선순위별 실행 가이드
-- ============================================

/*
⭐ 최우선 (즉시 효과 큼):
CREATE INDEX IF NOT EXISTS idx_document_history_composite ON document_history(business_id, document_type, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_contract_history_business_id ON contract_history(business_id);
CREATE INDEX IF NOT EXISTS idx_business_info_business_name ON business_info(business_name);

🔵 중요 (성능 개선):
CREATE INDEX IF NOT EXISTS idx_document_history_business_id ON document_history(business_id);
CREATE INDEX IF NOT EXISTS idx_document_history_document_type ON document_history(document_type);
CREATE INDEX IF NOT EXISTS idx_facility_tasks_status ON facility_tasks(status);

🟢 권장 (나머지 모든 인덱스):
위에서 생성하지 않은 모든 인덱스 실행
*/
