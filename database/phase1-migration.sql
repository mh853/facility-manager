-- ===============================================
-- Phase 1: 소셜 로그인 확장 마이그레이션
-- 기존 employees 테이블 기반 안전한 확장
-- ===============================================

-- 1. 마이그레이션 시작 로그
DO $$
BEGIN
    RAISE NOTICE '시작: Phase 1 소셜 로그인 마이그레이션 - %', NOW();
END $$;

-- 2. 기존 employees 테이블 백업 (선택사항)
-- CREATE TABLE employees_backup_phase1 AS SELECT * FROM employees;

-- 3. employees 테이블에 소셜 로그인 관련 컬럼 추가
-- 안전한 방식으로 컬럼 추가 (이미 존재하면 무시)
DO $$
BEGIN
    -- provider 컬럼 추가
    BEGIN
        ALTER TABLE employees ADD COLUMN provider VARCHAR(20)
            CHECK (provider IN ('kakao', 'naver', 'google', 'system') OR provider IS NULL);
        RAISE NOTICE '✓ provider 컬럼 추가 완료';
    EXCEPTION WHEN duplicate_column THEN
        RAISE NOTICE '⚠ provider 컬럼이 이미 존재합니다';
    END;

    -- provider_id 컬럼 추가
    BEGIN
        ALTER TABLE employees ADD COLUMN provider_id VARCHAR(100);
        RAISE NOTICE '✓ provider_id 컬럼 추가 완료';
    EXCEPTION WHEN duplicate_column THEN
        RAISE NOTICE '⚠ provider_id 컬럼이 이미 존재합니다';
    END;

    -- avatar_url 컬럼 추가
    BEGIN
        ALTER TABLE employees ADD COLUMN avatar_url TEXT;
        RAISE NOTICE '✓ avatar_url 컬럼 추가 완료';
    EXCEPTION WHEN duplicate_column THEN
        RAISE NOTICE '⚠ avatar_url 컬럼이 이미 존재합니다';
    END;

    -- last_login_at 컬럼 추가
    BEGIN
        ALTER TABLE employees ADD COLUMN last_login_at TIMESTAMP WITH TIME ZONE;
        RAISE NOTICE '✓ last_login_at 컬럼 추가 완료';
    EXCEPTION WHEN duplicate_column THEN
        RAISE NOTICE '⚠ last_login_at 컬럼이 이미 존재합니다';
    END;

    -- email_verified_at 컬럼 추가
    BEGIN
        ALTER TABLE employees ADD COLUMN email_verified_at TIMESTAMP WITH TIME ZONE;
        RAISE NOTICE '✓ email_verified_at 컬럼 추가 완료';
    EXCEPTION WHEN duplicate_column THEN
        RAISE NOTICE '⚠ email_verified_at 컬럼이 이미 존재합니다';
    END;
END $$;

-- 4. 기존 데이터 마이그레이션
-- 기존 사용자들을 'system' 프로바이더로 설정
UPDATE employees
SET
    provider = 'system',
    email_verified_at = COALESCE(email_verified_at, created_at, NOW())
WHERE provider IS NULL AND password_hash IS NOT NULL;

RAISE NOTICE '✓ 기존 사용자 데이터 마이그레이션 완료: % 명',
    (SELECT COUNT(*) FROM employees WHERE provider = 'system');

-- 5. 소셜 계정 연동 테이블 생성
CREATE TABLE IF NOT EXISTS social_accounts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- 사용자 연결
    user_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,

    -- 소셜 프로바이더 정보
    provider VARCHAR(20) NOT NULL CHECK (provider IN ('kakao', 'naver', 'google')),
    provider_id VARCHAR(100) NOT NULL,
    provider_email VARCHAR(255),
    provider_name VARCHAR(100),

    -- 프로바이더별 추가 정보 (JSON 형태)
    provider_data JSONB DEFAULT '{}',

    -- 연동 상태
    is_active BOOLEAN DEFAULT true,
    linked_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_used_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    -- 메타데이터
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    -- 제약조건
    UNIQUE(provider, provider_id),  -- 동일 프로바이더에서 중복 계정 방지
    UNIQUE(user_id, provider)       -- 사용자당 프로바이더별 하나의 계정만
);

