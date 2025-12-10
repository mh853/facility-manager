-- business_info 테이블 최소 버전 생성 스크립트
-- Deadlock 방지를 위해 트리거 제거 없이 테이블만 생성

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

    -- 메타데이터
    created_by UUID,
    updated_by UUID
);

-- 2. 인덱스 생성
CREATE INDEX IF NOT EXISTS idx_business_name ON public.business_info(business_name);
CREATE INDEX IF NOT EXISTS idx_business_registration_number ON public.business_info(business_registration_number);
CREATE INDEX IF NOT EXISTS idx_business_local_government ON public.business_info(local_government);
CREATE INDEX IF NOT EXISTS idx_business_manufacturer ON public.business_info(manufacturer);
CREATE INDEX IF NOT EXISTS idx_business_active ON public.business_info(is_active, is_deleted);

-- 3. updated_at 자동 업데이트 함수 생성 (없는 경우)
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- 4. updated_at 자동 업데이트 트리거 생성 (기존 것은 그대로 유지)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname = 'update_business_info_updated_at'
  ) THEN
    CREATE TRIGGER update_business_info_updated_at
      BEFORE UPDATE ON public.business_info
      FOR EACH ROW
      EXECUTE FUNCTION update_updated_at_column();
    RAISE NOTICE '✅ updated_at 트리거 생성 완료';
  ELSE
    RAISE NOTICE '⏭️ updated_at 트리거가 이미 존재합니다';
  END IF;
END $$;

-- 5. RLS 설정
ALTER TABLE public.business_info ENABLE ROW LEVEL SECURITY;

-- 기본 정책: 모든 사용자 읽기 가능
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'business_info'
    AND policyname = 'Enable read access for all users'
  ) THEN
    CREATE POLICY "Enable read access for all users" ON public.business_info
      FOR SELECT USING (true);
    RAISE NOTICE '✅ SELECT 정책 생성 완료';
  ELSE
    RAISE NOTICE '⏭️ SELECT 정책이 이미 존재합니다';
  END IF;
END $$;

-- 기본 정책: 모든 사용자 삽입 가능
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'business_info'
    AND policyname = 'Enable insert access for all users'
  ) THEN
    CREATE POLICY "Enable insert access for all users" ON public.business_info
      FOR INSERT WITH CHECK (true);
    RAISE NOTICE '✅ INSERT 정책 생성 완료';
  ELSE
    RAISE NOTICE '⏭️ INSERT 정책이 이미 존재합니다';
  END IF;
END $$;

-- 기본 정책: 모든 사용자 수정 가능
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'business_info'
    AND policyname = 'Enable update access for all users'
  ) THEN
    CREATE POLICY "Enable update access for all users" ON public.business_info
      FOR UPDATE USING (true);
    RAISE NOTICE '✅ UPDATE 정책 생성 완료';
  ELSE
    RAISE NOTICE '⏭️ UPDATE 정책이 이미 존재합니다';
  END IF;
END $$;

-- 기본 정책: 모든 사용자 삭제 가능
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'business_info'
    AND policyname = 'Enable delete access for all users'
  ) THEN
    CREATE POLICY "Enable delete access for all users" ON public.business_info
      FOR DELETE USING (true);
    RAISE NOTICE '✅ DELETE 정책 생성 완료';
  ELSE
    RAISE NOTICE '⏭️ DELETE 정책이 이미 존재합니다';
  END IF;
END $$;

-- 6. 샘플 데이터 삽입 (이미 있으면 건너뛰기)
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
    RAISE NOTICE '트리거 충돌이 있다면 나중에 별도로 처리하세요';
    RAISE NOTICE '========================================';
END $$;
