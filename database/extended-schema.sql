-- 확장된 시설 관리 시스템 데이터베이스 스키마
-- 설치 전 실사, 설치 후 사진 구분 및 측정기기 정보 관리
-- Created: 2025-09-01

-- 1. 사업장 정보 확장 (기존 business_info 테이블 확장)
ALTER TABLE IF EXISTS business_info ADD COLUMN IF NOT EXISTS installation_phase VARCHAR(20) DEFAULT 'presurvey' CHECK (installation_phase IN ('presurvey', 'installation', 'completed'));
ALTER TABLE IF EXISTS business_info ADD COLUMN IF NOT EXISTS surveyor_name VARCHAR(100); -- 실사자 이름
ALTER TABLE IF EXISTS business_info ADD COLUMN IF NOT EXISTS surveyor_contact VARCHAR(50); -- 실사자 연락처
ALTER TABLE IF EXISTS business_info ADD COLUMN IF NOT EXISTS surveyor_company VARCHAR(100); -- 실사자 소속
ALTER TABLE IF EXISTS business_info ADD COLUMN IF NOT EXISTS survey_date DATE; -- 실사일
ALTER TABLE IF EXISTS business_info ADD COLUMN IF NOT EXISTS installation_date DATE; -- 설치일
ALTER TABLE IF EXISTS business_info ADD COLUMN IF NOT EXISTS completion_date DATE; -- 완료일
ALTER TABLE IF EXISTS business_info ADD COLUMN IF NOT EXISTS special_notes TEXT; -- 특이사항

-- 2. 측정기기 정보 테이블 (새로 생성)
CREATE TABLE IF NOT EXISTS measurement_devices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id UUID NOT NULL REFERENCES business_info(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- 측정기기 기본 정보
    device_type VARCHAR(50) NOT NULL, -- 'ph_meter', 'differential_pressure_meter', 'temperature_meter', 'ct_meter', 'gateway'
    device_name VARCHAR(100) NOT NULL,
    model_number VARCHAR(100),
    serial_number VARCHAR(100),
    manufacturer VARCHAR(100),
    
    -- 설치 위치 및 설정
    installation_location TEXT,
    measurement_range VARCHAR(50),
    accuracy VARCHAR(20),
    calibration_date DATE,
    next_calibration_date DATE,
    
    -- CT 관련 추가 정보 (CT 기기인 경우)
    ct_ratio VARCHAR(20), -- CT 비율 (예: 100:1)
    primary_current VARCHAR(20), -- 1차 전류
    secondary_current VARCHAR(20), -- 2차 전류
    
    -- 게이트웨이 관련 추가 정보
    ip_address INET,
    mac_address VARCHAR(17),
    firmware_version VARCHAR(20),
    communication_protocol VARCHAR(30),
    
    -- 상태 관리
    is_active BOOLEAN DEFAULT true,
    device_status VARCHAR(20) DEFAULT 'normal' CHECK (device_status IN ('normal', 'maintenance', 'error', 'inactive')),
    last_maintenance_date DATE,
    next_maintenance_date DATE,
    
    -- 측정값 정보 (실제 측정값은 별도 테이블로 관리)
    current_value DECIMAL(10,4),
    unit VARCHAR(10),
    measurement_timestamp TIMESTAMP WITH TIME ZONE,
    
    -- 확장 가능한 JSON 필드
    additional_settings JSONB DEFAULT '{}',
    
    UNIQUE(business_id, device_type, serial_number)
);

