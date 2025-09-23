-- 알림 히스토리 및 아카이브 시스템
-- 읽은 알림을 영구 보관하고 검색 가능한 시스템 구축

-- ============================================================================
-- 1. 알림 히스토리 테이블 생성
-- ============================================================================

-- 전역 알림 히스토리 테이블
CREATE TABLE IF NOT EXISTS notification_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- 원본 알림 정보
  original_notification_id UUID,
  title VARCHAR(255) NOT NULL,
  message TEXT NOT NULL,
  category VARCHAR(50),
  priority VARCHAR(20) DEFAULT 'medium',

  -- 연결된 리소스 정보
  related_resource_type VARCHAR(50),
  related_resource_id VARCHAR(255),
  related_url VARCHAR(500),
  metadata JSONB DEFAULT '{}',

  -- 수신자 정보 (개인화된 히스토리용)
  user_id VARCHAR(255) REFERENCES employees(id) ON DELETE SET NULL,

  -- 발신자 정보
  created_by_id VARCHAR(255),
  created_by_name VARCHAR(100),

  -- 시간 정보
  notification_created_at TIMESTAMP WITH TIME ZONE NOT NULL,
  read_at TIMESTAMP WITH TIME ZONE,
  archived_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  -- 상태
  notification_type VARCHAR(20) DEFAULT 'global', -- 'global', 'task'
  is_archived BOOLEAN DEFAULT true,

  -- 검색용 인덱스 필드
  search_text TEXT GENERATED ALWAYS AS (
    title || ' ' || message || ' ' || COALESCE(created_by_name, '')
  ) STORED
);

-- 업무 알림 히스토리 테이블
CREATE TABLE IF NOT EXISTS task_notification_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- 원본 알림 정보
  original_notification_id UUID,
  user_id VARCHAR(255) NOT NULL REFERENCES employees(id) ON DELETE CASCADE,

  -- 업무 정보
  task_id VARCHAR(255) NOT NULL,
  business_name VARCHAR(255) NOT NULL,

  -- 알림 내용
  message TEXT NOT NULL,
  notification_type VARCHAR(50) NOT NULL,
  priority VARCHAR(20) DEFAULT 'normal',
  metadata JSONB DEFAULT '{}',

  -- 시간 정보
  notification_created_at TIMESTAMP WITH TIME ZONE NOT NULL,
  read_at TIMESTAMP WITH TIME ZONE,
  archived_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  -- 검색용 인덱스
  search_text TEXT GENERATED ALWAYS AS (
    message || ' ' || business_name || ' ' || notification_type
  ) STORED
);

-- ============================================================================
-- 2. 인덱스 생성 (검색 및 성능 최적화)
-- ============================================================================

-- notification_history 인덱스
CREATE INDEX IF NOT EXISTS idx_notification_history_user_time
ON notification_history(user_id, archived_at DESC);

