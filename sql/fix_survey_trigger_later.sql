-- business_info 테이블 생성 후 나중에 트리거 문제를 해결하는 스크립트
-- Deadlock 없이 안전하게 트리거 제거

-- ⚠️ 주의: 이 스크립트는 다른 세션이 business_info를 사용하지 않을 때 실행하세요

-- 1. 활성 세션 확인 (참고용)
SELECT
    pid,
    usename,
    application_name,
    state,
    query
FROM pg_stat_activity
WHERE datname = current_database()
AND state = 'active'
AND query NOT LIKE '%pg_stat_activity%';

-- 2. 기존 트리거 확인
SELECT
    trigger_name,
    event_manipulation,
    event_object_table,
    action_statement
FROM information_schema.triggers
WHERE event_object_table = 'business_info';

-- 3. survey_events 관련 트리거만 제거 (있다면)
DO $$
BEGIN
  -- trigger_sync_business_to_survey 제거
  IF EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname = 'trigger_sync_business_to_survey'
  ) THEN
    DROP TRIGGER trigger_sync_business_to_survey ON business_info;
    RAISE NOTICE '✅ trigger_sync_business_to_survey 제거 완료';
  ELSE
    RAISE NOTICE '⏭️ trigger_sync_business_to_survey가 존재하지 않습니다';
  END IF;

  -- sync_business_to_survey_events 함수 제거
  IF EXISTS (
    SELECT 1 FROM pg_proc
    WHERE proname = 'sync_business_to_survey_events'
  ) THEN
    DROP FUNCTION IF EXISTS sync_business_to_survey_events() CASCADE;
    RAISE NOTICE '✅ sync_business_to_survey_events 함수 제거 완료';
  ELSE
    RAISE NOTICE '⏭️ sync_business_to_survey_events 함수가 존재하지 않습니다';
  END IF;
END $$;

-- 4. 최종 확인: business_info 테이블의 트리거 목록
SELECT
    trigger_name,
    event_object_table,
    action_statement
FROM information_schema.triggers
WHERE event_object_table = 'business_info';

-- 완료 메시지
DO $$
BEGIN
    RAISE NOTICE '========================================';
    RAISE NOTICE '✅ survey_events 관련 트리거 정리 완료';
    RAISE NOTICE '이제 business_info 테이블을 안전하게 사용할 수 있습니다';
    RAISE NOTICE '========================================';
END $$;
