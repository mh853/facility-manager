-- 실사 동기화 트리거 함수 업데이트
-- 시간 필드 양방향 동기화 추가

-- ========================================
-- 1. business_info → survey_events 동기화 (시간 필드 포함)
-- ========================================
CREATE OR REPLACE FUNCTION sync_business_to_survey_events()
RETURNS TRIGGER AS $$
BEGIN
  -- 🔒 무한 루프 방지: 이미 동기화 중이면 트리거 실행 안 함
  IF current_setting('app.syncing_survey', TRUE) = 'true' THEN
    RETURN NEW;
  END IF;

  -- 🔓 동기화 플래그 설정
  PERFORM set_config('app.syncing_survey', 'true', TRUE);

  -- 견적실사 동기화 (날짜 + 시간)
  IF NEW.estimate_survey_date IS NOT NULL THEN
    INSERT INTO survey_events (
      id, title, event_date, start_time, end_time,
      labels, business_id, business_name,
      author_name, survey_type, updated_at
    )
    VALUES (
      CONCAT('estimate-survey-', NEW.id::text),
      CONCAT(NEW.business_name, ' - 견적실사'),
      NEW.estimate_survey_date,
      NEW.estimate_survey_start_time,  -- ✅ 시간 필드 추가
      NEW.estimate_survey_end_time,    -- ✅ 시간 필드 추가
      ARRAY['견적실사']::TEXT[],
      NEW.id,
      NEW.business_name,
      COALESCE(NEW.estimate_survey_manager, '미지정'),
      'estimate_survey',
      NOW()
    )
    ON CONFLICT (id) DO UPDATE SET
      title = EXCLUDED.title,
      event_date = EXCLUDED.event_date,
      start_time = EXCLUDED.start_time,      -- ✅ 시간 필드 추가
      end_time = EXCLUDED.end_time,          -- ✅ 시간 필드 추가
      business_name = EXCLUDED.business_name,
      author_name = EXCLUDED.author_name,
      updated_at = NOW();
  ELSE
    DELETE FROM survey_events
    WHERE id = CONCAT('estimate-survey-', NEW.id::text);
  END IF;

  -- 착공전실사 동기화 (날짜 + 시간)
  IF NEW.pre_construction_survey_date IS NOT NULL THEN
    INSERT INTO survey_events (
      id, title, event_date, start_time, end_time,
      labels, business_id, business_name,
      author_name, survey_type, updated_at
    )
    VALUES (
      CONCAT('pre-construction-survey-', NEW.id::text),
      CONCAT(NEW.business_name, ' - 착공전실사'),
      NEW.pre_construction_survey_date,
      NEW.pre_construction_survey_start_time,  -- ✅ 시간 필드 추가
      NEW.pre_construction_survey_end_time,    -- ✅ 시간 필드 추가
      ARRAY['착공전실사']::TEXT[],
      NEW.id,
      NEW.business_name,
      COALESCE(NEW.pre_construction_survey_manager, '미지정'),
      'pre_construction_survey',
      NOW()
    )
    ON CONFLICT (id) DO UPDATE SET
      title = EXCLUDED.title,
      event_date = EXCLUDED.event_date,
      start_time = EXCLUDED.start_time,      -- ✅ 시간 필드 추가
      end_time = EXCLUDED.end_time,          -- ✅ 시간 필드 추가
      business_name = EXCLUDED.business_name,
      author_name = EXCLUDED.author_name,
      updated_at = NOW();
  ELSE
    DELETE FROM survey_events
    WHERE id = CONCAT('pre-construction-survey-', NEW.id::text);
  END IF;

  -- 준공실사 동기화 (날짜 + 시간)
  IF NEW.completion_survey_date IS NOT NULL THEN
    INSERT INTO survey_events (
      id, title, event_date, start_time, end_time,
      labels, business_id, business_name,
      author_name, survey_type, updated_at
    )
    VALUES (
      CONCAT('completion-survey-', NEW.id::text),
      CONCAT(NEW.business_name, ' - 준공실사'),
      NEW.completion_survey_date,
      NEW.completion_survey_start_time,  -- ✅ 시간 필드 추가
      NEW.completion_survey_end_time,    -- ✅ 시간 필드 추가
      ARRAY['준공실사']::TEXT[],
      NEW.id,
      NEW.business_name,
      COALESCE(NEW.completion_survey_manager, '미지정'),
      'completion_survey',
      NOW()
    )
    ON CONFLICT (id) DO UPDATE SET
      title = EXCLUDED.title,
      event_date = EXCLUDED.event_date,
      start_time = EXCLUDED.start_time,      -- ✅ 시간 필드 추가
      end_time = EXCLUDED.end_time,          -- ✅ 시간 필드 추가
      business_name = EXCLUDED.business_name,
      author_name = EXCLUDED.author_name,
      updated_at = NOW();
  ELSE
    DELETE FROM survey_events
    WHERE id = CONCAT('completion-survey-', NEW.id::text);
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ========================================
-- 2. survey_events → business_info 역방향 동기화 (시간 필드 포함)
-- ========================================
CREATE OR REPLACE FUNCTION sync_survey_to_business_info()
RETURNS TRIGGER AS $$
DECLARE
  survey_type_value TEXT;
