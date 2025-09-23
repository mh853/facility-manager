-- 테스트 알림 즉시 제거
-- 프로덕션에서 실행하여 테스트 데이터 정리

-- ============================================================================
-- 1. 테스트 알림 삭제
-- ============================================================================

-- 테스트 전역 알림 삭제
DELETE FROM notifications
WHERE
  title LIKE '%테스트%'
  OR title LIKE '%🧪%'
  OR title LIKE '%test%'
  OR message LIKE '%테스트%'
  OR message LIKE '%test%'
  OR created_by_name IN ('System Test', '테스트 관리자', 'Test')
  OR message LIKE '%Supabase Realtime이 정상 작동%'
  OR message LIKE '%notification should appear immediately%'
  OR title LIKE '%실시간 알림 테스트%';

-- 테스트 업무 알림 삭제
DELETE FROM task_notifications
WHERE
  message LIKE '%테스트%'
  OR message LIKE '%🧪%'
  OR message LIKE '%test%'
  OR user_id = 'test-user'
  OR task_id LIKE 'test-%'
  OR message LIKE '%실시간 업무 알림 테스트%'
  OR message LIKE '%즉시 나타나야 합니다%';

-- ============================================================================
-- 2. 정리 결과 확인
-- ============================================================================

-- 남은 알림 수 확인
SELECT
  'notifications 정리 후' as table_name,
  COUNT(*) as remaining_count,
  COUNT(CASE WHEN created_at > NOW() - INTERVAL '1 hour' THEN 1 END) as recent_count
FROM notifications

UNION ALL

SELECT
  'task_notifications 정리 후' as table_name,
  COUNT(*) as remaining_count,
  COUNT(CASE WHEN created_at > NOW() - INTERVAL '1 hour' THEN 1 END) as recent_count
FROM task_notifications;

-- 최근 알림 샘플 조회
SELECT
  '최근 전역 알림' as type,
  title,
  LEFT(message, 50) as message_preview,
  created_by_name,
  created_at
FROM notifications
WHERE created_at > NOW() - INTERVAL '1 day'
ORDER BY created_at DESC
LIMIT 3;

SELECT
  '최근 업무 알림' as type,
  LEFT(message, 50) as message_preview,
  notification_type,
  user_id,
  created_at
FROM task_notifications
WHERE created_at > NOW() - INTERVAL '1 day'
ORDER BY created_at DESC
LIMIT 3;

-- 완료 메시지
DO $$
BEGIN
    RAISE NOTICE '🧹 테스트 알림 데이터 정리 완료!';
    RAISE NOTICE '✅ 이제 실제 업무 데이터만 알림으로 표시됩니다';
    RAISE NOTICE '🔔 새로운 업무 생성/수정 시 자동 알림 생성됩니다';
END $$;