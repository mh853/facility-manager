-- 알림 시스템 데이터베이스 스키마
-- 30일 보관, 카테고리별 분류, 사용자별 설정 지원

-- 알림 카테고리 타입 정의
CREATE TYPE notification_category AS ENUM (
  'task_created',
  'task_updated',
  'task_assigned',
  'task_status_changed',
  'task_completed',
  'system_maintenance',
  'system_update',
  'security_alert',
  'login_attempt',
  'report_submitted',
  'report_approved',
  'user_created',
  'user_updated',
  'business_added',
  'file_uploaded',
  'backup_completed',
  'maintenance_scheduled'
);

-- 알림 우선순위 타입 정의
CREATE TYPE notification_priority AS ENUM ('low', 'medium', 'high', 'critical');

-- 알림 테이블
CREATE TABLE notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title VARCHAR(255) NOT NULL,
  message TEXT NOT NULL,
  category notification_category NOT NULL,
  priority notification_priority DEFAULT 'medium',

  -- 연결된 리소스 정보 (선택적)
  related_resource_type VARCHAR(50), -- 'task', 'user', 'business', 'file' 등
  related_resource_id VARCHAR(255),  -- 해당 리소스의 ID
  related_url VARCHAR(500),          -- 클릭시 이동할 URL

  -- 메타데이터
  metadata JSONB DEFAULT '{}',       -- 추가 정보 저장용

  -- 발신자 정보
  created_by_id VARCHAR(255),        -- 알림을 생성한 사용자/시스템 ID
  created_by_name VARCHAR(100),      -- 발신자 이름

  -- 시간 정보
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  expires_at TIMESTAMP WITH TIME ZONE DEFAULT (NOW() + INTERVAL '30 days'),

  -- 인덱스를 위한 컬럼
  is_system_notification BOOLEAN DEFAULT false -- 시스템 알림 여부
);

-- 사용자별 알림 읽음 상태 테이블
CREATE TABLE user_notification_reads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  notification_id UUID NOT NULL REFERENCES notifications(id) ON DELETE CASCADE,
  user_id VARCHAR(255) NOT NULL,
  user_name VARCHAR(100) NOT NULL,
  read_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  -- 중복 방지를 위한 유니크 제약
  UNIQUE(notification_id, user_id)
);

-- 사용자별 알림 설정 테이블
CREATE TABLE user_notification_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id VARCHAR(255) NOT NULL UNIQUE,
  user_name VARCHAR(100) NOT NULL,

  -- 카테고리별 활성화 설정 (기본값: 모든 카테고리 활성화)
  task_notifications BOOLEAN DEFAULT true,
  system_notifications BOOLEAN DEFAULT true,
  security_notifications BOOLEAN DEFAULT true,
  report_notifications BOOLEAN DEFAULT true,
  user_notifications BOOLEAN DEFAULT true,
  business_notifications BOOLEAN DEFAULT true,
  file_notifications BOOLEAN DEFAULT true,
  maintenance_notifications BOOLEAN DEFAULT true,

  -- 일반 설정
  push_notifications_enabled BOOLEAN DEFAULT true,
  email_notifications_enabled BOOLEAN DEFAULT false,
  sound_notifications_enabled BOOLEAN DEFAULT true,

  -- 우선순위별 설정
  show_low_priority BOOLEAN DEFAULT true,
  show_medium_priority BOOLEAN DEFAULT true,
  show_high_priority BOOLEAN DEFAULT true,
  show_critical_priority BOOLEAN DEFAULT true,

  -- 시간 설정
  quiet_hours_start TIME DEFAULT '22:00:00',
  quiet_hours_end TIME DEFAULT '08:00:00',
  quiet_hours_enabled BOOLEAN DEFAULT false,

  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 알림 발송 로그 테이블 (WebSocket, Push 등)
