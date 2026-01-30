-- ===============================================
-- 모든 업무 타입 분포 확인
-- ===============================================

-- 1. 전체 업무 타입 분포
SELECT
  '=== 전체 업무 타입 분포 ===' as section,
  task_type,
  COUNT(*) as count,
  ROUND(COUNT(*) * 100.0 / SUM(COUNT(*)) OVER(), 2) as percentage
FROM facility_tasks
GROUP BY task_type
ORDER BY count DESC;

-- 2. 자비(self) 업무 확인
SELECT
  '=== 자비 업무 목록 ===' as section,
  id,
  business_name,
  task_type,
  status,
  title,
  created_at
FROM facility_tasks
WHERE task_type = 'self'
ORDER BY created_at DESC
LIMIT 20;

-- 3. 자비 업무의 status 분포
SELECT
  '=== 자비 업무 Status 분포 ===' as section,
  status,
  COUNT(*) as count
FROM facility_tasks
WHERE task_type = 'self'
GROUP BY status
ORDER BY count DESC;

-- 4. 완료되지 않은 자비 업무 (진행률 100% 미만)
-- Note: facility_tasks 테이블에 progress_percentage 컬럼이 있다고 가정
-- 만약 없다면 status 기반으로 필터링해야 함
SELECT
  '=== 진행 중인 자비 업무 ===' as section,
  id,
  business_name,
  status,
  title,
  created_at
FROM facility_tasks
WHERE task_type = 'self'
  AND status != 'document_complete'  -- 서류 발송 완료가 아닌 것
ORDER BY created_at DESC
LIMIT 20;

-- 5. 전체 통계
SELECT
  '=== 전체 통계 ===' as section,
  COUNT(*) as total_tasks,
  COUNT(CASE WHEN task_type = 'self' THEN 1 END) as self_count,
  COUNT(CASE WHEN task_type = 'subsidy' THEN 1 END) as subsidy_count,
  COUNT(CASE WHEN task_type = 'dealer' THEN 1 END) as dealer_count,
  COUNT(CASE WHEN task_type = 'etc' THEN 1 END) as etc_count,
  COUNT(CASE WHEN task_type = 'as' THEN 1 END) as as_count
FROM facility_tasks;

-- 6. task_type별 완료/미완료 분포
SELECT
  '=== 타입별 완료 현황 ===' as section,
  task_type,
  COUNT(*) as total,
  COUNT(CASE WHEN status = 'document_complete' THEN 1 END) as completed,
  COUNT(CASE WHEN status != 'document_complete' THEN 1 END) as in_progress
FROM facility_tasks
GROUP BY task_type
ORDER BY total DESC;
