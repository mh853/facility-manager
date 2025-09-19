-- 소셜 로그인 승인 요청 테이블
CREATE TABLE IF NOT EXISTS social_auth_approvals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- 요청자 정보
    requester_name VARCHAR(100) NOT NULL,
    requester_email VARCHAR(255) NOT NULL,

    -- 소셜 로그인 제공자 정보
    provider VARCHAR(20) NOT NULL CHECK (provider IN ('kakao', 'naver', 'google')),
    provider_user_id VARCHAR(100) NOT NULL,
    provider_data JSONB DEFAULT '{}',

    -- 요청 권한 정보
    requested_permission_level INTEGER DEFAULT 1 CHECK (requested_permission_level BETWEEN 1 AND 3),
    requested_department VARCHAR(100),
    requested_position VARCHAR(100) DEFAULT '소셜 로그인 사용자',

    -- 승인 상태
    approval_status VARCHAR(20) DEFAULT 'pending' CHECK (approval_status IN ('pending', 'approved', 'rejected', 'expired')),

    -- 승인 처리 정보
    approved_by VARCHAR(100), -- 승인/거부한 관리자 이름
    approval_reason TEXT, -- 승인/거부 사유
    processed_at TIMESTAMPTZ, -- 승인/거부 처리 시간

    -- 생성된 계정 정보 (승인 후)
    created_employee_id UUID REFERENCES employees(id),

    -- 메타데이터
    created_at TIMESTAMPTZ DEFAULT NOW(),
    expires_at TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '7 days'), -- 7일 후 자동 만료

    -- IP 주소 및 사용자 에이전트 (보안용)
    requester_ip_address INET,
    requester_user_agent TEXT,

    -- 유니크 제약조건 (같은 제공자의 같은 사용자는 하나의 pending 요청만)
    UNIQUE(provider, provider_user_id, approval_status) DEFERRABLE INITIALLY DEFERRED
);

-- 인덱스 생성
CREATE INDEX IF NOT EXISTS idx_social_auth_approvals_status ON social_auth_approvals(approval_status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_social_auth_approvals_provider ON social_auth_approvals(provider, provider_user_id);
CREATE INDEX IF NOT EXISTS idx_social_auth_approvals_email ON social_auth_approvals(requester_email);
CREATE INDEX IF NOT EXISTS idx_social_auth_approvals_expires ON social_auth_approvals(expires_at) WHERE approval_status = 'pending';

-- Row Level Security 활성화
ALTER TABLE social_auth_approvals ENABLE ROW LEVEL SECURITY;

-- 관리자만 승인 요청을 조회/처리할 수 있는 정책
CREATE POLICY "social_auth_approvals_admin_access" ON social_auth_approvals
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM employees
            WHERE employees.id = auth.uid()
            AND employees.permission_level >= 2  -- 매니저 이상
            AND employees.is_active = true
            AND employees.is_deleted = false
        )
    );

-- 시스템에서 승인 요청을 생성할 수 있는 정책 (API 키 사용)
CREATE POLICY "social_auth_approvals_system_insert" ON social_auth_approvals
    FOR INSERT WITH CHECK (true); -- API에서 service role로 삽입

-- 만료된 승인 요청 정리 함수
CREATE OR REPLACE FUNCTION cleanup_expired_approvals()
RETURNS INTEGER AS $$
DECLARE
    affected_rows INTEGER;
BEGIN
    -- 만료된 승인 요청을 'expired' 상태로 변경
    UPDATE social_auth_approvals
    SET approval_status = 'expired',
        processed_at = NOW()
    WHERE approval_status = 'pending'
      AND expires_at < NOW();

    GET DIAGNOSTICS affected_rows = ROW_COUNT;

    -- 90일 이상 된 만료/거부/승인 완료된 요청은 삭제
    DELETE FROM social_auth_approvals
    WHERE approval_status IN ('expired', 'rejected', 'approved')
      AND processed_at < (NOW() - INTERVAL '90 days');

    RETURN affected_rows;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 승인 요청 통계 뷰
