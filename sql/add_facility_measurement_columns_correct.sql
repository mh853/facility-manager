-- 시설 측정기기 정보 컬럼 추가 마이그레이션 (수정본)
-- 실행 위치: Supabase SQL Editor
-- 작성일: 2025-11-06

-- ============================================================================
-- 1. discharge_facilities 테이블에 측정기기 관련 컬럼 추가
-- ============================================================================

-- 측정기기 수량
ALTER TABLE public.discharge_facilities
ADD COLUMN IF NOT EXISTS measurement_device_count INTEGER DEFAULT 0;

-- 측정기기 면제사유
ALTER TABLE public.discharge_facilities
ADD COLUMN IF NOT EXISTS exemption_reason TEXT;

-- 비고(특이사항)
ALTER TABLE public.discharge_facilities
ADD COLUMN IF NOT EXISTS remarks TEXT;

-- 최종 수정 시각
ALTER TABLE public.discharge_facilities
ADD COLUMN IF NOT EXISTS last_updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();

-- 최종 수정자
ALTER TABLE public.discharge_facilities
ADD COLUMN IF NOT EXISTS last_updated_by VARCHAR(100);

-- ============================================================================
-- 2. prevention_facilities 테이블에 측정기기 관련 컬럼 추가
-- ============================================================================

-- 측정기기 수량
ALTER TABLE public.prevention_facilities
ADD COLUMN IF NOT EXISTS measurement_device_count INTEGER DEFAULT 0;

-- 측정기기 면제사유
ALTER TABLE public.prevention_facilities
ADD COLUMN IF NOT EXISTS exemption_reason TEXT;

-- 비고(특이사항)
ALTER TABLE public.prevention_facilities
ADD COLUMN IF NOT EXISTS remarks TEXT;

-- 최종 수정 시각
ALTER TABLE public.prevention_facilities
ADD COLUMN IF NOT EXISTS last_updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();

-- 최종 수정자
ALTER TABLE public.prevention_facilities
ADD COLUMN IF NOT EXISTS last_updated_by VARCHAR(100);

-- ============================================================================
-- 3. discharge_facilities 인덱스 생성 (성능 최적화)
-- ============================================================================

-- 측정기기 수량 인덱스
CREATE INDEX IF NOT EXISTS idx_discharge_facilities_measurement_device_count
ON public.discharge_facilities(measurement_device_count);

-- 최종 수정 시각 인덱스
CREATE INDEX IF NOT EXISTS idx_discharge_facilities_last_updated_at
ON public.discharge_facilities(last_updated_at DESC);

-- ============================================================================
-- 4. prevention_facilities 인덱스 생성 (성능 최적화)
-- ============================================================================

-- 측정기기 수량 인덱스
CREATE INDEX IF NOT EXISTS idx_prevention_facilities_measurement_device_count
ON public.prevention_facilities(measurement_device_count);

-- 최종 수정 시각 인덱스
CREATE INDEX IF NOT EXISTS idx_prevention_facilities_last_updated_at
ON public.prevention_facilities(last_updated_at DESC);

-- ============================================================================
-- 5. 컬럼 설명 추가 (문서화) - discharge_facilities
-- ============================================================================

COMMENT ON COLUMN public.discharge_facilities.measurement_device_count IS '측정기기 수량';
COMMENT ON COLUMN public.discharge_facilities.exemption_reason IS '측정기기 면제사유 (예: 배출농도가 허용기준의 30% 이하)';
COMMENT ON COLUMN public.discharge_facilities.remarks IS '비고(특이사항) - 추가 메모 및 주의사항';
COMMENT ON COLUMN public.discharge_facilities.last_updated_at IS '최종 수정 시각';
COMMENT ON COLUMN public.discharge_facilities.last_updated_by IS '최종 수정자';

-- ============================================================================
-- 6. 컬럼 설명 추가 (문서화) - prevention_facilities
-- ============================================================================

