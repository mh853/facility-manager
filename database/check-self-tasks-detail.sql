-- ===============================================
-- 자비(self) 업무 상세 확인
-- ===============================================

-- 1. 진행중인 자비 업무 목록 (완료 제외)
SELECT
  '=== 진행중인 자비 업무 ===' as section,
  id,
  business_name,
  task_type,
  status,
  title,
  assignee,
  priority,
  local_government,
  created_at,
  updated_at
FROM facility_tasks
WHERE task_type = 'self'
  AND status != 'document_complete'  -- 완료 단계 제외
ORDER BY created_at DESC;

-- 2. 자비 업무의 status 분포 (상세)
SELECT
  '=== 자비 Status 분포 ===' as section,
  status,
  COUNT(*) as count,
  STRING_AGG(business_name, ', ') as businesses
FROM facility_tasks
WHERE task_type = 'self'
GROUP BY status
ORDER BY count DESC;

-- 3. 완료된 자비 업무
SELECT
  '=== 완료된 자비 업무 ===' as section,
  id,
  business_name,
  status,
  title,
  created_at
FROM facility_tasks
WHERE task_type = 'self'
  AND status = 'document_complete'
ORDER BY created_at DESC;

-- 4. 자비 업무 전체 목록 (ID와 사업장명만)
SELECT
  '=== 전체 자비 업무 ID ===' as section,
  id,
  business_name,
  status,
  CASE
    WHEN status = 'document_complete' THEN '완료'
    ELSE '진행중'
  END as status_kr
FROM facility_tasks
WHERE task_type = 'self'
ORDER BY created_at DESC;

-- 5. 자비 업무의 필터 조건 확인
-- (완료 제외, 담당자 있는지, 지자체 있는지 등)
SELECT
  '=== 자비 업무 필터 조건 체크 ===' as section,
  id,
  business_name,
  status,
  assignee,
  priority,
  local_government,
  construction_report_date,
  CASE
    WHEN status = 'document_complete' THEN '완료 (필터링될 수 있음)'
    WHEN assignee IS NULL THEN '담당자 없음 (필터링될 수 있음)'
    WHEN local_government IS NULL THEN '지자체 없음 (필터링될 수 있음)'
    ELSE '정상'
  END as filter_issue
FROM facility_tasks
WHERE task_type = 'self'
ORDER BY created_at DESC;
