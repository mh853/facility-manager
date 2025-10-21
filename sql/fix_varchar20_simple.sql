-- =====================================================
-- VARCHAR(20) 제한 문제 해결 (간소화 버전)
-- 목적: 실제 존재하는 컬럼만 수정
-- =====================================================

BEGIN;

-- 1. 제조사 컬럼 (20 → 100)
ALTER TABLE business_info
ALTER COLUMN manufacturer TYPE VARCHAR(100);

-- 2. category 컬럼 (20 → 100)
ALTER TABLE business_info
ALTER COLUMN category TYPE VARCHAR(100);

-- 3. 연락처 관련 컬럼 (20 → 100)
ALTER TABLE business_info
ALTER COLUMN business_contact TYPE VARCHAR(100);

ALTER TABLE business_info
ALTER COLUMN manager_contact TYPE VARCHAR(100);

ALTER TABLE business_info
ALTER COLUMN fax_number TYPE VARCHAR(100);

-- 4. 사업자등록번호 (20 → 50)
ALTER TABLE business_info
ALTER COLUMN business_registration_number TYPE VARCHAR(50);

COMMIT;

-- 확인 쿼리
SELECT
    '✅ VARCHAR(20) 제한 문제 해결 완료!' as message;

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
