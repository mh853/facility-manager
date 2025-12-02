-- ============================================
-- 테스트 사진 데이터 삭제 스크립트
-- ============================================
-- 사용법: Supabase SQL Editor에서 실행
-- ⚠️ 주의: 이 작업은 되돌릴 수 없습니다!

-- 0. 테이블 구조 확인 (처음 실행 시)
-- SELECT column_name, data_type
-- FROM information_schema.columns
-- WHERE table_name = 'businesses';

-- 1. 삭제 전 확인: 현재 업로드된 사진 목록 조회 (모든 컬럼 표시)
SELECT *
FROM uploaded_files
WHERE business_id = '79b4e0e2-e6b1-40fa-894e-6670295fcf4b'
ORDER BY created_at DESC
LIMIT 10;

-- 2. 특정 사업장의 사진만 삭제 (안전한 방법)
DELETE FROM uploaded_files
WHERE business_id = '79b4e0e2-e6b1-40fa-894e-6670295fcf4b';

-- 3. 또는 전체 테스트 데이터 삭제 (모든 사진 삭제)
-- DELETE FROM uploaded_files;

-- 4. 삭제 결과 확인 (사업장별 사진 개수)
SELECT
  business_id,
  COUNT(*) as photo_count
FROM uploaded_files
GROUP BY business_id
ORDER BY business_id;
