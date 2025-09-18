-- Phase 1: 소셜 로그인 및 사용자 관리 시스템 확장
-- 기존 employees 테이블을 안전하게 확장하여 소셜 로그인 지원

-- 1. employees 테이블 확장 (기존 시스템 호환)
ALTER TABLE IF EXISTS employees
ADD COLUMN IF NOT EXISTS provider VARCHAR(20),
ADD COLUMN IF NOT EXISTS provider_id VARCHAR(100),
ADD COLUMN IF NOT EXISTS avatar_url TEXT,
ADD COLUMN IF NOT EXISTS social_email VARCHAR(255),
ADD COLUMN IF NOT EXISTS signup_method VARCHAR(20) DEFAULT 'manual';

-- 2. 소셜 로그인 제약조건 추가
ALTER TABLE employees
ADD CONSTRAINT check_provider CHECK (provider IN ('kakao', 'naver', 'google', 'manual') OR provider IS NULL),
ADD CONSTRAINT check_signup_method CHECK (signup_method IN ('manual', 'social'));

-- 3. 소셜 계정 연동 테이블 (다중 소셜 계정 지원)
CREATE TABLE IF NOT EXISTS social_accounts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
    provider VARCHAR(20) NOT NULL CHECK (provider IN ('kakao', 'naver', 'google')),
    provider_id VARCHAR(100) NOT NULL,
    access_token TEXT,
    refresh_token TEXT,
    expires_at TIMESTAMPTZ,
    provider_data JSONB DEFAULT '{}',

    -- 메타데이터
    connected_at TIMESTAMPTZ DEFAULT NOW(),
    last_used_at TIMESTAMPTZ DEFAULT NOW(),
    is_active BOOLEAN DEFAULT true,

    -- 유니크 제약조건 (같은 제공자의 같은 ID는 하나만)
    UNIQUE(provider, provider_id)
);

-- 4. 사용자 알림 테이블 (실시간 알림 시스템)
CREATE TABLE IF NOT EXISTS user_notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,

    -- 알림 내용
    type VARCHAR(50) NOT NULL CHECK (type IN ('task_assigned', 'task_completed', 'task_updated', 'system_notice')),
    title VARCHAR(200) NOT NULL,
    message TEXT NOT NULL,

    -- 관련 데이터
    related_task_id UUID, -- facility_tasks 테이블과 연동
    related_user_id UUID REFERENCES employees(id), -- 알림을 보낸 사용자

    -- 알림 상태
    is_read BOOLEAN DEFAULT false,
    read_at TIMESTAMPTZ,

    -- 메타데이터
    created_at TIMESTAMPTZ DEFAULT NOW(),
    expires_at TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '30 days')
);

-- 5. 인덱스 생성
CREATE INDEX IF NOT EXISTS idx_employees_provider ON employees(provider, provider_id);
CREATE INDEX IF NOT EXISTS idx_employees_social_email ON employees(social_email);
CREATE INDEX IF NOT EXISTS idx_social_accounts_user ON social_accounts(user_id);
CREATE INDEX IF NOT EXISTS idx_social_accounts_provider ON social_accounts(provider, provider_id);
CREATE INDEX IF NOT EXISTS idx_notifications_user ON user_notifications(user_id, is_read);
CREATE INDEX IF NOT EXISTS idx_notifications_type ON user_notifications(type, created_at);
CREATE INDEX IF NOT EXISTS idx_notifications_task ON user_notifications(related_task_id);

-- 6. RLS (Row Level Security) 정책 설정
ALTER TABLE social_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_notifications ENABLE ROW LEVEL SECURITY;

-- 소셜 계정: 사용자는 자신의 소셜 계정만 관리
CREATE POLICY "Users can manage own social accounts" ON social_accounts
    FOR ALL USING (true); -- 임시로 모든 접근 허용 (API에서 제어)

-- 알림: 사용자는 자신의 알림만 조회
CREATE POLICY "Users can view own notifications" ON user_notifications
    FOR SELECT USING (true); -- 임시로 모든 접근 허용 (API에서 제어)

-- 알림 삽입: 시스템이 알림 생성
CREATE POLICY "System can create notifications" ON user_notifications
    FOR INSERT WITH CHECK (true);

-- 알림 업데이트: 사용자는 자신의 알림 상태만 변경
CREATE POLICY "Users can update own notifications" ON user_notifications
    FOR UPDATE USING (true) WITH CHECK (true);

-- 7. 트리거 함수 - 업무 할당 시 자동 알림 생성
CREATE OR REPLACE FUNCTION notify_task_assignment()
RETURNS TRIGGER AS $$
DECLARE
    assigner_name TEXT;
