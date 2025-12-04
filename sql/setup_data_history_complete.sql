-- ============================================================
-- data_history 테이블 및 관련 트리거 전체 설정
-- ============================================================
-- 이 파일을 Supabase SQL Editor에서 실행하세요.
-- 데이터 변경 이력을 추적하기 위한 테이블과 트리거를 설정합니다.
-- ============================================================

-- 1. data_history 테이블 생성
-- ============================================================
CREATE TABLE IF NOT EXISTS data_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  table_name VARCHAR(255) NOT NULL,           -- 변경된 테이블 이름
  record_id UUID NOT NULL,                    -- 변경된 레코드 ID
  operation VARCHAR(10) NOT NULL,             -- INSERT, UPDATE, DELETE
  old_data JSONB,                             -- 변경 전 데이터 (UPDATE, DELETE 시)
  new_data JSONB,                             -- 변경 후 데이터 (INSERT, UPDATE 시)
  changed_by UUID,                            -- 변경한 사용자 ID (선택적)
  created_at TIMESTAMPTZ DEFAULT NOW()        -- 이력 생성 시간
);

-- 인덱스 생성 (조회 성능 최적화)
CREATE INDEX IF NOT EXISTS idx_data_history_table_name ON data_history(table_name);
CREATE INDEX IF NOT EXISTS idx_data_history_record_id ON data_history(record_id);
CREATE INDEX IF NOT EXISTS idx_data_history_created_at ON data_history(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_data_history_operation ON data_history(operation);

-- 테이블 코멘트
COMMENT ON TABLE data_history IS '데이터 변경 이력 추적 테이블';
COMMENT ON COLUMN data_history.table_name IS '변경된 테이블 이름';
COMMENT ON COLUMN data_history.record_id IS '변경된 레코드의 UUID';
COMMENT ON COLUMN data_history.operation IS 'INSERT, UPDATE, DELETE 중 하나';
COMMENT ON COLUMN data_history.old_data IS '변경 전 데이터 (JSON 형식)';
COMMENT ON COLUMN data_history.new_data IS '변경 후 데이터 (JSON 형식)';
COMMENT ON COLUMN data_history.changed_by IS '변경을 수행한 사용자 ID';
COMMENT ON COLUMN data_history.created_at IS '이력 레코드 생성 시간';

-- 2. 범용 이력 기록 함수 생성
-- ============================================================
-- 이 함수는 여러 테이블에서 재사용할 수 있는 범용 트리거 함수입니다.
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

-- 3. 각 테이블별 트리거 설정
-- ============================================================

-- 3-1. air_permit_info 테이블 트리거
DROP TRIGGER IF EXISTS air_permit_info_history ON air_permit_info;
CREATE TRIGGER air_permit_info_history
AFTER INSERT OR UPDATE OR DELETE ON air_permit_info
FOR EACH ROW EXECUTE FUNCTION log_data_history();

-- 3-2. discharge_outlets 테이블 트리거
DROP TRIGGER IF EXISTS discharge_outlets_history ON discharge_outlets;
CREATE TRIGGER discharge_outlets_history
AFTER INSERT OR UPDATE OR DELETE ON discharge_outlets
FOR EACH ROW EXECUTE FUNCTION log_data_history();

-- 3-3. discharge_facilities 테이블 트리거
DROP TRIGGER IF EXISTS discharge_facilities_history ON discharge_facilities;
CREATE TRIGGER discharge_facilities_history
AFTER INSERT OR UPDATE OR DELETE ON discharge_facilities
FOR EACH ROW EXECUTE FUNCTION log_data_history();

-- 3-4. prevention_facilities 테이블 트리거
DROP TRIGGER IF EXISTS prevention_facilities_history ON prevention_facilities;
CREATE TRIGGER prevention_facilities_history
AFTER INSERT OR UPDATE OR DELETE ON prevention_facilities
FOR EACH ROW EXECUTE FUNCTION log_data_history();

-- 3-5. business_info 테이블 트리거 (선택적)
DROP TRIGGER IF EXISTS business_info_history ON business_info;
CREATE TRIGGER business_info_history
AFTER INSERT OR UPDATE OR DELETE ON business_info
FOR EACH ROW EXECUTE FUNCTION log_data_history();

-- 4. 확인 쿼리
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
WHERE trigger_name LIKE '%history%'
ORDER BY event_object_table, trigger_name;
