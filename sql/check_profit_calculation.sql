-- 이익금액 계산 문제 확인 쿼리
-- (주)가경스틸쇼트도장, (주)계산 및 기타 문제 사업장 확인

-- 1. 문제 사업장 직접 확인
SELECT
    business_name as "사업장명",
    total_revenue as "매출금액",
    total_cost as "매입금액",
    net_profit as "이익금액_DB",
    gross_profit as "총이익금액_DB",
    (total_revenue - total_cost) as "계산된_총이익",
    CASE
        WHEN total_revenue > 0 THEN ((net_profit / total_revenue) * 100)::NUMERIC(10,2)
        ELSE 0
    END as "이익률_DB(%)",
    has_calculation as "계산여부",
    calculation_date as "계산일"
FROM business_info
WHERE business_name IN ('(주)가경스틸쇼트도장', '(주)계산')
ORDER BY business_name;

-- 2. 이익금액이 이상한 모든 사업장 찾기
-- (매출 > 0 이고 매입 > 0 이지만 이익금액이 0이거나 NULL인 경우)
SELECT
    business_name as "사업장명",
    total_revenue as "매출금액",
    total_cost as "매입금액",
    net_profit as "이익금액",
    (total_revenue - total_cost) as "예상_총이익",
    has_calculation as "계산여부",
    calculation_date as "계산일"
FROM business_info
WHERE total_revenue > 0
  AND total_cost > 0
  AND (net_profit IS NULL OR net_profit = 0)
ORDER BY total_revenue DESC;

-- 3. 이익금액이 계산식과 맞지 않는 사업장 찾기
-- (총이익 = 매출 - 매입인데 이게 안 맞는 경우)
SELECT
    business_name as "사업장명",
    total_revenue as "매출금액",
    total_cost as "매입금액",
    gross_profit as "총이익금액_DB",
    (total_revenue - total_cost) as "계산된_총이익",
    ABS(gross_profit - (total_revenue - total_cost)) as "차이금액",
    net_profit as "순이익금액",
    calculation_date as "계산일"
FROM business_info
WHERE total_revenue > 0
  AND total_cost > 0
  AND ABS(gross_profit - (total_revenue - total_cost)) > 100
ORDER BY "차이금액" DESC
LIMIT 20;

-- 4. revenue_calculations 테이블에서 해당 사업장 계산 이력 확인
SELECT
    rc.business_name as "사업장명",
    rc.calculation_date as "계산일",
    rc.total_revenue as "매출금액",
    rc.total_cost as "매입금액",
    rc.gross_profit as "총이익",
    rc.net_profit as "순이익",
    rc.sales_commission as "영업수수료",
    rc.survey_costs as "실사비용",
    rc.installation_costs as "설치비용",
    rc.created_at as "생성일시"
FROM revenue_calculations rc
WHERE rc.business_name IN ('(주)가경스틸쇼트도장', '(주)계산')
ORDER BY rc.business_name, rc.calculation_date DESC;
