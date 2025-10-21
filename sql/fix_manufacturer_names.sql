-- 제조사 이름 한글로 통일
-- 목적: manufacturer_pricing 테이블의 영문 제조사명을 한글로 변경

-- 1. manufacturer_pricing 테이블 업데이트 (영문 → 한글)
UPDATE manufacturer_pricing
SET manufacturer = '에코센스'
WHERE LOWER(manufacturer) = 'ecosense';

UPDATE manufacturer_pricing
SET manufacturer = '클린어스'
WHERE LOWER(manufacturer) = 'cleanearth';

-- 추가 제조사가 있다면 여기에 추가
-- UPDATE manufacturer_pricing
-- SET manufacturer = '한글이름'
-- WHERE LOWER(manufacturer) = '영문이름';

-- 2. business_info 테이블에서 NULL 제조사를 '에코센스'로 설정
UPDATE business_info
SET manufacturer = '에코센스'
WHERE manufacturer IS NULL OR TRIM(manufacturer) = '';

-- 3. 영문으로 입력된 제조사명이 있다면 한글로 변환
UPDATE business_info
SET manufacturer = '에코센스'
WHERE LOWER(manufacturer) IN ('ecosense', 'eco sense', 'eco-sense');

UPDATE business_info
SET manufacturer = '클린어스'
WHERE LOWER(manufacturer) IN ('cleanearth', 'clean earth', 'clean-earth');

-- 4. 확인 쿼리
SELECT
    manufacturer,
    COUNT(*) as count
FROM business_info
WHERE is_deleted = false AND is_active = true
GROUP BY manufacturer
ORDER BY count DESC;

SELECT
    manufacturer,
    COUNT(*) as equipment_count
FROM manufacturer_pricing
WHERE is_active = true
GROUP BY manufacturer
ORDER BY equipment_count DESC;