RAISE NOTICE '✓ social_accounts 테이블 생성 완료';

-- 6. 사용자 세션 확장 테이블 생성 (기존 JWT와 병행)
CREATE TABLE IF NOT EXISTS user_sessions_extended (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- 사용자 연결
    user_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,

    -- 세션 정보
    session_token VARCHAR(255) NOT NULL UNIQUE,
    refresh_token VARCHAR(255),

    -- 로그인 방식
    login_method VARCHAR(20) NOT NULL CHECK (login_method IN ('password', 'kakao', 'naver', 'google')),

    -- 세션 상태
    is_active BOOLEAN DEFAULT true,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    last_activity_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    -- 디바이스 정보
    device_info JSONB DEFAULT '{}',
    ip_address INET,
    user_agent TEXT,

    -- 메타데이터
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

RAISE NOTICE '✓ user_sessions_extended 테이블 생성 완료';

-- 7. 인덱스 생성
-- employees 테이블 소셜 로그인 인덱스
CREATE INDEX IF NOT EXISTS idx_employees_provider
    ON employees(provider, provider_id)
    WHERE provider IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_employees_last_login
    ON employees(last_login_at DESC)
    WHERE is_active = true;

-- social_accounts 테이블 인덱스
CREATE INDEX IF NOT EXISTS idx_social_accounts_user
    ON social_accounts(user_id);

CREATE INDEX IF NOT EXISTS idx_social_accounts_provider
    ON social_accounts(provider, provider_id);

CREATE INDEX IF NOT EXISTS idx_social_accounts_active
    ON social_accounts(is_active)
    WHERE is_active = true;

CREATE INDEX IF NOT EXISTS idx_social_accounts_last_used
    ON social_accounts(last_used_at DESC);

-- user_sessions_extended 테이블 인덱스
CREATE INDEX IF NOT EXISTS idx_user_sessions_extended_user
    ON user_sessions_extended(user_id);

CREATE INDEX IF NOT EXISTS idx_user_sessions_extended_token
    ON user_sessions_extended(session_token);

CREATE INDEX IF NOT EXISTS idx_user_sessions_extended_active
    ON user_sessions_extended(is_active)
    WHERE is_active = true;

CREATE INDEX IF NOT EXISTS idx_user_sessions_extended_expires
    ON user_sessions_extended(expires_at);

RAISE NOTICE '✓ 인덱스 생성 완료';

-- 8. 트리거 함수 및 트리거 생성
-- updated_at 자동 업데이트 트리거 함수 (이미 존재할 수 있음)
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- social_accounts 테이블 트리거
DROP TRIGGER IF EXISTS update_social_accounts_updated_at ON social_accounts;
CREATE TRIGGER update_social_accounts_updated_at
    BEFORE UPDATE ON social_accounts
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

RAISE NOTICE '✓ 트리거 생성 완료';

-- 9. RLS (Row Level Security) 정책 설정
-- social_accounts 테이블 RLS 활성화
ALTER TABLE social_accounts ENABLE ROW LEVEL SECURITY;

-- 기존 정책 제거 (있다면)
DROP POLICY IF EXISTS "Users can manage own social accounts" ON social_accounts;
DROP POLICY IF EXISTS "Admins can view all social accounts" ON social_accounts;

-- 사용자는 자신의 소셜 계정만 관리 가능
CREATE POLICY "Users can manage own social accounts" ON social_accounts
    FOR ALL USING (
        user_id::text = auth.uid()::text OR
        user_id IN (
            SELECT id FROM employees WHERE id::text = auth.uid()::text
        )
    );

-- 관리자는 모든 소셜 계정 조회 가능
CREATE POLICY "Admins can view all social accounts" ON social_accounts
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM employees
            WHERE id::text = auth.uid()::text AND permission_level = 3
        )
    );

-- user_sessions_extended 테이블 RLS
ALTER TABLE user_sessions_extended ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage own sessions" ON user_sessions_extended;

CREATE POLICY "Users can manage own sessions" ON user_sessions_extended
    FOR ALL USING (
        user_id::text = auth.uid()::text OR
        user_id IN (
            SELECT id FROM employees WHERE id::text = auth.uid()::text
        )
    );