BEGIN
  -- 🔒 무한 루프 방지: 이미 동기화 중이면 트리거 실행 안 함
  IF current_setting('app.syncing_survey', TRUE) = 'true' THEN
    RETURN NEW;
  END IF;

  -- 🔓 동기화 플래그 설정
  PERFORM set_config('app.syncing_survey', 'true', TRUE);

  survey_type_value := NEW.survey_type;

  -- survey_type에 따라 business_info 업데이트 (날짜 + 시간)
  IF survey_type_value = 'estimate_survey' THEN
    UPDATE business_info
    SET
      estimate_survey_date = NEW.event_date,
      estimate_survey_start_time = NEW.start_time,      -- ✅ 시간 필드 추가
      estimate_survey_end_time = NEW.end_time,          -- ✅ 시간 필드 추가
      estimate_survey_manager = NEW.author_name,
      updated_at = NOW()
    WHERE id = NEW.business_id;

  ELSIF survey_type_value = 'pre_construction_survey' THEN
    UPDATE business_info
    SET
      pre_construction_survey_date = NEW.event_date,
      pre_construction_survey_start_time = NEW.start_time,  -- ✅ 시간 필드 추가
      pre_construction_survey_end_time = NEW.end_time,      -- ✅ 시간 필드 추가
      pre_construction_survey_manager = NEW.author_name,
      updated_at = NOW()
    WHERE id = NEW.business_id;

  ELSIF survey_type_value = 'completion_survey' THEN
    UPDATE business_info
    SET
      completion_survey_date = NEW.event_date,
      completion_survey_start_time = NEW.start_time,  -- ✅ 시간 필드 추가
      completion_survey_end_time = NEW.end_time,      -- ✅ 시간 필드 추가
      completion_survey_manager = NEW.author_name,
      updated_at = NOW()
    WHERE id = NEW.business_id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ========================================
-- 3. 트리거 재생성 (시간 필드 감지 추가)
-- ========================================

-- 3-1. business_info → survey_events 트리거
DROP TRIGGER IF EXISTS trigger_sync_business_to_survey ON business_info;
CREATE TRIGGER trigger_sync_business_to_survey
  AFTER INSERT OR UPDATE OF
    estimate_survey_date, estimate_survey_start_time, estimate_survey_end_time, estimate_survey_manager,
    pre_construction_survey_date, pre_construction_survey_start_time, pre_construction_survey_end_time, pre_construction_survey_manager,
    completion_survey_date, completion_survey_start_time, completion_survey_end_time, completion_survey_manager
  ON business_info
  FOR EACH ROW
  EXECUTE FUNCTION sync_business_to_survey_events();

-- 3-2. survey_events → business_info 트리거
DROP TRIGGER IF EXISTS trigger_sync_survey_to_business ON survey_events;
CREATE TRIGGER trigger_sync_survey_to_business
  AFTER INSERT OR UPDATE OF event_date, start_time, end_time, author_name
  ON survey_events
  FOR EACH ROW
  EXECUTE FUNCTION sync_survey_to_business_info();

-- ========================================
-- 4. 검증 쿼리
-- ========================================

-- 시간 정보가 포함된 이벤트 확인
SELECT
  title,
  event_date,
  start_time,
  end_time,
  business_name,
  survey_type
FROM survey_events
WHERE event_type = 'survey'
  AND (start_time IS NOT NULL OR end_time IS NOT NULL)
ORDER BY event_date DESC
LIMIT 10;

-- business_info에서 시간 정보 확인
SELECT
  business_name,
  estimate_survey_date,
  estimate_survey_start_time,
  estimate_survey_end_time,
  pre_construction_survey_date,
  pre_construction_survey_start_time,
  pre_construction_survey_end_time,
  completion_survey_date,
  completion_survey_start_time,
  completion_survey_end_time
FROM business_info
WHERE
  estimate_survey_start_time IS NOT NULL
  OR pre_construction_survey_start_time IS NOT NULL
  OR completion_survey_start_time IS NOT NULL
LIMIT 10;

-- ========================================
-- 주의사항
-- ========================================
-- 1. 이 스크립트는 add_time_to_survey_events.sql과 add_time_to_business_info_surveys.sql 실행 후 적용
-- 2. 기존 트리거 함수를 덮어쓰므로 백업 권장
-- 3. 양방향 시간 동기화가 자동으로 이루어짐
-- 4. 무한 루프 방지 로직 유지됨
