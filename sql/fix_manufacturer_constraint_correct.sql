-- 제조사 CHECK 제약 조건 올바른 이름으로 수정
-- 크린어스 (클린어스 아님)

BEGIN;

-- 1. 기존 CHECK 제약 조건 삭제
ALTER TABLE business_info
DROP CONSTRAINT IF EXISTS business_info_manufacturer_check;

ALTER TABLE manufacturer_pricing
DROP CONSTRAINT IF EXISTS manufacturer_pricing_manufacturer_check;

-- 2. 데이터 업데이트 (잘못된 이름 수정)
UPDATE business_info
SET manufacturer = '크린어스'
WHERE manufacturer IN ('클린어스', 'cleanearth', 'clean earth');

UPDATE manufacturer_pricing
SET manufacturer = '크린어스'
WHERE manufacturer IN ('클린어스', 'cleanearth', 'clean earth');

-- 3. 새로운 CHECK 제약 조건 추가 (올바른 이름)
ALTER TABLE business_info
ADD CONSTRAINT business_info_manufacturer_check
CHECK (manufacturer IN ('에코센스', '크린어스', '가이아씨앤에스', '이브이에스'));

ALTER TABLE manufacturer_pricing
ADD CONSTRAINT manufacturer_pricing_manufacturer_check
CHECK (manufacturer IN ('에코센스', '크린어스', '가이아씨앤에스', '이브이에스'));

COMMIT;

-- 확인
SELECT
    manufacturer,
    COUNT(*) as count
FROM business_info
WHERE is_deleted = false AND is_active = true
GROUP BY manufacturer
ORDER BY count DESC;
