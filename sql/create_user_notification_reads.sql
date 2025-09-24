-- user_notification_reads 테이블 생성
-- 사용자별 알림 읽음 상태를 추적하는 테이블

CREATE TABLE IF NOT EXISTS user_notification_reads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- 외래키
  notification_id UUID NOT NULL REFERENCES notifications(id) ON DELETE CASCADE,
  user_id VARCHAR(255) NOT NULL,
  user_name VARCHAR(100),

  -- 읽음 시간
  read_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  -- 생성 시간
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 인덱스 생성 (성능 최적화)
CREATE INDEX IF NOT EXISTS idx_user_notification_reads_notification ON user_notification_reads(notification_id);
CREATE INDEX IF NOT EXISTS idx_user_notification_reads_user ON user_notification_reads(user_id);
CREATE INDEX IF NOT EXISTS idx_user_notification_reads_composite ON user_notification_reads(notification_id, user_id);
CREATE INDEX IF NOT EXISTS idx_user_notification_reads_read_at ON user_notification_reads(read_at DESC);

-- 중복 방지를 위한 unique 제약 조건
CREATE UNIQUE INDEX IF NOT EXISTS idx_user_notification_reads_unique ON user_notification_reads(notification_id, user_id);

-- 테이블 생성 확인
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'user_notification_reads') THEN
        RAISE NOTICE '✅ user_notification_reads 테이블 생성 완료';
    ELSE
        RAISE EXCEPTION '❌ user_notification_reads 테이블 생성 실패';
    END IF;
END $$;

-- 완료 메시지
SELECT
  'user_notification_reads 테이블 생성 완료' as status,
  '알림 읽음 처리 API 사용 준비 완료' as next_step;