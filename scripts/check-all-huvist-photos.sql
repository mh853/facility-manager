-- (주)휴비스트제약의 모든 사진 레코드 확인
SELECT
  uf.id,
  uf.filename,
  uf.facility_info,
  uf.file_path,
  uf.created_at,
  bi.business_name
FROM uploaded_files uf
JOIN business_info bi ON uf.business_id = bi.id
WHERE bi.business_name = '(주)휴비스트제약'
ORDER BY uf.created_at DESC;
