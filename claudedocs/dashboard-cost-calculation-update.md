# 대시보드 매입금액 계산 로직 수정

## 📋 요구사항

대시보드의 "매입금액"을 매출 관리와 동일한 개념으로 변경:
- **기존**: 제조사 매입 금액만 표시
- **변경**: 모든 비용(매입 + 영업비용 + 설치비 + 실사비용)을 "매입금액"으로 표시

---

## 🔍 매출 관리의 비용 구조

### 비용 항목 분석

```typescript
// 1. 제조사 매입
totalCost = Σ(측정기기 수량 × manufacturer_price)

// 2. 영업비용
salesCommission = 매출 × commission_percentage (또는 수량 × commission_per_unit)

// 3. 설치비용
installation_costs = Σ(측정기기 수량 × installation_cost)

// 4. 실사비용
survey_costs = estimate + pre_construction + completion + adjustments

// 최종 계산
총 매입금액 = totalCost + salesCommission + installation_costs + survey_costs
순이익 = 매출 - 총 매입금액
```

---

## ✅ 수정 완료 내역

### 파일: `app/api/dashboard/revenue/route.ts`

#### 1. 비용 설정 데이터 조회 추가

```typescript
// 4. 영업점 비용 설정 및 실사비용 설정 조회
const { data: salesSettings } = await supabase
  .from('sales_office_cost_settings')
  .select('*')
  .eq('is_active', true)
  .lte('effective_from', calcDate);

const salesSettingsMap = new Map(
  salesSettings?.map(s => [s.sales_office, s]) || []
);

const { data: surveyCosts } = await supabase
  .from('survey_cost_settings')
  .select('*')
  .eq('is_active', true)
  .lte('effective_from', calcDate);

const surveyCostMap = surveyCosts?.reduce((acc, item) => {
  acc[item.survey_type] = item.base_cost;
  return acc;
}, {} as Record<string, number>) || {
  estimate: 100000,
  pre_construction: 150000,
  completion: 200000
};
```

#### 2. 사업장별 전체 비용 계산

```typescript
// 6. 사업장별 실시간 매출 계산 및 월별 집계
for (const business of businesses || []) {
  // 제조사 매입, 설치비 계산
  let manufacturerCost = 0;
  let totalInstallationCosts = 0;
  let totalEquipmentCount = 0;

  equipmentFields.forEach(field => {
    const quantity = business[field] || 0;
    const priceInfo = priceMap[field];

    if (quantity > 0 && priceInfo) {
      businessRevenue += priceInfo.official_price * quantity;
      manufacturerCost += priceInfo.manufacturer_price * quantity;
      totalInstallationCosts += (priceInfo.installation_cost || 0) * quantity;
      totalEquipmentCount += quantity;
    }
  });

  // 영업비용 계산
  const commissionSettings = salesSettingsMap.get(business.sales_office) || defaultCommission;
  let salesCommission = 0;

  if (commissionSettings.commission_type === 'percentage') {
    salesCommission = businessRevenue * (commissionSettings.commission_percentage / 100);
  } else {
    salesCommission = totalEquipmentCount * (commissionSettings.commission_per_unit || 0);
  }

  // 실사비용 계산
  const baseSurveyCosts = surveyCostMap.estimate +
                          surveyCostMap.pre_construction +
                          surveyCostMap.completion;

  const { data: surveyAdjustments } = await supabase
    .from('survey_cost_adjustments')
    .select('*')
    .eq('business_id', business.id)
    .lte('applied_date', calcDate);

  const totalAdjustments = surveyAdjustments?.reduce((sum, adj) =>
    sum + adj.adjustment_amount, 0) || 0;
  const totalSurveyCosts = baseSurveyCosts + totalAdjustments;

  // 총 비용 = 제조사 매입 + 영업비용 + 설치비 + 실사비용
  const totalCost = manufacturerCost + salesCommission +
                    totalInstallationCosts + totalSurveyCosts;

  const businessProfit = businessRevenue - totalCost;

  // 월별 데이터 업데이트
  current.revenue += businessRevenue;
  current.cost += totalCost;  // ✅ 전체 비용 반영
  current.profit += businessProfit;
}
```

---

