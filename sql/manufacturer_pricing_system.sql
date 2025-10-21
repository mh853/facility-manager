-- 제조사별 원가 관리 시스템 스키마
-- 생성일: 2025-10-20
-- 목적: 제조사별로 다른 원가를 관리하고, 기본 설치비 및 사업장별 추가 설치비 관리

-- ============================================================================
-- 1. 제조사별 원가 테이블 (manufacturer_pricing)
-- ============================================================================
CREATE TABLE IF NOT EXISTS manufacturer_pricing (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    equipment_type VARCHAR(100) NOT NULL, -- business_info 컬럼명 (예: ph_meter)
    equipment_name VARCHAR(100) NOT NULL, -- 한글 기기명 (예: PH센서)
    manufacturer VARCHAR(20) NOT NULL CHECK (manufacturer IN ('ecosense', 'cleanearth', 'gaia_cns', 'evs')),
    cost_price DECIMAL(12,2) NOT NULL, -- 제조사별 원가
    effective_from DATE NOT NULL, -- 가격 적용 시작일
    effective_to DATE NULL, -- 가격 적용 종료일 (NULL이면 현재 적용 중)

    -- 메타데이터
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    created_by UUID REFERENCES employees(id),
    is_active BOOLEAN DEFAULT TRUE,
    notes TEXT, -- 가격 변경 사유 등 메모

    -- 제조사 × 기기 × 적용일 조합은 고유
    UNIQUE(equipment_type, manufacturer, effective_from)
);

-- ============================================================================
-- 2. 기기별 기본 설치비 테이블 (equipment_installation_cost)
-- ============================================================================
CREATE TABLE IF NOT EXISTS equipment_installation_cost (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    equipment_type VARCHAR(100) NOT NULL, -- business_info 컬럼명
    equipment_name VARCHAR(100) NOT NULL, -- 한글 기기명
    base_installation_cost DECIMAL(10,2) NOT NULL DEFAULT 0, -- 기본 설치비
    effective_from DATE NOT NULL,
    effective_to DATE NULL,

    -- 메타데이터
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    created_by UUID REFERENCES employees(id),
    is_active BOOLEAN DEFAULT TRUE,
    notes TEXT,

    UNIQUE(equipment_type, effective_from)
);

-- ============================================================================
-- 3. 사업장별 추가 설치비 테이블 (business_additional_installation_cost)
-- ============================================================================
CREATE TABLE IF NOT EXISTS business_additional_installation_cost (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    business_id UUID REFERENCES business_info(id) ON DELETE CASCADE,
    business_name VARCHAR(255), -- 조회 성능을 위한 비정규화
    equipment_type VARCHAR(100), -- 특정 기기에만 추가비용이 있는 경우 (NULL이면 전체 기기 공통)
    additional_cost DECIMAL(10,2) NOT NULL, -- 추가 설치비 (양수/음수 모두 가능)
    reason TEXT NOT NULL, -- 추가비용 발생 사유 (필수)
    applied_date DATE NOT NULL, -- 적용 시작일

    -- 메타데이터
    created_at TIMESTAMP DEFAULT NOW(),
    created_by UUID REFERENCES employees(id),
    is_active BOOLEAN DEFAULT TRUE
);

-- ============================================================================
-- 4. 인덱스 생성
-- ============================================================================

-- manufacturer_pricing 인덱스
CREATE INDEX IF NOT EXISTS idx_manufacturer_pricing_equipment ON manufacturer_pricing(equipment_type);
CREATE INDEX IF NOT EXISTS idx_manufacturer_pricing_manufacturer ON manufacturer_pricing(manufacturer);
CREATE INDEX IF NOT EXISTS idx_manufacturer_pricing_active ON manufacturer_pricing(is_active);
CREATE INDEX IF NOT EXISTS idx_manufacturer_pricing_effective ON manufacturer_pricing(effective_from, effective_to);
CREATE INDEX IF NOT EXISTS idx_manufacturer_pricing_composite ON manufacturer_pricing(equipment_type, manufacturer, is_active);

-- equipment_installation_cost 인덱스
CREATE INDEX IF NOT EXISTS idx_equipment_installation_equipment ON equipment_installation_cost(equipment_type);
CREATE INDEX IF NOT EXISTS idx_equipment_installation_active ON equipment_installation_cost(is_active);
CREATE INDEX IF NOT EXISTS idx_equipment_installation_effective ON equipment_installation_cost(effective_from, effective_to);

-- business_additional_installation_cost 인덱스
CREATE INDEX IF NOT EXISTS idx_business_additional_business ON business_additional_installation_cost(business_id);
CREATE INDEX IF NOT EXISTS idx_business_additional_equipment ON business_additional_installation_cost(equipment_type);
CREATE INDEX IF NOT EXISTS idx_business_additional_active ON business_additional_installation_cost(is_active);
CREATE INDEX IF NOT EXISTS idx_business_additional_date ON business_additional_installation_cost(applied_date);

