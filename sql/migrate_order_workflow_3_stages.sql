-- ============================================
-- 발주 관리 시스템: 제조사별 워크플로우 수정 마이그레이션
-- 변경 대상: 가이아씨앤에스, 크린어스, EVS (5단계 → 3단계)
-- 생성일: 2025-11-03
-- ============================================

-- 트랜잭션 시작
BEGIN;

-- ============================================
-- 1. order_management_detail 뷰 재생성
-- ============================================

-- 기존 뷰 삭제
DROP VIEW IF EXISTS order_management_detail;

-- 새 뷰 생성 (3단계 워크플로우 반영)
CREATE VIEW order_management_detail AS
SELECT
  om.id,
  om.business_id,
  om.task_id,

  -- 사업장 정보
  bi.business_name,
  bi.address,
  bi.manager_name,
  bi.manager_position,
  bi.manager_contact,
  bi.manufacturer,
  bi.vpn,
  bi.greenlink_id,
  bi.greenlink_pw,
  bi.order_date,

  -- 발주 단계 정보
  om.layout_date,
  om.order_form_date,
  om.ip_request_date,
  om.greenlink_ip_setting_date,
  om.router_request_date,

  -- 상태 및 메타데이터
  om.status,
  om.completed_at,
  om.created_at,
  om.updated_at,

  -- 담당자 정보
  creator.name as created_by_name,
  updater.name as updated_by_name,

  -- 업무 정보
  ft.title as task_title,
  ft.status as task_status,

  -- 진행률 계산 (제조사별)
  CASE
    WHEN bi.manufacturer = 'ecosense' THEN
      -- 에코센스: 2단계만
      ROUND(
        (
          CASE WHEN om.layout_date IS NOT NULL THEN 1 ELSE 0 END +
          CASE WHEN om.order_form_date IS NOT NULL THEN 1 ELSE 0 END
        )::NUMERIC / 2 * 100
      )
    ELSE
      -- 가이아씨앤에스, 크린어스, EVS: 3단계
      ROUND(
        (
          CASE WHEN om.layout_date IS NOT NULL THEN 1 ELSE 0 END +
          CASE WHEN om.ip_request_date IS NOT NULL THEN 1 ELSE 0 END +
          CASE WHEN om.router_request_date IS NOT NULL THEN 1 ELSE 0 END
        )::NUMERIC / 3 * 100
      )
  END as progress_percentage,

  -- 완료된 단계 수
  CASE
    WHEN bi.manufacturer = 'ecosense' THEN
      CASE WHEN om.layout_date IS NOT NULL THEN 1 ELSE 0 END +
      CASE WHEN om.order_form_date IS NOT NULL THEN 1 ELSE 0 END
    ELSE
      CASE WHEN om.layout_date IS NOT NULL THEN 1 ELSE 0 END +
      CASE WHEN om.ip_request_date IS NOT NULL THEN 1 ELSE 0 END +
      CASE WHEN om.router_request_date IS NOT NULL THEN 1 ELSE 0 END
  END as steps_completed,

  -- 전체 단계 수
  CASE
    WHEN bi.manufacturer = 'ecosense' THEN 2
    ELSE 3
  END as steps_total

FROM order_management om
JOIN business_info bi ON om.business_id = bi.id
LEFT JOIN facility_tasks ft ON om.task_id = ft.id
LEFT JOIN employees creator ON om.created_by = creator.id
LEFT JOIN employees updater ON om.updated_by = updater.id
WHERE bi.is_deleted = FALSE;

COMMENT ON VIEW order_management_detail IS '발주 관리 상세 정보 뷰 (사업장 정보 + 진행률 포함)';

-- ============================================
-- 2. complete_order() 함수 재생성
-- ============================================

-- 기존 함수 삭제
DROP FUNCTION IF EXISTS complete_order(UUID, UUID);

-- 새 함수 생성 (3단계 검증 로직 반영)
CREATE FUNCTION complete_order(
  p_business_id UUID,
  p_user_id UUID
)
RETURNS TABLE(
  success BOOLEAN,
  message TEXT,
  order_date DATE
) AS $$
DECLARE
  v_manufacturer VARCHAR(20);
  v_layout_date DATE;
  v_order_form_date DATE;
  v_ip_request_date DATE;
  v_greenlink_ip_setting_date DATE;
  v_router_request_date DATE;
  v_order_date DATE;
