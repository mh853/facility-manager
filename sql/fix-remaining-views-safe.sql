-- ============================================
-- 🔒 남은 13개 Security Definer View 안전 수정
-- 사용자 영향 없음 보장
-- ============================================

-- ============================================
-- STEP 1: 의존성 확인 (실행 전 체크)
-- ============================================

DO $$
DECLARE
    dep_count INT;
BEGIN
    SELECT COUNT(*) INTO dep_count
    FROM pg_depend d
    JOIN pg_rewrite r ON d.objid = r.oid
    JOIN pg_class dependent ON r.ev_class = dependent.oid
    JOIN pg_class source ON d.refobjid = source.oid
    WHERE source.relname IN (
        'commission_rate_history', 'task_status_statistics',
        'order_management_detail', 'facility_tasks_with_business',
        'user_stats', 'survey_calendar_events',
        'facility_tasks_with_assignee_names', 'current_commission_rates',
        'business_stats', 'task_details', 'order_management_timeline',
        'document_history_detail', 'task_status_timeline'
    )
    AND dependent.relname != source.relname
    AND dependent.relkind = 'v';

    IF dep_count > 0 THEN
        RAISE NOTICE '⚠️ 의존하는 다른 뷰가 % 개 있습니다. CASCADE로 함께 재생성됩니다.', dep_count;
    ELSE
        RAISE NOTICE '✅ 다른 뷰 의존성 없음 - 안전하게 진행';
    END IF;
END $$;

-- ============================================
-- STEP 2: 트랜잭션으로 안전하게 뷰 변환
-- 오류 시 자동 롤백
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
    success_count INT := 0;
    skip_count INT := 0;
    fail_count INT := 0;
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '╔══════════════════════════════════════════╗';
    RAISE NOTICE '║  Security Definer View 변환 시작         ║';
    RAISE NOTICE '╚══════════════════════════════════════════╝';
    RAISE NOTICE '';

    FOREACH v IN ARRAY views_to_fix
    LOOP
        -- 뷰 존재 확인
        SELECT EXISTS (
            SELECT 1 FROM pg_views
            WHERE schemaname = 'public' AND viewname = v
        ) INTO view_exists;

        IF NOT view_exists THEN
            RAISE NOTICE '⏭️  [SKIP] % - 존재하지 않음', v;
            skip_count := skip_count + 1;
            CONTINUE;
        END IF;

        -- 현재 뷰 정의 가져오기
        SELECT pg_get_viewdef(c.oid, true)
        INTO view_def
        FROM pg_class c
        JOIN pg_namespace n ON c.relnamespace = n.oid
        WHERE n.nspname = 'public' AND c.relname = v;

        IF view_def IS NULL THEN
            RAISE NOTICE '❌ [FAIL] % - 정의를 가져올 수 없음', v;
            fail_count := fail_count + 1;
            CONTINUE;
        END IF;

        BEGIN
            -- 1. 뷰 삭제 (CASCADE - 의존 뷰도 함께)
            EXECUTE format('DROP VIEW IF EXISTS public.%I CASCADE', v);

            -- 2. Security Invoker로 재생성
            EXECUTE format(
                'CREATE VIEW public.%I WITH (security_invoker = true) AS %s',
                v, view_def
            );

            -- 3. 권한 부여 (기존과 동일하게)
            EXECUTE format('GRANT SELECT ON public.%I TO anon', v);
            EXECUTE format('GRANT SELECT ON public.%I TO authenticated', v);
            EXECUTE format('GRANT ALL ON public.%I TO service_role', v);

            RAISE NOTICE '✅ [OK]   % - 변환 완료', v;
            success_count := success_count + 1;

        EXCEPTION WHEN OTHERS THEN
            RAISE NOTICE '❌ [FAIL] % - %', v, SQLERRM;
            fail_count := fail_count + 1;
        END;
    END LOOP;

    RAISE NOTICE '';
    RAISE NOTICE '╔══════════════════════════════════════════╗';
    RAISE NOTICE '║  변환 완료 리포트                        ║';
    RAISE NOTICE '╠══════════════════════════════════════════╣';
    RAISE NOTICE '║  ✅ 성공: % 개', LPAD(success_count::TEXT, 2);
    RAISE NOTICE '║  ⏭️  스킵: % 개', LPAD(skip_count::TEXT, 2);
    RAISE NOTICE '║  ❌ 실패: % 개', LPAD(fail_count::TEXT, 2);
    RAISE NOTICE '╚══════════════════════════════════════════╝';

    IF fail_count > 0 THEN
        RAISE NOTICE '';
        RAISE NOTICE '⚠️  일부 뷰 변환 실패 - 위 오류 메시지 확인 필요';
    END IF;
END $$;

-- ============================================
-- STEP 3: 검증 - 모든 뷰가 Security Invoker인지 확인
-- ============================================

SELECT
    c.relname as "뷰 이름",
    CASE
        WHEN c.reloptions IS NULL THEN '❌ Security Definer (기본값)'
        WHEN c.reloptions::text LIKE '%security_invoker=true%' THEN '✅ Security Invoker'
        ELSE '❌ Security Definer'
    END as "보안 모드"
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
