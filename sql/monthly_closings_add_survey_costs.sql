-- 월마감 테이블에 실사비용 컬럼 추가
-- 파일: sql/monthly_closings_add_survey_costs.sql

-- 1. survey_costs 컬럼 추가
ALTER TABLE monthly_closings
ADD COLUMN IF NOT EXISTS survey_costs NUMERIC(12,2) NOT NULL DEFAULT 0;

-- 2. 컬럼 설명 추가
COMMENT ON COLUMN monthly_closings.survey_costs IS '총 실사비용 (견적서 + 착공 전 + 준공 실사비 + 조정금액 합계)';

-- 3. 인덱스 추가 (성능 최적화 - 선택사항)
CREATE INDEX IF NOT EXISTS idx_monthly_closings_survey_costs
ON monthly_closings(survey_costs)
WHERE survey_costs > 0;

-- 확인 쿼리
SELECT
  column_name,
  data_type,
  is_nullable,
  column_default,
  col_description('monthly_closings'::regclass, ordinal_position) as description
FROM information_schema.columns
WHERE table_name = 'monthly_closings'
  AND column_name IN ('survey_costs', 'total_cost', 'installation_costs')
ORDER BY ordinal_position;
