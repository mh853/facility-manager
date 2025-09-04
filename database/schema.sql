-- 사업장 정보 및 대기필증 관리 데이터베이스 스키마
-- Created: 2025-01-28

-- 1. 사업장 정보 테이블
CREATE TABLE IF NOT EXISTS business_info (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- 기본 사업장 정보
    business_name VARCHAR(255) NOT NULL UNIQUE,
    local_government VARCHAR(100), -- 지자체
    address TEXT,
    
    -- 담당자 정보
    manager_name VARCHAR(100), -- 사업장담당자
    manager_position VARCHAR(50), -- 직급
    manager_contact VARCHAR(20), -- 담당자연락처
    business_contact VARCHAR(20), -- 사업장연락처
    fax_number VARCHAR(20), -- 팩스번호
    email VARCHAR(255),
    
    -- 대표자 정보
    representative_name VARCHAR(100), -- 대표자성명
    representative_birth_date DATE, -- 대표자생년월일
    business_registration_number VARCHAR(20), -- 사업자등록번호
    
    -- 장비 정보
    manufacturer VARCHAR(100), -- 제조사
    ph_meter INTEGER DEFAULT 0, -- PH계 (개수)
    differential_pressure_meter INTEGER DEFAULT 0, -- 차압계 (개수)
    temperature_meter INTEGER DEFAULT 0, -- 온도계 (개수)
    discharge_current_meter INTEGER DEFAULT 0, -- 배출전류계
    fan_current_meter INTEGER DEFAULT 0, -- 송풍전류계
    pump_current_meter INTEGER DEFAULT 0, -- 펌프전류계
    gateway INTEGER DEFAULT 0, -- 게이트웨이 (개수)
    vpn_wired INTEGER DEFAULT 0, -- VPN(유선) (개수)
    vpn_wireless INTEGER DEFAULT 0, -- VPN(무선) (개수)
    multiple_stack INTEGER DEFAULT 0, -- 복수굴뚝 (개수)
    negotiation VARCHAR(255), -- 네고
    
    -- 확장 가능한 JSON 필드 (향후 추가 정보용)
    additional_info JSONB DEFAULT '{}',
    
    -- 상태 관리
    is_active BOOLEAN DEFAULT true,
    is_deleted BOOLEAN DEFAULT false
);

