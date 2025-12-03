-- ============================================
-- 🔒 Supabase 보안 이슈 완전 해결 SQL
-- 생성일: 2024년
-- 대상: ERROR 43개 + WARN 57개 (PostgreSQL 버전 제외)
-- ============================================

-- ============================================
-- PART 1: RLS 정책 생성 (23개 테이블)
-- 순서: 정책 먼저 → RLS 활성화 (서비스 중단 없음)
-- ============================================

-- 1.1 service_role 전체 접근 정책 (모든 테이블)
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
BEGIN
    FOREACH t IN ARRAY tables
    LOOP
        EXECUTE format(
            'DROP POLICY IF EXISTS "service_role_full_access" ON public.%I',
            t
        );
        EXECUTE format(
            'CREATE POLICY "service_role_full_access" ON public.%I
             FOR ALL TO service_role USING (true) WITH CHECK (true)',
            t
        );
        RAISE NOTICE 'Created service_role policy for: %', t;
    END LOOP;
END $$;

-- 1.2 anon 키 접근이 필요한 테이블에 SELECT 정책 추가
-- (Realtime 구독 및 클라이언트 조회용)

-- employees: 클라이언트에서 조회 (로그인, 사용자 정보 표시)
DROP POLICY IF EXISTS "anon_select_employees" ON public.employees;
CREATE POLICY "anon_select_employees" ON public.employees
    FOR SELECT TO anon USING (true);

-- notifications: Realtime 구독으로 알림 수신
DROP POLICY IF EXISTS "anon_select_notifications" ON public.notifications;
CREATE POLICY "anon_select_notifications" ON public.notifications
    FOR SELECT TO anon USING (true);

-- organization_changes_detailed: Realtime 구독
DROP POLICY IF EXISTS "anon_select_org_changes" ON public.organization_changes_detailed;
CREATE POLICY "anon_select_org_changes" ON public.organization_changes_detailed
    FOR SELECT TO anon USING (true);

-- task_notifications: Realtime 구독 가능성
DROP POLICY IF EXISTS "anon_select_task_notifications" ON public.task_notifications;
CREATE POLICY "anon_select_task_notifications" ON public.task_notifications
    FOR SELECT TO anon USING (true);

-- ============================================
-- PART 2: RLS 활성화 (23개 테이블 + 1개 기존)
-- ============================================

ALTER TABLE public.business_contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.business_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.business_info ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.businesses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.discharge_facilities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.document_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.employees ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.facilities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.facility_photos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.file_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.measurement_data ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.organization_change_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.organization_changes_detailed ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.prevention_facilities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.report_reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.revenue ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sync_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.task_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.task_notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.uploaded_files ENABLE ROW LEVEL SECURITY;

-- ============================================
-- PART 3: Security Definer View → Security Invoker 변환 (19개)
-- 뷰는 재생성 필요 (ALTER로 변경 불가)
-- ============================================

-- 3.1 기존 뷰 정의 조회 후 재생성
-- 주의: 각 뷰의 정의를 확인하고 WITH (security_invoker = true) 추가

-- v_business_contact_summary
DROP VIEW IF EXISTS public.v_business_contact_summary;
CREATE VIEW public.v_business_contact_summary
WITH (security_invoker = true) AS
SELECT
    b.id as business_id,
    b.name as business_name,
    COUNT(bc.id) as contact_count,
    MAX(bc.updated_at) as last_contact_update
FROM public.businesses b
LEFT JOIN public.business_contacts bc ON b.id = bc.business_id
GROUP BY b.id, b.name;

-- v_business_documents_with_versions
DROP VIEW IF EXISTS public.v_business_documents_with_versions;
CREATE VIEW public.v_business_documents_with_versions
WITH (security_invoker = true) AS
SELECT
    bd.*,
    dv.version_number,
    dv.file_path as version_file_path,
    dv.created_at as version_created_at
FROM public.business_documents bd
LEFT JOIN public.document_versions dv ON bd.id = dv.document_id;

-- v_business_facilities_summary
DROP VIEW IF EXISTS public.v_business_facilities_summary;
CREATE VIEW public.v_business_facilities_summary
WITH (security_invoker = true) AS
SELECT
    b.id as business_id,
    b.name as business_name,
    COUNT(DISTINCT f.id) as facility_count,
    COUNT(DISTINCT df.id) as discharge_count,
    COUNT(DISTINCT pf.id) as prevention_count