-- 3. 시설 상태 및 진행 단계 관리 테이블
CREATE TABLE IF NOT EXISTS project_phases (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id UUID NOT NULL REFERENCES business_info(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    phase_type VARCHAR(20) NOT NULL CHECK (phase_type IN ('presurvey', 'installation', 'completion')),
    phase_name VARCHAR(100) NOT NULL, -- 예: "설치 전 실사", "장비 설치", "설치 후 검수"
    start_date DATE,
    end_date DATE,
    expected_completion_date DATE,
    
    -- 진행 상태
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed', 'delayed', 'cancelled')),
    progress_percentage INTEGER DEFAULT 0 CHECK (progress_percentage BETWEEN 0 AND 100),
    
    -- 담당자 정보
    assigned_to VARCHAR(100), -- 담당자
    supervisor VARCHAR(100), -- 감독자
    
    -- 단계별 체크리스트
    checklist_items JSONB DEFAULT '[]', -- [{"item": "현장 조사", "completed": false, "notes": ""}]
    completion_notes TEXT,
    approval_status VARCHAR(20) DEFAULT 'pending' CHECK (approval_status IN ('pending', 'approved', 'rejected')),
    approved_by VARCHAR(100),
    approved_at TIMESTAMP WITH TIME ZONE,
    
    -- 파일 관리
    required_documents JSONB DEFAULT '[]', -- 필요 서류 목록
    submitted_documents JSONB DEFAULT '[]', -- 제출된 서류
    
    UNIQUE(business_id, phase_type)
);

-- 4. 업로드 파일 테이블 확장 (기존 uploaded_files 테이블 확장)
ALTER TABLE IF EXISTS uploaded_files ADD COLUMN IF NOT EXISTS project_phase VARCHAR(20) DEFAULT 'presurvey' CHECK (project_phase IN ('presurvey', 'installation', 'completion'));
ALTER TABLE IF EXISTS uploaded_files ADD COLUMN IF NOT EXISTS document_category VARCHAR(50); -- 'survey_photo', 'installation_photo', 'completion_photo', 'certificate', 'report'
ALTER TABLE IF EXISTS uploaded_files ADD COLUMN IF NOT EXISTS facility_info TEXT; -- 시설 정보 (기존 추가된 컬럼)
ALTER TABLE IF EXISTS uploaded_files ADD COLUMN IF NOT EXISTS device_id UUID REFERENCES measurement_devices(id); -- 관련 측정기기

-- 5. 시설별 상세 정보 확장
ALTER TABLE IF EXISTS discharge_facilities ADD COLUMN IF NOT EXISTS device_ids UUID[] DEFAULT '{}'; -- 관련 측정기기 ID 배열
ALTER TABLE IF EXISTS discharge_facilities ADD COLUMN IF NOT EXISTS measurement_points JSONB DEFAULT '[]'; -- 측정 지점 정보
ALTER TABLE IF EXISTS discharge_facilities ADD COLUMN IF NOT EXISTS operating_conditions JSONB DEFAULT '{}'; -- 운전 조건

ALTER TABLE IF EXISTS prevention_facilities ADD COLUMN IF NOT EXISTS device_ids UUID[] DEFAULT '{}';
ALTER TABLE IF EXISTS prevention_facilities ADD COLUMN IF NOT EXISTS measurement_points JSONB DEFAULT '[]';
ALTER TABLE IF EXISTS prevention_facilities ADD COLUMN IF NOT EXISTS operating_conditions JSONB DEFAULT '{}';

-- 6. 측정 데이터 이력 테이블
CREATE TABLE IF NOT EXISTS measurement_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    device_id UUID NOT NULL REFERENCES measurement_devices(id) ON DELETE CASCADE,
    business_id UUID NOT NULL REFERENCES business_info(id) ON DELETE CASCADE,
    measured_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- 측정값
    measured_value DECIMAL(10,4) NOT NULL,
    unit VARCHAR(10) NOT NULL,
    measurement_type VARCHAR(30), -- 'ph', 'temperature', 'pressure', 'current', 'voltage'
    
    -- 품질 정보
    data_quality VARCHAR(20) DEFAULT 'normal' CHECK (data_quality IN ('normal', 'warning', 'error', 'calibration')),
    confidence_level DECIMAL(3,2), -- 0.00 ~ 1.00
    
    -- 메타데이터
    measurement_method VARCHAR(50),
    environmental_conditions JSONB DEFAULT '{}', -- 온도, 습도 등
    calibration_status BOOLEAN DEFAULT true,
    
    -- 인덱스를 위한 컬럼
    date_bucket DATE GENERATED ALWAYS AS (DATE(measured_at)) STORED
);

-- 7. 보고서 생성 이력 테이블
CREATE TABLE IF NOT EXISTS report_generation_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id UUID NOT NULL REFERENCES business_info(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    report_type VARCHAR(30) NOT NULL, -- 'presurvey', 'installation', 'completion', 'maintenance'
    report_format VARCHAR(10) DEFAULT 'pdf' CHECK (report_format IN ('pdf', 'excel', 'word')),
    
    -- 보고서 메타데이터
    report_title VARCHAR(200),
    generated_by VARCHAR(100),
    report_period_start DATE,
    report_period_end DATE,
    
    -- 파일 정보
    file_path TEXT,
    file_size BIGINT,
    file_hash VARCHAR(64),
    
    -- 상태
    generation_status VARCHAR(20) DEFAULT 'pending' CHECK (generation_status IN ('pending', 'generating', 'completed', 'failed')),
    error_message TEXT,
    
    -- 보고서 내용 요약
    summary JSONB DEFAULT '{}',
    included_data JSONB DEFAULT '{}' -- 포함된 데이터 종류와 범위
);

