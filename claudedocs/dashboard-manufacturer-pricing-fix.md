# 대시보드 제조사 매입 가격 조회 수정

## 🐛 문제 상황

**증상**: 대시보드 API 응답에서 매입금액(cost)이 0으로 표시됨

```json
{
  "month": "2025-10",
  "revenue": 35890000,
  "cost": 0,  // ❌ 매입금액이 0
  "profit": 29250500
}
```

**원인**: `government_pricing` 테이블에 `manufacturer_price` 컬럼이 없음. 제조사별 원가는 별도의 `manufacturer_pricing` 테이블에 저장되어 있음.

---

## 🔍 문제 분석

### 잘못된 접근 (Before)

대시보드 API가 `government_pricing` 테이블에서 제조사 가격을 조회하려고 시도:

```typescript
// ❌ government_pricing 테이블에 manufacturer_price 컬럼 없음
const priceInfo = priceMap[field];
manufacturerCost += priceInfo.manufacturer_price * quantity;  // undefined × quantity = 0
```

### 데이터베이스 구조

#### 1. `government_pricing` 테이블
환경부 고시가와 설치비 정보만 저장:
```sql
equipment_type    TEXT      -- 측정기기 종류
official_price    DECIMAL   -- 환경부 고시가 ✅
installation_cost DECIMAL   -- 기본 설치비 ✅
effective_from    DATE
is_active         BOOLEAN
```

#### 2. `manufacturer_pricing` 테이블
제조사별 원가 정보 저장:
```sql
equipment_type    TEXT      -- 측정기기 종류
manufacturer      TEXT      -- 제조사 (ecosense, cleanearth, gaia_cns, evs)
cost_price        DECIMAL   -- 제조사 원가 (매입금액) ✅
effective_from    DATE
effective_to      DATE
is_active         BOOLEAN
```

### 매출 관리의 올바른 접근

매출 관리 페이지는 별도의 API를 통해 제조사별 원가를 조회:

```typescript
// ✅ 별도 API 호출
const manuResponse = await fetch('/api/revenue/manufacturer-pricing');
const manuData = await manuResponse.json();

// 제조사별로 원가 맵 생성
const manuPrices: Record<string, Record<string, number>> = {};
manuData.data.pricing.forEach((item: any) => {
  if (!manuPrices[item.manufacturer]) {
    manuPrices[item.manufacturer] = {};
  }
  manuPrices[item.manufacturer][item.equipment_type] = item.cost_price;
});

// 사업장의 제조사에 맞는 원가 사용
const businessManufacturer = business.manufacturer || 'ecosense';
const costPrice = manuPrices[businessManufacturer][equipment_type];
```

---

## ✅ 해결 방법

### 1. manufacturer_pricing 테이블 조회 추가

```typescript
// 2-1. 제조사별 원가 정보 조회
const { data: manufacturerPricingData, error: manuPricingError } = await supabase
  .from('manufacturer_pricing')
  .select('*')
  .eq('is_active', true)
  .lte('effective_from', calcDate)
  .or(`effective_to.is.null,effective_to.gte.${calcDate}`);

if (manuPricingError) {
  console.error('❌ [Dashboard Revenue API] Manufacturer pricing query error:', manuPricingError);
}

// 제조사별 원가 맵 생성 (제조사별로 구분)
const manufacturerCostMap: Record<string, Record<string, number>> = {};
manufacturerPricingData?.forEach(item => {
  if (!manufacturerCostMap[item.manufacturer]) {
    manufacturerCostMap[item.manufacturer] = {};
  }
  manufacturerCostMap[item.manufacturer][item.equipment_type] = item.cost_price;
});

console.log('📊 [Dashboard Revenue API] Manufacturer pricing loaded:', Object.keys(manufacturerCostMap).length, 'manufacturers');
```

### 2. 사업장별 제조사 원가 사용

```typescript
// 사업장의 제조사 정보 (기본값: ecosense)
const businessManufacturer = business.manufacturer || 'ecosense';
const manufacturerCosts = manufacturerCostMap[businessManufacturer] || {};

// 매출/제조사 매입 계산
equipmentFields.forEach(field => {
  const quantity = business[field] || 0;
  const priceInfo = priceMap[field];

  if (quantity > 0 && priceInfo) {
    // 매출 = 환경부 고시가 × 수량
    businessRevenue += priceInfo.official_price * quantity;

    // 매입 = 제조사별 원가 × 수량 (manufacturer_pricing 테이블)
    const costPrice = manufacturerCosts[field] || 0;
    manufacturerCost += costPrice * quantity;

    // 기본 설치비
    totalInstallationCosts += (priceInfo.installation_cost || 0) * quantity;
    totalEquipmentCount += quantity;
  }
});
```

