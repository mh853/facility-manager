-- revenue_calculations 테이블에 adjusted_sales_commission 컬럼 추가
-- 생성일: 2025-11-10
-- 설명: 영업비용 조정 값을 저장하기 위한 컬럼 추가

-- 1. adjusted_sales_commission 컬럼 추가 (NULL 허용, 기본값 없음)
ALTER TABLE revenue_calculations
ADD COLUMN IF NOT EXISTS adjusted_sales_commission DECIMAL(12,2);

-- 2. 컬럼 주석 추가
COMMENT ON COLUMN revenue_calculations.adjusted_sales_commission IS '조정된 영업비용 (operating_cost_adjustments 적용 후)';

-- 3. 인덱스 추가 (조회 성능 향상)
CREATE INDEX IF NOT EXISTS idx_revenue_calc_adjusted_commission
ON revenue_calculations(adjusted_sales_commission)
WHERE adjusted_sales_commission IS NOT NULL;

-- 4. 기존 데이터 마이그레이션 (선택사항)
-- 조정이 있는 사업장의 기존 계산 결과에 adjusted_sales_commission 업데이트
UPDATE revenue_calculations rc
SET adjusted_sales_commission = (
    CASE
        WHEN oca.adjustment_type = 'add' THEN rc.sales_commission + oca.adjustment_amount
        WHEN oca.adjustment_type = 'subtract' THEN rc.sales_commission - oca.adjustment_amount
        ELSE rc.sales_commission
    END
)
FROM operating_cost_adjustments oca
WHERE rc.business_id = oca.business_id
  AND rc.adjusted_sales_commission IS NULL;

-- 5. 검증 쿼리 (마이그레이션 후 확인용)
-- 조정이 있는데 adjusted_sales_commission이 NULL인 레코드 확인
SELECT
    rc.id,
    rc.business_name,
    rc.calculation_date,
    rc.sales_commission,
    rc.adjusted_sales_commission,
    oca.adjustment_amount,
    oca.adjustment_type
FROM revenue_calculations rc
LEFT JOIN operating_cost_adjustments oca ON rc.business_id = oca.business_id
WHERE oca.id IS NOT NULL
ORDER BY rc.calculation_date DESC
LIMIT 10;
