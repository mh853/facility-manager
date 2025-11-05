-- 방2 사진의 facilityInfo 수정 스크립트
-- prevention_2_2 → prevention_1_2 (배출구 2 → 배출구 1)

-- 1. 먼저 확인
SELECT
  uf.id,
  uf.filename,
  uf.facility_info,
  uf.file_path,
  bi.business_name
FROM uploaded_files uf
JOIN business_info bi ON uf.business_id = bi.id
WHERE uf.facility_info LIKE '%prevention_2_2%'
  AND bi.business_name = '(주)휴비스트제약';

-- 2. 수정 (확인 후 실행)
-- UPDATE uploaded_files uf
-- SET facility_info = REPLACE(uf.facility_info, 'prevention_2_2', 'prevention_1_2')
-- FROM business_info bi
-- WHERE uf.business_id = bi.id
--   AND uf.facility_info LIKE '%prevention_2_2%'
--   AND bi.business_name = '(주)휴비스트제약';

-- 3. 검증
-- SELECT
--   uf.id,
--   uf.filename,
--   uf.facility_info,
--   uf.file_path,
--   bi.business_name
-- FROM uploaded_files uf
-- JOIN business_info bi ON uf.business_id = bi.id
-- WHERE uf.facility_info LIKE '%prevention_1_2%'
--   AND bi.business_name = '(주)휴비스트제약';
