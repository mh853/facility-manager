-- 실사비 조정 필드 추가
-- 기본 실사비용(100,000원) 기준으로 조정할 금액을 저장
-- 양수: 실사비 증가, 음수: 실사비 감소

-- business_info 테이블에 survey_fee_adjustment 컬럼 추가
ALTER TABLE business_info
ADD COLUMN IF NOT EXISTS survey_fee_adjustment INTEGER DEFAULT NULL;

-- 컬럼 설명 추가
COMMENT ON COLUMN business_info.survey_fee_adjustment IS '실사비 조정 금액 (기본 100,000원 기준 ±조정, 양수=증가/음수=감소)';

-- 인덱스 추가 (선택사항: 조정이 있는 사업장을 빠르게 조회하기 위함)
CREATE INDEX IF NOT EXISTS idx_business_info_survey_fee_adjustment
ON business_info(survey_fee_adjustment)
WHERE survey_fee_adjustment IS NOT NULL;

-- 확인 쿼리
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_name = 'business_info'
  AND column_name = 'survey_fee_adjustment';
