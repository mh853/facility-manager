-- ============================================================
-- STEP 1: 제조사 이름 한글로 통일 (완전 자동화 스크립트)
-- ============================================================
-- 실행 방법: Supabase Dashboard → SQL Editor → 이 스크립트 전체 복사하여 실행
--
-- 작업 내용:
-- 1. CHECK 제약 조건 삭제 (영문 → 한글 허용)
-- 2. 데이터 업데이트 (영문 → 한글)
-- 3. 새로운 CHECK 제약 조건 추가 (한글 이름)
-- ============================================================

-- 트랜잭션 시작
BEGIN;

-- ============================================================
-- 1단계: 기존 CHECK 제약 조건 삭제
-- ============================================================
ALTER TABLE manufacturer_pricing
DROP CONSTRAINT IF EXISTS manufacturer_pricing_manufacturer_check;

ALTER TABLE business_info
DROP CONSTRAINT IF EXISTS business_info_manufacturer_check;

-- ============================================================
-- 2단계: manufacturer_pricing 데이터 업데이트 (영문 → 한글)
-- ============================================================
UPDATE manufacturer_pricing
SET manufacturer = '에코센스'
WHERE LOWER(manufacturer) = 'ecosense';

UPDATE manufacturer_pricing
SET manufacturer = '클린어스'
WHERE LOWER(manufacturer) = 'cleanearth';

UPDATE manufacturer_pricing
SET manufacturer = '가이아씨앤에스'
WHERE LOWER(manufacturer) IN ('gaia_cns', 'gaia cns', 'gaiacns');

UPDATE manufacturer_pricing
SET manufacturer = '이브이에스'
WHERE LOWER(manufacturer) IN ('evs', 'e v s');

-- ============================================================
-- 3단계: business_info 데이터 업데이트
-- ============================================================

-- NULL 또는 빈 값을 '에코센스'로 설정
UPDATE business_info
SET manufacturer = '에코센스'
WHERE manufacturer IS NULL OR TRIM(manufacturer) = '';

-- 영문 제조사명을 한글로 변환
UPDATE business_info
SET manufacturer = '에코센스'
WHERE LOWER(manufacturer) IN ('ecosense', 'eco sense', 'eco-sense');

UPDATE business_info
SET manufacturer = '클린어스'
WHERE LOWER(manufacturer) IN ('cleanearth', 'clean earth', 'clean-earth', '크린어스');

UPDATE business_info
SET manufacturer = '가이아씨앤에스'
WHERE LOWER(manufacturer) IN ('gaia_cns', 'gaia cns', 'gaiacns', 'gaia', '가이아');

UPDATE business_info
SET manufacturer = '이브이에스'
WHERE LOWER(manufacturer) IN ('evs', 'e v s', 'e.v.s');

-- ============================================================
-- 4단계: 새로운 CHECK 제약 조건 추가 (한글 이름만 허용)
-- ============================================================
ALTER TABLE manufacturer_pricing
ADD CONSTRAINT manufacturer_pricing_manufacturer_check
CHECK (manufacturer IN ('에코센스', '클린어스', '가이아씨앤에스', '이브이에스'));

ALTER TABLE business_info
ADD CONSTRAINT business_info_manufacturer_check
CHECK (manufacturer IN ('에코센스', '클린어스', '가이아씨앤에스', '이브이에스'));

-- ============================================================
-- 5단계: 결과 확인
-- ============================================================

-- business_info 제조사 분포 확인
SELECT
    'business_info' as table_name,
    manufacturer,
    COUNT(*) as count
FROM business_info
WHERE is_deleted = false AND is_active = true
GROUP BY manufacturer
ORDER BY count DESC;

-- manufacturer_pricing 제조사 분포 확인
SELECT
    'manufacturer_pricing' as table_name,
    manufacturer,
    COUNT(*) as equipment_count
FROM manufacturer_pricing
WHERE is_active = true
GROUP BY manufacturer
ORDER BY equipment_count DESC;

-- 제약 조건 확인
SELECT
    conrelid::regclass AS table_name,
    conname as constraint_name,
    pg_get_constraintdef(oid) as constraint_definition
FROM pg_constraint
WHERE conname LIKE '%manufacturer%check%'
AND conrelid IN (
    'manufacturer_pricing'::regclass,
    'business_info'::regclass
)
ORDER BY table_name;

-- 트랜잭션 커밋
COMMIT;

-- ============================================================
-- 완료 메시지
-- ============================================================
DO $$
BEGIN
    RAISE NOTICE '✅ 제조사 이름 한글 통일 완료!';
    RAISE NOTICE '   - manufacturer_pricing: 영문 → 한글 변환 완료';
    RAISE NOTICE '   - business_info: NULL → 에코센스, 영문 → 한글 변환 완료';
    RAISE NOTICE '   - CHECK 제약 조건: 한글 이름만 허용하도록 수정 완료';
END $$;
