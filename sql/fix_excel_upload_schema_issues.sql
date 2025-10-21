-- =====================================================
-- 엑셀 업로드 스키마 문제 해결
-- 목적: 제조사 제약조건 제거 및 컬럼 길이 확대
-- =====================================================

BEGIN;

-- 1. 제조사 CHECK 제약조건 제거 (유연성 확보)
-- business_info 테이블
ALTER TABLE business_info
DROP CONSTRAINT IF EXISTS business_info_manufacturer_check;

-- manufacturer_pricing 테이블 (존재하는 경우)
ALTER TABLE manufacturer_pricing
DROP CONSTRAINT IF EXISTS manufacturer_pricing_manufacturer_check;

-- 2. manufacturer 컬럼 길이 확대 (VARCHAR(20) → VARCHAR(100))
ALTER TABLE business_info
ALTER COLUMN manufacturer TYPE VARCHAR(100);

-- manufacturer_pricing 테이블 (존재하는 경우)
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_schema = 'public'
        AND table_name = 'manufacturer_pricing'
    ) THEN
        ALTER TABLE manufacturer_pricing
        ALTER COLUMN manufacturer TYPE VARCHAR(100);
    END IF;
END $$;

-- 3. 기타 필요한 필드들이 존재하는지 확인하고 없으면 추가
-- progress_status (진행구분)
ALTER TABLE business_info
ADD COLUMN IF NOT EXISTS progress_status VARCHAR(50);

COMMENT ON COLUMN business_info.progress_status IS '진행구분: 자비, 보조금, 보조금 동시진행, 대리점, AS 등';

-- department (담당부서)
ALTER TABLE business_info
ADD COLUMN IF NOT EXISTS department VARCHAR(100);

COMMENT ON COLUMN business_info.department IS '담당부서';

-- installation_team (설치팀)
ALTER TABLE business_info
ADD COLUMN IF NOT EXISTS installation_team VARCHAR(100);

COMMENT ON COLUMN business_info.installation_team IS '설치팀';

-- order_manager (발주담당)
ALTER TABLE business_info
ADD COLUMN IF NOT EXISTS order_manager VARCHAR(100);

COMMENT ON COLUMN business_info.order_manager IS '발주담당자';

-- order_date (발주일)
ALTER TABLE business_info
ADD COLUMN IF NOT EXISTS order_date DATE;

COMMENT ON COLUMN business_info.order_date IS '발주일';

-- delivery_date (출고일)
ALTER TABLE business_info
ADD COLUMN IF NOT EXISTS delivery_date DATE;

COMMENT ON COLUMN business_info.delivery_date IS '출고일';

-- notes (기타)
ALTER TABLE business_info
ADD COLUMN IF NOT EXISTS notes TEXT;

COMMENT ON COLUMN business_info.notes IS '기타 메모';

-- additional_construction_cost (추가공사비)
ALTER TABLE business_info
ADD COLUMN IF NOT EXISTS additional_construction_cost INTEGER DEFAULT 0;

COMMENT ON COLUMN business_info.additional_construction_cost IS '추가공사비';

-- negotiation (네고)
ALTER TABLE business_info
ADD COLUMN IF NOT EXISTS negotiation VARCHAR(255);

COMMENT ON COLUMN business_info.negotiation IS '네고 금액 또는 설명';

-- project_year (사업 진행연도)
ALTER TABLE business_info
ADD COLUMN IF NOT EXISTS project_year INTEGER;

COMMENT ON COLUMN business_info.project_year IS '사업 진행연도 (예: 2024, 2025)';

-- industry_type (업종)
ALTER TABLE business_info
ADD COLUMN IF NOT EXISTS industry_type VARCHAR(100);

COMMENT ON COLUMN business_info.industry_type IS '업종';

-- 4. 인덱스 추가 (성능 최적화)
CREATE INDEX IF NOT EXISTS idx_business_progress_status ON business_info(progress_status);
CREATE INDEX IF NOT EXISTS idx_business_department ON business_info(department);
CREATE INDEX IF NOT EXISTS idx_business_project_year ON business_info(project_year);
CREATE INDEX IF NOT EXISTS idx_business_industry_type ON business_info(industry_type);

-- 5. 제조사 데이터 정규화 (선택적)
-- 엑셀에서 올 수 있는 다양한 형식을 표준 형식으로 변환
UPDATE business_info
SET manufacturer = CASE
    -- 에코센스 변형들
    WHEN manufacturer IN ('ecosense', 'Ecosense', 'ECOSENSE', '1. 에코센스', '에코센스') THEN '에코센스'
    -- 크린어스 변형들
    WHEN manufacturer IN ('cleanearth', 'Cleanearth', 'CLEANEARTH', '클린어스', '2. 크린어스', '크린어스') THEN '크린어스'
    -- 가이아씨앤에스 변형들
    WHEN manufacturer IN ('gaia_cns', 'gaia cns', 'Gaia CNS', 'GAIA_CNS', '3. 가이아씨앤에스', '가이아씨앤에스', '가이아 씨앤에스') THEN '가이아씨앤에스'
    -- 이브이에스 변형들
    WHEN manufacturer IN ('evs', 'EVS', 'Evs', '4. 이브이에스', '이브이에스') THEN '이브이에스'
    -- 기타 알려진 제조사들
    WHEN manufacturer LIKE '%원에너지%' THEN '원에너지'
    -- 그 외는 그대로 유지
    ELSE manufacturer
END
WHERE manufacturer IS NOT NULL;

COMMIT;

-- 6. 확인 쿼리
SELECT
    '✅ 스키마 업데이트 완료!' as message,
    (SELECT COUNT(DISTINCT manufacturer) FROM business_info WHERE manufacturer IS NOT NULL) as unique_manufacturers,
    (SELECT COUNT(*) FROM business_info WHERE is_deleted = false) as total_businesses;

-- 제조사 분포 확인
SELECT
    manufacturer,
    COUNT(*) as count
FROM business_info
WHERE is_deleted = false AND manufacturer IS NOT NULL
GROUP BY manufacturer
ORDER BY count DESC
LIMIT 20;
