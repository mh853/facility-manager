-- ===============================================
-- 기존 social_accounts 테이블 안전 업데이트
-- 기존 데이터 보존하면서 필요한 컬럼만 추가
-- ===============================================

-- 1. 누락된 컬럼들 추가 (안전하게)
ALTER TABLE social_accounts
ADD COLUMN IF NOT EXISTS user_id UUID;

ALTER TABLE social_accounts
ADD COLUMN IF NOT EXISTS provider_email VARCHAR(255);

ALTER TABLE social_accounts
ADD COLUMN IF NOT EXISTS provider_name VARCHAR(100);

ALTER TABLE social_accounts
ADD COLUMN IF NOT EXISTS access_token TEXT;

ALTER TABLE social_accounts
ADD COLUMN IF NOT EXISTS refresh_token TEXT;

ALTER TABLE social_accounts
ADD COLUMN IF NOT EXISTS token_expires_at TIMESTAMP WITH TIME ZONE;

ALTER TABLE social_accounts
ADD COLUMN IF NOT EXISTS provider_picture_url TEXT;

ALTER TABLE social_accounts
ADD COLUMN IF NOT EXISTS is_primary BOOLEAN DEFAULT false;

ALTER TABLE social_accounts
ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;

ALTER TABLE social_accounts
ADD COLUMN IF NOT EXISTS linked_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();

ALTER TABLE social_accounts
ADD COLUMN IF NOT EXISTS last_used_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();

ALTER TABLE social_accounts
ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();

ALTER TABLE social_accounts
ADD COLUMN IF NOT EXISTS provider_data JSONB DEFAULT '{}';

ALTER TABLE social_accounts
ADD COLUMN IF NOT EXISTS created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();

ALTER TABLE social_accounts
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();

-- 2. 기존 데이터가 있다면 user_id를 provider_user_id에서 복사
UPDATE social_accounts
SET user_id = provider_user_id::UUID
WHERE user_id IS NULL
    AND provider_user_id IS NOT NULL
    AND provider_user_id ~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$';

-- 3. 외래키 제약조건 추가 (안전하게)
DO $$
BEGIN
    -- user_id 컬럼이 NULL이 아닌 경우에만 외래키 제약조건 추가
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE constraint_name = 'fk_social_accounts_user_id'
        AND table_name = 'social_accounts'
    ) THEN
        ALTER TABLE social_accounts
        ADD CONSTRAINT fk_social_accounts_user_id
        FOREIGN KEY (user_id) REFERENCES employees(id) ON DELETE CASCADE;
    END IF;
END $$;

-- 4. 새로운 인덱스 추가 (성능 최적화)
CREATE INDEX IF NOT EXISTS idx_social_accounts_user_id ON social_accounts(user_id);
CREATE INDEX IF NOT EXISTS idx_social_accounts_active ON social_accounts(is_active) WHERE is_active = true;

-- 5. 고유 제약조건 추가 (안전하게)
DO $$
BEGIN
    -- 기존 중복 데이터 정리 후 제약조건 추가
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE constraint_name = 'unique_user_provider'
        AND table_name = 'social_accounts'
    ) THEN
        -- 중복 제거 (최신 것만 유지)
        WITH ranked_accounts AS (
            SELECT id, ROW_NUMBER() OVER (PARTITION BY user_id, provider ORDER BY created_at DESC NULLS LAST, id DESC) as rn
            FROM social_accounts
            WHERE user_id IS NOT NULL
        )
        DELETE FROM social_accounts
        WHERE id IN (SELECT id FROM ranked_accounts WHERE rn > 1);

        -- 제약조건 추가
        ALTER TABLE social_accounts
        ADD CONSTRAINT unique_user_provider UNIQUE (user_id, provider);
    END IF;
END $$;

-- 6. 트리거 추가 (updated_at 자동 업데이트)
CREATE OR REPLACE FUNCTION update_social_accounts_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_social_accounts_updated_at ON social_accounts;
CREATE TRIGGER trigger_social_accounts_updated_at
    BEFORE UPDATE ON social_accounts
    FOR EACH ROW
    EXECUTE FUNCTION update_social_accounts_updated_at();

-- 7. 업데이트 완료 확인
SELECT
    'social_accounts 테이블 업데이트 완료!' as status,
    COUNT(*) as total_records,
    COUNT(CASE WHEN user_id IS NOT NULL THEN 1 END) as records_with_user_id,
    COUNT(CASE WHEN access_token IS NOT NULL THEN 1 END) as records_with_token
FROM social_accounts;