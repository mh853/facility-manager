-- 비즈니스 및 시설 관리 테이블 생성
-- Facility Management System - Business & Facility Schema

-- 1. 사업장 정보 테이블
CREATE TABLE IF NOT EXISTS public.business_info (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    -- 핵심 사업장 정보
    business_name VARCHAR(255) NOT NULL,
    business_registration_number VARCHAR(50),
    local_government VARCHAR(100),
    address TEXT,

    -- 연락처 정보
    manager_name VARCHAR(100),
    manager_position VARCHAR(100),
    manager_contact VARCHAR(50),
    business_contact VARCHAR(50),
    fax_number VARCHAR(50),
    email VARCHAR(255),
    representative_name VARCHAR(100),

    -- 장비 및 인프라
    manufacturer VARCHAR(20) CHECK (manufacturer IN ('ecosense', 'cleanearth', 'gaia_cns', 'evs')),
    vpn VARCHAR(20) CHECK (vpn IN ('wired', 'wireless')),
    greenlink_id VARCHAR(100),
    greenlink_pw VARCHAR(100),
    business_management_code INTEGER,

    -- 측정 장비 수량
    ph_meter INTEGER DEFAULT 0,
    differential_pressure_meter INTEGER DEFAULT 0,
    temperature_meter INTEGER DEFAULT 0,
    discharge_current_meter INTEGER DEFAULT 0,
    fan_current_meter INTEGER DEFAULT 0,
    pump_current_meter INTEGER DEFAULT 0,
    gateway INTEGER DEFAULT 0,
    vpn_wired INTEGER DEFAULT 0,
    vpn_wireless INTEGER DEFAULT 0,
    explosion_proof_differential_pressure_meter_domestic INTEGER DEFAULT 0,
    explosion_proof_temperature_meter_domestic INTEGER DEFAULT 0,
    expansion_device INTEGER DEFAULT 0,
    relay_8ch INTEGER DEFAULT 0,
    relay_16ch INTEGER DEFAULT 0,
    main_board_replacement INTEGER DEFAULT 0,
    multiple_stack INTEGER DEFAULT 0,

    -- 프로젝트 관리
    installation_phase VARCHAR(20) DEFAULT 'presurvey' CHECK (installation_phase IN ('presurvey', 'installation', 'completed')),
    surveyor_name VARCHAR(100),
    surveyor_contact VARCHAR(50),
    surveyor_company VARCHAR(100),
    survey_date DATE,
    installation_date DATE,
    completion_date DATE,
    special_notes TEXT,
    sales_office VARCHAR(100),

    -- 확장 가능한 데이터
    additional_info JSONB DEFAULT '{}',

    -- 상태 관리
    is_active BOOLEAN DEFAULT true,
    is_deleted BOOLEAN DEFAULT false,

    -- 메타데이터
    created_by UUID REFERENCES public.users(id),
    updated_by UUID REFERENCES public.users(id)
);

