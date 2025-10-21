-- 제조사 CHECK 제약 조건을 한글 이름으로 변경
-- 목적: manufacturer_pricing 테이블에서 한글 제조사명 사용 가능하도록 수정

-- 1. 기존 CHECK 제약 조건 삭제
ALTER TABLE manufacturer_pricing
DROP CONSTRAINT IF EXISTS manufacturer_pricing_manufacturer_check;

-- 2. 새로운 CHECK 제약 조건 추가 (한글 제조사명)
ALTER TABLE manufacturer_pricing
ADD CONSTRAINT manufacturer_pricing_manufacturer_check
CHECK (manufacturer IN ('에코센스', '클린어스', '가이아씨앤에스', '이브이에스'));

-- 3. business_info 테이블도 동일하게 수정
ALTER TABLE business_info
DROP CONSTRAINT IF EXISTS business_info_manufacturer_check;

ALTER TABLE business_info
ADD CONSTRAINT business_info_manufacturer_check
CHECK (manufacturer IN ('에코센스', '클린어스', '가이아씨앤에스', '이브이에스'));

-- 4. 확인
SELECT
    conname as constraint_name,
    pg_get_constraintdef(oid) as constraint_definition
FROM pg_constraint
WHERE conname LIKE '%manufacturer%check%'
AND conrelid IN (
    'manufacturer_pricing'::regclass,
    'business_info'::regclass
);
