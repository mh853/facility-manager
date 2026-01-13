-- business_memos 테이블의 실제 컬럼 타입 확인
SELECT
    column_name,
    data_type,
    character_maximum_length,
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_schema = 'public'
    AND table_name = 'business_memos'
ORDER BY ordinal_position;
