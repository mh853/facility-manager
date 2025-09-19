-- ===============================================
-- 2단계: 기존 facility_tasks 테이블에 다중 담당자 기능 추가
-- 1단계 완료 후 실행하세요
-- ===============================================

-- 전제조건 확인
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'facility_tasks') THEN
        RAISE EXCEPTION 'facility_tasks 테이블이 존재하지 않습니다. 먼저 01_create_facility_tasks_table.sql을 실행하세요.';
    END IF;
END $$;

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
      array_agg(DISTINCT (assignee_element->>'name')) FILTER (WHERE assignee_element->>'name' != '')
    ELSE ARRAY[]::text[]
  END as assignee_names,
  jsonb_array_length(t.assignees) as assignee_count
FROM facility_tasks t
CROSS JOIN LATERAL jsonb_array_elements(t.assignees) as assignee_element(assignee_element)
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
    COUNT(*) FILTER (WHERE status NOT IN ('completion', 'subsidy_payment')) as pending_tasks,
    COUNT(*) FILTER (WHERE status IN ('completion', 'subsidy_payment')) as completed_tasks,
    COUNT(*) FILTER (WHERE priority = 'high') as high_priority_tasks
  FROM facility_tasks t
  CROSS JOIN LATERAL jsonb_array_elements(t.assignees) as assignee_element(assignee_element)
  WHERE t.is_active = true
    AND t.is_deleted = false
    AND assignee_element->>'name' = assignee_name;
END;
$$ LANGUAGE plpgsql;

-- 8. 다중 담당자 테스트 데이터 추가
INSERT INTO facility_tasks (
    title,
    description,
    business_name,
    task_type,
    status,
    priority,
    assignees,
    primary_assignee_id,
    due_date
) VALUES
(
    '다중 담당자 테스트 업무',
    '여러 담당자가 협업하는 대기오염방지시설 설치 프로젝트',
    '협업 테스트 사업장',
    'self',
    'site_survey',
    'high',
    '[
        {"id": "1", "name": "김협업", "position": "대리", "email": "kim@company.com"},
        {"id": "2", "name": "박협업", "position": "과장", "email": "park@company.com"},
        {"id": "3", "name": "이협업", "position": "주임", "email": "lee@company.com"}
    ]'::jsonb,
    '1',
    CURRENT_DATE + INTERVAL '20 days'
);

-- 9. 댓글 및 설명 추가
COMMENT ON COLUMN facility_tasks.assignees IS '담당자 목록 (JSON 배열) - id, name, position, email 포함';
COMMENT ON COLUMN facility_tasks.primary_assignee_id IS '주 담당자 ID (선택사항)';
COMMENT ON COLUMN facility_tasks.assignee_updated_at IS '담당자 정보 마지막 업데이트 시간';
COMMENT ON VIEW facility_tasks_with_assignee_names IS '담당자 이름이 배열로 추출된 업무 목록 뷰';
COMMENT ON FUNCTION get_assignee_task_stats IS '특정 담당자의 업무 통계 조회 함수';

-- 10. 데이터 검증 쿼리 (실행 후 확인용)
-- 기존 단일 담당자 → 다중 담당자 변환 확인
SELECT
  id,
  title,
  assignee as old_assignee,
  assignees as new_assignees,
  primary_assignee_id,
  assignee_updated_at
FROM facility_tasks
WHERE assignees != '[]'::jsonb
ORDER BY created_at DESC
LIMIT 5;

-- 11. 성능 최적화를 위한 VACUUM
-- 주의: VACUUM은 별도로 실행해야 합니다 (트랜잭션 블록 외부에서)
-- VACUUM ANALYZE facility_tasks;

-- 완료 메시지
SELECT
    '다중 담당자 기능이 성공적으로 추가되었습니다!' as message,
    count(*) as total_tasks,
    count(*) FILTER (WHERE jsonb_array_length(assignees) > 1) as multi_assignee_tasks
FROM facility_tasks;

-- 12. 사용 예시 쿼리들
/*
-- 특정 담당자의 업무 조회
SELECT * FROM facility_tasks_with_assignee_names
WHERE '김협업' = ANY(assignee_names);

-- 담당자별 업무 통계
SELECT * FROM get_assignee_task_stats('김협업');

-- 다중 담당자 업무 조회
SELECT title, assignees, assignee_count
FROM facility_tasks_with_assignee_names
WHERE assignee_count > 1;

-- 특정 사용자가 포함된 팀 업무 조회
SELECT t.title, t.assignees
FROM facility_tasks t
WHERE t.assignees @> '[{"name": "김협업"}]';
*/