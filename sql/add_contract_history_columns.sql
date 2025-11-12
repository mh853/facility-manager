-- ============================================
-- contract_history 테이블에 누락된 컬럼 추가
-- Created: 2025-11-11
-- ============================================

-- 모든 컬럼을 하나의 ALTER TABLE 문으로 추가
ALTER TABLE contract_history
ADD COLUMN IF NOT EXISTS business_registration_number TEXT,
ADD COLUMN IF NOT EXISTS business_phone TEXT,
ADD COLUMN IF NOT EXISTS business_fax TEXT,
ADD COLUMN IF NOT EXISTS supplier_company_name TEXT DEFAULT '주식회사 블루온',
ADD COLUMN IF NOT EXISTS supplier_representative TEXT DEFAULT '김 경 수',
ADD COLUMN IF NOT EXISTS supplier_address TEXT DEFAULT '경상북도 고령군 대가야읍 낫질로 285',
ADD COLUMN IF NOT EXISTS payment_advance_ratio INTEGER DEFAULT 50,
ADD COLUMN IF NOT EXISTS payment_balance_ratio INTEGER DEFAULT 50,
ADD COLUMN IF NOT EXISTS additional_cost NUMERIC(12, 2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS negotiation_cost NUMERIC(12, 2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS equipment_counts JSONB DEFAULT '{
  "ph_meter": 0,
  "differential_pressure_meter": 0,
  "temperature_meter": 0,
  "discharge_current_meter": 0,
  "fan_current_meter": 0,
  "pump_current_meter": 0,
  "gateway": 0,
  "vpn": 0
}'::jsonb,
ADD COLUMN IF NOT EXISTS terms_and_conditions TEXT;

-- 인덱스 추가 (검색 성능 향상)
CREATE INDEX IF NOT EXISTS idx_contract_history_business_registration
  ON contract_history(business_registration_number);
CREATE INDEX IF NOT EXISTS idx_contract_history_payment_ratio
  ON contract_history(payment_advance_ratio, payment_balance_ratio);

-- 코멘트 추가
COMMENT ON COLUMN contract_history.business_registration_number IS '사업자등록번호';
COMMENT ON COLUMN contract_history.business_phone IS '사업장 전화번호';
COMMENT ON COLUMN contract_history.business_fax IS '사업장 팩스번호';
COMMENT ON COLUMN contract_history.payment_advance_ratio IS '선금 비율 (%)';
COMMENT ON COLUMN contract_history.payment_balance_ratio IS '잔금 비율 (%)';
COMMENT ON COLUMN contract_history.additional_cost IS '추가공사비';
COMMENT ON COLUMN contract_history.negotiation_cost IS '협의금액(네고)';
COMMENT ON COLUMN contract_history.equipment_counts IS '장비 수량 정보 (JSON)';

-- 완료 메시지
DO $$
BEGIN
  RAISE NOTICE '✅ contract_history 테이블 컬럼 추가 완료';
  RAISE NOTICE '   - 사업자 상세 정보 (등록번호, 전화, 팩스)';
  RAISE NOTICE '   - 공급자 상세 정보';
  RAISE NOTICE '   - 대금 결제 비율 (선금/잔금)';
  RAISE NOTICE '   - 추가 비용 (추가공사비, 협의금액)';
  RAISE NOTICE '   - 장비 수량 정보 (JSONB)';
END $$;