---

## 📊 수정 전후 비교

### Before (매입금액 0)

```json
{
  "month": "2025-10",
  "revenue": 35890000,
  "cost": 0,  // ❌ 제조사 원가를 못 가져옴
  "profit": 29250500,
  "profitRate": 81.5
}
```

**문제**: `government_pricing.manufacturer_price`가 없어서 0으로 계산됨

### After (정확한 매입금액)

```json
{
  "month": "2025-10",
  "revenue": 35890000,
  "cost": 8391600,  // ✅ manufacturer_pricing 테이블에서 가져옴
  "profit": 20858900,
  "profitRate": 58.12
}
```

**결과**: 제조사별 원가를 정확히 조회하여 매입금액 표시

---

## 🔄 데이터 흐름

### 전체 과정

```
1. government_pricing 조회
   └─ equipment_type별 official_price, installation_cost

2. manufacturer_pricing 조회 ✨ NEW
   └─ manufacturer × equipment_type별 cost_price

3. 사업장별 계산
   ├─ manufacturer 컬럼 확인 (기본값: ecosense)
   ├─ 해당 제조사의 원가 맵 선택
   └─ 각 기기별 계산:
       ├─ 매출 += official_price × quantity
       ├─ 매입 += cost_price × quantity  ✨ NEW
       └─ 설치비 += installation_cost × quantity

4. 월별 집계
   ├─ revenue: 매출 합계
   ├─ cost: 매입 합계 (제조사 원가)
   └─ profit: 순이익 (모든 비용 차감)
```

### 데이터 소스 정리

| 항목 | 데이터 소스 | 테이블 | 컬럼 |
|-----|-----------|--------|------|
| 매출 | 환경부 고시가 | `government_pricing` | `official_price` |
| **매입** | **제조사별 원가** | **`manufacturer_pricing`** | **`cost_price`** ✨ |
| 기본설치비 | 환경부 고시가 | `government_pricing` | `installation_cost` |
| 영업비용 | 영업점 설정 | `sales_office_cost_settings` | `commission_percentage` |
| 실사비용 | 실사비용 설정 | `survey_cost_settings` | `base_cost` |

---

## 🎯 제조사 구분

### 지원하는 제조사

시스템에서 관리하는 제조사 목록:

1. **ecosense** (에코센스) - 기본값
2. **cleanearth** (클린어스)
3. **gaia_cns** (가이아CNS)
4. **evs** (EVS)

### 제조사별 원가 예시

**pH미터 (ph_meter)** 원가:

```typescript
{
  ecosense: 50000,     // 에코센스 원가
  cleanearth: 52000,   // 클린어스 원가
  gaia_cns: 48000,     // 가이아CNS 원가
  evs: 51000           // EVS 원가
}
```

**사업장 A** (제조사: ecosense):
- pH미터 10개 × 50,000원 = 500,000원 (매입)

**사업장 B** (제조사: cleanearth):
- pH미터 10개 × 52,000원 = 520,000원 (매입)

---

## 🧪 테스트 결과

### API 응답 확인

```bash
curl http://localhost:3001/api/dashboard/revenue?months=1
```

**결과**:
```json
{
  "success": true,
  "data": [
    {
      "month": "2025-10",
      "revenue": 35890000,
      "cost": 8391600,       // ✅ 매입금액 정상 표시
      "profit": 20858900,
      "profitRate": 58.12,
      "count": 9
    }
  ],
  "summary": {
    "avgProfit": 20858900,
    "avgProfitRate": 58.12,
    "totalRevenue": 35890000,
    "totalProfit": 20858900
  }
}
```

### 전체 월 데이터 확인

```bash
curl 'http://localhost:3001/api/dashboard/revenue?months=12'
```

**모든 월에서 cost 값이 정상 표시**:
- 2024-11: cost = 44,040,000원 ✅
- 2024-12: cost = 65,400,000원 ✅
- 2025-01: cost = 120,587,200원 ✅
- 2025-02: cost = 142,934,200원 ✅
- ...

---

## 📝 주요 변경 사항

### 파일: `app/api/dashboard/revenue/route.ts`

#### 변경 1: manufacturer_pricing 테이블 조회 추가 (Line 63-84)

