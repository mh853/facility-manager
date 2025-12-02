-- 실사 관리와 일정 관리 통합 스키마
-- 사업장관리의 실사 정보를 일정관리 이벤트로 동기화

-- ========================================
-- 1. 실사 이벤트 통합 VIEW 생성
-- ========================================
-- 사업장관리의 실사 정보를 일정관리 형식으로 변환하는 VIEW
CREATE OR REPLACE VIEW survey_calendar_events AS
SELECT
  -- 견적실사 이벤트
  CONCAT('estimate-survey-', b.id::text) AS id, -- UUID를 TEXT로 변환
  CONCAT(b.business_name, ' - 견적실사') AS title,
  b.estimate_survey_date AS event_date,
  ARRAY['견적실사']::text[] AS labels,
  b.id AS business_id,
  b.business_name AS business_name,
  b.estimate_survey_manager AS author_name,
  'survey' AS event_type,
  'estimate_survey' AS survey_type,
  NOW() AS created_at,
  NOW() AS updated_at
FROM business_info b
WHERE b.estimate_survey_date IS NOT NULL

UNION ALL

SELECT
  -- 착공전실사 이벤트
  CONCAT('pre-construction-survey-', b.id::text) AS id, -- UUID를 TEXT로 변환
  CONCAT(b.business_name, ' - 착공전실사') AS title,
  b.pre_construction_survey_date AS event_date,
  ARRAY['착공전실사']::text[] AS labels,
  b.id AS business_id,
  b.business_name AS business_name,
  b.pre_construction_survey_manager AS author_name,
  'survey' AS event_type,
  'pre_construction_survey' AS survey_type,
  NOW() AS created_at,
  NOW() AS updated_at
FROM business_info b
WHERE b.pre_construction_survey_date IS NOT NULL

UNION ALL

SELECT
  -- 준공실사 이벤트
  CONCAT('completion-survey-', b.id::text) AS id, -- UUID를 TEXT로 변환
  CONCAT(b.business_name, ' - 준공실사') AS title,
  b.completion_survey_date AS event_date,
  ARRAY['준공실사']::text[] AS labels,
  b.id AS business_id,
  b.business_name AS business_name,
  b.completion_survey_manager AS author_name,
  'survey' AS event_type,
  'completion_survey' AS survey_type,
  NOW() AS created_at,
  NOW() AS updated_at
FROM business_info b
WHERE b.completion_survey_date IS NOT NULL;

-- ========================================
-- 2. 일정관리 전용 실사 이벤트 테이블 생성
-- ========================================
-- calendar_events 테이블과 별도로 실사 전용 이벤트 저장
CREATE TABLE IF NOT EXISTS survey_events (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  event_date DATE NOT NULL,
  labels TEXT[] DEFAULT ARRAY[]::TEXT[],
  business_id UUID, -- UUID 타입으로 변경 (business_info.id와 일치)
  business_name TEXT,
  author_name TEXT,
  event_type TEXT DEFAULT 'survey',
  survey_type TEXT, -- 'estimate_survey', 'pre_construction_survey', 'completion_survey'
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  -- 외래 키 제약조건 (business_info 테이블 참조)
  CONSTRAINT fk_business_info
    FOREIGN KEY (business_id)
    REFERENCES business_info(id)
    ON DELETE CASCADE
);

-- 인덱스 생성 (성능 최적화)
CREATE INDEX IF NOT EXISTS idx_survey_events_date
  ON survey_events(event_date);
CREATE INDEX IF NOT EXISTS idx_survey_events_business_id
  ON survey_events(business_id);
CREATE INDEX IF NOT EXISTS idx_survey_events_survey_type
  ON survey_events(survey_type);
CREATE INDEX IF NOT EXISTS idx_survey_events_labels
  ON survey_events USING GIN(labels);

-- ========================================
-- 3. 양방향 동기화 트리거 함수 생성
-- ========================================

