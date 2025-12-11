-- ============================================
-- 발주 관리 이력 테이블 생성 스크립트
-- 이 스크립트를 Supabase SQL Editor에서 실행하세요
-- ============================================

-- 1. 이력 테이블 생성
CREATE TABLE IF NOT EXISTS order_management_history (
  -- 기본 키
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- 연관 정보
  order_id UUID NOT NULL REFERENCES order_management(id) ON DELETE CASCADE,
  business_id UUID NOT NULL REFERENCES business_info(id) ON DELETE CASCADE,

  -- 변경 정보
  changed_field VARCHAR(50) NOT NULL,
  old_value DATE,
  new_value DATE,

  -- 변경자 정보 (employees 테이블이 없으므로 NULL 허용으로 수정)
  changed_by UUID,  -- employees 테이블 참조 제거
  changed_by_name TEXT,
  changed_at TIMESTAMPTZ DEFAULT NOW(),

  -- 메타데이터
  change_reason TEXT,
  action_type VARCHAR(20) DEFAULT 'update',

  CONSTRAINT valid_action_type CHECK (action_type IN ('create', 'update', 'delete', 'complete'))
);

-- 2. 인덱스 생성
CREATE INDEX IF NOT EXISTS idx_order_history_order_id ON order_management_history(order_id);
CREATE INDEX IF NOT EXISTS idx_order_history_business_id ON order_management_history(business_id);
CREATE INDEX IF NOT EXISTS idx_order_history_changed_at ON order_management_history(changed_at);
CREATE INDEX IF NOT EXISTS idx_order_history_changed_by ON order_management_history(changed_by);
CREATE INDEX IF NOT EXISTS idx_order_history_field ON order_management_history(changed_field);

-- 3. 테이블 코멘트
COMMENT ON TABLE order_management_history IS '발주 진행 단계 변경 이력을 상세히 추적하는 테이블';
COMMENT ON COLUMN order_management_history.changed_field IS '변경된 필드명 (layout_date, order_form_date 등)';
COMMENT ON COLUMN order_management_history.old_value IS '변경 전 날짜 (NULL이면 최초 입력)';
COMMENT ON COLUMN order_management_history.new_value IS '변경 후 날짜 (NULL이면 삭제)';
COMMENT ON COLUMN order_management_history.action_type IS '작업 유형: create(생성), update(수정), delete(삭제), complete(완료)';

-- 4. 이력 자동 기록 트리거 함수 (employees 테이블 참조 제거)
CREATE OR REPLACE FUNCTION record_order_management_changes()
RETURNS TRIGGER AS $$
DECLARE
  v_user_id UUID;
  v_user_name TEXT;
  v_action_type VARCHAR(20);
