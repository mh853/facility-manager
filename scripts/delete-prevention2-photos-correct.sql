-- 방2 사진 데이터베이스 레코드 삭제 (올바른 버전)
-- facilityInfo가 prevention_2_2인 레코드를 직접 삭제

-- 1. 먼저 확인 (삭제할 레코드 조회)
SELECT
  id,
  filename,
  facility_info,
  file_path,
  business_id
FROM uploaded_files
WHERE facility_info = 'prevention_2_2';

-- 2. 삭제 (확인 후 실행)
-- DELETE FROM uploaded_files
-- WHERE facility_info = 'prevention_2_2';

-- 3. 검증 (삭제 후 확인 - 결과가 없어야 함)
-- SELECT
--   id,
--   filename,
--   facility_info,
--   file_path
-- FROM uploaded_files
-- WHERE facility_info = 'prevention_2_2';
