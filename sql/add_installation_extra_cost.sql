-- ============================================================================
-- 추가설치비(installation_extra_cost) 컬럼 추가 마이그레이션
-- 생성일: 2025-10-28
-- 목적: 설치팀 요청 추가 설치 비용 관리
-- ============================================================================

-- 1. 컬럼 추가 (기존 데이터에 영향 없도록 안전하게 추가)
ALTER TABLE business_info
ADD COLUMN IF NOT EXISTS installation_extra_cost DECIMAL(12,2) DEFAULT 0.00;

-- 2. 컬럼 설명 추가
COMMENT ON COLUMN business_info.installation_extra_cost IS '설치팀 추가 요청 설치비 (순이익 계산 시 비용 항목으로 차감)';

-- 3. 기존 데이터 안전성 확보 (NULL 값을 0으로 업데이트)
UPDATE business_info
SET installation_extra_cost = 0.00
WHERE installation_extra_cost IS NULL;

-- 4. 성능 최적화를 위한 인덱스 추가 (추가설치비가 있는 사업장만)
CREATE INDEX IF NOT EXISTS idx_business_info_installation_extra_cost
ON business_info(installation_extra_cost)
WHERE installation_extra_cost > 0;

-- 5. 검증 쿼리 (마이그레이션 후 실행하여 확인)
-- SELECT column_name, data_type, column_default, is_nullable
-- FROM information_schema.columns
-- WHERE table_name = 'business_info'
--   AND column_name = 'installation_extra_cost';

-- 6. 데이터 확인 쿼리 (기존 데이터 영향도 확인)
-- SELECT
--   COUNT(*) AS total_businesses,
--   COUNT(CASE WHEN installation_extra_cost > 0 THEN 1 END) AS with_extra_cost,
--   COUNT(CASE WHEN installation_extra_cost = 0 THEN 1 END) AS without_extra_cost
-- FROM business_info;