BEGIN
  -- 변경자 정보 가져오기 (employees 테이블이 없으므로 updated_by만 사용)
  v_user_id := NEW.updated_by;
  v_user_name := NULL;  -- employees 테이블 조회 제거

  -- 작업 유형 판단
  IF TG_OP = 'INSERT' THEN
    v_action_type := 'create';
  ELSIF NEW.status = 'completed' AND (OLD.status IS NULL OR OLD.status != 'completed') THEN
    v_action_type := 'complete';
  ELSE
    v_action_type := 'update';
  END IF;

  -- 레이아웃 작성일 변경 감지
  IF TG_OP = 'INSERT' THEN
    IF NEW.layout_date IS NOT NULL THEN
      INSERT INTO order_management_history (
        order_id, business_id, changed_field, old_value, new_value,
        changed_by, changed_by_name, action_type
      ) VALUES (
        NEW.id, NEW.business_id, 'layout_date', NULL, NEW.layout_date,
        v_user_id, v_user_name, 'create'
      );
    END IF;
  ELSIF OLD.layout_date IS DISTINCT FROM NEW.layout_date THEN
    INSERT INTO order_management_history (
      order_id, business_id, changed_field, old_value, new_value,
      changed_by, changed_by_name, action_type
    ) VALUES (
      NEW.id, NEW.business_id, 'layout_date', OLD.layout_date, NEW.layout_date,
      v_user_id, v_user_name, v_action_type
    );
  END IF;

  -- 발주서 작성일 변경 감지
  IF TG_OP = 'INSERT' THEN
    IF NEW.order_form_date IS NOT NULL THEN
      INSERT INTO order_management_history (
        order_id, business_id, changed_field, old_value, new_value,
        changed_by, changed_by_name, action_type
      ) VALUES (
        NEW.id, NEW.business_id, 'order_form_date', NULL, NEW.order_form_date,
        v_user_id, v_user_name, 'create'
      );
    END IF;
  ELSIF OLD.order_form_date IS DISTINCT FROM NEW.order_form_date THEN
    INSERT INTO order_management_history (
      order_id, business_id, changed_field, old_value, new_value,
      changed_by, changed_by_name, action_type
    ) VALUES (
      NEW.id, NEW.business_id, 'order_form_date', OLD.order_form_date, NEW.order_form_date,
      v_user_id, v_user_name, v_action_type
    );
  END IF;

  -- IP 요청일 변경 감지
  IF TG_OP = 'INSERT' THEN
    IF NEW.ip_request_date IS NOT NULL THEN
      INSERT INTO order_management_history (
        order_id, business_id, changed_field, old_value, new_value,
        changed_by, changed_by_name, action_type
      ) VALUES (
        NEW.id, NEW.business_id, 'ip_request_date', NULL, NEW.ip_request_date,
        v_user_id, v_user_name, 'create'
      );
    END IF;
  ELSIF OLD.ip_request_date IS DISTINCT FROM NEW.ip_request_date THEN
    INSERT INTO order_management_history (
      order_id, business_id, changed_field, old_value, new_value,
      changed_by, changed_by_name, action_type
    ) VALUES (
      NEW.id, NEW.business_id, 'ip_request_date', OLD.ip_request_date, NEW.ip_request_date,
      v_user_id, v_user_name, v_action_type
    );
  END IF;

  -- 그린링크 IP 세팅일 변경 감지
  IF TG_OP = 'INSERT' THEN
    IF NEW.greenlink_ip_setting_date IS NOT NULL THEN
      INSERT INTO order_management_history (
        order_id, business_id, changed_field, old_value, new_value,
        changed_by, changed_by_name, action_type
      ) VALUES (
        NEW.id, NEW.business_id, 'greenlink_ip_setting_date', NULL, NEW.greenlink_ip_setting_date,
        v_user_id, v_user_name, 'create'
      );
    END IF;
  ELSIF OLD.greenlink_ip_setting_date IS DISTINCT FROM NEW.greenlink_ip_setting_date THEN
    INSERT INTO order_management_history (
      order_id, business_id, changed_field, old_value, new_value,
      changed_by, changed_by_name, action_type
    ) VALUES (
      NEW.id, NEW.business_id, 'greenlink_ip_setting_date', OLD.greenlink_ip_setting_date, NEW.greenlink_ip_setting_date,
      v_user_id, v_user_name, v_action_type
    );
  END IF;

  -- 라우터 요청일 변경 감지
  IF TG_OP = 'INSERT' THEN
    IF NEW.router_request_date IS NOT NULL THEN
      INSERT INTO order_management_history (
        order_id, business_id, changed_field, old_value, new_value,
        changed_by, changed_by_name, action_type
      ) VALUES (
        NEW.id, NEW.business_id, 'router_request_date', NULL, NEW.router_request_date,
        v_user_id, v_user_name, 'create'
      );
    END IF;
  ELSIF OLD.router_request_date IS DISTINCT FROM NEW.router_request_date THEN
    INSERT INTO order_management_history (
      order_id, business_id, changed_field, old_value, new_value,
      changed_by, changed_by_name, action_type
    ) VALUES (
      NEW.id, NEW.business_id, 'router_request_date', OLD.router_request_date, NEW.router_request_date,
      v_user_id, v_user_name, v_action_type
    );
  END IF;

  -- 발주 완료 기록
  IF v_action_type = 'complete' THEN
    INSERT INTO order_management_history (
      order_id, business_id, changed_field, old_value, new_value,
      changed_by, changed_by_name, action_type, change_reason
    ) VALUES (
      NEW.id, NEW.business_id, 'status', NULL, NULL,
      v_user_id, v_user_name, 'complete', '발주 완료 처리'
    );
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 5. 트리거 적용 (기존 트리거가 있다면 재생성)
DROP TRIGGER IF EXISTS trigger_record_order_changes ON order_management;

