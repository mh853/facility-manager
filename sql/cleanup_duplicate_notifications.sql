-- 중복 시스템 알림 정리 스크립트
-- "Supabase Realtime 시스템 활성화" 및 기타 중복 시스템 알림 제거

-- ============================================================================
-- 1. 중복 시스템 알림 조회 (확인용)
-- ============================================================================

-- 중복된 시스템 알림 확인
SELECT
  title,
  message,
  COUNT(*) as duplicate_count,
  MIN(created_at) as first_created,
  MAX(created_at) as last_created
FROM notifications
WHERE is_system_notification = true
  AND (
    title LIKE '%Supabase Realtime%'
    OR title LIKE '%시스템 활성화%'
    OR title LIKE '%시스템 준비%'
    OR message LIKE '%WebSocket%'
    OR message LIKE '%실시간 알림%'
  )
GROUP BY title, message
HAVING COUNT(*) > 1
ORDER BY duplicate_count DESC;

-- ============================================================================
-- 2. 중복 알림 제거 (가장 오래된 것만 유지)
-- ============================================================================

-- 중복된 "Supabase Realtime 시스템 활성화" 알림 제거 (가장 오래된 것만 유지)
DELETE FROM notifications
WHERE id IN (
  SELECT id FROM (
    SELECT
      id,
      ROW_NUMBER() OVER (
        PARTITION BY title, message
        ORDER BY created_at ASC
      ) as row_num
    FROM notifications
    WHERE is_system_notification = true
      AND title LIKE '%Supabase Realtime%시스템 활성화%'
  ) ranked
  WHERE row_num > 1
);

-- 중복된 "알림 시스템 준비 완료" 알림 제거
DELETE FROM notifications
WHERE id IN (
  SELECT id FROM (
    SELECT
      id,
      ROW_NUMBER() OVER (
        PARTITION BY title, message
        ORDER BY created_at ASC
      ) as row_num
    FROM notifications
    WHERE is_system_notification = true
      AND (
        title LIKE '%알림 시스템%준비%완료%'
        OR title LIKE '%시스템 준비%'
      )
  ) ranked
  WHERE row_num > 1
);

-- 기타 중복 시스템 알림 제거
DELETE FROM notifications
WHERE id IN (
  SELECT id FROM (
    SELECT
      id,
      ROW_NUMBER() OVER (
        PARTITION BY title, message, is_system_notification
        ORDER BY created_at ASC
      ) as row_num
    FROM notifications
    WHERE is_system_notification = true
      AND (
        message LIKE '%WebSocket%'
        OR message LIKE '%실시간 알림%'
        OR message LIKE '%시스템이 완전히%'
      )
  ) ranked
  WHERE row_num > 1
);

-- ============================================================================
-- 3. 테스트 알림 제거
-- ============================================================================

-- 테스트용 알림들 완전 삭제
DELETE FROM notifications
WHERE title LIKE '%테스트%'
   OR title LIKE '%🧪%'
   OR message LIKE '%테스트%'
   OR created_by_name IN ('System Test', '테스트 관리자');

-- 테스트 업무 알림 삭제
DELETE FROM task_notifications
WHERE message LIKE '%테스트%'
   OR message LIKE '%🧪%'
   OR user_id = 'test-user';

-- ============================================================================
-- 4. 만료된 알림 정리
-- ============================================================================

-- 만료된 알림 아카이브 (히스토리로 이동)
INSERT INTO notification_history (
  original_notification_id, title, message, category, priority,
  related_resource_type, related_resource_id, related_url,
  metadata, created_by_id, created_by_name,
  notification_created_at, notification_type
)
SELECT
  id, title, message, category, priority,
  related_resource_type, related_resource_id, related_url,
  metadata, created_by_id, created_by_name,
  created_at, 'global'
FROM notifications
WHERE expires_at < NOW()
  AND id NOT IN (SELECT original_notification_id FROM notification_history WHERE original_notification_id IS NOT NULL);

-- 만료된 알림 삭제
DELETE FROM notifications
WHERE expires_at < NOW();

-- ============================================================================
-- 5. 시스템 알림 중복 방지를 위한 제약 조건 추가
-- ============================================================================

-- 시스템 알림 중복 방지 인덱스 (같은 제목과 메시지의 시스템 알림은 하나만 허용)
CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_system_notifications
ON notifications (title, message)
WHERE is_system_notification = true;

-- ============================================================================
-- 6. 정리 결과 확인
-- ============================================================================

-- 남은 시스템 알림 확인
SELECT
  id,
  title,
  LEFT(message, 50) as message_preview,
  created_at,
  expires_at,
  is_system_notification
FROM notifications
WHERE is_system_notification = true
ORDER BY created_at DESC;

-- 정리 통계
SELECT
  '정리 완료' as status,
  COUNT(*) as remaining_system_notifications
FROM notifications
WHERE is_system_notification = true;

-- 완료 메시지
DO $$
BEGIN
    RAISE NOTICE '🧹 중복 시스템 알림 정리 완료!';
    RAISE NOTICE '✅ 중복 "Supabase Realtime 시스템 활성화" 알림 제거';
    RAISE NOTICE '✅ 테스트 알림 완전 삭제';
    RAISE NOTICE '✅ 만료된 알림 히스토리로 이동';
    RAISE NOTICE '🔒 시스템 알림 중복 방지 제약 조건 추가';
    RAISE NOTICE '📊 남은 시스템 알림 수를 확인하세요';
END $$;