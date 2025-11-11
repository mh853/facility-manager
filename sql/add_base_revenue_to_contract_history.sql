-- contract_history 테이블에 base_revenue 및 final_amount 컬럼 추가
-- base_revenue: 기본 매출 (기기 합계, 조정 전)
-- final_amount: 최종 매출 (기본 + 추가공사비 - 협의사항)

ALTER TABLE contract_history
ADD COLUMN IF NOT EXISTS base_revenue NUMERIC(12, 2);

ALTER TABLE contract_history
ADD COLUMN IF NOT EXISTS final_amount NUMERIC(12, 2);

-- 기존 데이터는 total_amount를 final_amount로 복사 (호환성)
UPDATE contract_history
SET final_amount = total_amount
WHERE final_amount IS NULL;

-- 기존 데이터는 total_amount를 base_revenue로도 설정 (정확하지 않지만 fallback)
UPDATE contract_history
SET base_revenue = total_amount
WHERE base_revenue IS NULL;

COMMENT ON COLUMN contract_history.base_revenue IS '기본 매출 (기기 합계, 조정 전)';
COMMENT ON COLUMN contract_history.final_amount IS '최종 매출 (기본 + 추가공사비 - 협의사항)';
COMMENT ON COLUMN contract_history.total_amount IS '(구버전 호환용) 기본 매출과 동일하게 유지';
