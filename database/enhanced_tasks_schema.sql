-- 업무 관리 시스템 확장 데이터베이스 스키마
-- 시작일 및 지연 업무 통계 기능 포함

-- 업무 타입 ENUM
CREATE TYPE task_type AS ENUM ('self', 'subsidy', 'etc', 'as');

-- 업무 상태 ENUM (확장됨)
CREATE TYPE task_status AS ENUM (
  -- 자비 업무 단계
  'customer_contact', 'site_inspection', 'quotation', 'contract',
  'deposit_confirm', 'product_order', 'product_shipment', 'installation_schedule',
  'installation', 'balance_payment', 'document_complete',

  -- 보조금 업무 단계
  'application_submit', 'document_supplement', 'pre_construction_inspection',
  'pre_construction_supplement', 'completion_inspection', 'completion_supplement',
  'final_document_submit', 'subsidy_payment',

  -- 기타 단계
  'etc_status'
);

-- 우선순위 ENUM
CREATE TYPE priority_level AS ENUM ('high', 'medium', 'low');

-- 지연 상태 ENUM
CREATE TYPE delay_status AS ENUM ('on_time', 'at_risk', 'delayed', 'overdue');

-- 메인 업무 테이블 (확장됨)
CREATE TABLE tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title VARCHAR(255) NOT NULL,
  description TEXT,
  notes TEXT,

  -- 업무 분류
  type task_type NOT NULL DEFAULT 'self',
  status task_status NOT NULL DEFAULT 'customer_contact',
  priority priority_level NOT NULL DEFAULT 'medium',

  -- 사업장 정보
  business_name VARCHAR(255),
  business_address TEXT,
  business_contact VARCHAR(50),
  business_manager VARCHAR(100),

  -- 담당자
  assignee VARCHAR(100),

  -- 일정 관리 (확장됨)
  start_date DATE, -- 새로 추가된 시작일
  due_date DATE,
  estimated_days INTEGER, -- 예상 소요 일수
  actual_days INTEGER, -- 실제 소요 일수

  -- 진행률 및 지연 관리
  progress_percentage INTEGER DEFAULT 0 CHECK (progress_percentage >= 0 AND progress_percentage <= 100),
  delay_status delay_status DEFAULT 'on_time',
  delay_days INTEGER DEFAULT 0, -- 지연 일수
  delay_reason TEXT, -- 지연 사유

  -- 메타데이터
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  completed_at TIMESTAMP WITH TIME ZONE,

  -- 인덱스를 위한 제약조건
  CONSTRAINT valid_date_range CHECK (start_date IS NULL OR due_date IS NULL OR start_date <= due_date)
);

-- 업무 히스토리 테이블 (상태 변경 이력)
CREATE TABLE task_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,

  -- 변경 내용
  previous_status task_status,
  new_status task_status NOT NULL,
  previous_assignee VARCHAR(100),
  new_assignee VARCHAR(100),

  -- 변경 메타데이터
  changed_by VARCHAR(100) NOT NULL,
  change_reason TEXT,
  changed_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 지연 알림 설정 테이블
CREATE TABLE delay_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_type task_type NOT NULL,

  -- 지연 기준 (일 단위)
  warning_days INTEGER NOT NULL DEFAULT 7, -- 경고 임계값
  critical_days INTEGER NOT NULL DEFAULT 14, -- 심각 임계값
  overdue_days INTEGER NOT NULL DEFAULT 21, -- 초과 임계값

  -- 알림 설정
  enable_notifications BOOLEAN DEFAULT true,
  notification_emails TEXT[], -- 알림 받을 이메일 목록

  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,

  UNIQUE(task_type)
);

-- 업무 통계 뷰
CREATE VIEW task_statistics AS
SELECT
  type,
  status,
  assignee,
  delay_status,
  COUNT(*) as task_count,
  AVG(progress_percentage) as avg_progress,
  AVG(delay_days) as avg_delay_days,
  COUNT(*) FILTER (WHERE delay_status = 'delayed') as delayed_count,
  COUNT(*) FILTER (WHERE delay_status = 'overdue') as overdue_count,
  COUNT(*) FILTER (WHERE completed_at IS NOT NULL) as completed_count
FROM tasks
GROUP BY type, status, assignee, delay_status;

