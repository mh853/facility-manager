-- 사용자 관리 테이블 생성 및 RLS 정책 설정
-- Facility Management System - Users Schema

-- 1. 사용자 테이블 생성
CREATE TABLE IF NOT EXISTS public.users (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    email VARCHAR(255) NOT NULL UNIQUE,
    name VARCHAR(100) NOT NULL,
    role INTEGER NOT NULL DEFAULT 1, -- 1: 일반사용자, 2: 매니저, 3: 관리자
    department VARCHAR(100),
    position VARCHAR(100),
    phone VARCHAR(20),

    -- 소셜 로그인 정보
    provider VARCHAR(20), -- kakao, naver, google
    provider_id VARCHAR(100),
    avatar_url TEXT,

    -- 계정 상태
    is_active BOOLEAN DEFAULT true,
    last_login_at TIMESTAMP WITH TIME ZONE,
    email_verified_at TIMESTAMP WITH TIME ZONE,

    -- 메타데이터
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_by UUID REFERENCES public.users(id),
    updated_by UUID REFERENCES public.users(id),

    -- 인덱스
    CONSTRAINT valid_role CHECK (role IN (1, 2, 3)),
    CONSTRAINT valid_provider CHECK (provider IN ('kakao', 'naver', 'google', 'system') OR provider IS NULL)
);

-- 2. 인덱스 생성
CREATE INDEX IF NOT EXISTS idx_users_email ON public.users(email);
CREATE INDEX IF NOT EXISTS idx_users_role ON public.users(role);
CREATE INDEX IF NOT EXISTS idx_users_active ON public.users(is_active);
CREATE INDEX IF NOT EXISTS idx_users_provider ON public.users(provider, provider_id);

-- 3. 사용자 세션 테이블 생성
CREATE TABLE IF NOT EXISTS public.user_sessions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    token_hash VARCHAR(255) NOT NULL,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    user_agent TEXT,
    ip_address INET,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_user_sessions_token ON public.user_sessions(token_hash);
CREATE INDEX IF NOT EXISTS idx_user_sessions_user ON public.user_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_user_sessions_expires ON public.user_sessions(expires_at);

-- 4. 사용자 활동 로그 테이블
CREATE TABLE IF NOT EXISTS public.user_activity_logs (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
    action VARCHAR(100) NOT NULL,
    resource_type VARCHAR(50),
    resource_id VARCHAR(100),
    details JSONB,
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_activity_user ON public.user_activity_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_activity_action ON public.user_activity_logs(action);
CREATE INDEX IF NOT EXISTS idx_activity_created ON public.user_activity_logs(created_at);

-- 5. RLS (Row Level Security) 정책 설정
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_activity_logs ENABLE ROW LEVEL SECURITY;

-- 사용자 테이블 RLS 정책
-- 모든 사용자는 자신의 정보를 읽을 수 있음
CREATE POLICY "Users can view own profile" ON public.users
    FOR SELECT USING (auth.uid()::text = id::text);

-- 관리자는 모든 사용자 정보를 읽을 수 있음
CREATE POLICY "Admins can view all users" ON public.users
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.users
            WHERE id::text = auth.uid()::text AND role = 3
        )
    );

-- 사용자는 자신의 정보를 업데이트할 수 있음
CREATE POLICY "Users can update own profile" ON public.users
    FOR UPDATE USING (auth.uid()::text = id::text);

-- 관리자는 다른 사용자 정보를 업데이트할 수 있음
CREATE POLICY "Admins can update users" ON public.users
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM public.users
            WHERE id::text = auth.uid()::text AND role = 3
        )
    );

-- 관리자만 사용자를 생성할 수 있음
CREATE POLICY "Admins can insert users" ON public.users
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.users
            WHERE id::text = auth.uid()::text AND role = 3
        )
    );

-- 세션 테이블 RLS 정책
CREATE POLICY "Users can manage own sessions" ON public.user_sessions
    FOR ALL USING (auth.uid()::text = user_id::text);

-- 활동 로그 RLS 정책
CREATE POLICY "Users can view own activity" ON public.user_activity_logs
    FOR SELECT USING (auth.uid()::text = user_id::text);

CREATE POLICY "Admins can view all activity" ON public.user_activity_logs
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.users
            WHERE id::text = auth.uid()::text AND role = 3
        )
    );

-- 시스템이 활동 로그를 삽입할 수 있음 (서비스 역할로)
CREATE POLICY "System can insert activity logs" ON public.user_activity_logs
    FOR INSERT WITH CHECK (true);

-- 6. 트리거 함수 생성 (updated_at 자동 업데이트)
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- updated_at 트리거 적용
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON public.users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 7. 기본 관리자 사용자 생성 (최초 설정용)
INSERT INTO public.users (
    email,
    name,
    role,
    department,
    provider,
    is_active,
    email_verified_at,
    created_at
) VALUES (
    'munong2@gmail.com',
    '시스템 관리자',
    3,
    'IT팀',
    NULL,
    true,
    NOW(),
    NOW()
) ON CONFLICT (email) DO NOTHING;

-- 기본 사용자들 생성
INSERT INTO public.users (
    email,
    name,
    role,
    department,
    provider,
    is_active,
    email_verified_at,
    created_at
) VALUES
(
    'seoh1523@gmail.com',
    '김서해',
    1,
    '영업1팀',
    NULL,
    true,
    NOW(),
    NOW()
) ON CONFLICT (email) DO NOTHING;

-- 8. 사용자 관련 유틸리티 함수들
CREATE OR REPLACE FUNCTION get_user_role(user_email TEXT)
RETURNS INTEGER AS $$
DECLARE
    user_role INTEGER;
BEGIN
    SELECT role INTO user_role
    FROM public.users
    WHERE email = user_email AND is_active = true;

    RETURN COALESCE(user_role, 1);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION is_admin(user_id_param UUID)
RETURNS BOOLEAN AS $$
DECLARE
    user_role INTEGER;
BEGIN
    SELECT role INTO user_role
    FROM public.users
    WHERE id = user_id_param AND is_active = true;

    RETURN COALESCE(user_role, 1) = 3;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 9. 사용자 통계 뷰
CREATE OR REPLACE VIEW user_stats AS
SELECT
    COUNT(*) as total_users,
    COUNT(*) FILTER (WHERE is_active = true) as active_users,
    COUNT(*) FILTER (WHERE role = 3) as admin_users,
    COUNT(*) FILTER (WHERE role = 2) as manager_users,
    COUNT(*) FILTER (WHERE role = 1) as regular_users,
    COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '30 days') as new_users_30d
FROM public.users;