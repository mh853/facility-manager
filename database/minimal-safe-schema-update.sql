-- 최소한의 안전한 employees 테이블 스키마 업데이트
-- updated_at 컬럼 없이 작동하는 버전

-- 1. password_hash 컬럼 추가 (가장 중요)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'employees' AND column_name = 'password_hash'
    ) THEN
        ALTER TABLE employees ADD COLUMN password_hash VARCHAR(255);
        RAISE NOTICE '✅ password_hash 컬럼 추가됨';
    ELSE
        RAISE NOTICE '✅ password_hash 컬럼 이미 존재함';
    END IF;
END $$;

-- 2. signup_method 컬럼 추가
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'employees' AND column_name = 'signup_method'
    ) THEN
        ALTER TABLE employees ADD COLUMN signup_method VARCHAR(20) DEFAULT 'direct';
        RAISE NOTICE '✅ signup_method 컬럼 추가됨';
    ELSE
        RAISE NOTICE '✅ signup_method 컬럼 이미 존재함';
    END IF;
END $$;

-- 3. provider 컬럼 추가
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'employees' AND column_name = 'provider'
    ) THEN
        ALTER TABLE employees ADD COLUMN provider VARCHAR(20);
        RAISE NOTICE '✅ provider 컬럼 추가됨';
    ELSE
        RAISE NOTICE '✅ provider 컬럼 이미 존재함';
    END IF;
END $$;

-- 4. is_deleted 컬럼 추가 (소프트 삭제용)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'employees' AND column_name = 'is_deleted'
    ) THEN
        ALTER TABLE employees ADD COLUMN is_deleted BOOLEAN DEFAULT false;
        RAISE NOTICE '✅ is_deleted 컬럼 추가됨';
    ELSE
        RAISE NOTICE '✅ is_deleted 컬럼 이미 존재함';
    END IF;
END $$;

-- 5. updated_at 컬럼 추가 (있으면 좋지만 없어도 작동)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'employees' AND column_name = 'updated_at'
    ) THEN
        ALTER TABLE employees ADD COLUMN updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();
        RAISE NOTICE '✅ updated_at 컬럼 추가됨';
    ELSE
        RAISE NOTICE '✅ updated_at 컬럼 이미 존재함';
    END IF;
END $$;

-- 6. 약관 동의 관련 컬럼들 (선택사항)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'employees' AND column_name = 'terms_agreed_at'
    ) THEN
        ALTER TABLE employees ADD COLUMN terms_agreed_at TIMESTAMP WITH TIME ZONE;
        RAISE NOTICE '✅ terms_agreed_at 컬럼 추가됨';
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'employees' AND column_name = 'privacy_agreed_at'
    ) THEN
        ALTER TABLE employees ADD COLUMN privacy_agreed_at TIMESTAMP WITH TIME ZONE;
        RAISE NOTICE '✅ privacy_agreed_at 컬럼 추가됨';
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'employees' AND column_name = 'personal_info_agreed_at'
    ) THEN
        ALTER TABLE employees ADD COLUMN personal_info_agreed_at TIMESTAMP WITH TIME ZONE;
        RAISE NOTICE '✅ personal_info_agreed_at 컬럼 추가됨';
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'employees' AND column_name = 'marketing_agreed_at'
    ) THEN
        ALTER TABLE employees ADD COLUMN marketing_agreed_at TIMESTAMP WITH TIME ZONE;
        RAISE NOTICE '✅ marketing_agreed_at 컬럼 추가됨';
    END IF;
END $$;

-- 7. 제약조건 추가 (이미 존재하면 무시)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE table_name = 'employees' AND constraint_name = 'check_signup_method'
    ) THEN
        ALTER TABLE employees ADD CONSTRAINT check_signup_method
        CHECK (signup_method IN ('direct', 'kakao', 'naver', 'google', 'social+direct'));
        RAISE NOTICE '✅ signup_method 제약조건 추가됨';
    END IF;
EXCEPTION
    WHEN OTHERS THEN
        RAISE NOTICE '⚠️ signup_method 제약조건 추가 실패 (이미 존재하거나 다른 이유)';
END $$;

-- 8. 기본 인덱스 추가
CREATE INDEX IF NOT EXISTS idx_employees_email_active
ON employees(email) WHERE is_deleted = false;

CREATE INDEX IF NOT EXISTS idx_employees_signup_method
ON employees(signup_method);

-- 9. munong2@gmail.com 계정 기본 설정 (updated_at 없이)
DO $$
DECLARE
    has_updated_at BOOLEAN;
BEGIN
    -- updated_at 컬럼 존재 여부 확인
    SELECT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'employees' AND column_name = 'updated_at'
    ) INTO has_updated_at;

    -- 계정 기본 정보 설정
    IF has_updated_at THEN
        -- updated_at 컬럼이 있는 경우
        UPDATE employees
        SET
            provider = 'kakao',
            signup_method = 'kakao',
            is_active = true,
            updated_at = NOW()
        WHERE email = 'munong2@gmail.com'
        AND (provider IS NULL OR provider = '');
        RAISE NOTICE '✅ munong2@gmail.com 계정 업데이트 (updated_at 포함)';
    ELSE
        -- updated_at 컬럼이 없는 경우
        UPDATE employees
        SET
            provider = 'kakao',
            signup_method = 'kakao',
            is_active = true
        WHERE email = 'munong2@gmail.com'
        AND (provider IS NULL OR provider = '');
        RAISE NOTICE '✅ munong2@gmail.com 계정 업데이트 (updated_at 제외)';
    END IF;
END $$;

-- 10. 최종 스키마 확인
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
    ) THEN '✅ 존재함' ELSE '❌ 없음' END as status
UNION ALL
SELECT
    'terms_agreed_at' as column_name,
    CASE WHEN EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'employees' AND column_name = 'terms_agreed_at'
    ) THEN '✅ 존재함' ELSE '❌ 없음' END as status
UNION ALL
SELECT
    'privacy_agreed_at' as column_name,
    CASE WHEN EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'employees' AND column_name = 'privacy_agreed_at'
    ) THEN '✅ 존재함' ELSE '❌ 없음' END as status
UNION ALL
SELECT
    'personal_info_agreed_at' as column_name,
    CASE WHEN EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'employees' AND column_name = 'personal_info_agreed_at'
    ) THEN '✅ 존재함' ELSE '❌ 없음' END as status
UNION ALL
SELECT
    'marketing_agreed_at' as column_name,
    CASE WHEN EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'employees' AND column_name = 'marketing_agreed_at'
    ) THEN '✅ 존재함' ELSE '❌ 없음' END as status;

-- 11. munong2@gmail.com 계정 현재 상태 확인
SELECT
    email,
    name,
    is_active,
    provider,
    signup_method,
    CASE WHEN password_hash IS NULL THEN '❌ 비밀번호 없음' ELSE '✅ 비밀번호 있음' END as password_status
FROM employees
WHERE email = 'munong2@gmail.com';