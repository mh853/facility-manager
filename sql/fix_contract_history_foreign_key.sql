-- 계약서 이력 테이블의 외래 키 수정
-- business_id가 business_info 테이블을 참조하도록 변경

-- ⚠️  주의: 이 스크립트는 한 번만 실행하세요!
-- 이미 실행한 경우 다시 실행하지 마세요.

BEGIN;

-- 1. 기존 외래 키 제약 조건 삭제
ALTER TABLE contract_history
DROP CONSTRAINT IF EXISTS contract_history_business_id_fkey;

-- 2. 새로운 외래 키 제약 조건 추가 (business_info 참조)
-- DO $$ 블록을 사용하여 이미 존재하는 경우 무시
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.table_constraints
    WHERE constraint_name = 'contract_history_business_id_fkey'
      AND table_name = 'contract_history'
  ) THEN
    ALTER TABLE contract_history
    ADD CONSTRAINT contract_history_business_id_fkey
    FOREIGN KEY (business_id)
    REFERENCES business_info(id)
    ON DELETE CASCADE;
  END IF;
END $$;

COMMIT;

-- 3. 확인: 외래 키가 올바르게 설정되었는지 확인
SELECT
  tc.constraint_name,
  tc.table_name,
  kcu.column_name,
  ccu.table_name AS foreign_table_name,
  ccu.column_name AS foreign_column_name
FROM information_schema.table_constraints AS tc
JOIN information_schema.key_column_usage AS kcu
  ON tc.constraint_name = kcu.constraint_name
  AND tc.table_schema = kcu.table_schema
JOIN information_schema.constraint_column_usage AS ccu
  ON ccu.constraint_name = tc.constraint_name
  AND ccu.table_schema = tc.table_schema
WHERE tc.constraint_type = 'FOREIGN KEY'
  AND tc.table_name='contract_history';

-- 결과: foreign_table_name이 'business_info'로 표시되어야 합니다.
