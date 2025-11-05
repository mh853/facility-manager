-- 영업점별 제조사별 수수료율 관리 시스템
-- 작성일: 2025-11-05

-- 1. 수수료율 테이블 생성
CREATE TABLE IF NOT EXISTS sales_office_commission_rates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sales_office TEXT NOT NULL,                     -- '원에너지', '푸른에너지' 등
  manufacturer TEXT NOT NULL,                      -- 'ecosense', 'gaia_cns', 'cleanearth', 'evs'
  commission_rate DECIMAL(5,2) NOT NULL,           -- 15.00, 20.00 등
  effective_from DATE NOT NULL DEFAULT CURRENT_DATE,
  effective_to DATE,                               -- NULL이면 현재 유효
  notes TEXT,                                      -- 변경 사유 등
  created_by UUID,                                 -- 생성자 (employees 테이블 참조)
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- 제약조건
  CONSTRAINT unique_active_rate
    UNIQUE(sales_office, manufacturer, effective_from),
  CONSTRAINT valid_rate_range
    CHECK (commission_rate >= 0 AND commission_rate <= 100),
  CONSTRAINT valid_date_range
    CHECK (effective_to IS NULL OR effective_to >= effective_from)
);

-- 2. 인덱스 생성
CREATE INDEX IF NOT EXISTS idx_sales_office_rates
  ON sales_office_commission_rates(sales_office, manufacturer);

CREATE INDEX IF NOT EXISTS idx_effective_dates
  ON sales_office_commission_rates(effective_from, effective_to);

CREATE INDEX IF NOT EXISTS idx_created_at
  ON sales_office_commission_rates(created_at DESC);

-- 3. 현재 유효한 수수료율 조회 뷰
CREATE OR REPLACE VIEW current_commission_rates AS
SELECT
  id,
  sales_office,
  manufacturer,
  commission_rate,
  effective_from,
  effective_to,
  notes,
  created_by,
  created_at
FROM sales_office_commission_rates
WHERE (effective_to IS NULL OR effective_to >= CURRENT_DATE)
  AND effective_from <= CURRENT_DATE
ORDER BY sales_office, manufacturer;

-- 4. 수수료율 변경 이력 조회 뷰 (생성자 정보 포함)
CREATE OR REPLACE VIEW commission_rate_history AS
SELECT
  r.id,
  r.sales_office,
  r.manufacturer,
  r.commission_rate,
  r.effective_from,
  r.effective_to,
  r.notes,
  r.created_at,
  r.updated_at,
  e.name AS created_by_name,
  e.email AS created_by_email,
  CASE
    WHEN r.effective_to IS NULL OR r.effective_to >= CURRENT_DATE THEN true
    ELSE false
  END AS is_current
FROM sales_office_commission_rates r
LEFT JOIN employees e ON r.created_by = e.id
ORDER BY r.sales_office, r.manufacturer, r.effective_from DESC;

-- 5. 업데이트 트리거 (updated_at 자동 갱신)
CREATE OR REPLACE FUNCTION update_commission_rates_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_commission_rates_updated_at
  BEFORE UPDATE ON sales_office_commission_rates
  FOR EACH ROW
  EXECUTE FUNCTION update_commission_rates_updated_at();

-- 6. 초기 데이터 설정 (예시)
-- 원에너지 수수료율 설정
INSERT INTO sales_office_commission_rates
  (sales_office, manufacturer, commission_rate, effective_from, notes)
VALUES
  ('원에너지', 'ecosense', 15.00, '2024-01-01', '초기 설정'),
  ('원에너지', 'gaia_cns', 20.00, '2024-01-01', '가이아씨앤에스 특별 수수료율'),
  ('원에너지', 'cleanearth', 15.00, '2024-01-01', '초기 설정'),
  ('원에너지', 'evs', 15.00, '2024-01-01', '초기 설정')
ON CONFLICT (sales_office, manufacturer, effective_from) DO NOTHING;

-- 다른 영업점 예시 (필요시 추가)
-- INSERT INTO sales_office_commission_rates
--   (sales_office, manufacturer, commission_rate, effective_from, notes)
-- SELECT
--   office,
--   manufacturer,
--   10.00,
--   '2024-01-01',
--   '초기 설정'
-- FROM
--   (VALUES ('푸른에너지'), ('그린에너지')) AS offices(office),
--   (VALUES ('ecosense'), ('gaia_cns'), ('cleanearth'), ('evs')) AS mfrs(manufacturer)
-- ON CONFLICT (sales_office, manufacturer, effective_from) DO NOTHING;

-- 7. 유용한 쿼리 예시

-- 특정 영업점의 현재 수수료율 조회
-- SELECT * FROM current_commission_rates WHERE sales_office = '원에너지';

-- 특정 영업점의 수수료율 변경 이력 조회
-- SELECT * FROM commission_rate_history WHERE sales_office = '원에너지';

-- 제조사별 평균 수수료율 조회
-- SELECT
--   manufacturer,
--   AVG(commission_rate) as avg_rate,
--   COUNT(DISTINCT sales_office) as office_count
-- FROM current_commission_rates
-- GROUP BY manufacturer;

-- 최근 수수료율 변경 내역
-- SELECT * FROM commission_rate_history
-- WHERE created_at >= NOW() - INTERVAL '30 days'
-- ORDER BY created_at DESC;
