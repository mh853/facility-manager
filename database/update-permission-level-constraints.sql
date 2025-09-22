-- 권한 레벨 4 (슈퍼관리자) 지원을 위한 데이터베이스 제약조건 업데이트

-- 1. 기존 CHECK 제약조건 확인 및 삭제
DO $$
DECLARE
    constraint_exists BOOLEAN;
BEGIN
    -- employees 테이블의 permission_level 제약조건 확인
    SELECT EXISTS (
        SELECT 1 FROM information_schema.check_constraints cc
        JOIN information_schema.constraint_column_usage ccu ON cc.constraint_name = ccu.constraint_name
        WHERE ccu.table_name = 'employees'
        AND ccu.column_name = 'permission_level'
        AND cc.check_clause LIKE '%<=%'
    ) INTO constraint_exists;

    IF constraint_exists THEN
        -- 기존 제약조건들 삭제 (제약조건 이름을 찾아서 삭제)
        DECLARE
            constraint_name_var TEXT;
        BEGIN
            SELECT cc.constraint_name INTO constraint_name_var
            FROM information_schema.check_constraints cc
            JOIN information_schema.constraint_column_usage ccu ON cc.constraint_name = ccu.constraint_name
            WHERE ccu.table_name = 'employees'
            AND ccu.column_name = 'permission_level'
            AND cc.check_clause LIKE '%<=%'
            LIMIT 1;

            IF constraint_name_var IS NOT NULL THEN
                EXECUTE 'ALTER TABLE employees DROP CONSTRAINT ' || constraint_name_var;
                RAISE NOTICE '기존 permission_level 제약조건 삭제: %', constraint_name_var;
            END IF;
        END;
    END IF;
END $$;

-- 2. 새로운 권한 레벨 제약조건 추가 (1~4 허용)
ALTER TABLE employees ADD CONSTRAINT check_permission_level_range
CHECK (permission_level >= 1 AND permission_level <= 4);

-- 3. 권한 레벨별 설명 확인
SELECT
    permission_level,
    COUNT(*) as count,
    CASE
        WHEN permission_level = 1 THEN '일반사용자'
        WHEN permission_level = 2 THEN '매니저'
        WHEN permission_level = 3 THEN '관리자'
        WHEN permission_level = 4 THEN '슈퍼관리자'
        ELSE '알 수 없음'
    END as role_name
FROM employees
GROUP BY permission_level
ORDER BY permission_level;

-- 4. 현재 제약조건 확인
SELECT
    cc.constraint_name,
    cc.check_clause
FROM information_schema.check_constraints cc
JOIN information_schema.constraint_column_usage ccu ON cc.constraint_name = ccu.constraint_name
WHERE ccu.table_name = 'employees'
AND ccu.column_name = 'permission_level';

-- 5. 권한 레벨 4 테스트 (선택사항)
-- 실제 계정이 있다면 테스트해볼 수 있습니다
/*
UPDATE employees
SET permission_level = 4
WHERE email = 'munong2@gmail.com';
*/

COMMENT ON COLUMN employees.permission_level IS '권한 레벨: 1=일반사용자, 2=매니저, 3=관리자, 4=슈퍼관리자';