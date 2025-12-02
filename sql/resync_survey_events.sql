-- survey_events 데이터 재동기화 스크립트
-- business_info의 기존 실사 정보를 survey_events로 동기화 (시간 필드 포함)

-- ========================================
-- 1. 기존 실사 이벤트 삭제 (재동기화 준비)
-- ========================================
DELETE FROM survey_events WHERE event_type = 'survey';

-- ========================================
-- 2. 견적실사 데이터 마이그레이션 (시간 필드 포함)
-- ========================================
INSERT INTO survey_events (
  id, title, event_date, start_time, end_time,
  labels, business_id, business_name,
  author_name, survey_type, created_at, updated_at
)
SELECT
  CONCAT('estimate-survey-', id::text),
  CONCAT(business_name, ' - 견적실사'),
  estimate_survey_date,
  estimate_survey_start_time,      -- ✅ 시간 필드
  estimate_survey_end_time,        -- ✅ 시간 필드
  ARRAY['견적실사']::TEXT[],
  id,
  business_name,
  COALESCE(estimate_survey_manager, '미지정'),
  'estimate_survey',
  NOW(),
  NOW()
FROM business_info
WHERE estimate_survey_date IS NOT NULL;

-- ========================================
-- 3. 착공전실사 데이터 마이그레이션 (시간 필드 포함)
-- ========================================
INSERT INTO survey_events (
  id, title, event_date, start_time, end_time,
  labels, business_id, business_name,
  author_name, survey_type, created_at, updated_at
)
SELECT
  CONCAT('pre-construction-survey-', id::text),
  CONCAT(business_name, ' - 착공전실사'),
  pre_construction_survey_date,
  pre_construction_survey_start_time,  -- ✅ 시간 필드
  pre_construction_survey_end_time,    -- ✅ 시간 필드
  ARRAY['착공전실사']::TEXT[],
  id,
  business_name,
  COALESCE(pre_construction_survey_manager, '미지정'),
  'pre_construction_survey',
  NOW(),
  NOW()
FROM business_info
WHERE pre_construction_survey_date IS NOT NULL;

-- ========================================
-- 4. 준공실사 데이터 마이그레이션 (시간 필드 포함)
-- ========================================
INSERT INTO survey_events (
  id, title, event_date, start_time, end_time,
  labels, business_id, business_name,
  author_name, survey_type, created_at, updated_at
)
SELECT
  CONCAT('completion-survey-', id::text),
  CONCAT(business_name, ' - 준공실사'),
  completion_survey_date,
  completion_survey_start_time,  -- ✅ 시간 필드
  completion_survey_end_time,    -- ✅ 시간 필드
  ARRAY['준공실사']::TEXT[],
  id,
  business_name,
  COALESCE(completion_survey_manager, '미지정'),
  'completion_survey',
  NOW(),
  NOW()
FROM business_info
WHERE completion_survey_date IS NOT NULL;

-- ========================================
-- 5. 동기화 결과 확인
-- ========================================
SELECT
  '✅ 동기화 완료' AS status,
  COUNT(*) AS total_survey_events,
  COUNT(CASE WHEN survey_type = 'estimate_survey' THEN 1 END) AS estimate_surveys,
  COUNT(CASE WHEN survey_type = 'pre_construction_survey' THEN 1 END) AS pre_construction_surveys,
  COUNT(CASE WHEN survey_type = 'completion_survey' THEN 1 END) AS completion_surveys
FROM survey_events
WHERE event_type = 'survey';

-- 샘플 데이터 확인
SELECT
  title,
  event_date,
  start_time,
  end_time,
  business_name,
  survey_type
FROM survey_events
WHERE event_type = 'survey'
ORDER BY event_date DESC
LIMIT 10;
