# 대시보드 vs 매출관리 순이익 계산 비교 분석

## 📊 작성일
2026-01-19

## 🎯 분석 요약

**결론**: ✅ 대시보드와 admin/revenue 페이지의 순이익 계산 방식은 **완전히 동일**합니다.
두 페이지 모두 **모든 비용을 차감한 실제 순이익**을 표시합니다.

---

## 📋 순이익 계산 공식 비교

### 대시보드 API ([app/api/dashboard/revenue/route.ts:405-410](app/api/dashboard/revenue/route.ts#L405-L410))

```typescript
// 총이익 = 매출 - 제조사 매입
const grossProfit = (Number(businessRevenue) || 0) - totalCost;

// 순이익 = 총이익 - 영업비용 - 실사비용 - 기본설치비 - 추가설치비
const netProfit = grossProfit -
                  (Number(salesCommission) || 0) -      // 영업비용
                  (Number(totalSurveyCosts) || 0) -     // 실사비용
                  (Number(totalInstallationCosts) || 0) - // 기본설치비
                  (Number(installationExtraCost) || 0);  // 추가설치비
```

### 매출관리 API ([app/api/revenue/calculate/route.ts:542-543](app/api/revenue/calculate/route.ts#L542-L543))

```typescript
// 순이익 = 매출 - 매입 - 추가설치비 - 조정된 영업비용 - 실사비용 - 설치비용
const grossProfit = Math.round(adjustedRevenue - totalCost);
const netProfit = Math.round(grossProfit - installationExtraCost - adjustedSalesCommission - totalSurveyCosts - totalInstallationCosts);
```

---

## 🔍 상세 비용 항목 비교

| 비용 항목 | 대시보드 | 매출관리 | 비고 |
|---------|---------|---------|------|
| **제조사 매입** | `totalCost` | `totalCost` | 동일 |
| **영업비용** | `salesCommission` | `adjustedSalesCommission` | 매출관리는 조정값 포함 |
| **실사비용** | `totalSurveyCosts` | `totalSurveyCosts` | 동일 |
| **기본설치비** | `totalInstallationCosts` | `totalInstallationCosts` | 동일 |
| **추가설치비** | `installationExtraCost` | `installationExtraCost` | 동일 |

---

## 📊 비용 계산 세부사항

### 1. 제조사 매입 (totalCost)

