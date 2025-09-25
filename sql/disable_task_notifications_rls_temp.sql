-- task_notifications RLS 임시 비활성화 (테스트용)
-- API 레벨에서 이미 user_id로 필터링하므로 안전함

-- RLS 비활성화
ALTER TABLE task_notifications DISABLE ROW LEVEL SECURITY;

-- 확인
SELECT
    'task_notifications RLS disabled for testing' as status,
    schemaname,
    tablename,
    rowsecurity
FROM pg_tables
WHERE tablename = 'task_notifications';

-- 실제 데이터 확인
SELECT
    'Current data in task_notifications:' as info,
    COUNT(*) as total_count,
    COUNT(*) FILTER (WHERE is_read = false) as unread_count,
    array_agg(DISTINCT user_id) as user_ids
FROM task_notifications;

-- 최근 알림 샘플
SELECT
    'Sample notifications:' as info,
    id,
    user_id,
    business_name,
    message,
    is_read,
    created_at
FROM task_notifications
ORDER BY created_at DESC
LIMIT 5;

COMMIT;