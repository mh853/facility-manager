-- =====================================================
-- 대리점 가격 관리 시스템
-- 목적: 대리점 전용 원가 및 매출 가격 관리
-- =====================================================

BEGIN;

-- 1. 대리점 가격 테이블 생성
CREATE TABLE IF NOT EXISTS dealer_pricing (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    -- 기기 정보
    equipment_type VARCHAR(50) NOT NULL,
    equipment_name VARCHAR(200) NOT NULL,

    -- 가격 정보
    dealer_cost_price INTEGER NOT NULL,           -- 대리점 공급가 (원가)
    dealer_selling_price INTEGER NOT NULL,        -- 대리점 판매가
    margin_rate DECIMAL(5,2),                     -- 마진율 (%)

    -- 제조사 정보 (선택)
    manufacturer VARCHAR(100),

    -- 유효 기간
    effective_from DATE NOT NULL,
    effective_to DATE,

    -- 메모 및 상태
    notes TEXT,
    is_active BOOLEAN DEFAULT true,

    -- 메타데이터
    created_by UUID REFERENCES users(id),
    updated_by UUID REFERENCES users(id)
);

-- 2. 인덱스 생성
CREATE INDEX IF NOT EXISTS idx_dealer_pricing_equipment ON dealer_pricing(equipment_type, equipment_name);
CREATE INDEX IF NOT EXISTS idx_dealer_pricing_active ON dealer_pricing(is_active);
CREATE INDEX IF NOT EXISTS idx_dealer_pricing_effective ON dealer_pricing(effective_from, effective_to);
CREATE INDEX IF NOT EXISTS idx_dealer_pricing_manufacturer ON dealer_pricing(manufacturer);

-- 3. 트리거 함수 (updated_at 자동 업데이트)
CREATE OR REPLACE FUNCTION update_dealer_pricing_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 4. 트리거 생성
DROP TRIGGER IF EXISTS trigger_update_dealer_pricing_updated_at ON dealer_pricing;
CREATE TRIGGER trigger_update_dealer_pricing_updated_at
    BEFORE UPDATE ON dealer_pricing
    FOR EACH ROW
    EXECUTE FUNCTION update_dealer_pricing_updated_at();

-- 5. RLS (Row Level Security) 설정
ALTER TABLE dealer_pricing ENABLE ROW LEVEL SECURITY;

-- 슈퍼 관리자만 조회 가능
CREATE POLICY "Super admins can view dealer pricing" ON dealer_pricing
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM users
            WHERE id::text = auth.uid()::text
            AND role >= 3
            AND is_active = true
        )
    );

-- 슈퍼 관리자만 수정 가능
CREATE POLICY "Super admins can manage dealer pricing" ON dealer_pricing
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM users
            WHERE id::text = auth.uid()::text
            AND role >= 3
            AND is_active = true
        )
    );

-- 6. 코멘트 추가
COMMENT ON TABLE dealer_pricing IS '대리점 전용 가격 관리 테이블';
COMMENT ON COLUMN dealer_pricing.dealer_cost_price IS '대리점 공급가 (원가)';
COMMENT ON COLUMN dealer_pricing.dealer_selling_price IS '대리점 판매가';
COMMENT ON COLUMN dealer_pricing.margin_rate IS '마진율 (%)';
COMMENT ON COLUMN dealer_pricing.effective_from IS '시행일';
COMMENT ON COLUMN dealer_pricing.effective_to IS '종료일';

-- 7. 샘플 데이터 삽입 (테스트용)
INSERT INTO dealer_pricing (
    equipment_type,
    equipment_name,
    dealer_cost_price,
    dealer_selling_price,
    margin_rate,
    manufacturer,
    effective_from,
    is_active
) VALUES
(
    'sensor',
    'PH센서',
    450000,
    550000,
    22.22,
    '에코센스',
    '2025-01-01',
    true
),
(
    'sensor',
    '차압계',
    350000,
    450000,
    28.57,
    '크린어스',
    '2025-01-01',
    true
),
(
    'network',
    '게이트웨이',
    800000,
    1000000,
    25.00,
    '에코센스',
    '2025-01-01',
    true
) ON CONFLICT DO NOTHING;

COMMIT;

-- 8. 확인 쿼리
SELECT
    '✅ 대리점 가격 관리 시스템 생성 완료!' as message,
    (SELECT COUNT(*) FROM dealer_pricing WHERE is_active = true) as active_pricing_count;

-- 대리점 가격 목록 확인
SELECT
    equipment_name as 기기명,
    dealer_cost_price as 공급가,
    dealer_selling_price as 판매가,
    margin_rate as 마진율,
    manufacturer as 제조사,
    effective_from as 시행일,
    is_active as 활성상태
FROM dealer_pricing
WHERE is_active = true
ORDER BY equipment_type, equipment_name;
