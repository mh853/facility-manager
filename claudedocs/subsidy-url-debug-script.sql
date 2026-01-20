-- =====================================================
-- 보조금 URL 데이터 디버깅 스크립트
-- =====================================================
-- 실행 방법: Supabase Dashboard → SQL Editor에 복사/붙여넣기
-- =====================================================

-- 1. 전체 데이터 개수 확인
SELECT '=== 전체 데이터 개수 ===' as section;
SELECT COUNT(*) as total_rows FROM direct_url_sources;

-- 2. is_active별 분포
SELECT '=== is_active 분포 ===' as section;
SELECT
  CASE
    WHEN is_active THEN 'active (true)'
    ELSE 'inactive (false)'
  END as status,
  COUNT(*) as count
FROM direct_url_sources
GROUP BY is_active
ORDER BY is_active DESC;

-- 3. 최근 생성된 데이터 (created_at 기준)
SELECT '=== 최근 생성된 URL (최신 10개) ===' as section;
SELECT
  id,
  url,
  region_name,
  category,
  is_active,
  created_at,
  last_crawled_at
FROM direct_url_sources
ORDER BY created_at DESC
LIMIT 10;

-- 4. RPC 함수 테스트 (실제 조회되는 URL)
SELECT '=== RPC 함수 테스트 (get_urls_for_crawling) ===' as section;
SELECT * FROM get_urls_for_crawling(10);

-- 5. 활성 URL 개수 (is_active = true)
SELECT '=== 활성 URL 개수 ===' as section;
SELECT COUNT(*) as active_urls
FROM direct_url_sources
WHERE is_active = true;

-- 6. 비활성 URL 개수 및 이유
SELECT '=== 비활성 URL 상태 ===' as section;
SELECT
  COUNT(*) as inactive_urls,
  MAX(consecutive_failures) as max_failures,
  AVG(consecutive_failures) as avg_failures
FROM direct_url_sources
WHERE is_active = false;

-- 7. 지역별 분포
SELECT '=== 지역별 URL 분포 ===' as section;
SELECT
  region_name,
  COUNT(*) as url_count,
  SUM(CASE WHEN is_active THEN 1 ELSE 0 END) as active_count
FROM direct_url_sources
GROUP BY region_name
ORDER BY url_count DESC
LIMIT 10;

-- 8. 카테고리별 분포
SELECT '=== 카테고리별 URL 분포 ===' as section;
SELECT
  COALESCE(category, '(없음)') as category,
  COUNT(*) as url_count
FROM direct_url_sources
GROUP BY category
ORDER BY url_count DESC;

-- 9. RLS 정책 확인
SELECT '=== RLS 정책 상태 ===' as section;
SELECT
  policyname as policy_name,
  roles,
  cmd as command,
  qual as using_clause
FROM pg_policies
WHERE tablename = 'direct_url_sources'
ORDER BY policyname;

-- 10. 테이블 권한 확인
SELECT '=== 테이블 권한 ===' as section;
SELECT
  grantee,
  privilege_type
FROM information_schema.role_table_grants
WHERE table_name = 'direct_url_sources'
ORDER BY grantee, privilege_type;

-- =====================================================
-- 문제 해결: 모든 URL을 활성화 (필요시 주석 해제)
-- =====================================================

-- 모든 URL을 활성 상태로 변경
-- UPDATE direct_url_sources
-- SET is_active = true
-- WHERE is_active = false;

-- consecutive_failures 초기화
-- UPDATE direct_url_sources
-- SET consecutive_failures = 0
-- WHERE consecutive_failures > 0;

-- =====================================================
-- 완료 메시지
-- =====================================================

SELECT '=== 디버깅 완료 ===' as section;
SELECT
  '총 ' || COUNT(*) || '개 URL 중 ' ||
  SUM(CASE WHEN is_active THEN 1 ELSE 0 END) || '개가 활성 상태입니다.' as summary
FROM direct_url_sources;
