# 월마감 이익 계산 분석 - 주식회사 무계바이오 농업회사법인

## 문제 상황

**사업장**: 주식회사 무계바이오 농업회사법인
**매출**: 900,000원
**이익**: 800,000원 (88.9% 이익률)

이익률이 88.9%로 비정상적으로 높게 나타남.

## 순이익 계산 공식

**파일**: `/app/api/revenue/calculate/route.ts`

```typescript
// 순이익 = 매출 - 매입 - 추가설치비 - 조정된영업비용 - 실사비용 - 설치비용
const grossProfit = adjustedRevenue - totalCost;
const netProfit = grossProfit - installationExtraCost - adjustedSalesCommission - totalSurveyCosts - totalInstallationCosts;
```

**계산 요소**:
1. **매출** (`adjustedRevenue`): 900,000원
2. **매입** (`totalCost`): ? (원가)
3. **추가설치비** (`installationExtraCost`): ?
4. **조정된 영업비용** (`adjustedSalesCommission`): ?
5. **실사비용** (`totalSurveyCosts`): ?
6. **설치비용** (`totalInstallationCosts`): ?

**역산**:
```
900,000 - (매입 + 추가설치비 + 영업비용 + 실사비용 + 설치비용) = 800,000
→ 총 비용 = 100,000원 (11.1%)
```

## 가능한 원인

### 1. 매입 원가 데이터 부재 ⚠️ (가장 가능성 높음)

**증상**:
- 제조사 원가 데이터가 없어서 `totalCost = 0`으로 계산됨
- 이전에 발견했던 제조사 이름 whitespace 문제가 해결되지 않았을 수 있음

**확인 방법**:
```sql
-- revenue_calculations 테이블에서 해당 사업장 데이터 확인
SELECT
  business_name,
  total_revenue,
  total_cost,
  installation_costs,
  sales_commission,
  adjusted_sales_commission,
  survey_costs,
  net_profit,
  calculation_date
FROM revenue_calculations
WHERE business_name LIKE '%무계바이오%'
ORDER BY calculation_date DESC
LIMIT 1;
```

**예상 결과**:
```
business_name: 주식회사 무계바이오 농업회사법인
total_revenue: 900,000
total_cost: 0  ← 문제!
installation_costs: 50,000
sales_commission: 30,000
adjusted_sales_commission: 30,000
survey_costs: 20,000
net_profit: 800,000
```

### 2. 비용 항목 데이터 누락

다른 비용 항목들이 모두 0이거나 매우 작은 값일 수 있음:

**확인 사항**:
- **설치비** (`installation_costs`): 설치비 기본값이 설정되어 있는지 확인
- **영업비** (`sales_commission`): 해당 영업점의 수수료율이 설정되어 있는지 확인
- **실사비** (`survey_costs`): 견적서, 착공 전, 준공 실사비용 데이터 확인

### 3. 특수한 사업장 유형

**가능성**:
- 농업회사법인이라는 특수한 사업장 유형
- 제조사 데이터가 특이하게 저장되어 있을 수 있음
- 비용 면제 또는 특별 요율 적용 가능성

## 확인 절차

### 1단계: revenue_calculations 데이터 확인

```sql
SELECT *
FROM revenue_calculations
WHERE business_name LIKE '%무계바이오%'
ORDER BY calculation_date DESC
LIMIT 1;
```

### 2단계: business_info 데이터 확인

```sql
SELECT
  id,
  business_name,
  manufacturer,
  sales_office,
  installation_date
FROM business_info
WHERE business_name LIKE '%무계바이오%';
```

### 3단계: 제조사 원가 데이터 확인

```sql
-- business_info에서 제조사 확인 후
SELECT *
FROM manufacturer_pricing
WHERE manufacturer = '해당 제조사명'
  AND is_active = true;
```

### 4단계: 영업점 수수료율 확인

```sql
-- business_info에서 영업점 확인 후
SELECT *
FROM sales_office_commission_rates
WHERE sales_office = '해당 영업점명'
  AND is_active = true;
```

## 해결 방안

### 원인 1: 매입 원가 0원

**해결**:
1. `manufacturer_pricing` 테이블에 해당 제조사의 원가 데이터 추가
2. 또는 제조사 이름에 whitespace가 있는지 확인하고 trim 처리

```sql
-- 제조사 이름 정리
UPDATE business_info
SET manufacturer = TRIM(manufacturer)
WHERE business_name LIKE '%무계바이오%';
```

### 원인 2: 비용 항목 누락

**해결**:
1. `equipment_installation_cost` 테이블에 설치비 데이터 확인/추가
2. `sales_office_commission_rates` 테이블에 수수료율 확인/추가
3. 실사비용 데이터 확인

### 재계산

데이터 수정 후 해당 사업장만 재계산:

```bash
# 브라우저 콘솔에서
fetch('/api/revenue/calculate', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${localStorage.getItem('token')}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    business_id: '해당사업장ID',
    calculation_date: '2025-XX-XX',
    save_result: true
  })
}).then(r => r.json()).then(console.log);
```

## 정상 범위 참고

**일반적인 이익률**:
- **매출**: 100%
- **매입 원가**: 60-75% (제조사별 상이)
- **영업비**: 3-10%
- **설치비**: 5-15%
- **실사비**: 1-3%
- **순이익**: 10-25% (정상 범위)

**현재 상황**:
- **순이익**: 88.9% ← 비정상적으로 높음
- **총 비용**: 11.1% ← 비정상적으로 낮음

## 다음 단계

1. ✅ 위 SQL 쿼리로 실제 데이터 확인
2. ✅ 원인 파악 (매입 원가 or 비용 항목 누락)
3. ✅ 데이터 수정
4. ✅ 해당 사업장 매출 재계산
5. ✅ 2025년 해당 월 마감 재계산

## 관련 파일

- `/app/api/revenue/calculate/route.ts` - 매출 계산 로직
- `/app/api/admin/monthly-closing/[id]/details/route.ts` - 월마감 상세 조회
- `/app/admin/monthly-closing/page.tsx` - 월마감 UI
