-- 기본 알림 테이블 생성 스크립트
-- Supabase Realtime 연동을 위한 최소 구조

-- ============================================================================
-- 1. 필요한 타입 생성
-- ============================================================================

-- 알림 카테고리 타입 (realtime_triggers.sql에서 사용)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'notification_category') THEN
        CREATE TYPE notification_category AS ENUM (
          'task_created',
          'task_updated',
          'task_assigned',
          'task_status_changed',
          'task_completed',
          'system_maintenance',
          'system_update',
          'security_alert',
          'user_created',
          'user_updated',
          'business_added',
          'file_uploaded'
        );
    END IF;
END $$;

-- 알림 우선순위 타입
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'notification_priority') THEN
        CREATE TYPE notification_priority AS ENUM ('low', 'medium', 'high', 'critical');
    END IF;
END $$;

-- ============================================================================
-- 2. 기본 알림 테이블 생성
-- ============================================================================

-- 전역 알림 테이블 (realtime_triggers.sql 호환)
CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- 기본 정보
  title VARCHAR(255) NOT NULL,
  message TEXT NOT NULL,
  category notification_category NOT NULL,
  priority notification_priority DEFAULT 'medium',

  -- 연결된 리소스 정보
  related_resource_type VARCHAR(50), -- 'facility_task', 'user', 'business' 등
  related_resource_id VARCHAR(255),
  related_url VARCHAR(500),

  -- 메타데이터
  metadata JSONB DEFAULT '{}',

  -- 발신자 정보
  created_by_id VARCHAR(255),
  created_by_name VARCHAR(100),

  -- 시간 정보
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  expires_at TIMESTAMP WITH TIME ZONE DEFAULT (NOW() + INTERVAL '30 days'),

  -- 시스템 알림 여부
  is_system_notification BOOLEAN DEFAULT false
);

-- 사용자별 업무 알림 테이블 (시설 업무 전용)
CREATE TABLE IF NOT EXISTS task_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- 수신자 정보
  user_id VARCHAR(255) NOT NULL,

  -- 업무 정보
  task_id VARCHAR(255) NOT NULL,
  business_name VARCHAR(255) NOT NULL,

  -- 알림 내용
  message TEXT NOT NULL,
  notification_type VARCHAR(50) NOT NULL, -- 'assignment', 'status_change', 'unassignment', 'deletion'
  priority VARCHAR(20) DEFAULT 'normal', -- 'normal', 'high', 'urgent'

  -- 메타데이터
  metadata JSONB DEFAULT '{}',

  -- 상태
  is_read BOOLEAN DEFAULT false,

  -- 시간 정보
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  expires_at TIMESTAMP WITH TIME ZONE DEFAULT (NOW() + INTERVAL '30 days')
);

-- ============================================================================
-- 3. 인덱스 생성 (성능 최적화)
-- ============================================================================

-- notifications 테이블 인덱스
CREATE INDEX IF NOT EXISTS idx_notifications_category ON notifications(category);
CREATE INDEX IF NOT EXISTS idx_notifications_priority ON notifications(priority);
CREATE INDEX IF NOT EXISTS idx_notifications_created_at_desc ON notifications(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_expires_at ON notifications(expires_at);
CREATE INDEX IF NOT EXISTS idx_notifications_resource ON notifications(related_resource_type, related_resource_id);
CREATE INDEX IF NOT EXISTS idx_notifications_system ON notifications(is_system_notification);

-- task_notifications 테이블 인덱스
CREATE INDEX IF NOT EXISTS idx_task_notifications_user_created ON task_notifications(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_task_notifications_task_user ON task_notifications(task_id, user_id);
CREATE INDEX IF NOT EXISTS idx_task_notifications_read_status ON task_notifications(is_read, created_at);
CREATE INDEX IF NOT EXISTS idx_task_notifications_expires_at ON task_notifications(expires_at);

-- ============================================================================
-- 4. 테이블 확인 및 초기 데이터
-- ============================================================================

-- 테이블 생성 확인
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'notifications') THEN
        RAISE NOTICE '✅ notifications 테이블 생성 완료';
    ELSE
        RAISE EXCEPTION '❌ notifications 테이블 생성 실패';
    END IF;

    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'task_notifications') THEN
        RAISE NOTICE '✅ task_notifications 테이블 생성 완료';
    ELSE
        RAISE EXCEPTION '❌ task_notifications 테이블 생성 실패';
    END IF;
END $$;

-- 초기 시스템 알림 생성
INSERT INTO notifications (
  title,
  message,
  category,
  priority,
  is_system_notification,
  created_by_name,
  metadata
) VALUES (
  'Supabase Realtime 알림 시스템 준비 완료',
  '실시간 알림 기반 테이블이 성공적으로 생성되었습니다. notifications, task_notifications 테이블이 활성화되었습니다.',
  'system_update',
  'medium',
  true,
  'System',
  jsonb_build_object(
    'tables_created', ARRAY['notifications', 'task_notifications'],
    'realtime_ready', true,
    'setup_completed_at', NOW()
  )
) ON CONFLICT DO NOTHING;

-- 완료 메시지
SELECT
  'Supabase Realtime 기본 테이블 설정 완료' as status,
  'notifications, task_notifications 테이블 생성됨' as tables,
  'realtime_triggers.sql 실행 준비 완료' as next_step;