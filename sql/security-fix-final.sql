-- ============================================
-- 🔒 Supabase 보안 완전 해결 SQL (단일 실행)
-- 실행: Supabase Dashboard → SQL Editor → Run
-- ============================================

-- ============================================
-- STEP 1: 모든 public 테이블에 RLS 정책 생성 + 활성화
-- ============================================

DO $$
DECLARE
    r RECORD;
    policy_exists BOOLEAN;
BEGIN
    RAISE NOTICE '=== STEP 1: RLS 정책 생성 및 활성화 ===';

    FOR r IN
        SELECT tablename
        FROM pg_tables
        WHERE schemaname = 'public'
        AND tablename NOT LIKE 'pg_%'
        AND tablename NOT LIKE '_realtime%'
        AND tablename NOT LIKE 'schema_%'
    LOOP
        -- 기존 service_role 정책 확인
        SELECT EXISTS (
            SELECT 1 FROM pg_policies
            WHERE schemaname = 'public'
            AND tablename = r.tablename
            AND policyname = 'service_role_full_access'
        ) INTO policy_exists;

        -- 정책이 없으면 생성
        IF NOT policy_exists THEN
            EXECUTE format(
                'CREATE POLICY "service_role_full_access" ON public.%I
                 FOR ALL TO service_role USING (true) WITH CHECK (true)',
                r.tablename
            );
            RAISE NOTICE '✅ Created service_role policy: %', r.tablename;
        ELSE
            RAISE NOTICE '⏭️ Policy exists: %', r.tablename;
        END IF;

        -- RLS 활성화
        EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', r.tablename);
        RAISE NOTICE '✅ Enabled RLS: %', r.tablename;
    END LOOP;
END $$;

-- ============================================
-- STEP 2: Realtime/클라이언트 접근 테이블에 anon 정책 추가
-- ============================================

DO $$
DECLARE
    anon_tables TEXT[] := ARRAY[
        'employees',
        'notifications',
        'organization_changes_detailed',
        'task_notifications',
        'businesses',
        'facilities'
    ];
    t TEXT;
    table_exists BOOLEAN;
    policy_exists BOOLEAN;
BEGIN
    RAISE NOTICE '=== STEP 2: anon SELECT 정책 추가 ===';

    FOREACH t IN ARRAY anon_tables
    LOOP
        -- 테이블 존재 확인
        SELECT EXISTS (
            SELECT 1 FROM pg_tables
            WHERE schemaname = 'public' AND tablename = t
        ) INTO table_exists;

        IF table_exists THEN
            -- 정책 존재 확인
            SELECT EXISTS (
                SELECT 1 FROM pg_policies
                WHERE schemaname = 'public'
                AND tablename = t
                AND policyname = 'anon_select_access'
            ) INTO policy_exists;

            IF NOT policy_exists THEN
                EXECUTE format(
                    'CREATE POLICY "anon_select_access" ON public.%I
                     FOR SELECT TO anon USING (true)',
                    t
                );
                RAISE NOTICE '✅ Created anon policy: %', t;
            ELSE
                RAISE NOTICE '⏭️ Anon policy exists: %', t;
            END IF;
        ELSE
            RAISE NOTICE '⏭️ Table not found: %', t;
        END IF;
    END LOOP;
END $$;

-- ============================================
-- STEP 3: 모든 public 함수에 search_path 설정
-- ============================================

DO $$
DECLARE
    r RECORD;
BEGIN
    RAISE NOTICE '=== STEP 3: Function search_path 보안 ===';

    FOR r IN
        SELECT
            p.proname as func_name,
            pg_get_function_identity_arguments(p.oid) as func_args,
            p.oid
        FROM pg_proc p
        JOIN pg_namespace n ON p.pronamespace = n.oid
        WHERE n.nspname = 'public'
        AND p.prokind = 'f'  -- 일반 함수만
    LOOP
        BEGIN
            IF r.func_args = '' OR r.func_args IS NULL THEN
                EXECUTE format(
                    'ALTER FUNCTION public.%I() SET search_path = ''''',
                    r.func_name
                );
            ELSE
                EXECUTE format(
                    'ALTER FUNCTION public.%I(%s) SET search_path = ''''',
                    r.func_name, r.func_args
                );
            END IF;
            RAISE NOTICE '✅ Secured function: %(%)', r.func_name, COALESCE(r.func_args, '');
        EXCEPTION WHEN OTHERS THEN
            RAISE NOTICE '⚠️ Skip function: %(%) - %', r.func_name, COALESCE(r.func_args, ''), SQLERRM;
        END;
    END LOOP;
