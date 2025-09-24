-- 조직 관리 시스템 데이터베이스 스키마 확장
-- 기존 departments, teams 테이블에 추가 컬럼과 새 테이블 생성

-- ===================================
-- 1. 기존 테이블 확장
-- ===================================

-- departments 테이블 확장
DO $$
BEGIN
    -- display_order 컬럼 추가 (정렬 순서용)
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name = 'departments' AND column_name = 'display_order') THEN
        ALTER TABLE departments ADD COLUMN display_order INTEGER DEFAULT 0;
        RAISE NOTICE 'departments 테이블에 display_order 컬럼 추가';
    END IF;

    -- is_active 컬럼 추가 (soft delete용)
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name = 'departments' AND column_name = 'is_active') THEN
        ALTER TABLE departments ADD COLUMN is_active BOOLEAN DEFAULT true;
        RAISE NOTICE 'departments 테이블에 is_active 컬럼 추가';
    END IF;

    -- updated_by 컬럼 추가 (수정자 추적용)
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name = 'departments' AND column_name = 'updated_by') THEN
        ALTER TABLE departments ADD COLUMN updated_by UUID;
        RAISE NOTICE 'departments 테이블에 updated_by 컬럼 추가';
    END IF;

    -- 기존 데이터에 기본값 설정
    UPDATE departments
    SET display_order = id, is_active = true
    WHERE display_order IS NULL OR is_active IS NULL;
END $$;

-- teams 테이블 확장
DO $$
BEGIN
    -- display_order 컬럼 추가
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name = 'teams' AND column_name = 'display_order') THEN
        ALTER TABLE teams ADD COLUMN display_order INTEGER DEFAULT 0;
        RAISE NOTICE 'teams 테이블에 display_order 컬럼 추가';
    END IF;

    -- is_active 컬럼 추가
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name = 'teams' AND column_name = 'is_active') THEN
        ALTER TABLE teams ADD COLUMN is_active BOOLEAN DEFAULT true;
        RAISE NOTICE 'teams 테이블에 is_active 컬럼 추가';
    END IF;

    -- manager_user_id 컬럼 추가 (팀 매니저)
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name = 'teams' AND column_name = 'manager_user_id') THEN
        ALTER TABLE teams ADD COLUMN manager_user_id UUID;
        RAISE NOTICE 'teams 테이블에 manager_user_id 컬럼 추가';
    END IF;

    -- updated_by 컬럼 추가
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name = 'teams' AND column_name = 'updated_by') THEN
        ALTER TABLE teams ADD COLUMN updated_by UUID;
        RAISE NOTICE 'teams 테이블에 updated_by 컬럼 추가';
    END IF;

    -- 기존 데이터에 기본값 설정
    UPDATE teams
    SET display_order = id, is_active = true
    WHERE display_order IS NULL OR is_active IS NULL;
END $$;

-- ===================================
-- 2. 조직 변경 히스토리 테이블 생성
-- ===================================

CREATE TABLE IF NOT EXISTS organization_changes (
    id SERIAL PRIMARY KEY,
    change_type TEXT NOT NULL CHECK (change_type IN ('create', 'update', 'delete', 'move')),
    entity_type TEXT NOT NULL CHECK (entity_type IN ('department', 'team')),
    entity_id INTEGER NOT NULL,
    old_data JSONB,
    new_data JSONB,
    changed_by UUID NOT NULL,
    changed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    impact_summary TEXT
);

