-- ===============================================
-- 4단계: 설정 관리를 위한 settings 테이블 생성
-- 지연/위험 업무 기준 등 시스템 설정 저장
-- ===============================================

-- 1. settings 테이블 생성
CREATE TABLE IF NOT EXISTS settings (
    id SERIAL PRIMARY KEY,
    key VARCHAR(255) UNIQUE NOT NULL,
    value TEXT NOT NULL,
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. 인덱스 생성
CREATE UNIQUE INDEX IF NOT EXISTS idx_settings_key ON settings(key);
CREATE INDEX IF NOT EXISTS idx_settings_updated_at ON settings(updated_at);

-- 3. 업데이트 트리거 함수 생성
CREATE OR REPLACE FUNCTION update_settings_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 4. 업데이트 트리거 생성
CREATE TRIGGER trigger_update_settings_updated_at
    BEFORE UPDATE ON settings
    FOR EACH ROW
    EXECUTE FUNCTION update_settings_updated_at();

-- 5. 테이블 설명 추가
COMMENT ON TABLE settings IS '시스템 설정 저장 테이블';
COMMENT ON COLUMN settings.key IS '설정 키 (고유값)';
COMMENT ON COLUMN settings.value IS '설정 값 (JSON 문자열 가능)';
COMMENT ON COLUMN settings.description IS '설정 설명';

-- 6. 기본 지연/위험 기준 설정 삽입
INSERT INTO settings (key, value, description) VALUES (
    'delay_criteria',
    '{"self":{"delayed":7,"risky":14},"subsidy":{"delayed":14,"risky":20},"as":{"delayed":3,"risky":7},"etc":{"delayed":7,"risky":10}}',
    '업무 타입별 지연/위험 업무 판단 기준 (단위: 일)'
) ON CONFLICT (key) DO NOTHING;

-- 완료 메시지
SELECT
    'settings 테이블이 성공적으로 생성되었습니다!' as message,
    count(*) as total_settings
FROM settings;