**Before**:
```typescript
const priceMap = pricingData?.reduce((acc, item) => {
  acc[item.equipment_type] = item;
  return acc;
}, {} as Record<string, any>) || {};

// 3. 월별 데이터 집계 맵 초기화
```

**After**:
```typescript
const priceMap = pricingData?.reduce((acc, item) => {
  acc[item.equipment_type] = item;
  return acc;
}, {} as Record<string, any>) || {};

// 2-1. 제조사별 원가 정보 조회 ✨ NEW
const { data: manufacturerPricingData, error: manuPricingError } = await supabase
  .from('manufacturer_pricing')
  .select('*')
  .eq('is_active', true)
  .lte('effective_from', calcDate)
  .or(`effective_to.is.null,effective_to.gte.${calcDate}`);

const manufacturerCostMap: Record<string, Record<string, number>> = {};
manufacturerPricingData?.forEach(item => {
  if (!manufacturerCostMap[item.manufacturer]) {
    manufacturerCostMap[item.manufacturer] = {};
  }
  manufacturerCostMap[item.manufacturer][item.equipment_type] = item.cost_price;
});

console.log('📊 [Dashboard Revenue API] Manufacturer pricing loaded:', Object.keys(manufacturerCostMap).length, 'manufacturers');

// 3. 월별 데이터 집계 맵 초기화
```

#### 변경 2: 제조사별 원가 사용 (Line 156-182)

**Before**:
```typescript
// 매출/제조사 매입 계산
let manufacturerCost = 0;

equipmentFields.forEach(field => {
  const quantity = business[field] || 0;
  const priceInfo = priceMap[field];

  if (quantity > 0 && priceInfo) {
    businessRevenue += priceInfo.official_price * quantity;
    manufacturerCost += priceInfo.manufacturer_price * quantity;  // ❌ undefined
  }
});
```

**After**:
```typescript
// 사업장의 제조사 정보 (기본값: ecosense) ✨ NEW
const businessManufacturer = business.manufacturer || 'ecosense';
const manufacturerCosts = manufacturerCostMap[businessManufacturer] || {};

// 매출/제조사 매입 계산
let manufacturerCost = 0;

equipmentFields.forEach(field => {
  const quantity = business[field] || 0;
  const priceInfo = priceMap[field];

  if (quantity > 0 && priceInfo) {
    // 매출 = 환경부 고시가 × 수량
    businessRevenue += priceInfo.official_price * quantity;

    // 매입 = 제조사별 원가 × 수량 ✨ NEW
    const costPrice = manufacturerCosts[field] || 0;
    manufacturerCost += costPrice * quantity;
  }
});
```

---

## ⚠️ 주의사항

### 1. 제조사 정보 필수

사업장 테이블(`business_info`)에 `manufacturer` 컬럼이 있어야 정확한 원가 계산이 가능합니다.

- **manufacturer 컬럼이 있는 경우**: 해당 제조사의 원가 사용
- **manufacturer 컬럼이 없는 경우**: 기본값 'ecosense' 사용

### 2. manufacturer_pricing 데이터 필수

`manufacturer_pricing` 테이블에 모든 제조사와 측정기기 조합의 원가 데이터가 있어야 합니다.

**없는 경우**:
```typescript
const costPrice = manufacturerCosts[field] || 0;  // 0으로 처리
```

### 3. 유효 기간 처리

`effective_from`과 `effective_to` 날짜를 기준으로 현재 유효한 가격만 조회합니다:

```typescript
.lte('effective_from', calcDate)  // 시작일이 계산일 이전
.or(`effective_to.is.null,effective_to.gte.${calcDate}`)  // 종료일이 없거나 계산일 이후
```

---

## 🎉 완료

**수정 완료 사항**:
- ✅ `manufacturer_pricing` 테이블 조회 추가
- ✅ 제조사별 원가 맵 생성
- ✅ 사업장의 제조사에 맞는 원가 사용
- ✅ 매입금액이 정확하게 표시됨
- ✅ 모든 월의 데이터 정상 출력

**테스트 방법**:
1. http://localhost:3001/admin 접속
2. 매출/매입/이익 현황 확인
3. 매입금액이 0이 아닌 정상 값으로 표시되는지 확인
4. http://localhost:3001/admin/revenue와 수치 비교

**다음 단계**: 매출 관리 페이지와 수치가 일치하는지 검증

---

**작성일**: 2025-10-28
**작성자**: Claude Code
**버전**: v1.4.1 (Manufacturer Pricing Fix)
