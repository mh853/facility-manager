-- 시설 측정기기 정보 컬럼 추가 마이그레이션
-- 실행 위치: Supabase SQL Editor
-- 작성일: 2025-11-06

-- ============================================================================
-- 1. outlets_facilities 테이블에 측정기기 관련 컬럼 추가
-- ============================================================================

-- 측정기기 수량
ALTER TABLE public.outlets_facilities
ADD COLUMN IF NOT EXISTS measurement_device_count INTEGER DEFAULT 0;

-- 측정기기 면제사유
ALTER TABLE public.outlets_facilities
ADD COLUMN IF NOT EXISTS exemption_reason TEXT;

-- 비고(특이사항)
ALTER TABLE public.outlets_facilities
ADD COLUMN IF NOT EXISTS remarks TEXT;

-- 최종 수정 시각
ALTER TABLE public.outlets_facilities
ADD COLUMN IF NOT EXISTS last_updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();

-- 최종 수정자
ALTER TABLE public.outlets_facilities
ADD COLUMN IF NOT EXISTS last_updated_by VARCHAR(100);

-- ============================================================================
-- 2. 인덱스 생성 (성능 최적화)
-- ============================================================================

-- business_id 인덱스 (이미 있을 수 있음)
CREATE INDEX IF NOT EXISTS idx_outlets_facilities_business_id
ON public.outlets_facilities(business_id);

-- facility_type 인덱스
CREATE INDEX IF NOT EXISTS idx_outlets_facilities_facility_type
ON public.outlets_facilities(facility_type);

-- 측정기기 수량 인덱스 (통계 쿼리 최적화)
CREATE INDEX IF NOT EXISTS idx_outlets_facilities_measurement_device_count
ON public.outlets_facilities(measurement_device_count);

-- 최종 수정 시각 인덱스 (최근 수정 항목 조회 최적화)
CREATE INDEX IF NOT EXISTS idx_outlets_facilities_last_updated_at
ON public.outlets_facilities(last_updated_at DESC);

-- ============================================================================
-- 3. 컬럼 설명 추가 (문서화)
-- ============================================================================

COMMENT ON COLUMN public.outlets_facilities.measurement_device_count IS '측정기기 수량';
COMMENT ON COLUMN public.outlets_facilities.exemption_reason IS '측정기기 면제사유 (예: 배출농도가 허용기준의 30% 이하)';
COMMENT ON COLUMN public.outlets_facilities.remarks IS '비고(특이사항) - 추가 메모 및 주의사항';
COMMENT ON COLUMN public.outlets_facilities.last_updated_at IS '최종 수정 시각';
COMMENT ON COLUMN public.outlets_facilities.last_updated_by IS '최종 수정자';

-- ============================================================================
-- 4. 트리거 생성: 자동 updated_at 갱신
-- ============================================================================

-- 트리거 함수 생성 (이미 있으면 재생성)
CREATE OR REPLACE FUNCTION update_outlets_facilities_last_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.last_updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 트리거 생성
DROP TRIGGER IF EXISTS trigger_update_outlets_facilities_last_updated_at ON public.outlets_facilities;

CREATE TRIGGER trigger_update_outlets_facilities_last_updated_at
BEFORE UPDATE ON public.outlets_facilities
FOR EACH ROW
EXECUTE FUNCTION update_outlets_facilities_last_updated_at();

-- ============================================================================
-- 5. 확인 쿼리
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
  AND table_name = 'outlets_facilities'
  AND column_name IN (
    'measurement_device_count',
    'exemption_reason',
    'remarks',
    'last_updated_at',
    'last_updated_by'
  )
ORDER BY column_name;

-- 인덱스 확인
SELECT
  indexname,
  indexdef
FROM pg_indexes
WHERE tablename = 'outlets_facilities'
  AND schemaname = 'public'
ORDER BY indexname;

-- 트리거 확인
SELECT
  trigger_name,
  event_manipulation,
  event_object_table,
  action_statement
FROM information_schema.triggers
WHERE event_object_table = 'outlets_facilities'
  AND trigger_schema = 'public';

-- ============================================================================
-- 6. 샘플 데이터 업데이트 (선택사항)
-- ============================================================================

-- 특정 시설의 측정기기 정보 업데이트 예시
/*
UPDATE public.outlets_facilities
SET
  measurement_device_count = 1,
  exemption_reason = NULL,
  remarks = '정기점검 필요',
  last_updated_by = '관리자'
WHERE id = 'your-facility-id-here';
*/

-- ============================================================================
-- 마이그레이션 완료
-- ============================================================================

-- 결과 메시지
DO $$
BEGIN
  RAISE NOTICE '✅ 시설 측정기기 관리 컬럼 추가 완료';
  RAISE NOTICE '   - measurement_device_count: 측정기기 수량';
  RAISE NOTICE '   - exemption_reason: 면제사유';
  RAISE NOTICE '   - remarks: 비고';
  RAISE NOTICE '   - last_updated_at: 최종 수정 시각';
  RAISE NOTICE '   - last_updated_by: 최종 수정자';
  RAISE NOTICE '✅ 인덱스 4개 생성 완료';
  RAISE NOTICE '✅ 자동 updated_at 트리거 생성 완료';
END $$;
