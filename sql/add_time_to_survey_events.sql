-- survey_events 테이블에 시간 필드 추가
-- 일정관리와 동일한 구조로 시간 정보 관리 가능

-- ========================================
-- 1. 시간 필드 추가
-- ========================================
ALTER TABLE survey_events
ADD COLUMN IF NOT EXISTS start_time TIME,
ADD COLUMN IF NOT EXISTS end_time TIME;

-- 필드 코멘트 추가
COMMENT ON COLUMN survey_events.start_time IS '실사 시작 시간 (HH:MM 형식, 선택사항)';
COMMENT ON COLUMN survey_events.end_time IS '실사 종료 시간 (HH:MM 형식, 선택사항)';

-- ========================================
-- 2. 인덱스 생성 (성능 최적화)
-- ========================================
CREATE INDEX IF NOT EXISTS idx_survey_events_start_time
  ON survey_events(start_time) WHERE start_time IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_survey_events_end_time
  ON survey_events(end_time) WHERE end_time IS NOT NULL;

-- ========================================
-- 3. 검증 쿼리
-- ========================================

-- 스키마 확인
SELECT
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_name = 'survey_events'
  AND column_name IN ('start_time', 'end_time')
ORDER BY column_name;

-- 인덱스 확인
SELECT
  indexname,
  indexdef
FROM pg_indexes
WHERE tablename = 'survey_events'
  AND indexname LIKE '%time%'
ORDER BY indexname;

-- ========================================
-- 4. 사용 예시
-- ========================================

-- 시간 정보를 포함한 실사 이벤트 생성
/*
INSERT INTO survey_events (
  id, title, event_date, start_time, end_time,
  labels, business_id, business_name, author_name,
  event_type, survey_type
)
VALUES (
  'estimate-survey-123e4567-e89b-12d3-a456-426614174000',
  '테스트 사업장 - 견적실사',
  '2025-12-15',
  '10:00',  -- 시작 시간
  '12:00',  -- 종료 시간
  ARRAY['견적실사']::TEXT[],
  '123e4567-e89b-12d3-a456-426614174000',
  '테스트 사업장',
  '홍길동',
  'survey',
  'estimate_survey'
);
*/

-- ========================================
-- 주의사항
-- ========================================
-- 1. start_time, end_time은 선택사항 (NULL 허용)
-- 2. business_info 테이블은 여전히 DATE만 저장
-- 3. 일정관리에서만 시간 정보 설정 가능
-- 4. 사업장관리에서 실사일 변경 시 시간 정보는 NULL 유지
