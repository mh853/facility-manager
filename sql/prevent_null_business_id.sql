-- =====================================================
-- facility_tasks business_id NULL 방지 시스템
-- =====================================================
-- 목적: facility_tasks 생성/수정 시 business_id 자동 매칭 및 검증
-- 작성일: 2025-10-31

-- =====================================================
-- 1. business_id 자동 매칭 함수
-- =====================================================
CREATE OR REPLACE FUNCTION auto_match_business_id()
RETURNS TRIGGER AS $$
DECLARE
  matched_business_id UUID;
BEGIN
  -- business_id가 NULL이고 business_name이 있는 경우
  IF NEW.business_id IS NULL AND NEW.business_name IS NOT NULL THEN
    -- business_name으로 business_info에서 ID 조회
    SELECT id INTO matched_business_id
    FROM business_info
    WHERE business_name = NEW.business_name
      AND is_deleted = false
    LIMIT 1;

    -- 매칭된 business_id가 있으면 자동 설정
    IF matched_business_id IS NOT NULL THEN
      NEW.business_id := matched_business_id;

      RAISE NOTICE '[AUTO-MATCH] business_id 자동 매칭: business_name=% → business_id=%',
        NEW.business_name, matched_business_id;
    ELSE
      -- business_info에 사업장이 없으면 경고
      RAISE WARNING '[AUTO-MATCH] business_info에 사업장이 없습니다: business_name=%',
        NEW.business_name;
    END IF;
  END IF;

  -- business_id가 있으면 business_name도 동기화 (선택사항)
  IF NEW.business_id IS NOT NULL THEN
    SELECT business_name INTO NEW.business_name
    FROM business_info
    WHERE id = NEW.business_id
      AND is_deleted = false;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- 2. 트리거 생성 (INSERT/UPDATE 시 자동 실행)
-- =====================================================
DROP TRIGGER IF EXISTS trigger_auto_match_business_id ON facility_tasks;

CREATE TRIGGER trigger_auto_match_business_id
  BEFORE INSERT OR UPDATE OF business_name, business_id ON facility_tasks
  FOR EACH ROW
  EXECUTE FUNCTION auto_match_business_id();

-- =====================================================
-- 3. business_id 검증 함수 (선택사항 - 엄격한 검증)
-- =====================================================
CREATE OR REPLACE FUNCTION validate_business_id()
RETURNS TRIGGER AS $$
BEGIN
  -- business_id가 여전히 NULL이면 경고 (에러는 아님)
  IF NEW.business_id IS NULL THEN
    RAISE WARNING '[VALIDATION] facility_tasks에 business_id가 NULL입니다: task_id=%, business_name=%',
      NEW.id, NEW.business_name;
  END IF;

  -- business_id가 있지만 business_info에 없으면 에러
  IF NEW.business_id IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM business_info
      WHERE id = NEW.business_id
        AND is_deleted = false
    ) THEN
      RAISE EXCEPTION '[VALIDATION] 존재하지 않는 business_id입니다: %', NEW.business_id;
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- 4. 검증 트리거 생성 (선택사항)
-- =====================================================
-- 주의: 이 트리거는 매우 엄격하므로 필요에 따라 활성화
-- DROP TRIGGER IF EXISTS trigger_validate_business_id ON facility_tasks;
--
-- CREATE TRIGGER trigger_validate_business_id
--   BEFORE INSERT OR UPDATE ON facility_tasks
--   FOR EACH ROW
--   EXECUTE FUNCTION validate_business_id();

-- =====================================================
-- 5. 테스트
-- =====================================================

-- 테스트 1: business_name만 제공 (자동 매칭 테스트)
-- INSERT INTO facility_tasks (business_name, title, task_type, status)
-- VALUES ('강림산업', '테스트 업무', 'etc', 'customer_contact');

-- 테스트 2: 결과 확인
-- SELECT id, business_name, business_id FROM facility_tasks
-- WHERE title = '테스트 업무';

-- 테스트 3: 정리
-- DELETE FROM facility_tasks WHERE title = '테스트 업무';

-- =====================================================
-- 6. 설치 확인
-- =====================================================
SELECT
  'auto_match_business_id' as function_name,
  proname,
  pg_get_functiondef(oid) as definition
FROM pg_proc
WHERE proname = 'auto_match_business_id';

SELECT
  'trigger_auto_match_business_id' as trigger_name,
  tgname,
  tgenabled,
  CASE tgenabled
    WHEN 'O' THEN 'ENABLED'
    WHEN 'D' THEN 'DISABLED'
    ELSE 'UNKNOWN'
  END as status
FROM pg_trigger
WHERE tgname = 'trigger_auto_match_business_id';
