-- ===============================================
-- 완전한 social_accounts 테이블 생성 스크립트
-- 기존 테이블이 없거나 구조가 다를 경우를 위한 완전 재생성
-- ===============================================

-- 1. 기존 테이블이 있다면 백업 (데이터 보존)
DO $$
BEGIN
    IF EXISTS (SELECT FROM information_schema.tables
               WHERE table_schema = 'public'
               AND table_name = 'social_accounts') THEN

        -- 기존 데이터 백업
        CREATE TABLE IF NOT EXISTS social_accounts_backup AS
        SELECT * FROM social_accounts;

        RAISE NOTICE '기존 social_accounts 테이블을 social_accounts_backup으로 백업했습니다.';

        -- 기존 테이블 삭제
        DROP TABLE social_accounts CASCADE;

    END IF;
END $$;

-- 2. employees 테이블 존재 확인 및 기본 구조 확인
DO $$
BEGIN
    IF NOT EXISTS (SELECT FROM information_schema.tables
                   WHERE table_schema = 'public'
                   AND table_name = 'employees') THEN
        RAISE EXCEPTION 'employees 테이블이 존재하지 않습니다. 먼저 employees 테이블을 생성해주세요.';
    END IF;
END $$;

-- 3. 새로운 social_accounts 테이블 생성
CREATE TABLE social_accounts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- 사용자 연결 (employees 테이블 참조)
    user_id UUID NOT NULL,

    -- 소셜 프로바이더 정보
    provider VARCHAR(20) NOT NULL CHECK (provider IN ('kakao', 'naver', 'google')),
    provider_id VARCHAR(100) NOT NULL,
    provider_email VARCHAR(255),
    provider_name VARCHAR(100),
    provider_picture_url TEXT,

    -- 토큰 정보
    access_token TEXT,
    refresh_token TEXT,
    token_expires_at TIMESTAMP WITH TIME ZONE,

    -- 연동 상태
    is_active BOOLEAN DEFAULT true,
    is_primary BOOLEAN DEFAULT false,
    linked_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_used_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_login_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    -- 프로바이더별 추가 정보
    provider_data JSONB DEFAULT '{}',

    -- 메타데이터
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    -- 제약조건
    UNIQUE(provider, provider_id),
    UNIQUE(user_id, provider)
);

-- 4. 외래키 제약조건 추가 (employees 테이블 존재 확인 후)
DO $$
BEGIN
    -- employees 테이블의 id 컬럼 존재 확인
    IF EXISTS (SELECT FROM information_schema.columns
               WHERE table_schema = 'public'
               AND table_name = 'employees'
               AND column_name = 'id') THEN

        ALTER TABLE social_accounts
        ADD CONSTRAINT fk_social_accounts_user_id
        FOREIGN KEY (user_id) REFERENCES employees(id) ON DELETE CASCADE;

    ELSE
        RAISE NOTICE 'employees 테이블에 id 컬럼이 없습니다. 외래키 제약조건을 추가하지 않습니다.';
    END IF;
END $$;

-- 5. 인덱스 추가 (성능 최적화)
CREATE INDEX idx_social_accounts_user_id ON social_accounts(user_id);
CREATE INDEX idx_social_accounts_provider ON social_accounts(provider, provider_id);
CREATE INDEX idx_social_accounts_active ON social_accounts(is_active) WHERE is_active = true;
CREATE INDEX idx_social_accounts_primary ON social_accounts(user_id, is_primary) WHERE is_primary = true;

-- 6. 트리거 함수 생성 (updated_at 자동 업데이트)
CREATE OR REPLACE FUNCTION update_social_accounts_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 7. 트리거 생성
CREATE TRIGGER trigger_social_accounts_updated_at
    BEFORE UPDATE ON social_accounts
    FOR EACH ROW
    EXECUTE FUNCTION update_social_accounts_updated_at();

-- 8. RLS (Row Level Security) 정책 설정 (선택사항)
ALTER TABLE social_accounts ENABLE ROW LEVEL SECURITY;

-- 사용자는 자신의 소셜 계정만 조회/수정 가능
CREATE POLICY "Users can view their own social accounts" ON social_accounts
    FOR SELECT USING (auth.uid()::text = user_id::text);

CREATE POLICY "Users can update their own social accounts" ON social_accounts
    FOR UPDATE USING (auth.uid()::text = user_id::text);

CREATE POLICY "Users can insert their own social accounts" ON social_accounts
    FOR INSERT WITH CHECK (auth.uid()::text = user_id::text);

CREATE POLICY "Users can delete their own social accounts" ON social_accounts
    FOR DELETE USING (auth.uid()::text = user_id::text);

-- 9. 백업된 데이터가 있다면 복원 시도
DO $$
BEGIN
    IF EXISTS (SELECT FROM information_schema.tables
               WHERE table_schema = 'public'
               AND table_name = 'social_accounts_backup') THEN

        -- 기존 데이터를 새 구조에 맞게 복원
        INSERT INTO social_accounts (
            user_id, provider, provider_id, provider_email, provider_name,
            is_active, linked_at, created_at
        )
        SELECT
            user_id, provider, provider_id, provider_email, provider_name,
            COALESCE(is_active, true),
            COALESCE(linked_at, NOW()),
            COALESCE(created_at, NOW())
        FROM social_accounts_backup
        WHERE user_id IS NOT NULL
        ON CONFLICT (user_id, provider) DO NOTHING;

        RAISE NOTICE '백업된 데이터를 새 테이블로 복원했습니다.';

    END IF;
END $$;

-- 10. 테이블 설명 추가
COMMENT ON TABLE social_accounts IS '소셜 계정 연동 정보 - 카카오, 네이버, 구글 등의 OAuth 연동 관리';
COMMENT ON COLUMN social_accounts.user_id IS 'employees 테이블의 사용자 ID';
COMMENT ON COLUMN social_accounts.provider IS '소셜 프로바이더 (kakao, naver, google)';
COMMENT ON COLUMN social_accounts.access_token IS '소셜 프로바이더 액세스 토큰';
COMMENT ON COLUMN social_accounts.refresh_token IS '소셜 프로바이더 리프레시 토큰';
COMMENT ON COLUMN social_accounts.is_primary IS '주 소셜 계정 여부 (사용자당 하나만 true)';

-- 완료 메시지
SELECT 'social_accounts 테이블이 성공적으로 생성되었습니다!' as status;