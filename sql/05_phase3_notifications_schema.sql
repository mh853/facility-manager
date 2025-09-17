-- Phase 3: 실시간 알림 및 협업 시스템 스키마
-- 작성일: 2025-09-17
-- 설명: 실시간 알림, 협업, 댓글 시스템을 위한 데이터베이스 스키마

-- ============================================
-- 알림 시스템 테이블
-- ============================================

-- 알림 유형 ENUM
CREATE TYPE notification_type AS ENUM (
  'project_assigned',      -- 프로젝트 할당
  'task_assigned',         -- 작업 할당
  'task_completed',        -- 작업 완료
  'task_overdue',         -- 작업 지연
  'comment_added',        -- 댓글 추가
  'mention',              -- 멘션
  'project_status_changed', -- 프로젝트 상태 변경
  'deadline_reminder',     -- 마감일 알림
  'system'                -- 시스템 알림
);

-- 알림 우선순위 ENUM
CREATE TYPE notification_priority AS ENUM ('낮음', '보통', '높음', '긴급');

-- 알림 테이블
CREATE TABLE IF NOT EXISTS notifications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    -- 알림 기본 정보
    type notification_type NOT NULL,
    title VARCHAR(200) NOT NULL,
    message TEXT NOT NULL,
    priority notification_priority NOT NULL DEFAULT '보통',

    -- 수신자 정보
    recipient_id UUID NOT NULL REFERENCES employees(id),

    -- 발신자 정보 (시스템 알림의 경우 NULL 가능)
    sender_id UUID REFERENCES employees(id),

    -- 관련 리소스 정보
    related_project_id UUID REFERENCES projects(id),
    related_task_id UUID REFERENCES tasks(id),

    -- 알림 상태
    is_read BOOLEAN DEFAULT FALSE,
    read_at TIMESTAMP,

    -- 액션 URL (클릭 시 이동할 경로)
    action_url TEXT,

    -- 추가 데이터 (JSON 형태)
    metadata JSONB DEFAULT '{}',

    -- 메타데이터
    created_at TIMESTAMP DEFAULT NOW(),
    expires_at TIMESTAMP, -- 알림 만료 시간

    -- 인덱스를 위한 제약조건
    CONSTRAINT notification_resource_check CHECK (
        related_project_id IS NOT NULL OR
        related_task_id IS NOT NULL OR
        type = 'system'
    )
);

-- 알림 설정 테이블 (사용자별 알림 설정)
CREATE TABLE IF NOT EXISTS notification_settings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    employee_id UUID NOT NULL REFERENCES employees(id) UNIQUE,

    -- 이메일 알림 설정
    email_enabled BOOLEAN DEFAULT TRUE,
    email_project_assigned BOOLEAN DEFAULT TRUE,
    email_task_assigned BOOLEAN DEFAULT TRUE,
    email_task_overdue BOOLEAN DEFAULT TRUE,
    email_mentions BOOLEAN DEFAULT TRUE,

    -- 브라우저 푸시 알림 설정
    push_enabled BOOLEAN DEFAULT FALSE,
    push_project_assigned BOOLEAN DEFAULT FALSE,
    push_task_assigned BOOLEAN DEFAULT TRUE,
    push_task_overdue BOOLEAN DEFAULT TRUE,
    push_mentions BOOLEAN DEFAULT TRUE,

    -- 인앱 알림 설정
    inapp_enabled BOOLEAN DEFAULT TRUE,
    inapp_all_types BOOLEAN DEFAULT TRUE,

    -- 알림 시간 설정
    quiet_hours_start TIME DEFAULT '22:00:00',
    quiet_hours_end TIME DEFAULT '08:00:00',
    weekend_notifications BOOLEAN DEFAULT FALSE,

    -- 메타데이터
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- 푸시 구독 테이블 (브라우저 푸시 알림용)
CREATE TABLE IF NOT EXISTS push_subscriptions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    employee_id UUID NOT NULL REFERENCES employees(id),

    -- Push API 구독 정보
    endpoint TEXT NOT NULL,
    p256dh_key TEXT NOT NULL,
    auth_key TEXT NOT NULL,

    -- 브라우저 정보
    user_agent TEXT,
    ip_address INET,

    -- 상태
    is_active BOOLEAN DEFAULT TRUE,

    -- 메타데이터
    created_at TIMESTAMP DEFAULT NOW(),
    last_used_at TIMESTAMP DEFAULT NOW(),

    -- 유니크 제약조건 (동일한 엔드포인트는 하나만)
    UNIQUE(employee_id, endpoint)
);

