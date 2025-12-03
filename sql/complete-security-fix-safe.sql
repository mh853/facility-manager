-- ============================================
-- 🔒 Supabase 보안 이슈 완전 해결 SQL (안전 버전)
-- 존재하는 테이블/함수/뷰만 처리
-- ============================================

-- ============================================
-- PART 1: RLS 정책 생성 (존재하는 테이블만)
-- ============================================

DO $$
DECLARE
    tables TEXT[] := ARRAY[
        'business_contacts',
        'business_documents',
        'business_info',
        'businesses',
        'discharge_facilities',
        'document_versions',
        'employees',
        'facilities',
        'facility_photos',
        'file_categories',
        'measurement_data',
        'notifications',
        'organization_change_logs',
        'organization_changes_detailed',
        'prevention_facilities',
        'report_reviews',
        'reports',
        'revenue',
        'sync_queue',
        'task_comments',
        'task_notifications',
        'tasks',
        'uploaded_files'
    ];
    t TEXT;
    table_exists BOOLEAN;
BEGIN
    FOREACH t IN ARRAY tables
    LOOP
        -- 테이블 존재 여부 확인
        SELECT EXISTS (
            SELECT 1 FROM information_schema.tables
            WHERE table_schema = 'public' AND table_name = t
        ) INTO table_exists;

        IF table_exists THEN
            -- 기존 정책 삭제
            EXECUTE format(
                'DROP POLICY IF EXISTS "service_role_full_access" ON public.%I',
                t
            );
            -- 새 정책 생성
            EXECUTE format(
                'CREATE POLICY "service_role_full_access" ON public.%I
                 FOR ALL TO service_role USING (true) WITH CHECK (true)',
                t
            );
            RAISE NOTICE '✅ Created policy for: %', t;
        ELSE
            RAISE NOTICE '⏭️ Skipped (not exists): %', t;
        END IF;
    END LOOP;
END $$;

-- ============================================
-- PART 2: anon 접근 정책 (Realtime용)
-- ============================================

DO $$
DECLARE
    anon_tables TEXT[] := ARRAY[
        'employees',
        'notifications',
        'organization_changes_detailed',
        'task_notifications'
    ];
    t TEXT;
    table_exists BOOLEAN;
BEGIN
    FOREACH t IN ARRAY anon_tables
    LOOP
        SELECT EXISTS (
            SELECT 1 FROM information_schema.tables
            WHERE table_schema = 'public' AND table_name = t
        ) INTO table_exists;

        IF table_exists THEN
            EXECUTE format(
                'DROP POLICY IF EXISTS "anon_select_%s" ON public.%I',
                t, t
            );
            EXECUTE format(
                'CREATE POLICY "anon_select_%s" ON public.%I
                 FOR SELECT TO anon USING (true)',
                t, t
            );
            RAISE NOTICE '✅ Created anon policy for: %', t;
        END IF;
    END LOOP;
END $$;

-- ============================================
-- PART 3: RLS 활성화 (존재하는 테이블만)
-- ============================================

DO $$
DECLARE
    tables TEXT[] := ARRAY[
        'business_contacts',
        'business_documents',
        'business_info',
        'businesses',
        'discharge_facilities',
        'document_versions',
        'employees',
        'facilities',
        'facility_photos',
        'file_categories',
        'measurement_data',
        'notifications',
        'organization_change_logs',
        'organization_changes_detailed',
        'prevention_facilities',
        'report_reviews',
        'reports',
        'revenue',
        'sync_queue',
        'task_comments',
        'task_notifications',
        'tasks',
        'uploaded_files'
    ];
    t TEXT;
    table_exists BOOLEAN;
BEGIN
    FOREACH t IN ARRAY tables
    LOOP
        SELECT EXISTS (
            SELECT 1 FROM information_schema.tables
            WHERE table_schema = 'public' AND table_name = t
        ) INTO table_exists;

        IF table_exists THEN
            EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
            RAISE NOTICE '✅ Enabled RLS for: %', t;
        END IF;
    END LOOP;
END $$;

-- ============================================
-- PART 4: Function search_path 보안 (존재하는 함수만)
-- ============================================

DO $$
DECLARE
    func_record RECORD;
    functions TEXT[] := ARRAY[
        'update_updated_at_column',
        'check_storage_bucket_exists',
        'cleanup_old_reports',
        'cleanup_orphaned_photos',
        'ensure_business_contacts_updated_at',
        'fn_update_timestamp',
        'get_document_history',
        'get_existing_photo_hashes',
        'get_file_counts_by_business',
        'get_my_business_info',
        'get_organization_full',
        'get_revenue_summary',
        'get_revenue_with_business_names',
        'get_task_details',
        'handle_facility_photo_insert',
        'handle_new_user',
        'handle_photo_deletion',
        'handle_storage_delete',
        'is_duplicate_photo',
        'log_document_version',
        'log_organization_change',
        'manage_report_versions',
        'notify_facility_photo_change',
        'notify_task_assignment',
        'set_updated_at',
        'sync_photos_after_report_save',
        'trigger_set_updated_at',
        'trunc_to_month',
        'update_employee_timestamp',
        'update_modified_column',
        'update_report_timestamp',
        'update_revenue_updated_at',
        'update_task_status_timestamp',
        'update_task_timestamp',
        'update_timestamp',
        'upsert_measurement_data',
        'check_employee_password',
        'create_notification',
        'get_active_employees',
        'get_business_facilities',
        'get_business_reports',
        'get_employee_by_id',
        'get_facility_photos_by_business',
        'get_pending_tasks',
        'get_report_by_id',
        'get_tasks_by_assignee',
        'get_tasks_by_business',
        'get_unread_notifications',
        'handle_organization_change',
        'mark_notification_read',
        'search_businesses',
        'update_business_info',
        'update_employee_info',
        'update_facility_info',
        'update_report_status',
        'update_task_status',
        'validate_employee_login',
        'verify_employee_password'
    ];
    f TEXT;
