-- 영빈산업 관련 사업장의 정확한 이름 확인

-- 1. business_info에서 확인
SELECT
  id,
  business_name,
  LENGTH(business_name) as name_length,
  -- 공백 확인을 위해 ASCII 코드 확인
  ascii(substring(business_name, 1, 1)) as first_char_ascii,
  ascii(substring(business_name, 4, 1)) as fourth_char_ascii
FROM business_info
WHERE business_name LIKE '%영빈산업%';

-- 2. prevention_facilities에 있는 사업장명 확인
SELECT DISTINCT
  business_name,
  LENGTH(business_name) as name_length,
  COUNT(*) as facility_count
FROM prevention_facilities
WHERE business_name LIKE '%영빈산업%'
GROUP BY business_name;

-- 3. discharge_facilities에 있는 사업장명 확인
SELECT DISTINCT
  business_name,
  LENGTH(business_name) as name_length,
  COUNT(*) as facility_count
FROM discharge_facilities
WHERE business_name LIKE '%영빈산업%'
GROUP BY business_name;

-- 4. 모든 테이블의 사업장명 비교
SELECT
  'business_info' as table_name,
  business_name
FROM business_info
WHERE business_name LIKE '%영빈산업%'
UNION ALL
SELECT
  'prevention_facilities' as table_name,
  business_name
FROM prevention_facilities
WHERE business_name LIKE '%영빈산업%'
UNION ALL
SELECT
  'discharge_facilities' as table_name,
  business_name
FROM discharge_facilities
WHERE business_name LIKE '%영빈산업%';
