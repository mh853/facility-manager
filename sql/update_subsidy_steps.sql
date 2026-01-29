-- 보조금 업무 단계 업데이트
-- 날짜: 2026-01-29
-- 목적:
--   1. 'document_preparation' (신청서 작성 필요) 단계 추가
--   2. 기존 데이터와의 호환성 유지

-- ============================================
-- STEP 1: facility_tasks 테이블 status CHECK 제약 조건 업데이트
-- ============================================

-- 기존 제약 조건 삭제
ALTER TABLE facility_tasks
DROP CONSTRAINT IF EXISTS facility_tasks_status_check;

-- 새로운 제약 조건 생성 (document_preparation 추가)
ALTER TABLE facility_tasks
ADD CONSTRAINT facility_tasks_status_check
CHECK (status IN (
  -- 공통 단계
  'pending', 'site_survey', 'customer_contact', 'site_inspection', 'quotation', 'contract',
  -- 자비 단계
  'deposit_confirm', 'product_order', 'product_shipment', 'installation_schedule',
  'installation', 'balance_payment', 'document_complete',
  -- 보조금 단계
  'approval_pending', 'approved', 'rejected',
  'application_submit',
  'document_preparation',  -- ✨ 새로 추가
  'document_supplement',
  'pre_construction_inspection',
  -- 착공 보완 세분화
  'pre_construction_supplement_1st', 'pre_construction_supplement_2nd',
  'construction_report_submit',
  'pre_completion_document_submit', 'completion_inspection',
  -- 준공 보완 세분화
  'completion_supplement_1st', 'completion_supplement_2nd', 'completion_supplement_3rd',
  'final_document_submit', 'subsidy_payment',
  -- AS 전용 단계
  'as_customer_contact', 'as_site_inspection', 'as_quotation', 'as_contract',
  'as_part_order', 'as_completed',
  -- 기타
  'etc_status'
));

-- ============================================
-- STEP 2: 검증 - 새로운 status 값이 허용되는지 확인
-- ============================================

-- 테스트: document_preparation 상태로 업무 생성 가능 여부 확인
DO $$
BEGIN
  -- 임시 테스트 업무 생성
  INSERT INTO facility_tasks (
    title,
    business_name,
    task_type,
    status,
    priority
  ) VALUES (
    '[TEST] 신청서 작성 필요 단계 테스트',
    'TEST_BUSINESS',
    'subsidy',
    'document_preparation',
    'medium'
  );

  -- 테스트 업무 삭제
  DELETE FROM facility_tasks
  WHERE title = '[TEST] 신청서 작성 필요 단계 테스트'
    AND business_name = 'TEST_BUSINESS';

  RAISE NOTICE '✅ document_preparation 상태 추가 성공!';
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE '❌ 오류 발생: %', SQLERRM;
END $$;

-- ============================================
-- STEP 3: 현재 사용 중인 status 값 확인
-- ============================================

SELECT
  status,
  COUNT(*) as count,
  CASE
    WHEN status = 'document_preparation' THEN '✨ 새로 추가된 단계'
    WHEN status IN ('document_supplement', 'installation_schedule', 'installation', 'pre_completion_document_submit')
      THEN '🔄 워딩 변경 예정 (UI만)'
    ELSE '기존 단계'
  END as note
FROM facility_tasks
WHERE is_deleted = false
GROUP BY status
ORDER BY count DESC;

-- ============================================
-- 완료 메시지
-- ============================================

SELECT '✅ 보조금 업무 단계 업데이트 완료!' as message;
SELECT '📝 변경사항:' as summary;
SELECT '  1. document_preparation (신청서 작성 필요) 단계 추가' as change_1;
SELECT '  2. 프론트엔드 워딩 변경:' as change_2;
SELECT '     - 서류 보완 → 신청서 보완' as wording_1;
SELECT '     - 제품 설치 → 설치완료' as wording_2;
SELECT '     - 설치 협의 → 설치예정' as wording_3;
SELECT '     - 준공실사 전 서류 제출 → 준공도서 작성 필요' as wording_4;
