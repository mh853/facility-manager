-- facility_tasks 테이블의 컬럼 구조 확인
SELECT
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns
WHERE table_name = 'facility_tasks'
  AND column_name IN ('assignee', 'assignees')
ORDER BY ordinal_position;

-- 실제 데이터 샘플 확인 (assignee 컬럼이 있는지 확인)
SELECT
  id,
  business_name,
  assignee,
  assignees,
  status
FROM facility_tasks
WHERE status = 'product_order'
  AND is_deleted = false
LIMIT 5;