-- 2. 대기배출허가 정보 테이블
CREATE TABLE IF NOT EXISTS public.air_permit_info (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    business_id UUID NOT NULL REFERENCES public.business_info(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    -- 허가 상세 정보
    permit_number VARCHAR(100),
    business_type VARCHAR(200),
    annual_emission_amount DECIMAL(15,2),
    first_report_date DATE,
    operation_start_date DATE,
    permit_expiry_date DATE,

    -- 오염물질 정보 (JSON 배열)
    pollutants JSONB DEFAULT '[]',
    emission_limits JSONB DEFAULT '{}',

    -- 확장 가능한 데이터
    additional_info JSONB DEFAULT '{}',

    -- 상태
    is_active BOOLEAN DEFAULT true,
    is_deleted BOOLEAN DEFAULT false,

    -- 메타데이터
    created_by UUID REFERENCES public.users(id),
    updated_by UUID REFERENCES public.users(id)
);

-- 3. 배출구 정보 테이블
CREATE TABLE IF NOT EXISTS public.discharge_outlets (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    air_permit_id UUID NOT NULL REFERENCES public.air_permit_info(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    -- 배출구 정보
    outlet_number INTEGER NOT NULL,
    outlet_name VARCHAR(200),

    -- 물리적 특성
    stack_height DECIMAL(10,2),
    stack_diameter DECIMAL(10,2),
    flow_rate DECIMAL(15,2),

    -- 확장 가능한 데이터
    additional_info JSONB DEFAULT '{}'
);

-- 4. 배출시설 정보 테이블
CREATE TABLE IF NOT EXISTS public.discharge_facilities (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    outlet_id UUID REFERENCES public.discharge_outlets(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    -- 핵심 시설 데이터
    facility_name VARCHAR(255) NOT NULL,
    facility_code VARCHAR(100),
    capacity VARCHAR(100),
    quantity INTEGER DEFAULT 1,

    -- 운영 조건 (확장 가능)
    operating_conditions JSONB DEFAULT '{}',

    -- 확장 가능한 데이터
    additional_info JSONB DEFAULT '{}'
);

-- 5. 방지시설 정보 테이블
CREATE TABLE IF NOT EXISTS public.prevention_facilities (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    outlet_id UUID REFERENCES public.discharge_outlets(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    -- 핵심 시설 데이터
    facility_name VARCHAR(255) NOT NULL,
    facility_code VARCHAR(100),
    capacity VARCHAR(100),
    quantity INTEGER DEFAULT 1,

    -- 운영 조건 (확장 가능)
    operating_conditions JSONB DEFAULT '{}',

    -- 확장 가능한 데이터
    additional_info JSONB DEFAULT '{}'
);

-- 6. 사업장 메모 테이블
CREATE TABLE IF NOT EXISTS public.business_memos (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    business_id UUID NOT NULL REFERENCES public.business_info(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    -- 메모 내용
    title VARCHAR(255) NOT NULL,
    content TEXT,
    memo_type VARCHAR(50) DEFAULT 'general',
    priority INTEGER DEFAULT 1 CHECK (priority BETWEEN 1 AND 5),

    -- 상태
    is_important BOOLEAN DEFAULT false,
    is_resolved BOOLEAN DEFAULT false,

    -- 메타데이터
    created_by UUID NOT NULL REFERENCES public.users(id),
    updated_by UUID REFERENCES public.users(id)
);

-- 7. 인덱스 생성
-- 사업장 정보 인덱스
CREATE INDEX IF NOT EXISTS idx_business_name ON public.business_info(business_name);
CREATE INDEX IF NOT EXISTS idx_business_registration_number ON public.business_info(business_registration_number);
CREATE INDEX IF NOT EXISTS idx_business_local_government ON public.business_info(local_government);
CREATE INDEX IF NOT EXISTS idx_business_manufacturer ON public.business_info(manufacturer);
CREATE INDEX IF NOT EXISTS idx_business_active ON public.business_info(is_active, is_deleted);

-- 대기배출허가 인덱스
CREATE INDEX IF NOT EXISTS idx_air_permit_business ON public.air_permit_info(business_id);
CREATE INDEX IF NOT EXISTS idx_air_permit_number ON public.air_permit_info(permit_number);
CREATE INDEX IF NOT EXISTS idx_air_permit_active ON public.air_permit_info(is_active, is_deleted);

-- 배출구 인덱스
CREATE INDEX IF NOT EXISTS idx_outlet_air_permit ON public.discharge_outlets(air_permit_id);
CREATE INDEX IF NOT EXISTS idx_outlet_number ON public.discharge_outlets(outlet_number);

-- 시설 인덱스
CREATE INDEX IF NOT EXISTS idx_discharge_facility_outlet ON public.discharge_facilities(outlet_id);
CREATE INDEX IF NOT EXISTS idx_prevention_facility_outlet ON public.prevention_facilities(outlet_id);

-- 메모 인덱스
CREATE INDEX IF NOT EXISTS idx_memo_business ON public.business_memos(business_id);
CREATE INDEX IF NOT EXISTS idx_memo_type ON public.business_memos(memo_type);
CREATE INDEX IF NOT EXISTS idx_memo_created ON public.business_memos(created_at);

-- 8. RLS 정책 설정
ALTER TABLE public.business_info ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.air_permit_info ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.discharge_outlets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.discharge_facilities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.prevention_facilities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.business_memos ENABLE ROW LEVEL SECURITY;

-- 사업장 정보 RLS 정책
-- 모든 인증된 사용자는 사업장 정보를 읽을 수 있음
CREATE POLICY "Authenticated users can view business info" ON public.business_info
    FOR SELECT USING (auth.uid() IS NOT NULL);

-- 관리자와 운영자는 사업장 정보를 생성/수정할 수 있음
CREATE POLICY "Managers can manage business info" ON public.business_info
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.users
            WHERE id::text = auth.uid()::text AND role >= 2 AND is_active = true
        )
    );

-- 대기배출허가 정보 RLS 정책
CREATE POLICY "Authenticated users can view air permits" ON public.air_permit_info
    FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "Managers can manage air permits" ON public.air_permit_info
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.users
            WHERE id::text = auth.uid()::text AND role >= 2 AND is_active = true
        )
    );

-- 배출구 정보 RLS 정책
CREATE POLICY "Authenticated users can view outlets" ON public.discharge_outlets
    FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "Managers can manage outlets" ON public.discharge_outlets
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.users
            WHERE id::text = auth.uid()::text AND role >= 2 AND is_active = true
        )
    );

