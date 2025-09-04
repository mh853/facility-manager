-- 사업장 관리 시스템 데이터베이스 최적화 스크립트
-- 모달 데이터 동기화 문제 해결을 위한 스키마 최적화

-- 1. 통합 사업장 뷰 생성 (business_info + businesses 테이블 통합)
CREATE OR REPLACE VIEW unified_business_view AS
SELECT 
  -- Primary data from business_info
  bi.id as business_id,
  bi.created_at,
  bi.updated_at,
  bi.business_name as 사업장명,
  bi.local_government as 지자체,
  bi.address as 주소,
  bi.manager_name as 담당자명,
  bi.manager_position as 담당자직급,
  bi.manager_contact as 담당자연락처,
  bi.business_contact as 사업장연락처,
  bi.fax_number,
  bi.email,
  bi.representative_name as 대표자,
  bi.business_registration_number as 사업자등록번호,
  bi.row_number,
  bi.department,
  bi.progress_status,
  bi.manufacturer,
  bi.vpn,
  bi.greenlink_id,
  bi.greenlink_pw,
  bi.business_management_code,
  bi.is_active,
  bi.is_deleted,
  
  -- File information from businesses table (if exists)
  b.id as file_business_id,
  COALESCE(b.has_files, false) as has_files,
  COALESCE(b.file_count, 0) as file_count,
  
  -- Computed fields
  CASE 
    WHEN bi.updated_at > COALESCE(b.updated_at, '1970-01-01'::timestamp) 
    THEN bi.updated_at 
    ELSE COALESCE(b.updated_at, bi.updated_at) 
  END as last_modified,
  
  -- Status indicators
  CASE 
    WHEN bi.is_active = true AND bi.is_deleted = false THEN 'active'
    WHEN bi.is_deleted = true THEN 'deleted'
    ELSE 'inactive'
  END as status
  
FROM business_info bi
LEFT JOIN businesses b ON (
  b.name = bi.business_name OR 
  SIMILARITY(b.name, bi.business_name) > 0.8
)
WHERE bi.is_deleted = false;

-- 2. 성능 최적화를 위한 인덱스 생성
-- 사업장명 검색 최적화
CREATE INDEX IF NOT EXISTS idx_business_info_name_active 
ON business_info(business_name) 
WHERE is_active = true AND is_deleted = false;

-- 업데이트 시간 기반 정렬 최적화
CREATE INDEX IF NOT EXISTS idx_business_info_updated_at 
ON business_info(updated_at DESC) 
WHERE is_active = true AND is_deleted = false;

-- ID 기반 빠른 조회 최적화
CREATE INDEX IF NOT EXISTS idx_business_info_id_active 
ON business_info(id) 
WHERE is_active = true AND is_deleted = false;

-- 담당자명 검색 최적화
CREATE INDEX IF NOT EXISTS idx_business_info_manager 
ON business_info(manager_name) 
WHERE is_active = true AND is_deleted = false;

-- 지자체 필터링 최적화
CREATE INDEX IF NOT EXISTS idx_business_info_local_gov 
ON business_info(local_government) 
WHERE is_active = true AND is_deleted = false;

-- 3. 실시간 데이터 동기화를 위한 트리거 함수
CREATE OR REPLACE FUNCTION notify_business_update()
RETURNS TRIGGER AS $$
BEGIN
  -- 사업장 데이터 변경 시 알림 발송
  PERFORM pg_notify(
    'business_data_changed',
    json_build_object(
      'action', TG_OP,
      'id', COALESCE(NEW.id, OLD.id),
      'business_name', COALESCE(NEW.business_name, OLD.business_name),
      'manager_name', COALESCE(NEW.manager_name, OLD.manager_name),
      'updated_at', COALESCE(NEW.updated_at, OLD.updated_at),
      'timestamp', NOW()
    )::text
  );
  
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- 4. 트리거 생성 (INSERT, UPDATE, DELETE 감지)
DROP TRIGGER IF EXISTS business_info_notify_trigger ON business_info;
CREATE TRIGGER business_info_notify_trigger
  AFTER INSERT OR UPDATE OR DELETE ON business_info
  FOR EACH ROW
  EXECUTE FUNCTION notify_business_update();

-- 5. 캐시 무효화를 위한 타임스탬프 함수
CREATE OR REPLACE FUNCTION get_cache_timestamp()
RETURNS TEXT AS $$
BEGIN
  RETURN EXTRACT(EPOCH FROM NOW())::TEXT;
END;
$$ LANGUAGE plpgsql;

-- 6. 사업장 데이터 통계 함수 (성능 모니터링용)
CREATE OR REPLACE FUNCTION get_business_stats()
RETURNS JSON AS $$
DECLARE
  result JSON;
