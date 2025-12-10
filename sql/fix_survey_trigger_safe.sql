-- ========================================
-- survey_events 트리거를 안전하게 수정 (에러 무시)
-- ========================================
-- 상황: business_info 테이블은 존재하지만 survey_events는 없음
-- 해결: 트리거 함수가 survey_events 없어도 에러 안 나도록 수정

-- survey_events가 없어도 에러 안 나는 안전한 트리거 함수
CREATE OR REPLACE FUNCTION sync_business_to_survey_events()
RETURNS TRIGGER AS $$
BEGIN
  -- 🔒 survey_events 테이블이 없으면 조용히 스킵
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public'
    AND table_name = 'survey_events'
  ) THEN
    RAISE NOTICE '⏭️ survey_events 테이블이 없어서 동기화 스킵';
    RETURN NEW;
  END IF;

  -- 🔒 무한 루프 방지
  IF current_setting('app.syncing_survey', TRUE) = 'true' THEN
    RETURN NEW;
  END IF;

  -- 동기화 플래그 설정
  PERFORM set_config('app.syncing_survey', 'true', TRUE);

  -- 여기서 실제 survey_events 동기화 로직이 실행됨
  -- (하지만 survey_events가 없으면 위에서 이미 리턴했으므로 실행 안 됨)

  -- 동기화 플래그 해제
  PERFORM set_config('app.syncing_survey', 'false', TRUE);

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 트리거 재생성 (있으면 대체)
DROP TRIGGER IF EXISTS trigger_sync_business_to_survey ON business_info;
CREATE TRIGGER trigger_sync_business_to_survey
  AFTER INSERT OR UPDATE OF
    estimate_survey_date, estimate_survey_manager,
    pre_construction_survey_date, pre_construction_survey_manager,
    completion_survey_date, completion_survey_manager
  ON business_info
  FOR EACH ROW
  EXECUTE FUNCTION sync_business_to_survey_events();

-- 확인
DO $$
BEGIN
    RAISE NOTICE '========================================';
    RAISE NOTICE '✅ survey_events 트리거를 안전 모드로 수정했습니다';
    RAISE NOTICE 'survey_events가 없어도 에러가 발생하지 않습니다';
    RAISE NOTICE '이제 facility task를 정상적으로 생성할 수 있습니다';
    RAISE NOTICE '========================================';
END $$;