-- 시설 정보 RLS 정책
CREATE POLICY "Authenticated users can view discharge facilities" ON public.discharge_facilities
    FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "Managers can manage discharge facilities" ON public.discharge_facilities
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.users
            WHERE id::text = auth.uid()::text AND role >= 2 AND is_active = true
        )
    );

CREATE POLICY "Authenticated users can view prevention facilities" ON public.prevention_facilities
    FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "Managers can manage prevention facilities" ON public.prevention_facilities
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.users
            WHERE id::text = auth.uid()::text AND role >= 2 AND is_active = true
        )
    );

-- 메모 RLS 정책
CREATE POLICY "Authenticated users can view business memos" ON public.business_memos
    FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can create memos" ON public.business_memos
    FOR INSERT WITH CHECK (
        auth.uid() IS NOT NULL AND
        auth.uid()::text = created_by::text
    );

CREATE POLICY "Users can update their own memos" ON public.business_memos
    FOR UPDATE USING (auth.uid()::text = created_by::text);

CREATE POLICY "Managers can manage all memos" ON public.business_memos
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.users
            WHERE id::text = auth.uid()::text AND role >= 2 AND is_active = true
        )
    );

-- 9. 트리거 적용 (updated_at 자동 업데이트)
CREATE TRIGGER update_business_info_updated_at BEFORE UPDATE ON public.business_info
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_air_permit_info_updated_at BEFORE UPDATE ON public.air_permit_info
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_discharge_outlets_updated_at BEFORE UPDATE ON public.discharge_outlets
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_discharge_facilities_updated_at BEFORE UPDATE ON public.discharge_facilities
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_prevention_facilities_updated_at BEFORE UPDATE ON public.prevention_facilities
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_business_memos_updated_at BEFORE UPDATE ON public.business_memos
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 10. 유틸리티 함수들
CREATE OR REPLACE FUNCTION get_business_with_permits(business_name_param TEXT)
RETURNS TABLE (
    business_id UUID,
    business_name VARCHAR(255),
    permit_count BIGINT,
    outlet_count BIGINT
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        bi.id as business_id,
        bi.business_name,
        COUNT(DISTINCT api.id) as permit_count,
        COUNT(DISTINCT do.id) as outlet_count
    FROM public.business_info bi
    LEFT JOIN public.air_permit_info api ON bi.id = api.business_id AND api.is_active = true
    LEFT JOIN public.discharge_outlets do ON api.id = do.air_permit_id
    WHERE bi.business_name ILIKE '%' || business_name_param || '%'
    AND bi.is_active = true AND bi.is_deleted = false
    GROUP BY bi.id, bi.business_name
    ORDER BY bi.business_name;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 11. 통계 뷰
CREATE OR REPLACE VIEW business_stats AS
SELECT
    COUNT(*) as total_businesses,
    COUNT(*) FILTER (WHERE is_active = true AND is_deleted = false) as active_businesses,
    COUNT(*) FILTER (WHERE manufacturer = 'ecosense') as ecosense_count,
    COUNT(*) FILTER (WHERE manufacturer = 'cleanearth') as cleanearth_count,
    COUNT(*) FILTER (WHERE manufacturer = 'gaia_cns') as gaia_cns_count,
    COUNT(*) FILTER (WHERE manufacturer = 'evs') as evs_count,
    COUNT(*) FILTER (WHERE installation_phase = 'completed') as completed_installations,
    COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '30 days') as new_businesses_30d
FROM public.business_info;

-- 12. 샘플 데이터 생성 (테스트용)
INSERT INTO public.business_info (
    business_name,
    business_registration_number,
    local_government,
    address,
    manager_name,
    manager_contact,
    manufacturer,
    vpn,
    installation_phase,
    is_active
) VALUES
(
    '(주)블루온아이오티',
    '123-45-67890',
    '서울특별시',
    '서울시 강남구 테헤란로 123',
    '김관리',
    '010-1234-5678',
    'ecosense',
    'wired',
    'completed',
    true
),
(
    '환경기술(주)',
    '987-65-43210',
    '경기도',
    '경기도 수원시 영통구 월드컵로 456',
    '이담당',
    '010-9876-5432',
    'cleanearth',
    'wireless',
    'installation',
    true
) ON CONFLICT DO NOTHING;