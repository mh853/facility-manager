-- ========================================
-- survey_events 테이블 없이 business_info 생성하기
-- ========================================
-- 문제: business_info에 설정된 트리거가 survey_events 테이블을 참조
-- 해결: 트리거를 임시로 비활성화하고 business_info 테이블 생성

-- 1. 기존 트리거 제거 (있다면)
DROP TRIGGER IF EXISTS trigger_sync_business_to_survey ON business_info;
DROP TRIGGER IF EXISTS trigger_sync_survey_to_business ON survey_events;

-- 2. 트리거 함수 제거 (있다면)
DROP FUNCTION IF EXISTS sync_business_to_survey_events() CASCADE;
DROP FUNCTION IF EXISTS sync_survey_to_business_info() CASCADE;

-- 완료 메시지
DO $$
BEGIN
    RAISE NOTICE '========================================';
    RAISE NOTICE '✅ survey_events 관련 트리거 제거 완료';
    RAISE NOTICE '이제 create_business_info_only.sql을 실행하세요';
    RAISE NOTICE '========================================';
END $$;
