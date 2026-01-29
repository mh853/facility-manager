-- business_memos 테이블에서 스키마 코드가 포함된 메모 확인

-- 1. 최근 메모 내용 확인
SELECT id, title, content, business_id, created_at
FROM business_memos
ORDER BY created_at DESC
LIMIT 20;

-- 2. "product_shipment" 같은 스키마 코드가 포함된 메모 찾기
SELECT id, title, content, business_id, created_at
FROM business_memos
WHERE content LIKE '%product_%'
   OR content LIKE '%shipment%'
   OR content ~ '[a-z_]+\s*\)'  -- 스키마 코드 패턴
ORDER BY created_at DESC
LIMIT 10;

-- 3. 자동 생성 메모 중 상태 변경 메모 확인
SELECT id, title, content, created_at
FROM business_memos
WHERE title LIKE '%자동%상태 변경%'
ORDER BY created_at DESC
LIMIT 10;