CREATE INDEX IF NOT EXISTS idx_notification_history_search
ON notification_history USING gin(search_text gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_notification_history_category_priority
ON notification_history(category, priority, archived_at DESC);

CREATE INDEX IF NOT EXISTS idx_notification_history_resource
ON notification_history(related_resource_type, related_resource_id);

-- task_notification_history 인덱스
CREATE INDEX IF NOT EXISTS idx_task_notification_history_user_time
ON task_notification_history(user_id, archived_at DESC);

CREATE INDEX IF NOT EXISTS idx_task_notification_history_search
ON task_notification_history USING gin(search_text gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_task_notification_history_task
ON task_notification_history(task_id, user_id);

CREATE INDEX IF NOT EXISTS idx_task_notification_history_type
ON task_notification_history(notification_type, archived_at DESC);

-- ============================================================================
-- 3. 알림 아카이브 함수
-- ============================================================================

-- 전역 알림 아카이브 함수
CREATE OR REPLACE FUNCTION archive_notification(
  notification_id UUID,
  target_user_id VARCHAR(255) DEFAULT NULL
)
RETURNS BOOLEAN AS $$
DECLARE
  notif_record RECORD;
  archived_count INTEGER := 0;
BEGIN
  -- 원본 알림 조회
  SELECT * INTO notif_record
  FROM notifications
  WHERE id = notification_id;

  IF NOT FOUND THEN
    RAISE NOTICE '알림을 찾을 수 없습니다: %', notification_id;
    RETURN FALSE;
  END IF;

  -- 히스토리에 저장
  INSERT INTO notification_history (
    original_notification_id, title, message, category, priority,
    related_resource_type, related_resource_id, related_url,
    metadata, user_id, created_by_id, created_by_name,
    notification_created_at, read_at, notification_type
  ) VALUES (
    notif_record.id, notif_record.title, notif_record.message,
    notif_record.category, notif_record.priority,
    notif_record.related_resource_type, notif_record.related_resource_id,
    notif_record.related_url, notif_record.metadata,
    target_user_id, notif_record.created_by_id, notif_record.created_by_name,
    notif_record.created_at, NOW(), 'global'
  );

  -- 원본 알림 삭제 (선택사항 - 시스템 알림은 보통 유지)
  -- DELETE FROM notifications WHERE id = notification_id;

  RETURN TRUE;
END;
$$ LANGUAGE plpgsql;

-- 업무 알림 아카이브 함수
CREATE OR REPLACE FUNCTION archive_task_notification(
  notification_id UUID
)
RETURNS BOOLEAN AS $$
DECLARE
  notif_record RECORD;
BEGIN
  -- 원본 업무 알림 조회
  SELECT * INTO notif_record
  FROM task_notifications
  WHERE id = notification_id;

  IF NOT FOUND THEN
    RAISE NOTICE '업무 알림을 찾을 수 없습니다: %', notification_id;
    RETURN FALSE;
  END IF;

  -- 히스토리에 저장
  INSERT INTO task_notification_history (
    original_notification_id, user_id, task_id, business_name,
    message, notification_type, priority, metadata,
    notification_created_at, read_at
  ) VALUES (
    notif_record.id, notif_record.user_id, notif_record.task_id,
    notif_record.business_name, notif_record.message,
    notif_record.notification_type, notif_record.priority,
    notif_record.metadata, notif_record.created_at,
    CASE WHEN notif_record.is_read THEN NOW() ELSE NULL END
  );

  -- 원본 알림 삭제
  DELETE FROM task_notifications WHERE id = notification_id;

  RETURN TRUE;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- 4. 대량 아카이브 함수
-- ============================================================================

-- 사용자의 읽은 업무 알림 일괄 아카이브
CREATE OR REPLACE FUNCTION archive_read_notifications(
  target_user_id VARCHAR(255),
  older_than_days INTEGER DEFAULT 7
)
RETURNS TABLE(
  archived_task_notifications INTEGER,
  archived_global_notifications INTEGER
) AS $$
DECLARE
  task_count INTEGER := 0;
  global_count INTEGER := 0;
  notif_record RECORD;
BEGIN
  -- 읽은 업무 알림 아카이브
  FOR notif_record IN
    SELECT * FROM task_notifications
    WHERE user_id = target_user_id
      AND is_read = true
      AND created_at < (NOW() - INTERVAL '1 day' * older_than_days)
  LOOP
    PERFORM archive_task_notification(notif_record.id);
    task_count := task_count + 1;
  END LOOP;

  RETURN QUERY SELECT task_count, global_count;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- 5. 히스토리 검색 뷰
-- ============================================================================

-- 사용자별 통합 알림 히스토리 뷰
CREATE OR REPLACE VIEW user_notification_history AS
SELECT
  'global' as source_type,
  nh.id,
  nh.original_notification_id,
  nh.title,
  nh.message,
  nh.category as type_category,
  nh.priority,
  nh.related_url,
  nh.user_id,
  nh.created_by_name,
  nh.notification_created_at,
  nh.read_at,
  nh.archived_at,
  nh.metadata,
  NULL as task_id,
  NULL as business_name
FROM notification_history nh
WHERE nh.user_id IS NOT NULL

UNION ALL

SELECT
  'task' as source_type,
  tnh.id,
  tnh.original_notification_id,
  CASE
    WHEN tnh.notification_type = 'assignment' THEN '새 업무 배정'
    WHEN tnh.notification_type = 'status_change' THEN '업무 상태 변경'
    WHEN tnh.notification_type = 'deadline_approaching' THEN '마감일 임박'
    WHEN tnh.notification_type = 'overdue' THEN '업무 지연'
    ELSE '업무 알림'
  END as title,
  tnh.message,
  tnh.notification_type as type_category,
  tnh.priority,
  '/admin/tasks?task=' || tnh.task_id as related_url,
  tnh.user_id,
  NULL as created_by_name,
  tnh.notification_created_at,
  tnh.read_at,
  tnh.archived_at,
  tnh.metadata,
  tnh.task_id,
  tnh.business_name
FROM task_notification_history tnh

ORDER BY notification_created_at DESC;

-- ============================================================================
-- 6. 자동 정리 함수 (선택사항)
-- ============================================================================

-- 오래된 히스토리 정리 (6개월 이상)
CREATE OR REPLACE FUNCTION cleanup_old_notification_history()
RETURNS TABLE(
  deleted_notification_history INTEGER,
  deleted_task_history INTEGER
) AS $$
DECLARE
  notif_count INTEGER;
  task_count INTEGER;
BEGIN
  -- 6개월 이상 된 알림 히스토리 삭제
  DELETE FROM notification_history
  WHERE archived_at < NOW() - INTERVAL '6 months';
  GET DIAGNOSTICS notif_count = ROW_COUNT;

  DELETE FROM task_notification_history
  WHERE archived_at < NOW() - INTERVAL '6 months';
  GET DIAGNOSTICS task_count = ROW_COUNT;

  RETURN QUERY SELECT notif_count, task_count;
END;
$$ LANGUAGE plpgsql;

-- 완료 메시지
DO $$
BEGIN
    RAISE NOTICE '📚 알림 히스토리 시스템 구축 완료!';
    RAISE NOTICE '✅ notification_history, task_notification_history 테이블 생성';
    RAISE NOTICE '🔍 user_notification_history 뷰로 통합 조회 가능';
    RAISE NOTICE '📦 archive_notification, archive_task_notification 함수 생성';
    RAISE NOTICE '🧹 자동 정리 및 검색 인덱스 최적화 완료';
END $$;