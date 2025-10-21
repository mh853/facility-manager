-- 복수굴뚝 가격 정보 추가
-- 환경부 고시가 및 제조사별 원가 데이터 삽입

BEGIN;

-- 1. 환경부 고시가 테이블에 복수굴뚝 추가 (480,000원)
INSERT INTO government_pricing (
    equipment_type,
    equipment_name,
    official_price,
    effective_from,
    is_active,
    created_by
)
VALUES (
    'multiple_stack',
    '복수굴뚝',
    480000,
    '2025-01-01',
    true,
    (SELECT id FROM employees WHERE permission_level = 4 LIMIT 1)
)
ON CONFLICT (equipment_type, effective_from)
DO UPDATE SET
    official_price = EXCLUDED.official_price,
    is_active = EXCLUDED.is_active,
    updated_at = CURRENT_TIMESTAMP;

-- 2. 제조사별 원가 테이블에 복수굴뚝 추가 (각 제조사별)
INSERT INTO manufacturer_pricing (
    manufacturer,
    equipment_type,
    equipment_name,
    cost_price,
    effective_from,
    is_active,
    created_by
)
VALUES
    -- 에코센스
    ('에코센스', 'multiple_stack', '복수굴뚝', 120000, '2025-01-01', true, (SELECT id FROM employees WHERE permission_level = 4 LIMIT 1)),
    -- 크린어스
    ('크린어스', 'multiple_stack', '복수굴뚝', 120000, '2025-01-01', true, (SELECT id FROM employees WHERE permission_level = 4 LIMIT 1)),
    -- 가이아씨앤에스
    ('가이아씨앤에스', 'multiple_stack', '복수굴뚝', 120000, '2025-01-01', true, (SELECT id FROM employees WHERE permission_level = 4 LIMIT 1)),
    -- 이브이에스
    ('이브이에스', 'multiple_stack', '복수굴뚝', 120000, '2025-01-01', true, (SELECT id FROM employees WHERE permission_level = 4 LIMIT 1))
ON CONFLICT (equipment_type, manufacturer, effective_from)
DO UPDATE SET
    cost_price = EXCLUDED.cost_price,
    is_active = EXCLUDED.is_active,
    updated_at = CURRENT_TIMESTAMP;

-- 3. 기기별 설치비 테이블에 복수굴뚝 추가 (기본 설치비 0원)
INSERT INTO equipment_installation_cost (
    equipment_type,
    equipment_name,
    base_installation_cost,
    effective_from,
    is_active,
    created_by
)
VALUES (
    'multiple_stack',
    '복수굴뚝',
    0,
    '2025-01-01',
    true,
    (SELECT id FROM employees WHERE permission_level = 4 LIMIT 1)
)
ON CONFLICT (equipment_type, effective_from)
DO UPDATE SET
    base_installation_cost = EXCLUDED.base_installation_cost,
    is_active = EXCLUDED.is_active,
    updated_at = CURRENT_TIMESTAMP;

COMMIT;

-- 확인 쿼리
SELECT
    'government_pricing' as table_name,
    equipment_type,
    equipment_name,
    official_price
FROM government_pricing
WHERE equipment_type = 'multiple_stack'
UNION ALL
SELECT
    'manufacturer_pricing' as table_name,
    equipment_type,
    manufacturer as equipment_name,
    cost_price as official_price
FROM manufacturer_pricing
WHERE equipment_type = 'multiple_stack'
ORDER BY table_name, equipment_name;
