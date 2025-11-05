-- 방2 사진 데이터베이스 레코드 삭제 스크립트
-- Supabase 스토리지에서 삭제한 파일의 DB 레코드도 삭제

-- 1. 먼저 확인 (삭제할 레코드 조회)
SELECT
  uf.id,
  uf.filename,
  uf.facility_info,
  uf.file_path,
  bi.business_name
FROM uploaded_files uf
JOIN business_info bi ON uf.business_id = bi.id
WHERE uf.facility_info LIKE '%prevention_1_2%'
  AND bi.business_name = '(주)휴비스트제약';

-- 2. 삭제 (확인 후 실행)
-- DELETE FROM uploaded_files uf
-- USING business_info bi
-- WHERE uf.business_id = bi.id
--   AND uf.facility_info LIKE '%prevention_1_2%'
--   AND bi.business_name = '(주)휴비스트제약';

-- 3. 검증 (삭제 후 확인 - 결과가 없어야 함)
-- SELECT
--   uf.id,
--   uf.filename,
--   uf.facility_info,
--   bi.business_name
-- FROM uploaded_files uf
-- JOIN business_info bi ON uf.business_id = bi.id
-- WHERE uf.facility_info LIKE '%prevention_1_2%'
--   AND bi.business_name = '(주)휴비스트제약';