-- ============================================
-- 실시간 협업 테이블
-- ============================================

-- 멘션 테이블
CREATE TABLE IF NOT EXISTS mentions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    -- 멘션 위치 정보
    comment_id UUID REFERENCES task_comments(id) ON DELETE CASCADE,
    task_id UUID REFERENCES tasks(id) ON DELETE CASCADE,

    -- 멘션 사용자
    mentioned_by UUID NOT NULL REFERENCES employees(id),
    mentioned_user UUID NOT NULL REFERENCES employees(id),

    -- 멘션 텍스트 위치
    mention_text TEXT NOT NULL, -- '@사용자명' 형태
    content_excerpt TEXT, -- 멘션 주변 텍스트

    -- 상태
    is_read BOOLEAN DEFAULT FALSE,
    read_at TIMESTAMP,

    -- 메타데이터
    created_at TIMESTAMP DEFAULT NOW(),

    -- 제약조건 (댓글 또는 작업 중 하나는 필수)
    CONSTRAINT mention_target_check CHECK (
        comment_id IS NOT NULL OR task_id IS NOT NULL
    )
);

-- 실시간 활동 로그 테이블
CREATE TABLE IF NOT EXISTS activity_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    -- 활동 정보
    action VARCHAR(100) NOT NULL, -- 'created', 'updated', 'completed', 'commented' 등
    entity_type VARCHAR(50) NOT NULL, -- 'project', 'task', 'comment'
    entity_id UUID NOT NULL,

    -- 액터 정보
    actor_id UUID NOT NULL REFERENCES employees(id),

    -- 변경 내용
    changes JSONB DEFAULT '{}', -- 변경된 필드들
    old_values JSONB DEFAULT '{}',
    new_values JSONB DEFAULT '{}',

    -- 추가 컨텍스트
    description TEXT,
    metadata JSONB DEFAULT '{}',

    -- 관련 프로젝트 (필터링용)
    project_id UUID REFERENCES projects(id),

    -- 메타데이터
    created_at TIMESTAMP DEFAULT NOW()
);

-- 온라인 사용자 테이블 (실시간 상태 표시용)
CREATE TABLE IF NOT EXISTS user_sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    employee_id UUID NOT NULL REFERENCES employees(id),

    -- 세션 정보
    session_token VARCHAR(255) NOT NULL UNIQUE,
    socket_id VARCHAR(255), -- WebSocket 연결 ID

    -- 상태 정보
    is_online BOOLEAN DEFAULT TRUE,
    current_page TEXT, -- 현재 보고 있는 페이지
    last_activity TIMESTAMP DEFAULT NOW(),

    -- 브라우저 정보
    user_agent TEXT,
    ip_address INET,

    -- 메타데이터
    created_at TIMESTAMP DEFAULT NOW(),
    expires_at TIMESTAMP DEFAULT NOW() + INTERVAL '24 hours'
);

-- ============================================
-- 인덱스 생성
-- ============================================

-- 알림 테이블 인덱스
CREATE INDEX IF NOT EXISTS idx_notifications_recipient ON notifications(recipient_id);
CREATE INDEX IF NOT EXISTS idx_notifications_unread ON notifications(recipient_id, is_read, created_at);
CREATE INDEX IF NOT EXISTS idx_notifications_type ON notifications(type);
CREATE INDEX IF NOT EXISTS idx_notifications_project ON notifications(related_project_id);
CREATE INDEX IF NOT EXISTS idx_notifications_task ON notifications(related_task_id);
CREATE INDEX IF NOT EXISTS idx_notifications_expires ON notifications(expires_at);

-- 멘션 인덱스
CREATE INDEX IF NOT EXISTS idx_mentions_user ON mentions(mentioned_user);
CREATE INDEX IF NOT EXISTS idx_mentions_comment ON mentions(comment_id);
CREATE INDEX IF NOT EXISTS idx_mentions_task ON mentions(task_id);
CREATE INDEX IF NOT EXISTS idx_mentions_unread ON mentions(mentioned_user, is_read);

