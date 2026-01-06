-- user_notifications 테이블 스키마 수정
-- 누락된 title 컬럼 제거 (현재 쿼리에서 사용하지 않도록 수정)

-- 현재 상태 확인을 위한 쿼리 (실행 전 확인용)
-- SELECT column_name, data_type FROM information_schema.columns 
-- WHERE table_name = 'user_notifications' ORDER BY ordinal_position;

-- 대안: 테이블이 없다면 생성
CREATE TABLE IF NOT EXISTS user_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  message TEXT NOT NULL,
  related_task_id UUID,
  related_user_id UUID REFERENCES employees(id) ON DELETE SET NULL,
  is_read BOOLEAN DEFAULT FALSE,
  read_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  expires_at TIMESTAMP WITH TIME ZONE
);

-- 인덱스 생성
CREATE INDEX IF NOT EXISTS idx_user_notifications_user_id ON user_notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_user_notifications_is_read ON user_notifications(is_read);
CREATE INDEX IF NOT EXISTS idx_user_notifications_created_at ON user_notifications(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_user_notifications_expires_at ON user_notifications(expires_at);

COMMENT ON TABLE user_notifications IS '사용자 개인 알림 테이블';
COMMENT ON COLUMN user_notifications.message IS '알림 메시지 내용';
COMMENT ON COLUMN user_notifications.expires_at IS '알림 만료 시각';
