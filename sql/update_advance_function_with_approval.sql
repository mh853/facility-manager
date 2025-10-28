-- Update advance_task_to_next_step function to include approval stages
-- Run this in Supabase SQL Editor after running update_tasks_add_approval_steps.sql

CREATE OR REPLACE FUNCTION advance_task_to_next_step(
  task_id UUID,
  completion_notes TEXT DEFAULT NULL
)
RETURNS TABLE (
  success BOOLEAN,
  message TEXT,
  new_status VARCHAR(50)
) AS $$
DECLARE
  current_status VARCHAR(50);
  next_status VARCHAR(50);
  task_type VARCHAR(20);
BEGIN
  -- 현재 업무 정보 조회
  SELECT t.status, t.task_type INTO current_status, task_type
  FROM facility_tasks t
  WHERE t.id = task_id AND t.is_active = true AND t.is_deleted = false;

  IF NOT FOUND THEN
    RETURN QUERY SELECT false, '업무를 찾을 수 없습니다.', NULL::VARCHAR(50);
    RETURN;
  END IF;

  -- 다음 단계 결정 로직
  next_status := CASE
    -- 자비 워크플로우
    WHEN task_type = 'self' THEN
      CASE current_status
        WHEN 'customer_contact' THEN 'site_inspection'
        WHEN 'site_inspection' THEN 'quotation'
        WHEN 'quotation' THEN 'contract'
        WHEN 'contract' THEN 'deposit_confirm'
        WHEN 'deposit_confirm' THEN 'product_order'
        WHEN 'product_order' THEN 'product_shipment'
        WHEN 'product_shipment' THEN 'installation_schedule'
        WHEN 'installation_schedule' THEN 'installation'
        WHEN 'installation' THEN 'balance_payment'
        WHEN 'balance_payment' THEN 'document_complete'
        ELSE NULL
      END
    -- 보조금 워크플로우 (승인 단계는 신청서 제출 후)
    WHEN task_type = 'subsidy' THEN
      CASE current_status
        WHEN 'customer_contact' THEN 'site_inspection'
        WHEN 'site_inspection' THEN 'quotation'
        WHEN 'quotation' THEN 'application_submit'
        WHEN 'application_submit' THEN 'approval_pending'
        -- 보조금 승인 단계
        WHEN 'approval_pending' THEN 'approved'
        WHEN 'approved' THEN 'document_supplement'
        -- 탈락은 종료 상태 (다음 단계 없음)
        WHEN 'rejected' THEN NULL
        WHEN 'document_supplement' THEN 'pre_construction_inspection'
        WHEN 'pre_construction_inspection' THEN 'pre_construction_supplement_1st'
        -- 착공 보완 단계
        WHEN 'pre_construction_supplement_1st' THEN 'pre_construction_supplement_2nd'
        WHEN 'pre_construction_supplement_2nd' THEN 'product_order'
        WHEN 'product_order' THEN 'product_shipment'
        WHEN 'product_shipment' THEN 'installation_schedule'
        WHEN 'installation_schedule' THEN 'installation'
        WHEN 'installation' THEN 'completion_inspection'
        -- 준공 보완 단계
        WHEN 'completion_inspection' THEN 'completion_supplement_1st'
        WHEN 'completion_supplement_1st' THEN 'completion_supplement_2nd'
        WHEN 'completion_supplement_2nd' THEN 'completion_supplement_3rd'
        WHEN 'completion_supplement_3rd' THEN 'final_document_submit'
        WHEN 'final_document_submit' THEN 'subsidy_payment'
        ELSE NULL
      END
  END;

  IF next_status IS NULL THEN
    RETURN QUERY SELECT false, '다음 단계가 없거나 이미 완료된 업무입니다.', current_status;
    RETURN;
  END IF;

  -- 업무 상태 업데이트
  UPDATE facility_tasks
  SET
    status = next_status,
    supplement_completed_at = CASE
      WHEN current_status LIKE '%supplement%' THEN now()
      ELSE supplement_completed_at
    END,
    step_started_at = now(),
    notes = COALESCE(notes || E'\n\n', '') ||
            '【' || to_char(now(), 'YYYY-MM-DD HH24:MI') || '】 ' ||
            current_status || ' → ' || next_status ||
            COALESCE(E'\n메모: ' || completion_notes, ''),
    updated_at = now()
  WHERE id = task_id;

  RETURN QUERY SELECT true, '다음 단계로 이동되었습니다.', next_status;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION advance_task_to_next_step IS '업무를 다음 단계로 자동 전환하는 함수 (완료 버튼용) - 승인 단계 포함';

-- 테스트 쿼리
-- SELECT * FROM advance_task_to_next_step('업무UUID', '승인 완료');
