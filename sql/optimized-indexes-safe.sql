-- ============================================
-- 🚀 Disk IO 최적화 인덱스 (안전 버전)
-- 존재하는 테이블/컬럼만 처리
-- ============================================

DO $$
DECLARE
    idx_created INT := 0;
    idx_skipped INT := 0;
BEGIN
    RAISE NOTICE '=== 인덱스 생성 시작 ===';

    -- ============================================
    -- 1. employees 테이블
    -- ============================================
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'employees') THEN

        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'employees' AND column_name = 'email') THEN
            IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'employees' AND column_name = 'is_deleted') THEN
                CREATE INDEX IF NOT EXISTS idx_employees_email ON employees(email) WHERE is_deleted = false;
                idx_created := idx_created + 1;
            END IF;
        END IF;

        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'employees' AND column_name = 'is_active') THEN
            CREATE INDEX IF NOT EXISTS idx_employees_active ON employees(is_active, is_deleted) WHERE is_deleted = false;
            idx_created := idx_created + 1;
        END IF;

        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'employees' AND column_name = 'department') THEN
            CREATE INDEX IF NOT EXISTS idx_employees_department ON employees(department) WHERE is_deleted = false AND is_active = true;
            idx_created := idx_created + 1;
        END IF;

        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'employees' AND column_name = 'permission_level') THEN
            CREATE INDEX IF NOT EXISTS idx_employees_permission ON employees(permission_level) WHERE is_deleted = false;
            idx_created := idx_created + 1;
        END IF;

        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'employees' AND column_name = 'employee_id') THEN
            CREATE INDEX IF NOT EXISTS idx_employees_employee_id ON employees(employee_id) WHERE is_deleted = false;
            idx_created := idx_created + 1;
        END IF;

        RAISE NOTICE '✅ employees 인덱스 완료';
    ELSE
        RAISE NOTICE '⏭️ employees 테이블 없음';
        idx_skipped := idx_skipped + 1;
    END IF;

    -- ============================================
    -- 2. business_info 테이블
    -- ============================================
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'business_info') THEN

        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'business_info' AND column_name = 'business_name') THEN
            CREATE INDEX IF NOT EXISTS idx_business_info_name ON business_info(business_name) WHERE is_deleted = false;
            idx_created := idx_created + 1;
        END IF;

        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'business_info' AND column_name = 'is_active') THEN
            CREATE INDEX IF NOT EXISTS idx_business_info_active ON business_info(is_active, is_deleted) WHERE is_deleted = false;
            idx_created := idx_created + 1;
        END IF;

        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'business_info' AND column_name = 'manufacturer') THEN
            CREATE INDEX IF NOT EXISTS idx_business_info_manufacturer ON business_info(manufacturer) WHERE is_deleted = false AND is_active = true;
            idx_created := idx_created + 1;
        END IF;

        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'business_info' AND column_name = 'sales_office') THEN
            CREATE INDEX IF NOT EXISTS idx_business_info_sales_office ON business_info(sales_office) WHERE is_deleted = false AND is_active = true;
            idx_created := idx_created + 1;
        END IF;

        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'business_info' AND column_name = 'progress_status') THEN
            CREATE INDEX IF NOT EXISTS idx_business_info_status ON business_info(progress_status) WHERE is_deleted = false AND is_active = true;
            idx_created := idx_created + 1;
        END IF;

        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'business_info' AND column_name = 'installation_date') THEN
            CREATE INDEX IF NOT EXISTS idx_business_info_installation_date ON business_info(installation_date) WHERE is_deleted = false AND is_active = true;
            idx_created := idx_created + 1;
        END IF;

        RAISE NOTICE '✅ business_info 인덱스 완료';
    ELSE
        RAISE NOTICE '⏭️ business_info 테이블 없음';
        idx_skipped := idx_skipped + 1;
    END IF;

    -- ============================================
    -- 3. facility_tasks 테이블
    -- ============================================
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'facility_tasks') THEN

        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'facility_tasks' AND column_name = 'business_id') THEN
            CREATE INDEX IF NOT EXISTS idx_facility_tasks_business ON facility_tasks(business_id);
            idx_created := idx_created + 1;
        END IF;

        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'facility_tasks' AND column_name = 'business_name') THEN
            CREATE INDEX IF NOT EXISTS idx_facility_tasks_business_name ON facility_tasks(business_name);
            idx_created := idx_created + 1;
        END IF;

        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'facility_tasks' AND column_name = 'status') THEN
            CREATE INDEX IF NOT EXISTS idx_facility_tasks_status ON facility_tasks(status);
            idx_created := idx_created + 1;
        END IF;

        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'facility_tasks' AND column_name = 'assignee') THEN
            CREATE INDEX IF NOT EXISTS idx_facility_tasks_assignee ON facility_tasks(assignee);
            idx_created := idx_created + 1;
        END IF;

        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'facility_tasks' AND column_name = 'task_type') THEN
            CREATE INDEX IF NOT EXISTS idx_facility_tasks_type ON facility_tasks(task_type);
            idx_created := idx_created + 1;
        END IF;

        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'facility_tasks' AND column_name = 'due_date') THEN
            CREATE INDEX IF NOT EXISTS idx_facility_tasks_due_date ON facility_tasks(due_date);
            idx_created := idx_created + 1;
        END IF;

        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'facility_tasks' AND column_name = 'is_active') THEN
            CREATE INDEX IF NOT EXISTS idx_facility_tasks_active ON facility_tasks(is_active, is_deleted);
            idx_created := idx_created + 1;
        END IF;

        RAISE NOTICE '✅ facility_tasks 인덱스 완료';
    ELSE
        RAISE NOTICE '⏭️ facility_tasks 테이블 없음';
        idx_skipped := idx_skipped + 1;
    END IF;

    -- ============================================
    -- 4. task_notifications 테이블
    -- ============================================
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'task_notifications') THEN

        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'task_notifications' AND column_name = 'user_id') THEN
            IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'task_notifications' AND column_name = 'is_read') THEN
                CREATE INDEX IF NOT EXISTS idx_task_notifications_user_unread ON task_notifications(user_id, is_read) WHERE is_read = false;
                idx_created := idx_created + 1;
            ELSE
                CREATE INDEX IF NOT EXISTS idx_task_notifications_user ON task_notifications(user_id);
                idx_created := idx_created + 1;
            END IF;
        END IF;

        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'task_notifications' AND column_name = 'task_id') THEN
            CREATE INDEX IF NOT EXISTS idx_task_notifications_task ON task_notifications(task_id);
            idx_created := idx_created + 1;
        END IF;

        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'task_notifications' AND column_name = 'created_at') THEN
            CREATE INDEX IF NOT EXISTS idx_task_notifications_created ON task_notifications(created_at DESC);
            idx_created := idx_created + 1;
        END IF;

        RAISE NOTICE '✅ task_notifications 인덱스 완료';
    ELSE
        RAISE NOTICE '⏭️ task_notifications 테이블 없음';
        idx_skipped := idx_skipped + 1;
    END IF;

    -- ============================================
    -- 5. notifications 테이블
    -- ============================================
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'notifications') THEN

        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'notifications' AND column_name = 'user_id') THEN
            IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'notifications' AND column_name = 'is_read') THEN
                CREATE INDEX IF NOT EXISTS idx_notifications_user_unread ON notifications(user_id, is_read) WHERE is_read = false;
            ELSE
                CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id);
            END IF;
            idx_created := idx_created + 1;
        END IF;

        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'notifications' AND column_name = 'created_at') THEN
            CREATE INDEX IF NOT EXISTS idx_notifications_created ON notifications(created_at DESC);
            idx_created := idx_created + 1;
        END IF;

        RAISE NOTICE '✅ notifications 인덱스 완료';
    ELSE
        RAISE NOTICE '⏭️ notifications 테이블 없음';
        idx_skipped := idx_skipped + 1;
    END IF;

    -- ============================================
    -- 6. uploaded_files 테이블
    -- ============================================
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'uploaded_files') THEN

        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'uploaded_files' AND column_name = 'business_id') THEN
            IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'uploaded_files' AND column_name = 'is_deleted') THEN
                CREATE INDEX IF NOT EXISTS idx_uploaded_files_business ON uploaded_files(business_id) WHERE is_deleted = false;
            ELSE
                CREATE INDEX IF NOT EXISTS idx_uploaded_files_business ON uploaded_files(business_id);
            END IF;
            idx_created := idx_created + 1;
        END IF;

        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'uploaded_files' AND column_name = 'created_at') THEN
            CREATE INDEX IF NOT EXISTS idx_uploaded_files_created ON uploaded_files(created_at DESC);
            idx_created := idx_created + 1;
        END IF;

        RAISE NOTICE '✅ uploaded_files 인덱스 완료';
    ELSE
        RAISE NOTICE '⏭️ uploaded_files 테이블 없음';
        idx_skipped := idx_skipped + 1;
    END IF;

    -- ============================================
    -- 7. facility_photos 테이블
    -- ============================================
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'facility_photos') THEN

        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'facility_photos' AND column_name = 'business_id') THEN
            CREATE INDEX IF NOT EXISTS idx_facility_photos_business ON facility_photos(business_id);
            idx_created := idx_created + 1;
        END IF;

        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'facility_photos' AND column_name = 'created_at') THEN
            CREATE INDEX IF NOT EXISTS idx_facility_photos_created ON facility_photos(created_at DESC);
            idx_created := idx_created + 1;
        END IF;

        RAISE NOTICE '✅ facility_photos 인덱스 완료';
    ELSE
        RAISE NOTICE '⏭️ facility_photos 테이블 없음';
        idx_skipped := idx_skipped + 1;
    END IF;

    -- ============================================
    -- 8. air_permit_info 테이블
    -- ============================================
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'air_permit_info') THEN

        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'air_permit_info' AND column_name = 'business_id') THEN
            CREATE INDEX IF NOT EXISTS idx_air_permit_business ON air_permit_info(business_id);
            idx_created := idx_created + 1;
        END IF;

        RAISE NOTICE '✅ air_permit_info 인덱스 완료';
    ELSE
        RAISE NOTICE '⏭️ air_permit_info 테이블 없음';
        idx_skipped := idx_skipped + 1;
    END IF;

    -- ============================================
    -- 9. business_memos 테이블
    -- ============================================
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'business_memos') THEN

        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'business_memos' AND column_name = 'business_id') THEN
            CREATE INDEX IF NOT EXISTS idx_business_memos_business ON business_memos(business_id);
            idx_created := idx_created + 1;
        END IF;

        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'business_memos' AND column_name = 'created_at') THEN
            CREATE INDEX IF NOT EXISTS idx_business_memos_created ON business_memos(created_at DESC);
            idx_created := idx_created + 1;
        END IF;

        RAISE NOTICE '✅ business_memos 인덱스 완료';
    ELSE
        RAISE NOTICE '⏭️ business_memos 테이블 없음';
        idx_skipped := idx_skipped + 1;
    END IF;

    -- ============================================
    -- 완료 리포트
    -- ============================================
    RAISE NOTICE '';
    RAISE NOTICE '╔══════════════════════════════════════════╗';
    RAISE NOTICE '║       🚀 인덱스 생성 완료 리포트         ║';
    RAISE NOTICE '╠══════════════════════════════════════════╣';
    RAISE NOTICE '║  ✅ 생성된 인덱스: % 개', LPAD(idx_created::TEXT, 2);
    RAISE NOTICE '║  ⏭️  스킵된 테이블: % 개', LPAD(idx_skipped::TEXT, 2);
    RAISE NOTICE '╚══════════════════════════════════════════╝';

END $$;

-- ============================================
-- 검증: 생성된 인덱스 확인
-- ============================================

SELECT
    tablename as "테이블",
    indexname as "인덱스명"
FROM pg_indexes
WHERE schemaname = 'public'
AND indexname LIKE 'idx_%'
ORDER BY tablename, indexname;
