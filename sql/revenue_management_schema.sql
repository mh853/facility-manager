-- 매출관리 시스템 데이터베이스 스키마
-- 생성일: 2025-09-29
-- 설명: 환경부 고시가 기준 매출관리 시스템

-- 1. 환경부 고시가 관리 테이블
CREATE TABLE IF NOT EXISTS government_pricing (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    equipment_type VARCHAR(100) NOT NULL, -- business_info 컬럼명
    equipment_name VARCHAR(100) NOT NULL, -- 한글 기기명
    official_price DECIMAL(12,2) NOT NULL, -- 환경부 고시가
    manufacturer_price DECIMAL(12,2) DEFAULT 0, -- 제조사 원가 (추후 설정)
    installation_cost DECIMAL(12,2) DEFAULT 0, -- 기본설치비용
    effective_from DATE NOT NULL,
    effective_to DATE NULL,
    announcement_number VARCHAR(100), -- 고시 번호
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    created_by UUID REFERENCES employees(id),
    is_active BOOLEAN DEFAULT TRUE,
    UNIQUE(equipment_type, effective_from)
);

-- 2. 영업점별 비용 설정 테이블
CREATE TABLE IF NOT EXISTS sales_office_cost_settings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    sales_office VARCHAR(100) NOT NULL, -- business_info.sales_office와 매핑
    commission_type VARCHAR(20) NOT NULL CHECK (commission_type IN ('percentage', 'per_unit')),
    commission_percentage DECIMAL(5,2), -- 영업비용 % (매출 기준)
    commission_per_unit DECIMAL(10,2), -- 측정기기당 영업비용
    effective_from DATE NOT NULL,
    effective_to DATE NULL,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    created_by UUID REFERENCES employees(id),
    is_active BOOLEAN DEFAULT TRUE,
    UNIQUE(sales_office, effective_from)
);

-- 3. 실사비용 기본 설정 테이블
CREATE TABLE IF NOT EXISTS survey_cost_settings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    survey_type VARCHAR(30) NOT NULL CHECK (survey_type IN ('estimate', 'pre_construction', 'completion')),
    survey_name VARCHAR(50) NOT NULL, -- '견적실사', '착공전실사', '준공실사'
    base_cost DECIMAL(10,2) NOT NULL, -- 기본 비용
    effective_from DATE NOT NULL,
    effective_to DATE NULL,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    created_by UUID REFERENCES employees(id),
    is_active BOOLEAN DEFAULT TRUE,
    UNIQUE(survey_type, effective_from)
);

-- 4. 실사비용 조정 테이블 (사업장별 개별 조정)
CREATE TABLE IF NOT EXISTS survey_cost_adjustments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    business_id UUID REFERENCES business_info(id),
    survey_type VARCHAR(30) NOT NULL,
    adjustment_amount DECIMAL(10,2) NOT NULL, -- 조정 금액 (+ 또는 -)
    adjustment_reason TEXT, -- 조정 사유
    applied_date DATE NOT NULL,
    created_at TIMESTAMP DEFAULT NOW(),
    created_by UUID REFERENCES employees(id),
    INDEX idx_survey_adjustments_business (business_id),
    INDEX idx_survey_adjustments_date (applied_date)
);

