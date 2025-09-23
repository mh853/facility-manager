-- 알림 시스템 수정 및 초기화 스크립트 (안전 버전)
-- 기존 함수 삭제 후 새로 생성

-- ============================================================================
-- 0. 기존 함수 정리
-- ============================================================================

-- 기존 함수가 있다면 삭제
DROP FUNCTION IF EXISTS cleanup_expired_notifications();

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
-- 3. 업무 알림 테이블 생성/수정 (기존 구조 유지하면서 필요한 컬럼 추가)
-- ============================================================================

-- 기존 task_notifications 테이블에 필요한 컬럼이 있는지 확인 후 추가
DO $$
BEGIN
    -- read_at 컬럼 추가 (없는 경우)
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name='task_notifications' AND column_name='read_at') THEN
        ALTER TABLE task_notifications ADD COLUMN read_at TIMESTAMPTZ;
    END IF;

    -- user_name 컬럼 추가 (없는 경우)
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name='task_notifications' AND column_name='user_name') THEN
        ALTER TABLE task_notifications ADD COLUMN user_name VARCHAR(255);
    END IF;

    -- expires_at 컬럼 추가 (없는 경우)
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name='task_notifications' AND column_name='expires_at') THEN
        ALTER TABLE task_notifications ADD COLUMN expires_at TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '30 days');
    END IF;

    -- metadata 컬럼 추가 (없는 경우)
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name='task_notifications' AND column_name='metadata') THEN
        ALTER TABLE task_notifications ADD COLUMN metadata JSONB DEFAULT '{}';
    END IF;
END $$;

-- 추가 인덱스 생성
CREATE INDEX IF NOT EXISTS idx_task_notifications_user_id ON task_notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_task_notifications_is_read ON task_notifications(is_read);
CREATE INDEX IF NOT EXISTS idx_task_notifications_user_unread ON task_notifications(user_id, is_read, created_at DESC);

-- ============================================================================
-- 4. 새로운 알림 자동 정리 함수 (수정된 반환 타입)
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

-- 테스트용 사용자 알림 생성
INSERT INTO user_notifications (
    user_id, type, title, message
) VALUES
    ('demo-user', 'system_notice', '시스템 알림 테스트', '알림 시스템이 정상적으로 작동합니다.'),
    ('demo-user', 'task_assigned', '새 업무 배정', '새로운 시설 점검 업무가 배정되었습니다.')
ON CONFLICT DO NOTHING;

-- 기존 task_notifications에 누락된 데이터 보완
UPDATE task_notifications
SET user_name = 'Demo User'
WHERE user_name IS NULL;

-- ============================================================================
-- 7. 설정 완료 확인
-- ============================================================================

DO $$
DECLARE
    user_notifications_count INTEGER;
    task_notifications_count INTEGER;
    function_exists BOOLEAN;
BEGIN
    -- 테이블 확인
    SELECT COUNT(*) INTO user_notifications_count FROM user_notifications;
    SELECT COUNT(*) INTO task_notifications_count FROM task_notifications;

    -- 함수 존재 확인
    SELECT EXISTS(SELECT 1 FROM pg_proc WHERE proname = 'cleanup_expired_notifications') INTO function_exists;

    RAISE NOTICE '=== 알림 시스템 초기화 완료 ===';
    RAISE NOTICE 'user_notifications 테이블: %개 알림', user_notifications_count;
    RAISE NOTICE 'task_notifications 테이블: %개 알림', task_notifications_count;
    RAISE NOTICE 'cleanup_expired_notifications 함수: %',
                 CASE WHEN function_exists THEN '생성됨' ELSE '실패' END;
    RAISE NOTICE 'read_at 트리거: 설정됨';
    RAISE NOTICE '============================';
END $$;

-- 함수 테스트 실행
SELECT '함수 테스트: ' || cleanup_expired_notifications() || '개 만료 알림 정리됨' AS result;

-- 완료
SELECT
    '알림 시스템 수정 완료' as status,
    'user_notifications, task_notifications 테이블 준비됨' as message,
    '기존 함수 충돌 해결됨' as note,
    NOW() as completed_at;