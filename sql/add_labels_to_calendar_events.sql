-- Calendar Events 라벨 시스템 추가
-- 할일과 일정에 세부 카테고리(라벨)를 추가하여 유동적으로 관리 가능

-- ========================================
-- 1. calendar_events 테이블에 labels 컬럼 추가
-- ========================================

-- 라벨 배열 추가 (문자열 배열)
-- 예: ["착공실사", "준공실사"], ["긴급"], ["회의", "외부"]
ALTER TABLE calendar_events
ADD COLUMN IF NOT EXISTS labels TEXT[] DEFAULT ARRAY[]::TEXT[];

-- ========================================
-- 2. 인덱스 추가
-- ========================================

-- 라벨 검색 최적화를 위한 GIN 인덱스
-- 특정 라벨을 가진 이벤트를 빠르게 검색 가능
CREATE INDEX IF NOT EXISTS idx_calendar_events_labels
ON calendar_events USING GIN(labels)
WHERE is_deleted = false;

-- 이벤트 타입별 조회 최적화 (별도 인덱스)
CREATE INDEX IF NOT EXISTS idx_calendar_events_type
ON calendar_events(event_type)
WHERE is_deleted = false;

-- ========================================
-- 3. 도우미 함수 추가
-- ========================================

-- 특정 라벨을 가진 이벤트 검색 함수
CREATE OR REPLACE FUNCTION has_label(
    event_labels TEXT[],
    search_label TEXT
)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN search_label = ANY(event_labels);
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- 여러 라벨 중 하나라도 포함하는지 확인하는 함수
CREATE OR REPLACE FUNCTION has_any_label(
    event_labels TEXT[],
    search_labels TEXT[]
)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN event_labels && search_labels; -- 배열 겹침 연산자
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- ========================================
-- 4. 주석 추가
-- ========================================

COMMENT ON COLUMN calendar_events.labels IS '이벤트 라벨 배열 (예: ["착공실사", "준공실사"] - 세부 카테고리 분류용)';

-- ========================================
-- 5. 기존 데이터 호환성
-- ========================================

-- 기존 이벤트의 labels는 빈 배열 (DEFAULT)
-- 별도의 데이터 마이그레이션 불필요

-- 완료
SELECT 'Calendar events 테이블에 라벨 시스템 추가 완료' AS status;