-- ============================================================================
-- 5. 트리거: 자동 updated_at 갱신
-- ============================================================================
CREATE OR REPLACE FUNCTION update_manufacturer_pricing_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER trigger_manufacturer_pricing_updated_at
    BEFORE UPDATE ON manufacturer_pricing
    FOR EACH ROW EXECUTE FUNCTION update_manufacturer_pricing_updated_at();

CREATE TRIGGER trigger_equipment_installation_cost_updated_at
    BEFORE UPDATE ON equipment_installation_cost
    FOR EACH ROW EXECUTE FUNCTION update_revenue_updated_at();

-- ============================================================================
-- 6. RLS (Row Level Security) 설정
-- ============================================================================
ALTER TABLE manufacturer_pricing ENABLE ROW LEVEL SECURITY;
ALTER TABLE equipment_installation_cost ENABLE ROW LEVEL SECURITY;
ALTER TABLE business_additional_installation_cost ENABLE ROW LEVEL SECURITY;

-- 권한 3 이상만 원가 조회/관리 가능
CREATE POLICY "manufacturer_pricing_policy" ON manufacturer_pricing
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM employees
            WHERE employees.id = auth.uid()
            AND employees.permission_level >= 3
            AND employees.is_active = true
            AND employees.is_deleted = false
        )
    );

CREATE POLICY "equipment_installation_cost_policy" ON equipment_installation_cost
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM employees
            WHERE employees.id = auth.uid()
            AND employees.permission_level >= 3
            AND employees.is_active = true
            AND employees.is_deleted = false
        )
    );

-- 권한 2 이상은 조회 가능, 권한 3 이상은 수정 가능
CREATE POLICY "business_additional_cost_view_policy" ON business_additional_installation_cost
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM employees
            WHERE employees.id = auth.uid()
            AND employees.permission_level >= 2
            AND employees.is_active = true
            AND employees.is_deleted = false
        )
    );

CREATE POLICY "business_additional_cost_modify_policy" ON business_additional_installation_cost
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM employees
            WHERE employees.id = auth.uid()
            AND employees.permission_level >= 3
            AND employees.is_active = true
            AND employees.is_deleted = false
        )
    );

-- ============================================================================
-- 7. 테이블 주석 추가
-- ============================================================================
COMMENT ON TABLE manufacturer_pricing IS '제조사별 기기 원가 관리 테이블';
COMMENT ON TABLE equipment_installation_cost IS '기기별 기본 설치비 관리 테이블';
COMMENT ON TABLE business_additional_installation_cost IS '사업장별 추가 설치비 관리 테이블';

COMMENT ON COLUMN manufacturer_pricing.equipment_type IS 'business_info 테이블의 컬럼명과 매핑';
COMMENT ON COLUMN manufacturer_pricing.manufacturer IS '제조사: ecosense, cleanearth, gaia_cns, evs';
COMMENT ON COLUMN manufacturer_pricing.cost_price IS '제조사가 제공하는 실제 원가';

COMMENT ON COLUMN equipment_installation_cost.base_installation_cost IS '기기마다 정해진 기본 설치비';

COMMENT ON COLUMN business_additional_installation_cost.equipment_type IS 'NULL이면 모든 기기에 공통 적용, 값이 있으면 특정 기기에만 적용';
COMMENT ON COLUMN business_additional_installation_cost.additional_cost IS '추가 설치비 (양수: 추가 비용, 음수: 할인)';
COMMENT ON COLUMN business_additional_installation_cost.reason IS '추가비용 발생 사유 (예: 고층 건물, 접근 어려움, 특수 환경 등)';

-- ============================================================================
-- 8. 초기 데이터 삽입 - 제조사별 원가 (예시)
-- ============================================================================
-- ecosense 제조사 원가
INSERT INTO manufacturer_pricing (equipment_type, equipment_name, manufacturer, cost_price, effective_from, created_by) VALUES
('ph_meter', 'PH센서', 'ecosense', 800000, '2025-01-01', (SELECT id FROM employees WHERE permission_level = 4 LIMIT 1)),
('differential_pressure_meter', '차압계', 'ecosense', 320000, '2025-01-01', (SELECT id FROM employees WHERE permission_level = 4 LIMIT 1)),
('temperature_meter', '온도계', 'ecosense', 400000, '2025-01-01', (SELECT id FROM employees WHERE permission_level = 4 LIMIT 1)),
('discharge_current_meter', '배출전류계', 'ecosense', 240000, '2025-01-01', (SELECT id FROM employees WHERE permission_level = 4 LIMIT 1)),
('fan_current_meter', '송풍전류계', 'ecosense', 240000, '2025-01-01', (SELECT id FROM employees WHERE permission_level = 4 LIMIT 1)),
('pump_current_meter', '펌프전류계', 'ecosense', 240000, '2025-01-01', (SELECT id FROM employees WHERE permission_level = 4 LIMIT 1)),
('gateway', '게이트웨이', 'ecosense', 1280000, '2025-01-01', (SELECT id FROM employees WHERE permission_level = 4 LIMIT 1)),
('vpn_wired', 'VPN(유선)', 'ecosense', 320000, '2025-01-01', (SELECT id FROM employees WHERE permission_level = 4 LIMIT 1)),
('vpn_wireless', 'VPN(무선)', 'ecosense', 320000, '2025-01-01', (SELECT id FROM employees WHERE permission_level = 4 LIMIT 1))
ON CONFLICT (equipment_type, manufacturer, effective_from) DO NOTHING;