CREATE OR REPLACE VIEW social_approval_stats AS
SELECT
    COUNT(*) as total_requests,
    COUNT(*) FILTER (WHERE approval_status = 'pending') as pending_requests,
    COUNT(*) FILTER (WHERE approval_status = 'approved') as approved_requests,
    COUNT(*) FILTER (WHERE approval_status = 'rejected') as rejected_requests,
    COUNT(*) FILTER (WHERE approval_status = 'expired') as expired_requests,
    COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '24 hours') as requests_24h,
    COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '7 days') as requests_7d,
    COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '30 days') as requests_30d,
    -- 제공자별 통계
    COUNT(*) FILTER (WHERE provider = 'kakao') as kakao_requests,
    COUNT(*) FILTER (WHERE provider = 'naver') as naver_requests,
    COUNT(*) FILTER (WHERE provider = 'google') as google_requests
FROM social_auth_approvals
WHERE created_at >= NOW() - INTERVAL '1 year'; -- 최근 1년 데이터

-- 도메인별 정책 테이블 (선택적)
CREATE TABLE IF NOT EXISTS social_auth_policies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- 도메인 설정
    email_domain VARCHAR(100) NOT NULL UNIQUE, -- 예: 'company.com', 'organization.org'

    -- 자동 승인 설정
    auto_approve BOOLEAN DEFAULT false,
    default_permission_level INTEGER DEFAULT 1 CHECK (default_permission_level BETWEEN 1 AND 3),
    default_department VARCHAR(100),

    -- 수동 승인 설정
    require_admin_approval BOOLEAN DEFAULT true,
    approval_timeout_hours INTEGER DEFAULT 168 CHECK (approval_timeout_hours BETWEEN 1 AND 720), -- 최대 30일

    -- 알림 설정
    notification_emails TEXT[] DEFAULT '{}',

    -- 활성화 여부
    is_active BOOLEAN DEFAULT true,

    -- 메타데이터
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    created_by VARCHAR(100) NOT NULL,

    -- 설명
    description TEXT
);

-- 정책 테이블 인덱스
CREATE INDEX IF NOT EXISTS idx_social_auth_policies_domain ON social_auth_policies(email_domain, is_active);
CREATE INDEX IF NOT EXISTS idx_social_auth_policies_active ON social_auth_policies(is_active, created_at DESC);

-- 정책 테이블 RLS
ALTER TABLE social_auth_policies ENABLE ROW LEVEL SECURITY;

CREATE POLICY "social_auth_policies_admin_access" ON social_auth_policies
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM employees
            WHERE employees.id = auth.uid()
            AND employees.permission_level = 3  -- 관리자만
            AND employees.is_active = true
            AND employees.is_deleted = false
        )
    );

-- 기본 정책 삽입 (예시)
INSERT INTO social_auth_policies (
    email_domain,
    auto_approve,
    default_permission_level,
    default_department,
    require_admin_approval,
    approval_timeout_hours,
    is_active,
    created_by,
    description
) VALUES
-- 회사 도메인 - 자동 승인
('company.com', true, 1, 'IT', false, 24, true, 'system', '회사 공식 도메인 - 자동 승인'),
-- 외부 도메인 - 수동 승인
('gmail.com', false, 1, null, true, 168, true, 'system', '외부 이메일 도메인 - 관리자 승인 필요'),
('naver.com', false, 1, null, true, 168, true, 'system', '외부 이메일 도메인 - 관리자 승인 필요'),
('daum.net', false, 1, null, true, 168, true, 'system', '외부 이메일 도메인 - 관리자 승인 필요')
ON CONFLICT (email_domain) DO NOTHING;

-- 정책 업데이트 트리거
CREATE OR REPLACE FUNCTION update_social_auth_policies_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER social_auth_policies_update_timestamp
    BEFORE UPDATE ON social_auth_policies
    FOR EACH ROW
    EXECUTE FUNCTION update_social_auth_policies_timestamp();

-- 주석 추가
COMMENT ON TABLE social_auth_approvals IS '소셜 로그인 승인 요청 관리 테이블';
COMMENT ON TABLE social_auth_policies IS '이메일 도메인별 소셜 로그인 정책 설정';
COMMENT ON FUNCTION cleanup_expired_approvals() IS '만료된 승인 요청 정리 및 통계 관리';
COMMENT ON VIEW social_approval_stats IS '소셜 로그인 승인 요청 통계';

-- 정리 작업 실행 (선택적 - cron job으로 실행 권장)
-- SELECT cleanup_expired_approvals();