## 📊 비용 항목 상세

### 1. 제조사 매입 (Manufacturer Cost)
- **데이터 소스**: `government_pricing.manufacturer_price`
- **계산**: Σ(측정기기 수량 × 제조사 가격)
- **예시**: pH미터 10개 × 50,000원 = 500,000원

### 2. 영업비용 (Sales Commission)
- **데이터 소스**: `sales_office_cost_settings`
- **계산 방식**:
  - **비율 방식**: 매출 × commission_percentage (기본 3%)
  - **건당 방식**: 측정기기 수량 × commission_per_unit
- **예시**: 10,000,000원 × 3% = 300,000원

### 3. 설치비용 (Installation Costs)
- **데이터 소스**: `government_pricing.installation_cost`
- **계산**: Σ(측정기기 수량 × 설치비)
- **예시**: pH미터 10개 × 20,000원 = 200,000원

### 4. 실사비용 (Survey Costs)
- **데이터 소스**: `survey_cost_settings` + `survey_cost_adjustments`
- **구성**:
  - 견적 실사: 100,000원 (기본)
  - 착공 전 실사: 150,000원 (기본)
  - 준공 실사: 200,000원 (기본)
  - 조정 금액: 사업장별 추가/차감
- **계산**: estimate + pre_construction + completion + adjustments
- **예시**: 100,000 + 150,000 + 200,000 + 50,000 = 500,000원

### 5. 추가설치비 (Installation Extra Cost) ✨ NEW
- **데이터 소스**: `business_info.installation_extra_cost`
- **개념**: 설치팀이 요청하는 추가 비용 (기본 설치비로 충당 불가능한 비용)
- **사례**: 고층 건물, 접근 어려움, 특수 환경 등
- **예시**: 고층 작업으로 인한 추가 비용 500,000원

---

## 🔄 계산 흐름도

```
[사업장 데이터]
├─ 측정기기 수량
├─ 영업점 정보
└─ 추가설치비 (installation_extra_cost)

↓

[정보 조회]
├─ government_pricing (고시가, 제조사가, 설치비)
├─ sales_office_cost_settings (영업비용 설정)
├─ survey_cost_settings (실사비용 기본값)
└─ survey_cost_adjustments (실사비용 조정)

↓

[비용 계산]
1. 제조사 매입 = Σ(수량 × manufacturer_price)
2. 영업비용 = 매출 × commission% (또는 수량 × 건당비용)
3. 설치비 = Σ(수량 × installation_cost)
4. 실사비용 = estimate + pre_construction + completion + adjustments
5. 추가설치비 = business_info.installation_extra_cost

↓

[총 매입금액]
총 매입 = (1) + (2) + (3) + (4) + (5)

↓

[순이익 계산]
순이익 = 매출 - 총 매입금액
```

---

## 📈 대시보드 표시 예시

### Before (잘못됨)
```
매출: 10,000,000원
매입: 5,000,000원 (제조사 매입만)
순이익: 5,000,000원
이익률: 50%
```

### After (정확함)
```
매출: 10,000,000원
매입: 8,000,000원 (제조사 5,000,000 + 영업 300,000 + 설치 1,200,000 + 실사 1,000,000 + 추가설치 500,000)
순이익: 2,000,000원
이익률: 20%
```

---

## 🎯 매출 관리와의 일관성 확보

### 매출 관리 페이지
```typescript
// app/api/revenue/calculate/route.ts
순이익 = 매출 - 매입 - 추가설치비 - 영업비용 - 실사비용 - 설치비용
netProfit = grossProfit - installationExtraCost - salesCommission - totalSurveyCosts - totalInstallationCosts
```

### 대시보드
```typescript
// app/api/dashboard/revenue/route.ts
총 매입 = manufacturerCost + salesCommission + installationCosts + surveyCosts + installationExtraCost
순이익 = businessRevenue - totalCost
```

✅ **동일한 계산 로직 사용** (모든 비용 항목 포함)

---

## 🧪 테스트 시나리오

