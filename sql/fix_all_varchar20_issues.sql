-- =====================================================
-- 모든 VARCHAR(20) 제한 문제 포괄적 해결
-- 목적: 엑셀 업로드 시 발생하는 모든 길이 제한 오류 제거
-- =====================================================

BEGIN;

-- 1. 제조사 관련 (이미 실행했지만 재확인)
ALTER TABLE business_info
ALTER COLUMN manufacturer TYPE VARCHAR(100);

-- 2. category 컬럼 확대 (subsidy, self-funded 외 다른 값 가능)
-- 테이블에 category 컬럼이 있는 경우에만 실행
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
        AND table_name = 'business_info'
        AND column_name = 'category'
    ) THEN
        ALTER TABLE business_info
        ALTER COLUMN category TYPE VARCHAR(100);

        RAISE NOTICE 'category 컬럼을 VARCHAR(100)으로 확대했습니다.';
    ELSE
        RAISE NOTICE 'category 컬럼이 존재하지 않습니다.';
    END IF;
END $$;

-- 3. business_category 컬럼 확대
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
        AND table_name = 'business_info'
        AND column_name = 'business_category'
    ) THEN
        ALTER TABLE business_info
        ALTER COLUMN business_category TYPE VARCHAR(100);

        RAISE NOTICE 'business_category 컬럼을 VARCHAR(100)으로 확대했습니다.';
    ELSE
        RAISE NOTICE 'business_category 컬럼이 존재하지 않습니다.';
    END IF;
END $$;

-- 4. vpn 컬럼 (현재는 문제없지만 안전을 위해 확대)
-- wired, wireless 외에 다른 VPN 타입이 추가될 수 있음
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
        AND table_name = 'business_info'
        AND column_name = 'vpn'
    ) THEN
        ALTER TABLE business_info
        ALTER COLUMN vpn TYPE VARCHAR(50);

        RAISE NOTICE 'vpn 컬럼을 VARCHAR(50)으로 확대했습니다.';
    ELSE
        RAISE NOTICE 'vpn 컬럼이 존재하지 않습니다.';
    END IF;
END $$;

-- 5. installation_phase 컬럼 (안전성 확보)
-- presurvey, installation, completed 외 다른 단계 추가 가능
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
        AND table_name = 'business_info'
        AND column_name = 'installation_phase'
    ) THEN
        ALTER TABLE business_info
        ALTER COLUMN installation_phase TYPE VARCHAR(50);

        RAISE NOTICE 'installation_phase 컬럼을 VARCHAR(50)으로 확대했습니다.';
    ELSE
        RAISE NOTICE 'installation_phase 컬럼이 존재하지 않습니다.';
    END IF;
END $$;

-- 6. 연락처 관련 컬럼 확대 (중요!)
-- 여러 번호를 입력하거나 긴 번호 형식을 지원하기 위해
ALTER TABLE business_info
ALTER COLUMN business_contact TYPE VARCHAR(100);

ALTER TABLE business_info
ALTER COLUMN manager_contact TYPE VARCHAR(100);

ALTER TABLE business_info
ALTER COLUMN fax_number TYPE VARCHAR(100);

-- 7. 사업자등록번호 확대
-- 하이픈 포함 또는 특수 형식 지원
ALTER TABLE business_info
ALTER COLUMN business_registration_number TYPE VARCHAR(50);

-- 8. revenue_calculations 테이블도 확인 (존재하는 경우)
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_schema = 'public'
        AND table_name = 'revenue_calculations'
    ) THEN
        -- business_category 컬럼 확대
        IF EXISTS (
            SELECT 1 FROM information_schema.columns
            WHERE table_schema = 'public'
            AND table_name = 'revenue_calculations'
            AND column_name = 'business_category'
        ) THEN
            ALTER TABLE revenue_calculations
            ALTER COLUMN business_category TYPE VARCHAR(100);

            RAISE NOTICE 'revenue_calculations.business_category를 VARCHAR(100)으로 확대했습니다.';
        END IF;
    END IF;
END $$;

-- 9. manufacturer_pricing 테이블 확인 (이미 했지만 재확인)
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_schema = 'public'
        AND table_name = 'manufacturer_pricing'
    ) THEN
        ALTER TABLE manufacturer_pricing
        ALTER COLUMN manufacturer TYPE VARCHAR(100);

        RAISE NOTICE 'manufacturer_pricing.manufacturer를 VARCHAR(100)으로 확대했습니다.';
    END IF;
END $$;

COMMIT;

-- 10. 확인 쿼리: 수정된 컬럼들 확인
SELECT
    'VARCHAR(20) → VARCHAR(50/100) 확대 완료!' as message;

-- 11. 현재 모든 VARCHAR 컬럼 상태 확인
SELECT
    column_name,
    data_type,
    character_maximum_length,
    CASE
        WHEN character_maximum_length <= 20 THEN '⚠️ 주의'
        WHEN character_maximum_length BETWEEN 21 AND 50 THEN '✅ 양호'
        WHEN character_maximum_length > 50 THEN '✅ 충분'
        ELSE '♾️ 무제한'
    END as status
FROM information_schema.columns
WHERE table_schema = 'public'
    AND table_name = 'business_info'
    AND data_type LIKE '%character%'
ORDER BY
    character_maximum_length ASC NULLS LAST,
    column_name;
