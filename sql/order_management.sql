-- ============================================
-- 발주 관리 시스템 데이터베이스 스키마
-- Created: 2025-10-30
-- ============================================

-- ============================================
-- 1. business_info 테이블 확장
-- ============================================

-- 발주일 필드 추가 (이미 존재할 수 있으므로 IF NOT EXISTS 사용)
ALTER TABLE business_info
ADD COLUMN IF NOT EXISTS order_date DATE;

-- 인덱스 추가
CREATE INDEX IF NOT EXISTS idx_business_info_order_date
ON business_info(order_date);

COMMENT ON COLUMN business_info.order_date IS '발주 완료 날짜';

-- ============================================
-- 2. order_management 테이블 생성
-- ============================================

CREATE TABLE IF NOT EXISTS order_management (
  -- 기본 키
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- 외래 키
  business_id UUID NOT NULL REFERENCES business_info(id) ON DELETE CASCADE,
  task_id UUID REFERENCES facility_tasks(id) ON DELETE SET NULL,

  -- 발주 진행 단계 (날짜 기록)
  layout_date DATE,                      -- 레이아웃 작성일
  order_form_date DATE,                  -- 발주서 작성일
  ip_request_date DATE,                  -- IP 요청일
  greenlink_ip_setting_date DATE,        -- 그린링크 IP 세팅일
  router_request_date DATE,              -- 라우터 요청일

  -- 상태 관리
  status VARCHAR(20) DEFAULT 'in_progress',  -- in_progress, completed
  completed_at TIMESTAMPTZ,              -- 발주 완료 시각

  -- 메타데이터
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES employees(id),
  updated_by UUID REFERENCES employees(id),

  -- 제약조건
  CONSTRAINT valid_order_status CHECK (status IN ('in_progress', 'completed')),
  CONSTRAINT unique_business_order UNIQUE(business_id)  -- 사업장당 하나의 발주 관리
);

-- 인덱스
CREATE INDEX IF NOT EXISTS idx_order_management_business_id ON order_management(business_id);
CREATE INDEX IF NOT EXISTS idx_order_management_task_id ON order_management(task_id);
CREATE INDEX IF NOT EXISTS idx_order_management_status ON order_management(status);
CREATE INDEX IF NOT EXISTS idx_order_management_completed_at ON order_management(completed_at);

-- 테이블 코멘트
COMMENT ON TABLE order_management IS '발주 진행 상황 관리 테이블';
COMMENT ON COLUMN order_management.layout_date IS '레이아웃 작성 완료일';
COMMENT ON COLUMN order_management.order_form_date IS '발주서 작성 완료일';
COMMENT ON COLUMN order_management.ip_request_date IS 'IP 요청 완료일';
COMMENT ON COLUMN order_management.greenlink_ip_setting_date IS '그린링크 IP 세팅 완료일';
COMMENT ON COLUMN order_management.router_request_date IS '라우터 요청 완료일';
COMMENT ON COLUMN order_management.status IS '발주 상태: in_progress(진행중), completed(완료)';

-- ============================================
-- 3. 트리거: 업데이트 시각 자동 갱신
-- ============================================

CREATE OR REPLACE FUNCTION update_order_management_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS order_management_updated_at ON order_management;

CREATE TRIGGER order_management_updated_at
  BEFORE UPDATE ON order_management
  FOR EACH ROW
  EXECUTE FUNCTION update_order_management_timestamp();

-- ============================================
-- 4. 헬퍼 뷰: 발주 관리 상세 정보
-- ============================================

