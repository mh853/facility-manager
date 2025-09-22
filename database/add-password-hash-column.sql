-- employees 테이블에 password_hash 컬럼 추가
-- 소셜 계정의 이메일 로그인 전환을 위한 스키마 업데이트

-- 1. password_hash 컬럼 추가
ALTER TABLE employees ADD COLUMN IF NOT EXISTS
    password_hash VARCHAR(255);

-- 2. signup_method 컬럼 추가 (가입 방법 구분)
ALTER TABLE employees ADD COLUMN IF NOT EXISTS
    signup_method VARCHAR(20) DEFAULT 'direct' CHECK (signup_method IN ('direct', 'kakao', 'naver', 'google', 'social+direct'));

-- 3. 약관 동의 관련 컬럼들 추가
ALTER TABLE employees ADD COLUMN IF NOT EXISTS
    terms_agreed_at TIMESTAMP WITH TIME ZONE;

ALTER TABLE employees ADD COLUMN IF NOT EXISTS
    privacy_agreed_at TIMESTAMP WITH TIME ZONE;

ALTER TABLE employees ADD COLUMN IF NOT EXISTS
    personal_info_agreed_at TIMESTAMP WITH TIME ZONE;

ALTER TABLE employees ADD COLUMN IF NOT EXISTS
    marketing_agreed_at TIMESTAMP WITH TIME ZONE;

-- 4. is_deleted 컬럼 추가 (소프트 삭제)
ALTER TABLE employees ADD COLUMN IF NOT EXISTS
    is_deleted BOOLEAN DEFAULT false;

-- 5. 인덱스 추가
CREATE INDEX IF NOT EXISTS idx_employees_email ON employees(email) WHERE is_deleted = false;
CREATE INDEX IF NOT EXISTS idx_employees_signup_method ON employees(signup_method);
CREATE INDEX IF NOT EXISTS idx_employees_is_deleted ON employees(is_deleted);

-- 6. 기존 데이터 정리 - provider가 있는 경우 signup_method 업데이트
UPDATE employees
SET signup_method = provider
WHERE provider IS NOT NULL AND signup_method = 'direct';

-- 7. munong2@gmail.com 계정을 카카오 로그인 계정으로 설정 (예시)
UPDATE employees
SET
    provider = 'kakao',
    signup_method = 'kakao',
    is_active = true
WHERE email = 'munong2@gmail.com' AND provider IS NULL;

-- 8. 코멘트 추가
COMMENT ON COLUMN employees.password_hash IS '비밀번호 해시 (bcrypt) - 소셜 계정의 경우 NULL';
COMMENT ON COLUMN employees.signup_method IS '가입 방법: direct(이메일), kakao/naver/google(소셜), social+direct(하이브리드)';
COMMENT ON COLUMN employees.terms_agreed_at IS '서비스 이용약관 동의 시각';
COMMENT ON COLUMN employees.privacy_agreed_at IS '개인정보 처리방침 동의 시각';
COMMENT ON COLUMN employees.personal_info_agreed_at IS '개인정보 수집 및 이용 동의 시각';
COMMENT ON COLUMN employees.marketing_agreed_at IS '마케팅 정보 수신 동의 시각 (선택사항)';
COMMENT ON COLUMN employees.is_deleted IS '소프트 삭제 플래그';