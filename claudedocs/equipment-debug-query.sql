-- 측정기기 수량 디버깅 쿼리
-- Supabase SQL 에디터에서 실행하세요

-- STEP 1: discharge_facilities 테이블 스키마 확인
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'discharge_facilities'
ORDER BY ordinal_position;

-- STEP 2: 영빈산업 사업장명 확인
SELECT DISTINCT business_name
FROM business_info
WHERE business_name LIKE '%영빈산업%';

-- STEP 3: prevention_facilities 데이터 확인 (컬럼명 수정됨)
SELECT
  business_name,
  ph,
  pressure,
  temperature,
  pump,
  fan
FROM prevention_facilities
WHERE business_name LIKE '%영빈산업%';

-- STEP 4: discharge_facilities 데이터 확인
-- (STEP 1에서 확인한 실제 컬럼명으로 조회)
SELECT *
FROM discharge_facilities
WHERE business_name LIKE '%영빈산업%';
