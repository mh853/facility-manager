-- data_history 테이블 생성
-- 데이터 변경 이력을 추적하기 위한 테이블
-- 다양한 테이블의 INSERT, UPDATE, DELETE 작업을 기록

-- 테이블 생성
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

-- RLS 정책 설정 (선택적: 현재는 비활성화하여 모든 작업 허용)
-- ALTER TABLE data_history ENABLE ROW LEVEL SECURITY;

-- 테이블 코멘트
COMMENT ON TABLE data_history IS '데이터 변경 이력 추적 테이블';
COMMENT ON COLUMN data_history.table_name IS '변경된 테이블 이름';
COMMENT ON COLUMN data_history.record_id IS '변경된 레코드의 UUID';
COMMENT ON COLUMN data_history.operation IS 'INSERT, UPDATE, DELETE 중 하나';
COMMENT ON COLUMN data_history.old_data IS '변경 전 데이터 (JSON 형식)';
COMMENT ON COLUMN data_history.new_data IS '변경 후 데이터 (JSON 형식)';
COMMENT ON COLUMN data_history.changed_by IS '변경을 수행한 사용자 ID';
COMMENT ON COLUMN data_history.created_at IS '이력 레코드 생성 시간';

-- 확인 쿼리
SELECT
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns
WHERE table_name = 'data_history'
ORDER BY ordinal_position;