-- 5. 매출 계산 결과 테이블
CREATE TABLE IF NOT EXISTS revenue_calculations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    business_id UUID REFERENCES business_info(id),
    business_name VARCHAR(255), -- 사업장명 (조회 성능용)
    calculation_date DATE NOT NULL,

    -- 매출/매입/이익
    total_revenue DECIMAL(12,2) NOT NULL DEFAULT 0, -- 환경부 고시가 기준 매출
    total_cost DECIMAL(12,2) NOT NULL DEFAULT 0, -- 제조사 원가 기준 매입
    gross_profit DECIMAL(12,2) NOT NULL DEFAULT 0, -- 총 이익

    -- 비용 항목들
    sales_commission DECIMAL(10,2) NOT NULL DEFAULT 0, -- 영업비용
    survey_costs DECIMAL(10,2) NOT NULL DEFAULT 0, -- 실사비용 (조정 포함)
    installation_costs DECIMAL(10,2) NOT NULL DEFAULT 0, -- 설치비용
    net_profit DECIMAL(12,2) NOT NULL DEFAULT 0, -- 순이익

    -- 상세 정보
    equipment_breakdown JSONB, -- 기기별 상세 내역
    cost_breakdown JSONB, -- 비용 상세 내역
    pricing_version_snapshot JSONB, -- 계산 시점의 가격 정보 스냅샷
    sales_office VARCHAR(100), -- 영업점

    -- 소급 적용 관련
    is_retroactive_calculation BOOLEAN DEFAULT FALSE,
    original_calculation_id UUID REFERENCES revenue_calculations(id),
    retroactive_reason TEXT,

    created_at TIMESTAMP DEFAULT NOW(),
    calculated_by UUID REFERENCES employees(id),

    INDEX idx_revenue_business (business_id),
    INDEX idx_revenue_date (calculation_date),
    INDEX idx_revenue_sales_office (sales_office),
    INDEX idx_revenue_created (created_at)
);

-- 6. 원가 변경 히스토리 테이블 (원가 변경시에만 기록)
CREATE TABLE IF NOT EXISTS pricing_change_history (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    table_name VARCHAR(50) NOT NULL, -- 'government_pricing', 'sales_office_cost_settings' 등
    record_id UUID NOT NULL,
    change_type VARCHAR(20) NOT NULL, -- 'price_update', 'cost_update', 'commission_update'
    old_values JSONB,
    new_values JSONB,
    changed_fields TEXT[],
    change_reason TEXT,
    business_ids_affected UUID[], -- 영향받는 사업장 ID 목록
    calculation_count_affected INTEGER DEFAULT 0, -- 재계산된 결과 수
    user_id UUID REFERENCES employees(id),
    user_name VARCHAR(100),
    created_at TIMESTAMP DEFAULT NOW(),

    INDEX idx_pricing_history_table (table_name),
    INDEX idx_pricing_history_record (record_id),
    INDEX idx_pricing_history_date (created_at)
);

-- 7. 감사로그 테이블 (모든 변경사항 추적)
CREATE TABLE IF NOT EXISTS revenue_audit_log (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    table_name VARCHAR(50) NOT NULL,
    record_id UUID NOT NULL,
    action_type VARCHAR(20) NOT NULL, -- 'INSERT', 'UPDATE', 'DELETE', 'CALCULATE'
    old_values JSONB,
    new_values JSONB,
    changed_fields TEXT[],
    action_description TEXT,
    user_id UUID REFERENCES employees(id),
    user_name VARCHAR(100),
    user_permission_level INTEGER,
    ip_address INET,
    user_agent TEXT,
    session_id VARCHAR(100),
    created_at TIMESTAMP DEFAULT NOW(),

    INDEX idx_audit_table (table_name),
    INDEX idx_audit_user (user_id),
    INDEX idx_audit_date (created_at),
    INDEX idx_audit_record (record_id)
);

-- 8. 인덱스 추가
CREATE INDEX IF NOT EXISTS idx_government_pricing_type ON government_pricing(equipment_type);
CREATE INDEX IF NOT EXISTS idx_government_pricing_active ON government_pricing(is_active);
CREATE INDEX IF NOT EXISTS idx_sales_office_settings_office ON sales_office_cost_settings(sales_office);
CREATE INDEX IF NOT EXISTS idx_survey_settings_type ON survey_cost_settings(survey_type);

