-- ============================================================
-- 기존 Direct URL 크롤링 공고 데이터 업데이트
-- ============================================================
-- 목적: 이미 저장된 공고의 region_name을 실제 지자체명으로 업데이트
-- 실행: Supabase SQL Editor에서 실행
-- ============================================================

-- 1. region_name 업데이트 (Direct URL Source → 실제 지자체명)
-- ============================================================

UPDATE subsidy_announcements sa
SET
  region_name = dus.region_name,
  region_code = dus.region_code
FROM direct_url_sources dus
WHERE
  sa.region_name = 'Direct URL Source'
  AND dus.url = sa.source_url;

-- 업데이트된 행 수 확인
-- 예상: 209개 행 업데이트

-- ============================================================
-- 2. 검증 쿼리
-- ============================================================

-- 업데이트 결과 확인
SELECT
  region_name,
  COUNT(*) as count
FROM subsidy_announcements
WHERE crawled_at >= '2026-01-01'  -- 최근 크롤링 데이터만
GROUP BY region_name
ORDER BY count DESC;

-- Direct URL Source가 남아있는지 확인 (0이어야 정상)
SELECT COUNT(*) as remaining_direct_url_source
FROM subsidy_announcements
WHERE region_name = 'Direct URL Source';

-- ============================================================
-- 3. Gemini AI 정보 재추출 (선택사항)
-- ============================================================
--
-- 주의: 이 부분은 Gemini API 호출이 필요하므로
-- API 엔드포인트를 통해 실행해야 합니다.
--
-- curl을 사용한 재크롤링:
--
-- curl -X POST https://facility.blueon-iot.com/api/subsidy-crawler/direct-reanalyze \
--   -H "Authorization: Bearer $CRAWLER_SECRET" \
--   -H "Content-Type: application/json" \
--   -d '{"announcement_ids": ["uuid1", "uuid2", ...]}'
--
-- 또는 배치 재분석:
--
-- curl -X POST https://facility.blueon-iot.com/api/subsidy-crawler/direct-reanalyze \
--   -H "Authorization: Bearer $CRAWLER_SECRET" \
--   -H "Content-Type: application/json" \
--   -d '{"batch_size": 50, "reanalyze_all": true}'
