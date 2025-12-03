-- ============================================
-- 🔒 남은 13개 Security Definer View 수정
-- ============================================

DO $$
DECLARE
    views_to_fix TEXT[] := ARRAY[
        'commission_rate_history',
        'task_status_statistics',
        'order_management_detail',
        'facility_tasks_with_business',
        'user_stats',
        'survey_calendar_events',
        'facility_tasks_with_assignee_names',
        'current_commission_rates',
        'business_stats',
        'task_details',
        'order_management_timeline',
        'document_history_detail',
        'task_status_timeline'
    ];
    v TEXT;
    view_def TEXT;
    view_exists BOOLEAN;
BEGIN
    RAISE NOTICE '=== Security Definer View 수정 시작 ===';

    FOREACH v IN ARRAY views_to_fix
    LOOP
        -- 뷰 존재 확인
        SELECT EXISTS (
            SELECT 1 FROM pg_views
            WHERE schemaname = 'public' AND viewname = v
        ) INTO view_exists;

        IF view_exists THEN
            -- 현재 뷰 정의 가져오기
            SELECT pg_get_viewdef(c.oid, true)
            INTO view_def
            FROM pg_class c
            JOIN pg_namespace n ON c.relnamespace = n.oid
            WHERE n.nspname = 'public' AND c.relname = v;

            BEGIN
                -- 뷰 삭제 후 재생성
                EXECUTE format('DROP VIEW IF EXISTS public.%I CASCADE', v);

                EXECUTE format(
                    'CREATE VIEW public.%I WITH (security_invoker = true) AS %s',
                    v, view_def
                );

                -- 권한 부여
                EXECUTE format('GRANT SELECT ON public.%I TO anon, authenticated, service_role', v);

                RAISE NOTICE '✅ Fixed: %', v;
            EXCEPTION WHEN OTHERS THEN
                RAISE NOTICE '❌ Failed: % - %', v, SQLERRM;
            END;
        ELSE
            RAISE NOTICE '⏭️ Not found: %', v;
        END IF;
    END LOOP;

    RAISE NOTICE '=== 완료 ===';
END $$;

-- ============================================
-- 검증: 남은 Security Definer View 확인
-- ============================================

SELECT
    c.relname as view_name,
    CASE
        WHEN c.reloptions::text LIKE '%security_invoker=true%' THEN '✅ Security Invoker'
        ELSE '❌ Security Definer'
    END as security_mode
FROM pg_class c
JOIN pg_namespace n ON c.relnamespace = n.oid
WHERE n.nspname = 'public'
AND c.relkind = 'v'
AND c.relname IN (
    'commission_rate_history',
    'task_status_statistics',
    'order_management_detail',
    'facility_tasks_with_business',
    'user_stats',
    'survey_calendar_events',
    'facility_tasks_with_assignee_names',
    'current_commission_rates',
    'business_stats',
    'task_details',
    'order_management_timeline',
    'document_history_detail',
    'task_status_timeline'
)
ORDER BY c.relname;
