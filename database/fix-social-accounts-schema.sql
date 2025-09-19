-- social_accounts 테이블에 누락된 access_token 컬럼 추가
-- 카카오 로그인 연동 수정을 위한 스키마 업데이트

-- 1. access_token 컬럼 추가 (토큰 저장용)
ALTER TABLE IF EXISTS social_accounts
ADD COLUMN IF NOT EXISTS access_token TEXT;

-- 2. refresh_token 컬럼 추가 (토큰 갱신용)
ALTER TABLE IF EXISTS social_accounts
ADD COLUMN IF NOT EXISTS refresh_token TEXT;

-- 3. token_expires_at 컬럼 추가 (토큰 만료 시간)
ALTER TABLE IF EXISTS social_accounts
ADD COLUMN IF NOT EXISTS token_expires_at TIMESTAMP WITH TIME ZONE;

-- 4. provider_picture_url 컬럼 추가 (프로필 이미지 URL)
ALTER TABLE IF EXISTS social_accounts
ADD COLUMN IF NOT EXISTS provider_picture_url TEXT;

-- 5. is_primary 컬럼 추가 (주 소셜 계정 여부)
ALTER TABLE IF EXISTS social_accounts
ADD COLUMN IF NOT EXISTS is_primary BOOLEAN DEFAULT false;

-- 6. last_login_at 컬럼 추가 (마지막 로그인 시간)
ALTER TABLE IF EXISTS social_accounts
ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();

-- 인덱스 추가 (성능 최적화)
CREATE INDEX IF NOT EXISTS idx_social_accounts_user_id ON social_accounts(user_id);
CREATE INDEX IF NOT EXISTS idx_social_accounts_provider ON social_accounts(provider, provider_id);
CREATE INDEX IF NOT EXISTS idx_social_accounts_active ON social_accounts(is_active) WHERE is_active = true;

-- 기존 데이터 정리 (중복 제거)
-- 같은 사용자의 같은 프로바이더 계정이 여러 개 있을 경우 최신 것만 유지
WITH ranked_accounts AS (
  SELECT
    id,
    ROW_NUMBER() OVER (PARTITION BY user_id, provider ORDER BY created_at DESC) as rn
  FROM social_accounts
)
DELETE FROM social_accounts
WHERE id IN (
  SELECT id FROM ranked_accounts WHERE rn > 1
);

-- 새 제약조건 적용
ALTER TABLE social_accounts
ADD CONSTRAINT unique_user_provider_active
UNIQUE (user_id, provider)
DEFERRABLE INITIALLY DEFERRED;

COMMENT ON TABLE social_accounts IS '소셜 계정 연동 정보 - 카카오, 네이버, 구글 등';
COMMENT ON COLUMN social_accounts.access_token IS '소셜 프로바이더 액세스 토큰';
COMMENT ON COLUMN social_accounts.refresh_token IS '소셜 프로바이더 리프레시 토큰';
COMMENT ON COLUMN social_accounts.is_primary IS '주 소셜 계정 여부 (사용자당 하나만 true)';