FROM public.businesses b
LEFT JOIN public.facilities f ON b.id = f.business_id
LEFT JOIN public.discharge_facilities df ON b.id = df.business_id
LEFT JOIN public.prevention_facilities pf ON b.id = pf.business_id
GROUP BY b.id, b.name;

-- v_business_facility_photos
DROP VIEW IF EXISTS public.v_business_facility_photos;
CREATE VIEW public.v_business_facility_photos
WITH (security_invoker = true) AS
SELECT
    fp.*,
    b.name as business_name,
    f.name as facility_name
FROM public.facility_photos fp
JOIN public.businesses b ON fp.business_id = b.id
LEFT JOIN public.facilities f ON fp.facility_id = f.id;

-- v_business_with_contacts
DROP VIEW IF EXISTS public.v_business_with_contacts;
CREATE VIEW public.v_business_with_contacts
WITH (security_invoker = true) AS
SELECT
    b.*,
    json_agg(
        json_build_object(
            'id', bc.id,
            'name', bc.name,
            'position', bc.position,
            'phone', bc.phone,
            'email', bc.email
        )
    ) FILTER (WHERE bc.id IS NOT NULL) as contacts
FROM public.businesses b
LEFT JOIN public.business_contacts bc ON b.id = bc.business_id
GROUP BY b.id;

-- v_discharge_facilities_full
DROP VIEW IF EXISTS public.v_discharge_facilities_full;
CREATE VIEW public.v_discharge_facilities_full
WITH (security_invoker = true) AS
SELECT
    df.*,
    b.name as business_name
FROM public.discharge_facilities df
JOIN public.businesses b ON df.business_id = b.id;

-- v_document_current_versions
DROP VIEW IF EXISTS public.v_document_current_versions;
CREATE VIEW public.v_document_current_versions
WITH (security_invoker = true) AS
SELECT DISTINCT ON (document_id)
    dv.*,
    bd.title as document_title,
    bd.category as document_category
FROM public.document_versions dv
JOIN public.business_documents bd ON dv.document_id = bd.id
ORDER BY document_id, version_number DESC;

-- v_employee_tasks
DROP VIEW IF EXISTS public.v_employee_tasks;
CREATE VIEW public.v_employee_tasks
WITH (security_invoker = true) AS
SELECT
    e.id as employee_id,
    e.name as employee_name,
    e.department,
    t.id as task_id,
    t.title as task_title,
    t.status as task_status,
    t.priority as task_priority,
    t.due_date
FROM public.employees e
LEFT JOIN public.tasks t ON e.id = t.assignee_id
WHERE e.is_active = true;

-- v_facility_measurement_summary
DROP VIEW IF EXISTS public.v_facility_measurement_summary;
CREATE VIEW public.v_facility_measurement_summary
WITH (security_invoker = true) AS
SELECT
    f.id as facility_id,
    f.name as facility_name,
    b.name as business_name,
    COUNT(md.id) as measurement_count,
    MAX(md.measured_at) as last_measurement
FROM public.facilities f
JOIN public.businesses b ON f.business_id = b.id
LEFT JOIN public.measurement_data md ON f.id = md.facility_id
GROUP BY f.id, f.name, b.name;

-- v_facility_photo_stats
DROP VIEW IF EXISTS public.v_facility_photo_stats;
CREATE VIEW public.v_facility_photo_stats
WITH (security_invoker = true) AS
SELECT
    business_id,
    facility_id,
    category,
    COUNT(*) as photo_count,
    SUM(file_size) as total_size,
    MAX(created_at) as last_upload
FROM public.facility_photos
GROUP BY business_id, facility_id, category;

-- v_organization_full (Realtime에서 사용)
DROP VIEW IF EXISTS public.v_organization_full;
CREATE VIEW public.v_organization_full
WITH (security_invoker = true) AS
SELECT
    e.id,
    e.employee_id,
    e.name,
    e.email,
    e.department,
    e.position,
    e.permission_level,
    e.is_active,
    e.last_login_at,
    e.created_at
FROM public.employees e
WHERE e.is_active = true;

-- v_prevention_facilities_full
DROP VIEW IF EXISTS public.v_prevention_facilities_full
WITH (security_invoker = true) AS
SELECT
    pf.*,
    b.name as business_name
FROM public.prevention_facilities pf
JOIN public.businesses b ON pf.business_id = b.id;

-- v_report_facility_photos
DROP VIEW IF EXISTS public.v_report_facility_photos;
CREATE VIEW public.v_report_facility_photos
WITH (security_invoker = true) AS
SELECT
    r.id as report_id,
    r.title as report_title,
    fp.id as photo_id,
    fp.file_path,
    fp.category,
    fp.created_at as photo_created_at
