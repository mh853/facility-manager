-- 안전한 employees 테이블 비밀번호 스키마 업데이트
-- 기존 컬럼 존재 여부를 확인하고 안전하게 추가

-- 1. password_hash 컬럼 추가 (안전한 방식)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'employees' AND column_name = 'password_hash'
    ) THEN
        ALTER TABLE employees ADD COLUMN password_hash VARCHAR(255);
    END IF;
END $$;

-- 2. signup_method 컬럼 추가 (안전한 방식)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'employees' AND column_name = 'signup_method'
    ) THEN
        ALTER TABLE employees ADD COLUMN signup_method VARCHAR(20) DEFAULT 'direct';
        ALTER TABLE employees ADD CONSTRAINT check_signup_method
        CHECK (signup_method IN ('direct', 'kakao', 'naver', 'google', 'social+direct'));
    END IF;
END $$;

-- 3. provider 컬럼 추가 (안전한 방식)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'employees' AND column_name = 'provider'
    ) THEN
        ALTER TABLE employees ADD COLUMN provider VARCHAR(20);
        ALTER TABLE employees ADD CONSTRAINT check_provider
        CHECK (provider IN ('kakao', 'naver', 'google', 'system') OR provider IS NULL);
    END IF;
END $$;

-- 4. 약관 동의 관련 컬럼들 추가
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'employees' AND column_name = 'terms_agreed_at'
    ) THEN
        ALTER TABLE employees ADD COLUMN terms_agreed_at TIMESTAMP WITH TIME ZONE;
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'employees' AND column_name = 'privacy_agreed_at'
    ) THEN
        ALTER TABLE employees ADD COLUMN privacy_agreed_at TIMESTAMP WITH TIME ZONE;
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'employees' AND column_name = 'personal_info_agreed_at'
    ) THEN
        ALTER TABLE employees ADD COLUMN personal_info_agreed_at TIMESTAMP WITH TIME ZONE;
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'employees' AND column_name = 'marketing_agreed_at'
    ) THEN
        ALTER TABLE employees ADD COLUMN marketing_agreed_at TIMESTAMP WITH TIME ZONE;
    END IF;
END $$;

-- 5. is_deleted 컬럼 추가 (소프트 삭제)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'employees' AND column_name = 'is_deleted'
    ) THEN
        ALTER TABLE employees ADD COLUMN is_deleted BOOLEAN DEFAULT false;
    END IF;
END $$;

-- 6. 인덱스 추가 (중복 생성 방지)
CREATE INDEX IF NOT EXISTS idx_employees_email_active ON employees(email) WHERE is_deleted = false;
CREATE INDEX IF NOT EXISTS idx_employees_signup_method ON employees(signup_method);
CREATE INDEX IF NOT EXISTS idx_employees_is_deleted ON employees(is_deleted);
CREATE INDEX IF NOT EXISTS idx_employees_provider ON employees(provider) WHERE provider IS NOT NULL;

-- 7. 기존 데이터 정리 (안전한 방식)
-- munong2@gmail.com 계정을 카카오 계정으로 설정 (provider 컬럼이 있는 경우에만)
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'employees' AND column_name = 'provider'
    ) THEN
        UPDATE employees
        SET
            provider = 'kakao',
            signup_method = 'kakao',
            is_active = true,
            updated_at = NOW()
        WHERE email = 'munong2@gmail.com'
        AND provider IS NULL;
    END IF;
END $$;

-- 8. 컬럼 코멘트 추가
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'employees' AND column_name = 'password_hash'
    ) THEN
        COMMENT ON COLUMN employees.password_hash IS '비밀번호 해시 (bcrypt) - 소셜 계정의 경우 NULL';
    END IF;

    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'employees' AND column_name = 'signup_method'
    ) THEN
        COMMENT ON COLUMN employees.signup_method IS '가입 방법: direct(이메일), kakao/naver/google(소셜), social+direct(하이브리드)';
    END IF;
END $$;

-- 9. 스키마 업데이트 완료 확인
SELECT
    'password_hash' as column_name,
    CASE WHEN EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'employees' AND column_name = 'password_hash'
    ) THEN '✅ 존재함' ELSE '❌ 없음' END as status
UNION ALL
SELECT
    'signup_method' as column_name,
    CASE WHEN EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'employees' AND column_name = 'signup_method'
    ) THEN '✅ 존재함' ELSE '❌ 없음' END as status
UNION ALL
SELECT
    'provider' as column_name,
    CASE WHEN EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'employees' AND column_name = 'provider'
    ) THEN '✅ 존재함' ELSE '❌ 없음' END as status
UNION ALL
SELECT
    'is_deleted' as column_name,
    CASE WHEN EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'employees' AND column_name = 'is_deleted'
    ) THEN '✅ 존재함' ELSE '❌ 없음' END as status;