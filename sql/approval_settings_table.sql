-- 관리자 승인 시스템 설정 테이블
CREATE TABLE IF NOT EXISTS approval_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- 자동 승인 설정
    auto_approval_enabled BOOLEAN NOT NULL DEFAULT true,
    auto_approval_domains TEXT[] NOT NULL DEFAULT '{}',
    auto_approval_permission_level INTEGER NOT NULL DEFAULT 1 CHECK (auto_approval_permission_level BETWEEN 1 AND 3),

    -- 수동 승인 설정
    manual_approval_required_for_level_3 BOOLEAN NOT NULL DEFAULT true,

    -- 알림 설정
    notification_emails TEXT[] NOT NULL DEFAULT '{}',

    -- 타임아웃 설정
    approval_timeout_hours INTEGER NOT NULL DEFAULT 24 CHECK (approval_timeout_hours BETWEEN 1 AND 168),

    -- 메타데이터
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_by TEXT NOT NULL DEFAULT 'system'
);

-- 승인 설정 기본값 삽입
INSERT INTO approval_settings (
    auto_approval_enabled,
    auto_approval_domains,
    auto_approval_permission_level,
    manual_approval_required_for_level_3,
    notification_emails,
    approval_timeout_hours,
    updated_by
) VALUES (
    true,                           -- 자동 승인 활성화
    ARRAY['@company.com'],          -- 자동 승인 도메인 (예시)
    1,                              -- 자동 승인 권한 레벨 (일반사용자)
    true,                           -- 관리자 권한은 수동 승인 필요
    ARRAY[]::TEXT[],                -- 알림 이메일 (비어있음)
    24,                             -- 24시간 승인 타임아웃
    'system'                        -- 시스템에 의한 기본 설정
) ON CONFLICT DO NOTHING;

-- 인덱스 생성
CREATE INDEX IF NOT EXISTS idx_approval_settings_created_at ON approval_settings(created_at DESC);

-- Row Level Security 활성화
ALTER TABLE approval_settings ENABLE ROW LEVEL SECURITY;

-- 관리자만 접근 가능한 정책
CREATE POLICY "approval_settings_admin_only" ON approval_settings
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM employees
            WHERE employees.id = auth.uid()
            AND employees.permission_level = 3
            AND employees.is_active = true
            AND employees.is_deleted = false
        )
    );

-- 자동 승인 설정 업데이트 함수
CREATE OR REPLACE FUNCTION update_approval_settings_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 승인 설정 업데이트 트리거
CREATE TRIGGER approval_settings_update_timestamp
    BEFORE UPDATE ON approval_settings
    FOR EACH ROW
    EXECUTE FUNCTION update_approval_settings_timestamp();

-- 자동 승인 확인 함수
CREATE OR REPLACE FUNCTION can_auto_approve(
    user_email TEXT,
    requested_permission_level INTEGER
)
RETURNS BOOLEAN AS $$
DECLARE
    settings RECORD;
    email_domain TEXT;
BEGIN
    -- 최신 승인 설정 조회
    SELECT * INTO settings
    FROM approval_settings
    ORDER BY created_at DESC
    LIMIT 1;

    IF settings IS NULL THEN
        RETURN false;
    END IF;

    -- 이메일 도메인 추출
    email_domain := '@' || split_part(user_email, '@', 2);

    -- 자동 승인 조건 확인
    RETURN settings.auto_approval_enabled = true
           AND email_domain = ANY(settings.auto_approval_domains)
           AND requested_permission_level <= settings.auto_approval_permission_level
           AND NOT (requested_permission_level = 3 AND settings.manual_approval_required_for_level_3 = true);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 승인 타임아웃 확인 함수
CREATE OR REPLACE FUNCTION is_approval_expired(approval_created_at TIMESTAMP WITH TIME ZONE)
RETURNS BOOLEAN AS $$
DECLARE
    settings RECORD;
    timeout_hours INTEGER;
BEGIN
    -- 최신 승인 설정에서 타임아웃 시간 조회
    SELECT approval_timeout_hours INTO timeout_hours
    FROM approval_settings
    ORDER BY created_at DESC
    LIMIT 1;

    IF timeout_hours IS NULL THEN
        timeout_hours := 24; -- 기본값 24시간
    END IF;

    -- 승인 요청이 타임아웃되었는지 확인
    RETURN approval_created_at + INTERVAL '1 hour' * timeout_hours < CURRENT_TIMESTAMP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON TABLE approval_settings IS '관리자 승인 시스템 설정';
COMMENT ON COLUMN approval_settings.auto_approval_enabled IS '자동 승인 활성화 여부';
COMMENT ON COLUMN approval_settings.auto_approval_domains IS '자동 승인 허용 도메인 목록';
COMMENT ON COLUMN approval_settings.auto_approval_permission_level IS '자동 승인 최대 권한 레벨';
COMMENT ON COLUMN approval_settings.manual_approval_required_for_level_3 IS '관리자 권한(레벨 3) 수동 승인 필요 여부';
COMMENT ON COLUMN approval_settings.notification_emails IS '승인 요청 알림 이메일 목록';
COMMENT ON COLUMN approval_settings.approval_timeout_hours IS '승인 요청 타임아웃 시간(시간 단위)';

COMMENT ON FUNCTION can_auto_approve(TEXT, INTEGER) IS '사용자 이메일과 요청 권한 레벨로 자동 승인 가능 여부 확인';
COMMENT ON FUNCTION is_approval_expired(TIMESTAMP WITH TIME ZONE) IS '승인 요청이 타임아웃되었는지 확인';