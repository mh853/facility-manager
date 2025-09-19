-- 세션 보안 관리를 위한 데이터베이스 테이블
-- 무기한 세션의 보안 위험을 완화하기 위한 추가 테이블들

-- 1. 사용자 세션 추적 테이블
CREATE TABLE IF NOT EXISTS user_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,

    -- 세션 정보
    session_id VARCHAR(255) UNIQUE NOT NULL, -- JWT의 jti 클레임 또는 고유 세션 ID
    device_info TEXT,
    ip_address VARCHAR(45), -- IPv6 지원
    user_agent TEXT,

    -- 활동 추적
    created_at TIMESTAMPTZ DEFAULT NOW(),
    last_activity TIMESTAMPTZ DEFAULT NOW(),
    ended_at TIMESTAMPTZ,
    is_active BOOLEAN DEFAULT true,

    -- 메타데이터
    login_method VARCHAR(50) DEFAULT 'social', -- 'social', 'email'
    provider VARCHAR(20), -- 'google', 'kakao', 'naver'

    -- 보안 플래그
    is_suspicious BOOLEAN DEFAULT false,
    force_logout BOOLEAN DEFAULT false
);

-- 2. 보안 이벤트 로그 테이블
CREATE TABLE IF NOT EXISTS security_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES employees(id) ON DELETE CASCADE,

    -- 이벤트 정보
    event_type VARCHAR(50) NOT NULL, -- 'login', 'logout', 'suspicious_activity', 'token_refresh'
    ip_address VARCHAR(45),
    device_info TEXT,
    user_agent TEXT,

    -- 상세 정보 (JSON)
    details JSONB DEFAULT '{}',

    -- 심각도
    severity VARCHAR(20) DEFAULT 'info', -- 'info', 'warning', 'critical'

    -- 타임스탬프
    timestamp TIMESTAMPTZ DEFAULT NOW(),

    -- 처리 상태
    is_resolved BOOLEAN DEFAULT false,
    resolved_at TIMESTAMPTZ,
    resolved_by UUID REFERENCES employees(id)
);

-- 3. 인덱스 생성
CREATE INDEX IF NOT EXISTS idx_user_sessions_user_active ON user_sessions(user_id, is_active);
CREATE INDEX IF NOT EXISTS idx_user_sessions_session_id ON user_sessions(session_id);
CREATE INDEX IF NOT EXISTS idx_user_sessions_last_activity ON user_sessions(last_activity);
CREATE INDEX IF NOT EXISTS idx_user_sessions_ip ON user_sessions(ip_address);