CREATE TRIGGER trigger_record_order_changes
  AFTER INSERT OR UPDATE ON order_management
  FOR EACH ROW
  EXECUTE FUNCTION record_order_management_changes();

-- 6. 이력 조회 헬퍼 뷰
CREATE OR REPLACE VIEW order_management_timeline AS
SELECT
  h.id,
  h.order_id,
  h.business_id,
  bi.business_name,
  h.changed_field,
  h.old_value,
  h.new_value,
  h.changed_by,
  h.changed_by_name,
  h.changed_at,
  h.change_reason,
  h.action_type,

  -- 필드명 한글화
  CASE h.changed_field
    WHEN 'layout_date' THEN '레이아웃 작성'
    WHEN 'order_form_date' THEN '발주서 작성'
    WHEN 'ip_request_date' THEN 'IP 요청'
    WHEN 'greenlink_ip_setting_date' THEN '그린링크 IP 세팅'
    WHEN 'router_request_date' THEN '라우터 요청'
    WHEN 'status' THEN '발주 완료'
    ELSE h.changed_field
  END as step_name,

  -- 변경 내용 요약
  CASE
    WHEN h.action_type = 'create' THEN '최초 입력: ' || TO_CHAR(h.new_value, 'YYYY-MM-DD')
    WHEN h.action_type = 'complete' THEN '발주 완료 처리'
    WHEN h.old_value IS NULL AND h.new_value IS NOT NULL THEN '입력: ' || TO_CHAR(h.new_value, 'YYYY-MM-DD')
    WHEN h.old_value IS NOT NULL AND h.new_value IS NULL THEN '삭제: ' || TO_CHAR(h.old_value, 'YYYY-MM-DD')
    WHEN h.old_value IS NOT NULL AND h.new_value IS NOT NULL THEN
      TO_CHAR(h.old_value, 'YYYY-MM-DD') || ' → ' || TO_CHAR(h.new_value, 'YYYY-MM-DD')
    ELSE '변경'
  END as change_summary

FROM order_management_history h
JOIN business_info bi ON h.business_id = bi.id
WHERE bi.is_deleted = FALSE
ORDER BY h.changed_at DESC;

COMMENT ON VIEW order_management_timeline IS '발주 진행 이력을 시간순으로 보여주는 타임라인 뷰';

-- 7. RLS 정책
ALTER TABLE order_management_history ENABLE ROW LEVEL SECURITY;

-- 읽기 권한: 모든 인증된 사용자
DROP POLICY IF EXISTS "Enable read access for all users" ON order_management_history;
CREATE POLICY "Enable read access for all users"
  ON order_management_history FOR SELECT
  USING (true);

-- 쓰기 권한: 트리거에서만 (직접 INSERT 불가)
DROP POLICY IF EXISTS "Disable manual insert" ON order_management_history;
CREATE POLICY "Disable manual insert"
  ON order_management_history FOR INSERT
  WITH CHECK (false);

-- ============================================
-- 완료
-- ============================================
SELECT '✅ order_management_history 테이블 생성 완료' as result;