COMMENT ON COLUMN public.prevention_facilities.measurement_device_count IS '측정기기 수량';
COMMENT ON COLUMN public.prevention_facilities.exemption_reason IS '측정기기 면제사유 (예: 배출농도가 허용기준의 30% 이하)';
COMMENT ON COLUMN public.prevention_facilities.remarks IS '비고(특이사항) - 추가 메모 및 주의사항';
COMMENT ON COLUMN public.prevention_facilities.last_updated_at IS '최종 수정 시각';
COMMENT ON COLUMN public.prevention_facilities.last_updated_by IS '최종 수정자';

-- ============================================================================
-- 7. 트리거 생성: 자동 updated_at 갱신 - discharge_facilities
-- ============================================================================

CREATE OR REPLACE FUNCTION update_discharge_facilities_last_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.last_updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_discharge_facilities_last_updated_at ON public.discharge_facilities;

CREATE TRIGGER trigger_update_discharge_facilities_last_updated_at
BEFORE UPDATE ON public.discharge_facilities
FOR EACH ROW
EXECUTE FUNCTION update_discharge_facilities_last_updated_at();

-- ============================================================================
-- 8. 트리거 생성: 자동 updated_at 갱신 - prevention_facilities
-- ============================================================================

CREATE OR REPLACE FUNCTION update_prevention_facilities_last_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.last_updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_prevention_facilities_last_updated_at ON public.prevention_facilities;

CREATE TRIGGER trigger_update_prevention_facilities_last_updated_at
BEFORE UPDATE ON public.prevention_facilities
FOR EACH ROW
EXECUTE FUNCTION update_prevention_facilities_last_updated_at();

-- ============================================================================
-- 9. 확인 쿼리 - discharge_facilities
-- ============================================================================

-- 새로 추가된 컬럼 확인
SELECT
  column_name,
  data_type,
  character_maximum_length,
  column_default,
  is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'discharge_facilities'
  AND column_name IN (
    'measurement_device_count',
    'exemption_reason',
    'remarks',
    'last_updated_at',
    'last_updated_by'
  )
ORDER BY column_name;

-- ============================================================================
-- 10. 확인 쿼리 - prevention_facilities
-- ============================================================================

-- 새로 추가된 컬럼 확인
SELECT
  column_name,
  data_type,
  character_maximum_length,
  column_default,
  is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'prevention_facilities'
  AND column_name IN (
    'measurement_device_count',
    'exemption_reason',
    'remarks',
    'last_updated_at',
    'last_updated_by'
  )
ORDER BY column_name;

-- ============================================================================
-- 마이그레이션 완료
-- ============================================================================

-- 결과 메시지
DO $$
BEGIN
  RAISE NOTICE '✅ discharge_facilities 테이블 측정기기 관리 컬럼 추가 완료';
  RAISE NOTICE '   - measurement_device_count: 측정기기 수량';
  RAISE NOTICE '   - exemption_reason: 면제사유';
  RAISE NOTICE '   - remarks: 비고';
  RAISE NOTICE '   - last_updated_at: 최종 수정 시각';
  RAISE NOTICE '   - last_updated_by: 최종 수정자';
  RAISE NOTICE '';
  RAISE NOTICE '✅ prevention_facilities 테이블 측정기기 관리 컬럼 추가 완료';
  RAISE NOTICE '   - measurement_device_count: 측정기기 수량';
  RAISE NOTICE '   - exemption_reason: 면제사유';
  RAISE NOTICE '   - remarks: 비고';
  RAISE NOTICE '   - last_updated_at: 최종 수정 시각';
  RAISE NOTICE '   - last_updated_by: 최종 수정자';
  RAISE NOTICE '';
  RAISE NOTICE '✅ 인덱스 4개 생성 완료';
  RAISE NOTICE '✅ 자동 updated_at 트리거 2개 생성 완료';
END $$;
