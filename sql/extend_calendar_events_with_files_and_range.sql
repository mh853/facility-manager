-- Calendar Events 확장: 파일 첨부 및 기간 설정 지원
-- 일정 관리 기능 강화를 위한 스키마 확장

-- ========================================
-- 1. calendar_events 테이블에 새 컬럼 추가
-- ========================================

-- 종료 날짜 추가 (기간 설정용)
-- NULL이면 단일 날짜 이벤트, 값이 있으면 기간 이벤트
ALTER TABLE calendar_events
ADD COLUMN IF NOT EXISTS end_date DATE;

-- 첨부 파일 메타데이터 배열 (JSONB)
-- 구조: [{ name: string, size: number, type: string, url: string, uploaded_at: string }]
ALTER TABLE calendar_events
ADD COLUMN IF NOT EXISTS attached_files JSONB DEFAULT '[]'::jsonb;

-- ========================================
-- 2. 인덱스 추가
-- ========================================

-- 종료 날짜 인덱스 (기간 검색 최적화)
CREATE INDEX IF NOT EXISTS idx_calendar_events_end_date
ON calendar_events(end_date)
WHERE end_date IS NOT NULL AND is_deleted = false;

-- 기간 이벤트 검색 최적화를 위한 복합 인덱스
CREATE INDEX IF NOT EXISTS idx_calendar_events_date_range
ON calendar_events(event_date, end_date)
WHERE is_deleted = false;

-- 첨부 파일 존재 여부 인덱스
CREATE INDEX IF NOT EXISTS idx_calendar_events_has_files
ON calendar_events((jsonb_array_length(attached_files)))
WHERE is_deleted = false AND jsonb_array_length(attached_files) > 0;

-- ========================================
-- 3. 제약 조건 추가
-- ========================================

-- 종료 날짜는 시작 날짜보다 같거나 이후여야 함
ALTER TABLE calendar_events
ADD CONSTRAINT calendar_events_end_date_check
CHECK (end_date IS NULL OR end_date >= event_date);

-- ========================================
-- 4. 도우미 함수 추가
-- ========================================

-- 이벤트가 특정 날짜 범위와 겹치는지 확인하는 함수
CREATE OR REPLACE FUNCTION calendar_event_overlaps_range(
    event_start DATE,
    event_end DATE,
    range_start DATE,
    range_end DATE
)
RETURNS BOOLEAN AS $$
BEGIN
    -- 종료 날짜가 NULL이면 단일 날짜 이벤트
    IF event_end IS NULL THEN
        event_end := event_start;
    END IF;

    -- 범위 겹침 확인
    RETURN (event_start <= range_end) AND (event_end >= range_start);
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- 이벤트가 특정 날짜에 해당하는지 확인하는 함수
CREATE OR REPLACE FUNCTION calendar_event_on_date(
    event_start DATE,
    event_end DATE,
    check_date DATE
)
RETURNS BOOLEAN AS $$
BEGIN
    -- 종료 날짜가 NULL이면 단일 날짜 이벤트
    IF event_end IS NULL THEN
        RETURN event_start = check_date;
    END IF;

    -- 기간 이벤트의 경우 범위 내 포함 여부 확인
    RETURN (check_date >= event_start) AND (check_date <= event_end);
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- ========================================
-- 5. 기존 데이터 호환성 확인
-- ========================================

-- 기존 이벤트의 end_date는 NULL (단일 날짜 이벤트로 유지)
-- 기존 이벤트의 attached_files는 빈 배열
-- 별도의 데이터 마이그레이션 불필요

-- ========================================
-- 6. 주석 추가
-- ========================================

COMMENT ON COLUMN calendar_events.end_date IS '종료 날짜 (NULL이면 단일 날짜 이벤트, 값이 있으면 event_date부터 end_date까지의 기간 이벤트)';
COMMENT ON COLUMN calendar_events.attached_files IS '첨부 파일 메타데이터 배열 (JSONB) - { name, size, type, url, uploaded_at }';

-- 완료
SELECT 'Calendar events 테이블 확장 완료: 파일 첨부 및 기간 설정 지원 추가' AS status;
