-- 실시간 알림 시스템 테스트 스크립트
-- 개발 서버가 실행 중일 때 이 쿼리들을 실행해서 알림이 실시간으로 나타나는지 확인

-- ============================================================================
-- 1. 테스트용 전역 알림 생성
-- ============================================================================

-- 시스템 테스트 알림
INSERT INTO notifications (
  title,
  message,
  category,
  priority,
  related_resource_type,
  related_url,
  is_system_notification,
  created_by_name,
  metadata
) VALUES (
  '🧪 실시간 알림 테스트',
  '이 알림이 브라우저에서 즉시 나타나면 Supabase Realtime이 정상 작동하는 것입니다!',
  'system_update',
  'medium',
  'test',
  '/admin',
  true,
  'System Test',
  jsonb_build_object(
    'test_type', 'realtime_check',
    'timestamp', NOW(),
    'message', 'Browser notification should appear immediately'
  )
);

-- ============================================================================
-- 2. 테스트용 업무 알림 생성 (사용자 ID 필요)
-- ============================================================================

-- 현재 시스템에 있는 사용자 ID 조회 (테스트용)
SELECT
  'Available user IDs for testing:' as info,
  array_agg(DISTINCT user_id) as user_ids
FROM task_notifications
WHERE user_id IS NOT NULL
LIMIT 1;

-- 기본 테스트 사용자로 업무 알림 생성 (user_id를 실제 값으로 변경)
INSERT INTO task_notifications (
  user_id,
  task_id,
  business_name,
  message,
  notification_type,
  priority,
  metadata
) VALUES (
  'test-user', -- 👈 실제 사용자 ID로 변경하세요
  'test-task-001',
  '테스트 사업장',
  '🧪 실시간 업무 알림 테스트 - 이 메시지가 즉시 나타나야 합니다!',
  'assignment',
  'high',
  jsonb_build_object(
    'test_type', 'task_notification_test',
    'timestamp', NOW(),
    'auto_generated', true
  )
);

-- ============================================================================
-- 3. 연결 상태 확인
-- ============================================================================

-- 최근 생성된 알림 확인
SELECT
  '📊 최근 알림 현황' as status,
  COUNT(*) as total_count,
  COUNT(CASE WHEN created_at > NOW() - INTERVAL '1 minute' THEN 1 END) as recent_count
FROM notifications;

-- Realtime Publication 상태 확인
SELECT
  '📡 Realtime 활성화 테이블' as info,
  array_agg(tablename) as realtime_tables
FROM pg_publication_tables
WHERE pubname = 'supabase_realtime'
  AND tablename IN ('notifications', 'task_notifications', 'facility_tasks');

-- ============================================================================
-- 4. 테스트 결과 확인 가이드
-- ============================================================================

SELECT
  '✅ 테스트 성공 기준' as test_criteria,
  '브라우저 알림 버튼에 새 알림이 즉시 나타나야 함' as success_condition,
  '연결 상태 표시기가 "Realtime 연결" 또는 "폴링 모드"를 표시해야 함' as connection_check,
  'F12 개발자 도구 Console에서 Realtime 로그 확인 가능' as debug_info;

-- ============================================================================
-- 5. 추가 테스트 (선택사항)
-- ============================================================================

-- 다양한 우선순위 테스트
INSERT INTO notifications (title, message, category, priority, created_by_name) VALUES
  ('낮은 우선순위 테스트', '이것은 낮은 우선순위 알림입니다.', 'system_update', 'low', 'Test'),
  ('높은 우선순위 테스트', '이것은 높은 우선순위 알림입니다!', 'security_alert', 'high', 'Test'),
  ('긴급 알림 테스트', '⚠️ 이것은 긴급 알림입니다!', 'security_alert', 'critical', 'Test');

-- 테스트 완료 메시지
DO $$
BEGIN
    RAISE NOTICE '🧪 실시간 알림 테스트 완료!';
    RAISE NOTICE '👀 브라우저로 이동해서 http://localhost:3000 에서 알림을 확인하세요.';
    RAISE NOTICE '🔔 알림 버튼을 클릭해서 새 알림이 나타나는지 확인하세요.';
    RAISE NOTICE '🛠️ F12 개발자 도구 Console에서 실시간 연결 로그를 확인할 수 있습니다.';
END $$;