-- 3-1. business_info 실사 정보 변경 → survey_events 동기화
CREATE OR REPLACE FUNCTION sync_business_to_survey_events()
RETURNS TRIGGER AS $$
BEGIN
  -- 🔒 무한 루프 방지: 이미 동기화 중이면 트리거 실행 안 함
  IF current_setting('app.syncing_survey', TRUE) = 'true' THEN
    RETURN NEW;
  END IF;

  -- 🔓 동기화 플래그 설정
  PERFORM set_config('app.syncing_survey', 'true', TRUE);

  -- 견적실사 동기화
  IF NEW.estimate_survey_date IS NOT NULL THEN
    INSERT INTO survey_events (
      id, title, event_date, labels, business_id, business_name,
      author_name, survey_type, updated_at
    )
    VALUES (
      CONCAT('estimate-survey-', NEW.id::text), -- UUID를 TEXT로 변환
      CONCAT(NEW.business_name, ' - 견적실사'),
      NEW.estimate_survey_date,
      ARRAY['견적실사']::TEXT[],
      NEW.id, -- UUID 타입 그대로 사용
      NEW.business_name,
      COALESCE(NEW.estimate_survey_manager, '미지정'),
      'estimate_survey',
      NOW()
    )
    ON CONFLICT (id) DO UPDATE SET
      title = EXCLUDED.title,
      event_date = EXCLUDED.event_date,
      business_name = EXCLUDED.business_name,
      author_name = EXCLUDED.author_name,
      updated_at = NOW();
  ELSE
    -- 날짜가 NULL이면 해당 이벤트 삭제
    DELETE FROM survey_events
    WHERE id = CONCAT('estimate-survey-', NEW.id::text);
  END IF;

  -- 착공전실사 동기화
  IF NEW.pre_construction_survey_date IS NOT NULL THEN
    INSERT INTO survey_events (
      id, title, event_date, labels, business_id, business_name,
      author_name, survey_type, updated_at
    )
    VALUES (
      CONCAT('pre-construction-survey-', NEW.id::text), -- UUID를 TEXT로 변환
      CONCAT(NEW.business_name, ' - 착공전실사'),
      NEW.pre_construction_survey_date,
      ARRAY['착공전실사']::TEXT[],
      NEW.id, -- UUID 타입 그대로 사용
      NEW.business_name,
      COALESCE(NEW.pre_construction_survey_manager, '미지정'),
      'pre_construction_survey',
      NOW()
    )
    ON CONFLICT (id) DO UPDATE SET
      title = EXCLUDED.title,
      event_date = EXCLUDED.event_date,
      business_name = EXCLUDED.business_name,
      author_name = EXCLUDED.author_name,
      updated_at = NOW();
  ELSE
    DELETE FROM survey_events
    WHERE id = CONCAT('pre-construction-survey-', NEW.id::text);
  END IF;

  -- 준공실사 동기화
  IF NEW.completion_survey_date IS NOT NULL THEN
    INSERT INTO survey_events (
      id, title, event_date, labels, business_id, business_name,
      author_name, survey_type, updated_at
    )
    VALUES (
      CONCAT('completion-survey-', NEW.id::text), -- UUID를 TEXT로 변환
      CONCAT(NEW.business_name, ' - 준공실사'),
      NEW.completion_survey_date,
      ARRAY['준공실사']::TEXT[],
      NEW.id, -- UUID 타입 그대로 사용
      NEW.business_name,
      COALESCE(NEW.completion_survey_manager, '미지정'),
      'completion_survey',
      NOW()
    )
    ON CONFLICT (id) DO UPDATE SET
      title = EXCLUDED.title,
      event_date = EXCLUDED.event_date,
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

-- 3-2. survey_events 변경 → business_info 역방향 동기화
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

  -- survey_type에 따라 business_info 업데이트
  IF survey_type_value = 'estimate_survey' THEN
    UPDATE business_info
    SET
      estimate_survey_date = NEW.event_date,
      estimate_survey_manager = NEW.author_name,
      updated_at = NOW()
    WHERE id = NEW.business_id;

  ELSIF survey_type_value = 'pre_construction_survey' THEN
    UPDATE business_info
    SET
      pre_construction_survey_date = NEW.event_date,
      pre_construction_survey_manager = NEW.author_name,
      updated_at = NOW()
    WHERE id = NEW.business_id;

  ELSIF survey_type_value = 'completion_survey' THEN
    UPDATE business_info
    SET
      completion_survey_date = NEW.event_date,
      completion_survey_manager = NEW.author_name,
      updated_at = NOW()
    WHERE id = NEW.business_id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ========================================
