-- task_notifications 테이블 생성 스크립트
-- 시설 관리 시스템 업무 알림 기능

-- task_notifications 테이블 생성
CREATE TABLE IF NOT EXISTS task_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  user_name TEXT,
  task_id UUID NOT NULL REFERENCES facility_tasks(id) ON DELETE CASCADE,
  business_name TEXT NOT NULL,
  message TEXT NOT NULL,
  notification_type TEXT NOT NULL CHECK (notification_type IN ('delay', 'risk', 'status_change', 'assignment', 'completion')),
  priority TEXT NOT NULL DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'high', 'urgent')),
  is_read BOOLEAN NOT NULL DEFAULT FALSE,
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '30 days'),

  -- 인덱스를 위한 제약 조건
  CONSTRAINT task_notifications_user_id_not_null CHECK (user_id IS NOT NULL),
  CONSTRAINT task_notifications_task_id_not_null CHECK (task_id IS NOT NULL),
  CONSTRAINT task_notifications_read_at_check CHECK (
    (is_read = TRUE AND read_at IS NOT NULL) OR
    (is_read = FALSE AND read_at IS NULL)
  )
);

-- 인덱스 생성 (성능 최적화)
CREATE INDEX IF NOT EXISTS idx_task_notifications_user_id ON task_notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_task_notifications_task_id ON task_notifications(task_id);
CREATE INDEX IF NOT EXISTS idx_task_notifications_created_at ON task_notifications(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_task_notifications_is_read ON task_notifications(is_read) WHERE is_read = FALSE;
CREATE INDEX IF NOT EXISTS idx_task_notifications_expires_at ON task_notifications(expires_at) WHERE expires_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_task_notifications_user_unread ON task_notifications(user_id, is_read) WHERE is_read = FALSE;

-- 복합 인덱스 (쿼리 최적화)
CREATE INDEX IF NOT EXISTS idx_task_notifications_user_created ON task_notifications(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_task_notifications_priority_created ON task_notifications(priority, created_at DESC);

-- RLS (Row Level Security) 정책 설정
ALTER TABLE task_notifications ENABLE ROW LEVEL SECURITY;

-- 사용자는 자신의 알림만 조회 가능
CREATE POLICY IF NOT EXISTS "task_notifications_select_own"
ON task_notifications FOR SELECT
USING (user_id = auth.uid());

-- 사용자는 자신의 알림만 업데이트 가능 (읽음 처리)
CREATE POLICY IF NOT EXISTS "task_notifications_update_own"
ON task_notifications FOR UPDATE
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

-- 시스템 관리자만 알림 생성 가능
CREATE POLICY IF NOT EXISTS "task_notifications_insert_admin"
ON task_notifications FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM employees
    WHERE id = auth.uid()
    AND permission_level >= 3
    AND is_active = TRUE
  )
);

-- 사용자는 자신의 알림만 삭제 가능
CREATE POLICY IF NOT EXISTS "task_notifications_delete_own"
ON task_notifications FOR DELETE
USING (user_id = auth.uid());

-- 테이블 코멘트 추가
COMMENT ON TABLE task_notifications IS '시설 관리 업무 관련 사용자 알림';
COMMENT ON COLUMN task_notifications.id IS '알림 고유 ID';
COMMENT ON COLUMN task_notifications.user_id IS '알림 수신 사용자 ID';
COMMENT ON COLUMN task_notifications.user_name IS '알림 수신 사용자 이름 (캐시)';
COMMENT ON COLUMN task_notifications.task_id IS '관련 업무 ID';
COMMENT ON COLUMN task_notifications.business_name IS '관련 업체명';
COMMENT ON COLUMN task_notifications.message IS '알림 메시지';
COMMENT ON COLUMN task_notifications.notification_type IS '알림 유형 (delay, risk, status_change, assignment, completion)';
COMMENT ON COLUMN task_notifications.priority IS '알림 우선순위 (low, normal, high, urgent)';
COMMENT ON COLUMN task_notifications.is_read IS '읽음 상태';
COMMENT ON COLUMN task_notifications.read_at IS '읽음 처리 시간';
COMMENT ON COLUMN task_notifications.created_at IS '알림 생성 시간';
COMMENT ON COLUMN task_notifications.expires_at IS '알림 만료 시간';

