-- 캘린더 이벤트에 시간 필드 추가
-- 시작 시간과 종료 시간을 시:분 형식으로 저장

-- start_time: 시작 시간 (HH:MM 형식, nullable)
-- end_time: 종료 시간 (HH:MM 형식, nullable)
ALTER TABLE calendar_events
ADD COLUMN IF NOT EXISTS start_time TIME,
ADD COLUMN IF NOT EXISTS end_time TIME;

-- 시간 필드에 대한 코멘트
COMMENT ON COLUMN calendar_events.start_time IS '이벤트 시작 시간 (HH:MM 형식, 선택사항)';
COMMENT ON COLUMN calendar_events.end_time IS '이벤트 종료 시간 (HH:MM 형식, 선택사항)';

-- 인덱스 추가 (시간 기반 조회 최적화)
CREATE INDEX IF NOT EXISTS idx_calendar_events_start_time ON calendar_events(start_time) WHERE start_time IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_calendar_events_end_time ON calendar_events(end_time) WHERE end_time IS NOT NULL;