-- 지연 업무 통계 뷰
CREATE VIEW delayed_tasks_summary AS
SELECT
  type,
  assignee,
  COUNT(*) as total_tasks,
  COUNT(*) FILTER (WHERE delay_status IN ('delayed', 'overdue')) as delayed_tasks,
  ROUND(
    COUNT(*) FILTER (WHERE delay_status IN ('delayed', 'overdue'))::NUMERIC /
    COUNT(*)::NUMERIC * 100, 2
  ) as delay_percentage,
  AVG(delay_days) FILTER (WHERE delay_status IN ('delayed', 'overdue')) as avg_delay_days
FROM tasks
WHERE start_date IS NOT NULL
GROUP BY type, assignee;

-- 월별 업무 완료 통계 뷰
CREATE VIEW monthly_completion_stats AS
SELECT
  DATE_TRUNC('month', completed_at) as month,
  type,
  COUNT(*) as completed_tasks,
  AVG(actual_days) as avg_completion_days,
  COUNT(*) FILTER (WHERE delay_status IN ('delayed', 'overdue')) as delayed_completions
FROM tasks
WHERE completed_at IS NOT NULL
GROUP BY DATE_TRUNC('month', completed_at), type
ORDER BY month DESC;

-- 지연 상태 자동 업데이트 함수
CREATE OR REPLACE FUNCTION update_delay_status()
RETURNS TRIGGER AS $$
DECLARE
  days_since_start INTEGER;
  days_until_due INTEGER;
  warning_threshold INTEGER;
  critical_threshold INTEGER;
  overdue_threshold INTEGER;
BEGIN
  -- 시작일이 없으면 지연 계산 안함
  IF NEW.start_date IS NULL THEN
    NEW.delay_status := 'on_time';
    NEW.delay_days := 0;
    RETURN NEW;
  END IF;

  -- 시작일로부터 경과 일수 계산
  days_since_start := CURRENT_DATE - NEW.start_date;

  -- 마감일까지 남은 일수 계산
  IF NEW.due_date IS NOT NULL THEN
    days_until_due := NEW.due_date - CURRENT_DATE;
  ELSE
    days_until_due := NULL;
  END IF;

  -- 업무 타입별 임계값 가져오기
  SELECT warning_days, critical_days, overdue_days
  INTO warning_threshold, critical_threshold, overdue_threshold
  FROM delay_settings
  WHERE task_type = NEW.type;

  -- 기본값 설정 (설정이 없는 경우)
  warning_threshold := COALESCE(warning_threshold, 7);
  critical_threshold := COALESCE(critical_threshold, 14);
  overdue_threshold := COALESCE(overdue_threshold, 21);

  -- 완료된 업무는 지연 상태 계산 안함
  IF NEW.completed_at IS NOT NULL THEN
    NEW.delay_status := 'on_time';
    NEW.delay_days := 0;
    RETURN NEW;
  END IF;

  -- 지연 상태 계산
  IF days_until_due IS NOT NULL AND days_until_due < 0 THEN
    -- 마감일 초과
    NEW.delay_status := 'overdue';
    NEW.delay_days := ABS(days_until_due);
  ELSIF days_since_start >= overdue_threshold THEN
    -- 시작일로부터 초과 임계값 경과
    NEW.delay_status := 'overdue';
    NEW.delay_days := days_since_start - overdue_threshold;
  ELSIF days_since_start >= critical_threshold THEN
    -- 심각 지연
    NEW.delay_status := 'delayed';
    NEW.delay_days := days_since_start - critical_threshold;
  ELSIF days_since_start >= warning_threshold THEN
    -- 지연 위험
    NEW.delay_status := 'at_risk';
    NEW.delay_days := 0;
  ELSE
    -- 정상
    NEW.delay_status := 'on_time';
    NEW.delay_days := 0;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 트리거 생성
CREATE TRIGGER update_delay_status_trigger
  BEFORE INSERT OR UPDATE ON tasks
  FOR EACH ROW
  EXECUTE FUNCTION update_delay_status();

-- updated_at 자동 업데이트 함수
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- updated_at 트리거
CREATE TRIGGER update_tasks_updated_at
  BEFORE UPDATE ON tasks
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- 인덱스 생성
CREATE INDEX idx_tasks_type ON tasks(type);
CREATE INDEX idx_tasks_status ON tasks(status);
CREATE INDEX idx_tasks_assignee ON tasks(assignee);
CREATE INDEX idx_tasks_delay_status ON tasks(delay_status);
CREATE INDEX idx_tasks_start_date ON tasks(start_date);
CREATE INDEX idx_tasks_due_date ON tasks(due_date);
CREATE INDEX idx_tasks_created_at ON tasks(created_at);
CREATE INDEX idx_task_history_task_id ON task_history(task_id);
CREATE INDEX idx_task_history_changed_at ON task_history(changed_at);

