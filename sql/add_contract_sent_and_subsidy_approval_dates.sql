-- 사업장 관리 - 계약서 발송일, 보조금 승인일 필드 추가
-- 일정 관리 영역에 표시될 날짜 필드

-- 1. business_info 테이블에 2개 필드 추가
ALTER TABLE public.business_info
ADD COLUMN IF NOT EXISTS contract_sent_date DATE,
ADD COLUMN IF NOT EXISTS subsidy_approval_date DATE;

-- 2. 컬럼 주석 추가
COMMENT ON COLUMN public.business_info.contract_sent_date IS '계약서 발송일';
COMMENT ON COLUMN public.business_info.subsidy_approval_date IS '보조금 승인일';

-- 3. 필터링 성능 최적화를 위한 Partial Index 생성
-- (NULL이 아닌 레코드만 인덱싱하여 효율성 향상)
CREATE INDEX IF NOT EXISTS idx_business_contract_sent_date
ON public.business_info(contract_sent_date)
WHERE contract_sent_date IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_business_subsidy_approval_date
ON public.business_info(subsidy_approval_date)
WHERE subsidy_approval_date IS NOT NULL;

-- 4. 스키마 변경 확인 쿼리
SELECT
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_name = 'business_info'
  AND column_name IN (
    'contract_sent_date',
    'subsidy_approval_date'
  )
ORDER BY column_name;

-- 5. 인덱스 확인 쿼리
SELECT
  indexname,
  indexdef
FROM pg_indexes
WHERE tablename = 'business_info'
  AND (
    indexname = 'idx_business_contract_sent_date'
    OR indexname = 'idx_business_subsidy_approval_date'
  )
ORDER BY indexname;
