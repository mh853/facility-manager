# 이익금액 계산 문제 분석 보고서

## 📋 문제 요약

**보고된 증상:**
- **(주)가경스틸쇼트도장**, **(주)계산** 사업장에서:
  - ✅ 매출금액, 매입금액은 올바르게 표시됨
  - ❌ 이익금액과 이익률이 잘못된 값으로 표시됨

**예상 범위:** 다른 사업장들도 동일한 문제를 가지고 있을 가능성이 높음

---

## 🔍 근본 원인 분석

### 1. 매출 계산 시스템 구조

현재 시스템은 **수동 계산 방식**으로 작동합니다:

```typescript
// app/admin/revenue/page.tsx:557-570
return {
  ...business,
  // 서버 계산 결과가 있으면 우선 사용, 없으면 클라이언트 자동 계산 값 사용
  total_revenue: revenueCalc?.total_revenue || business.total_revenue || 0,
  total_cost: revenueCalc?.total_cost || business.total_cost || 0,
  net_profit: revenueCalc?.net_profit || business.net_profit || 0,    // ← 문제 지점
  gross_profit: revenueCalc?.gross_profit || business.gross_profit || 0,
  has_calculation: !!revenueCalc || business.has_calculation || false,
  // ...
};
```

**데이터 우선순위:**
1. `revenueCalc` (revenue_calculations 테이블) - 최우선
2. `business` (business_info 테이블) - 폴백

### 2. 계산이 트리거되는 시점

**수동 계산 방법 (2가지):**

#### A. 개별 사업장 계산
```typescript
// app/admin/revenue/page.tsx:352-409
const calculateRevenue = async (businessId: string) => {
  const response = await fetch('/api/revenue/calculate', {
    method: 'POST',
    body: JSON.stringify({
      business_id: businessId,
      calculation_date: new Date().toISOString().split('T')[0],
      save_result: userPermission >= 3  // 관리자만 DB에 저장
    })
  });
  // ...
};
```

#### B. 전체 사업장 일괄 계산
```typescript
// app/admin/revenue/page.tsx:411-478
const calculateAllBusinesses = async () => {
  // 이미 계산된 사업장은 건너뜀
  const businessesToCalculate = businesses.filter(b => {
    const hasCalculation = calculations.some(c => c.business_id === b.id);
    return !hasCalculation;  // ← 계산 안 된 것만 계산
  });
  // ...
};
```

### 3. 문제의 핵심

**❌ 문제 시나리오:**

1. 사업장 데이터가 `business_info` 테이블에 존재
2. 하지만 `revenue_calculations` 테이블에 계산 기록이 없음
3. 화면 표시 시 `business.net_profit` 값을 사용
4. **`business_info` 테이블의 이익금액이 오래되었거나 잘못된 값일 경우 문제 발생**

**✅ 정상 시나리오:**

1. 매출 계산 버튼 클릭 (개별 또는 일괄)
2. `/api/revenue/calculate` 엔드포인트 호출
3. 정확한 계산 수행:
   ```typescript
   // app/api/revenue/calculate/route.ts:363-364
   const grossProfit = adjustedRevenue - totalCost;
   const netProfit = grossProfit - salesCommission - totalSurveyCosts - totalInstallationCosts;
   ```
4. `revenue_calculations` 테이블에 저장
5. `business_info` 테이블도 업데이트
6. 화면에 올바른 값 표시

---

## 🔎 진단 방법

### SQL 쿼리 실행 (Supabase SQL Editor)

이미 생성된 파일 사용: `sql/check_profit_calculation.sql`

#### 쿼리 1: 문제 사업장 직접 확인
```sql
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
```

**예상 결과:**
- `net_profit`이 0 또는 `(total_revenue - total_cost)`와 다른 값
- `has_calculation`이 false일 가능성

#### 쿼리 2: 모든 문제 사업장 찾기
```sql
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
```

