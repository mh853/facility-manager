-- 알림 시스템 수정 및 초기화 스크립트
-- 실제 배포된 시스템에서 사용할 수 있도록 테이블 구조를 확인하고 생성

-- ============================================================================
-- 1. 필수 타입 생성
-- ============================================================================

-- 사용자 알림 타입
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'user_notification_type') THEN
        CREATE TYPE user_notification_type AS ENUM (
            'task_assigned',
            'task_completed',
            'task_updated',
            'system_notice',
            'system_maintenance',
            'security_alert'
        );
    END IF;
END $$;

-- 업무 알림 타입
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'task_notification_type') THEN
        CREATE TYPE task_notification_type AS ENUM (
            'delay',
            'risk',
            'status_change',
            'assignment',
            'completion',
            'creation',
            'update',
            'deletion'
        );
    END IF;
END $$;

-- 우선순위 타입
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'notification_priority') THEN
        CREATE TYPE notification_priority AS ENUM ('low', 'normal', 'high', 'urgent');
    END IF;
END $$;

-- ============================================================================
-- 2. 사용자 알림 테이블 생성/수정
-- ============================================================================

CREATE TABLE IF NOT EXISTS user_notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id VARCHAR(255) NOT NULL,
    type user_notification_type NOT NULL,
    title VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    related_task_id VARCHAR(255),
    related_user_id VARCHAR(255),
    is_read BOOLEAN NOT NULL DEFAULT false,
    read_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '30 days')
);

-- 인덱스 생성
CREATE INDEX IF NOT EXISTS idx_user_notifications_user_id ON user_notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_user_notifications_is_read ON user_notifications(is_read);
CREATE INDEX IF NOT EXISTS idx_user_notifications_expires_at ON user_notifications(expires_at);
CREATE INDEX IF NOT EXISTS idx_user_notifications_user_unread ON user_notifications(user_id, is_read, created_at DESC);

-- ============================================================================
-- 3. 업무 알림 테이블 생성/수정
-- ============================================================================

CREATE TABLE IF NOT EXISTS task_notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id VARCHAR(255) NOT NULL,
    user_name VARCHAR(255),
    task_id VARCHAR(255) NOT NULL,
    business_name VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    notification_type task_notification_type NOT NULL DEFAULT 'status_change',
    priority notification_priority NOT NULL DEFAULT 'normal',
    is_read BOOLEAN NOT NULL DEFAULT false,
    read_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '30 days'),
    metadata JSONB DEFAULT '{}'
);

-- 인덱스 생성
CREATE INDEX IF NOT EXISTS idx_task_notifications_user_id ON task_notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_task_notifications_is_read ON task_notifications(is_read);
CREATE INDEX IF NOT EXISTS idx_task_notifications_task_id ON task_notifications(task_id);
CREATE INDEX IF NOT EXISTS idx_task_notifications_user_unread ON task_notifications(user_id, is_read, created_at DESC);

-- ============================================================================
-- 4. 알림 자동 정리 함수
-- ============================================================================

CREATE OR REPLACE FUNCTION cleanup_expired_notifications()
RETURNS INTEGER AS $$
DECLARE
    user_deleted_count INTEGER;
    task_deleted_count INTEGER;
    total_deleted INTEGER;
BEGIN
    -- 만료된 사용자 알림 삭제
    DELETE FROM user_notifications
    WHERE expires_at < NOW();

    GET DIAGNOSTICS user_deleted_count = ROW_COUNT;

    -- 만료된 업무 알림 삭제 (expires_at이 NULL이 아닌 경우만)
    DELETE FROM task_notifications
    WHERE expires_at IS NOT NULL AND expires_at < NOW();

    GET DIAGNOSTICS task_deleted_count = ROW_COUNT;

    total_deleted := user_deleted_count + task_deleted_count;

    RAISE NOTICE '만료된 알림 정리 완료: 사용자 알림 %개, 업무 알림 %개, 총 %개',
                 user_deleted_count, task_deleted_count, total_deleted;

    RETURN total_deleted;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- 5. 트리거 함수 (읽음 시간 자동 설정)
-- ============================================================================

CREATE OR REPLACE FUNCTION set_notification_read_time()
RETURNS TRIGGER AS $$
BEGIN
    -- is_read가 true로 변경되었을 때 read_at 자동 설정
    IF NEW.is_read = true AND OLD.is_read = false THEN
        NEW.read_at = NOW();
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 트리거 생성 (존재하지 않을 때만)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'user_notifications_read_trigger') THEN
        CREATE TRIGGER user_notifications_read_trigger
            BEFORE UPDATE ON user_notifications
            FOR EACH ROW
            EXECUTE FUNCTION set_notification_read_time();
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'task_notifications_read_trigger') THEN
        CREATE TRIGGER task_notifications_read_trigger
            BEFORE UPDATE ON task_notifications
            FOR EACH ROW
            EXECUTE FUNCTION set_notification_read_time();
    END IF;
END $$;

-- ============================================================================
-- 6. 테스트 데이터 생성 (개발용)
-- ============================================================================

-- 테스트용 사용자 알림 생성 (실제 운영에서는 제거)
INSERT INTO user_notifications (
    user_id, type, title, message
) VALUES
    ('demo-user', 'system_notice', '시스템 알림 테스트', '알림 시스템이 정상적으로 작동합니다.'),
    ('demo-user', 'task_assigned', '새 업무 배정', '새로운 시설 점검 업무가 배정되었습니다.')
ON CONFLICT DO NOTHING;

-- 테스트용 업무 알림 생성
INSERT INTO task_notifications (
    user_id, user_name, task_id, business_name, message, notification_type, priority
) VALUES
    ('demo-user', '데모 사용자', 'task-001', 'BlueON IoT', '시설 점검 업무가 생성되었습니다.', 'creation', 'normal'),
    ('demo-user', '데모 사용자', 'task-002', '테스트 업체', '업무 상태가 변경되었습니다.', 'status_change', 'high')
ON CONFLICT DO NOTHING;

-- ============================================================================
-- 7. 설정 완료 확인
-- ============================================================================

DO $$
DECLARE
    user_notifications_count INTEGER;
    task_notifications_count INTEGER;
BEGIN
    -- 테이블 확인
    SELECT COUNT(*) INTO user_notifications_count FROM user_notifications;
    SELECT COUNT(*) INTO task_notifications_count FROM task_notifications;

    RAISE NOTICE '=== 알림 시스템 초기화 완료 ===';
    RAISE NOTICE 'user_notifications 테이블: %개 알림', user_notifications_count;
    RAISE NOTICE 'task_notifications 테이블: %개 알림', task_notifications_count;
    RAISE NOTICE '트리거 및 인덱스 설정 완료';
    RAISE NOTICE '============================';
END $$;

-- 완료
SELECT
    '알림 시스템 수정 완료' as status,
    'user_notifications, task_notifications 테이블 준비됨' as message,
    NOW() as completed_at;