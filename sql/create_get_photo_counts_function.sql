-- ============================================================================
-- PostgreSQL RPC 함수: get_photo_counts
-- ============================================================================
-- 목적: Primary DB에서 사진 개수 집계를 강제로 실행하여 Read Replica Lag 문제 해결
--
-- 문제:
-- - Supabase Postgrest는 기본적으로 SELECT 쿼리를 Read Replica에서 실행
-- - Read Replica는 Primary DB와 수십 초의 복제 지연(replication lag)이 있음
-- - 사진 삭제 후 즉시 조회해도 삭제 전 데이터가 반환됨
--
-- 해결책:
-- - RPC 함수는 항상 Primary DB에서 실행됨
-- - GROUP BY 집계 쿼리로 효율적인 카운팅
-- - Read-after-write consistency 보장
-- ============================================================================

CREATE OR REPLACE FUNCTION get_photo_counts(business_ids uuid[])
RETURNS TABLE(business_id uuid, photo_count bigint)
LANGUAGE plpgsql
STABLE -- STABLE: 함수가 읽기 전용이지만 트랜잭션 내에서 일관성 보장
AS $$
BEGIN
  -- 사업장별 사진 개수 집계
  RETURN QUERY
  SELECT
    uf.business_id,
    COUNT(*)::bigint AS photo_count
  FROM uploaded_files uf
  WHERE uf.business_id = ANY(business_ids)
  GROUP BY uf.business_id;

  -- 📊 로깅 (선택사항 - 성능에 영향 있을 수 있음)
  -- RAISE NOTICE 'Photo counts calculated for % businesses', array_length(business_ids, 1);
END;
$$;

-- ============================================================================
-- 함수 사용법
-- ============================================================================
-- SELECT * FROM get_photo_counts(ARRAY['uuid1', 'uuid2', 'uuid3']::uuid[]);
--
-- Supabase JavaScript 클라이언트에서 사용:
-- const { data, error } = await supabaseAdmin.rpc('get_photo_counts', {
--   business_ids: ['uuid1', 'uuid2', 'uuid3']
-- });
-- ============================================================================

-- 함수 권한 설정 (필요 시)
-- GRANT EXECUTE ON FUNCTION get_photo_counts(uuid[]) TO authenticated;
-- GRANT EXECUTE ON FUNCTION get_photo_counts(uuid[]) TO service_role;

-- 함수 생성 확인
SELECT
  'get_photo_counts() 함수 생성 완료' AS status,
  'Primary DB에서 실행되어 Read Replica Lag 문제 해결' AS benefit,
  'Supabase RPC로 호출 가능' AS usage;
