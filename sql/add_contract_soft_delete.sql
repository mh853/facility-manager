-- ============================================
-- contract_history 테이블에 soft delete 기능 추가
-- Created: 2025-11-11
-- ============================================

-- 1. is_deleted 컬럼 추가
ALTER TABLE contract_history
ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN DEFAULT FALSE;

-- 2. deleted_at 컬럼 추가 (삭제 시각 기록)
ALTER TABLE contract_history
ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

-- 3. deleted_by 컬럼 추가 (삭제자 기록)
ALTER TABLE contract_history
ADD COLUMN IF NOT EXISTS deleted_by UUID REFERENCES employees(id);

-- 4. 인덱스 추가 (조회 성능 향상)
CREATE INDEX IF NOT EXISTS idx_contract_history_is_deleted
  ON contract_history(is_deleted)
  WHERE is_deleted = FALSE;

-- 코멘트 추가
COMMENT ON COLUMN contract_history.is_deleted IS '삭제 여부 (soft delete)';
COMMENT ON COLUMN contract_history.deleted_at IS '삭제 시각';
COMMENT ON COLUMN contract_history.deleted_by IS '삭제한 사용자';

-- 완료 메시지
DO $$
BEGIN
  RAISE NOTICE '✅ contract_history soft delete 기능 추가 완료';
  RAISE NOTICE '   - is_deleted 컬럼 추가';
  RAISE NOTICE '   - deleted_at, deleted_by 컬럼 추가';
  RAISE NOTICE '   - 인덱스 추가';
END $$;