-- 9. 환경부 고시가 초기 데이터 삽입
INSERT INTO government_pricing (equipment_type, equipment_name, official_price, effective_from, created_by) VALUES
('ph_meter', 'PH센서', 1000000, '2025-01-01', (SELECT id FROM employees WHERE permission_level = 4 LIMIT 1)),
('differential_pressure_meter', '차압계', 400000, '2025-01-01', (SELECT id FROM employees WHERE permission_level = 4 LIMIT 1)),
('temperature_meter', '온도계', 500000, '2025-01-01', (SELECT id FROM employees WHERE permission_level = 4 LIMIT 1)),
('discharge_current_meter', '배출전류계', 300000, '2025-01-01', (SELECT id FROM employees WHERE permission_level = 4 LIMIT 1)),
('fan_current_meter', '송풍전류계', 300000, '2025-01-01', (SELECT id FROM employees WHERE permission_level = 4 LIMIT 1)),
('pump_current_meter', '펌프전류계', 300000, '2025-01-01', (SELECT id FROM employees WHERE permission_level = 4 LIMIT 1)),
('gateway', '게이트웨이', 1600000, '2025-01-01', (SELECT id FROM employees WHERE permission_level = 4 LIMIT 1)),
('vpn_wired', 'VPN(유선)', 400000, '2025-01-01', (SELECT id FROM employees WHERE permission_level = 4 LIMIT 1)),
('vpn_wireless', 'VPN(무선)', 400000, '2025-01-01', (SELECT id FROM employees WHERE permission_level = 4 LIMIT 1)),
('explosion_proof_differential_pressure_meter_domestic', '방폭차압계(국산)', 800000, '2025-01-01', (SELECT id FROM employees WHERE permission_level = 4 LIMIT 1)),
('explosion_proof_temperature_meter_domestic', '방폭온도계(국산)', 1500000, '2025-01-01', (SELECT id FROM employees WHERE permission_level = 4 LIMIT 1)),
('expansion_device', '확장디바이스', 800000, '2025-01-01', (SELECT id FROM employees WHERE permission_level = 4 LIMIT 1)),
('relay_8ch', '중계기(8채널)', 300000, '2025-01-01', (SELECT id FROM employees WHERE permission_level = 4 LIMIT 1)),
('relay_16ch', '중계기(16채널)', 1600000, '2025-01-01', (SELECT id FROM employees WHERE permission_level = 4 LIMIT 1)),
('main_board_replacement', '메인보드교체', 350000, '2025-01-01', (SELECT id FROM employees WHERE permission_level = 4 LIMIT 1)),
('multiple_stack', '복수굴뚝', 480000, '2025-01-01', (SELECT id FROM employees WHERE permission_level = 4 LIMIT 1))
ON CONFLICT (equipment_type, effective_from) DO NOTHING;

-- 10. 영업점 기본 설정 삽입 (기본값: 매출의 3%)
INSERT INTO sales_office_cost_settings (sales_office, commission_type, commission_percentage, effective_from, created_by)
SELECT
    sales_office,
    'percentage',
    3.0,
    '2025-01-01',
    (SELECT id FROM employees WHERE permission_level = 4 LIMIT 1)
FROM (
    VALUES
    ('원에너지'), ('스탠다드웍스'), ('케이디환경'), ('그린환경'), ('오토기기'),
    ('임래성'), ('광주환경'), ('SYC'), ('백종현'), ('박정기'), ('(주)정도'),
    ('김우진'), ('다온환경'), ('다온환경-정기환'), ('다인테크'), ('대동환경'),
    ('미가앤카'), ('수호환경/대창환경'), ('신세계엔텍'), ('연합환경(청주)'), ('영진환경'),
    ('인바이오텍'), ('일진환경'), ('제주환경개발주식회사'), ('주영환경기술'), ('월드머신'),
    ('울산미래환경'), ('글로밴스'), ('정안환경'), ('정일플랜트'), ('디앤블루션'),
    ('티앤웨이'), ('정도이엔티'), ('정도환경'), ('연합환경기술(청주)'), ('유철종'),
    ('케이비엔텍(주)'), ('대성피엔이'), ('대경환경'), ('강동우(디오)'), ('나우개발')
) AS t(sales_office)
ON CONFLICT (sales_office, effective_from) DO NOTHING;

