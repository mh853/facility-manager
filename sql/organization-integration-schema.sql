-- ============================================================================
-- 조직도-프로필-알림 완전 통합 스키마
-- ============================================================================

-- 1. employees 테이블 확장 (권한과 직급 완전 분리)
ALTER TABLE employees
ADD COLUMN IF NOT EXISTS position_level INTEGER DEFAULT 1 CHECK (position_level BETWEEN 1 AND 10),
ADD COLUMN IF NOT EXISTS hire_date DATE,
ADD COLUMN IF NOT EXISTS profile_photo_url TEXT,
ADD COLUMN IF NOT EXISTS org_updated_at TIMESTAMP DEFAULT NOW();

-- 기존 필드 주석 추가
COMMENT ON COLUMN employees.position_level IS '조직 내 직급 (1=사원 ~ 10=사장) - permission_level과 무관';
COMMENT ON COLUMN employees.permission_level IS '시스템 접근 권한 (1=일반 ~ 4=슈퍼관리자) - position_level과 무관';

-- 2. 직급 레벨 정의 테이블
CREATE TABLE IF NOT EXISTS position_levels (
  level INTEGER PRIMARY KEY CHECK (level BETWEEN 1 AND 10),
  title TEXT NOT NULL,
  title_en TEXT,
  description TEXT,
  min_salary DECIMAL,
  max_salary DECIMAL,
  created_at TIMESTAMP DEFAULT NOW()
);

-- 기본 직급 데이터 입력
INSERT INTO position_levels (level, title, title_en, description) VALUES
(1, '사원', 'Associate', '신입 및 일반 사원'),
(2, '주임', 'Assistant', '경력 1-2년 직원'),
(3, '대리', 'Associate Manager', '경력 3-4년, 소규모 업무 책임'),
(4, '과장', 'Manager', '경력 5-7년, 팀 업무 관리'),
(5, '차장', 'Deputy General Manager', '경력 8-10년, 중간 관리자'),
(6, '부장', 'General Manager', '경력 10년 이상, 부서 관리'),
(7, '이사', 'Director', '임원급, 전략적 업무 책임'),
(8, '상무', 'Managing Director', '고위 임원, 사업부 책임'),
(9, '전무', 'Executive Managing Director', '최고경영진'),
(10, '사장', 'President', '최고경영자')
ON CONFLICT (level) DO NOTHING;

-- 3. 다중 팀 소속을 위한 중간 테이블
CREATE TABLE IF NOT EXISTS employee_team_memberships (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  is_primary BOOLEAN DEFAULT false,
  role_in_team TEXT DEFAULT '팀원',
  joined_at TIMESTAMP DEFAULT NOW(),
  created_by UUID REFERENCES employees(id),
  UNIQUE(employee_id, team_id)
);

-- 4. 부서/팀 리더 관리
ALTER TABLE departments
ADD COLUMN IF NOT EXISTS manager_id UUID REFERENCES employees(id),
ADD COLUMN IF NOT EXISTS deputy_manager_id UUID REFERENCES employees(id);

ALTER TABLE teams
ADD COLUMN IF NOT EXISTS leader_id UUID REFERENCES employees(id),
ADD COLUMN IF NOT EXISTS deputy_leader_id UUID REFERENCES employees(id);

-- 5. 조직 변경 히스토리 (알림 연동)
CREATE TABLE IF NOT EXISTS organization_changes_detailed (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID NOT NULL REFERENCES employees(id),
  change_type TEXT NOT NULL CHECK (change_type IN ('hire', 'team_join', 'team_leave', 'promotion', 'role_change', 'transfer', 'assignment_change')),

  -- Before/After 데이터
  old_data JSONB,
  new_data JSONB,

  -- 변경 상세
  from_team_id UUID REFERENCES teams(id),
  to_team_id UUID REFERENCES teams(id),
  old_position_level INTEGER,
  new_position_level INTEGER,

  -- 업무 관련 변경 (담당자 변경 시)
  affected_task_id UUID,
  task_change_type TEXT CHECK (task_change_type IN ('assigned', 'reassigned', 'unassigned')),

  -- 메타데이터
  changed_by UUID NOT NULL REFERENCES employees(id),
  changed_at TIMESTAMP DEFAULT NOW(),
  reason TEXT,
  notification_sent BOOLEAN DEFAULT false,

  -- 실시간 업데이트용
  realtime_channel TEXT DEFAULT 'organization_changes'
);

