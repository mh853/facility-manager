-- 계산서 및 입금 관리 시스템
-- business_info 테이블에 계산서/입금 필드 추가

-- ============================================
-- 보조금 사업장용 필드
-- ============================================

-- 1차 계산서
ALTER TABLE business_info ADD COLUMN IF NOT EXISTS invoice_1st_date DATE;
ALTER TABLE business_info ADD COLUMN IF NOT EXISTS invoice_1st_amount INTEGER DEFAULT 0;
ALTER TABLE business_info ADD COLUMN IF NOT EXISTS payment_1st_date DATE;
ALTER TABLE business_info ADD COLUMN IF NOT EXISTS payment_1st_amount INTEGER DEFAULT 0;

-- 2차 계산서
ALTER TABLE business_info ADD COLUMN IF NOT EXISTS invoice_2nd_date DATE;
ALTER TABLE business_info ADD COLUMN IF NOT EXISTS invoice_2nd_amount INTEGER DEFAULT 0;
ALTER TABLE business_info ADD COLUMN IF NOT EXISTS payment_2nd_date DATE;
ALTER TABLE business_info ADD COLUMN IF NOT EXISTS payment_2nd_amount INTEGER DEFAULT 0;

-- 추가공사비 계산서 (발행금액은 기존 additional_cost 사용)
ALTER TABLE business_info ADD COLUMN IF NOT EXISTS invoice_additional_date DATE;
ALTER TABLE business_info ADD COLUMN IF NOT EXISTS payment_additional_date DATE;
ALTER TABLE business_info ADD COLUMN IF NOT EXISTS payment_additional_amount INTEGER DEFAULT 0;

-- ============================================
-- 자비 사업장용 필드
-- ============================================

-- 선금 계산서 (기본 50%)
ALTER TABLE business_info ADD COLUMN IF NOT EXISTS invoice_advance_date DATE;
ALTER TABLE business_info ADD COLUMN IF NOT EXISTS invoice_advance_amount INTEGER DEFAULT 0;
ALTER TABLE business_info ADD COLUMN IF NOT EXISTS payment_advance_date DATE;
ALTER TABLE business_info ADD COLUMN IF NOT EXISTS payment_advance_amount INTEGER DEFAULT 0;

-- 잔금 계산서 (기본 50%)
ALTER TABLE business_info ADD COLUMN IF NOT EXISTS invoice_balance_date DATE;
ALTER TABLE business_info ADD COLUMN IF NOT EXISTS invoice_balance_amount INTEGER DEFAULT 0;
ALTER TABLE business_info ADD COLUMN IF NOT EXISTS payment_balance_date DATE;
ALTER TABLE business_info ADD COLUMN IF NOT EXISTS payment_balance_amount INTEGER DEFAULT 0;

-- ============================================
-- 인덱스 추가 (성능 최적화)
-- ============================================

-- 미수금 조회 최적화를 위한 인덱스
CREATE INDEX IF NOT EXISTS idx_business_info_invoice_dates
  ON business_info(invoice_1st_date, invoice_2nd_date, invoice_additional_date, invoice_advance_date, invoice_balance_date);

-- ============================================
-- 미수금 계산 뷰 (선택적)
-- ============================================

-- 보조금 사업장 미수금 계산 뷰
CREATE OR REPLACE VIEW v_subsidy_receivables AS
SELECT
  id,
  business_name,
  -- 1차 미수금
  COALESCE(invoice_1st_amount, 0) - COALESCE(payment_1st_amount, 0) as receivable_1st,
  -- 2차 미수금
  COALESCE(invoice_2nd_amount, 0) - COALESCE(payment_2nd_amount, 0) as receivable_2nd,
  -- 추가공사비 미수금
  COALESCE(additional_cost, 0) - COALESCE(payment_additional_amount, 0) as receivable_additional,
  -- 총 미수금
  (COALESCE(invoice_1st_amount, 0) - COALESCE(payment_1st_amount, 0)) +
  (COALESCE(invoice_2nd_amount, 0) - COALESCE(payment_2nd_amount, 0)) +
  (COALESCE(additional_cost, 0) - COALESCE(payment_additional_amount, 0)) as total_receivables