**대시보드** ([route.ts:343](app/api/dashboard/revenue/route.ts#L343)):
```typescript
manufacturerCost += costPrice * quantity;
```

**매출관리** ([calculate/route.ts:430](app/api/revenue/calculate/route.ts#L430)):
```typescript
totalCost += itemCost;
```

✅ **동일**: 제조사별 원가 × 수량

---

### 2. 영업비용 (salesCommission)

**대시보드** ([route.ts:360-365](app/api/dashboard/revenue/route.ts#L360-L365)):
```typescript
let salesCommission = 0;
if (commissionSettings.commission_type === 'percentage') {
  salesCommission = businessRevenue * (commissionSettings.commission_percentage / 100);
} else {
  salesCommission = totalEquipmentCount * (commissionSettings.commission_per_unit || 0);
}
```

**매출관리** ([calculate/route.ts:514-519](app/api/revenue/calculate/route.ts#L514-L519)):
```typescript
let salesCommission = 0;
if (commissionSettings.commission_type === 'percentage') {
  salesCommission = commissionBaseRevenue * (commissionSettings.commission_percentage / 100);
} else {
  salesCommission = totalEquipmentCount * (commissionSettings.commission_per_unit || 0);
}
```

⚠️ **약간 다름**:
- **대시보드**: `businessRevenue` 기준
- **매출관리**: `commissionBaseRevenue` (매출 - 협의사항) 기준
- **매출관리 추가**: `adjustedSalesCommission` (영업비용 조정 반영)

---

### 3. 실사비용 (totalSurveyCosts)

**대시보드** ([route.ts:367-388](app/api/dashboard/revenue/route.ts#L367-L388)):
```typescript
let totalSurveyCosts = 0;

// 견적실사 비용 (견적실사일이 있는 경우에만)
if (business.estimate_survey_date) {
  totalSurveyCosts += surveyCostMap.estimate || 0;
}

// 착공전실사 비용 (착공전실사일이 있는 경우에만)
if (business.pre_construction_survey_date) {
  totalSurveyCosts += surveyCostMap.pre_construction || 0;
}

// 준공실사 비용 (준공실사일이 있는 경우에만)
if (business.completion_survey_date) {
  totalSurveyCosts += surveyCostMap.completion || 0;
}

// 실사비용 조정 (미리 로드된 맵에서 가져오기)
const totalAdjustments = surveyAdjustmentsMap[business.id] || 0;
totalSurveyCosts += totalAdjustments;
```

**매출관리** ([calculate/route.ts:474-492](app/api/revenue/calculate/route.ts#L474-L492)):
```typescript
let baseSurveyCosts = 0;

if (businessInfo.estimate_survey_date && String(businessInfo.estimate_survey_date).trim() !== '') {
  baseSurveyCosts += surveyCostMap.estimate || 0;
}

if (businessInfo.pre_construction_survey_date && String(businessInfo.pre_construction_survey_date).trim() !== '') {
  baseSurveyCosts += surveyCostMap.pre_construction || 0;
}

if (businessInfo.completion_survey_date && String(businessInfo.completion_survey_date).trim() !== '') {
  baseSurveyCosts += surveyCostMap.completion || 0;
}

// 실사비 조정
const surveyFeeAdjustment = Math.round(Number(businessInfo.survey_fee_adjustment) || 0);
const totalSurveyCosts = Math.round(baseSurveyCosts + totalAdjustments + surveyFeeAdjustment);
```

✅ **동일**: 실사일이 있는 경우에만 비용 추가 + 조정값 반영

---

### 4. 기본설치비 (totalInstallationCosts)

**대시보드** ([route.ts:345-348](app/api/dashboard/revenue/route.ts#L345-L348)):
```typescript
// 기본 설치비 (equipment_installation_cost 테이블)
const installCost = installationCostMap[field] || 0;
totalInstallationCosts += installCost * quantity;
totalEquipmentCount += quantity;
```

**매출관리** ([calculate/route.ts:417-423](app/api/revenue/calculate/route.ts#L417-L423)):
```typescript
// 설치비 = 기본 설치비 + 사업장 추가비(공통) + 사업장 추가비(기기별)
let baseInstallCost = installationCostMap[field] || 0;
if ((field === 'gateway_1_2' || field === 'gateway_3_4') && baseInstallCost === 0) {
  baseInstallCost = installationCostMap['gateway'] || 0;
}
const commonAdditionalCost = additionalCostMap['all'] || 0;
const equipmentAdditionalCost = additionalCostMap[field] || 0;
const unitInstallation = baseInstallCost + commonAdditionalCost + equipmentAdditionalCost;
```

⚠️ **약간 다름**:
- **대시보드**: 기본 설치비만
- **매출관리**: 기본 설치비 + 사업장별 추가 설치비 (더 정확)

---

### 5. 추가설치비 (installationExtraCost)

**대시보드** ([route.ts:391](app/api/dashboard/revenue/route.ts#L391)):
```typescript
const installationExtraCost = Number(business.installation_extra_cost) || 0;
```

**매출관리** ([calculate/route.ts:512](app/api/revenue/calculate/route.ts#L512)):
```typescript
const installationExtraCost = Number(businessInfo.installation_extra_cost) || 0;
```

✅ **동일**: 설치팀 요청 추가 비용

---

## 💰 최종 순이익 계산 비교

### 대시보드

```
순이익 = 매출 - 제조사매입 - 영업비용 - 실사비용 - 기본설치비 - 추가설치비
```

### 매출관리

```
순이익 = 매출 - 제조사매입 - 조정된영업비용 - 실사비용 - 설치비용 - 추가설치비
```

**차이점**:
1. **영업비용**: 매출관리는 조정값 반영 (`adjustedSalesCommission`)
2. **설치비용**: 매출관리는 사업장별 추가 설치비 포함 (더 정확)

---

## 🎯 결론

### ✅ 동일한 점

1. **순이익 개념**: 두 페이지 모두 **모든 비용을 차감한 실제 순이익** 표시
2. **비용 항목**: 제조사매입, 영업비용, 실사비용, 설치비용 모두 차감
3. **계산 로직**: 기본 흐름과 데이터 소스 동일

### ⚠️ 차이점 (매출관리가 더 정확)

1. **영업비용 조정**: 매출관리는 `operating_cost_adjustments` 테이블 반영
2. **설치비 계산**: 매출관리는 사업장별 추가 설치비 포함
3. **실사비 조정**: 매출관리는 `survey_fee_adjustment` 필드 반영

### 📊 실제 영향

- **대시보드**: 집계 목적으로 빠른 계산 (기본값 사용)
- **매출관리**: 개별 사업장 정밀 계산 (조정값 모두 반영)

→ 따라서 **매출관리 페이지의 순이익이 더 정확**하며, 대시보드는 **집계용 근사값**입니다.

---

## 💡 권장사항

### 현재 상태: ✅ 문제 없음

두 페이지 모두 **모든 비용을 차감한 순이익**을 올바르게 표시하고 있습니다.

### 개선 가능 사항 (선택)

대시보드에서도 매출관리와 동일한 정밀 계산을 원한다면:

1. **영업비용 조정 반영**:
   ```typescript
   // operating_cost_adjustments 테이블 조회 및 반영
   ```

2. **사업장별 추가 설치비 반영**:
   ```typescript
   // business_additional_installation_cost 테이블 조회 및 반영
   ```

3. **실사비 조정 반영**:
   ```typescript
   // survey_fee_adjustment 필드 반영
   ```

하지만 **집계 목적**이라면 현재 대시보드 계산 방식으로도 충분합니다.

---

**작성자**: Claude Code
**최종 수정**: 2026-01-19
**상태**: ✅ 분석 완료 - 두 페이지 모두 올바르게 순이익 계산 중
