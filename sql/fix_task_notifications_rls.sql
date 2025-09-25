-- task_notifications RLS 정책 수정
-- JWT 기반 인증 시스템과 호환되도록 Service Role 접근 허용

-- 기존 정책 삭제
DROP POLICY IF EXISTS "task_notifications_select_own" ON task_notifications;
DROP POLICY IF EXISTS "task_notifications_update_own" ON task_notifications;
DROP POLICY IF EXISTS "task_notifications_insert_admin" ON task_notifications;
DROP POLICY IF EXISTS "task_notifications_delete_own" ON task_notifications;

-- Service Role을 위한 정책 생성 (API에서 권한 검증 후 접근)
-- Service Role은 모든 작업이 허용되지만, API 레벨에서 사용자 권한 검증

-- 1. Service Role은 모든 데이터 조회 가능 (API에서 user_id로 필터링)
CREATE POLICY "task_notifications_service_role_select"
ON task_notifications FOR SELECT
TO service_role
USING (true);

-- 2. Service Role은 모든 데이터 업데이트 가능 (API에서 권한 검증)
CREATE POLICY "task_notifications_service_role_update"
ON task_notifications FOR UPDATE
TO service_role
USING (true)
WITH CHECK (true);

-- 3. Service Role은 알림 생성 가능 (API에서 관리자 권한 검증)
CREATE POLICY "task_notifications_service_role_insert"
ON task_notifications FOR INSERT
TO service_role
WITH CHECK (true);

-- 4. Service Role은 알림 삭제 가능 (API에서 권한 검증)
CREATE POLICY "task_notifications_service_role_delete"
ON task_notifications FOR DELETE
TO service_role
USING (true);

-- 일반 사용자는 여전히 제한된 접근만 허용 (Supabase Auth 사용 시)
-- 하지만 현재 시스템은 JWT이므로 실질적으로 Service Role만 사용

-- Service Role 정보 확인
SELECT
    'Service Role RLS policies updated successfully' as status,
    schemaname,
    tablename,
    policyname,
    roles
FROM pg_policies
WHERE tablename = 'task_notifications';

-- 테이블 권한 확인
SELECT
    'task_notifications table permissions:' as info,
    grantee,
    privilege_type
FROM information_schema.role_table_grants
WHERE table_name = 'task_notifications'
AND grantee IN ('postgres', 'service_role', 'authenticated', 'anon');

COMMIT;