-- 활동 로그 인덱스
CREATE INDEX IF NOT EXISTS idx_activity_logs_entity ON activity_logs(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_activity_logs_actor ON activity_logs(actor_id);
CREATE INDEX IF NOT EXISTS idx_activity_logs_project ON activity_logs(project_id);
CREATE INDEX IF NOT EXISTS idx_activity_logs_created ON activity_logs(created_at);

-- 사용자 세션 인덱스
CREATE INDEX IF NOT EXISTS idx_user_sessions_employee ON user_sessions(employee_id);
CREATE INDEX IF NOT EXISTS idx_user_sessions_online ON user_sessions(is_online, last_activity);
CREATE INDEX IF NOT EXISTS idx_user_sessions_expires ON user_sessions(expires_at);

-- ============================================
-- 트리거 함수 생성
-- ============================================

-- updated_at 자동 업데이트 함수
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- 알림 설정 업데이트 트리거
CREATE TRIGGER update_notification_settings_updated_at
    BEFORE UPDATE ON notification_settings
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- 자동 알림 생성 함수
CREATE OR REPLACE FUNCTION create_notification_on_task_assign()
RETURNS TRIGGER AS $$
BEGIN
    -- 작업 할당 시 알림 생성
    IF NEW.assigned_to IS NOT NULL AND (OLD.assigned_to IS NULL OR OLD.assigned_to != NEW.assigned_to) THEN
        INSERT INTO notifications (
            type, title, message, priority, recipient_id, sender_id,
            related_task_id, action_url, metadata
        ) VALUES (
            'task_assigned',
            '새 작업이 할당되었습니다',
            '작업 "' || NEW.title || '"이(가) 할당되었습니다.',
            CASE WHEN NEW.priority = '긴급' THEN '긴급'::notification_priority
                 WHEN NEW.priority = '높음' THEN '높음'::notification_priority
                 ELSE '보통'::notification_priority
            END,
            NEW.assigned_to,
            NEW.updated_by,
            NEW.id,
            '/tasks/' || NEW.id,
            jsonb_build_object(
                'task_priority', NEW.priority,
                'due_date', NEW.due_date
            )
        );
    END IF;

    RETURN NEW;
END;
$$ language 'plpgsql';

-- 작업 할당 알림 트리거
CREATE TRIGGER task_assignment_notification
    AFTER UPDATE ON tasks
    FOR EACH ROW
    EXECUTE FUNCTION create_notification_on_task_assign();

-- 알림 만료 처리 함수
CREATE OR REPLACE FUNCTION cleanup_expired_notifications()
RETURNS void AS $$
BEGIN
    DELETE FROM notifications
    WHERE expires_at IS NOT NULL AND expires_at < NOW();

    DELETE FROM user_sessions
    WHERE expires_at < NOW();
END;
$$ language 'plpgsql';

-- ============================================
-- 기본 데이터 삽입
-- ============================================

-- 모든 사용자에 대한 기본 알림 설정 생성
INSERT INTO notification_settings (employee_id)
SELECT id FROM employees
ON CONFLICT (employee_id) DO NOTHING;

-- ============================================
-- 뷰 생성 (편의용)
-- ============================================

-- 알림 대시보드 뷰
CREATE OR REPLACE VIEW notification_dashboard AS
SELECT
    n.*,
    recipient.name as recipient_name,
    recipient.email as recipient_email,
    sender.name as sender_name,
    sender.email as sender_email,
    p.name as project_name,
    t.title as task_title,
    CASE
        WHEN n.created_at > NOW() - INTERVAL '1 hour' THEN 'recent'
        WHEN n.created_at > NOW() - INTERVAL '24 hours' THEN 'today'
        WHEN n.created_at > NOW() - INTERVAL '7 days' THEN 'this_week'
        ELSE 'older'
    END as time_category
FROM notifications n
LEFT JOIN employees recipient ON n.recipient_id = recipient.id
LEFT JOIN employees sender ON n.sender_id = sender.id
LEFT JOIN projects p ON n.related_project_id = p.id
LEFT JOIN tasks t ON n.related_task_id = t.id;

-- 멘션 대시보드 뷰
CREATE OR REPLACE VIEW mention_dashboard AS
SELECT
    m.*,
    mentioner.name as mentioned_by_name,
    mentioner.email as mentioned_by_email,
    mentioned.name as mentioned_user_name,
    mentioned.email as mentioned_user_email,
    tc.content as comment_content,
    t.title as task_title,
    p.name as project_name
FROM mentions m
LEFT JOIN employees mentioner ON m.mentioned_by = mentioner.id
LEFT JOIN employees mentioned ON m.mentioned_user = mentioned.id
LEFT JOIN task_comments tc ON m.comment_id = tc.id
LEFT JOIN tasks t ON m.task_id = t.id OR tc.task_id = t.id
LEFT JOIN projects p ON t.project_id = p.id;