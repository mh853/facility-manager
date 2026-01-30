-- ===============================================
-- 대리점 업무 현황 간단 확인
-- ===============================================

-- 1. 대리점 업무의 status 분포
SELECT
  '=== 대리점 Status 분포 ===' as info,
  status,
  COUNT(*) as count
FROM facility_tasks
WHERE task_type = 'dealer'
GROUP BY status
ORDER BY count DESC;

-- 2. 잘못된 status (dealer_ 접두사가 없는 것들)
SELECT
  '=== 잘못된 Status ===' as info,
  id,
  business_name,
  status,
  title
FROM facility_tasks
WHERE task_type = 'dealer'
  AND status NOT LIKE 'dealer_%'
ORDER BY created_at DESC
LIMIT 20;

-- 3. 올바른 status (dealer_ 접두사가 있는 것들)
SELECT
  '=== 올바른 Status ===' as info,
  id,
  business_name,
  status,
  title
FROM facility_tasks
WHERE task_type = 'dealer'
  AND status LIKE 'dealer_%'
ORDER BY created_at DESC
LIMIT 20;

-- 4. 전체 통계
SELECT
  '=== 전체 통계 ===' as info,
  COUNT(*) as total_dealer_tasks,
  COUNT(CASE WHEN status LIKE 'dealer_%' THEN 1 END) as correct_status,
  COUNT(CASE WHEN status NOT LIKE 'dealer_%' THEN 1 END) as incorrect_status
FROM facility_tasks
WHERE task_type = 'dealer';
