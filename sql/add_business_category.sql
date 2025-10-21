-- 사업장 정보 테이블에 category 필드 추가
-- 보조금(subsidy) / 자비(self-funded) 구분용

-- 1. category 컬럼 추가
ALTER TABLE public.business_info
ADD COLUMN IF NOT EXISTS category VARCHAR(20)
CHECK (category IN ('subsidy', 'self-funded'));

-- 2. 기본값 설정 (기존 데이터는 NULL 허용)
COMMENT ON COLUMN public.business_info.category IS '사업장 카테고리: subsidy(보조금), self-funded(자비)';

-- 3. 인덱스 추가 (필터링 성능 향상)
CREATE INDEX IF NOT EXISTS idx_business_category ON public.business_info(category);

-- 4. revenue_calculations 테이블에도 category 추가 (스냅샷용)
ALTER TABLE public.revenue_calculations
ADD COLUMN IF NOT EXISTS business_category VARCHAR(20);

COMMENT ON COLUMN public.revenue_calculations.business_category IS '계산 시점의 사업장 카테고리';

-- 5. 기존 facility_tasks 데이터에서 category 정보를 business_info로 마이그레이션
-- (facility_tasks에 task_type이 있는 경우, 해당 사업장의 최근 타입으로 설정)
UPDATE public.business_info bi
SET category = (
  SELECT CASE
    WHEN ft.task_type = 'subsidy' THEN 'subsidy'
    WHEN ft.task_type = 'self' THEN 'self-funded'
    ELSE NULL
  END
  FROM public.facility_tasks ft
  WHERE ft.business_name = bi.business_name
  AND ft.task_type IN ('subsidy', 'self')
  AND ft.is_deleted = false
  ORDER BY ft.created_at DESC
  LIMIT 1
)
WHERE bi.category IS NULL;

-- 6. 아직 NULL인 경우 'self-funded'로 기본값 설정 (대부분 자비 설치)
UPDATE public.business_info
SET category = 'self-funded'
WHERE category IS NULL;

-- 7. 이후 신규 데이터는 필수로 설정하지 않음 (유연성 유지)
-- ALTER TABLE public.business_info ALTER COLUMN category SET NOT NULL;
