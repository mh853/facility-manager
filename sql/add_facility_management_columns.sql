-- 시설 관리 정보 컬럼 추가
-- 실행 위치: Supabase SQL Editor

-- 1. 프로젝트 관리 필드 추가
ALTER TABLE public.business_info
ADD COLUMN IF NOT EXISTS installation_phase VARCHAR(50) DEFAULT 'presurvey'
    CHECK (installation_phase IN ('presurvey', 'installation', 'completed'));

ALTER TABLE public.business_info
ADD COLUMN IF NOT EXISTS surveyor_name VARCHAR(100);

ALTER TABLE public.business_info
ADD COLUMN IF NOT EXISTS surveyor_contact VARCHAR(50);

ALTER TABLE public.business_info
ADD COLUMN IF NOT EXISTS surveyor_company VARCHAR(100);

ALTER TABLE public.business_info
ADD COLUMN IF NOT EXISTS survey_date DATE;

ALTER TABLE public.business_info
ADD COLUMN IF NOT EXISTS installation_date DATE;

ALTER TABLE public.business_info
ADD COLUMN IF NOT EXISTS completion_date DATE;

ALTER TABLE public.business_info
ADD COLUMN IF NOT EXISTS special_notes TEXT;

-- 2. 인덱스 생성 (성능 최적화)
CREATE INDEX IF NOT EXISTS idx_business_info_installation_phase
ON public.business_info(installation_phase);

CREATE INDEX IF NOT EXISTS idx_business_info_surveyor
ON public.business_info(surveyor_name);

CREATE INDEX IF NOT EXISTS idx_business_info_dates
ON public.business_info(survey_date, installation_date, completion_date);

-- 3. 컬럼 설명 추가
COMMENT ON COLUMN public.business_info.installation_phase IS '설치 단계: presurvey(설치 전 실사), installation(장비 설치), completed(설치 후 검수)';
COMMENT ON COLUMN public.business_info.surveyor_name IS '실사자 이름';
COMMENT ON COLUMN public.business_info.surveyor_contact IS '실사자 연락처';
COMMENT ON COLUMN public.business_info.surveyor_company IS '실사자 소속 회사';
COMMENT ON COLUMN public.business_info.survey_date IS '실사 일자';
COMMENT ON COLUMN public.business_info.installation_date IS '설치 일자';
COMMENT ON COLUMN public.business_info.completion_date IS '완료 일자';
COMMENT ON COLUMN public.business_info.special_notes IS '특이사항';

-- 4. 확인 쿼리
SELECT column_name, data_type, character_maximum_length, column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'business_info'
  AND column_name IN (
    'installation_phase',
    'surveyor_name',
    'surveyor_contact',
    'surveyor_company',
    'survey_date',
    'installation_date',
    'completion_date',
    'special_notes'
  )
ORDER BY column_name;
