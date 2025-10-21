-- =====================================================
-- VARCHAR(20) 제한 문제 해결 (View 처리 버전)
-- 목적: View를 임시 삭제 후 컬럼 수정, 다시 생성
-- =====================================================

BEGIN;

-- 1. 의존하는 뷰 백업 및 삭제
-- facility_tasks_with_business 뷰의 정의를 저장하고 삭제
DO $$
DECLARE
    view_definition TEXT;
BEGIN
    -- 뷰 정의 가져오기
    SELECT pg_get_viewdef('facility_tasks_with_business', true) INTO view_definition;

    -- 뷰 정의 출력 (로그)
    RAISE NOTICE '백업된 뷰 정의: %', view_definition;

    -- 뷰 삭제
    DROP VIEW IF EXISTS facility_tasks_with_business CASCADE;

    RAISE NOTICE 'facility_tasks_with_business 뷰를 삭제했습니다.';
END $$;

-- 2. 다른 의존 뷰들도 확인 및 삭제
DROP VIEW IF EXISTS business_stats CASCADE;
DROP VIEW IF EXISTS business_with_tasks CASCADE;

-- 3. 컬럼 타입 변경
-- 제조사 (20 → 100)
ALTER TABLE business_info
ALTER COLUMN manufacturer TYPE VARCHAR(100);

-- category (20 → 100)
ALTER TABLE business_info
ALTER COLUMN category TYPE VARCHAR(100);

-- 연락처 관련 (20 → 100)
ALTER TABLE business_info
ALTER COLUMN business_contact TYPE VARCHAR(100);

ALTER TABLE business_info
ALTER COLUMN manager_contact TYPE VARCHAR(100);

ALTER TABLE business_info
ALTER COLUMN fax_number TYPE VARCHAR(100);

-- 사업자등록번호 (20 → 50)
ALTER TABLE business_info
ALTER COLUMN business_registration_number TYPE VARCHAR(50);

-- 4. facility_tasks_with_business 뷰 재생성
-- 원본 뷰 정의를 기반으로 재생성
CREATE OR REPLACE VIEW facility_tasks_with_business AS
SELECT
    ft.*,
    bi.address,
    bi.manager_name,
    bi.manager_contact,
    bi.local_government,
    bi.sales_office,
    bi.manufacturer
FROM facility_tasks ft
LEFT JOIN business_info bi ON ft.business_name = bi.business_name
WHERE ft.is_deleted = false;

-- 5. 다른 뷰들도 재생성 (존재했던 경우)
-- business_stats 뷰 (02_business_schema.sql 참조)
CREATE OR REPLACE VIEW business_stats AS
SELECT
    COUNT(*) as total_businesses,
    COUNT(*) FILTER (WHERE is_active = true AND is_deleted = false) as active_businesses,
    COUNT(*) FILTER (WHERE manufacturer = '에코센스') as ecosense_count,
    COUNT(*) FILTER (WHERE manufacturer = '크린어스') as cleanearth_count,
    COUNT(*) FILTER (WHERE manufacturer = '가이아씨앤에스') as gaia_cns_count,
    COUNT(*) FILTER (WHERE manufacturer = '이브이에스') as evs_count,
    COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '30 days') as new_businesses_30d
FROM business_info;

COMMIT;

-- 6. 확인 쿼리
SELECT
    '✅ VARCHAR(20) 제한 문제 해결 완료!' as message,
    '✅ 뷰 재생성 완료!' as view_status;

-- 수정된 컬럼 확인
SELECT
    column_name,
    character_maximum_length as length,
    CASE
        WHEN character_maximum_length <= 20 THEN '⚠️ 여전히 20자 제한'
        WHEN character_maximum_length BETWEEN 21 AND 50 THEN '✅ 50자로 확대'
        WHEN character_maximum_length > 50 THEN '✅ 100자로 확대'
        ELSE '♾️ 무제한'
    END as status
FROM information_schema.columns
WHERE table_schema = 'public'
    AND table_name = 'business_info'
    AND column_name IN (
        'manufacturer',
        'category',
        'business_contact',
        'manager_contact',
        'fax_number',
        'business_registration_number'
    )
ORDER BY character_maximum_length ASC;

-- 뷰 존재 확인
SELECT
    table_name as view_name,
    '✅ 재생성됨' as status
FROM information_schema.views
WHERE table_schema = 'public'
    AND table_name IN ('facility_tasks_with_business', 'business_stats')
ORDER BY table_name;
