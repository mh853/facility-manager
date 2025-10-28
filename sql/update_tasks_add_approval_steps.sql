-- Update facility_tasks to add approval stages and ensure all subdivision steps are included
-- Run this in Supabase SQL Editor

-- 1. Drop existing constraint
ALTER TABLE facility_tasks DROP CONSTRAINT IF EXISTS facility_tasks_status_check;

-- 2. Add new constraint with all statuses including approval stages
ALTER TABLE facility_tasks ADD CONSTRAINT facility_tasks_status_check
CHECK (status IN (
  -- 공통 단계
  'customer_contact', 'site_inspection', 'quotation', 'contract',
  -- 자비 설치 단계
  'deposit_confirm', 'product_order', 'product_shipment', 'installation_schedule',
  'installation', 'balance_payment', 'document_complete',
  -- 보조금 전용 단계
  'approval_pending', 'approved', 'rejected',
  'application_submit', 'document_supplement', 'pre_construction_inspection',
  -- 착공 보완 세분화
  'pre_construction_supplement_1st', 'pre_construction_supplement_2nd',
  'completion_inspection',
  -- 준공 보완 세분화
  'completion_supplement_1st', 'completion_supplement_2nd', 'completion_supplement_3rd',
  'final_document_submit', 'subsidy_payment'
));

COMMENT ON CONSTRAINT facility_tasks_status_check ON facility_tasks IS
'업무 상태 제약조건 - 승인 단계(approval_pending, approved, rejected) 및 보완 세분화 포함';