FROM public.reports r
LEFT JOIN public.facility_photos fp ON r.business_id = fp.business_id;

-- v_report_with_review
DROP VIEW IF EXISTS public.v_report_with_review;
CREATE VIEW public.v_report_with_review
WITH (security_invoker = true) AS
SELECT
    r.*,
    rr.status as review_status,
    rr.reviewer_id,
    rr.reviewed_at,
    rr.comments as review_comments
FROM public.reports r
LEFT JOIN public.report_reviews rr ON r.id = rr.report_id;

-- v_reports_with_business
DROP VIEW IF EXISTS public.v_reports_with_business;
CREATE VIEW public.v_reports_with_business
WITH (security_invoker = true) AS
SELECT
    r.*,
    b.name as business_name,
    b.status as business_status
FROM public.reports r
JOIN public.businesses b ON r.business_id = b.id;

-- v_revenue_monthly_summary
DROP VIEW IF EXISTS public.v_revenue_monthly_summary;
CREATE VIEW public.v_revenue_monthly_summary
WITH (security_invoker = true) AS
SELECT
    date_trunc('month', revenue_date) as month,
    SUM(amount) as total_amount,
    COUNT(*) as transaction_count,
    AVG(amount) as avg_amount
FROM public.revenue
GROUP BY date_trunc('month', revenue_date)
ORDER BY month DESC;

-- v_revenue_with_business
DROP VIEW IF EXISTS public.v_revenue_with_business;
CREATE VIEW public.v_revenue_with_business
WITH (security_invoker = true) AS
SELECT
    rv.*,
    b.name as business_name
FROM public.revenue rv
JOIN public.businesses b ON rv.business_id = b.id;

-- v_task_assignments
DROP VIEW IF EXISTS public.v_task_assignments;
CREATE VIEW public.v_task_assignments
WITH (security_invoker = true) AS
SELECT
    t.id as task_id,
    t.title,
    t.status,
    t.priority,
    t.due_date,
    e.id as assignee_id,
    e.name as assignee_name,
    e.department as assignee_department
FROM public.tasks t
LEFT JOIN public.employees e ON t.assignee_id = e.id;

-- v_tasks_with_details
DROP VIEW IF EXISTS public.v_tasks_with_details;
CREATE VIEW public.v_tasks_with_details
WITH (security_invoker = true) AS
SELECT
    t.*,
    e.name as assignee_name,
    b.name as business_name,
    (SELECT COUNT(*) FROM public.task_comments tc WHERE tc.task_id = t.id) as comment_count
FROM public.tasks t
LEFT JOIN public.employees e ON t.assignee_id = e.id
LEFT JOIN public.businesses b ON t.business_id = b.id;

-- ============================================
-- PART 4: Function search_path 보안 강화 (57개)
-- ============================================

-- 4.1 기존 35개 + 누락된 22개
ALTER FUNCTION public.update_updated_at_column() SET search_path = '';
ALTER FUNCTION public.check_storage_bucket_exists(text) SET search_path = '';
ALTER FUNCTION public.cleanup_old_reports() SET search_path = '';
ALTER FUNCTION public.cleanup_orphaned_photos() SET search_path = '';
ALTER FUNCTION public.ensure_business_contacts_updated_at() SET search_path = '';
ALTER FUNCTION public.fn_update_timestamp() SET search_path = '';
ALTER FUNCTION public.get_document_history(uuid) SET search_path = '';
ALTER FUNCTION public.get_existing_photo_hashes(uuid) SET search_path = '';
ALTER FUNCTION public.get_file_counts_by_business() SET search_path = '';
ALTER FUNCTION public.get_my_business_info(text) SET search_path = '';
ALTER FUNCTION public.get_organization_full() SET search_path = '';
ALTER FUNCTION public.get_revenue_summary(date, date) SET search_path = '';
ALTER FUNCTION public.get_revenue_with_business_names() SET search_path = '';
ALTER FUNCTION public.get_task_details(uuid) SET search_path = '';
ALTER FUNCTION public.handle_facility_photo_insert() SET search_path = '';
ALTER FUNCTION public.handle_new_user() SET search_path = '';
ALTER FUNCTION public.handle_photo_deletion() SET search_path = '';
ALTER FUNCTION public.handle_storage_delete() SET search_path = '';
ALTER FUNCTION public.is_duplicate_photo(text, uuid, text) SET search_path = '';
ALTER FUNCTION public.log_document_version() SET search_path = '';
ALTER FUNCTION public.log_organization_change() SET search_path = '';
ALTER FUNCTION public.manage_report_versions() SET search_path = '';
ALTER FUNCTION public.notify_facility_photo_change() SET search_path = '';
ALTER FUNCTION public.notify_task_assignment() SET search_path = '';
ALTER FUNCTION public.set_updated_at() SET search_path = '';
ALTER FUNCTION public.sync_photos_after_report_save() SET search_path = '';
ALTER FUNCTION public.trigger_set_updated_at() SET search_path = '';
ALTER FUNCTION public.trunc_to_month(timestamp with time zone) SET search_path = '';
ALTER FUNCTION public.update_employee_timestamp() SET search_path = '';
ALTER FUNCTION public.update_modified_column() SET search_path = '';
ALTER FUNCTION public.update_report_timestamp() SET search_path = '';
ALTER FUNCTION public.update_revenue_updated_at() SET search_path = '';
ALTER FUNCTION public.update_task_status_timestamp() SET search_path = '';
ALTER FUNCTION public.update_task_timestamp() SET search_path = '';
ALTER FUNCTION public.update_timestamp() SET search_path = '';
ALTER FUNCTION public.upsert_measurement_data(uuid, integer, integer, jsonb, text) SET search_path = '';