BEGIN
    FOREACH f IN ARRAY functions
    LOOP
        -- 함수가 존재하는지 확인하고 시그니처와 함께 처리
        FOR func_record IN
            SELECT p.oid, p.proname,
                   pg_get_function_identity_arguments(p.oid) as args
            FROM pg_proc p
            JOIN pg_namespace n ON p.pronamespace = n.oid
            WHERE n.nspname = 'public' AND p.proname = f
        LOOP
            BEGIN
                IF func_record.args = '' THEN
                    EXECUTE format('ALTER FUNCTION public.%I() SET search_path = ''''', f);
                ELSE
                    EXECUTE format('ALTER FUNCTION public.%I(%s) SET search_path = ''''',
                                   f, func_record.args);
                END IF;
                RAISE NOTICE '✅ Set search_path for: %(%)', f, func_record.args;
            EXCEPTION WHEN OTHERS THEN
                RAISE NOTICE '⚠️ Could not alter: %(%) - %', f, func_record.args, SQLERRM;
            END;
        END LOOP;
    END LOOP;
END $$;

-- ============================================
-- PART 5: Security Invoker View 변환 (존재하는 뷰만)
-- 주의: 뷰 정의가 DB마다 다를 수 있어 개별 처리 권장
-- ============================================

-- 뷰 목록 확인 (실행 후 결과 보고 개별 처리)
SELECT
    schemaname,
    viewname,
    'DROP VIEW IF EXISTS public.' || viewname || '; -- 재생성 필요' as action
FROM pg_views
WHERE schemaname = 'public'
AND viewname IN (
    'v_business_contact_summary',
    'v_business_documents_with_versions',
    'v_business_facilities_summary',
    'v_business_facility_photos',
    'v_business_with_contacts',
    'v_discharge_facilities_full',
    'v_document_current_versions',
    'v_employee_tasks',
    'v_facility_measurement_summary',
    'v_facility_photo_stats',
    'v_organization_full',
    'v_prevention_facilities_full',
    'v_report_facility_photos',
    'v_report_with_review',
    'v_reports_with_business',
    'v_revenue_monthly_summary',
    'v_revenue_with_business',
    'v_task_assignments',
    'v_tasks_with_details'
);

-- ============================================
-- PART 6: 권한 부여 (존재하는 테이블만)
-- ============================================

DO $$
DECLARE
    grant_tables TEXT[] := ARRAY[
        'employees',
        'notifications',
        'organization_changes_detailed',
        'task_notifications'
    ];
    t TEXT;
    table_exists BOOLEAN;
BEGIN
    FOREACH t IN ARRAY grant_tables
    LOOP
        SELECT EXISTS (
            SELECT 1 FROM information_schema.tables
            WHERE table_schema = 'public' AND table_name = t
        ) INTO table_exists;

        IF table_exists THEN
            EXECUTE format('GRANT SELECT ON public.%I TO anon', t);
            RAISE NOTICE '✅ Granted SELECT to anon for: %', t;
        END IF;
    END LOOP;
END $$;

-- v_organization_full 뷰 권한 (존재하면)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_views WHERE schemaname = 'public' AND viewname = 'v_organization_full') THEN
        GRANT SELECT ON public.v_organization_full TO anon;
        RAISE NOTICE '✅ Granted SELECT on v_organization_full to anon';
    END IF;
END $$;

-- ============================================
-- 완료 리포트
-- ============================================

DO $$
DECLARE
    rls_count INT;
    policy_count INT;
BEGIN
    -- RLS 활성화된 테이블 수
    SELECT COUNT(*) INTO rls_count
    FROM pg_tables t
    JOIN pg_class c ON t.tablename = c.relname
    WHERE t.schemaname = 'public' AND c.relrowsecurity = true;

    -- 정책 수
    SELECT COUNT(*) INTO policy_count
    FROM pg_policies WHERE schemaname = 'public';

    RAISE NOTICE '========================================';
    RAISE NOTICE '✅ 보안 수정 완료!';
    RAISE NOTICE '----------------------------------------';
    RAISE NOTICE 'RLS 활성화된 테이블: % 개', rls_count;
    RAISE NOTICE '생성된 정책: % 개', policy_count;
    RAISE NOTICE '----------------------------------------';
    RAISE NOTICE '⚠️ View 변환은 PART 5 결과 확인 후';
    RAISE NOTICE '   개별 처리가 필요합니다.';
    RAISE NOTICE '⚠️ PostgreSQL 버전 업그레이드는';
    RAISE NOTICE '   Dashboard에서 진행하세요.';
    RAISE NOTICE '========================================';
END $$;