BEGIN
  -- 사업장 제조사 확인
  SELECT manufacturer
  INTO v_manufacturer
  FROM business_info
  WHERE id = p_business_id AND is_deleted = FALSE;

  IF v_manufacturer IS NULL THEN
    RETURN QUERY SELECT FALSE, '사업장을 찾을 수 없습니다.'::TEXT, NULL::DATE;
    RETURN;
  END IF;

  -- 발주 진행 단계 확인
  SELECT
    layout_date,
    order_form_date,
    ip_request_date,
    greenlink_ip_setting_date,
    router_request_date
  INTO
    v_layout_date,
    v_order_form_date,
    v_ip_request_date,
    v_greenlink_ip_setting_date,
    v_router_request_date
  FROM order_management
  WHERE business_id = p_business_id;

  -- 제조사별 필수 단계 검증
  IF v_manufacturer = 'ecosense' THEN
    -- 에코센스: 2단계 검증
    IF v_layout_date IS NULL OR v_order_form_date IS NULL THEN
      RETURN QUERY SELECT FALSE, '레이아웃 작성과 발주서 작성은 필수입니다.'::TEXT, NULL::DATE;
      RETURN;
    END IF;
  ELSIF v_manufacturer IN ('gaia_cns', 'cleanearth', 'evs') THEN
    -- 가이아씨앤에스, 크린어스, EVS: 3단계 검증
    IF v_layout_date IS NULL OR
       v_ip_request_date IS NULL OR
       v_router_request_date IS NULL THEN
      RETURN QUERY SELECT FALSE, '레이아웃 작성, IP 요청, 라우터 요청을 완료해주세요.'::TEXT, NULL::DATE;
      RETURN;
    END IF;
  END IF;

  -- 발주일 설정
  v_order_date := CURRENT_DATE;

  -- order_management 업데이트
  UPDATE order_management
  SET
    status = 'completed',
    completed_at = NOW(),
    updated_by = p_user_id
  WHERE business_id = p_business_id;

  -- business_info 업데이트
  UPDATE business_info
  SET order_date = v_order_date
  WHERE id = p_business_id;

  RETURN QUERY SELECT TRUE, '발주가 완료되었습니다.'::TEXT, v_order_date;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION complete_order IS '발주 완료 처리 함수 (제조사별 검증 포함)';

-- ============================================
-- 3. 마이그레이션 검증
-- ============================================

-- 검증 1: 제조사별 단계 수 확인
DO $$
DECLARE
  v_ecosense_steps INT;
  v_gaia_steps INT;
  v_cleanearth_steps INT;
  v_evs_steps INT;
BEGIN
  -- 각 제조사별 steps_total 확인
  SELECT DISTINCT steps_total INTO v_ecosense_steps
  FROM order_management_detail
  WHERE manufacturer = 'ecosense'
  LIMIT 1;

  SELECT DISTINCT steps_total INTO v_gaia_steps
  FROM order_management_detail
  WHERE manufacturer = 'gaia_cns'
  LIMIT 1;

  SELECT DISTINCT steps_total INTO v_cleanearth_steps
  FROM order_management_detail
  WHERE manufacturer = 'cleanearth'
  LIMIT 1;

  SELECT DISTINCT steps_total INTO v_evs_steps
  FROM order_management_detail
  WHERE manufacturer = 'evs'
  LIMIT 1;

  -- 검증 결과 출력
  RAISE NOTICE '===========================================';
  RAISE NOTICE '📊 마이그레이션 검증 결과';
  RAISE NOTICE '===========================================';
  RAISE NOTICE '에코센스 단계 수: % (예상: 2)', v_ecosense_steps;
  RAISE NOTICE '가이아씨앤에스 단계 수: % (예상: 3)', v_gaia_steps;
  RAISE NOTICE '크린어스 단계 수: % (예상: 3)', v_cleanearth_steps;
  RAISE NOTICE 'EVS 단계 수: % (예상: 3)', v_evs_steps;
  RAISE NOTICE '===========================================';

  -- 검증 실패 시 롤백
  IF v_ecosense_steps != 2 OR
     v_gaia_steps != 3 OR
     v_cleanearth_steps != 3 OR
     v_evs_steps != 3 THEN
    RAISE EXCEPTION '❌ 검증 실패: 단계 수가 예상과 다릅니다.';
  END IF;

  RAISE NOTICE '✅ 모든 검증 통과!';
END $$;

-- 검증 2: 진행률 계산 샘플 확인
SELECT
  manufacturer,
  business_name,
  steps_completed,
  steps_total,
  progress_percentage
FROM order_management_detail
WHERE manufacturer IN ('gaia_cns', 'cleanearth', 'evs')
ORDER BY manufacturer, business_name
LIMIT 10;

-- 트랜잭션 커밋
COMMIT;

-- ============================================
-- 완료 메시지
-- ============================================

DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '🎉 ============================================';
  RAISE NOTICE '✅ 발주 관리 워크플로우 마이그레이션 완료';
  RAISE NOTICE '============================================';
  RAISE NOTICE '📌 변경 사항:';
  RAISE NOTICE '   - 가이아씨앤에스: 5단계 → 3단계';
  RAISE NOTICE '   - 크린어스: 5단계 → 3단계';
  RAISE NOTICE '   - EVS: 5단계 → 3단계';
  RAISE NOTICE '';
  RAISE NOTICE '📋 새로운 3단계:';
  RAISE NOTICE '   1. 레이아웃 작성';
  RAISE NOTICE '   2. IP 요청';
  RAISE NOTICE '   3. 라우터 요청';
  RAISE NOTICE '';
  RAISE NOTICE '⚠️  참고사항:';
  RAISE NOTICE '   - 기존 order_form_date, greenlink_ip_setting_date 데이터는 유지됨';
  RAISE NOTICE '   - 진행률 계산에서는 3단계만 반영됨';
  RAISE NOTICE '   - 프론트엔드 빌드 재시작 필요 (npm run dev)';
  RAISE NOTICE '============================================';
END $$;
