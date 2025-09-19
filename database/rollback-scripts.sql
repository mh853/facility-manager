-- ===============================================
-- 통합 스키마 롤백 스크립트
-- 마이그레이션 롤백 시 사용하는 안전한 되돌리기 스크립트
-- ===============================================

-- 주의사항:
-- 1. 롤백 전 반드시 데이터베이스 백업을 수행하세요
-- 2. 프로덕션 환경에서는 단계별 롤백을 권장합니다
-- 3. 외래키 제약조건으로 인해 순서를 지켜서 실행해야 합니다

-- ===============================================
-- Phase 3 롤백: 주간 보고서 시스템 제거
-- ===============================================

DO $$
BEGIN
    RAISE NOTICE '시작: Phase 3 주간 보고서 시스템 롤백 - %', NOW();
END $$;

-- 1. 뷰 제거
DROP VIEW IF EXISTS weekly_reports_summary CASCADE;
DROP VIEW IF EXISTS department_report_statistics CASCADE;

-- 2. 함수 제거
DROP FUNCTION IF EXISTS generate_weekly_report_template(UUID, DATE, UUID) CASCADE;
DROP FUNCTION IF EXISTS calculate_weekly_metrics(UUID, DATE) CASCADE;
DROP FUNCTION IF EXISTS generate_weekly_reports_for_all_users(DATE) CASCADE;

-- 3. 트리거 제거
DROP TRIGGER IF EXISTS weekly_reports_week_info_trigger ON weekly_reports;
DROP TRIGGER IF EXISTS weekly_reports_status_change_trigger ON weekly_reports;
DROP TRIGGER IF EXISTS update_weekly_reports_updated_at ON weekly_reports;
DROP TRIGGER IF EXISTS update_weekly_report_templates_updated_at ON weekly_report_templates;
DROP TRIGGER IF EXISTS update_weekly_report_approvals_updated_at ON weekly_report_approvals;
DROP TRIGGER IF EXISTS update_weekly_report_metrics_updated_at ON weekly_report_metrics;

-- 4. 트리거 함수 제거
DROP FUNCTION IF EXISTS calculate_week_info() CASCADE;
DROP FUNCTION IF EXISTS handle_report_status_change() CASCADE;

-- 5. RLS 정책 제거
-- weekly_reports 정책
DROP POLICY IF EXISTS "Users can manage own weekly reports" ON weekly_reports;
DROP POLICY IF EXISTS "Managers can view department reports" ON weekly_reports;
DROP POLICY IF EXISTS "Admins can view all reports" ON weekly_reports;

-- weekly_report_templates 정책
DROP POLICY IF EXISTS "Users can view templates" ON weekly_report_templates;
DROP POLICY IF EXISTS "Managers can manage templates" ON weekly_report_templates;

-- weekly_report_approvals 정책
DROP POLICY IF EXISTS "Approvers can manage approvals" ON weekly_report_approvals;

-- weekly_report_metrics 정책
DROP POLICY IF EXISTS "Users can view own metrics" ON weekly_report_metrics;
DROP POLICY IF EXISTS "Managers can view department metrics" ON weekly_report_metrics;

-- 6. 테이블 제거 (의존성 순서대로)
DROP TABLE IF EXISTS weekly_report_approvals CASCADE;
DROP TABLE IF EXISTS weekly_report_metrics CASCADE;
DROP TABLE IF EXISTS weekly_report_templates CASCADE;
DROP TABLE IF EXISTS weekly_reports CASCADE;

RAISE NOTICE '✓ Phase 3 주간 보고서 시스템 롤백 완료';

-- ===============================================
-- Phase 2 롤백: 협업 시스템 제거
-- ===============================================

DO $$
BEGIN
    RAISE NOTICE '시작: Phase 2 협업 시스템 롤백 - %', NOW();
END $$;

-- 1. 뷰 제거
DROP VIEW IF EXISTS collaboration_dashboard CASCADE;
DROP VIEW IF EXISTS facility_tasks_extended CASCADE;

