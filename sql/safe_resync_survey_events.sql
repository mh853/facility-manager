-- 안전한 survey_events 재동기화 스크립트
-- 데드락 방지를 위한 배치 처리 및 트랜잭션 분리

-- ========================================
-- 주의사항
-- ========================================
-- 1. 이 스크립트는 각 블록을 순차적으로 실행하세요 (전체 실행 X)
-- 2. 각 블록 실행 후 결과를 확인하고 다음 블록으로 진행
-- 3. 오류 발생 시 즉시 중단하고 문제 해결 후 재시도

-- ========================================
-- 0. 사전 확인: 현재 데이터 개수
-- ========================================
SELECT
  'business_info 실사 데이터' AS category,
  COUNT(CASE WHEN estimate_survey_date IS NOT NULL THEN 1 END) AS estimate_count,
  COUNT(CASE WHEN pre_construction_survey_date IS NOT NULL THEN 1 END) AS pre_construction_count,
  COUNT(CASE WHEN completion_survey_date IS NOT NULL THEN 1 END) AS completion_count
FROM business_info

UNION ALL

SELECT
  'survey_events 기존 데이터' AS category,
  COUNT(CASE WHEN survey_type = 'estimate_survey' THEN 1 END),
  COUNT(CASE WHEN survey_type = 'pre_construction_survey' THEN 1 END),
  COUNT(CASE WHEN survey_type = 'completion_survey' THEN 1 END)
FROM survey_events
WHERE event_type = 'survey';

-- ========================================
-- 1단계: 기존 실사 이벤트 삭제 (소량씩)
-- ========================================
-- 💡 한 번에 모두 삭제하지 않고 타입별로 나눠서 삭제
-- 💡 각 DELETE 후 COMMIT되므로 데드락 위험 감소

-- 1-1. 견적실사 이벤트 삭제
DELETE FROM survey_events
WHERE event_type = 'survey'
  AND survey_type = 'estimate_survey';
-- 결과 확인 후 계속

-- 1-2. 착공전실사 이벤트 삭제
DELETE FROM survey_events
WHERE event_type = 'survey'
  AND survey_type = 'pre_construction_survey';
-- 결과 확인 후 계속

-- 1-3. 준공실사 이벤트 삭제
DELETE FROM survey_events
WHERE event_type = 'survey'
  AND survey_type = 'completion_survey';
-- 결과 확인 후 계속

-- ========================================
-- 확인: 삭제 완료 검증
-- ========================================
SELECT COUNT(*) AS remaining_survey_events
FROM survey_events
WHERE event_type = 'survey';
-- 결과: 0이어야 함

-- ========================================
-- 2단계: 견적실사 데이터 마이그레이션
-- ========================================
-- 💡 트리거가 작동하지 않도록 app.syncing_survey 플래그 설정
DO $$
BEGIN
  -- 동기화 플래그 설정 (트리거 비활성화)
  PERFORM set_config('app.syncing_survey', 'true', false);

  -- 견적실사 데이터 삽입
  INSERT INTO survey_events (
    id, title, event_date, start_time, end_time,
    labels, business_id, business_name,
    author_name, survey_type, created_at, updated_at
  )
  SELECT
    CONCAT('estimate-survey-', id::text),
    CONCAT(business_name, ' - 견적실사'),
    estimate_survey_date,
    estimate_survey_start_time,
    estimate_survey_end_time,
    ARRAY['견적실사']::TEXT[],
    id,
    business_name,
    COALESCE(estimate_survey_manager, '미지정'),
    'estimate_survey',
    NOW(),
    NOW()
  FROM business_info
  WHERE estimate_survey_date IS NOT NULL;

  -- 플래그 해제
  PERFORM set_config('app.syncing_survey', 'false', false);

  RAISE NOTICE '✅ 견적실사 % 건 마이그레이션 완료',
    (SELECT COUNT(*) FROM survey_events WHERE survey_type = 'estimate_survey');
END $$;

-- ========================================
-- 확인: 견적실사 마이그레이션 검증
-- ========================================
SELECT
  COUNT(*) AS migrated_count,
  MIN(event_date) AS earliest_date,
  MAX(event_date) AS latest_date
FROM survey_events
WHERE survey_type = 'estimate_survey';