CREATE INDEX IF NOT EXISTS idx_security_events_user ON security_events(user_id, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_security_events_type ON security_events(event_type, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_security_events_severity ON security_events(severity, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_security_events_timestamp ON security_events(timestamp DESC);

-- 4. RLS (Row Level Security) 정책
ALTER TABLE user_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE security_events ENABLE ROW LEVEL SECURITY;

-- 사용자는 자신의 세션만 조회 가능 (API에서 제어)
CREATE POLICY "Users can view own sessions" ON user_sessions
    FOR SELECT USING (true); -- API에서 사용자 확인

-- 시스템만 보안 이벤트 생성 가능
CREATE POLICY "System can create security events" ON security_events
    FOR INSERT WITH CHECK (true);

-- 관리자는 모든 보안 이벤트 조회 가능
CREATE POLICY "Admins can view all security events" ON security_events
    FOR SELECT USING (true); -- API에서 권한 확인

-- 5. 자동 세션 정리 함수
CREATE OR REPLACE FUNCTION cleanup_inactive_sessions(days_threshold INTEGER DEFAULT 30)
RETURNS INTEGER AS $$
DECLARE
    cleaned_count INTEGER;
BEGIN
    -- 지정된 일수 이상 비활성 세션들을 비활성화
    UPDATE user_sessions
    SET
        is_active = false,
        ended_at = NOW(),
        force_logout = true
    WHERE
        is_active = true
        AND last_activity < NOW() - (days_threshold || ' days')::INTERVAL;

    GET DIAGNOSTICS cleaned_count = ROW_COUNT;

    -- 정리 이벤트 로그
    INSERT INTO security_events (
        user_id,
        event_type,
        ip_address,
        device_info,
        details,
        severity,
        timestamp
    )
    SELECT
        NULL,
        'cleanup',
        'System',
        'Automated Cleanup',
        jsonb_build_object(
            'cleaned_sessions', cleaned_count,
            'threshold_days', days_threshold
        ),
        'info',
        NOW()
    WHERE cleaned_count > 0;

    RETURN cleaned_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 6. 의심스러운 활동 탐지 함수
CREATE OR REPLACE FUNCTION detect_suspicious_login(
    p_user_id UUID,
    p_ip_address VARCHAR(45),
    p_device_info TEXT
)
RETURNS BOOLEAN AS $$
DECLARE
    recent_login RECORD;
    is_suspicious BOOLEAN := false;
    different_ip_count INTEGER;
    login_frequency INTEGER;
BEGIN
    -- 최근 로그인 조회
    SELECT * INTO recent_login
    FROM user_sessions
    WHERE user_id = p_user_id
      AND is_active = true
      AND created_at > NOW() - INTERVAL '24 hours'
    ORDER BY created_at DESC
    LIMIT 1;

    -- 1. 다른 IP에서의 로그인 확인
    IF recent_login.ip_address IS NOT NULL AND recent_login.ip_address != p_ip_address THEN
        is_suspicious := true;

        -- 보안 이벤트 로그
        INSERT INTO security_events (
            user_id,
            event_type,
            ip_address,
            device_info,
            details,
            severity
        ) VALUES (
            p_user_id,
            'suspicious_activity',
            p_ip_address,
            p_device_info,
            jsonb_build_object(
                'reason', 'Different IP address',
                'previous_ip', recent_login.ip_address,
                'current_ip', p_ip_address
            ),
            'warning'
        );
    END IF;

    -- 2. 짧은 시간 내 여러 IP에서의 접근 확인
    SELECT COUNT(DISTINCT ip_address) INTO different_ip_count
    FROM user_sessions
    WHERE user_id = p_user_id
      AND created_at > NOW() - INTERVAL '1 hour';

    IF different_ip_count > 3 THEN
        is_suspicious := true;

        INSERT INTO security_events (
            user_id,
            event_type,
            ip_address,
            device_info,
            details,
            severity
        ) VALUES (
            p_user_id,
            'suspicious_activity',
            p_ip_address,
            p_device_info,
            jsonb_build_object(
                'reason', 'Multiple IP addresses in short time',
                'ip_count', different_ip_count
            ),
            'critical'
        );
    END IF;

    -- 3. 비정상적인 로그인 빈도 확인
    SELECT COUNT(*) INTO login_frequency
    FROM user_sessions
    WHERE user_id = p_user_id
      AND created_at > NOW() - INTERVAL '1 hour';

    IF login_frequency > 10 THEN
        is_suspicious := true;

        INSERT INTO security_events (
            user_id,
            event_type,
            ip_address,
            device_info,
            details,
            severity
        ) VALUES (
            p_user_id,
            'suspicious_activity',
            p_ip_address,
            p_device_info,
            jsonb_build_object(
                'reason', 'High login frequency',
                'login_count', login_frequency
            ),
            'warning'
        );
    END IF;

    RETURN is_suspicious;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 7. 세션 통계 뷰
CREATE OR REPLACE VIEW session_stats AS
SELECT
    COUNT(*) as total_sessions,
    COUNT(*) FILTER (WHERE is_active = true) as active_sessions,
    COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '24 hours') as sessions_24h,
    COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '7 days') as sessions_7d,
    COUNT(*) FILTER (WHERE is_suspicious = true) as suspicious_sessions,
    COUNT(DISTINCT user_id) as unique_users,
    COUNT(DISTINCT ip_address) as unique_ips,
    AVG(EXTRACT(EPOCH FROM (COALESCE(ended_at, NOW()) - created_at)) / 3600) as avg_session_hours
FROM user_sessions;

-- 8. 사용자별 세션 통계 뷰
CREATE OR REPLACE VIEW user_session_stats AS
SELECT
    e.id as user_id,
    e.name as user_name,
    e.email as user_email,
    COUNT(s.id) as total_sessions,
    COUNT(s.id) FILTER (WHERE s.is_active = true) as active_sessions,
    MAX(s.last_activity) as last_activity,
    COUNT(s.id) FILTER (WHERE s.is_suspicious = true) as suspicious_sessions,
    COUNT(DISTINCT s.ip_address) as unique_ips
FROM employees e
LEFT JOIN user_sessions s ON e.id = s.user_id
WHERE e.is_active = true AND NOT e.is_deleted
GROUP BY e.id, e.name, e.email
ORDER BY active_sessions DESC, last_activity DESC;

-- 9. 정기 정리 작업 예제 (PostgreSQL cron 확장 사용시)
-- SELECT cron.schedule('session-cleanup', '0 2 * * *', 'SELECT cleanup_inactive_sessions(30);');

-- 10. 초기 보안 설정
-- 시스템 관리자에게 보안 이벤트 모니터링 권한 부여를 위한 참고사항
COMMENT ON TABLE user_sessions IS '사용자 세션 추적 - 무기한 세션의 보안 위험 완화';
COMMENT ON TABLE security_events IS '보안 이벤트 로그 - 의심스러운 활동 추적 및 감사';
COMMENT ON FUNCTION cleanup_inactive_sessions IS '비활성 세션 자동 정리';
COMMENT ON FUNCTION detect_suspicious_login IS '의심스러운 로그인 활동 탐지';

-- 기본 정리 작업 실행 (30일 이상 비활성 세션 정리)
-- SELECT cleanup_inactive_sessions(30);