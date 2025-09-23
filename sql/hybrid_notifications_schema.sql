-- 하이브리드 알림 시스템을 위한 데이터베이스 스키마
-- 기존 테이블과 호환되면서 성능을 최적화한 구조

-- 1. 일반 알림 테이블 (기존 notifications 테이블 확장)
-- 이미 존재한다면 컬럼만 추가
DO $$
BEGIN
    -- target_user_id 컬럼이 없다면 추가
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name='notifications' AND column_name='target_user_id') THEN
        ALTER TABLE notifications ADD COLUMN target_user_id UUID REFERENCES employees(id);
    END IF;

    -- expires_at 컬럼에 인덱스 추가 (성능 최적화)
    IF NOT EXISTS (SELECT 1 FROM pg_indexes
                   WHERE tablename='notifications' AND indexname='idx_notifications_expires_at') THEN
        CREATE INDEX idx_notifications_expires_at ON notifications(expires_at);
    END IF;

    -- 읽음 상태와 사용자 조합 인덱스 추가
    IF NOT EXISTS (SELECT 1 FROM pg_indexes
                   WHERE tablename='notifications' AND indexname='idx_notifications_user_read') THEN
        CREATE INDEX idx_notifications_user_read ON notifications(target_user_id, is_read);
    END IF;

    -- 시스템 알림과 생성일 조합 인덱스 추가
    IF NOT EXISTS (SELECT 1 FROM pg_indexes
                   WHERE tablename='notifications' AND indexname='idx_notifications_system_created') THEN
        CREATE INDEX idx_notifications_system_created ON notifications(is_system_notification, created_at DESC);
    END IF;
END $$;

-- 2. 업무 알림 테이블 (task_notifications) - 이미 존재하는지 확인 후 생성
CREATE TABLE IF NOT EXISTS task_notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
    task_id UUID NOT NULL,
    business_name VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    notification_type VARCHAR(50) NOT NULL DEFAULT 'general',
    priority VARCHAR(20) NOT NULL DEFAULT 'normal',
    metadata JSONB DEFAULT '{}',

    -- 읽음/삭제 상태
    is_read BOOLEAN NOT NULL DEFAULT false,
    is_deleted BOOLEAN NOT NULL DEFAULT false,

    -- 만료 관리
    expires_at TIMESTAMPTZ,

    -- 타임스탬프
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    read_at TIMESTAMPTZ,
    deleted_at TIMESTAMPTZ,

    -- 제약조건
    CONSTRAINT task_notifications_priority_check
        CHECK (priority IN ('low', 'normal', 'high', 'urgent')),
    CONSTRAINT task_notifications_notification_type_check
        CHECK (notification_type IN ('general', 'assignment', 'status_change', 'completion',
                                    'creation', 'creation_confirmation', 'update', 'deletion',
                                    'unassignment', 'reminder', 'deadline'))
);

-- 업무 알림 테이블 인덱스 (성능 최적화)
DO $$
BEGIN
    -- 사용자별 읽지 않은 알림 조회 최적화
    IF NOT EXISTS (SELECT 1 FROM pg_indexes
                   WHERE tablename='task_notifications' AND indexname='idx_task_notifications_user_unread') THEN
        CREATE INDEX idx_task_notifications_user_unread
        ON task_notifications(user_id, is_read, is_deleted, created_at DESC);
    END IF;

    -- 업무별 알림 조회 최적화
    IF NOT EXISTS (SELECT 1 FROM pg_indexes
                   WHERE tablename='task_notifications' AND indexname='idx_task_notifications_task') THEN
        CREATE INDEX idx_task_notifications_task
        ON task_notifications(task_id, created_at DESC);
    END IF;

    -- 만료된 알림 정리 최적화
    IF NOT EXISTS (SELECT 1 FROM pg_indexes
                   WHERE tablename='task_notifications' AND indexname='idx_task_notifications_expires') THEN
        CREATE INDEX idx_task_notifications_expires
        ON task_notifications(expires_at) WHERE expires_at IS NOT NULL;
    END IF;

    -- 우선순위별 조회 최적화
    IF NOT EXISTS (SELECT 1 FROM pg_indexes
                   WHERE tablename='task_notifications' AND indexname='idx_task_notifications_priority') THEN
        CREATE INDEX idx_task_notifications_priority
        ON task_notifications(user_id, priority, is_read) WHERE is_deleted = false;
    END IF;
END $$;

-- 3. 알림 캐시 테이블 (선택적 - 고성능이 필요한 경우)
CREATE TABLE IF NOT EXISTS notification_cache (
    user_id UUID PRIMARY KEY REFERENCES employees(id) ON DELETE CASCADE,
    cache_data JSONB NOT NULL,
    unread_count INTEGER NOT NULL DEFAULT 0,
    total_count INTEGER NOT NULL DEFAULT 0,
    priority_stats JSONB DEFAULT '{"critical":0,"high":0,"medium":0,"low":0}',
    last_updated TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '30 seconds'),

    -- 인덱스
    INDEX idx_notification_cache_expires (expires_at),
    INDEX idx_notification_cache_updated (last_updated)
);

