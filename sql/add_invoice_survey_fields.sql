-- 계산서/입금 관리 및 실사 관리 필드 추가
-- Add invoice/payment and survey management fields to business_info table

-- 실사 관리 필드 추가
ALTER TABLE public.business_info
ADD COLUMN IF NOT EXISTS estimate_survey_manager VARCHAR(100),
ADD COLUMN IF NOT EXISTS estimate_survey_date DATE,
ADD COLUMN IF NOT EXISTS pre_construction_survey_manager VARCHAR(100),
ADD COLUMN IF NOT EXISTS pre_construction_survey_date DATE,
ADD COLUMN IF NOT EXISTS completion_survey_manager VARCHAR(100),
ADD COLUMN IF NOT EXISTS completion_survey_date DATE;

-- 계산서 및 입금 관리 필드 (보조금 사업장)
ALTER TABLE public.business_info
ADD COLUMN IF NOT EXISTS invoice_1st_date DATE,
ADD COLUMN IF NOT EXISTS invoice_1st_amount BIGINT,
ADD COLUMN IF NOT EXISTS payment_1st_date DATE,
ADD COLUMN IF NOT EXISTS payment_1st_amount BIGINT,
ADD COLUMN IF NOT EXISTS invoice_2nd_date DATE,
ADD COLUMN IF NOT EXISTS invoice_2nd_amount BIGINT,
ADD COLUMN IF NOT EXISTS payment_2nd_date DATE,
ADD COLUMN IF NOT EXISTS payment_2nd_amount BIGINT,
ADD COLUMN IF NOT EXISTS invoice_additional_date DATE,
ADD COLUMN IF NOT EXISTS payment_additional_date DATE,
ADD COLUMN IF NOT EXISTS payment_additional_amount BIGINT;

-- 계산서 및 입금 관리 필드 (자비 사업장)
ALTER TABLE public.business_info
ADD COLUMN IF NOT EXISTS invoice_advance_date DATE,
ADD COLUMN IF NOT EXISTS invoice_advance_amount BIGINT,
ADD COLUMN IF NOT EXISTS payment_advance_date DATE,
ADD COLUMN IF NOT EXISTS payment_advance_amount BIGINT,
ADD COLUMN IF NOT EXISTS invoice_balance_date DATE,
ADD COLUMN IF NOT EXISTS invoice_balance_amount BIGINT,
ADD COLUMN IF NOT EXISTS payment_balance_date DATE,
ADD COLUMN IF NOT EXISTS payment_balance_amount BIGINT;

-- 인덱스 추가 (검색 성능 향상)
CREATE INDEX IF NOT EXISTS idx_business_info_invoice_dates
ON public.business_info(invoice_1st_date, invoice_2nd_date, invoice_advance_date, invoice_balance_date);

CREATE INDEX IF NOT EXISTS idx_business_info_survey_dates
ON public.business_info(estimate_survey_date, pre_construction_survey_date, completion_survey_date);

-- 설명 추가
COMMENT ON COLUMN public.business_info.estimate_survey_manager IS '견적실사 담당자';
COMMENT ON COLUMN public.business_info.estimate_survey_date IS '견적실사일';
COMMENT ON COLUMN public.business_info.pre_construction_survey_manager IS '착공전실사 담당자';
COMMENT ON COLUMN public.business_info.pre_construction_survey_date IS '착공전실사일';
COMMENT ON COLUMN public.business_info.completion_survey_manager IS '준공실사 담당자';
COMMENT ON COLUMN public.business_info.completion_survey_date IS '준공실사일';

COMMENT ON COLUMN public.business_info.invoice_1st_date IS '1차 계산서 발행일';
COMMENT ON COLUMN public.business_info.invoice_1st_amount IS '1차 계산서 금액';
COMMENT ON COLUMN public.business_info.payment_1st_date IS '1차 입금일';
COMMENT ON COLUMN public.business_info.payment_1st_amount IS '1차 입금액';
COMMENT ON COLUMN public.business_info.invoice_2nd_date IS '2차 계산서 발행일';
COMMENT ON COLUMN public.business_info.invoice_2nd_amount IS '2차 계산서 금액';
COMMENT ON COLUMN public.business_info.payment_2nd_date IS '2차 입금일';
COMMENT ON COLUMN public.business_info.payment_2nd_amount IS '2차 입금액';
COMMENT ON COLUMN public.business_info.invoice_additional_date IS '추가공사 계산서 발행일';
COMMENT ON COLUMN public.business_info.payment_additional_date IS '추가공사 입금일';
COMMENT ON COLUMN public.business_info.payment_additional_amount IS '추가공사 입금액';

COMMENT ON COLUMN public.business_info.invoice_advance_date IS '선금 계산서 발행일';
COMMENT ON COLUMN public.business_info.invoice_advance_amount IS '선금 계산서 금액';
COMMENT ON COLUMN public.business_info.payment_advance_date IS '선금 입금일';
COMMENT ON COLUMN public.business_info.payment_advance_amount IS '선금 입금액';
COMMENT ON COLUMN public.business_info.invoice_balance_date IS '잔금 계산서 발행일';
COMMENT ON COLUMN public.business_info.invoice_balance_amount IS '잔금 계산서 금액';
COMMENT ON COLUMN public.business_info.payment_balance_date IS '잔금 입금일';
COMMENT ON COLUMN public.business_info.payment_balance_amount IS '잔금 입금액';