-- 11. 실사비용 기본 설정 삽입
INSERT INTO survey_cost_settings (survey_type, survey_name, base_cost, effective_from, created_by) VALUES
('estimate', '견적실사', 100000, '2025-01-01', (SELECT id FROM employees WHERE permission_level = 4 LIMIT 1)),
('pre_construction', '착공전실사', 150000, '2025-01-01', (SELECT id FROM employees WHERE permission_level = 4 LIMIT 1)),
('completion', '준공실사', 200000, '2025-01-01', (SELECT id FROM employees WHERE permission_level = 4 LIMIT 1))
ON CONFLICT (survey_type, effective_from) DO NOTHING;

-- 12. 트리거 함수: 업데이트 시간 자동 갱신
CREATE OR REPLACE FUNCTION update_revenue_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- 13. 트리거 생성
DROP TRIGGER IF EXISTS trigger_government_pricing_updated_at ON government_pricing;
CREATE TRIGGER trigger_government_pricing_updated_at
    BEFORE UPDATE ON government_pricing
    FOR EACH ROW EXECUTE FUNCTION update_revenue_updated_at();

DROP TRIGGER IF EXISTS trigger_sales_office_cost_settings_updated_at ON sales_office_cost_settings;
CREATE TRIGGER trigger_sales_office_cost_settings_updated_at
    BEFORE UPDATE ON sales_office_cost_settings
    FOR EACH ROW EXECUTE FUNCTION update_revenue_updated_at();

DROP TRIGGER IF EXISTS trigger_survey_cost_settings_updated_at ON survey_cost_settings;
CREATE TRIGGER trigger_survey_cost_settings_updated_at
    BEFORE UPDATE ON survey_cost_settings
    FOR EACH ROW EXECUTE FUNCTION update_revenue_updated_at();

-- 14. RLS (Row Level Security) 설정
ALTER TABLE government_pricing ENABLE ROW LEVEL SECURITY;
ALTER TABLE sales_office_cost_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE survey_cost_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE revenue_calculations ENABLE ROW LEVEL SECURITY;
ALTER TABLE pricing_change_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE revenue_audit_log ENABLE ROW LEVEL SECURITY;

-- 권한 3 이상만 원가 관리 접근 가능
CREATE POLICY "revenue_management_policy" ON government_pricing
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM employees
            WHERE employees.id = auth.uid()
            AND employees.permission_level >= 3
            AND employees.is_active = true
            AND employees.is_deleted = false
        )
    );

-- 권한 2 이상만 매출 조회 가능
CREATE POLICY "revenue_view_policy" ON revenue_calculations
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM employees
            WHERE employees.id = auth.uid()
            AND employees.permission_level >= 2
            AND employees.is_active = true
            AND employees.is_deleted = false
        )
    );

-- 권한 3 이상만 매출 계산/수정 가능
CREATE POLICY "revenue_modify_policy" ON revenue_calculations
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM employees
            WHERE employees.id = auth.uid()
            AND employees.permission_level >= 3
            AND employees.is_active = true
            AND employees.is_deleted = false
        )
    );

COMMENT ON TABLE government_pricing IS '환경부 고시가 관리 테이블';
COMMENT ON TABLE sales_office_cost_settings IS '영업점별 영업비용 설정 테이블';
COMMENT ON TABLE survey_cost_settings IS '실사비용 기본 설정 테이블';
COMMENT ON TABLE survey_cost_adjustments IS '실사비용 사업장별 조정 테이블';
COMMENT ON TABLE revenue_calculations IS '매출 계산 결과 저장 테이블';
COMMENT ON TABLE pricing_change_history IS '원가 변경 히스토리 (원가 변경시에만 기록)';
COMMENT ON TABLE revenue_audit_log IS '전체 변경사항 감사로그';