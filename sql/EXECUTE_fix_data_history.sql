-- ============================================================
-- data_history 테이블 수정 및 트리거 설정
-- ============================================================
-- 기존 테이블이 있는 경우를 고려한 안전한 수정 스크립트
-- ============================================================

-- 1. 기존 data_history 테이블 삭제 (기존 데이터가 있다면 백업 권장)
-- ============================================================
DROP TABLE IF EXISTS data_history CASCADE;

-- 2. data_history 테이블 재생성
-- ============================================================
CREATE TABLE data_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  table_name VARCHAR(255) NOT NULL,           -- 변경된 테이블 이름
  record_id UUID NOT NULL,                    -- 변경된 레코드 ID
  operation VARCHAR(10) NOT NULL,             -- INSERT, UPDATE, DELETE
  old_data JSONB,                             -- 변경 전 데이터 (UPDATE, DELETE 시)
  new_data JSONB,                             -- 변경 후 데이터 (INSERT, UPDATE 시)
  created_at TIMESTAMPTZ DEFAULT NOW()        -- 이력 생성 시간
);

-- 인덱스 생성 (조회 성능 최적화)
CREATE INDEX idx_data_history_table_name ON data_history(table_name);
CREATE INDEX idx_data_history_record_id ON data_history(record_id);
CREATE INDEX idx_data_history_created_at ON data_history(created_at DESC);
CREATE INDEX idx_data_history_operation ON data_history(operation);

-- 테이블 코멘트
COMMENT ON TABLE data_history IS '데이터 변경 이력 추적 테이블';
COMMENT ON COLUMN data_history.table_name IS '변경된 테이블 이름';
COMMENT ON COLUMN data_history.record_id IS '변경된 레코드의 UUID';
COMMENT ON COLUMN data_history.operation IS 'INSERT, UPDATE, DELETE 중 하나';
COMMENT ON COLUMN data_history.old_data IS '변경 전 데이터 (JSON 형식)';
COMMENT ON COLUMN data_history.new_data IS '변경 후 데이터 (JSON 형식)';
COMMENT ON COLUMN data_history.created_at IS '이력 레코드 생성 시간';

-- 3. 범용 이력 기록 함수 생성 (changed_by 컬럼 제거)
-- ============================================================
CREATE OR REPLACE FUNCTION log_data_history()
RETURNS TRIGGER AS $$
BEGIN
  IF (TG_OP = 'DELETE') THEN
    INSERT INTO data_history (
      table_name,
      record_id,
      operation,
      old_data,
      new_data,
      created_at
    ) VALUES (
      TG_TABLE_NAME,
      OLD.id,
      'DELETE',
      row_to_json(OLD)::jsonb,
      NULL,
      NOW()
    );
    RETURN OLD;
  ELSIF (TG_OP = 'UPDATE') THEN
    INSERT INTO data_history (
      table_name,
      record_id,
      operation,
      old_data,
      new_data,
      created_at
    ) VALUES (
      TG_TABLE_NAME,
      NEW.id,
      'UPDATE',
      row_to_json(OLD)::jsonb,
      row_to_json(NEW)::jsonb,
      NOW()
    );
    RETURN NEW;
  ELSIF (TG_OP = 'INSERT') THEN
    INSERT INTO data_history (
      table_name,
      record_id,
      operation,
      old_data,
      new_data,
      created_at
    ) VALUES (
      TG_TABLE_NAME,
      NEW.id,
      'INSERT',
      NULL,
      row_to_json(NEW)::jsonb,
      NOW()
    );
    RETURN NEW;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. business_info 테이블 트리거 설정
-- ============================================================
DROP TRIGGER IF EXISTS business_info_history ON business_info;
CREATE TRIGGER business_info_history
AFTER INSERT OR UPDATE OR DELETE ON business_info
FOR EACH ROW EXECUTE FUNCTION log_data_history();

-- 5. 확인 쿼리
-- ============================================================

-- 테이블 구조 확인
SELECT
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns
WHERE table_name = 'data_history'
ORDER BY ordinal_position;

-- 설정된 트리거 확인
SELECT
  trigger_name,
  event_manipulation,
  event_object_table,
  action_timing
FROM information_schema.triggers
WHERE trigger_name = 'business_info_history';
