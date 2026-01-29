-- facility_tasks 테이블의 title에서 스키마 코드 제거
-- 예: "제품 발주 (product_shipment)" → "제품 발주"

-- 1. 업데이트 전 상태 확인
SELECT id, title, business_name, status
FROM facility_tasks
WHERE title ~* '\s*\([a-z_]+\)\s*$'
ORDER BY created_at DESC;

-- 2. 백업 (선택사항)
-- CREATE TABLE facility_tasks_backup_20260129 AS SELECT * FROM facility_tasks;

-- 3. title에서 괄호와 스키마 코드 제거
UPDATE facility_tasks
SET
  title = TRIM(REGEXP_REPLACE(title, '\s*\([a-z_]+\)\s*$', '', 'i')),
  updated_at = NOW()
WHERE title ~* '\s*\([a-z_]+\)\s*$';

-- 4. 업데이트 후 확인
SELECT id, title, business_name, status
FROM facility_tasks
WHERE updated_at > NOW() - INTERVAL '5 minutes'
ORDER BY updated_at DESC;

-- 5. 업데이트된 레코드 수 확인
SELECT COUNT(*) as updated_count
FROM facility_tasks
WHERE updated_at > NOW() - INTERVAL '5 minutes';
