-- 제출일 컬럼 존재 여부 확인
SELECT
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'business_info'
  AND column_name IN (
    'construction_report_submitted_at',
    'greenlink_confirmation_submitted_at',
    'attachment_completion_submitted_at'
  )
ORDER BY column_name;

-- 결과 해석:
-- - 3개 행이 반환되면: 컬럼이 존재함 → 데이터만 입력하면 됨
-- - 0개 행이 반환되면: 컬럼이 없음 → SQL 마이그레이션 실행 필요