CREATE OR REPLACE VIEW order_management_detail AS
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
      -- 가이아씨앤에스, 크린어스, EVS: 5단계 전체
      ROUND(
        (
          CASE WHEN om.layout_date IS NOT NULL THEN 1 ELSE 0 END +
          CASE WHEN om.order_form_date IS NOT NULL THEN 1 ELSE 0 END +
          CASE WHEN om.ip_request_date IS NOT NULL THEN 1 ELSE 0 END +
          CASE WHEN om.greenlink_ip_setting_date IS NOT NULL THEN 1 ELSE 0 END +
          CASE WHEN om.router_request_date IS NOT NULL THEN 1 ELSE 0 END
        )::NUMERIC / 5 * 100
      )
  END as progress_percentage,

  -- 완료된 단계 수
  CASE
    WHEN bi.manufacturer = 'ecosense' THEN
      CASE WHEN om.layout_date IS NOT NULL THEN 1 ELSE 0 END +
      CASE WHEN om.order_form_date IS NOT NULL THEN 1 ELSE 0 END
    ELSE
      CASE WHEN om.layout_date IS NOT NULL THEN 1 ELSE 0 END +
      CASE WHEN om.order_form_date IS NOT NULL THEN 1 ELSE 0 END +
      CASE WHEN om.ip_request_date IS NOT NULL THEN 1 ELSE 0 END +
      CASE WHEN om.greenlink_ip_setting_date IS NOT NULL THEN 1 ELSE 0 END +
      CASE WHEN om.router_request_date IS NOT NULL THEN 1 ELSE 0 END
  END as steps_completed,

  -- 전체 단계 수
  CASE
    WHEN bi.manufacturer = 'ecosense' THEN 2
    ELSE 5
  END as steps_total

FROM order_management om
JOIN business_info bi ON om.business_id = bi.id
LEFT JOIN facility_tasks ft ON om.task_id = ft.id
LEFT JOIN employees creator ON om.created_by = creator.id
LEFT JOIN employees updater ON om.updated_by = updater.id
WHERE bi.is_deleted = FALSE;

COMMENT ON VIEW order_management_detail IS '발주 관리 상세 정보 뷰 (사업장 정보 + 진행률 포함)';

-- ============================================
-- 5. 헬퍼 함수: 발주 완료 처리
-- ============================================

CREATE OR REPLACE FUNCTION complete_order(
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

  -- 필수 단계 검증
  IF v_layout_date IS NULL OR v_order_form_date IS NULL THEN
    RETURN QUERY SELECT FALSE, '레이아웃 작성과 발주서 작성은 필수입니다.'::TEXT, NULL::DATE;
    RETURN;
  END IF;

  -- 제조사별 추가 단계 검증
  IF v_manufacturer IN ('gaia_cns', 'cleanearth', 'evs') THEN
    IF v_ip_request_date IS NULL OR
       v_greenlink_ip_setting_date IS NULL OR
       v_router_request_date IS NULL THEN
      RETURN QUERY SELECT FALSE, 'IP 요청, 그린링크 IP 세팅, 라우터 요청을 완료해주세요.'::TEXT, NULL::DATE;
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
-- 6. RLS (Row Level Security) 정책
-- ============================================

-- order_management 테이블 RLS 활성화
ALTER TABLE order_management ENABLE ROW LEVEL SECURITY;

-- 읽기 권한: 모든 인증된 사용자
DROP POLICY IF EXISTS "Enable read access for all users" ON order_management;
CREATE POLICY "Enable read access for all users"
  ON order_management FOR SELECT
  USING (true);

-- 쓰기 권한: 인증된 사용자만
DROP POLICY IF EXISTS "Enable insert for authenticated users only" ON order_management;
CREATE POLICY "Enable insert for authenticated users only"
  ON order_management FOR INSERT
  WITH CHECK (true);

DROP POLICY IF EXISTS "Enable update for authenticated users only" ON order_management;
CREATE POLICY "Enable update for authenticated users only"
  ON order_management FOR UPDATE
  USING (true);

DROP POLICY IF EXISTS "Enable delete for authenticated users only" ON order_management;
CREATE POLICY "Enable delete for authenticated users only"
  ON order_management FOR DELETE
  USING (true);

-- ============================================
-- 완료 메시지
-- ============================================

DO $$
BEGIN
  RAISE NOTICE '✅ 발주 관리 시스템 데이터베이스 스키마 생성 완료';
  RAISE NOTICE '   - business_info.order_date 필드 추가';
  RAISE NOTICE '   - order_management 테이블 생성';
  RAISE NOTICE '   - order_management_detail 뷰 생성';
  RAISE NOTICE '   - complete_order() 함수 생성';
  RAISE NOTICE '   - RLS 정책 설정 완료';
END $$;
