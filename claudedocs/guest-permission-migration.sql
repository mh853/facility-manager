-- Guest Permission System Migration
-- 게스트 권한 시스템 마이그레이션
--
-- 목적: employees 테이블의 permission_level 제약 조건을 업데이트하여
--       0 (게스트) 레벨을 허용하도록 수정
--
-- 실행 방법: Supabase Dashboard > SQL Editor에서 실행

-- 1. 현재 permission_level 제약 조건 확인
-- (참고용 - 실제 실행하지 않음)
-- SELECT conname, pg_get_constraintdef(oid)
-- FROM pg_constraint
-- WHERE conrelid = 'employees'::regclass
-- AND conname LIKE '%permission_level%';

-- 2. 기존 제약 조건 삭제 (있는 경우)
-- employees_permission_level_check 라는 이름의 제약이 있을 수 있음
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conrelid = 'employees'::regclass
        AND conname = 'employees_permission_level_check'
    ) THEN
        ALTER TABLE employees DROP CONSTRAINT employees_permission_level_check;
        RAISE NOTICE 'Existing constraint dropped';
    ELSE
        RAISE NOTICE 'No existing constraint found';
    END IF;
END $$;

-- 3. 새로운 제약 조건 추가 (0-4 허용)
ALTER TABLE employees
ADD CONSTRAINT employees_permission_level_check
CHECK (permission_level >= 0 AND permission_level <= 4);

-- 4. 확인: 제약 조건이 올바르게 추가되었는지 확인
SELECT conname, pg_get_constraintdef(oid) as constraint_definition
FROM pg_constraint
WHERE conrelid = 'employees'::regclass
AND conname = 'employees_permission_level_check';

-- 5. (선택 사항) 테스트용 게스트 계정 생성
-- 주의: 실제 사용할 경우 이메일과 비밀번호를 변경하세요
-- INSERT INTO employees (
--   email,
--   name,
--   password_hash,
--   permission_level,
--   is_active
-- ) VALUES (
--   'guest@facility-manager.com',
--   '게스트',
--   '$2a$10$...',  -- 실제 bcrypt 해시로 변경
--   0,
--   true
-- );

COMMENT ON COLUMN employees.permission_level IS
'권한 레벨: 0=게스트(읽기전용), 1=일반, 2=매니저, 3=관리자, 4=시스템';
