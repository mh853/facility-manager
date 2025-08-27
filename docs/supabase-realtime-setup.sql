-- Supabase Realtime 활성화 SQL 스크립트
-- Supabase 대시보드의 SQL Editor에서 실행하세요

-- 1. uploaded_files 테이블에 대한 Realtime 활성화
ALTER PUBLICATION supabase_realtime ADD TABLE uploaded_files;

-- 2. businesses 테이블에 대한 Realtime 활성화 (사업장 조회용)
ALTER PUBLICATION supabase_realtime ADD TABLE businesses;

-- 3. RLS (Row Level Security) 정책 확인 및 조정
-- uploaded_files 테이블 RLS 정책 확인
SELECT * FROM pg_policies WHERE tablename = 'uploaded_files';

-- 4. Realtime 구독 권한 확인
-- anon 및 authenticated 역할에 대한 SELECT 권한 확인
SELECT 
    grantee, 
    privilege_type, 
    is_grantable 
FROM information_schema.role_table_grants 
WHERE table_name = 'uploaded_files' 
AND privilege_type = 'SELECT';

-- 5. 활성화 확인을 위한 쿼리
SELECT schemaname, tablename, rowsecurity 
FROM pg_tables 
WHERE tablename IN ('uploaded_files', 'businesses');

-- 6. Publication 확인
SELECT * FROM pg_publication_tables WHERE pubname = 'supabase_realtime';

-- 7. 실시간 DELETE 이벤트 테스트용 함수 (개발 환경에서만 사용)
-- CREATE OR REPLACE FUNCTION test_file_delete(file_id UUID)
-- RETURNS VOID AS $$
-- BEGIN
--   DELETE FROM uploaded_files WHERE id = file_id;
--   RAISE NOTICE 'File deleted: %', file_id;
-- END;
-- $$ LANGUAGE plpgsql;

-- 8. 디버깅을 위한 트리거 함수 (선택사항)
CREATE OR REPLACE FUNCTION log_file_changes()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE NOTICE '[REALTIME] File deleted: %, business_id: %', OLD.id, OLD.business_id;
    RETURN OLD;
  ELSIF TG_OP = 'INSERT' THEN
    RAISE NOTICE '[REALTIME] File inserted: %, business_id: %', NEW.id, NEW.business_id;
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    RAISE NOTICE '[REALTIME] File updated: %, business_id: %', NEW.id, NEW.business_id;
    RETURN NEW;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- 트리거 생성 (선택사항 - 디버깅용)
-- DROP TRIGGER IF EXISTS trigger_log_file_changes ON uploaded_files;
-- CREATE TRIGGER trigger_log_file_changes
--   AFTER INSERT OR UPDATE OR DELETE ON uploaded_files
--   FOR EACH ROW EXECUTE FUNCTION log_file_changes();