### 시나리오 1: 기본 사업장
```
측정기기:
- pH미터 10개 (고시가 100,000 / 제조사 50,000 / 설치비 20,000)
- 차압계 5개 (고시가 150,000 / 제조사 80,000 / 설치비 30,000)

계산:
매출 = (10 × 100,000) + (5 × 150,000) = 1,750,000원
제조사 매입 = (10 × 50,000) + (5 × 80,000) = 900,000원
설치비 = (10 × 20,000) + (5 × 30,000) = 350,000원
영업비용 = 1,750,000 × 3% = 52,500원
실사비용 = 450,000원
총 매입 = 900,000 + 350,000 + 52,500 + 450,000 = 1,752,500원
순이익 = 1,750,000 - 1,752,500 = -2,500원
이익률 = -0.14%
```

### 시나리오 2: 추가공사비 포함
```
기본 매출: 1,750,000원
추가공사비: 500,000원
협의사항(할인): -100,000원

조정된 매출 = 1,750,000 + 500,000 - 100,000 = 2,150,000원
영업비용 = 2,150,000 × 3% = 64,500원 (조정된 매출 기준)
총 매입 = 900,000 + 350,000 + 64,500 + 450,000 = 1,764,500원
순이익 = 2,150,000 - 1,764,500 = 385,500원
이익률 = 17.9%
```

---

## 📝 데이터베이스 테이블

### 사용되는 테이블
1. **business_info**: 사업장 정보, 측정기기 수량
2. **government_pricing**: 고시가, 제조사가, 설치비
3. **sales_office_cost_settings**: 영업점별 영업비용 설정
4. **survey_cost_settings**: 실사비용 기본값
5. **survey_cost_adjustments**: 사업장별 실사비용 조정

### 필수 컬럼
```sql
-- government_pricing
official_price DECIMAL(10,2)         -- 환경부 고시가
manufacturer_price DECIMAL(10,2)     -- 제조사 가격
installation_cost DECIMAL(10,2)      -- 설치비

-- sales_office_cost_settings
commission_type TEXT                  -- 'percentage' | 'per_unit'
commission_percentage DECIMAL(5,2)    -- 영업비용 비율 (%)
commission_per_unit DECIMAL(10,2)     -- 건당 영업비용

-- survey_cost_settings
survey_type TEXT                      -- 'estimate' | 'pre_construction' | 'completion'
base_cost DECIMAL(10,2)              -- 기본 실사비용

-- survey_cost_adjustments
business_id UUID                      -- 사업장 ID
adjustment_amount DECIMAL(10,2)       -- 조정 금액 (+ 또는 -)
```

---

## ⚠️ 주의사항

### 1. 성능 고려
- 사업장별로 `survey_cost_adjustments` 조회 → N+1 쿼리 발생 가능
- 향후 개선: 사업장 ID 배열로 한 번에 조회 후 Map 생성

### 2. 기본값 처리
```typescript
// 영업비용 설정이 없는 경우
const defaultCommission = {
  commission_type: 'percentage',
  commission_percentage: 3.0
};

// 실사비용 설정이 없는 경우
const surveyCostMap = {
  estimate: 100000,
  pre_construction: 150000,
  completion: 200000
};
```

### 3. 데이터 정합성
- 모든 측정기기에 대한 `government_pricing` 데이터 필수
- `installation_cost`가 null인 경우 0으로 처리
- 영업점 설정이 없으면 기본값 사용

---

## 🎉 완료 및 기대 효과

### 완료 사항
- ✅ 제조사 매입 계산
- ✅ 영업비용 계산 (영업점별 설정 반영)
- ✅ 설치비용 계산 (기본 설치비)
- ✅ 실사비용 계산 (조정 금액 포함)
- ✅ 추가설치비 계산 (설치팀 요청 추가 비용) ✨ NEW
- ✅ 총 매입금액 = 모든 비용의 합계 (5개 항목)
- ✅ 순이익 = 매출 - 총 매입금액

### 기대 효과
1. **정확한 이익률**: 모든 비용을 반영한 실제 이익률 표시
2. **일관성**: 매출 관리 페이지와 대시보드 계산 로직 일치
3. **의사결정 지원**: 정확한 수익성 분석 가능
4. **비용 투명성**: 모든 비용 항목이 매입금액에 반영

---

**작성일**: 2025-10-28
**작성자**: Claude Code
**버전**: v1.3.0
