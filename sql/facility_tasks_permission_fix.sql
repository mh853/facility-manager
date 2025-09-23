-- facility_tasks 테이블 권한 시스템 추가
-- 권한 1 사용자가 본인 업무만 조회하고 관리할 수 있도록 수정

-- 1. created_by 및 권한 관련 컬럼 추가
ALTER TABLE facility_tasks
ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES employees(id),
ADD COLUMN IF NOT EXISTS created_by_name TEXT,
ADD COLUMN IF NOT EXISTS last_modified_by UUID REFERENCES employees(id),
ADD COLUMN IF NOT EXISTS last_modified_by_name TEXT;

-- 2. 기존 데이터에 created_by 정보 업데이트 (시스템 사용자로 설정)
-- 실제 환경에서는 관리자 계정 ID로 변경 필요
UPDATE facility_tasks
SET created_by_name = 'system',
    last_modified_by_name = 'system'
WHERE created_by IS NULL;

-- 3. 인덱스 추가 (성능 향상)
CREATE INDEX IF NOT EXISTS idx_facility_tasks_created_by ON facility_tasks(created_by);
CREATE INDEX IF NOT EXISTS idx_facility_tasks_last_modified_by ON facility_tasks(last_modified_by);

-- 4. 기존 RLS 정책 삭제 (권한별 접근 제어를 위해)
DROP POLICY IF EXISTS "Enable read access for all users" ON facility_tasks;
DROP POLICY IF EXISTS "Enable insert access for all users" ON facility_tasks;
DROP POLICY IF EXISTS "Enable update access for all users" ON facility_tasks;
DROP POLICY IF EXISTS "Enable delete access for all users" ON facility_tasks;

-- 5. 새로운 RLS 정책 생성 (권한 레벨별 접근 제어)
-- 권한 4 (관리자): 모든 업무 조회/수정 가능
-- 권한 1-3: 본인이 생성한 업무만 조회/수정 가능

-- 읽기 권한: 관리자는 모든 업무, 일반 사용자는 본인 업무만
CREATE POLICY "facility_tasks_select_policy" ON facility_tasks
  FOR SELECT USING (
    -- Service role은 모든 접근 가능 (API에서 사용)
    auth.role() = 'service_role'
    OR
    -- 관리자 권한 (permission_level >= 4)는 모든 업무 조회 가능
    (
      SELECT permission_level
      FROM employees
      WHERE id = auth.uid() AND is_active = true AND is_deleted = false
    ) >= 4
    OR
    -- 일반 사용자는 본인이 생성한 업무만 조회 가능
    created_by = auth.uid()
  );

-- 삽입 권한: 로그인한 사용자만 가능
CREATE POLICY "facility_tasks_insert_policy" ON facility_tasks
  FOR INSERT WITH CHECK (
    auth.role() = 'service_role'
    OR
    auth.uid() IS NOT NULL
  );

-- 수정 권한: 관리자는 모든 업무, 일반 사용자는 본인 업무만
CREATE POLICY "facility_tasks_update_policy" ON facility_tasks
  FOR UPDATE USING (
    auth.role() = 'service_role'
    OR
    -- 관리자 권한은 모든 업무 수정 가능
    (
      SELECT permission_level
      FROM employees
      WHERE id = auth.uid() AND is_active = true AND is_deleted = false
    ) >= 4
    OR
    -- 일반 사용자는 본인이 생성한 업무만 수정 가능
    created_by = auth.uid()
  );

-- 삭제 권한: 관리자는 모든 업무, 일반 사용자는 본인 업무만
CREATE POLICY "facility_tasks_delete_policy" ON facility_tasks
  FOR DELETE USING (
    auth.role() = 'service_role'
    OR
    -- 관리자 권한은 모든 업무 삭제 가능
    (
      SELECT permission_level
      FROM employees
      WHERE id = auth.uid() AND is_active = true AND is_deleted = false
    ) >= 4
    OR
    -- 일반 사용자는 본인이 생성한 업무만 삭제 가능
    created_by = auth.uid()
  );