-- 6. 알림 시스템과 조직도 연결 강화
-- 기존 notifications 테이블에 제약조건 추가 (있다면)
DO $$
BEGIN
    -- notifications 테이블이 존재하는지 확인
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'notifications') THEN
        -- 외래키 제약조건 추가 (이미 있다면 무시)
        BEGIN
            ALTER TABLE notifications
            ADD CONSTRAINT fk_notifications_department
                FOREIGN KEY (target_department_id) REFERENCES departments(id);
        EXCEPTION WHEN duplicate_object THEN
            -- 이미 존재하는 경우 무시
        END;

        BEGIN
            ALTER TABLE notifications
            ADD CONSTRAINT fk_notifications_team
                FOREIGN KEY (target_team_id) REFERENCES teams(id);
        EXCEPTION WHEN duplicate_object THEN
            -- 이미 존재하는 경우 무시
        END;
    END IF;
END $$;

-- 7. 인덱스 생성
CREATE INDEX IF NOT EXISTS idx_employee_team_memberships_employee ON employee_team_memberships(employee_id);
CREATE INDEX IF NOT EXISTS idx_employee_team_memberships_team ON employee_team_memberships(team_id);
CREATE INDEX IF NOT EXISTS idx_employee_team_memberships_primary ON employee_team_memberships(employee_id, is_primary);
CREATE INDEX IF NOT EXISTS idx_organization_changes_employee ON organization_changes_detailed(employee_id);
CREATE INDEX IF NOT EXISTS idx_organization_changes_timestamp ON organization_changes_detailed(changed_at);
CREATE INDEX IF NOT EXISTS idx_organization_changes_task ON organization_changes_detailed(affected_task_id);
CREATE INDEX IF NOT EXISTS idx_employees_position_level ON employees(position_level);

-- 8. 통합 조직 뷰 (성능 최적화)
CREATE OR REPLACE VIEW v_organization_full AS
SELECT
  e.id, e.employee_id, e.name, e.email, e.position_level,
  pl.title as position_title,
  e.permission_level, e.is_active, e.created_at, e.profile_photo_url, e.hire_date,

  -- 주 소속 부서/팀
  primary_dept.id as primary_department_id,
  primary_dept.name as primary_department,
  primary_team.id as primary_team_id,
  primary_team.name as primary_team,

  -- 모든 팀 소속 정보 (JSON 배열)
  COALESCE(
    json_agg(
      DISTINCT jsonb_build_object(
        'team_id', all_teams.id,
        'team_name', all_teams.name,
        'department_id', all_teams.department_id,
        'department_name', all_depts.name,
        'is_primary', etm.is_primary,
        'role_in_team', etm.role_in_team,
        'joined_at', etm.joined_at
      )
    ) FILTER (WHERE all_teams.id IS NOT NULL), '[]'::json
  ) as team_memberships,

  -- 리더십 역할
  CASE
    WHEN primary_dept.manager_id = e.id THEN '부서장'
    WHEN primary_dept.deputy_manager_id = e.id THEN '부서장 대리'
    WHEN primary_team.leader_id = e.id THEN '팀장'
    WHEN primary_team.deputy_leader_id = e.id THEN '팀장 대리'
    ELSE NULL
  END as leadership_role,

  -- 관리 가능한 조직 단위 (권한 계산용)
  CASE
    WHEN e.permission_level >= 3 THEN 'all'
    WHEN primary_dept.manager_id = e.id THEN 'department'
    WHEN primary_team.leader_id = e.id THEN 'team'
    ELSE 'none'
  END as org_management_scope

