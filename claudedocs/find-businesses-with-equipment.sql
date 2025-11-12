-- 측정기기 데이터가 있는 사업장 찾기

-- 1. prevention_facilities에 데이터가 있는 사업장 (방지시설 측정기기)
SELECT DISTINCT
  business_name,
  COUNT(*) as facility_count,
  SUM(CASE WHEN ph IS NOT NULL AND ph != '면제' AND ph != '없음' THEN 1 ELSE 0 END) as ph_count,
  SUM(CASE WHEN pressure IS NOT NULL AND pressure != '면제' AND pressure != '없음' THEN 1 ELSE 0 END) as pressure_count,
  SUM(CASE WHEN temperature IS NOT NULL AND temperature != '면제' AND temperature != '없음' THEN 1 ELSE 0 END) as temperature_count,
  SUM(CASE WHEN pump IS NOT NULL AND pump != '면제' AND pump != '없음' THEN 1 ELSE 0 END) as pump_count,
  SUM(CASE WHEN fan IS NOT NULL AND fan != '면제' AND fan != '없음' THEN 1 ELSE 0 END) as fan_count
FROM prevention_facilities
GROUP BY business_name
HAVING
  SUM(CASE WHEN ph IS NOT NULL AND ph != '면제' AND ph != '없음' THEN 1 ELSE 0 END) > 0 OR
  SUM(CASE WHEN pressure IS NOT NULL AND pressure != '면제' AND pressure != '없음' THEN 1 ELSE 0 END) > 0 OR
  SUM(CASE WHEN temperature IS NOT NULL AND temperature != '면제' AND temperature != '없음' THEN 1 ELSE 0 END) > 0 OR
  SUM(CASE WHEN pump IS NOT NULL AND pump != '면제' AND pump != '없음' THEN 1 ELSE 0 END) > 0 OR
  SUM(CASE WHEN fan IS NOT NULL AND fan != '면제' AND fan != '없음' THEN 1 ELSE 0 END) > 0
ORDER BY facility_count DESC
LIMIT 10;

-- 2. discharge_facilities에 데이터가 있는 사업장 찾기
-- (먼저 STEP 1의 스키마 확인 후 올바른 컬럼명으로 수정 필요)
-- SELECT DISTINCT business_name
-- FROM discharge_facilities
-- WHERE [배출전류계_컬럼명] IS NOT NULL
-- LIMIT 10;
