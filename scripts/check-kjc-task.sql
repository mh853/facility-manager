-- (주)케이제이씨우진 사업장의 업무 데이터 확인
SELECT
  id,
  title,
  status,
  task_type,
  assignee,
  created_at,
  updated_at
FROM facility_tasks
WHERE business_name = '(주)케이제이씨우진'
ORDER BY created_at DESC;