-- 기본 지연 설정 데이터 삽입
INSERT INTO delay_settings (task_type, warning_days, critical_days, overdue_days) VALUES
('self', 7, 14, 21),
('subsidy', 10, 20, 30),
('etc', 5, 10, 15),
('as', 3, 7, 10);

-- 샘플 데이터 (확장됨)
INSERT INTO tasks (
  title, description, type, status, priority, business_name, assignee,
  start_date, due_date, estimated_days, progress_percentage
) VALUES
('신규 방지시설 설치', '대기오염 방지시설 신규 설치 작업', 'self', 'customer_contact', 'high',
 '삼성전자 수원사업장', '김영수', '2024-01-15', '2024-02-15', 15, 25),

('보조금 신청서 작성', '2024년 환경개선 보조금 신청', 'subsidy', 'application_submit', 'medium',
 'LG화학 여수공장', '이민정', '2024-01-10', '2024-03-10', 30, 60),

('기존 시설 점검', '정기 시설 점검 및 유지보수', 'etc', 'etc_status', 'low',
 '현대자동차 울산공장', '박철수', '2024-01-20', '2024-01-30', 5, 80),

('AS 요청 처리', '고장난 집진기 부품 교체', 'as', 'customer_contact', 'high',
 '포스코 광양제철소', '정수민', '2024-01-25', '2024-01-28', 3, 10);

-- 히스토리 샘플 데이터
INSERT INTO task_history (task_id, previous_status, new_status, changed_by, change_reason)
SELECT id, NULL, status, assignee, '업무 생성'
FROM tasks;

-- 지연 업무 조회 함수
CREATE OR REPLACE FUNCTION get_delayed_tasks(
  p_assignee VARCHAR DEFAULT NULL,
  p_type task_type DEFAULT NULL
)
RETURNS TABLE (
  task_id UUID,
  title VARCHAR,
  business_name VARCHAR,
  assignee VARCHAR,
  delay_status delay_status,
  delay_days INTEGER,
  days_since_start INTEGER,
  progress_percentage INTEGER
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    t.id,
    t.title,
    t.business_name,
    t.assignee,
    t.delay_status,
    t.delay_days,
    CASE
      WHEN t.start_date IS NOT NULL THEN CURRENT_DATE - t.start_date
      ELSE NULL
    END,
    t.progress_percentage
  FROM tasks t
  WHERE t.completed_at IS NULL
    AND t.delay_status IN ('at_risk', 'delayed', 'overdue')
    AND (p_assignee IS NULL OR t.assignee = p_assignee)
    AND (p_type IS NULL OR t.type = p_type)
  ORDER BY
    CASE t.delay_status
      WHEN 'overdue' THEN 1
      WHEN 'delayed' THEN 2
      WHEN 'at_risk' THEN 3
    END,
    t.delay_days DESC;
END;
$$ LANGUAGE plpgsql;

-- 업무 완료 처리 함수
CREATE OR REPLACE FUNCTION complete_task(
  p_task_id UUID,
  p_completed_by VARCHAR,
  p_completion_notes TEXT DEFAULT NULL
)
RETURNS BOOLEAN AS $$
DECLARE
  task_start_date DATE;
  completion_days INTEGER;
BEGIN
  -- 업무 정보 조회
  SELECT start_date INTO task_start_date
  FROM tasks
  WHERE id = p_task_id;

  IF NOT FOUND THEN
    RETURN FALSE;
  END IF;

  -- 실제 소요 일수 계산
  IF task_start_date IS NOT NULL THEN
    completion_days := CURRENT_DATE - task_start_date;
  ELSE
    completion_days := NULL;
  END IF;

  -- 업무 완료 처리
  UPDATE tasks
  SET
    completed_at = CURRENT_TIMESTAMP,
    progress_percentage = 100,
    actual_days = completion_days,
    delay_status = 'on_time',
    delay_days = 0,
    notes = COALESCE(notes || E'\n\n', '') ||
            '완료일: ' || CURRENT_DATE::TEXT ||
            CASE WHEN p_completion_notes IS NOT NULL
                 THEN E'\n완료 메모: ' || p_completion_notes
                 ELSE '' END
  WHERE id = p_task_id;

  -- 히스토리 추가
  INSERT INTO task_history (task_id, new_status, changed_by, change_reason)
  VALUES (p_task_id, (SELECT status FROM tasks WHERE id = p_task_id),
          p_completed_by, '업무 완료');

  RETURN TRUE;
END;
$$ LANGUAGE plpgsql;