**이 쿼리로 확인 가능:**
- 매출/매입은 있는데 이익금액이 0이거나 NULL인 모든 사업장

#### 쿼리 3: 계산식 불일치 사업장
```sql
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
```

**이 쿼리로 확인 가능:**
- gross_profit ≠ (revenue - cost)인 사업장 (100원 이상 차이)

#### 쿼리 4: 계산 이력 확인
```sql
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
```

**예상 결과:**
- 해당 사업장의 계산 기록이 없거나 오래된 기록만 있을 것

---

## 🛠️ 해결 방법

### 즉시 해결 (임시 방법)

**1. 개별 사업장 재계산**
- 매출 관리 페이지 (`/admin/revenue`)에서
- 각 사업장 행의 "계산" 버튼 클릭
- 올바른 이익금액으로 업데이트됨

**2. 전체 사업장 일괄 재계산**
- 매출 관리 페이지 상단의 "전체 재계산" 버튼 클릭
- 계산 안 된 모든 사업장을 자동 계산

### 근본 해결 (권장)

#### 옵션 A: 자동 계산 시스템 구현 (추천)

**장점:**
- 사용자가 계산 버튼을 누를 필요 없음
- 항상 최신 데이터 유지
- 데이터 불일치 방지

**구현 방법:**
1. 사업장 데이터 변경 시 자동으로 계산 트리거
2. 또는 페이지 로드 시 계산 안 된 사업장 자동 계산

#### 옵션 B: 데이터 검증 강화

**장점:**
- 현재 시스템 구조 유지
- 문제 조기 발견

**구현 방법:**
1. 화면에 "계산 필요" 경고 표시
2. 필터로 "계산 안 된 사업장" 분리 표시
3. 주기적인 데이터 검증 배치 작업

#### 옵션 C: 계산 상태 명확화

**장점:**
- 사용자가 어떤 사업장이 계산이 필요한지 알 수 있음
- 투명성 증가

**구현 방법:**
1. 각 사업장 행에 "마지막 계산일" 표시
2. 오래된 계산은 노란색 경고
3. 계산 안 된 사업장은 빨간색 경고

---

## 📊 다음 단계

### 1단계: 문제 범위 파악 ⏳
```bash
# Supabase SQL Editor에서 위의 4개 쿼리 실행
# 결과를 저장하여 몇 개 사업장이 영향받는지 확인
```

### 2단계: 임시 수정 (즉시 가능)
```
매출 관리 페이지 → "전체 재계산" 버튼 클릭
→ 모든 사업장의 이익금액이 올바르게 업데이트됨
```

### 3단계: 근본 해결 (개발 필요)
- 옵션 A, B, C 중 선택
- 코드 수정 및 테스트
- 배포

---

## 💡 권장 사항

**즉시 실행:**
1. ✅ `sql/check_profit_calculation.sql` 쿼리 실행하여 문제 범위 확인
2. ✅ 매출 관리 페이지에서 "전체 재계산" 실행

**단기 (1-2일):**
- 자동 계산 시스템 구현 (옵션 A)
- 또는 계산 상태 UI 개선 (옵션 C)

**중기 (1주):**
- 데이터 검증 배치 작업 추가
- 계산 이력 모니터링 대시보드

---

## 📁 관련 파일

- `sql/check_profit_calculation.sql` - 진단 SQL 쿼리
- `app/api/revenue/calculate/route.ts:363-364` - 계산 로직
- `app/admin/revenue/page.tsx:352-478` - 계산 트리거
- `app/admin/revenue/page.tsx:557-570` - 데이터 표시 로직

---

## 🎯 요약

**문제:** 일부 사업장이 `revenue_calculations` 테이블에 계산 기록이 없어서 오래된/잘못된 `business_info` 값을 표시

**원인:** 수동 계산 시스템이라 사용자가 계산 버튼을 누르지 않으면 계산이 안 됨

**해결:** 전체 재계산 버튼으로 임시 해결 가능, 장기적으로는 자동 계산 시스템 구현 권장
