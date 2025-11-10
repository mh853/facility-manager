-- revenue_calculations 테이블에 UNIQUE 제약 조건 추가
-- 생성일: 2025-11-10
-- 설명: UPSERT 작동을 위해 business_id + calculation_date 조합에 UNIQUE 제약 조건 추가

-- 1. 기존 중복 데이터 확인 (실행 전 확인용)
SELECT
    business_id,
    calculation_date,
    COUNT(*) as count
FROM revenue_calculations
GROUP BY business_id, calculation_date
HAVING COUNT(*) > 1
ORDER BY count DESC;

-- 2. 중복 데이터 정리 (최신 것만 남기고 삭제)
-- 주의: 실제 실행 전 백업 권장!
DELETE FROM revenue_calculations
WHERE id IN (
    SELECT id
    FROM (
        SELECT id,
               ROW_NUMBER() OVER (
                   PARTITION BY business_id, calculation_date
                   ORDER BY created_at DESC
               ) as rn
        FROM revenue_calculations
    ) t
    WHERE rn > 1
);

-- 3. UNIQUE 제약 조건 추가
ALTER TABLE revenue_calculations
ADD CONSTRAINT revenue_calculations_business_date_unique
UNIQUE (business_id, calculation_date);

-- 4. 인덱스 추가 (성능 향상)
CREATE INDEX IF NOT EXISTS idx_revenue_calculations_business_date
ON revenue_calculations(business_id, calculation_date);

-- 5. 검증 쿼리
-- 제약 조건이 제대로 추가되었는지 확인
SELECT
    constraint_name,
    constraint_type
FROM information_schema.table_constraints
WHERE table_name = 'revenue_calculations'
  AND constraint_type = 'UNIQUE';

-- 6. 테스트 쿼리
-- UPSERT가 작동하는지 테스트 (실행하지 말고 참고용)
/*
-- 첫 번째 INSERT
INSERT INTO revenue_calculations (business_id, calculation_date, net_profit, ...)
VALUES ('test-id', '2025-11-10', 1000000, ...)
ON CONFLICT (business_id, calculation_date)
DO UPDATE SET
    net_profit = EXCLUDED.net_profit,
    updated_at = NOW();

-- 두 번째 실행 시 UPDATE됨 (중복 INSERT 방지)
*/