-- 6. updated_at 자동 업데이트 트리거 함수 수정 (권한 정보 포함)
CREATE OR REPLACE FUNCTION update_facility_tasks_metadata()
RETURNS TRIGGER AS $$
BEGIN
  -- updated_at 항상 업데이트
  NEW.updated_at = now();

  -- INSERT인 경우 created_by 설정
  IF TG_OP = 'INSERT' THEN
    -- API에서 created_by가 이미 설정되지 않은 경우에만 auth.uid() 사용
    IF NEW.created_by IS NULL THEN
      NEW.created_by = auth.uid();
    END IF;
  END IF;

  -- UPDATE인 경우 last_modified_by 설정
  IF TG_OP = 'UPDATE' THEN
    -- API에서 last_modified_by가 이미 설정되지 않은 경우에만 auth.uid() 사용
    IF NEW.last_modified_by IS NULL OR NEW.last_modified_by = OLD.last_modified_by THEN
      NEW.last_modified_by = auth.uid();
    END IF;
  END IF;

  RETURN NEW;
END;
$$ language 'plpgsql';

-- 7. 기존 트리거 삭제 후 새 트리거 생성
DROP TRIGGER IF EXISTS update_facility_tasks_updated_at ON facility_tasks;

CREATE TRIGGER update_facility_tasks_metadata_trigger
  BEFORE INSERT OR UPDATE ON facility_tasks
  FOR EACH ROW
  EXECUTE FUNCTION update_facility_tasks_metadata();

-- 8. 업데이트된 뷰 생성 (권한 정보 포함)
DROP VIEW IF EXISTS facility_tasks_with_business;

CREATE OR REPLACE VIEW facility_tasks_with_business AS
SELECT
  t.*,
  b.address,
  b.manager_name,
  b.manager_contact,
  b.local_government,
  -- 생성자 정보
  creator.name as created_by_user_name,
  creator.email as created_by_user_email,
  creator.permission_level as created_by_permission_level,
  -- 수정자 정보
  modifier.name as last_modified_by_user_name,
  modifier.email as last_modified_by_user_email,
  modifier.permission_level as last_modified_by_permission_level
FROM facility_tasks t
LEFT JOIN business_info b ON t.business_name = b.business_name
LEFT JOIN employees creator ON t.created_by = creator.id
LEFT JOIN employees modifier ON t.last_modified_by = modifier.id
WHERE t.is_active = true AND t.is_deleted = false;

-- 9. 코멘트 업데이트
COMMENT ON COLUMN facility_tasks.created_by IS '업무 생성자 ID (employees 테이블 참조)';
COMMENT ON COLUMN facility_tasks.created_by_name IS '업무 생성자 이름 (캐시용)';
COMMENT ON COLUMN facility_tasks.last_modified_by IS '마지막 수정자 ID (employees 테이블 참조)';
COMMENT ON COLUMN facility_tasks.last_modified_by_name IS '마지막 수정자 이름 (캐시용)';

-- 10. 권한 확인을 위한 함수 생성
CREATE OR REPLACE FUNCTION check_facility_task_permission(
  task_id UUID,
  user_id UUID,
  operation TEXT DEFAULT 'read'
)
RETURNS BOOLEAN AS $$
DECLARE
  user_permission_level INTEGER;
  task_creator_id UUID;
BEGIN
  -- 사용자 권한 레벨 조회
  SELECT permission_level INTO user_permission_level
  FROM employees
  WHERE id = user_id AND is_active = true AND is_deleted = false;

  -- 관리자 권한 (4 이상)이면 모든 작업 허용
  IF user_permission_level >= 4 THEN
    RETURN TRUE;
  END IF;

  -- 업무 생성자 조회
  SELECT created_by INTO task_creator_id
  FROM facility_tasks
  WHERE id = task_id AND is_active = true AND is_deleted = false;

  -- 본인이 생성한 업무만 허용
  RETURN task_creator_id = user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION check_facility_task_permission IS '업무 권한 확인 함수 - 관리자는 모든 업무, 일반 사용자는 본인 업무만';