-- Calendar Events에 사업장 정보 추가
-- 일정과 사업장을 연동하여 일정 추가 시 사업장 정보를 함께 확인 가능

-- ========================================
-- 1. calendar_events 테이블에 사업장 컬럼 추가
-- ========================================

-- 사업장 ID (business_info 테이블과 외래 키 관계)
ALTER TABLE calendar_events
ADD COLUMN IF NOT EXISTS business_id UUID REFERENCES business_info(id);

-- 사업장명 (검색 및 표시 최적화용, 비정규화)
ALTER TABLE calendar_events
ADD COLUMN IF NOT EXISTS business_name TEXT;

-- ========================================
-- 2. 인덱스 추가
-- ========================================

-- 사업장별 일정 조회 최적화
CREATE INDEX IF NOT EXISTS idx_calendar_events_business_id
ON calendar_events(business_id)
WHERE is_deleted = false;

-- 사업장명 검색 최적화 (LIKE 검색용)
CREATE INDEX IF NOT EXISTS idx_calendar_events_business_name
ON calendar_events(business_name)
WHERE is_deleted = false AND business_name IS NOT NULL;

-- 복합 인덱스: 사업장 + 날짜 조회 최적화
CREATE INDEX IF NOT EXISTS idx_calendar_events_business_date
ON calendar_events(business_id, event_date)
WHERE is_deleted = false;

-- ========================================
-- 3. 주석 추가
-- ========================================

COMMENT ON COLUMN calendar_events.business_id IS '연결된 사업장 ID (business_info.id 참조, nullable)';
COMMENT ON COLUMN calendar_events.business_name IS '사업장명 (검색 최적화용, business_info.business_name 복사)';

-- ========================================
-- 4. 기존 데이터 호환성
-- ========================================

-- 기존 이벤트는 사업장 정보 없음 (NULL 허용)
-- 새로 추가되는 일정에서 선택적으로 사업장 연결 가능

-- 완료
SELECT 'Calendar events 테이블에 사업장 연동 필드 추가 완료' AS status;