-- 2. 함수 제거
DROP FUNCTION IF EXISTS create_collaboration_request(UUID, UUID, UUID, UUID, VARCHAR, VARCHAR, TEXT, VARCHAR, DATE, UUID) CASCADE;
DROP FUNCTION IF EXISTS respond_collaboration_request(UUID, VARCHAR, TEXT, UUID) CASCADE;
DROP FUNCTION IF EXISTS add_facility_task_tag(UUID, VARCHAR) CASCADE;

-- 3. 트리거 제거
DROP TRIGGER IF EXISTS facility_task_collaboration_status_trigger ON task_collaborations;
DROP TRIGGER IF EXISTS update_task_collaborations_updated_at ON task_collaborations;
DROP TRIGGER IF EXISTS update_facility_task_comments_updated_at ON facility_task_comments;
DROP TRIGGER IF EXISTS update_department_task_assignments_updated_at ON department_task_assignments;

-- 4. 트리거 함수 제거
DROP FUNCTION IF EXISTS update_facility_task_collaboration_status() CASCADE;

-- 5. RLS 정책 제거
-- task_collaborations 정책
DROP POLICY IF EXISTS "Users can view related collaborations" ON task_collaborations;
DROP POLICY IF EXISTS "Users can create collaboration requests" ON task_collaborations;
DROP POLICY IF EXISTS "Users can update own requests or received requests" ON task_collaborations;

-- facility_task_comments 정책
DROP POLICY IF EXISTS "Users can view task comments" ON facility_task_comments;
DROP POLICY IF EXISTS "Users can create task comments" ON facility_task_comments;

-- department_task_assignments 정책
DROP POLICY IF EXISTS "Department managers can manage assignments" ON department_task_assignments;

-- 6. 테이블 제거 (의존성 순서대로)
DROP TABLE IF EXISTS facility_task_comments CASCADE;
DROP TABLE IF EXISTS task_collaborations CASCADE;
DROP TABLE IF EXISTS department_task_assignments CASCADE;

-- 7. facility_tasks 테이블에서 추가된 컬럼 제거
DO $$
BEGIN
    -- collaboration_status 컬럼 제거
    BEGIN
        ALTER TABLE facility_tasks DROP COLUMN IF EXISTS collaboration_status;
        RAISE NOTICE '✓ collaboration_status 컬럼 제거 완료';
    EXCEPTION WHEN OTHERS THEN
        RAISE WARNING '⚠ collaboration_status 컬럼 제거 실패: %', SQLERRM;
    END;

    -- created_by 컬럼 제거
    BEGIN
        ALTER TABLE facility_tasks DROP COLUMN IF EXISTS created_by;
        RAISE NOTICE '✓ created_by 컬럼 제거 완료';
    EXCEPTION WHEN OTHERS THEN
        RAISE WARNING '⚠ created_by 컬럼 제거 실패: %', SQLERRM;
    END;

    -- updated_by 컬럼 제거
    BEGIN
        ALTER TABLE facility_tasks DROP COLUMN IF EXISTS updated_by;
        RAISE NOTICE '✓ updated_by 컬럼 제거 완료';
    EXCEPTION WHEN OTHERS THEN
        RAISE WARNING '⚠ updated_by 컬럼 제거 실패: %', SQLERRM;
    END;

    -- tags 컬럼 제거
    BEGIN
        ALTER TABLE facility_tasks DROP COLUMN IF EXISTS tags;
        RAISE NOTICE '✓ tags 컬럼 제거 완료';
    EXCEPTION WHEN OTHERS THEN
        RAISE WARNING '⚠ tags 컬럼 제거 실패: %', SQLERRM;
    END;

    -- attachments 컬럼 제거
    BEGIN
        ALTER TABLE facility_tasks DROP COLUMN IF EXISTS attachments;
        RAISE NOTICE '✓ attachments 컬럼 제거 완료';
    EXCEPTION WHEN OTHERS THEN
        RAISE WARNING '⚠ attachments 컬럼 제거 실패: %', SQLERRM;
    END;
END $$;

RAISE NOTICE '✓ Phase 2 협업 시스템 롤백 완료';

-- ===============================================
-- Phase 1 롤백: 소셜 로그인 확장 제거
-- ===============================================