-- cleanearth 제조사 원가 (ecosense보다 약간 높음)
INSERT INTO manufacturer_pricing (equipment_type, equipment_name, manufacturer, cost_price, effective_from, created_by) VALUES
('ph_meter', 'PH센서', 'cleanearth', 850000, '2025-01-01', (SELECT id FROM employees WHERE permission_level = 4 LIMIT 1)),
('differential_pressure_meter', '차압계', 'cleanearth', 340000, '2025-01-01', (SELECT id FROM employees WHERE permission_level = 4 LIMIT 1)),
('temperature_meter', '온도계', 'cleanearth', 420000, '2025-01-01', (SELECT id FROM employees WHERE permission_level = 4 LIMIT 1)),
('discharge_current_meter', '배출전류계', 'cleanearth', 260000, '2025-01-01', (SELECT id FROM employees WHERE permission_level = 4 LIMIT 1)),
('fan_current_meter', '송풍전류계', 'cleanearth', 260000, '2025-01-01', (SELECT id FROM employees WHERE permission_level = 4 LIMIT 1)),
('pump_current_meter', '펌프전류계', 'cleanearth', 260000, '2025-01-01', (SELECT id FROM employees WHERE permission_level = 4 LIMIT 1)),
('gateway', '게이트웨이', 'cleanearth', 1350000, '2025-01-01', (SELECT id FROM employees WHERE permission_level = 4 LIMIT 1)),
('vpn_wired', 'VPN(유선)', 'cleanearth', 340000, '2025-01-01', (SELECT id FROM employees WHERE permission_level = 4 LIMIT 1)),
('vpn_wireless', 'VPN(무선)', 'cleanearth', 340000, '2025-01-01', (SELECT id FROM employees WHERE permission_level = 4 LIMIT 1))
ON CONFLICT (equipment_type, manufacturer, effective_from) DO NOTHING;

-- gaia_cns 제조사 원가
INSERT INTO manufacturer_pricing (equipment_type, equipment_name, manufacturer, cost_price, effective_from, created_by) VALUES
('ph_meter', 'PH센서', 'gaia_cns', 820000, '2025-01-01', (SELECT id FROM employees WHERE permission_level = 4 LIMIT 1)),
('differential_pressure_meter', '차압계', 'gaia_cns', 330000, '2025-01-01', (SELECT id FROM employees WHERE permission_level = 4 LIMIT 1)),
('temperature_meter', '온도계', 'gaia_cns', 410000, '2025-01-01', (SELECT id FROM employees WHERE permission_level = 4 LIMIT 1)),
('discharge_current_meter', '배출전류계', 'gaia_cns', 250000, '2025-01-01', (SELECT id FROM employees WHERE permission_level = 4 LIMIT 1)),
('fan_current_meter', '송풍전류계', 'gaia_cns', 250000, '2025-01-01', (SELECT id FROM employees WHERE permission_level = 4 LIMIT 1)),
('pump_current_meter', '펌프전류계', 'gaia_cns', 250000, '2025-01-01', (SELECT id FROM employees WHERE permission_level = 4 LIMIT 1)),
('gateway', '게이트웨이', 'gaia_cns', 1300000, '2025-01-01', (SELECT id FROM employees WHERE permission_level = 4 LIMIT 1)),
('vpn_wired', 'VPN(유선)', 'gaia_cns', 330000, '2025-01-01', (SELECT id FROM employees WHERE permission_level = 4 LIMIT 1)),
('vpn_wireless', 'VPN(무선)', 'gaia_cns', 330000, '2025-01-01', (SELECT id FROM employees WHERE permission_level = 4 LIMIT 1))
ON CONFLICT (equipment_type, manufacturer, effective_from) DO NOTHING;