-- 실시간 알림을 위한 트리거 함수
CREATE OR REPLACE FUNCTION notify_task_notification_change()
RETURNS TRIGGER AS $$
BEGIN
  -- INSERT 이벤트인 경우 새로운 알림 브로드캐스트
  IF TG_OP = 'INSERT' THEN
    PERFORM pg_notify('task_notification_insert',
      json_build_object(
        'id', NEW.id,
        'user_id', NEW.user_id,
        'task_id', NEW.task_id,
        'business_name', NEW.business_name,
        'message', NEW.message,
        'notification_type', NEW.notification_type,
        'priority', NEW.priority,
        'created_at', NEW.created_at
      )::text
    );
    RETURN NEW;
  END IF;

  -- UPDATE 이벤트인 경우 읽음 상태 변경 브로드캐스트
  IF TG_OP = 'UPDATE' THEN
    -- 읽음 상태가 변경된 경우만
    IF OLD.is_read != NEW.is_read THEN
      PERFORM pg_notify('task_notification_update',
        json_build_object(
          'id', NEW.id,
          'user_id', NEW.user_id,
          'is_read', NEW.is_read,
          'read_at', NEW.read_at
        )::text
      );
    END IF;
    RETURN NEW;
  END IF;

  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- 트리거 생성
DROP TRIGGER IF EXISTS task_notification_change_trigger ON task_notifications;
CREATE TRIGGER task_notification_change_trigger
  AFTER INSERT OR UPDATE ON task_notifications
  FOR EACH ROW
  EXECUTE FUNCTION notify_task_notification_change();

-- 만료된 알림 자동 정리 함수
CREATE OR REPLACE FUNCTION cleanup_expired_task_notifications()
RETURNS INTEGER AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  -- 30일이 지난 읽은 알림과 만료된 알림 삭제
  DELETE FROM task_notifications
  WHERE (
    (is_read = TRUE AND read_at < NOW() - INTERVAL '30 days')
    OR
    (expires_at IS NOT NULL AND expires_at < NOW())
  );

  GET DIAGNOSTICS deleted_count = ROW_COUNT;

  -- 정리 로그 기록
  INSERT INTO system_logs (
    log_type,
    message,
    details,
    created_at
  ) VALUES (
    'cleanup',
    'Expired task notifications cleanup completed',
    json_build_object(
      'deleted_count', deleted_count,
      'cleanup_time', NOW()
    ),
    NOW()
  );

  RETURN deleted_count;
EXCEPTION
  WHEN OTHERS THEN
    -- system_logs 테이블이 없는 경우 에러 무시
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- 테스트 데이터 삽입 (개발 환경에서만)
-- DO $$
-- BEGIN
--   -- employees 테이블에 테스트 사용자가 있는지 확인 후 테스트 알림 생성
--   IF EXISTS (SELECT 1 FROM employees LIMIT 1) THEN
--     INSERT INTO task_notifications (
--       user_id,
--       user_name,
--       task_id,
--       business_name,
--       message,
--       notification_type,
--       priority
--     )
--     SELECT
--       e.id,
--       e.name,
--       COALESCE(ft.id, gen_random_uuid()),  -- facility_tasks가 없으면 더미 UUID
--       '테스트 업체',
--       '테스트 알림: 시설 점검 작업이 할당되었습니다.',
--       'assignment',
--       'normal'
--     FROM employees e
--     LEFT JOIN facility_tasks ft ON TRUE
--     WHERE e.is_active = TRUE
--     LIMIT 1;
--   END IF;
-- END $$;

COMMIT;

-- 성공 메시지 출력
SELECT
  'task_notifications 테이블이 성공적으로 생성되었습니다.' as status,
  (SELECT COUNT(*) FROM task_notifications) as record_count;