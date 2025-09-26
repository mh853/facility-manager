-- AS 워크플로우 상태 마이그레이션 스크립트 (단순 버전)
-- 기존 AS 업무의 status 값을 새로운 AS 전용 status로 변경

-- 1. 마이그레이션 전 현재 AS 업무 상태 확인
SELECT task_type, status, COUNT(*) as count
FROM facility_tasks
WHERE task_type = 'as'
GROUP BY task_type, status
ORDER BY status;

-- 2. AS 업무 상태 매핑 변경
BEGIN;

-- AS 고객 상담 (기존: customer_contact -> as_customer_contact)
UPDATE facility_tasks
SET status = 'as_customer_contact'
WHERE task_type = 'as' AND status = 'customer_contact';

-- AS 현장 확인 (기존: site_inspection -> as_site_inspection)
UPDATE facility_tasks
SET status = 'as_site_inspection'
WHERE task_type = 'as' AND status = 'site_inspection';

-- AS 견적 작성 (기존: quotation -> as_quotation)
UPDATE facility_tasks
SET status = 'as_quotation'
WHERE task_type = 'as' AND status = 'quotation';

-- AS 계약 체결 (기존: contract -> as_contract)
UPDATE facility_tasks
SET status = 'as_contract'
WHERE task_type = 'as' AND status = 'contract';

-- AS 부품 발주 (기존: product_order -> as_part_order)
UPDATE facility_tasks
SET status = 'as_part_order'
WHERE task_type = 'as' AND status = 'product_order';

-- AS 완료 (기존: installation -> as_completed) - 핵심 변경사항
UPDATE facility_tasks
SET status = 'as_completed'
WHERE task_type = 'as' AND status = 'installation';

-- 3. 변경 결과 확인
SELECT
    '마이그레이션 완료' as message,
    task_type,
    status,
    COUNT(*) as count
FROM facility_tasks
WHERE task_type = 'as'
GROUP BY task_type, status
ORDER BY status;

COMMIT;