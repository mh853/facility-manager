-- 담당자 다중 선택 지원을 위한 스키마 업데이트
-- 사용법: Supabase SQL Editor에서 실행

-- 1. 새로운 담당자 관련 컬럼 추가
ALTER TABLE facility_tasks
ADD COLUMN IF NOT EXISTS assignees JSONB DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS primary_assignee_id TEXT,
ADD COLUMN IF NOT EXISTS assignee_updated_at TIMESTAMPTZ DEFAULT now();

-- 2. 기존 assignee 데이터를 새로운 assignees 컬럼으로 마이그레이션
UPDATE facility_tasks
SET assignees = CASE
  WHEN assignee IS NOT NULL AND assignee != '' THEN
    jsonb_build_array(
      jsonb_build_object(
        'name', assignee,
        'position', '미정',
        'email', '',
        'id', ''
      )
    )
  ELSE '[]'::jsonb
END,
primary_assignee_id = assignee,
assignee_updated_at = updated_at
WHERE assignees = '[]'::jsonb;

-- 3. 인덱스 생성 (성능 최적화)
CREATE INDEX IF NOT EXISTS idx_facility_tasks_assignees_gin ON facility_tasks USING GIN (assignees);
CREATE INDEX IF NOT EXISTS idx_facility_tasks_primary_assignee ON facility_tasks(primary_assignee_id);

-- 4. 담당자 업데이트 시 자동으로 assignee_updated_at 업데이트하는 함수
CREATE OR REPLACE FUNCTION update_assignee_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.assignees IS DISTINCT FROM NEW.assignees
     OR OLD.primary_assignee_id IS DISTINCT FROM NEW.primary_assignee_id THEN
    NEW.assignee_updated_at = now();
  END IF;
  RETURN NEW;
END;
$$ language 'plpgsql';

-- 5. 트리거 생성
DROP TRIGGER IF EXISTS trigger_update_assignee_timestamp ON facility_tasks;
CREATE TRIGGER trigger_update_assignee_timestamp
  BEFORE UPDATE ON facility_tasks
  FOR EACH ROW
  EXECUTE FUNCTION update_assignee_timestamp();

-- 6. 담당자 검색을 위한 뷰 생성
CREATE OR REPLACE VIEW facility_tasks_with_assignee_names AS
SELECT
  t.*,
  CASE
    WHEN jsonb_array_length(t.assignees) > 0 THEN
      array_agg(DISTINCT (assignee->>'name')) FILTER (WHERE assignee->>'name' != '')
    ELSE ARRAY[]::text[]
  END as assignee_names,
  jsonb_array_length(t.assignees) as assignee_count
FROM facility_tasks t
CROSS JOIN LATERAL jsonb_array_elements(t.assignees) as assignee(assignee)
WHERE t.is_active = true AND t.is_deleted = false
GROUP BY t.id, t.created_at, t.updated_at, t.title, t.description, t.business_name,
         t.business_id, t.task_type, t.status, t.priority, t.assignee, t.due_date,
         t.completed_at, t.notes, t.is_active, t.is_deleted, t.assignees,
         t.primary_assignee_id, t.assignee_updated_at;

-- 7. 담당자별 업무 통계를 위한 함수 생성
CREATE OR REPLACE FUNCTION get_assignee_task_stats(assignee_name TEXT)
RETURNS TABLE(
  total_tasks BIGINT,
  pending_tasks BIGINT,
  completed_tasks BIGINT,
  high_priority_tasks BIGINT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    COUNT(*) as total_tasks,
    COUNT(*) FILTER (WHERE status NOT IN ('document_complete', 'subsidy_payment')) as pending_tasks,
    COUNT(*) FILTER (WHERE status IN ('document_complete', 'subsidy_payment')) as completed_tasks,
    COUNT(*) FILTER (WHERE priority = 'high') as high_priority_tasks
  FROM facility_tasks t
  CROSS JOIN LATERAL jsonb_array_elements(t.assignees) as assignee(assignee)
  WHERE t.is_active = true
    AND t.is_deleted = false
    AND assignee->>'name' = assignee_name;
END;
$$ LANGUAGE plpgsql;

-- 8. 댓글 및 설명 추가
COMMENT ON COLUMN facility_tasks.assignees IS '담당자 목록 (JSON 배열) - name, position, email, id 포함';
COMMENT ON COLUMN facility_tasks.primary_assignee_id IS '주 담당자 ID (선택사항)';
COMMENT ON COLUMN facility_tasks.assignee_updated_at IS '담당자 정보 마지막 업데이트 시간';
COMMENT ON VIEW facility_tasks_with_assignee_names IS '담당자 이름이 배열로 추출된 업무 목록 뷰';
COMMENT ON FUNCTION get_assignee_task_stats IS '특정 담당자의 업무 통계 조회 함수';

-- 9. 데이터 검증 쿼리 (실행 후 확인용)
-- SELECT
--   id,
--   title,
--   assignee as old_assignee,
--   assignees as new_assignees,
--   primary_assignee_id,
--   assignee_updated_at
-- FROM facility_tasks
-- WHERE assignees != '[]'::jsonb
-- LIMIT 5;

-- 10. 성능 최적화를 위한 VACUUM
-- VACUUM ANALYZE facility_tasks;