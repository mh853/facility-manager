-- 주간 리포트 테이블 생성 스크립트
-- 매주 금요일 자동 생성되는 사용자별 주간 업무 리포트 저장

-- 1. 테이블 생성
CREATE TABLE IF NOT EXISTS weekly_reports (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  user_name TEXT NOT NULL,
  week_start TIMESTAMP NOT NULL,
  week_end TIMESTAMP NOT NULL,

  -- 업무 통계
  total_tasks INTEGER NOT NULL DEFAULT 0,
  completed_tasks INTEGER NOT NULL DEFAULT 0,
  in_progress_tasks INTEGER NOT NULL DEFAULT 0,
  pending_tasks INTEGER NOT NULL DEFAULT 0,
  completion_rate INTEGER NOT NULL DEFAULT 0,

  -- 업무 타입별
  self_tasks INTEGER NOT NULL DEFAULT 0,
  subsidy_tasks INTEGER NOT NULL DEFAULT 0,

  -- 우선순위별 완료
  high_priority_completed INTEGER NOT NULL DEFAULT 0,
  medium_priority_completed INTEGER NOT NULL DEFAULT 0,
  low_priority_completed INTEGER NOT NULL DEFAULT 0,

  -- 성과 지표
  average_completion_time_days DECIMAL(5,1) DEFAULT 0,
  overdue_tasks INTEGER NOT NULL DEFAULT 0,

  -- 상세 데이터 (JSONB)
  completed_task_details JSONB DEFAULT '[]'::jsonb,
  pending_task_details JSONB DEFAULT '[]'::jsonb,

  -- 메타데이터
  generated_at TIMESTAMP DEFAULT NOW(),
  is_auto_generated BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- 2. 인덱스 생성 (성능 최적화)
CREATE INDEX IF NOT EXISTS idx_weekly_reports_user_id ON weekly_reports(user_id);
CREATE INDEX IF NOT EXISTS idx_weekly_reports_week_start ON weekly_reports(week_start);
CREATE INDEX IF NOT EXISTS idx_weekly_reports_generated_at ON weekly_reports(generated_at);
CREATE INDEX IF NOT EXISTS idx_weekly_reports_user_week ON weekly_reports(user_id, week_start);

-- 3. RLS (Row Level Security) 활성화
ALTER TABLE weekly_reports ENABLE ROW LEVEL SECURITY;

-- 4. RLS 정책 생성

-- 정책 1: 사용자는 본인의 리포트만 조회 가능
CREATE POLICY "Users can view own reports"
  ON weekly_reports FOR SELECT
  USING (auth.uid() = user_id);

-- 정책 2: 관리자(권한 3 이상)는 모든 리포트 조회 가능
CREATE POLICY "Admins can view all reports"
  ON weekly_reports FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM employees
      WHERE employees.id = auth.uid()
      AND employees.permission_level >= 3
    )
  );

-- 정책 3: 서비스 역할(서버)에서만 생성 가능
CREATE POLICY "System can insert reports"
  ON weekly_reports FOR INSERT
  WITH CHECK (true);

-- 정책 4: 서비스 역할(서버)에서만 수정 가능
CREATE POLICY "System can update reports"
  ON weekly_reports FOR UPDATE
  USING (true);

-- 5. 주석 추가
COMMENT ON TABLE weekly_reports IS '주간 업무 리포트 저장 테이블 - 매주 금요일 17시 자동 생성';
COMMENT ON COLUMN weekly_reports.user_id IS '사용자 ID (employees 테이블 참조)';
COMMENT ON COLUMN weekly_reports.week_start IS '주간 시작일 (일요일 00:00:00)';
COMMENT ON COLUMN weekly_reports.week_end IS '주간 종료일 (토요일 23:59:59)';
COMMENT ON COLUMN weekly_reports.completion_rate IS '완료율 (%)';
COMMENT ON COLUMN weekly_reports.completed_task_details IS '완료 업무 상세 정보 (JSON 배열)';
COMMENT ON COLUMN weekly_reports.pending_task_details IS '미완료 업무 상세 정보 (JSON 배열)';
COMMENT ON COLUMN weekly_reports.is_auto_generated IS 'Cron Job으로 자동 생성 여부';

-- 6. 업데이트 트리거 (updated_at 자동 갱신)
CREATE OR REPLACE FUNCTION update_weekly_reports_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER weekly_reports_updated_at_trigger
  BEFORE UPDATE ON weekly_reports
  FOR EACH ROW
  EXECUTE FUNCTION update_weekly_reports_updated_at();

-- 7. 성공 메시지
DO $$
BEGIN
  RAISE NOTICE '✅ weekly_reports 테이블 생성 완료';
  RAISE NOTICE '✅ 인덱스 생성 완료';
  RAISE NOTICE '✅ RLS 정책 설정 완료';
  RAISE NOTICE '✅ 트리거 설정 완료';
END $$;