-- 2. 대기필증 정보 테이블
CREATE TABLE IF NOT EXISTS air_permit_info (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id UUID NOT NULL REFERENCES business_info(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- 기본 허가 정보
    business_type VARCHAR(100), -- 업종
    annual_pollutant_emission DECIMAL(10,2), -- 연간 오염물질 발생량(톤/년)
    first_report_date DATE, -- 최초신고일
    operation_start_date DATE, -- 가동개시일
    
    -- 확장 가능한 JSON 필드
    additional_info JSONB DEFAULT '{}',
    
    -- 상태 관리
    is_active BOOLEAN DEFAULT true,
    is_deleted BOOLEAN DEFAULT false
);

-- 3. 배출구 정보 테이블
CREATE TABLE IF NOT EXISTS discharge_outlets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    air_permit_id UUID NOT NULL REFERENCES air_permit_info(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    outlet_number INTEGER NOT NULL, -- 배출구 번호
    outlet_name VARCHAR(100), -- 배출구명
    
    -- 확장 가능한 JSON 필드
    additional_info JSONB DEFAULT '{}',
    
    UNIQUE(air_permit_id, outlet_number)
);

-- 4. 배출시설 정보 테이블
CREATE TABLE IF NOT EXISTS discharge_facilities (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    outlet_id UUID NOT NULL REFERENCES discharge_outlets(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    facility_name VARCHAR(200) NOT NULL, -- 배출시설명
    capacity VARCHAR(50), -- 용량
    quantity INTEGER DEFAULT 1, -- 수량
    
    -- 확장 가능한 JSON 필드
    additional_info JSONB DEFAULT '{}'
);

-- 5. 방지시설 정보 테이블
CREATE TABLE IF NOT EXISTS prevention_facilities (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    outlet_id UUID NOT NULL REFERENCES discharge_outlets(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    facility_name VARCHAR(200) NOT NULL, -- 방지시설명
    capacity VARCHAR(50), -- 용량
    quantity INTEGER DEFAULT 1, -- 수량
    
    -- 확장 가능한 JSON 필드
    additional_info JSONB DEFAULT '{}'
);

-- 6. 데이터 변경 이력 테이블 (복구 기능용)
CREATE TABLE IF NOT EXISTS data_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    table_name VARCHAR(50) NOT NULL, -- 테이블명
    record_id UUID NOT NULL, -- 레코드 ID
    operation VARCHAR(10) NOT NULL, -- 'INSERT', 'UPDATE', 'DELETE'
    old_data JSONB, -- 변경 전 데이터
    new_data JSONB, -- 변경 후 데이터
    user_id VARCHAR(100), -- 변경한 사용자 (향후 인증 시스템 연동)
    change_reason TEXT -- 변경 이유
);

-- 7. 인덱스 생성
CREATE INDEX IF NOT EXISTS idx_business_info_name ON business_info(business_name);
CREATE INDEX IF NOT EXISTS idx_business_info_active ON business_info(is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_air_permit_business ON air_permit_info(business_id);
CREATE INDEX IF NOT EXISTS idx_discharge_outlets_permit ON discharge_outlets(air_permit_id);
CREATE INDEX IF NOT EXISTS idx_discharge_facilities_outlet ON discharge_facilities(outlet_id);
CREATE INDEX IF NOT EXISTS idx_prevention_facilities_outlet ON prevention_facilities(outlet_id);
CREATE INDEX IF NOT EXISTS idx_data_history_table_record ON data_history(table_name, record_id);
CREATE INDEX IF NOT EXISTS idx_data_history_created ON data_history(created_at);

-- 8. 트리거 함수: updated_at 자동 업데이트
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- 9. 트리거 설정
CREATE TRIGGER update_business_info_updated_at BEFORE UPDATE ON business_info FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();
CREATE TRIGGER update_air_permit_info_updated_at BEFORE UPDATE ON air_permit_info FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();
CREATE TRIGGER update_discharge_outlets_updated_at BEFORE UPDATE ON discharge_outlets FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();
CREATE TRIGGER update_discharge_facilities_updated_at BEFORE UPDATE ON discharge_facilities FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();
CREATE TRIGGER update_prevention_facilities_updated_at BEFORE UPDATE ON prevention_facilities FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();

-- 10. 데이터 변경 이력 저장 트리거 함수
CREATE OR REPLACE FUNCTION save_data_history()
RETURNS TRIGGER AS $$
BEGIN
    -- INSERT 작업
    IF TG_OP = 'INSERT' THEN
        INSERT INTO data_history (table_name, record_id, operation, new_data)
        VALUES (TG_TABLE_NAME, NEW.id, 'INSERT', row_to_json(NEW));
        RETURN NEW;
    END IF;
    
    -- UPDATE 작업
    IF TG_OP = 'UPDATE' THEN
        INSERT INTO data_history (table_name, record_id, operation, old_data, new_data)
        VALUES (TG_TABLE_NAME, OLD.id, 'UPDATE', row_to_json(OLD), row_to_json(NEW));
        RETURN NEW;
    END IF;
    
    -- DELETE 작업
    IF TG_OP = 'DELETE' THEN
        INSERT INTO data_history (table_name, record_id, operation, old_data)
        VALUES (TG_TABLE_NAME, OLD.id, 'DELETE', row_to_json(OLD));
        RETURN OLD;
    END IF;
    
    RETURN NULL;
END;
$$ language 'plpgsql';

-- 11. 이력 저장 트리거 설정
CREATE TRIGGER business_info_history AFTER INSERT OR UPDATE OR DELETE ON business_info FOR EACH ROW EXECUTE PROCEDURE save_data_history();
CREATE TRIGGER air_permit_info_history AFTER INSERT OR UPDATE OR DELETE ON air_permit_info FOR EACH ROW EXECUTE PROCEDURE save_data_history();
CREATE TRIGGER discharge_outlets_history AFTER INSERT OR UPDATE OR DELETE ON discharge_outlets FOR EACH ROW EXECUTE PROCEDURE save_data_history();
CREATE TRIGGER discharge_facilities_history AFTER INSERT OR UPDATE OR DELETE ON discharge_facilities FOR EACH ROW EXECUTE PROCEDURE save_data_history();
CREATE TRIGGER prevention_facilities_history AFTER INSERT OR UPDATE OR DELETE ON prevention_facilities FOR EACH ROW EXECUTE PROCEDURE save_data_history();

-- 12. RLS (Row Level Security) 정책 설정 (보안)
ALTER TABLE business_info ENABLE ROW LEVEL SECURITY;
ALTER TABLE air_permit_info ENABLE ROW LEVEL SECURITY;
ALTER TABLE discharge_outlets ENABLE ROW LEVEL SECURITY;
ALTER TABLE discharge_facilities ENABLE ROW LEVEL SECURITY;
ALTER TABLE prevention_facilities ENABLE ROW LEVEL SECURITY;
ALTER TABLE data_history ENABLE ROW LEVEL SECURITY;

-- 13. 기본 정책: 모든 작업 허용 (향후 인증 시스템에 맞게 수정)
CREATE POLICY "Enable all operations for all users" ON business_info FOR ALL USING (true);
CREATE POLICY "Enable all operations for all users" ON air_permit_info FOR ALL USING (true);
CREATE POLICY "Enable all operations for all users" ON discharge_outlets FOR ALL USING (true);
CREATE POLICY "Enable all operations for all users" ON discharge_facilities FOR ALL USING (true);
CREATE POLICY "Enable all operations for all users" ON prevention_facilities FOR ALL USING (true);
CREATE POLICY "Enable all operations for all users" ON data_history FOR ALL USING (true);

-- 14. 유용한 뷰 생성
CREATE OR REPLACE VIEW business_summary AS
SELECT 
    bi.id,
    bi.business_name,
    bi.local_government,
    bi.manager_name,
    bi.manager_contact,
    bi.is_active,
    COUNT(DISTINCT api.id) as permit_count,
    bi.created_at,
    bi.updated_at
FROM business_info bi
LEFT JOIN air_permit_info api ON bi.id = api.business_id AND api.is_active = true
WHERE bi.is_active = true
GROUP BY bi.id, bi.business_name, bi.local_government, bi.manager_name, bi.manager_contact, bi.is_active, bi.created_at, bi.updated_at;

-- 15. 복구용 함수
CREATE OR REPLACE FUNCTION restore_data_from_history(
    p_history_id UUID
)
RETURNS BOOLEAN AS $$
DECLARE
    history_record RECORD;
    table_name_val VARCHAR(50);
    record_id_val UUID;
    old_data_val JSONB;
BEGIN
    -- 이력 레코드 조회
    SELECT table_name, record_id, old_data 
    INTO history_record
    FROM data_history 
    WHERE id = p_history_id;
    
    IF NOT FOUND THEN
        RAISE EXCEPTION '이력 레코드를 찾을 수 없습니다: %', p_history_id;
    END IF;
    
    table_name_val := history_record.table_name;
    record_id_val := history_record.record_id;
    old_data_val := history_record.old_data;
    
    -- 복구 실행 (동적 SQL 사용)
    EXECUTE format('
        INSERT INTO %I (id, %s) 
        VALUES ($1, %s)
        ON CONFLICT (id) DO UPDATE SET %s',
        table_name_val,
        (SELECT string_agg(key, ', ') FROM jsonb_each(old_data_val) WHERE key != 'id'),
        (SELECT string_agg(quote_literal(value), ', ') FROM jsonb_each_text(old_data_val) WHERE key != 'id'),
        (SELECT string_agg(key || ' = ' || quote_literal(value), ', ') FROM jsonb_each_text(old_data_val) WHERE key != 'id')
    ) USING record_id_val;
    
    RETURN TRUE;
EXCEPTION
    WHEN OTHERS THEN
        RAISE EXCEPTION '복구 실패: %', SQLERRM;
END;
$$ LANGUAGE plpgsql;

COMMENT ON DATABASE postgres IS 'Facility Management System - Business and Air Permit Information Management';