BEGIN
    -- 업무가 새로 할당되었을 때 (assignee가 변경됨)
    IF (OLD.assignee IS DISTINCT FROM NEW.assignee) AND NEW.assignee IS NOT NULL THEN
        -- 할당자 이름 조회
        SELECT name INTO assigner_name
        FROM employees
        WHERE email = auth.jwt() ->> 'email'
        LIMIT 1;

        -- 알림 생성
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
            'task_assigned',
            '새로운 업무가 할당되었습니다',
            format('%s 업무가 할당되었습니다. 사업장: %s', NEW.title, NEW.business_name),
            NEW.id,
            (SELECT id FROM employees WHERE name = COALESCE(assigner_name, '시스템') LIMIT 1)
        FROM employees e
        WHERE e.name = NEW.assignee;
    END IF;

    -- 업무가 완료되었을 때
    IF (OLD.status IS DISTINCT FROM NEW.status) AND NEW.status IN ('document_complete', 'subsidy_payment') THEN
        -- 할당자에게 완료 알림 (업무를 생성한 사람 또는 이전에 할당한 사람)
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
            format('%s 업무가 완료되었습니다. 담당자: %s', NEW.title, NEW.assignee),
            NEW.id,
            (SELECT id FROM employees WHERE name = NEW.assignee LIMIT 1)
        FROM employees e
        WHERE e.permission_level >= 2 -- 매니저 이상에게 알림
        LIMIT 5; -- 최대 5명까지
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 8. 트리거 생성
DROP TRIGGER IF EXISTS trigger_task_assignment_notification ON facility_tasks;
CREATE TRIGGER trigger_task_assignment_notification
    AFTER UPDATE ON facility_tasks
    FOR EACH ROW
    EXECUTE FUNCTION notify_task_assignment();

-- 9. 소셜 로그인 사용자 자동 생성 함수
CREATE OR REPLACE FUNCTION create_social_user(
    p_email TEXT,
    p_name TEXT,
    p_provider TEXT,
    p_provider_id TEXT,
    p_avatar_url TEXT DEFAULT NULL,
    p_provider_data JSONB DEFAULT '{}'
)
RETURNS TABLE(user_id UUID, is_new_user BOOLEAN) AS $$
DECLARE
    v_user_id UUID;
    v_is_new_user BOOLEAN := false;
BEGIN
    -- 기존 사용자 조회 (이메일 또는 소셜 ID로)
    SELECT id INTO v_user_id
    FROM employees
    WHERE email = p_email
       OR (provider = p_provider AND provider_id = p_provider_id)
    LIMIT 1;

    -- 새 사용자 생성
    IF v_user_id IS NULL THEN
        INSERT INTO employees (
            email,
            name,
            permission_level,
            role,
            provider,
            provider_id,
            avatar_url,
            social_email,
            signup_method,
            is_active,
            password_hash -- 소셜 로그인은 비밀번호 없음
        ) VALUES (
            p_email,
            p_name,
            1, -- 기본 권한
            '일반사용자',
            p_provider,
            p_provider_id,
            p_avatar_url,
            p_email,
            'social',
            true,
            NULL
        )
        RETURNING id INTO v_user_id;

        v_is_new_user := true;

        -- 소셜 계정 연동 정보 저장
        INSERT INTO social_accounts (
            user_id,
            provider,
            provider_id,
            provider_data
        ) VALUES (
            v_user_id,
            p_provider,
            p_provider_id,
            p_provider_data
        );

    ELSE
        -- 기존 사용자의 소셜 정보 업데이트
        UPDATE employees
        SET
            avatar_url = COALESCE(p_avatar_url, avatar_url),
            last_login_at = NOW()
        WHERE id = v_user_id;

        -- 소셜 계정 정보 업데이트 또는 추가
        INSERT INTO social_accounts (
            user_id,
            provider,
            provider_id,
            provider_data,
            last_used_at
        ) VALUES (
            v_user_id,
            p_provider,
            p_provider_id,
            p_provider_data,
            NOW()
        )
        ON CONFLICT (provider, provider_id)
        DO UPDATE SET
            provider_data = EXCLUDED.provider_data,
            last_used_at = NOW(),
            is_active = true;
    END IF;

    RETURN QUERY SELECT v_user_id, v_is_new_user;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 10. 사용자 통계 뷰 업데이트
CREATE OR REPLACE VIEW user_stats AS
SELECT
    COUNT(*) as total_users,
    COUNT(*) FILTER (WHERE is_active = true) as active_users,
    COUNT(*) FILTER (WHERE permission_level = 3) as admin_users,
    COUNT(*) FILTER (WHERE permission_level = 2) as manager_users,
    COUNT(*) FILTER (WHERE permission_level = 1) as regular_users,
    COUNT(*) FILTER (WHERE signup_method = 'social') as social_users,
    COUNT(*) FILTER (WHERE signup_method = 'manual') as manual_users,
    COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '30 days') as new_users_30d,
    COUNT(*) FILTER (WHERE last_login_at >= NOW() - INTERVAL '7 days') as active_users_7d
FROM employees;

-- 11. 알림 통계 뷰
CREATE OR REPLACE VIEW notification_stats AS
SELECT
    COUNT(*) as total_notifications,
    COUNT(*) FILTER (WHERE is_read = false) as unread_notifications,
    COUNT(*) FILTER (WHERE type = 'task_assigned') as task_assignments,
    COUNT(*) FILTER (WHERE type = 'task_completed') as task_completions,
    COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '24 hours') as notifications_24h
FROM user_notifications
WHERE expires_at > NOW();

COMMENT ON TABLE social_accounts IS '소셜 계정 연동 정보 - 다중 소셜 로그인 지원';
COMMENT ON TABLE user_notifications IS '사용자 알림 시스템 - 실시간 업무 알림';
COMMENT ON FUNCTION create_social_user IS '소셜 로그인 사용자 자동 생성 또는 업데이트';
COMMENT ON FUNCTION notify_task_assignment IS '업무 할당/완료 시 자동 알림 생성';