FROM business_info
WHERE business_category = '보조금';

-- 자비 사업장 미수금 계산 뷰
CREATE OR REPLACE VIEW v_self_receivables AS
SELECT
  id,
  business_name,
  -- 선금 미수금
  COALESCE(invoice_advance_amount, 0) - COALESCE(payment_advance_amount, 0) as receivable_advance,
  -- 잔금 미수금
  COALESCE(invoice_balance_amount, 0) - COALESCE(payment_balance_amount, 0) as receivable_balance,
  -- 총 미수금
  (COALESCE(invoice_advance_amount, 0) - COALESCE(payment_advance_amount, 0)) +
  (COALESCE(invoice_balance_amount, 0) - COALESCE(payment_balance_amount, 0)) as total_receivables
FROM business_info
WHERE business_category = '자비';

-- ============================================
-- 코멘트 추가 (문서화)
-- ============================================

COMMENT ON COLUMN business_info.invoice_1st_date IS '1차 계산서 발행일 (보조금)';
COMMENT ON COLUMN business_info.invoice_1st_amount IS '1차 계산서 발행금액 (보조금)';
COMMENT ON COLUMN business_info.payment_1st_date IS '1차 입금일';
COMMENT ON COLUMN business_info.payment_1st_amount IS '1차 입금금액';

COMMENT ON COLUMN business_info.invoice_2nd_date IS '2차 계산서 발행일 (보조금)';
COMMENT ON COLUMN business_info.invoice_2nd_amount IS '2차 계산서 발행금액 (보조금)';
COMMENT ON COLUMN business_info.payment_2nd_date IS '2차 입금일';
COMMENT ON COLUMN business_info.payment_2nd_amount IS '2차 입금금액';

COMMENT ON COLUMN business_info.invoice_additional_date IS '추가공사비 계산서 발행일 (보조금)';
COMMENT ON COLUMN business_info.payment_additional_date IS '추가공사비 입금일';
COMMENT ON COLUMN business_info.payment_additional_amount IS '추가공사비 입금금액';

COMMENT ON COLUMN business_info.invoice_advance_date IS '선금 계산서 발행일 (자비)';
COMMENT ON COLUMN business_info.invoice_advance_amount IS '선금 계산서 발행금액 (자비, 기본 50%)';
COMMENT ON COLUMN business_info.payment_advance_date IS '선금 입금일';
COMMENT ON COLUMN business_info.payment_advance_amount IS '선금 입금금액';

COMMENT ON COLUMN business_info.invoice_balance_date IS '잔금 계산서 발행일 (자비)';
COMMENT ON COLUMN business_info.invoice_balance_amount IS '잔금 계산서 발행금액 (자비, 기본 50%)';
COMMENT ON COLUMN business_info.payment_balance_date IS '잔금 입금일';
COMMENT ON COLUMN business_info.payment_balance_amount IS '잔금 입금금액';

-- ============================================
-- 샘플 데이터 (테스트용, 선택적)
-- ============================================

-- 보조금 사업장 예시
-- UPDATE business_info
-- SET
--   invoice_1st_date = '2025-01-15',
--   invoice_1st_amount = 10000000,
--   payment_1st_date = '2025-01-20',
--   payment_1st_amount = 10000000,
--   invoice_2nd_date = '2025-02-15',
--   invoice_2nd_amount = 5000000,
--   payment_2nd_date = NULL,
--   payment_2nd_amount = 0
-- WHERE business_name = '(주)가경스틸쇼트도장';

-- 자비 사업장 예시
-- UPDATE business_info
-- SET
--   invoice_advance_date = '2025-01-10',
--   invoice_advance_amount = 15000000,
--   payment_advance_date = '2025-01-15',
--   payment_advance_amount = 15000000,
--   invoice_balance_date = '2025-02-10',
--   invoice_balance_amount = 15000000,
--   payment_balance_date = NULL,
--   payment_balance_amount = 0
-- WHERE business_name = '(주)계산';
