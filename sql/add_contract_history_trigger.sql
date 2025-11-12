-- 계약서 이력 추적을 위한 트리거 추가
-- contract_history 테이블의 INSERT, UPDATE, DELETE를 data_history 테이블에 기록

-- 트리거 함수 생성 (계약서 이력용)
CREATE OR REPLACE FUNCTION log_contract_history_changes()
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
      'contract_history',
      OLD.id,
      'DELETE',
      row_to_json(OLD),
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
      'contract_history',
      NEW.id,
      'UPDATE',
      row_to_json(OLD),
      row_to_json(NEW),
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
      'contract_history',
      NEW.id,
      'INSERT',
      NULL,
      row_to_json(NEW),
      NOW()
    );
    RETURN NEW;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 기존 트리거 삭제 (있을 경우)
DROP TRIGGER IF EXISTS contract_history_changes_trigger ON contract_history;

-- 새 트리거 생성
CREATE TRIGGER contract_history_changes_trigger
AFTER INSERT OR UPDATE OR DELETE ON contract_history
FOR EACH ROW EXECUTE FUNCTION log_contract_history_changes();

-- 견적서 이력 추적을 위한 트리거도 추가 (estimate_history 테이블이 있는 경우)
CREATE OR REPLACE FUNCTION log_estimate_history_changes()
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
      'estimate_history',
      OLD.id,
      'DELETE',
      row_to_json(OLD),
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
      'estimate_history',
      NEW.id,
      'UPDATE',
      row_to_json(OLD),
      row_to_json(NEW),
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
      'estimate_history',
      NEW.id,
      'INSERT',
      NULL,
      row_to_json(NEW),
      NOW()
    );
    RETURN NEW;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 기존 트리거 삭제 (있을 경우)
DROP TRIGGER IF EXISTS estimate_history_changes_trigger ON estimate_history;

-- 새 트리거 생성
CREATE TRIGGER estimate_history_changes_trigger
AFTER INSERT OR UPDATE OR DELETE ON estimate_history
FOR EACH ROW EXECUTE FUNCTION log_estimate_history_changes();

-- 확인 쿼리
SELECT
  trigger_name,
  event_manipulation,
  event_object_table
FROM information_schema.triggers
WHERE event_object_table IN ('contract_history', 'estimate_history')
ORDER BY event_object_table, trigger_name;
