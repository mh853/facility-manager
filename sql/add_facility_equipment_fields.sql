-- 시설별 측정기기 세부 정보 컬럼 추가 마이그레이션
-- 실행 위치: Supabase SQL Editor
-- 작성일: 2025-11-06
-- 목적: 배출시설과 방지시설에 각각 필요한 측정기기 필드 추가

-- ============================================================================
-- 1. discharge_facilities 테이블에 배출시설 측정기기 컬럼 추가
-- ============================================================================

-- 배출CT 개수
ALTER TABLE public.discharge_facilities
ADD COLUMN IF NOT EXISTS discharge_ct VARCHAR(10) DEFAULT '0';

-- 면제사유 (기존 exemption_reason이 있다면 재활용, 없다면 추가)
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
-- 2. prevention_facilities 테이블에 방지시설 측정기기 컬럼 추가
-- ============================================================================

-- pH 센서 수량
ALTER TABLE public.prevention_facilities
ADD COLUMN IF NOT EXISTS ph VARCHAR(10) DEFAULT '0';

-- 차압계 수량
ALTER TABLE public.prevention_facilities
ADD COLUMN IF NOT EXISTS pressure VARCHAR(10) DEFAULT '0';

-- 온도계 수량
ALTER TABLE public.prevention_facilities
ADD COLUMN IF NOT EXISTS temperature VARCHAR(10) DEFAULT '0';

-- 펌프CT 수량
ALTER TABLE public.prevention_facilities
ADD COLUMN IF NOT EXISTS pump VARCHAR(10) DEFAULT '0';

-- 송풍CT 수량
ALTER TABLE public.prevention_facilities
ADD COLUMN IF NOT EXISTS fan VARCHAR(10) DEFAULT '0';

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

-- 배출CT 인덱스
CREATE INDEX IF NOT EXISTS idx_discharge_facilities_discharge_ct
ON public.discharge_facilities(discharge_ct);

-- 최종 수정 시각 인덱스
CREATE INDEX IF NOT EXISTS idx_discharge_facilities_last_updated_at
ON public.discharge_facilities(last_updated_at DESC);

-- ============================================================================
-- 4. prevention_facilities 인덱스 생성 (성능 최적화)
-- ============================================================================

-- 최종 수정 시각 인덱스
CREATE INDEX IF NOT EXISTS idx_prevention_facilities_last_updated_at
ON public.prevention_facilities(last_updated_at DESC);

-- ============================================================================
-- 5. 컬럼 설명 추가 (문서화) - discharge_facilities
-- ============================================================================

COMMENT ON COLUMN public.discharge_facilities.discharge_ct IS '배출CT 개수';
COMMENT ON COLUMN public.discharge_facilities.exemption_reason IS '측정기기 면제사유 (무동력, 통합전원, 연속공정 등)';
COMMENT ON COLUMN public.discharge_facilities.remarks IS '비고(특이사항) - 추가 메모 및 주의사항';
COMMENT ON COLUMN public.discharge_facilities.last_updated_at IS '최종 수정 시각';
COMMENT ON COLUMN public.discharge_facilities.last_updated_by IS '최종 수정자';

-- ============================================================================
-- 6. 컬럼 설명 추가 (문서화) - prevention_facilities
-- ============================================================================

COMMENT ON COLUMN public.prevention_facilities.ph IS 'pH 센서 수량';
COMMENT ON COLUMN public.prevention_facilities.pressure IS '차압계 수량';
COMMENT ON COLUMN public.prevention_facilities.temperature IS '온도계 수량';
COMMENT ON COLUMN public.prevention_facilities.pump IS '펌프CT 수량';
COMMENT ON COLUMN public.prevention_facilities.fan IS '송풍CT 수량';
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
    'discharge_ct',
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
    'ph',
    'pressure',
    'temperature',
    'pump',
    'fan',
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
  RAISE NOTICE '✅ discharge_facilities 테이블 측정기기 컬럼 추가 완료';
  RAISE NOTICE '   - discharge_ct: 배출CT 개수';
  RAISE NOTICE '   - exemption_reason: 면제사유';
  RAISE NOTICE '   - remarks: 비고';
  RAISE NOTICE '   - last_updated_at: 최종 수정 시각';
  RAISE NOTICE '   - last_updated_by: 최종 수정자';
  RAISE NOTICE '';
  RAISE NOTICE '✅ prevention_facilities 테이블 측정기기 컬럼 추가 완료';
  RAISE NOTICE '   - ph: pH 센서 수량';
  RAISE NOTICE '   - pressure: 차압계 수량';
  RAISE NOTICE '   - temperature: 온도계 수량';
  RAISE NOTICE '   - pump: 펌프CT 수량';
  RAISE NOTICE '   - fan: 송풍CT 수량';
  RAISE NOTICE '   - remarks: 비고';
  RAISE NOTICE '   - last_updated_at: 최종 수정 시각';
  RAISE NOTICE '   - last_updated_by: 최종 수정자';
  RAISE NOTICE '';
  RAISE NOTICE '✅ 인덱스 3개 생성 완료';
  RAISE NOTICE '✅ 자동 updated_at 트리거 2개 생성 완료';
END $$;
