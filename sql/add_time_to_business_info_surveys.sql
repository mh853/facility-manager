-- business_info 테이블에 실사 시간 필드 추가
-- 완전한 양방향 시간 동기화를 위한 2단계 구현

-- ========================================
-- 1. 시간 필드 추가
-- ========================================
ALTER TABLE business_info
ADD COLUMN IF NOT EXISTS estimate_survey_start_time TIME,
ADD COLUMN IF NOT EXISTS estimate_survey_end_time TIME,
ADD COLUMN IF NOT EXISTS pre_construction_survey_start_time TIME,
ADD COLUMN IF NOT EXISTS pre_construction_survey_end_time TIME,
ADD COLUMN IF NOT EXISTS completion_survey_start_time TIME,
ADD COLUMN IF NOT EXISTS completion_survey_end_time TIME;

-- 필드 코멘트 추가
COMMENT ON COLUMN business_info.estimate_survey_start_time IS '견적실사 시작 시간 (HH:MM 형식, 선택사항)';
COMMENT ON COLUMN business_info.estimate_survey_end_time IS '견적실사 종료 시간 (HH:MM 형식, 선택사항)';
COMMENT ON COLUMN business_info.pre_construction_survey_start_time IS '착공전실사 시작 시간 (HH:MM 형식, 선택사항)';
COMMENT ON COLUMN business_info.pre_construction_survey_end_time IS '착공전실사 종료 시간 (HH:MM 형식, 선택사항)';
COMMENT ON COLUMN business_info.completion_survey_start_time IS '준공실사 시작 시간 (HH:MM 형식, 선택사항)';
COMMENT ON COLUMN business_info.completion_survey_end_time IS '준공실사 종료 시간 (HH:MM 형식, 선택사항)';

-- ========================================
-- 2. 인덱스 생성 (성능 최적화)
-- ========================================
CREATE INDEX IF NOT EXISTS idx_business_info_estimate_survey_start_time
  ON business_info(estimate_survey_start_time) WHERE estimate_survey_start_time IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_business_info_estimate_survey_end_time
  ON business_info(estimate_survey_end_time) WHERE estimate_survey_end_time IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_business_info_pre_construction_survey_start_time
  ON business_info(pre_construction_survey_start_time) WHERE pre_construction_survey_start_time IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_business_info_pre_construction_survey_end_time
  ON business_info(pre_construction_survey_end_time) WHERE pre_construction_survey_end_time IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_business_info_completion_survey_start_time
  ON business_info(completion_survey_start_time) WHERE completion_survey_start_time IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_business_info_completion_survey_end_time
  ON business_info(completion_survey_end_time) WHERE completion_survey_end_time IS NOT NULL;

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
WHERE table_name = 'business_info'
  AND column_name LIKE '%survey%time%'
ORDER BY column_name;

-- 인덱스 확인
SELECT
  indexname,
  indexdef
FROM pg_indexes
WHERE tablename = 'business_info'
  AND indexname LIKE '%time%'
ORDER BY indexname;

-- ========================================
-- 4. 데이터 예시
-- ========================================

-- 시간 정보를 포함한 사업장 정보 업데이트 예시
/*
UPDATE business_info
SET
  estimate_survey_date = '2025-12-15',
  estimate_survey_start_time = '10:00',
  estimate_survey_end_time = '12:00'
WHERE id = '123e4567-e89b-12d3-a456-426614174000';
*/

-- ========================================
-- 주의사항
-- ========================================
-- 1. 시간 필드는 선택사항 (NULL 허용)
-- 2. survey_events 테이블과 양방향 동기화됨
-- 3. 트리거 함수 수정 필요 (sync_business_to_survey_events, sync_survey_to_business_info)
-- 4. 사업장관리 UI 수정 필요 (시간 입력 필드 추가)
