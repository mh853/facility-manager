-- facility_tasks 테이블의 실제 title 형식 확인

-- 1. 최근 업무들의 title 확인 (있는 그대로)
SELECT id, title, business_name, status, created_at
FROM facility_tasks
ORDER BY created_at DESC
LIMIT 20;

-- 2. 괄호가 포함된 title만 확인
SELECT id, title, business_name, status
FROM facility_tasks
WHERE title LIKE '%(%'
ORDER BY created_at DESC
LIMIT 10;

-- 3. 특정 패턴 확인 (다양한 케이스)
SELECT
  id,
  title,
  CASE
    WHEN title ~ '\([a-z_]+\)' THEN '패턴1: (schema_code) 형식'
    WHEN title ~ '\s\([a-z_]+\)' THEN '패턴2: 공백(schema_code) 형식'
    WHEN title ~ '\([a-z_]+\)\s*$' THEN '패턴3: (schema_code)끝 형식'
    ELSE '매칭 안됨'
  END as pattern_match,
  business_name
FROM facility_tasks
WHERE title LIKE '%(%'
ORDER BY created_at DESC
LIMIT 10;
