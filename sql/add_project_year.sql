-- 사업 진행연도 컬럼 추가
-- business_info 테이블에 project_year 필드 추가

BEGIN;

-- 1. business_info 테이블에 project_year 컬럼 추가
ALTER TABLE business_info
ADD COLUMN IF NOT EXISTS project_year INTEGER;

-- 2. 컬럼 코멘트 추가
COMMENT ON COLUMN business_info.project_year IS '사업 진행연도 (예: 2024, 2025)';

-- 3. 기본값 설정 (현재 연도로 설정)
UPDATE business_info
SET project_year = EXTRACT(YEAR FROM CURRENT_DATE)
WHERE project_year IS NULL;

COMMIT;

-- 확인 쿼리
SELECT
    business_name,
    project_year,
    progress_status,
    created_at
FROM business_info
WHERE is_deleted = false
ORDER BY project_year DESC, business_name
LIMIT 10;
