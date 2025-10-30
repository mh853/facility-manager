-- 업무 단계별 이력 추적 테이블
-- 각 단계의 시작일, 종료일, 소요 시간을 추적

-- 1. 단계 이력 테이블 생성
CREATE TABLE IF NOT EXISTS task_status_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ DEFAULT now(),

  -- 연관 정보
  task_id UUID NOT NULL REFERENCES facility_tasks(id) ON DELETE CASCADE,

  -- 단계 정보
  status VARCHAR(50) NOT NULL,
  task_type VARCHAR(20) NOT NULL CHECK (task_type IN ('self', 'subsidy')),

  -- 날짜 정보
  started_at TIMESTAMPTZ NOT NULL,
  completed_at TIMESTAMPTZ,

  -- 소요 시간 (일 단위, 완료 시 자동 계산)
  duration_days INTEGER,

  -- 담당자 정보
  assignee_id UUID,
  assignee_name TEXT,
  primary_assignee_id UUID,

  -- 메타데이터
  notes TEXT,
  business_name TEXT,

  -- 생성자 정보
  created_by UUID,
  created_by_name TEXT
);

-- 2. 인덱스 생성
CREATE INDEX IF NOT EXISTS idx_status_history_task_id ON task_status_history(task_id);
CREATE INDEX IF NOT EXISTS idx_status_history_status ON task_status_history(status);
CREATE INDEX IF NOT EXISTS idx_status_history_dates ON task_status_history(started_at, completed_at);
CREATE INDEX IF NOT EXISTS idx_status_history_business ON task_status_history(business_name);
CREATE INDEX IF NOT EXISTS idx_status_history_assignee ON task_status_history(assignee_id);

-- 3. 소요 시간 자동 계산 함수
CREATE OR REPLACE FUNCTION calculate_status_duration()
RETURNS TRIGGER AS $$
BEGIN
  -- completed_at이 설정되면 자동으로 소요 시간 계산
  IF NEW.completed_at IS NOT NULL AND NEW.started_at IS NOT NULL THEN
    NEW.duration_days = EXTRACT(DAY FROM (NEW.completed_at - NEW.started_at))::INTEGER;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 4. 트리거 적용
DROP TRIGGER IF EXISTS trigger_calculate_duration ON task_status_history;
CREATE TRIGGER trigger_calculate_duration
  BEFORE INSERT OR UPDATE ON task_status_history
  FOR EACH ROW
  EXECUTE FUNCTION calculate_status_duration();

-- 5. 업무 단계 이력 조회 뷰 (편의 기능)
CREATE OR REPLACE VIEW task_status_timeline AS
SELECT
  tsh.*,
  ft.title as task_title,
  ft.priority,
  ft.is_active,
  -- 다음 단계 정보 (윈도우 함수 사용)
  LEAD(tsh.status) OVER (PARTITION BY tsh.task_id ORDER BY tsh.started_at) as next_status,
  LEAD(tsh.started_at) OVER (PARTITION BY tsh.task_id ORDER BY tsh.started_at) as next_started_at
FROM task_status_history tsh
LEFT JOIN facility_tasks ft ON tsh.task_id = ft.id
ORDER BY tsh.task_id, tsh.started_at;

-- 6. 단계별 평균 소요 시간 집계 뷰
CREATE OR REPLACE VIEW task_status_statistics AS
SELECT
  status,
  task_type,
  COUNT(*) as total_occurrences,
  AVG(duration_days) as avg_duration_days,
  MIN(duration_days) as min_duration_days,
  MAX(duration_days) as max_duration_days,
  PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY duration_days) as median_duration_days
FROM task_status_history
WHERE completed_at IS NOT NULL AND duration_days IS NOT NULL
GROUP BY status, task_type;

-- 7. RLS (Row Level Security) 설정
ALTER TABLE task_status_history ENABLE ROW LEVEL SECURITY;

-- 8. RLS 정책 생성
CREATE POLICY "Enable read access for all users" ON task_status_history
  FOR SELECT USING (true);

CREATE POLICY "Enable insert access for all users" ON task_status_history
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Enable update access for all users" ON task_status_history
  FOR UPDATE USING (true);

-- 9. 주석 추가
COMMENT ON TABLE task_status_history IS '업무 단계별 시작/종료 시간 및 소요 시간 추적 테이블';
COMMENT ON COLUMN task_status_history.task_id IS 'facility_tasks 테이블의 업무 ID';
COMMENT ON COLUMN task_status_history.status IS '업무 단계 (customer_contact, site_inspection 등)';
COMMENT ON COLUMN task_status_history.started_at IS '해당 단계 시작 시각';
COMMENT ON COLUMN task_status_history.completed_at IS '해당 단계 완료 시각 (null이면 진행 중)';
COMMENT ON COLUMN task_status_history.duration_days IS '단계 소요 일수 (자동 계산)';
COMMENT ON VIEW task_status_timeline IS '업무별 단계 진행 타임라인 뷰';
COMMENT ON VIEW task_status_statistics IS '단계별 평균 소요 시간 통계 뷰';

-- 10. 샘플 데이터 (테스트용)
-- 실제 환경에서는 API를 통해 자동으로 생성됨
-- INSERT INTO task_status_history (task_id, status, task_type, started_at, completed_at, business_name, created_by_name) VALUES
-- ('existing-task-id', 'customer_contact', 'self', '2024-01-01 09:00:00+00', '2024-01-05 17:00:00+00', '농업회사법인 주식회사 건양', '이준호'),
-- ('existing-task-id', 'site_inspection', 'self', '2024-01-05 17:00:00+00', '2024-01-10 15:00:00+00', '농업회사법인 주식회사 건양', '이준호');
