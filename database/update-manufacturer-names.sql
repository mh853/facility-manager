-- 제조사명을 영어에서 한글로 변경
-- 2025-09-04

BEGIN;

-- 영어 제조사명을 한글로 업데이트
UPDATE business_info SET 
  manufacturer = '에코센스',
  updated_at = NOW()
WHERE manufacturer = 'ecosense';

UPDATE business_info SET 
  manufacturer = '가이아씨앤에스', 
  updated_at = NOW()
WHERE manufacturer = 'gaia_cns';

UPDATE business_info SET 
  manufacturer = '이브이에스',
  updated_at = NOW()  
WHERE manufacturer = 'evs';

-- 결과 확인
SELECT manufacturer, COUNT(*) as count 
FROM business_info 
WHERE is_active = true AND is_deleted = false
GROUP BY manufacturer 
ORDER BY manufacturer;

COMMIT;