DO $$
BEGIN
    RAISE NOTICE '시작: Phase 1 소셜 로그인 확장 롤백 - %', NOW();
END $$;

-- 1. 뷰 제거
DROP VIEW IF EXISTS user_profile_view CASCADE;

-- 2. 함수 제거
DROP FUNCTION IF EXISTS link_social_account(UUID, VARCHAR, VARCHAR, VARCHAR, VARCHAR, JSONB) CASCADE;
DROP FUNCTION IF EXISTS unlink_social_account(UUID, VARCHAR) CASCADE;
DROP FUNCTION IF EXISTS update_user_login(UUID, VARCHAR, JSONB, INET, TEXT) CASCADE;

-- 3. 트리거 제거
DROP TRIGGER IF EXISTS update_social_accounts_updated_at ON social_accounts;

-- 4. RLS 정책 제거
-- social_accounts 정책
DROP POLICY IF EXISTS "Users can manage own social accounts" ON social_accounts;
DROP POLICY IF EXISTS "Admins can view all social accounts" ON social_accounts;

-- user_sessions_extended 정책
DROP POLICY IF EXISTS "Users can manage own sessions" ON user_sessions_extended;

-- 5. 테이블 제거
DROP TABLE IF EXISTS user_sessions_extended CASCADE;
DROP TABLE IF EXISTS social_accounts CASCADE;

-- 6. employees 테이블에서 추가된 컬럼 제거
DO $$
BEGIN
    -- provider 컬럼 제거
    BEGIN
        ALTER TABLE employees DROP COLUMN IF EXISTS provider;
        RAISE NOTICE '✓ provider 컬럼 제거 완료';
    EXCEPTION WHEN OTHERS THEN
        RAISE WARNING '⚠ provider 컬럼 제거 실패: %', SQLERRM;
    END;

    -- provider_id 컬럼 제거
    BEGIN
        ALTER TABLE employees DROP COLUMN IF EXISTS provider_id;
        RAISE NOTICE '✓ provider_id 컬럼 제거 완료';
    EXCEPTION WHEN OTHERS THEN
        RAISE WARNING '⚠ provider_id 컬럼 제거 실패: %', SQLERRM;
    END;

    -- avatar_url 컬럼 제거
    BEGIN
        ALTER TABLE employees DROP COLUMN IF EXISTS avatar_url;
        RAISE NOTICE '✓ avatar_url 컬럼 제거 완료';
    EXCEPTION WHEN OTHERS THEN
        RAISE WARNING '⚠ avatar_url 컬럼 제거 실패: %', SQLERRM;
    END;

    -- last_login_at 컬럼 제거
    BEGIN
        ALTER TABLE employees DROP COLUMN IF EXISTS last_login_at;
        RAISE NOTICE '✓ last_login_at 컬럼 제거 완료';
    EXCEPTION WHEN OTHERS THEN
        RAISE WARNING '⚠ last_login_at 컬럼 제거 실패: %', SQLERRM;
    END;

    -- email_verified_at 컬럼 제거
    BEGIN
        ALTER TABLE employees DROP COLUMN IF EXISTS email_verified_at;
        RAISE NOTICE '✓ email_verified_at 컬럼 제거 완료';
    EXCEPTION WHEN OTHERS THEN
        RAISE WARNING '⚠ email_verified_at 컬럼 제거 실패: %', SQLERRM;
    END;
END $$;

RAISE NOTICE '✓ Phase 1 소셜 로그인 확장 롤백 완료';

-- ===============================================
-- 공통 함수 및 트리거 정리
-- ===============================================

-- 공통 트리거 함수 확인 (다른 테이블에서 사용 중이면 유지)
DO $$
DECLARE
    trigger_count INTEGER;
BEGIN
    -- update_updated_at_column 함수를 사용하는 트리거 수 확인
    SELECT COUNT(*)
    INTO trigger_count
    FROM information_schema.triggers
    WHERE trigger_name LIKE '%updated_at%'
    AND event_object_schema = 'public';

    IF trigger_count = 0 THEN
        -- 사용하는 트리거가 없으면 함수 제거
        DROP FUNCTION IF EXISTS update_updated_at_column() CASCADE;
        RAISE NOTICE '✓ update_updated_at_column 함수 제거 완료';
    ELSE
        RAISE NOTICE '⚠ update_updated_at_column 함수는 다른 테이블에서 사용 중이므로 유지됩니다';
    END IF;