CREATE TABLE notification_delivery_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  notification_id UUID NOT NULL REFERENCES notifications(id) ON DELETE CASCADE,
  user_id VARCHAR(255) NOT NULL,
  delivery_method VARCHAR(20) NOT NULL, -- 'websocket', 'push', 'email'
  status VARCHAR(20) NOT NULL,          -- 'sent', 'failed', 'pending'
  delivered_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  error_message TEXT,

  -- 인덱스용
  INDEX idx_delivery_logs_notification_user (notification_id, user_id),
  INDEX idx_delivery_logs_status (status, delivered_at)
);

-- 성능을 위한 인덱스 생성
CREATE INDEX idx_notifications_category ON notifications(category);
CREATE INDEX idx_notifications_priority ON notifications(priority);
CREATE INDEX idx_notifications_created_at ON notifications(created_at);
CREATE INDEX idx_notifications_expires_at ON notifications(expires_at);
CREATE INDEX idx_notifications_resource ON notifications(related_resource_type, related_resource_id);
CREATE INDEX idx_notifications_system ON notifications(is_system_notification);

CREATE INDEX idx_user_reads_user ON user_notification_reads(user_id);
CREATE INDEX idx_user_reads_notification ON user_notification_reads(notification_id);
CREATE INDEX idx_user_reads_read_at ON user_notification_reads(read_at);

CREATE INDEX idx_user_settings_user ON user_notification_settings(user_id);

-- 만료된 알림 자동 정리를 위한 함수
CREATE OR REPLACE FUNCTION cleanup_expired_notifications()
RETURNS INTEGER AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  -- 30일 경과한 알림 삭제
  DELETE FROM notifications
  WHERE expires_at < NOW();

  GET DIAGNOSTICS deleted_count = ROW_COUNT;

  -- 정리 로그 (옵션)
  INSERT INTO notifications (
    title,
    message,
    category,
    priority,
    is_system_notification,
    created_by_name
  ) VALUES (
    '알림 정리 완료',
    format('만료된 알림 %s개가 자동으로 삭제되었습니다.', deleted_count),
    'system_maintenance',
    'low',
    true,
    'System'
  );

  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- 매일 자정에 만료된 알림 정리 (cron job 설정 필요)
-- SELECT cron.schedule('cleanup-notifications', '0 0 * * *', 'SELECT cleanup_expired_notifications();');

-- 알림 통계를 위한 뷰
CREATE VIEW notification_stats AS
SELECT
  category,
  priority,
  COUNT(*) as total_count,
  COUNT(CASE WHEN created_at >= NOW() - INTERVAL '24 hours' THEN 1 END) as last_24h_count,
  COUNT(CASE WHEN created_at >= NOW() - INTERVAL '7 days' THEN 1 END) as last_7d_count,
  AVG(
    CASE
      WHEN related_resource_type IS NOT NULL THEN 1
      ELSE 0
    END
  ) as avg_has_related_resource
FROM notifications
WHERE expires_at > NOW()
GROUP BY category, priority;

-- 사용자별 읽지 않은 알림 통계 뷰
CREATE VIEW user_unread_notifications AS
SELECT
  n.id,
  n.title,
  n.message,
  n.category,
  n.priority,
  n.related_url,
  n.created_at,
  n.created_by_name,
  -- 읽지 않은 알림만 표시하기 위한 조건
  CASE
    WHEN unr.user_id IS NULL THEN true
    ELSE false
  END as is_unread
FROM notifications n
LEFT JOIN user_notification_reads unr ON n.id = unr.notification_id
WHERE n.expires_at > NOW()
  AND (unr.user_id IS NULL OR unr.user_id != n.created_by_id); -- 자신이 생성한 알림은 제외

-- 초기 시스템 설정 데이터 삽입
INSERT INTO notifications (
  title,
  message,
  category,
  priority,
  is_system_notification,
  created_by_name
) VALUES (
  '알림 시스템 초기화 완료',
  '전역 알림 시스템이 성공적으로 초기화되었습니다. 30일 보관, 실시간 WebSocket, PWA 푸시 알림을 지원합니다.',
  'system_update',
  'medium',
  true,
  'System'
);