-- ========================================
-- 3단계: 착공전실사 데이터 마이그레이션
-- ========================================
DO $$
BEGIN
  PERFORM set_config('app.syncing_survey', 'true', false);

  INSERT INTO survey_events (
    id, title, event_date, start_time, end_time,
    labels, business_id, business_name,
    author_name, survey_type, created_at, updated_at
  )
  SELECT
    CONCAT('pre-construction-survey-', id::text),
    CONCAT(business_name, ' - 착공전실사'),
    pre_construction_survey_date,
    pre_construction_survey_start_time,
    pre_construction_survey_end_time,
    ARRAY['착공전실사']::TEXT[],
    id,
    business_name,
    COALESCE(pre_construction_survey_manager, '미지정'),
    'pre_construction_survey',
    NOW(),
    NOW()
  FROM business_info
  WHERE pre_construction_survey_date IS NOT NULL;

  PERFORM set_config('app.syncing_survey', 'false', false);

  RAISE NOTICE '✅ 착공전실사 % 건 마이그레이션 완료',
    (SELECT COUNT(*) FROM survey_events WHERE survey_type = 'pre_construction_survey');
END $$;

-- ========================================
-- 확인: 착공전실사 마이그레이션 검증
-- ========================================
SELECT
  COUNT(*) AS migrated_count,
  MIN(event_date) AS earliest_date,
  MAX(event_date) AS latest_date
FROM survey_events
WHERE survey_type = 'pre_construction_survey';

-- ========================================
-- 4단계: 준공실사 데이터 마이그레이션
-- ========================================
DO $$
BEGIN
  PERFORM set_config('app.syncing_survey', 'true', false);

  INSERT INTO survey_events (
    id, title, event_date, start_time, end_time,
    labels, business_id, business_name,
    author_name, survey_type, created_at, updated_at
  )
  SELECT
    CONCAT('completion-survey-', id::text),
    CONCAT(business_name, ' - 준공실사'),
    completion_survey_date,
    completion_survey_start_time,
    completion_survey_end_time,
    ARRAY['준공실사']::TEXT[],
    id,
    business_name,
    COALESCE(completion_survey_manager, '미지정'),
    'completion_survey',
    NOW(),
    NOW()
  FROM business_info
  WHERE completion_survey_date IS NOT NULL;

  PERFORM set_config('app.syncing_survey', 'false', false);

  RAISE NOTICE '✅ 준공실사 % 건 마이그레이션 완료',
    (SELECT COUNT(*) FROM survey_events WHERE survey_type = 'completion_survey');
END $$;

-- ========================================
-- 확인: 준공실사 마이그레이션 검증
-- ========================================
SELECT
  COUNT(*) AS migrated_count,
  MIN(event_date) AS earliest_date,
  MAX(event_date) AS latest_date
FROM survey_events
WHERE survey_type = 'completion_survey';

-- ========================================
-- 5단계: 최종 검증
-- ========================================
-- 전체 동기화 결과
SELECT
  '✅ 최종 동기화 결과' AS status,
  COUNT(*) AS total_survey_events,
  COUNT(CASE WHEN survey_type = 'estimate_survey' THEN 1 END) AS estimate_surveys,
  COUNT(CASE WHEN survey_type = 'pre_construction_survey' THEN 1 END) AS pre_construction_surveys,
  COUNT(CASE WHEN survey_type = 'completion_survey' THEN 1 END) AS completion_surveys,
  COUNT(CASE WHEN start_time IS NOT NULL THEN 1 END) AS events_with_start_time,
  COUNT(CASE WHEN end_time IS NOT NULL THEN 1 END) AS events_with_end_time
FROM survey_events
WHERE event_type = 'survey';

-- 샘플 데이터 확인 (최근 10건)
SELECT
  title,
  event_date,
  TO_CHAR(start_time, 'HH24:MI') AS start_time,
  TO_CHAR(end_time, 'HH24:MI') AS end_time,
  business_name,
  survey_type
FROM survey_events
WHERE event_type = 'survey'
ORDER BY event_date DESC
LIMIT 10;

-- business_info와 개수 비교
SELECT
  'business_info' AS source,
  COUNT(CASE WHEN estimate_survey_date IS NOT NULL THEN 1 END) AS estimate,
  COUNT(CASE WHEN pre_construction_survey_date IS NOT NULL THEN 1 END) AS pre_construction,
  COUNT(CASE WHEN completion_survey_date IS NOT NULL THEN 1 END) AS completion
FROM business_info

UNION ALL

SELECT
  'survey_events' AS source,
  COUNT(CASE WHEN survey_type = 'estimate_survey' THEN 1 END),
  COUNT(CASE WHEN survey_type = 'pre_construction_survey' THEN 1 END),
  COUNT(CASE WHEN survey_type = 'completion_survey' THEN 1 END)
FROM survey_events
WHERE event_type = 'survey';
