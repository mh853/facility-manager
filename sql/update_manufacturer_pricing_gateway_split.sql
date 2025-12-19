-- Migration: Update manufacturer_pricing table for gateway field split
-- Date: 2025-12-19
-- Purpose: Add gateway_1_2 and gateway_3_4 pricing entries and deprecate old gateway entry
-- Reference: 게이트웨이(1,2) - 1,000,000원 / 게이트웨이(3,4) - 1,420,000원 (에코센스 기준)

-- ============================================================================
-- STEP 1: 에코센스 제조사 게이트웨이 분리 가격 추가
-- ============================================================================

-- 1-1. 게이트웨이(1,2) 가격 추가 (1,000,000원)
INSERT INTO manufacturer_pricing (manufacturer, equipment_type, cost_price, effective_from, effective_to)
VALUES ('에코센스', 'gateway_1_2', 1000000, '2025-01-01', NULL)
ON CONFLICT (manufacturer, equipment_type, effective_from) DO UPDATE
SET cost_price = 1000000,
    effective_to = NULL;

-- 1-2. 게이트웨이(3,4) 가격 추가 (1,420,000원)
INSERT INTO manufacturer_pricing (manufacturer, equipment_type, cost_price, effective_from, effective_to)
VALUES ('에코센스', 'gateway_3_4', 1420000, '2025-01-01', NULL)
ON CONFLICT (manufacturer, equipment_type, effective_from) DO UPDATE
SET cost_price = 1420000,
    effective_to = NULL;

-- ============================================================================
-- STEP 2: 다른 제조사들도 gateway_1_2, gateway_3_4 추가 (기존 gateway 가격 사용)
-- ============================================================================

-- 2-1. 가이아씨앤에스 (기존 gateway: 550,000원)
INSERT INTO manufacturer_pricing (manufacturer, equipment_type, cost_price, effective_from, effective_to)
VALUES
  ('가이아씨앤에스', 'gateway_1_2', 550000, '2025-01-01', NULL),
  ('가이아씨앤에스', 'gateway_3_4', 550000, '2025-01-01', NULL)
ON CONFLICT (manufacturer, equipment_type, effective_from) DO UPDATE
SET cost_price = EXCLUDED.cost_price,
    effective_to = NULL;

-- 2-2. 이브이에스 (기존 gateway: 1,100,000원)
INSERT INTO manufacturer_pricing (manufacturer, equipment_type, cost_price, effective_from, effective_to)
VALUES
  ('이브이에스', 'gateway_1_2', 1100000, '2025-01-01', NULL),
  ('이브이에스', 'gateway_3_4', 1100000, '2025-01-01', NULL)
ON CONFLICT (manufacturer, equipment_type, effective_from) DO UPDATE
SET cost_price = EXCLUDED.cost_price,
    effective_to = NULL;

-- 2-3. 크린어스 (기존 gateway: 630,000원)
INSERT INTO manufacturer_pricing (manufacturer, equipment_type, cost_price, effective_from, effective_to)
VALUES
  ('크린어스', 'gateway_1_2', 630000, '2025-01-01', NULL),
  ('크린어스', 'gateway_3_4', 630000, '2025-01-01', NULL)
ON CONFLICT (manufacturer, equipment_type, effective_from) DO UPDATE
SET cost_price = EXCLUDED.cost_price,
    effective_to = NULL;

-- ============================================================================
-- STEP 3: 기존 gateway 항목 비활성화 (effective_to 설정)
-- ============================================================================

-- 3-1. 모든 제조사의 기존 gateway 항목을 2025-01-01부터 비활성화
UPDATE manufacturer_pricing
SET effective_to = '2025-01-01'
WHERE equipment_type = 'gateway'
  AND effective_to IS NULL;

-- ============================================================================
-- STEP 4: 검증 쿼리
-- ============================================================================

-- 4-1. 게이트웨이 관련 모든 가격 정보 확인
SELECT
  manufacturer,
  equipment_type,
  cost_price,
  effective_from,
  effective_to,
  CASE
    WHEN effective_to IS NULL THEN '✅ 현재 적용중'
    ELSE '⚠️ 비활성화됨'
  END as status
FROM manufacturer_pricing
WHERE equipment_type LIKE '%gateway%'
ORDER BY manufacturer, equipment_type;

-- 4-2. 에코센스 제조사 게이트웨이 가격 확인
SELECT
  equipment_type,
  cost_price,
  effective_to
FROM manufacturer_pricing
WHERE manufacturer = '에코센스'
  AND equipment_type LIKE '%gateway%'
ORDER BY equipment_type;

-- 4-3. 활성화된 게이트웨이 항목 개수 확인
SELECT
  manufacturer,
  COUNT(*) as active_gateway_count
FROM manufacturer_pricing
WHERE equipment_type LIKE '%gateway%'
  AND effective_to IS NULL
GROUP BY manufacturer
ORDER BY manufacturer;

-- 예상 결과:
-- 각 제조사당 2개 (gateway_1_2, gateway_3_4)
-- 에코센스: gateway_1_2 = 1,000,000원, gateway_3_4 = 1,420,000원
-- 기타 제조사: 기존 gateway 가격으로 동일하게 설정
