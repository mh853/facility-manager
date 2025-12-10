-- 누락된 컬럼을 기존 테이블에 추가하는 마이그레이션 스크립트
-- Supabase SQL Editor에서 실행

-- 1. air_permit_info 테이블에 누락된 컬럼 추가
DO $$
BEGIN
    -- permit_number 컬럼 추가
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'air_permit_info'
        AND column_name = 'permit_number'
    ) THEN
        ALTER TABLE public.air_permit_info
        ADD COLUMN permit_number VARCHAR(100);

        RAISE NOTICE '✅ permit_number 컬럼 추가 완료';
    ELSE
        RAISE NOTICE '⏭️ permit_number 컬럼이 이미 존재합니다';
    END IF;

    -- business_type 컬럼 추가
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'air_permit_info'
        AND column_name = 'business_type'
    ) THEN
        ALTER TABLE public.air_permit_info
        ADD COLUMN business_type VARCHAR(200);

        RAISE NOTICE '✅ business_type 컬럼 추가 완료';
    ELSE
        RAISE NOTICE '⏭️ business_type 컬럼이 이미 존재합니다';
    END IF;

    -- annual_emission_amount 컬럼 추가
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'air_permit_info'
        AND column_name = 'annual_emission_amount'
    ) THEN
        ALTER TABLE public.air_permit_info
        ADD COLUMN annual_emission_amount DECIMAL(15,2);

        RAISE NOTICE '✅ annual_emission_amount 컬럼 추가 완료';
    ELSE
        RAISE NOTICE '⏭️ annual_emission_amount 컬럼이 이미 존재합니다';
    END IF;

    -- first_report_date 컬럼 추가
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'air_permit_info'
        AND column_name = 'first_report_date'
    ) THEN
        ALTER TABLE public.air_permit_info
        ADD COLUMN first_report_date DATE;

        RAISE NOTICE '✅ first_report_date 컬럼 추가 완료';
    ELSE
        RAISE NOTICE '⏭️ first_report_date 컬럼이 이미 존재합니다';
    END IF;

    -- operation_start_date 컬럼 추가
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'air_permit_info'
        AND column_name = 'operation_start_date'
    ) THEN
        ALTER TABLE public.air_permit_info
        ADD COLUMN operation_start_date DATE;

        RAISE NOTICE '✅ operation_start_date 컬럼 추가 완료';
    ELSE
        RAISE NOTICE '⏭️ operation_start_date 컬럼이 이미 존재합니다';
    END IF;

    -- permit_expiry_date 컬럼 추가
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'air_permit_info'
        AND column_name = 'permit_expiry_date'
    ) THEN
        ALTER TABLE public.air_permit_info
        ADD COLUMN permit_expiry_date DATE;

        RAISE NOTICE '✅ permit_expiry_date 컬럼 추가 완료';
    ELSE
        RAISE NOTICE '⏭️ permit_expiry_date 컬럼이 이미 존재합니다';
    END IF;

    -- pollutants 컬럼 추가
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'air_permit_info'
        AND column_name = 'pollutants'
    ) THEN
        ALTER TABLE public.air_permit_info
        ADD COLUMN pollutants JSONB DEFAULT '[]';

        RAISE NOTICE '✅ pollutants 컬럼 추가 완료';
    ELSE
        RAISE NOTICE '⏭️ pollutants 컬럼이 이미 존재합니다';
    END IF;

    -- emission_limits 컬럼 추가
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'air_permit_info'
        AND column_name = 'emission_limits'
    ) THEN
        ALTER TABLE public.air_permit_info
        ADD COLUMN emission_limits JSONB DEFAULT '{}';

        RAISE NOTICE '✅ emission_limits 컬럼 추가 완료';
    ELSE
        RAISE NOTICE '⏭️ emission_limits 컬럼이 이미 존재합니다';
    END IF;

END $$;

-- 2. 인덱스 생성 (없을 경우에만)
CREATE INDEX IF NOT EXISTS idx_air_permit_number ON public.air_permit_info(permit_number);

-- 3. 확인 쿼리
SELECT
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_name = 'air_permit_info'
AND table_schema = 'public'
ORDER BY ordinal_position;

-- 결과 확인 메시지
DO $$
BEGIN
    RAISE NOTICE '========================================';
    RAISE NOTICE '✅ air_permit_info 테이블 업데이트 완료';
    RAISE NOTICE '========================================';
END $$;