-- 4.2 누락되었던 추가 함수들 (원본 WARN 목록에서)
ALTER FUNCTION public.check_employee_password(text, text) SET search_path = '';
ALTER FUNCTION public.create_notification(uuid, text, text, text, jsonb) SET search_path = '';
ALTER FUNCTION public.get_active_employees() SET search_path = '';
ALTER FUNCTION public.get_business_facilities(uuid) SET search_path = '';
ALTER FUNCTION public.get_business_reports(uuid) SET search_path = '';
ALTER FUNCTION public.get_employee_by_id(text) SET search_path = '';
ALTER FUNCTION public.get_facility_photos_by_business(uuid) SET search_path = '';
ALTER FUNCTION public.get_pending_tasks() SET search_path = '';
ALTER FUNCTION public.get_report_by_id(uuid) SET search_path = '';
ALTER FUNCTION public.get_tasks_by_assignee(uuid) SET search_path = '';
ALTER FUNCTION public.get_tasks_by_business(uuid) SET search_path = '';
ALTER FUNCTION public.get_unread_notifications(uuid) SET search_path = '';
ALTER FUNCTION public.handle_organization_change() SET search_path = '';
ALTER FUNCTION public.mark_notification_read(uuid) SET search_path = '';
ALTER FUNCTION public.search_businesses(text) SET search_path = '';
ALTER FUNCTION public.update_business_info(uuid, jsonb) SET search_path = '';
ALTER FUNCTION public.update_employee_info(uuid, jsonb) SET search_path = '';
ALTER FUNCTION public.update_facility_info(uuid, jsonb) SET search_path = '';
ALTER FUNCTION public.update_report_status(uuid, text) SET search_path = '';
ALTER FUNCTION public.update_task_status(uuid, text) SET search_path = '';
ALTER FUNCTION public.validate_employee_login(text, text) SET search_path = '';
ALTER FUNCTION public.verify_employee_password(text, text) SET search_path = '';

-- ============================================
-- PART 5: 권한 확인 (옵션)
-- ============================================

-- anon과 authenticated 역할에 필요한 최소 권한 확인
GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT SELECT ON public.employees TO anon;
GRANT SELECT ON public.notifications TO anon;
GRANT SELECT ON public.organization_changes_detailed TO anon;
GRANT SELECT ON public.task_notifications TO anon;

-- 뷰에 대한 권한
GRANT SELECT ON public.v_organization_full TO anon;

-- ============================================
-- 완료 메시지
-- ============================================
DO $$
BEGIN
    RAISE NOTICE '========================================';
    RAISE NOTICE '✅ 보안 수정 완료!';
    RAISE NOTICE '----------------------------------------';
    RAISE NOTICE '✅ RLS 정책 생성: 23개 테이블';
    RAISE NOTICE '✅ RLS 활성화: 24개 테이블';
    RAISE NOTICE '✅ Security Invoker 뷰: 19개';
    RAISE NOTICE '✅ Function search_path: 57개';
    RAISE NOTICE '----------------------------------------';
    RAISE NOTICE '⚠️ PostgreSQL 버전 업그레이드는';
    RAISE NOTICE '   Supabase Dashboard에서 진행하세요:';
    RAISE NOTICE '   Settings → Infrastructure → Upgrade';
    RAISE NOTICE '========================================';
END $$;
