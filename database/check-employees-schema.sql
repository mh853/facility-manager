-- employees 테이블의 현재 구조 확인
-- 실행 후 결과를 보고 올바른 업데이트 스크립트를 작성할 수 있습니다

-- 1. employees 테이블의 모든 컬럼 정보 조회
SELECT
    column_name,
    data_type,
    is_nullable,
    column_default,
    character_maximum_length
FROM information_schema.columns
WHERE table_name = 'employees'
ORDER BY ordinal_position;

-- 2. employees 테이블의 제약조건 확인
SELECT
    constraint_name,
    constraint_type,
    column_name
FROM information_schema.table_constraints tc
JOIN information_schema.key_column_usage kcu
    ON tc.constraint_name = kcu.constraint_name
WHERE tc.table_name = 'employees'
ORDER BY constraint_type, column_name;

-- 3. 현재 munong2@gmail.com 계정 정보 확인
SELECT *
FROM employees
WHERE email = 'munong2@gmail.com';

-- 4. employees 테이블 샘플 데이터 (구조 파악용)
SELECT *
FROM employees
LIMIT 3;