BEGIN
  SELECT json_build_object(
    'total_businesses', COUNT(*),
    'active_businesses', COUNT(*) FILTER (WHERE is_active = true),
    'with_managers', COUNT(*) FILTER (WHERE manager_name IS NOT NULL),
    'with_files', COUNT(*) FILTER (WHERE id IN (SELECT DISTINCT business_id FROM unified_business_view WHERE has_files = true)),
    'last_updated', MAX(updated_at),
    'cache_timestamp', get_cache_timestamp()
  ) INTO result
  FROM business_info
  WHERE is_deleted = false;
  
  RETURN result;
END;
$$ LANGUAGE plpgsql;

-- 7. 통합 검색 함수 (캐시 무효화 지원)
CREATE OR REPLACE FUNCTION search_businesses(
  search_term TEXT DEFAULT '',
  limit_count INTEGER DEFAULT 1000,
  force_refresh BOOLEAN DEFAULT FALSE
)
RETURNS TABLE (
  id UUID,
  사업장명 TEXT,
  담당자명 TEXT,
  담당자연락처 TEXT,
  지자체 TEXT,
  주소 TEXT,
  수정일 TIMESTAMP,
  has_files BOOLEAN,
  file_count INTEGER
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    ubv.business_id as id,
    ubv.사업장명,
    ubv.담당자명,
    ubv.담당자연락처,
    ubv.지자체,
    ubv.주소,
    ubv.updated_at as 수정일,
    ubv.has_files,
    ubv.file_count
  FROM unified_business_view ubv
  WHERE 
    ubv.status = 'active' AND
    (search_term = '' OR 
     ubv.사업장명 ILIKE '%' || search_term || '%' OR
     ubv.담당자명 ILIKE '%' || search_term || '%' OR
     ubv.지자체 ILIKE '%' || search_term || '%')
  ORDER BY ubv.last_modified DESC
  LIMIT limit_count;
END;
$$ LANGUAGE plpgsql;

-- 8. 데이터 정합성 체크 함수
CREATE OR REPLACE FUNCTION check_data_integrity()
RETURNS TABLE (
  check_name TEXT,
  status TEXT,
  count INTEGER,
  message TEXT
) AS $$
BEGIN
  -- 중복 사업장명 체크
  RETURN QUERY
  SELECT 
    '중복 사업장명' as check_name,
    CASE WHEN COUNT(*) > 0 THEN 'WARNING' ELSE 'OK' END as status,
    COUNT(*)::INTEGER as count,
    '동일한 사업장명을 가진 레코드 수' as message
  FROM (
    SELECT business_name
    FROM business_info 
    WHERE is_deleted = false
    GROUP BY business_name
    HAVING COUNT(*) > 1
  ) duplicates;

  -- NULL 담당자 체크
  RETURN QUERY
  SELECT 
    'NULL 담당자' as check_name,
    CASE WHEN COUNT(*) > 0 THEN 'INFO' ELSE 'OK' END as status,
    COUNT(*)::INTEGER as count,
    '담당자명이 NULL인 활성 사업장 수' as message
  FROM business_info 
  WHERE is_active = true AND is_deleted = false AND manager_name IS NULL;

  -- 최근 업데이트 체크
  RETURN QUERY
  SELECT 
    '최근 업데이트' as check_name,
    'INFO' as status,
    COUNT(*)::INTEGER as count,
    '최근 24시간 내 업데이트된 사업장 수' as message
  FROM business_info 
  WHERE updated_at > NOW() - INTERVAL '24 hours' AND is_deleted = false;
END;
$$ LANGUAGE plpgsql;

-- 9. 성능 분석을 위한 쿼리 실행 계획 함수
CREATE OR REPLACE FUNCTION analyze_query_performance(query_text TEXT)
RETURNS TEXT AS $$
DECLARE
  result TEXT;
BEGIN
  EXECUTE 'EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON) ' || query_text INTO result;
  RETURN result;
END;
$$ LANGUAGE plpgsql;

-- 실행 권한 부여
GRANT SELECT ON unified_business_view TO PUBLIC;
GRANT EXECUTE ON FUNCTION search_businesses TO PUBLIC;
GRANT EXECUTE ON FUNCTION get_business_stats TO PUBLIC;
GRANT EXECUTE ON FUNCTION check_data_integrity TO PUBLIC;
GRANT EXECUTE ON FUNCTION get_cache_timestamp TO PUBLIC;

-- 최적화 완료 메시지
SELECT 
  '데이터베이스 최적화 완료!' as message,
  get_cache_timestamp() as timestamp,
  get_business_stats() as current_stats;