-- 8. 인덱스 생성
CREATE INDEX IF NOT EXISTS idx_measurement_devices_business ON measurement_devices(business_id);
CREATE INDEX IF NOT EXISTS idx_measurement_devices_type ON measurement_devices(device_type);
CREATE INDEX IF NOT EXISTS idx_measurement_devices_status ON measurement_devices(device_status) WHERE device_status != 'normal';

CREATE INDEX IF NOT EXISTS idx_project_phases_business ON project_phases(business_id);
CREATE INDEX IF NOT EXISTS idx_project_phases_type_status ON project_phases(phase_type, status);

CREATE INDEX IF NOT EXISTS idx_uploaded_files_phase ON uploaded_files(project_phase);
CREATE INDEX IF NOT EXISTS idx_uploaded_files_category ON uploaded_files(document_category);
CREATE INDEX IF NOT EXISTS idx_uploaded_files_device ON uploaded_files(device_id) WHERE device_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_measurement_history_device_time ON measurement_history(device_id, measured_at DESC);
CREATE INDEX IF NOT EXISTS idx_measurement_history_business_date ON measurement_history(business_id, date_bucket DESC);
CREATE INDEX IF NOT EXISTS idx_measurement_history_quality ON measurement_history(data_quality) WHERE data_quality != 'normal';

CREATE INDEX IF NOT EXISTS idx_report_generation_business ON report_generation_history(business_id);
CREATE INDEX IF NOT EXISTS idx_report_generation_type_status ON report_generation_history(report_type, generation_status);

-- 9. 트리거 설정 (기존 함수 재사용)
CREATE TRIGGER update_measurement_devices_updated_at BEFORE UPDATE ON measurement_devices FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();
CREATE TRIGGER update_project_phases_updated_at BEFORE UPDATE ON project_phases FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();

-- 10. 이력 저장 트리거 (새 테이블들)
CREATE TRIGGER measurement_devices_history AFTER INSERT OR UPDATE OR DELETE ON measurement_devices FOR EACH ROW EXECUTE PROCEDURE save_data_history();
CREATE TRIGGER project_phases_history AFTER INSERT OR UPDATE OR DELETE ON project_phases FOR EACH ROW EXECUTE PROCEDURE save_data_history();
CREATE TRIGGER report_generation_history_history AFTER INSERT OR UPDATE OR DELETE ON report_generation_history FOR EACH ROW EXECUTE PROCEDURE save_data_history();

-- 11. RLS 정책 설정
ALTER TABLE measurement_devices ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_phases ENABLE ROW LEVEL SECURITY;
ALTER TABLE measurement_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE report_generation_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Enable all operations for all users" ON measurement_devices FOR ALL USING (true);
CREATE POLICY "Enable all operations for all users" ON project_phases FOR ALL USING (true);
CREATE POLICY "Enable all operations for all users" ON measurement_history FOR ALL USING (true);
CREATE POLICY "Enable all operations for all users" ON report_generation_history FOR ALL USING (true);

-- 12. 유용한 뷰 생성
CREATE OR REPLACE VIEW facility_management_dashboard AS
SELECT 
    bi.id,
    bi.business_name,
    bi.installation_phase,
    bi.surveyor_name,
    bi.survey_date,
    bi.installation_date,
    bi.completion_date,
    
    -- 프로젝트 진행률
    pp.phase_type,
    pp.status as phase_status,
    pp.progress_percentage,
    
    -- 측정기기 수
    COALESCE(device_counts.total_devices, 0) as total_devices,
    COALESCE(device_counts.active_devices, 0) as active_devices,
    
    -- 업로드 파일 수
    COALESCE(file_counts.presurvey_files, 0) as presurvey_files,
    COALESCE(file_counts.installation_files, 0) as installation_files,
    COALESCE(file_counts.completion_files, 0) as completion_files,
    
    bi.created_at,
    bi.updated_at
FROM business_info bi
LEFT JOIN project_phases pp ON bi.id = pp.business_id AND pp.phase_type = bi.installation_phase
LEFT JOIN (
    SELECT 
        business_id,
        COUNT(*) as total_devices,
        COUNT(*) FILTER (WHERE is_active = true) as active_devices
    FROM measurement_devices
    GROUP BY business_id
) device_counts ON bi.id = device_counts.business_id
LEFT JOIN (
    SELECT 
        business_id,
        COUNT(*) FILTER (WHERE project_phase = 'presurvey') as presurvey_files,
        COUNT(*) FILTER (WHERE project_phase = 'installation') as installation_files,
        COUNT(*) FILTER (WHERE project_phase = 'completion') as completion_files
    FROM uploaded_files
    GROUP BY business_id
) file_counts ON bi.id = file_counts.business_id
WHERE bi.is_active = true;