-- evs 제조사 원가
INSERT INTO manufacturer_pricing (equipment_type, equipment_name, manufacturer, cost_price, effective_from, created_by) VALUES
('ph_meter', 'PH센서', 'evs', 780000, '2025-01-01', (SELECT id FROM employees WHERE permission_level = 4 LIMIT 1)),
('differential_pressure_meter', '차압계', 'evs', 310000, '2025-01-01', (SELECT id FROM employees WHERE permission_level = 4 LIMIT 1)),
('temperature_meter', '온도계', 'evs', 390000, '2025-01-01', (SELECT id FROM employees WHERE permission_level = 4 LIMIT 1)),
('discharge_current_meter', '배출전류계', 'evs', 230000, '2025-01-01', (SELECT id FROM employees WHERE permission_level = 4 LIMIT 1)),
('fan_current_meter', '송풍전류계', 'evs', 230000, '2025-01-01', (SELECT id FROM employees WHERE permission_level = 4 LIMIT 1)),
('pump_current_meter', '펌프전류계', 'evs', 230000, '2025-01-01', (SELECT id FROM employees WHERE permission_level = 4 LIMIT 1)),
('gateway', '게이트웨이', 'evs', 1250000, '2025-01-01', (SELECT id FROM employees WHERE permission_level = 4 LIMIT 1)),
('vpn_wired', 'VPN(유선)', 'evs', 310000, '2025-01-01', (SELECT id FROM employees WHERE permission_level = 4 LIMIT 1)),
('vpn_wireless', 'VPN(무선)', 'evs', 310000, '2025-01-01', (SELECT id FROM employees WHERE permission_level = 4 LIMIT 1))
ON CONFLICT (equipment_type, manufacturer, effective_from) DO NOTHING;

-- ============================================================================
-- 9. 초기 데이터 삽입 - 기기별 기본 설치비
-- ============================================================================
INSERT INTO equipment_installation_cost (equipment_type, equipment_name, base_installation_cost, effective_from, created_by) VALUES
('ph_meter', 'PH센서', 150000, '2025-01-01', (SELECT id FROM employees WHERE permission_level = 4 LIMIT 1)),
('differential_pressure_meter', '차압계', 100000, '2025-01-01', (SELECT id FROM employees WHERE permission_level = 4 LIMIT 1)),
('temperature_meter', '온도계', 120000, '2025-01-01', (SELECT id FROM employees WHERE permission_level = 4 LIMIT 1)),
('discharge_current_meter', '배출전류계', 80000, '2025-01-01', (SELECT id FROM employees WHERE permission_level = 4 LIMIT 1)),
('fan_current_meter', '송풍전류계', 80000, '2025-01-01', (SELECT id FROM employees WHERE permission_level = 4 LIMIT 1)),
('pump_current_meter', '펌프전류계', 80000, '2025-01-01', (SELECT id FROM employees WHERE permission_level = 4 LIMIT 1)),
('gateway', '게이트웨이', 200000, '2025-01-01', (SELECT id FROM employees WHERE permission_level = 4 LIMIT 1)),
('vpn_wired', 'VPN(유선)', 100000, '2025-01-01', (SELECT id FROM employees WHERE permission_level = 4 LIMIT 1)),
('vpn_wireless', 'VPN(무선)', 120000, '2025-01-01', (SELECT id FROM employees WHERE permission_level = 4 LIMIT 1)),
('explosion_proof_differential_pressure_meter_domestic', '방폭차압계(국산)', 150000, '2025-01-01', (SELECT id FROM employees WHERE permission_level = 4 LIMIT 1)),
('explosion_proof_temperature_meter_domestic', '방폭온도계(국산)', 180000, '2025-01-01', (SELECT id FROM employees WHERE permission_level = 4 LIMIT 1)),
('expansion_device', '확장디바이스', 120000, '2025-01-01', (SELECT id FROM employees WHERE permission_level = 4 LIMIT 1)),
('relay_8ch', '중계기(8채널)', 80000, '2025-01-01', (SELECT id FROM employees WHERE permission_level = 4 LIMIT 1)),
('relay_16ch', '중계기(16채널)', 150000, '2025-01-01', (SELECT id FROM employees WHERE permission_level = 4 LIMIT 1)),
('main_board_replacement', '메인보드교체', 100000, '2025-01-01', (SELECT id FROM employees WHERE permission_level = 4 LIMIT 1)),
('multiple_stack', '복수굴뚝', 120000, '2025-01-01', (SELECT id FROM employees WHERE permission_level = 4 LIMIT 1))
ON CONFLICT (equipment_type, effective_from) DO NOTHING;

-- ============================================================================
-- 10. government_pricing 테이블 업데이트
-- ============================================================================
-- government_pricing 테이블에서 manufacturer_price와 installation_cost 제거
-- (이제 별도 테이블에서 관리)
COMMENT ON COLUMN government_pricing.manufacturer_price IS '⚠️ DEPRECATED: manufacturer_pricing 테이블 사용';
COMMENT ON COLUMN government_pricing.installation_cost IS '⚠️ DEPRECATED: equipment_installation_cost 테이블 사용';
