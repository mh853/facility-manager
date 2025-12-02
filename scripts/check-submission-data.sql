-- 실제 데이터베이스에서 제출일 데이터 확인
SELECT
  id,
  business_name AS "사업장명",
  construction_report_submitted_at AS "착공신고서",
  greenlink_confirmation_submitted_at AS "그린링크",
  attachment_completion_submitted_at AS "부착완료"
FROM public.business_info
WHERE
  construction_report_submitted_at IS NOT NULL
  OR greenlink_confirmation_submitted_at IS NOT NULL
  OR attachment_completion_submitted_at IS NOT NULL
ORDER BY updated_at DESC
LIMIT 10;

-- 만약 결과가 0개면: 데이터가 업로드되지 않았음
-- 만약 결과가 있으면: 특정 사업장만 문제
