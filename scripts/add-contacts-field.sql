-- business_info 테이블에 contacts JSON 필드 추가
-- JSON 배열 형식: [{"name": "김태훈", "position": "팀장", "phone": "010-1234-5678", "role": ""}]

-- 1. contacts 컬럼 추가
ALTER TABLE business_info 
ADD COLUMN contacts JSONB DEFAULT '[]'::jsonb;

-- 2. 기존 데이터를 새 JSON 형식으로 마이그레이션
UPDATE business_info 
SET contacts = CASE 
  WHEN manager_name IS NOT NULL AND manager_name != '' THEN
    (
      SELECT jsonb_agg(
        jsonb_build_object(
          'name', TRIM(split_part(name_line, '(', 1)),
          'position', COALESCE(TRIM(split_part(position_line, '\r', 1)), ''),
          'phone', COALESCE(manager_contact, ''),
          'role', CASE 
            WHEN name_line LIKE '%(%' THEN TRIM(REPLACE(REPLACE(split_part(name_line, '(', 2), ')', ''), '\r', ''))
            ELSE ''
          END
        )
      )
      FROM (
        SELECT 
          unnest(string_to_array(manager_name, E'\r\n')) as name_line,
          unnest(string_to_array(COALESCE(manager_position, ''), E'\r\n')) as position_line
      ) as contacts_data
      WHERE TRIM(name_line) != ''
    )
  ELSE '[]'::jsonb
END
WHERE manager_name IS NOT NULL;

-- 3. 인덱스 추가 (검색 성능 향상)
CREATE INDEX IF NOT EXISTS idx_business_info_contacts_gin ON business_info USING gin (contacts);

-- 4. 예시 쿼리 (테스트용)
-- 특정 담당자명으로 검색:
-- SELECT * FROM business_info WHERE contacts @> '[{"name": "김태훈"}]';

-- 연락처로 검색:
-- SELECT * FROM business_info WHERE contacts @> '[{"phone": "010-8796-3881"}]';