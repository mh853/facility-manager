-- munong2@gmail.com 계정에 비밀번호 설정
-- 비밀번호: 250922
-- bcrypt 해시값 (saltRounds: 12)

-- 1. 먼저 계정 확인
SELECT
    id,
    name,
    email,
    is_active,
    provider,
    signup_method,
    CASE WHEN password_hash IS NULL THEN '❌ 비밀번호 없음' ELSE '✅ 비밀번호 있음' END as password_status
FROM employees
WHERE email = 'munong2@gmail.com';

-- 2. 비밀번호 해시 설정 (250922를 bcrypt로 해시한 값)
-- 실제 bcrypt 해시는 런타임에 생성되어야 하므로, 여기서는 플레이스홀더 사용
-- 실제 업데이트는 Node.js 스크립트로 수행

-- 3. 계정이 존재하는지 확인 후 업데이트 준비
DO $$
DECLARE
    user_exists BOOLEAN;
    user_id UUID;
BEGIN
    SELECT EXISTS(
        SELECT 1 FROM employees WHERE email = 'munong2@gmail.com'
    ) INTO user_exists;

    IF user_exists THEN
        SELECT id INTO user_id FROM employees WHERE email = 'munong2@gmail.com';
        RAISE NOTICE '✅ 사용자 발견: %', user_id;
        RAISE NOTICE '📝 비밀번호 설정을 위해 Node.js 스크립트를 사용하세요';
        RAISE NOTICE '🔧 명령어: node scripts/set-munong2-password.js';
    ELSE
        RAISE NOTICE '❌ munong2@gmail.com 계정을 찾을 수 없습니다';
    END IF;
END $$;