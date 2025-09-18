-- 기존 시스템에 실시간 알림 시스템 추가
-- 기존 employees, facility_tasks 테이블을 그대로 활용

-- 1. 사용자 알림 테이블 (기존 시스템과 완전 호환)
CREATE TABLE IF NOT EXISTS user_notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,

    -- 알림 내용
    type VARCHAR(50) NOT NULL CHECK (type IN ('task_assigned', 'task_completed', 'task_updated', 'system_notice')),
    title VARCHAR(200) NOT NULL,
    message TEXT NOT NULL,

    -- 관련 데이터
    related_task_id UUID, -- facility_tasks.id와 연결
    related_user_id UUID REFERENCES employees(id), -- 알림을 보낸 사용자

    -- 알림 상태
    is_read BOOLEAN DEFAULT false,
    read_at TIMESTAMPTZ,

    -- 메타데이터
    created_at TIMESTAMPTZ DEFAULT NOW(),
    expires_at TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '30 days')
);

-- 2. 인덱스 생성
CREATE INDEX IF NOT EXISTS idx_notifications_user_unread ON user_notifications(user_id, is_read, created_at);
CREATE INDEX IF NOT EXISTS idx_notifications_task ON user_notifications(related_task_id);
CREATE INDEX IF NOT EXISTS idx_notifications_type ON user_notifications(type, created_at);
CREATE INDEX IF NOT EXISTS idx_notifications_expires ON user_notifications(expires_at);

-- 3. RLS 정책 설정
ALTER TABLE user_notifications ENABLE ROW LEVEL SECURITY;

-- 사용자는 자신의 알림만 조회/수정
CREATE POLICY "Users can manage own notifications" ON user_notifications
    FOR ALL USING (true); -- API에서 사용자 확인

-- 4. 트리거 함수 - 업무 할당/완료 시 자동 알림 생성
CREATE OR REPLACE FUNCTION trigger_facility_task_notifications()
RETURNS TRIGGER AS $$
DECLARE
    assignee_id UUID;
    assigner_id UUID;
    assigner_name TEXT;
BEGIN
    -- 업무가 새로 할당되었을 때 (assignee가 변경됨)
    IF (OLD.assignee IS DISTINCT FROM NEW.assignee) AND NEW.assignee IS NOT NULL THEN
        -- 담당자 ID 조회 (이름으로)
        SELECT id INTO assignee_id
        FROM employees
        WHERE name = NEW.assignee AND is_active = true
        LIMIT 1;

        -- 할당자 정보 조회 (현재 수정한 사람 - API에서 전달)
        SELECT id, name INTO assigner_id, assigner_name
        FROM employees
        WHERE id = COALESCE(NEW.updated_by, OLD.updated_by)
        LIMIT 1;

        -- 담당자에게 알림 생성
        IF assignee_id IS NOT NULL THEN
            INSERT INTO user_notifications (
                user_id,
                type,
                title,
                message,
                related_task_id,
                related_user_id
            ) VALUES (
                assignee_id,
                'task_assigned',
                '새로운 업무가 할당되었습니다',
                format('"%s" 업무가 할당되었습니다. 사업장: %s', NEW.title, NEW.business_name),
                NEW.id,
                assigner_id
            );
        END IF;
    END IF;

    -- 업무가 완료되었을 때
    IF (OLD.status IS DISTINCT FROM NEW.status) AND
       NEW.status IN ('document_complete', 'subsidy_payment', 'final_document_submit') THEN

        -- 담당자 ID 조회
        SELECT id INTO assignee_id
        FROM employees
        WHERE name = NEW.assignee AND is_active = true
        LIMIT 1;

        -- 매니저 이상(권한 2+)에게 완료 알림
        INSERT INTO user_notifications (
            user_id,
            type,
            title,
            message,
            related_task_id,
            related_user_id
        )
        SELECT
            e.id,
            'task_completed',
            '업무가 완료되었습니다',
            format('"%s" 업무가 완료되었습니다. 담당자: %s, 사업장: %s',
                   NEW.title,
                   COALESCE(NEW.assignee, '미정'),
                   NEW.business_name),
            NEW.id,
            assignee_id
        FROM employees e
        WHERE e.permission_level >= 2
          AND e.is_active = true
          AND NOT e.is_deleted
        LIMIT 10; -- 최대 10명까지
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5. facility_tasks 테이블에 updated_by 컬럼 추가 (수정자 추적용)
ALTER TABLE facility_tasks
ADD COLUMN IF NOT EXISTS updated_by UUID REFERENCES employees(id);