-- 13. 시설별 측정기기 현황 뷰
CREATE OR REPLACE VIEW facility_device_status AS
SELECT 
    bi.business_name,
    df.facility_name as discharge_facility,
    pf.facility_name as prevention_facility,
    md.device_type,
    md.device_name,
    md.model_number,
    md.device_status,
    md.current_value,
    md.unit,
    md.measurement_timestamp,
    md.last_maintenance_date,
    md.next_maintenance_date
FROM business_info bi
LEFT JOIN discharge_outlets do ON bi.id = do.air_permit_id
LEFT JOIN discharge_facilities df ON do.id = df.outlet_id
LEFT JOIN prevention_facilities pf ON do.id = pf.outlet_id
LEFT JOIN measurement_devices md ON bi.id = md.business_id
WHERE bi.is_active = true
ORDER BY bi.business_name, md.device_type;

-- 14. 유틸리티 함수들

-- 사업장의 현재 단계 업데이트
CREATE OR REPLACE FUNCTION update_business_phase(
    p_business_id UUID,
    p_new_phase VARCHAR(20)
)
RETURNS BOOLEAN AS $$
BEGIN
    UPDATE business_info 
    SET installation_phase = p_new_phase,
        updated_at = NOW()
    WHERE id = p_business_id;
    
    -- 프로젝트 단계 기록 생성
    INSERT INTO project_phases (business_id, phase_type, phase_name, start_date, status)
    VALUES (p_business_id, p_new_phase, 
           CASE 
               WHEN p_new_phase = 'presurvey' THEN '설치 전 실사'
               WHEN p_new_phase = 'installation' THEN '장비 설치'
               WHEN p_new_phase = 'completion' THEN '설치 후 검수'
               ELSE p_new_phase
           END,
           CURRENT_DATE, 'in_progress')
    ON CONFLICT (business_id, phase_type) DO UPDATE SET
        status = 'in_progress',
        start_date = COALESCE(project_phases.start_date, CURRENT_DATE),
        updated_at = NOW();
    
    RETURN true;
END;
$$ LANGUAGE plpgsql;

-- 측정기기 상태 업데이트
CREATE OR REPLACE FUNCTION update_device_status(
    p_device_id UUID,
    p_new_status VARCHAR(20),
    p_notes TEXT DEFAULT NULL
)
RETURNS BOOLEAN AS $$
BEGIN
    UPDATE measurement_devices 
    SET device_status = p_new_status,
        updated_at = NOW(),
        additional_settings = additional_settings || 
            CASE 
                WHEN p_notes IS NOT NULL THEN jsonb_build_object('status_notes', p_notes)
                ELSE '{}'::jsonb
            END
    WHERE id = p_device_id;
    
    RETURN true;
END;
$$ LANGUAGE plpgsql;

-- 15. 샘플 데이터 삽입 함수
CREATE OR REPLACE FUNCTION insert_sample_measurement_devices()
RETURNS VOID AS $$
DECLARE
    sample_business_id UUID;
BEGIN
    -- 첫 번째 사업장 ID 가져오기
    SELECT id INTO sample_business_id FROM business_info LIMIT 1;
    
    IF sample_business_id IS NOT NULL THEN
        -- 게이트웨이
        INSERT INTO measurement_devices (business_id, device_type, device_name, model_number, manufacturer, ip_address, mac_address)
        VALUES (sample_business_id, 'gateway', 'IoT 게이트웨이', 'GW-2000', 'TechCorp', '192.168.1.100', '00:11:22:33:44:55');
        
        -- pH 측정기
        INSERT INTO measurement_devices (business_id, device_type, device_name, model_number, manufacturer, measurement_range, accuracy)
        VALUES (sample_business_id, 'ph_meter', 'pH 측정기', 'PH-500', 'MeasureTech', '0-14 pH', '±0.01');
        
        -- 차압계
        INSERT INTO measurement_devices (business_id, device_type, device_name, model_number, manufacturer, measurement_range, accuracy)
        VALUES (sample_business_id, 'differential_pressure_meter', '차압 측정기', 'DP-300', 'PressurePro', '0-1000 Pa', '±1%');
        
        -- 온도계
        INSERT INTO measurement_devices (business_id, device_type, device_name, model_number, manufacturer, measurement_range, accuracy)
        VALUES (sample_business_id, 'temperature_meter', '온도 측정기', 'TEMP-200', 'TempMaster', '-40~150°C', '±0.1°C');
    END IF;
END;
$$ LANGUAGE plpgsql;

COMMENT ON DATABASE postgres IS 'Extended Facility Management System - 설치 전/후 구분 및 측정기기 정보 관리';