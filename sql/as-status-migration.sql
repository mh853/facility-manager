-- AS 워크플로우 상태 마이그레이션 스크립트
-- 기존 AS 업무의 status 값을 새로운 AS 전용 status로 변경

-- 1. 마이그레이션 전 현재 AS 업무 상태 확인
-- SELECT task_type, status, COUNT(*) as count
-- FROM facility_tasks
-- WHERE task_type = 'as'
-- GROUP BY task_type, status
-- ORDER BY status;

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

-- 3. 변경 결과 확인용 쿼리
-- SELECT task_type, status, COUNT(*) as count
-- FROM facility_tasks
-- WHERE task_type = 'as'
-- GROUP BY task_type, status
-- ORDER BY status;

-- 4. 마이그레이션 완료 로그
INSERT INTO migration_log (migration_name, executed_at, description)
VALUES (
  'as-status-migration-v1',
  NOW(),
  'AS 워크플로우 상태를 전용 status로 분리 (customer_contact->as_customer_contact, installation->as_completed 등)'
)
ON CONFLICT (migration_name) DO NOTHING;

COMMIT;

-- 마이그레이션 롤백 스크립트 (필요시 사용)
/*
BEGIN;

-- 롤백: 새 AS status를 기존 공용 status로 되돌리기
UPDATE facility_tasks SET status = 'customer_contact' WHERE task_type = 'as' AND status = 'as_customer_contact';
UPDATE facility_tasks SET status = 'site_inspection' WHERE task_type = 'as' AND status = 'as_site_inspection';
UPDATE facility_tasks SET status = 'quotation' WHERE task_type = 'as' AND status = 'as_quotation';
UPDATE facility_tasks SET status = 'contract' WHERE task_type = 'as' AND status = 'as_contract';
UPDATE facility_tasks SET status = 'product_order' WHERE task_type = 'as' AND status = 'as_part_order';
UPDATE facility_tasks SET status = 'installation' WHERE task_type = 'as' AND status = 'as_completed';

DELETE FROM migration_log WHERE migration_name = 'as-status-migration-v1';

COMMIT;
*/