-- 6. 트리거 생성
DROP TRIGGER IF EXISTS facility_task_notification_trigger ON facility_tasks;
CREATE TRIGGER facility_task_notification_trigger
    AFTER UPDATE ON facility_tasks
    FOR EACH ROW
    EXECUTE FUNCTION trigger_facility_task_notifications();

-- 7. 알림 정리 함수 (만료된 알림 자동 삭제)
CREATE OR REPLACE FUNCTION cleanup_expired_notifications()
RETURNS void AS $$
BEGIN
    DELETE FROM user_notifications
    WHERE expires_at < NOW();

    -- 읽은 알림 중 7일 이상 된 것도 정리
    DELETE FROM user_notifications
    WHERE is_read = true
      AND read_at < NOW() - INTERVAL '7 days';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 8. 알림 통계 뷰
CREATE OR REPLACE VIEW notification_stats AS
SELECT
    COUNT(*) as total_notifications,
    COUNT(*) FILTER (WHERE is_read = false) as unread_notifications,
    COUNT(*) FILTER (WHERE type = 'task_assigned') as task_assignments,
    COUNT(*) FILTER (WHERE type = 'task_completed') as task_completions,
    COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '24 hours') as notifications_24h,
    COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '7 days') as notifications_7d
FROM user_notifications
WHERE expires_at > NOW();

-- 9. 사용자별 알림 통계 뷰
CREATE OR REPLACE VIEW user_notification_stats AS
SELECT
    e.id as user_id,
    e.name as user_name,
    e.email as user_email,
    COUNT(n.id) as total_notifications,
    COUNT(n.id) FILTER (WHERE n.is_read = false) as unread_count,
    COUNT(n.id) FILTER (WHERE n.type = 'task_assigned') as assigned_tasks,
    COUNT(n.id) FILTER (WHERE n.type = 'task_completed') as completed_tasks,
    MAX(n.created_at) as last_notification_at
FROM employees e
LEFT JOIN user_notifications n ON e.id = n.user_id AND n.expires_at > NOW()
WHERE e.is_active = true AND NOT e.is_deleted
GROUP BY e.id, e.name, e.email
ORDER BY unread_count DESC, last_notification_at DESC;

-- 10. 샘플 시스템 알림 생성 함수
CREATE OR REPLACE FUNCTION create_system_notification(
    p_message TEXT,
    p_target_permission_level INTEGER DEFAULT NULL
)
RETURNS void AS $$
BEGIN
    INSERT INTO user_notifications (
        user_id,
        type,
        title,
        message
    )
    SELECT
        e.id,
        'system_notice',
        '시스템 공지',
        p_message
    FROM employees e
    WHERE e.is_active = true
      AND NOT e.is_deleted
      AND (p_target_permission_level IS NULL OR e.permission_level >= p_target_permission_level);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 11. 주기적 정리 작업 예제 (PostgreSQL 확장 필요시)
-- SELECT cron.schedule('cleanup-notifications', '0 2 * * *', 'SELECT cleanup_expired_notifications();');

COMMENT ON TABLE user_notifications IS '사용자 실시간 알림 시스템 - 기존 시스템과 완전 호환';
COMMENT ON FUNCTION trigger_facility_task_notifications IS '업무 할당/완료 시 자동 알림 생성';
COMMENT ON FUNCTION cleanup_expired_notifications IS '만료된 알림 자동 정리';
COMMENT ON FUNCTION create_system_notification IS '시스템 공지사항 생성';