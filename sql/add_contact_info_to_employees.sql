-- 연락처 정보 관리 기능을 위한 employees 테이블 확장
-- 작성일: 2025-11-03
-- 목적: 계정 설정 페이지에서 연락처 정보 입력 및 관리

-- 1. 연락처 정보 컬럼 추가
ALTER TABLE employees ADD COLUMN IF NOT EXISTS phone VARCHAR(20);
ALTER TABLE employees ADD COLUMN IF NOT EXISTS mobile VARCHAR(20);

-- 2. 인덱스 추가 (검색 최적화)
CREATE INDEX IF NOT EXISTS idx_employees_phone ON employees(phone);
CREATE INDEX IF NOT EXISTS idx_employees_mobile ON employees(mobile);

-- 3. 컬럼 설명 추가
COMMENT ON COLUMN employees.phone IS '일반 전화번호 (사무실)';
COMMENT ON COLUMN employees.mobile IS '휴대전화번호';

-- 4. 검증 쿼리 (마이그레이션 후 실행하여 확인)
-- SELECT column_name, data_type, character_maximum_length
-- FROM information_schema.columns
-- WHERE table_name = 'employees'
-- AND column_name IN ('phone', 'mobile');
