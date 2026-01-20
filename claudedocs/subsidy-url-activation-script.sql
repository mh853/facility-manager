-- =====================================================
-- 보조금 URL 전체 활성화 및 초기화 스크립트
-- =====================================================
-- 목적: is_active = false인 URL을 모두 활성화하고 실패 카운트 초기화
-- 실행: Supabase Dashboard → SQL Editor
-- =====================================================

-- 1. 현재 상태 확인
SELECT '=== 활성화 전 상태 ===' as section;
SELECT
  is_active,
  COUNT(*) as count
FROM direct_url_sources
GROUP BY is_active
ORDER BY is_active DESC;

-- 2. 모든 URL 활성화 및 초기화
UPDATE direct_url_sources
SET
  is_active = true,
  consecutive_failures = 0,
  error_count = 0,
  last_error = NULL,
  updated_at = NOW()
WHERE is_active = false;

-- 3. 활성화 결과 확인
SELECT '=== 활성화 후 상태 ===' as section;
SELECT
  is_active,
  COUNT(*) as count
FROM direct_url_sources
GROUP BY is_active
ORDER BY is_active DESC;

-- 4. 활성 URL 샘플 확인 (최근 업데이트 순)
SELECT '=== 활성화된 URL 샘플 (최신 10개) ===' as section;
SELECT
  url,
  region_name,
  category,
  is_active,
  consecutive_failures,
  updated_at
FROM direct_url_sources
WHERE is_active = true
ORDER BY updated_at DESC
LIMIT 10;

-- 5. RPC 함수 테스트 (크롤링에 실제 사용될 URL)
SELECT '=== 크롤링 대상 URL (get_urls_for_crawling) ===' as section;
SELECT * FROM get_urls_for_crawling(10);

-- 6. 지역별 활성 URL 분포
SELECT '=== 지역별 활성 URL 분포 ===' as section;
SELECT
  region_name,
  COUNT(*) as active_urls
FROM direct_url_sources
WHERE is_active = true
GROUP BY region_name
ORDER BY active_urls DESC
LIMIT 10;

-- 7. 최종 요약
SELECT '=== 최종 요약 ===' as section;
SELECT
  COUNT(*) as total_urls,
  SUM(CASE WHEN is_active THEN 1 ELSE 0 END) as active_urls,
  SUM(CASE WHEN NOT is_active THEN 1 ELSE 0 END) as inactive_urls
FROM direct_url_sources;

-- =====================================================
-- 완료!
-- =====================================================
-- 이제 admin/subsidy 페이지에서 "현재 등록: 230개 URL"로 표시됩니다.
-- =====================================================
