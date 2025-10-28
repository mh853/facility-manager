-- 업무 관리 테이블 보완 단계 세분화 업데이트
-- 착공 보완: 1차, 2차 / 준공 보완: 1차, 2차, 3차

-- 1. 보완 관련 추가 필드 먼저 생성
ALTER TABLE facility_tasks ADD COLUMN IF NOT EXISTS supplement_reason TEXT;
ALTER TABLE facility_tasks ADD COLUMN IF NOT EXISTS supplement_evidence TEXT;
ALTER TABLE facility_tasks ADD COLUMN IF NOT EXISTS supplement_completed_at TIMESTAMPTZ;
ALTER TABLE facility_tasks ADD COLUMN IF NOT EXISTS step_started_at TIMESTAMPTZ;

-- 2. 기존 데이터 마이그레이션 (기존 보완 단계를 1차로 변경) - 제약조건 제거 전에 실행
UPDATE facility_tasks
SET status = 'pre_construction_supplement_1st'
WHERE status = 'pre_construction_supplement';

UPDATE facility_tasks
SET status = 'completion_supplement_1st'
WHERE status = 'completion_supplement';

-- 3. 기존 status enum 제약조건 제거
ALTER TABLE facility_tasks DROP CONSTRAINT IF EXISTS facility_tasks_status_check;

-- 4. 새로운 status 제약조건 추가 (세분화된 보완 단계 포함)
ALTER TABLE facility_tasks ADD CONSTRAINT facility_tasks_status_check CHECK (status IN (
  -- 공통 단계
  'pending', 'site_survey', 'customer_contact', 'site_inspection', 'quotation', 'contract',
  -- 자비 단계
  'deposit_confirm', 'product_order', 'product_shipment', 'installation_schedule',
  'installation', 'balance_payment', 'document_complete',
  -- 보조금 단계
  'application_submit', 'document_supplement', 'document_preparation', 'pre_construction_inspection',
  -- 착공 보완 세분화
  'pre_construction_supplement_1st',  -- 착공 보완 1차
  'pre_construction_supplement_2nd',  -- 착공 보완 2차
  'completion_inspection',
  -- 준공 보완 세분화
  'completion_supplement_1st',        -- 준공 보완 1차
  'completion_supplement_2nd',        -- 준공 보완 2차
  'completion_supplement_3rd',        -- 준공 보완 3차
  'final_document_submit', 'subsidy_payment'
));

-- 5. 인덱스 추가
CREATE INDEX IF NOT EXISTS idx_facility_tasks_supplement_completed ON facility_tasks(supplement_completed_at);
CREATE INDEX IF NOT EXISTS idx_facility_tasks_step_started ON facility_tasks(step_started_at);

-- 6. 테이블 코멘트 업데이트
COMMENT ON COLUMN facility_tasks.supplement_reason IS '보완 요청 사유 - 각 보완 단계에서 보완이 필요한 이유';
COMMENT ON COLUMN facility_tasks.supplement_evidence IS '보완 완료 증빙 - 파일 경로나 증빙 메모';
COMMENT ON COLUMN facility_tasks.supplement_completed_at IS '보완 완료 일시';
COMMENT ON COLUMN facility_tasks.step_started_at IS '현재 단계 시작 일시';

-- 7. 단계 전환 함수 생성 (완료 버튼용)
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
    -- 보조금 워크플로우
    WHEN task_type = 'subsidy' THEN
      CASE current_status
        WHEN 'customer_contact' THEN 'site_inspection'
        WHEN 'site_inspection' THEN 'quotation'
        WHEN 'quotation' THEN 'contract'
        WHEN 'contract' THEN 'application_submit'
        WHEN 'application_submit' THEN 'document_supplement'
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

COMMENT ON FUNCTION advance_task_to_next_step IS '업무를 다음 단계로 자동 전환하는 함수 (완료 버튼용)';

-- 8. 테스트 쿼리 예시
-- SELECT * FROM advance_task_to_next_step('업무UUID', '보완 완료 메모');
