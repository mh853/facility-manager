-- sql/add_reference_notes_to_estimates.sql
-- 견적서 이력에 참고사항 필드 추가

-- 참고사항 컬럼 추가
ALTER TABLE estimate_history
ADD COLUMN IF NOT EXISTS reference_notes TEXT;

COMMENT ON COLUMN estimate_history.reference_notes IS '견적서별 참고사항 (사용자 입력)';

-- 기존 데이터에 대한 기본값 설정 (선택사항)
UPDATE estimate_history
SET reference_notes = ''
WHERE reference_notes IS NULL;