-- 4. 트리거 생성
-- ========================================

-- 4-1. business_info → survey_events 트리거
DROP TRIGGER IF EXISTS trigger_sync_business_to_survey ON business_info;
CREATE TRIGGER trigger_sync_business_to_survey
  AFTER INSERT OR UPDATE OF
    estimate_survey_date, estimate_survey_manager,
    pre_construction_survey_date, pre_construction_survey_manager,
    completion_survey_date, completion_survey_manager
  ON business_info
  FOR EACH ROW
  EXECUTE FUNCTION sync_business_to_survey_events();

-- 4-2. survey_events → business_info 트리거
DROP TRIGGER IF EXISTS trigger_sync_survey_to_business ON survey_events;
CREATE TRIGGER trigger_sync_survey_to_business
  AFTER INSERT OR UPDATE OF event_date, author_name
  ON survey_events
  FOR EACH ROW
  EXECUTE FUNCTION sync_survey_to_business_info();

-- ========================================
-- 5. 기존 데이터 초기 동기화
-- ========================================
-- business_info의 기존 실사 정보를 survey_events로 마이그레이션

-- 기존 survey_events 초기화 (실사 이벤트만)
DELETE FROM survey_events WHERE event_type = 'survey';

-- 견적실사 데이터 마이그레이션
INSERT INTO survey_events (
  id, title, event_date, labels, business_id, business_name,
  author_name, survey_type, created_at, updated_at
)
SELECT
  CONCAT('estimate-survey-', id::text), -- UUID를 TEXT로 변환
  CONCAT(business_name, ' - 견적실사'),
  estimate_survey_date,
  ARRAY['견적실사']::TEXT[],
  id, -- UUID 타입 그대로 사용
  business_name,
  COALESCE(estimate_survey_manager, '미지정'),
  'estimate_survey',
  NOW(),
  NOW()
FROM business_info
WHERE estimate_survey_date IS NOT NULL;

-- 착공전실사 데이터 마이그레이션
INSERT INTO survey_events (
  id, title, event_date, labels, business_id, business_name,
  author_name, survey_type, created_at, updated_at
)
SELECT
  CONCAT('pre-construction-survey-', id::text), -- UUID를 TEXT로 변환
  CONCAT(business_name, ' - 착공전실사'),
  pre_construction_survey_date,
  ARRAY['착공전실사']::TEXT[],
  id, -- UUID 타입 그대로 사용
  business_name,
  COALESCE(pre_construction_survey_manager, '미지정'),
  'pre_construction_survey',
  NOW(),
  NOW()
FROM business_info
WHERE pre_construction_survey_date IS NOT NULL;

-- 준공실사 데이터 마이그레이션
INSERT INTO survey_events (
  id, title, event_date, labels, business_id, business_name,
  author_name, survey_type, created_at, updated_at
)
SELECT
  CONCAT('completion-survey-', id::text), -- UUID를 TEXT로 변환
  CONCAT(business_name, ' - 준공실사'),
  completion_survey_date,
  ARRAY['준공실사']::TEXT[],
  id, -- UUID 타입 그대로 사용
  business_name,
  COALESCE(completion_survey_manager, '미지정'),
  'completion_survey',
  NOW(),
  NOW()
FROM business_info
WHERE completion_survey_date IS NOT NULL;

-- ========================================
-- 6. 검증 쿼리
-- ========================================

-- 동기화 상태 확인
SELECT
  '동기화된 실사 이벤트 수' AS 항목,
  COUNT(*) AS 개수
FROM survey_events
WHERE event_type = 'survey';

-- 실사 타입별 개수
SELECT
  survey_type,
  COUNT(*) AS 개수
FROM survey_events
GROUP BY survey_type
ORDER BY survey_type;

-- 최근 동기화된 이벤트 확인 (최근 10개)
SELECT
  title,
  event_date,
  business_name,
  author_name,
  survey_type,
  updated_at
FROM survey_events
WHERE event_type = 'survey'
ORDER BY updated_at DESC
LIMIT 10;
