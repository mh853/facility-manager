-- business_info 테이블의 모든 VARCHAR 컬럼 확인
-- VARCHAR(20) 제한이 있는 컬럼을 찾아냅니다

SELECT
    column_name,
    data_type,
    character_maximum_length,
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_schema = 'public'
    AND table_name = 'business_info'
    AND data_type LIKE '%character%'
ORDER BY
    character_maximum_length ASC NULLS LAST,
    column_name;