-- 4. 업무 알림 통계 뷰 (성능 최적화용)
CREATE OR REPLACE VIEW task_notification_stats AS
SELECT
    user_id,
    COUNT(*) FILTER (WHERE NOT is_read AND NOT is_deleted) as unread_count,
    COUNT(*) FILTER (WHERE NOT is_deleted) as total_count,
    COUNT(*) FILTER (WHERE priority = 'urgent' AND NOT is_read AND NOT is_deleted) as urgent_count,
    COUNT(*) FILTER (WHERE priority = 'high' AND NOT is_read AND NOT is_deleted) as high_count,
    COUNT(*) FILTER (WHERE priority = 'normal' AND NOT is_read AND NOT is_deleted) as normal_count,
    COUNT(*) FILTER (WHERE priority = 'low' AND NOT is_read AND NOT is_deleted) as low_count,
    MAX(created_at) as last_notification_at
FROM task_notifications
WHERE (expires_at IS NULL OR expires_at > NOW())
GROUP BY user_id;

-- 5. 자동 업데이트 트리거 함수
CREATE OR REPLACE FUNCTION update_notification_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();

    -- 읽음 처리 시 read_at 자동 설정
    IF NEW.is_read = true AND OLD.is_read = false THEN
        NEW.read_at = NOW();
    END IF;

    -- 삭제 처리 시 deleted_at 자동 설정
    IF NEW.is_deleted = true AND OLD.is_deleted = false THEN
        NEW.deleted_at = NOW();
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 6. 트리거 적용
DO $$
BEGIN
    -- task_notifications 테이블에 업데이트 트리거 추가
    IF NOT EXISTS (SELECT 1 FROM pg_trigger
                   WHERE tgname = 'trigger_task_notifications_updated_at') THEN
        CREATE TRIGGER trigger_task_notifications_updated_at
            BEFORE UPDATE ON task_notifications
            FOR EACH ROW
            EXECUTE FUNCTION update_notification_timestamp();
    END IF;

    -- notifications 테이블에도 동일한 트리거 적용 (있다면)
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'notifications') THEN
        IF NOT EXISTS (SELECT 1 FROM pg_trigger
                       WHERE tgname = 'trigger_notifications_updated_at') THEN
            CREATE TRIGGER trigger_notifications_updated_at
                BEFORE UPDATE ON notifications
                FOR EACH ROW
                EXECUTE FUNCTION update_notification_timestamp();
        END IF;
    END IF;
END $$;

-- 7. 만료된 알림 자동 정리 함수
CREATE OR REPLACE FUNCTION cleanup_expired_notifications()
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    -- 만료된 알림들을 소프트 삭제
    UPDATE task_notifications
    SET is_deleted = true, deleted_at = NOW()
    WHERE expires_at IS NOT NULL
      AND expires_at < NOW()
      AND NOT is_deleted;

    GET DIAGNOSTICS deleted_count = ROW_COUNT;

    -- 30일 이상 된 삭제된 알림들을 하드 삭제 (선택적)
    -- DELETE FROM task_notifications
    -- WHERE is_deleted = true
    --   AND deleted_at < NOW() - INTERVAL '30 days';

    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- 8. RLS (Row Level Security) 설정 (보안 강화)
DO $$
BEGIN
    -- task_notifications 테이블에 RLS 활성화
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'task_notifications') THEN
        ALTER TABLE task_notifications ENABLE ROW LEVEL SECURITY;

        -- 사용자는 자신의 알림만 볼 수 있도록 정책 생성
        DROP POLICY IF EXISTS task_notifications_user_policy ON task_notifications;
        CREATE POLICY task_notifications_user_policy ON task_notifications
            FOR ALL USING (user_id = auth.uid() OR auth.role() = 'service_role');
    END IF;
END $$;

-- 9. 성능 모니터링용 뷰
CREATE OR REPLACE VIEW notification_performance_stats AS
SELECT
    'task_notifications' as table_name,
    COUNT(*) as total_records,
    COUNT(*) FILTER (WHERE NOT is_deleted) as active_records,
    COUNT(*) FILTER (WHERE NOT is_read AND NOT is_deleted) as unread_records,
    COUNT(*) FILTER (WHERE expires_at IS NOT NULL AND expires_at < NOW()) as expired_records,
    AVG(EXTRACT(EPOCH FROM (NOW() - created_at))) as avg_age_seconds,
    MIN(created_at) as oldest_record,
    MAX(created_at) as newest_record
FROM task_notifications

UNION ALL

SELECT
    'notifications' as table_name,
    COUNT(*) as total_records,
    COUNT(*) FILTER (WHERE NOT COALESCE(is_deleted, false)) as active_records,
    COUNT(*) FILTER (WHERE NOT COALESCE(is_read, false)) as unread_records,
    COUNT(*) FILTER (WHERE expires_at IS NOT NULL AND expires_at < NOW()) as expired_records,
    AVG(EXTRACT(EPOCH FROM (NOW() - created_at))) as avg_age_seconds,
    MIN(created_at) as oldest_record,
    MAX(created_at) as newest_record
FROM notifications
WHERE EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'notifications');

-- 10. 초기 데이터 및 설정
DO $$
BEGIN
    -- 정리 작업을 위한 cron job 예약 (pg_cron 확장이 있는 경우)
    -- SELECT cron.schedule('cleanup-expired-notifications', '0 2 * * *', 'SELECT cleanup_expired_notifications();');

    RAISE NOTICE '하이브리드 알림 시스템 스키마 설정 완료';
    RAISE NOTICE '- task_notifications 테이블 생성/업데이트됨';
    RAISE NOTICE '- 성능 최적화 인덱스 생성됨';
    RAISE NOTICE '- 자동 정리 함수 생성됨';
    RAISE NOTICE '- RLS 보안 정책 적용됨';
END $$;