-- business_info 테이블만 생성하는 간단한 스크립트
-- 이미 air_permit_info 등이 있어서 충돌이 발생하는 경우 사용

-- 0. survey_events 관련 트리거 제거 (트리거 충돌 방지)
DROP TRIGGER IF EXISTS trigger_sync_business_to_survey ON business_info;
DROP FUNCTION IF EXISTS sync_business_to_survey_events() CASCADE;

-- 1. business_info 테이블 생성
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

    -- 메타데이터 (users 테이블이 없으면 이 부분은 주석 처리)
    created_by UUID,
    updated_by UUID
);

-- 2. 인덱스 생성
CREATE INDEX IF NOT EXISTS idx_business_name ON public.business_info(business_name);
CREATE INDEX IF NOT EXISTS idx_business_registration_number ON public.business_info(business_registration_number);
CREATE INDEX IF NOT EXISTS idx_business_local_government ON public.business_info(local_government);
CREATE INDEX IF NOT EXISTS idx_business_manufacturer ON public.business_info(manufacturer);
CREATE INDEX IF NOT EXISTS idx_business_active ON public.business_info(is_active, is_deleted);

-- 3. updated_at 자동 업데이트 트리거 함수 생성 (없는 경우)
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- 4. updated_at 자동 업데이트 트리거 생성
DROP TRIGGER IF EXISTS update_business_info_updated_at ON public.business_info;
CREATE TRIGGER update_business_info_updated_at
    BEFORE UPDATE ON public.business_info
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- 5. RLS 설정 (선택사항)
ALTER TABLE public.business_info ENABLE ROW LEVEL SECURITY;

-- 모든 인증된 사용자가 읽을 수 있도록 (기본 정책)
DROP POLICY IF EXISTS "Enable read access for all users" ON public.business_info;
CREATE POLICY "Enable read access for all users" ON public.business_info
    FOR SELECT USING (true);

-- 모든 인증된 사용자가 삽입/수정/삭제 가능 (필요시 조정)
DROP POLICY IF EXISTS "Enable insert access for all users" ON public.business_info;
CREATE POLICY "Enable insert access for all users" ON public.business_info
    FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Enable update access for all users" ON public.business_info;
CREATE POLICY "Enable update access for all users" ON public.business_info
    FOR UPDATE USING (true);

DROP POLICY IF EXISTS "Enable delete access for all users" ON public.business_info;
CREATE POLICY "Enable delete access for all users" ON public.business_info
    FOR DELETE USING (true);

-- 6. 샘플 데이터 삽입 (테스트용)
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

-- 7. 확인 쿼리
SELECT
    column_name,
    data_type,
    is_nullable
FROM information_schema.columns
WHERE table_name = 'business_info'
AND table_schema = 'public'
ORDER BY ordinal_position;

-- 완료 메시지
DO $$
BEGIN
    RAISE NOTICE '========================================';
    RAISE NOTICE '✅ business_info 테이블 생성 완료!';
    RAISE NOTICE '========================================';
END $$;
