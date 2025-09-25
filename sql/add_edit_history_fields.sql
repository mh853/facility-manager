-- 업무 수정 이력 추적 필드 추가
-- facility_tasks 테이블에 수정 이력 관련 필드 추가

-- 1. 수정 이력 필드 추가
ALTER TABLE facility_tasks
ADD COLUMN IF NOT EXISTS created_by UUID,
ADD COLUMN IF NOT EXISTS created_by_name TEXT,
ADD COLUMN IF NOT EXISTS last_modified_by UUID,
ADD COLUMN IF NOT EXISTS last_modified_by_name TEXT,
ADD COLUMN IF NOT EXISTS edit_count INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS last_edit_summary TEXT;

-- 2. 수정 이력 상세 테이블 생성 (선택사항 - 더 상세한 이력이 필요한 경우)
CREATE TABLE IF NOT EXISTS task_edit_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ DEFAULT now(),

  -- 연관 정보
  task_id UUID REFERENCES facility_tasks(id) ON DELETE CASCADE,

  -- 수정자 정보
  editor_id UUID,
  editor_name TEXT NOT NULL,
  editor_level INTEGER,

  -- 수정 내용
  field_name TEXT NOT NULL, -- 수정된 필드명
  old_value TEXT, -- 이전 값
  new_value TEXT, -- 새 값

  -- 메타데이터
  edit_reason TEXT, -- 수정 사유 (선택)
  client_info JSONB -- 브라우저, IP 등 (선택)
);

-- 3. 인덱스 생성
CREATE INDEX IF NOT EXISTS idx_task_edit_history_task_id ON task_edit_history(task_id);
CREATE INDEX IF NOT EXISTS idx_task_edit_history_editor ON task_edit_history(editor_name);
CREATE INDEX IF NOT EXISTS idx_task_edit_history_created_at ON task_edit_history(created_at);

-- 4. 업무 수정 횟수 자동 업데이트 트리거 생성
CREATE OR REPLACE FUNCTION update_task_edit_count()
RETURNS TRIGGER AS $$
BEGIN
  NEW.edit_count = COALESCE(OLD.edit_count, 0) + 1;
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 트리거 적용
DROP TRIGGER IF EXISTS trigger_update_edit_count ON facility_tasks;
CREATE TRIGGER trigger_update_edit_count
  BEFORE UPDATE ON facility_tasks
  FOR EACH ROW
  EXECUTE FUNCTION update_task_edit_count();

COMMENT ON TABLE task_edit_history IS '업무 수정 이력을 상세히 추적하는 테이블';
COMMENT ON COLUMN facility_tasks.edit_count IS '업무가 수정된 총 횟수';
COMMENT ON COLUMN facility_tasks.last_edit_summary IS '마지막 수정 내용 요약';