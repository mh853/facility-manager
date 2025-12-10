-- ========================================
-- business_info 테이블의 survey_events 트리거만 제거
-- ========================================
-- 상황: business_info 테이블은 이미 존재
-- 문제: survey_events 관련 트리거가 존재하지 않는 테이블을 참조
-- 해결: 트리거만 안전하게 제거

-- ⚠️ 중요: 이 스크립트는 짧고 빠르게 실행됩니다
-- Deadlock을 피하려면 다른 작업이 없을 때 실행하세요

-- 1. 트리거 제거 (테이블은 그대로)
DROP TRIGGER IF EXISTS trigger_sync_business_to_survey ON business_info;

-- 2. 트리거 함수 제거
DROP FUNCTION IF EXISTS sync_business_to_survey_events() CASCADE;

-- 3. 역방향 트리거도 제거 (survey_events → business_info)
DROP TRIGGER IF EXISTS trigger_sync_survey_to_business ON survey_events;
DROP FUNCTION IF EXISTS sync_survey_to_business_info() CASCADE;

-- 완료 확인
SELECT
    CASE
        WHEN COUNT(*) = 0 THEN '✅ 모든 survey_events 트리거가 제거되었습니다'
        ELSE '⚠️ 아직 ' || COUNT(*) || '개의 트리거가 남아있습니다'
    END as status
FROM information_schema.triggers
WHERE event_object_table = 'business_info'
AND trigger_name LIKE '%survey%';

-- 성공 메시지
DO $$
BEGIN
    RAISE NOTICE '========================================';
    RAISE NOTICE '✅ survey_events 트리거 제거 완료!';
    RAISE NOTICE 'business_info 테이블은 정상 사용 가능합니다';
    RAISE NOTICE '이제 facility task를 생성해보세요';
    RAISE NOTICE '========================================';
END $$;
