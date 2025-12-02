-- 사업장 관리 - 제출일 필드 추가
-- 착공신고서, 그린링크 전송확인서, 부착완료통보서 제출일

-- 1. business_info 테이블에 3개 필드 추가
ALTER TABLE public.business_info
ADD COLUMN IF NOT EXISTS construction_report_submitted_at DATE,
ADD COLUMN IF NOT EXISTS greenlink_confirmation_submitted_at DATE,
ADD COLUMN IF NOT EXISTS attachment_completion_submitted_at DATE;

-- 2. 필터링 성능 최적화를 위한 Partial Index 생성
-- (NULL이 아닌 레코드만 인덱싱하여 효율성 향상)
CREATE INDEX IF NOT EXISTS idx_business_construction_report
ON public.business_info(construction_report_submitted_at)
WHERE construction_report_submitted_at IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_business_greenlink_confirmation
ON public.business_info(greenlink_confirmation_submitted_at)
WHERE greenlink_confirmation_submitted_at IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_business_attachment_completion
ON public.business_info(attachment_completion_submitted_at)
WHERE attachment_completion_submitted_at IS NOT NULL;

-- 3. updated_at 자동 갱신 트리거 함수 (기존에 없는 경우)
CREATE OR REPLACE FUNCTION update_business_info_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 4. 트리거 생성 (이미 존재하면 건너뜀)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname = 'update_business_info_timestamp_trigger'
  ) THEN
    CREATE TRIGGER update_business_info_timestamp_trigger
    BEFORE UPDATE ON public.business_info
    FOR EACH ROW
    EXECUTE FUNCTION update_business_info_timestamp();
  END IF;
END
$$;

-- 5. 스키마 변경 확인 쿼리
SELECT
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns
WHERE table_name = 'business_info'
  AND column_name IN (
    'construction_report_submitted_at',
    'greenlink_confirmation_submitted_at',
    'attachment_completion_submitted_at'
  )
ORDER BY column_name;

-- 6. 인덱스 확인 쿼리
SELECT
  indexname,
  indexdef
FROM pg_indexes
WHERE tablename = 'business_info'
  AND indexname LIKE 'idx_business_%submitted%'
ORDER BY indexname;
