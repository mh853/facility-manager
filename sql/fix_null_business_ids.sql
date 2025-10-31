-- =====================================================
-- facility_tasks의 NULL business_id 수정
-- =====================================================
-- 목적: business_name으로 business_info와 매칭하여 business_id 업데이트
-- 작성일: 2025-10-31

-- 1. 수정 대상 확인
SELECT
  ft.id as task_id,
  ft.business_name as task_business_name,
  ft.business_id as current_business_id,
  bi.id as correct_business_id,
  bi.business_name as matched_business_name
FROM facility_tasks ft
LEFT JOIN business_info bi ON ft.business_name = bi.business_name
WHERE ft.business_id IS NULL
  AND ft.is_deleted = false
  AND bi.id IS NOT NULL
  AND bi.is_deleted = false
ORDER BY ft.business_name;

-- 2. business_id 업데이트 실행
UPDATE facility_tasks ft
SET
  business_id = bi.id,
  updated_at = NOW()
FROM business_info bi
WHERE ft.business_name = bi.business_name
  AND ft.business_id IS NULL
  AND ft.is_deleted = false
  AND bi.is_deleted = false;

-- 3. 업데이트 결과 확인
SELECT
  COUNT(*) as updated_count,
  '업데이트 완료' as status
FROM facility_tasks ft
INNER JOIN business_info bi ON ft.business_id = bi.id
WHERE ft.business_name = bi.business_name
  AND ft.updated_at >= NOW() - INTERVAL '1 minute';

-- 4. 여전히 NULL인 데이터 확인 (business_info에 없는 경우)
SELECT
  ft.id,
  ft.business_name,
  ft.business_id,
  'business_info에 사업장이 없음' as issue
FROM facility_tasks ft
LEFT JOIN business_info bi ON ft.business_name = bi.business_name
WHERE ft.business_id IS NULL
  AND ft.is_deleted = false
  AND bi.id IS NULL;