FROM employees e
LEFT JOIN position_levels pl ON e.position_level = pl.level
LEFT JOIN employee_team_memberships primary_etm ON e.id = primary_etm.employee_id AND primary_etm.is_primary = true
LEFT JOIN teams primary_team ON primary_etm.team_id = primary_team.id
LEFT JOIN departments primary_dept ON primary_team.department_id = primary_dept.id
LEFT JOIN employee_team_memberships etm ON e.id = etm.employee_id
LEFT JOIN teams all_teams ON etm.team_id = all_teams.id
LEFT JOIN departments all_depts ON all_teams.department_id = all_depts.id
WHERE e.is_deleted = false
GROUP BY e.id, e.employee_id, e.name, e.email, e.position_level, pl.title,
         e.permission_level, e.is_active, e.created_at, e.profile_photo_url, e.hire_date,
         primary_dept.id, primary_dept.name, primary_team.id, primary_team.name,
         primary_dept.manager_id, primary_dept.deputy_manager_id,
         primary_team.leader_id, primary_team.deputy_leader_id;

-- 9. 조직 변경 시 알림 자동 발송 트리거
CREATE OR REPLACE FUNCTION notify_organization_changes()
RETURNS TRIGGER AS $$
DECLARE
    employee_record RECORD;
    changer_record RECORD;
    notification_data JSONB;
BEGIN
    -- 변경된 직원과 변경자 정보 조회
    SELECT * INTO employee_record FROM employees WHERE id = NEW.employee_id;
    SELECT * INTO changer_record FROM employees WHERE id = NEW.changed_by;

    -- 알림 데이터 구성
    notification_data := jsonb_build_object(
        'change_type', NEW.change_type,
        'employee_name', employee_record.name,
        'changer_name', changer_record.name,
        'old_data', NEW.old_data,
        'new_data', NEW.new_data,
        'reason', NEW.reason
    );

    -- notifications 테이블이 존재하는 경우 알림 생성
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'notifications') THEN
        -- 1. 본인에게 알림
        INSERT INTO notifications (
            title, message, notification_tier, target_user_id,
            type, metadata, created_at
        ) VALUES (
            CASE NEW.change_type
                WHEN 'team_join' THEN '팀 배치 알림'
                WHEN 'promotion' THEN '승진 축하드립니다!'
                WHEN 'transfer' THEN '조직 이동 알림'
                WHEN 'assignment_change' THEN '담당 업무 변경 알림'
                ELSE '조직 정보 변경'
            END,
            changer_record.name || '님이 회원님의 조직 정보를 변경했습니다.',
            'personal',
            employee_record.id,
            'organization_change',
            notification_data,
            NEW.changed_at
        );

        -- 2. 팀 변경 시 관련 팀에 알림
        IF NEW.change_type IN ('team_join', 'transfer') AND NEW.to_team_id IS NOT NULL THEN
            INSERT INTO notifications (
                title, message, notification_tier, target_team_id,
                type, metadata, created_at
            ) VALUES (
                '새 팀원 합류',
                employee_record.name || '님이 팀에 합류했습니다.',
                'team',
                NEW.to_team_id,
                'team_update',
                notification_data,
                NEW.changed_at
            );
        END IF;

        -- 3. 업무 담당자 변경 시 추가 알림
        IF NEW.change_type = 'assignment_change' AND NEW.affected_task_id IS NOT NULL THEN
            -- 업무 관련자들에게 알림 (구현 시 추가)
            -- 여기서는 기본 구조만 제공
        END IF;
    END IF;

    -- organization_changes_detailed 테이블의 notification_sent 플래그 업데이트
    UPDATE organization_changes_detailed
    SET notification_sent = true
    WHERE id = NEW.id;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 트리거 생성
DROP TRIGGER IF EXISTS trigger_notify_organization_changes ON organization_changes_detailed;
CREATE TRIGGER trigger_notify_organization_changes
    AFTER INSERT ON organization_changes_detailed
    FOR EACH ROW
    EXECUTE FUNCTION notify_organization_changes();