END $$;

-- ===============================================
-- 백업 테이블 정리 (선택사항)
-- ===============================================

-- 백업 테이블이 있다면 제거 (주의: 데이터 손실 가능성)
-- DROP TABLE IF EXISTS employees_backup_phase1;
-- DROP TABLE IF EXISTS facility_tasks_backup_phase2;

-- ===============================================
-- 롤백 완료 확인
-- ===============================================

DO $$
DECLARE
    remaining_tables TEXT[];
    remaining_functions TEXT[];
BEGIN
    -- 마이그레이션으로 생성된 테이블이 남아있는지 확인
    SELECT ARRAY_AGG(table_name)
    INTO remaining_tables
    FROM information_schema.tables
    WHERE table_schema = 'public'
    AND table_name IN (
        'social_accounts', 'user_sessions_extended',
        'task_collaborations', 'facility_task_comments', 'department_task_assignments',
        'weekly_reports', 'weekly_report_templates', 'weekly_report_approvals', 'weekly_report_metrics'
    );

    -- 마이그레이션으로 생성된 함수가 남아있는지 확인
    SELECT ARRAY_AGG(routine_name)
    INTO remaining_functions
    FROM information_schema.routines
    WHERE routine_schema = 'public'
    AND routine_name IN (
        'link_social_account', 'unlink_social_account', 'update_user_login',
        'create_collaboration_request', 'respond_collaboration_request', 'add_facility_task_tag',
        'generate_weekly_report_template', 'calculate_weekly_metrics', 'generate_weekly_reports_for_all_users'
    );

    RAISE NOTICE '=== 통합 스키마 롤백 완료 ===';

    IF remaining_tables IS NOT NULL THEN
        RAISE WARNING '남은 테이블: %', array_to_string(remaining_tables, ', ');
    ELSE
        RAISE NOTICE '✓ 모든 마이그레이션 테이블이 제거되었습니다';
    END IF;

    IF remaining_functions IS NOT NULL THEN
        RAISE WARNING '남은 함수: %', array_to_string(remaining_functions, ', ');
    ELSE
        RAISE NOTICE '✓ 모든 마이그레이션 함수가 제거되었습니다';
    END IF;

    RAISE NOTICE '롤백 완료 시간: %', NOW();
END $$;

-- ===============================================
-- 단계별 롤백 스크립트들
-- ===============================================

/*
단계별 롤백이 필요한 경우 아래 스크립트들을 개별적으로 실행하세요:

-- Phase 3만 롤백 (주간 보고서 시스템만)
\i phase3-rollback-only.sql

-- Phase 2만 롤백 (협업 시스템만)
\i phase2-rollback-only.sql

-- Phase 1만 롤백 (소셜 로그인만)
\i phase1-rollback-only.sql
*/

-- ===============================================
-- 데이터 복구 가이드
-- ===============================================

/*
데이터 복구가 필요한 경우:

1. 백업에서 복구:
   pg_restore -d facility_manager backup_file.sql

2. 특정 테이블만 복구:
   INSERT INTO employees SELECT * FROM employees_backup_phase1;

3. 점진적 복구:
   - 먼저 기본 테이블들을 복구
   - 그 다음 외래키 관계가 있는 테이블들을 순서대로 복구
   - 마지막으로 뷰와 함수들을 재생성

4. 데이터 검증:
   SELECT COUNT(*) FROM employees;
   SELECT COUNT(*) FROM facility_tasks;
   -- 기존 데이터 수와 비교하여 검증
*/

RAISE NOTICE '🔄 통합 스키마 롤백이 완료되었습니다.';
RAISE NOTICE '데이터베이스가 마이그레이션 이전 상태로 되돌려졌습니다.';
RAISE NOTICE '필요시 백업에서 데이터를 복구하세요.';