RAISE NOTICE '✓ RLS 정책 설정 완료';

-- 10. 유틸리티 함수 생성
-- 소셜 계정 연동 함수
CREATE OR REPLACE FUNCTION link_social_account(
    p_user_id UUID,
    p_provider VARCHAR(20),
    p_provider_id VARCHAR(100),
    p_provider_email VARCHAR(255) DEFAULT NULL,
    p_provider_name VARCHAR(100) DEFAULT NULL,
    p_provider_data JSONB DEFAULT '{}'
)
RETURNS UUID AS $$
DECLARE
    social_account_id UUID;
BEGIN
    -- 기존 연동 확인 및 업데이트 또는 새로 생성
    INSERT INTO social_accounts (
        user_id, provider, provider_id, provider_email,
        provider_name, provider_data
    ) VALUES (
        p_user_id, p_provider, p_provider_id, p_provider_email,
        p_provider_name, p_provider_data
    )
    ON CONFLICT (user_id, provider)
    DO UPDATE SET
        provider_id = EXCLUDED.provider_id,
        provider_email = EXCLUDED.provider_email,
        provider_name = EXCLUDED.provider_name,
        provider_data = EXCLUDED.provider_data,
        is_active = true,
        last_used_at = NOW(),
        updated_at = NOW()
    RETURNING id INTO social_account_id;

    -- employees 테이블에도 주 소셜 정보 업데이트 (첫 번째 연동인 경우)
    UPDATE employees
    SET
        provider = p_provider,
        provider_id = p_provider_id,
        avatar_url = COALESCE(avatar_url, p_provider_data->>'picture', p_provider_data->>'avatar_url'),
        last_login_at = NOW(),
        updated_at = NOW()
    WHERE id = p_user_id AND provider = 'system';

    RETURN social_account_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 소셜 계정 해제 함수
CREATE OR REPLACE FUNCTION unlink_social_account(
    p_user_id UUID,
    p_provider VARCHAR(20)
)
RETURNS BOOLEAN AS $$
DECLARE
    remaining_accounts INTEGER;
BEGIN
    -- 소셜 계정 비활성화
    UPDATE social_accounts
    SET is_active = false, updated_at = NOW()
    WHERE user_id = p_user_id AND provider = p_provider;

    -- 남은 활성 소셜 계정 수 확인
    SELECT COUNT(*) INTO remaining_accounts
    FROM social_accounts
    WHERE user_id = p_user_id AND is_active = true;

    -- 남은 소셜 계정이 없고 비밀번호도 없으면 경고
    IF remaining_accounts = 0 THEN
        DECLARE
            has_password BOOLEAN;
        BEGIN
            SELECT (password_hash IS NOT NULL) INTO has_password
            FROM employees WHERE id = p_user_id;

            IF NOT has_password THEN
                RAISE WARNING '사용자 %의 모든 소셜 계정이 해제되었으며 비밀번호도 설정되지 않았습니다.', p_user_id;
            END IF;
        END;
    END IF;

    RETURN true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 사용자 로그인 이력 업데이트 함수