-- organization_changes 테이블 인덱스
CREATE INDEX IF NOT EXISTS idx_org_changes_entity ON organization_changes(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_org_changes_changed_by ON organization_changes(changed_by);
CREATE INDEX IF NOT EXISTS idx_org_changes_changed_at ON organization_changes(changed_at DESC);
CREATE INDEX IF NOT EXISTS idx_org_changes_type ON organization_changes(change_type);

-- ===================================
-- 3. 기존 테이블 인덱스 추가
-- ===================================

-- departments 테이블 인덱스
CREATE INDEX IF NOT EXISTS idx_departments_display_order ON departments(display_order) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_departments_active ON departments(is_active);
CREATE INDEX IF NOT EXISTS idx_departments_name ON departments(name) WHERE is_active = true;

-- teams 테이블 인덱스
CREATE INDEX IF NOT EXISTS idx_teams_department_order ON teams(department_id, display_order) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_teams_active ON teams(is_active);
CREATE INDEX IF NOT EXISTS idx_teams_manager ON teams(manager_user_id) WHERE manager_user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_teams_name_dept ON teams(name, department_id) WHERE is_active = true;

-- ===================================
-- 4. 조직 구조 동기화 트리거 함수
-- ===================================

-- 조직 변경 시 알림 시스템 동기화 트리거
CREATE OR REPLACE FUNCTION sync_organization_notifications()
RETURNS TRIGGER AS $$
BEGIN
    -- 팀 정보 변경 시
    IF TG_TABLE_NAME = 'teams' AND TG_OP = 'UPDATE' THEN
        -- 팀이 다른 부서로 이동된 경우
        IF OLD.department_id != NEW.department_id THEN
            UPDATE notifications
            SET metadata = COALESCE(metadata, '{}') || jsonb_build_object(
                'organization_sync', now()::text,
                'team_moved', jsonb_build_object(
                    'from_dept', OLD.department_id,
                    'to_dept', NEW.department_id
                )
            )
            WHERE target_team_id = NEW.id;
        END IF;

        -- 팀이 비활성화된 경우
        IF OLD.is_active = true AND NEW.is_active = false THEN
            UPDATE notifications
            SET target_team_id = NULL,
                target_department_id = NEW.department_id,
                metadata = COALESCE(metadata, '{}') || jsonb_build_object(
                    'migration_note', '팀 삭제로 인한 부서 알림 변경',
                    'original_team_id', NEW.id
                )
            WHERE target_team_id = NEW.id;
        END IF;
    END IF;

    -- 부서 정보 변경 시
    IF TG_TABLE_NAME = 'departments' AND TG_OP = 'UPDATE' THEN
        -- 부서가 비활성화된 경우
        IF OLD.is_active = true AND NEW.is_active = false THEN
            UPDATE notifications
            SET target_department_id = NULL,
                notification_tier = 'company',
                metadata = COALESCE(metadata, '{}') || jsonb_build_object(
                    'migration_note', '부서 삭제로 인한 전사 알림 변경',
                    'original_dept_id', NEW.id
                )
            WHERE target_department_id = NEW.id;
        END IF;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 트리거 생성
DROP TRIGGER IF EXISTS trigger_sync_team_notifications ON teams;
CREATE TRIGGER trigger_sync_team_notifications
    AFTER UPDATE ON teams
    FOR EACH ROW
    EXECUTE FUNCTION sync_organization_notifications();

DROP TRIGGER IF EXISTS trigger_sync_department_notifications ON departments;
CREATE TRIGGER trigger_sync_department_notifications
    AFTER UPDATE ON departments
    FOR EACH ROW
    EXECUTE FUNCTION sync_organization_notifications();

-- ===================================
-- 5. 조직 통계 뷰 생성
-- ===================================

CREATE OR REPLACE VIEW organization_stats AS
SELECT
    (SELECT COUNT(*) FROM departments WHERE is_active = true) as active_departments,
    (SELECT COUNT(*) FROM departments WHERE is_active = false) as inactive_departments,
    (SELECT COUNT(*) FROM teams WHERE is_active = true) as active_teams,
    (SELECT COUNT(*) FROM teams WHERE is_active = false) as inactive_teams,
    (SELECT COUNT(*) FROM notifications WHERE target_department_id IS NOT NULL) as department_notifications,
    (SELECT COUNT(*) FROM notifications WHERE target_team_id IS NOT NULL) as team_notifications;

-- ===================================
-- 6. 기본 데이터 정렬 순서 설정
-- ===================================

-- 부서들의 표시 순서를 생성 순서로 설정
UPDATE departments
SET display_order = subquery.row_num
FROM (
    SELECT id, ROW_NUMBER() OVER (ORDER BY created_at) as row_num
    FROM departments
    WHERE is_active = true
) subquery
WHERE departments.id = subquery.id;

-- 팀들의 표시 순서를 부서별로 생성 순서로 설정
UPDATE teams
SET display_order = subquery.row_num
FROM (
    SELECT id, ROW_NUMBER() OVER (PARTITION BY department_id ORDER BY created_at) as row_num
    FROM teams
    WHERE is_active = true
) subquery
WHERE teams.id = subquery.id;

-- ===================================
-- 7. RLS (Row Level Security) 정책
-- ===================================

-- organization_changes 테이블 RLS 활성화
ALTER TABLE organization_changes ENABLE ROW LEVEL SECURITY;

-- 모든 사용자가 읽을 수 있도록 (애플리케이션에서 권한 체크)
CREATE POLICY IF NOT EXISTS "organization_changes_read_policy" ON organization_changes
    FOR SELECT USING (true);

-- 권한 있는 사용자만 생성 가능 (애플리케이션에서 권한 체크)
CREATE POLICY IF NOT EXISTS "organization_changes_insert_policy" ON organization_changes
    FOR INSERT WITH CHECK (true);

-- ===================================
-- 8. 마이그레이션 완료 확인
-- ===================================

DO $$
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '=== 조직 관리 시스템 마이그레이션 완료 ===';
    RAISE NOTICE '확장된 테이블:';
    RAISE NOTICE '- departments: % 개 (활성: %)',
        (SELECT COUNT(*) FROM departments),
        (SELECT COUNT(*) FROM departments WHERE is_active = true);
    RAISE NOTICE '- teams: % 개 (활성: %)',
        (SELECT COUNT(*) FROM teams),
        (SELECT COUNT(*) FROM teams WHERE is_active = true);
    RAISE NOTICE '';
    RAISE NOTICE '새로 생성된 테이블:';
    RAISE NOTICE '- organization_changes: % 개 기록',
        (SELECT COUNT(*) FROM organization_changes);
    RAISE NOTICE '';
    RAISE NOTICE '생성된 뷰:';
    RAISE NOTICE '- organization_stats: 조직 통계 뷰';
    RAISE NOTICE '';
    RAISE NOTICE '마이그레이션이 성공적으로 완료되었습니다.';
END $$;