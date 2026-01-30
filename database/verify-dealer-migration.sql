-- ===============================================
-- 대리점 업무 마이그레이션 검증 쿼리
-- ===============================================

-- 1. 대리점 업무의 현재 상태 분포 확인
SELECT
  '=== 대리점 업무 Status 분포 ===' as section,
  status,
  COUNT(*) as count,
  ROUND(COUNT(*) * 100.0 / SUM(COUNT(*)) OVER(), 2) as percentage
FROM facility_tasks
WHERE task_type = 'dealer'
GROUP BY status
ORDER BY count DESC;

-- 2. 예상치 못한 status 값 확인 (대리점 전용이 아닌 값)
SELECT
  '=== 잘못된 Status 값 ===' as section,
  id,
  title,
  business_name,
  status,
  created_at
FROM facility_tasks
WHERE task_type = 'dealer'
  AND status NOT IN (
    'dealer_order_received',
    'dealer_invoice_issued',
    'dealer_payment_confirmed',
    'dealer_product_ordered'
  )
ORDER BY created_at DESC;

-- 3. 각 대리점 단계별 업무 목록
SELECT
  '=== 발주 수신 ===' as section,
  id,
  title,
  business_name,
  status,
  created_at
FROM facility_tasks
WHERE task_type = 'dealer' AND status = 'dealer_order_received'
ORDER BY created_at DESC
LIMIT 5;

SELECT
  '=== 계산서 발행 ===' as section,
  id,
  title,
  business_name,
  status,
  created_at
FROM facility_tasks
WHERE task_type = 'dealer' AND status = 'dealer_invoice_issued'
ORDER BY created_at DESC
LIMIT 5;

SELECT
  '=== 입금 확인 ===' as section,
  id,
  title,
  business_name,
  status,
  created_at
FROM facility_tasks
WHERE task_type = 'dealer' AND status = 'dealer_payment_confirmed'
ORDER BY created_at DESC
LIMIT 5;

SELECT
  '=== 제품 발주 ===' as section,
  id,
  title,
  business_name,
  status,
  created_at
FROM facility_tasks
WHERE task_type = 'dealer' AND status = 'dealer_product_ordered'
ORDER BY created_at DESC
LIMIT 5;

-- 4. 전체 대리점 업무 수
SELECT
  '=== 전체 통계 ===' as section,
  COUNT(*) as total_dealer_tasks,
  COUNT(CASE WHEN status LIKE 'dealer_%' THEN 1 END) as correct_status_count,
  COUNT(CASE WHEN status NOT LIKE 'dealer_%' THEN 1 END) as incorrect_status_count
FROM facility_tasks
WHERE task_type = 'dealer';