CREATE OR REPLACE FUNCTION update_user_login(
    p_user_id UUID,
    p_login_method VARCHAR(20) DEFAULT 'password',
    p_device_info JSONB DEFAULT '{}',
    p_ip_address INET DEFAULT NULL,
    p_user_agent TEXT DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
    session_id UUID;
BEGIN
    -- employees 테이블 last_login_at 업데이트
    UPDATE employees
    SET last_login_at = NOW(), updated_at = NOW()
    WHERE id = p_user_id;

    -- 확장 세션 기록 생성 (JWT와 별도로 로그인 이력 관리)
    INSERT INTO user_sessions_extended (
        user_id, session_token, login_method, expires_at,
        device_info, ip_address, user_agent
    ) VALUES (
        p_user_id,
        'history_' || gen_random_uuid()::text,  -- 이력용 더미 토큰
        p_login_method,
        NOW() + INTERVAL '24 hours',
        p_device_info,
        p_ip_address,
        p_user_agent
    )
    RETURNING id INTO session_id;

    -- 소셜 로그인인 경우 last_used_at 업데이트
    IF p_login_method IN ('kakao', 'naver', 'google') THEN
        UPDATE social_accounts
        SET last_used_at = NOW(), updated_at = NOW()
        WHERE user_id = p_user_id AND provider = p_login_method AND is_active = true;
    END IF;

    RETURN session_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

RAISE NOTICE '✓ 유틸리티 함수 생성 완료';

-- 11. 편의 뷰 생성
-- 통합 사용자 프로필 뷰
CREATE OR REPLACE VIEW user_profile_view AS
SELECT
    e.id,
    e.employee_id,
    e.name,
    e.email,
    e.permission_level,
    e.department,
    e.team,
    e.position,
    e.phone,
    e.mobile,
    e.is_active,
    e.provider as primary_provider,
    e.provider_id as primary_provider_id,
    e.avatar_url,
    e.last_login_at,
    e.email_verified_at,
    e.created_at,
    e.updated_at,

    -- 연동된 소셜 계정 정보 (JSON 배열)
    COALESCE(
        JSON_AGG(
            JSON_BUILD_OBJECT(
                'provider', sa.provider,
                'provider_email', sa.provider_email,
                'provider_name', sa.provider_name,
                'linked_at', sa.linked_at,
                'last_used_at', sa.last_used_at,
                'is_active', sa.is_active
            )
        ) FILTER (WHERE sa.id IS NOT NULL),
        '[]'::json
    ) as social_accounts,

    -- 최근 로그인 정보
    (
        SELECT JSON_BUILD_OBJECT(
            'login_method', ses.login_method,
            'device_info', ses.device_info,
            'ip_address', ses.ip_address,
            'created_at', ses.created_at
        )
        FROM user_sessions_extended ses
        WHERE ses.user_id = e.id
        ORDER BY ses.created_at DESC
        LIMIT 1
    ) as last_session

FROM employees e
LEFT JOIN social_accounts sa ON e.id = sa.user_id
GROUP BY e.id;

RAISE NOTICE '✓ 편의 뷰 생성 완료';

-- 12. 데이터 검증
-- 마이그레이션 결과 검증
DO $$
DECLARE
    total_employees INTEGER;
    system_users INTEGER;
    social_accounts INTEGER;
BEGIN
    SELECT COUNT(*) INTO total_employees FROM employees;
    SELECT COUNT(*) INTO system_users FROM employees WHERE provider = 'system';
    SELECT COUNT(*) INTO social_accounts FROM social_accounts;

    RAISE NOTICE '=== Phase 1 마이그레이션 완료 ===';
    RAISE NOTICE '전체 사용자: %명', total_employees;
    RAISE NOTICE 'System 사용자: %명', system_users;
    RAISE NOTICE '소셜 계정 연동: %건', social_accounts;
    RAISE NOTICE '완료 시간: %', NOW();
END $$;

-- 13. 테이블 코멘트 추가
COMMENT ON TABLE social_accounts IS 'Phase 1: 소셜 로그인 계정 연동 관리 테이블';
COMMENT ON TABLE user_sessions_extended IS 'Phase 1: 확장된 사용자 세션 및 로그인 이력 관리';

COMMENT ON COLUMN employees.provider IS 'Phase 1: 주 로그인 프로바이더 (system, kakao, naver, google)';
COMMENT ON COLUMN employees.provider_id IS 'Phase 1: 프로바이더별 사용자 ID';
COMMENT ON COLUMN employees.avatar_url IS 'Phase 1: 사용자 아바타 이미지 URL';
COMMENT ON COLUMN employees.last_login_at IS 'Phase 1: 최종 로그인 시간';
COMMENT ON COLUMN employees.email_verified_at IS 'Phase 1: 이메일 인증 완료 시간';

-- 14. 권한 확인 (Supabase 환경에서는 자동 적용)
-- 필요시 특정 역할에 대한 권한 부여
-- GRANT ALL ON social_accounts TO authenticated;
-- GRANT ALL ON user_sessions_extended TO authenticated;

RAISE NOTICE '🎉 Phase 1 소셜 로그인 마이그레이션이 성공적으로 완료되었습니다!';
RAISE NOTICE '다음 단계: Phase 2 협업 시스템 마이그레이션을 진행하세요.';