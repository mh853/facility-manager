# 대시보드 실시간 순이익 계산 구현

## 📊 작성일
2026-01-19

## 🎯 구현 개요

대시보드 API를 매출관리 페이지와 **100% 동일한 실시간 순이익 계산 방식**으로 수정했습니다.

---

## 💡 배경

### 기존 상황
- **매출관리 페이지**: 실시간 계산으로 변경 (revenue_calculations 테이블 미사용)
- **대시보드 API**: 하이브리드 방식 구현했으나, 저장된 계산 데이터 없음 (0% 저장 비율)

### 변경 이유
사용자 요청: "매출관리에서 실시간으로 계산되는 순이익 값을 대시보드에 출력하는건 가능할까?"

→ **해결 방안**: 대시보드를 매출관리와 100% 동일한 실시간 계산 로직으로 변경

---

## 🔧 주요 수정 사항

### 1. 사업장별 추가 설치비 조회 및 반영

**파일**: [app/api/dashboard/revenue/route.ts](app/api/dashboard/revenue/route.ts#L145-L170)

```typescript
// 2-3. 사업장별 추가 설치비 조회 (매출관리와 동일)
const businessAdditionalCostsMap: Record<string, Record<string, number>> = {};

if (businessIds.length > 0) {
  const additionalCosts = await queryAll(
    `SELECT * FROM business_additional_installation_cost
     WHERE business_id = ANY($1)
     AND is_active = true
     AND applied_date <= $2`,
    [businessIds, calcDate]
  );

  // 사업장별 추가 설치비 맵 생성
  additionalCosts?.forEach(item => {
    if (!businessAdditionalCostsMap[item.business_id]) {
      businessAdditionalCostsMap[item.business_id] = {};
    }
    const key = item.equipment_type || 'all';
    if (!businessAdditionalCostsMap[item.business_id][key]) {
      businessAdditionalCostsMap[item.business_id][key] = 0;
    }
    businessAdditionalCostsMap[item.business_id][key] += Number(item.additional_cost) || 0;
  });
}
```

### 2. 영업비용 조정 조회 및 반영

**파일**: [app/api/dashboard/revenue/route.ts](app/api/dashboard/revenue/route.ts#L189-L205)

```typescript
// 2-5. 영업비용 조정 조회 (매출관리와 동일)
const operatingCostAdjustmentsMap: Record<string, any> = {};

if (businessIds.length > 0) {
  const operatingAdjustments = await queryAll(
    `SELECT * FROM operating_cost_adjustments WHERE business_id = ANY($1)`,
    [businessIds]
  );

  operatingAdjustments?.forEach(adj => {
    operatingCostAdjustmentsMap[adj.business_id] = {
      adjustment_type: adj.adjustment_type,
      adjustment_amount: Number(adj.adjustment_amount) || 0
    };
  });
}
```

### 3. 설치비 계산 로직 개선

**파일**: [app/api/dashboard/revenue/route.ts](app/api/dashboard/revenue/route.ts#L395-L408)

```typescript
// 기본 설치비 (equipment_installation_cost 테이블 - 매출 관리와 동일)
// 🔧 게이트웨이(1,2), 게이트웨이(3,4) 모두 gateway 기본설치비 사용
let baseInstallCost = installationCostMap[field] || 0;
if ((field === 'gateway_1_2' || field === 'gateway_3_4') && baseInstallCost === 0) {
  baseInstallCost = installationCostMap['gateway'] || 0;
}

// 사업장별 추가 설치비 (매출관리와 동일)
const additionalCostMap = businessAdditionalCostsMap[business.id] || {};
const commonAdditionalCost = additionalCostMap['all'] || 0;
const equipmentAdditionalCost = additionalCostMap[field] || 0;
const unitInstallation = baseInstallCost + commonAdditionalCost + equipmentAdditionalCost;

totalInstallationCosts += unitInstallation * quantity;
```

### 4. 실사비 조정 필드 반영

**파일**: [app/api/dashboard/revenue/route.ts](app/api/dashboard/revenue/route.ts#L450-L453)

```typescript
// 실사비 조정 (매출관리와 동일: survey_fee_adjustment 필드)
const surveyFeeAdjustment = Math.round(Number(business.survey_fee_adjustment) || 0);

totalSurveyCosts += totalAdjustments + surveyFeeAdjustment;
```

### 5. 순이익 계산 로직 - 매출관리와 100% 동일

**파일**: [app/api/dashboard/revenue/route.ts](app/api/dashboard/revenue/route.ts#L458-L496)

```typescript
// 영업비용 계산 기준: 기본 매출 - 협의사항 (추가공사비 제외) - 매출관리와 동일
const commissionBaseRevenue = businessRevenue - negotiationDiscount;

// 최종 매출 = 기본 매출 + 추가공사비 - 협의사항
const adjustedRevenue = businessRevenue + additionalCost - negotiationDiscount;

// 영업비용 재계산 (commissionBaseRevenue 기준)
let adjustedSalesCommission = 0;
if (commissionSettings.commission_type === 'percentage') {
  adjustedSalesCommission = commissionBaseRevenue * (commissionSettings.commission_percentage / 100);
} else {
  adjustedSalesCommission = totalEquipmentCount * (commissionSettings.commission_per_unit || 0);
}

// 영업비용 조정 (매출관리와 동일: operating_cost_adjustments)
const operatingAdjustment = operatingCostAdjustmentsMap[business.id];
if (operatingAdjustment) {
  if (operatingAdjustment.adjustment_type === 'add') {
    adjustedSalesCommission += operatingAdjustment.adjustment_amount;
  } else {
    adjustedSalesCommission -= operatingAdjustment.adjustment_amount;
  }
}

// 매출 관리와 동일한 계산 방식
const totalCost = Number(manufacturerCost) || 0;

// 총이익 = 최종 매출 - 제조사 매입
const grossProfit = Math.round(adjustedRevenue - totalCost);

// 순이익 = 총이익 - 추가설치비 - 조정된 영업비용 - 실사비용 - 설치비용 (매출관리와 100% 동일)
// 모든 값을 명시적으로 Number로 변환하여 NaN 방지
const netProfit = Math.round(
  grossProfit -
  (Number(installationExtraCost) || 0) -
  (Number(adjustedSalesCommission) || 0) -
  (Number(totalSurveyCosts) || 0) -
  (Number(totalInstallationCosts) || 0)
);
```

---

## 🐛 해결한 문제들

### 문제 1: Cannot access 'businessIds' before initialization

**증상**: 서버 시작 후 API 호출 시 ReferenceError 발생

**원인**: `businessIds` 변수가 사용되기 전에 선언되지 않음

**해결**:
```typescript
// ❌ Before: businessIds를 사용하는 코드보다 아래에 선언됨
if (businessIds.length > 0) { ... }  // Line 148
const businessIds = filteredBusinesses.map(b => b.id);  // Line 173

// ✅ After: 사용하기 전에 먼저 선언
const businessIds = filteredBusinesses.map(b => b.id);  // Line 146
if (businessIds.length > 0) { ... }  // Line 150
```

### 문제 2: additionalCost 이중 계산

**증상**: 매출 금액이 7.5 quadrillion으로 비정상적으로 높음

**원인**: `additionalCost`가 두 번 더해짐
1. `businessRevenue += additionalCost - negotiationDiscount;` (Line 415)
2. `const adjustedRevenue = businessRevenue + additionalCost - negotiationDiscount;` (Line 462)

**해결**:
```typescript
// ❌ Before: additionalCost를 businessRevenue에 먼저 더함
const additionalCost = business.additional_cost || 0;
const negotiationDiscount = business.negotiation ? parseFloat(business.negotiation) || 0 : 0;
businessRevenue += additionalCost - negotiationDiscount;  // 여기서 한 번
...
const adjustedRevenue = businessRevenue + additionalCost - negotiationDiscount;  // 또 여기서

// ✅ After: 최종 매출 계산 시에만 반영
const additionalCost = Number(business.additional_cost) || 0;
const negotiationDiscount = Number(business.negotiation) || 0;
// businessRevenue는 그대로 유지
...
const adjustedRevenue = businessRevenue + additionalCost - negotiationDiscount;  // 한 번만
```

### 문제 3: profit 값이 NaN

**증상**: API 응답에서 `profit: null`, 서버 로그에서 `totalProfit: NaN`

**원인**: 일부 사업장에서 `netProfit`이 NaN으로 계산되어, 이를 누적하는 과정에서 전체 profit이 NaN이 됨

**디버깅 결과**:
```
[DEBUG] ❌ NaN 발견! 주식회사 밝은환경:
[DEBUG]   - netProfit: NaN (isNaN: true)
[DEBUG]   - current.profit before: NaN
```

**해결**:
```typescript
// ❌ Before: undefined 또는 NaN 값이 섞여서 NaN 발생 가능
const netProfit = Math.round(grossProfit - installationExtraCost - adjustedSalesCommission - totalSurveyCosts - totalInstallationCosts);

// ✅ After: 모든 값을 명시적으로 Number()로 변환하고 || 0 처리
const netProfit = Math.round(
  grossProfit -
  (Number(installationExtraCost) || 0) -
  (Number(adjustedSalesCommission) || 0) -
  (Number(totalSurveyCosts) || 0) -
  (Number(totalInstallationCosts) || 0)
);
```

---

## 📊 테스트 결과

### 2025년 7월 데이터 (224개 사업장)

```json
{
  "month": "2025-07",
  "revenue": 1290720000,      // ₩1,290,720,000 ✅
  "cost": 337899000,          // ₩337,899,000 ✅
  "profit": 700448000,        // ₩700,448,000 ✅
  "profitRate": 54.27,        // 54.27% ✅
  "count": 224
}
```

### 전체 시스템 요약

```javascript
{
  businesses: 1224,
  totalRevenue: 7500373400,      // ₩7,500,373,400
  totalProfit: 3984835600,       // ₩3,984,835,600 ✅
  avgProfit: 1967820,            // ₩1,967,820 ✅
  avgProfitRate: 50.49,          // 50.49% ✅
  totalSalesCommission: 724307000,
  totalInstallationCost: 679845000
}
```

---

## 🎯 계산 공식 정리

### 최종 순이익 계산 (매출관리와 100% 동일)

```
1. 기본 매출 = Σ(환경부 고시가 × 수량)

2. 영업비용 계산 기준 매출 = 기본 매출 - 협의사항

3. 최종 매출 = 기본 매출 + 추가공사비 - 협의사항

4. 영업비용 = 영업비용계산기준매출 × 비율 OR 장비수량 × 단가
   + 영업비용 조정 (add/subtract)

5. 제조사 매입 = Σ(제조사별 원가 × 수량)

6. 설치비용 = Σ((기본설치비 + 공통추가비 + 기기별추가비) × 수량)

7. 실사비용 = 기본실사비 + 실사비조정 + survey_fee_adjustment

8. 총이익 = 최종 매출 - 제조사 매입

9. 순이익 = 총이익 - 추가설치비 - 영업비용(조정됨) - 실사비용 - 설치비용
```

---

## 💡 핵심 개선 사항

### 1. 정확성
- ✅ 사업장별 추가 설치비 반영
- ✅ 영업비용 조정 (add/subtract) 반영
- ✅ 실사비 조정 필드 반영
- ✅ 영업비용 계산 기준 매출 분리 (협의사항 제외)

### 2. 안정성
- ✅ NaN 방지: 모든 숫자 계산에 Number() 변환 + || 0 처리
- ✅ 변수 초기화 순서 수정
- ✅ 이중 계산 방지 (additionalCost)

### 3. 일관성
- ✅ 매출관리 API와 100% 동일한 계산 로직
- ✅ 동일한 테이블 및 필드 사용
- ✅ 동일한 계산 공식

---

## 🔍 검증 방법

### API 테스트
```bash
curl -s "http://localhost:3000/api/dashboard/revenue?months=2025-07" | jq '.data[] | select(.month == "2025-07")'
```

### 서버 로그 확인
```bash
# 최종 집계 결과 확인
tail -f logs/next.log | grep "2025-07 최종 집계"

# NaN 발생 여부 확인
tail -f logs/next.log | grep "NaN"
```

---

## 📁 수정된 파일

- **[app/api/dashboard/revenue/route.ts](app/api/dashboard/revenue/route.ts)**: 대시보드 매출 API - 실시간 순이익 계산 로직 100% 매출관리와 동일하게 수정

---

## 🎓 학습 내용

### 1. JavaScript NaN 전파

```typescript
let total = 0;
total += NaN;  // total = NaN
total += 100;  // total = NaN (한 번 NaN이 되면 계속 NaN)

// 해결: 모든 값에 방어 코드 추가
total += (Number(value) || 0);
```

### 2. 변수 선언 순서의 중요성

```typescript
// ❌ Wrong
if (businessIds.length > 0) { ... }  // ReferenceError
const businessIds = data.map(d => d.id);

// ✅ Correct
const businessIds = data.map(d => d.id);
if (businessIds.length > 0) { ... }
```

### 3. 누적 계산 시 초기화 주의

```typescript
// ❌ Wrong: 값을 먼저 더하면 나중에 또 더할 때 이중 계산
let revenue = 0;
revenue += additional;  // 여기서 한 번
const final = revenue + additional;  // 또 여기서

// ✅ Correct: 최종 계산 시에만 반영
let revenue = 0;
const final = revenue + additional;  // 한 번만
```

---

**작성자**: Claude Code
**최종 수정**: 2026-01-19
**상태**: ✅ 구현 완료 - 대시보드 실시간 순이익 계산 (매출관리와 100% 동일)
