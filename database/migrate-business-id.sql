-- 마이그레이션: facility_tasks 테이블에 business_id 자동 매핑
-- 목적: business_name을 기반으로 business_id를 조회하여 업데이트
-- 작성일: 2025-01-29

-- 1. business_id가 null인 업무 개수 확인
SELECT COUNT(*) as null_business_id_count
FROM facility_tasks
WHERE business_id IS NULL
  AND is_deleted = FALSE;

-- 2. business_name으로 business_id 매핑 (미리보기)
SELECT
  ft.id as task_id,
  ft.title,
  ft.business_name,
  ft.business_id as current_business_id,
  bi.id as resolved_business_id,
  bi.business_name as resolved_business_name
FROM facility_tasks ft
LEFT JOIN business_info bi ON ft.business_name = bi.business_name
  AND bi.is_active = TRUE
  AND bi.is_deleted = FALSE
WHERE ft.business_id IS NULL
  AND ft.is_deleted = FALSE
ORDER BY ft.created_at DESC;

-- 3. 실제 업데이트 (주의: 실행 전 백업 권장)
-- 주의: 이 쿼리는 실제 데이터를 변경합니다!
UPDATE facility_tasks ft
SET
  business_id = bi.id,
  updated_at = NOW(),
  last_modified_by_name = 'system_migration'
FROM business_info bi
WHERE ft.business_name = bi.business_name
  AND bi.is_active = TRUE
  AND bi.is_deleted = FALSE
  AND ft.business_id IS NULL
  AND ft.is_deleted = FALSE;

-- 4. 업데이트 결과 확인
SELECT
  COUNT(CASE WHEN business_id IS NOT NULL THEN 1 END) as with_business_id,
  COUNT(CASE WHEN business_id IS NULL THEN 1 END) as without_business_id,
  COUNT(*) as total
FROM facility_tasks
WHERE is_deleted = FALSE;

-- 5. 매핑 실패한 업무 확인 (business_name이 business_info에 없는 경우)
SELECT
  ft.id,
  ft.title,
  ft.business_name,
  ft.created_at
FROM facility_tasks ft
LEFT JOIN business_info bi ON ft.business_name = bi.business_name
  AND bi.is_active = TRUE
  AND bi.is_deleted = FALSE
WHERE ft.business_id IS NULL
  AND ft.is_deleted = FALSE
  AND bi.id IS NULL
ORDER BY ft.created_at DESC;
