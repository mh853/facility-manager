-- Supabase Realtime 활성화 SQL 스크립트
-- Supabase 대시보드의 SQL Editor에서 실행하세요

-- 1. uploaded_files 테이블에 대한 Realtime 활성화
ALTER PUBLICATION supabase_realtime ADD TABLE uploaded_files;

-- 2. RLS (Row Level Security) 정책 확인 및 조정 (필요시)
-- 이미 모든 작업이 허용된 정책이 있으므로 Realtime도 작동합니다

-- 3. Realtime 구독 권한 확인
-- 기본적으로 anon 키로 Realtime 구독이 가능합니다

-- 활성화 확인을 위한 쿼리
SELECT schemaname, tablename, rowsecurity 
FROM pg_tables 
WHERE tablename = 'uploaded_files';

-- Publication 확인
SELECT * FROM pg_publication_tables WHERE pubname = 'supabase_realtime';