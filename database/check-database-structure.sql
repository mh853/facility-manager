-- ===============================================
-- 현재 데이터베이스 구조 확인 스크립트
-- Supabase에서 실행하여 현재 테이블 상태 파악
-- ===============================================

-- 1. 모든 테이블 목록 조회
SELECT
    table_name,
    table_type
FROM information_schema.tables
WHERE table_schema = 'public'
ORDER BY table_name;

-- 2. employees 테이블 존재 및 구조 확인
SELECT
    'employees 테이블 존재 여부' as check_type,
    CASE
        WHEN EXISTS (
            SELECT FROM information_schema.tables
            WHERE table_schema = 'public' AND table_name = 'employees'
        ) THEN 'EXISTS'
        ELSE 'NOT EXISTS'
    END as result;

-- 3. employees 테이블이 존재한다면 컬럼 구조 확인
SELECT
    column_name,
    data_type,
    is_nullable,
    column_default,
    character_maximum_length
FROM information_schema.columns
WHERE table_schema = 'public'
    AND table_name = 'employees'
ORDER BY ordinal_position;

-- 4. social_accounts 테이블 존재 및 구조 확인
SELECT
    'social_accounts 테이블 존재 여부' as check_type,
    CASE
        WHEN EXISTS (
            SELECT FROM information_schema.tables
            WHERE table_schema = 'public' AND table_name = 'social_accounts'
        ) THEN 'EXISTS'
        ELSE 'NOT EXISTS'
    END as result;

-- 5. social_accounts 테이블이 존재한다면 컬럼 구조 확인
SELECT
    column_name,
    data_type,
    is_nullable,
    column_default,
    character_maximum_length
FROM information_schema.columns
WHERE table_schema = 'public'
    AND table_name = 'social_accounts'
ORDER BY ordinal_position;

-- 6. 외래키 제약조건 확인
SELECT
    tc.constraint_name,
    tc.table_name,
    kcu.column_name,
    ccu.table_name AS foreign_table_name,
    ccu.column_name AS foreign_column_name
FROM information_schema.table_constraints AS tc
JOIN information_schema.key_column_usage AS kcu
    ON tc.constraint_name = kcu.constraint_name
    AND tc.table_schema = kcu.table_schema
JOIN information_schema.constraint_column_usage AS ccu
    ON ccu.constraint_name = tc.constraint_name
    AND ccu.table_schema = tc.table_schema
WHERE tc.constraint_type = 'FOREIGN KEY'
    AND tc.table_schema = 'public'
    AND (tc.table_name = 'social_accounts' OR ccu.table_name = 'employees');

-- 7. 인덱스 확인
SELECT
    schemaname,
    tablename,
    indexname,
    indexdef
FROM pg_indexes
WHERE schemaname = 'public'
    AND (tablename = 'employees' OR tablename = 'social_accounts')
ORDER BY tablename, indexname;