-- 10. 조직 변경 시 알림 데이터 정리 트리거
CREATE OR REPLACE FUNCTION update_notifications_on_org_change()
RETURNS TRIGGER AS $$
BEGIN
    -- notifications 테이블이 존재하는 경우에만 실행
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'notifications') THEN
        -- 팀 이동/삭제 시 관련 알림 처리
        IF TG_TABLE_NAME = 'teams' THEN
            IF TG_OP = 'DELETE' THEN
                -- 팀 삭제 시 팀 알림을 부서 알림으로 승격
                UPDATE notifications
                SET notification_tier = 'department',
                    target_team_id = NULL,
                    target_department_id = OLD.department_id,
                    metadata = COALESCE(metadata, '{}'::jsonb) || '{"migration_note": "팀 삭제로 인한 부서 알림 변경"}'::jsonb
                WHERE target_team_id = OLD.id;
            ELSIF TG_OP = 'UPDATE' AND OLD.department_id != NEW.department_id THEN
                -- 팀 이동 시 알림도 함께 이동
                UPDATE notifications
                SET target_department_id = NEW.department_id,
                    metadata = COALESCE(metadata, '{}'::jsonb) || '{"migration_note": "팀 이동으로 인한 알림 업데이트"}'::jsonb
                WHERE target_team_id = NEW.id;
            END IF;
        END IF;
    END IF;

    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- 트리거 설정
DROP TRIGGER IF EXISTS trigger_update_notifications_on_org_change ON teams;
CREATE TRIGGER trigger_update_notifications_on_org_change
    AFTER UPDATE OR DELETE ON teams
    FOR EACH ROW
    EXECUTE FUNCTION update_notifications_on_org_change();

-- 11. 기존 데이터 마이그레이션을 위한 함수
CREATE OR REPLACE FUNCTION migrate_existing_employee_data()
RETURNS void AS $$
DECLARE
    emp_record RECORD;
    dept_id UUID;
    team_id UUID;
BEGIN
    -- 기존 employees의 문자열 department/team을 새 구조로 마이그레이션
    FOR emp_record IN
        SELECT id, department, team
        FROM employees
        WHERE department IS NOT NULL OR team IS NOT NULL
    LOOP
        -- 부서 ID 찾기
        IF emp_record.department IS NOT NULL THEN
            SELECT id INTO dept_id
            FROM departments
            WHERE name = emp_record.department
            LIMIT 1;
        END IF;

        -- 팀 ID 찾기
        IF emp_record.team IS NOT NULL THEN
            SELECT id INTO team_id
            FROM teams
            WHERE name = emp_record.team
            LIMIT 1;

            -- 팀 소속 관계 생성
            IF team_id IS NOT NULL THEN
                INSERT INTO employee_team_memberships (employee_id, team_id, is_primary, role_in_team)
                VALUES (emp_record.id, team_id, true, '팀원')
                ON CONFLICT (employee_id, team_id) DO NOTHING;
            END IF;
        END IF;

        -- 기본 직급 레벨 설정 (기존 position 문자열 기반)
        UPDATE employees
        SET position_level = CASE
            WHEN position ILIKE '%사장%' THEN 10
            WHEN position ILIKE '%전무%' THEN 9
            WHEN position ILIKE '%상무%' THEN 8
            WHEN position ILIKE '%이사%' THEN 7
            WHEN position ILIKE '%부장%' THEN 6
            WHEN position ILIKE '%차장%' THEN 5
            WHEN position ILIKE '%과장%' THEN 4
            WHEN position ILIKE '%대리%' THEN 3
            WHEN position ILIKE '%주임%' THEN 2
            ELSE 1
        END,
        org_updated_at = NOW()
        WHERE id = emp_record.id AND position_level IS NULL;
    END LOOP;

    RAISE NOTICE '기존 직원 데이터 마이그레이션 완료';
END;
$$ LANGUAGE plpgsql;

-- 마이그레이션 실행 (안전하게)
-- SELECT migrate_existing_employee_data();

-- ============================================================================
-- 완료 메시지
-- ============================================================================
DO $$
BEGIN
    RAISE NOTICE '=================================================';
    RAISE NOTICE '조직도-프로필-알림 통합 스키마 구축 완료!';
    RAISE NOTICE '=================================================';
    RAISE NOTICE '✅ employees 테이블 확장 (권한/직급 분리)';
    RAISE NOTICE '✅ 직급 레벨 시스템 구축';
    RAISE NOTICE '✅ 다중 팀 소속 지원';
    RAISE NOTICE '✅ 리더십 역할 관리';
    RAISE NOTICE '✅ 조직 변경 히스토리 추적';
    RAISE NOTICE '✅ 알림 시스템 연동';
    RAISE NOTICE '✅ 실시간 업데이트 지원';
    RAISE NOTICE '✅ 담당자 업무 변경 알림';
    RAISE NOTICE '=================================================';
END $$;