END $$;

-- ============================================
-- STEP 4: Security Definer View → Security Invoker 변환
-- ============================================

DO $$
DECLARE
    r RECORD;
    view_def TEXT;
    new_view_sql TEXT;
BEGIN
    RAISE NOTICE '=== STEP 4: View Security Invoker 변환 ===';

    FOR r IN
        SELECT
            c.relname as view_name,
            pg_get_viewdef(c.oid, true) as view_definition
        FROM pg_class c
        JOIN pg_namespace n ON c.relnamespace = n.oid
        WHERE n.nspname = 'public'
        AND c.relkind = 'v'
        AND c.relname LIKE 'v_%'  -- v_ 로 시작하는 뷰만
    LOOP
        BEGIN
            view_def := r.view_definition;

            -- 뷰 재생성 (security_invoker = true)
            EXECUTE format('DROP VIEW IF EXISTS public.%I CASCADE', r.view_name);

            new_view_sql := format(
                'CREATE VIEW public.%I WITH (security_invoker = true) AS %s',
                r.view_name, view_def
            );

            EXECUTE new_view_sql;

            -- 권한 부여
            EXECUTE format('GRANT SELECT ON public.%I TO anon, authenticated, service_role', r.view_name);

            RAISE NOTICE '✅ Converted view: %', r.view_name;
        EXCEPTION WHEN OTHERS THEN
            RAISE NOTICE '⚠️ Skip view: % - %', r.view_name, SQLERRM;
        END;
    END LOOP;
END $$;

-- ============================================
-- STEP 5: 권한 최종 정리
-- ============================================

GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;

-- ============================================
-- STEP 6: 최종 검증 리포트
-- ============================================

DO $$
DECLARE
    rls_enabled_count INT;
    rls_disabled_count INT;
    policy_count INT;
    view_count INT;
    func_count INT;
BEGIN
    -- RLS 활성화된 테이블
    SELECT COUNT(*) INTO rls_enabled_count
    FROM pg_tables t
    JOIN pg_class c ON t.tablename = c.relname
    JOIN pg_namespace n ON c.relnamespace = n.oid
    WHERE t.schemaname = 'public' AND n.nspname = 'public' AND c.relrowsecurity = true;

    -- RLS 비활성화된 테이블
    SELECT COUNT(*) INTO rls_disabled_count
    FROM pg_tables t
    JOIN pg_class c ON t.tablename = c.relname
    JOIN pg_namespace n ON c.relnamespace = n.oid
    WHERE t.schemaname = 'public' AND n.nspname = 'public' AND c.relrowsecurity = false
    AND t.tablename NOT LIKE 'pg_%' AND t.tablename NOT LIKE '_realtime%';

    -- 정책 수
    SELECT COUNT(*) INTO policy_count FROM pg_policies WHERE schemaname = 'public';

    -- 뷰 수
    SELECT COUNT(*) INTO view_count
    FROM pg_views WHERE schemaname = 'public' AND viewname LIKE 'v_%';

    -- 함수 수
    SELECT COUNT(*) INTO func_count
    FROM pg_proc p
    JOIN pg_namespace n ON p.pronamespace = n.oid
    WHERE n.nspname = 'public' AND p.prokind = 'f';

    RAISE NOTICE '';
    RAISE NOTICE '╔══════════════════════════════════════════╗';
    RAISE NOTICE '║       🔒 보안 수정 완료 리포트          ║';
    RAISE NOTICE '╠══════════════════════════════════════════╣';
    RAISE NOTICE '║ ✅ RLS 활성화 테이블: % 개', LPAD(rls_enabled_count::TEXT, 3);
    RAISE NOTICE '║ ⚠️  RLS 미활성화:      % 개', LPAD(rls_disabled_count::TEXT, 3);
    RAISE NOTICE '║ 📋 생성된 정책:        % 개', LPAD(policy_count::TEXT, 3);
    RAISE NOTICE '║ 👁️  처리된 뷰:          % 개', LPAD(view_count::TEXT, 3);
    RAISE NOTICE '║ 🔧 처리된 함수:        % 개', LPAD(func_count::TEXT, 3);
    RAISE NOTICE '╠══════════════════════════════════════════╣';
    RAISE NOTICE '║ ⚠️  PostgreSQL 버전 업그레이드는        ║';
    RAISE NOTICE '║    Dashboard → Settings → Infrastructure ║';
    RAISE NOTICE '╚══════════════════════════════════════════╝';
END $$;
