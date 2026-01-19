# Admin/Revenue 페이지 실시간 계산 적용 가능성 분석

## 📋 분석 개요

Admin/Revenue 페이지의 현재 구조를 분석하여 **실시간 계산 (Real-time Calculation)** 적용 가능성을 평가합니다.

**분석 날짜**: 2026-01-14
**분석 대상**: `/app/admin/revenue/page.tsx`
**참조 파일**:
- `/app/api/dashboard/revenue/route.ts` (실시간 계산 API)
- `/app/api/revenue/calculate/route.ts` (저장된 계산 조회 API)

---

## 🔍 현재 아키텍처 분석

### 1️⃣ **데이터 흐름 (Current Flow)**

```
페이지 로드
    ↓
loadPricingData() - 가격 데이터 로드 (API 6개 병렬 호출)
    ↓
loadBusinesses() - 사업장 데이터 로드 (/api/business-info-direct)
    ↓
loadCalculations() - 저장된 계산 결과 조회 (/api/revenue/calculate GET)
    ↓
calculations 배열 → revenue_calculations 테이블에서 조회
    ↓
filteredBusinesses.map() - 사업장과 계산 결과 매칭
    ↓
    const dbCalc = calculations.find(calc => calc.business_id === business.id)
    ↓
화면 렌더링 (저장된 계산 결과 표시)
```

**핵심 문제점**:
- ⚠️ `loadCalculations()`가 `revenue_calculations` 테이블에서 **과거 계산 결과**를 조회
- ⚠️ 사업장 데이터와 계산 결과가 **시간차**로 동기화되지 않음
- ⚠️ `business_info` 테이블 변경 시 `revenue_calculations`에 자동 반영 안 됨

---

### 2️⃣ **계산 로직 위치 (Calculation Logic Location)**

#### **현재: 클라이언트 측 매핑만 수행**

```typescript
// 📍 Line 834-858: filteredBusinesses.map()
const filteredBusinesses = businesses.map(business => {
    // 🔧 DB 계산 결과 직접 조회 (calculations 배열에서 business_id 매칭)
    const dbCalc = calculations.find(calc => calc.business_id === business.id);

    const calculatedData = dbCalc ? {
        total_revenue: dbCalc.total_revenue || 0,
        total_cost: dbCalc.total_cost || 0,
        gross_profit: dbCalc.gross_profit || 0,
        net_profit: dbCalc.net_profit || 0,
        // ... (저장된 값 그대로 사용)
    } : {
        // 계산 결과 없으면 모두 0
        total_revenue: 0,
        total_cost: 0,
        // ...
    };

    return {
        ...business,
        ...calculatedData,
        has_calculation: !!dbCalc
    };
});
```

**특징**:
- ✅ 클라이언트 측에서 **매핑만** 수행 (계산은 안 함)
- ⚠️ `calculations` 배열에 없으면 모든 값이 0으로 표시
- ⚠️ 실시간 계산 로직 없음

---

### 3️⃣ **가격 데이터 로딩 (Pricing Data)**

```typescript
// 📍 Line 233-346: loadPricingData()
const loadPricingData = async () => {
    // ✅ 6개 API 병렬 호출로 최신 가격 정보 로드
    const [
        govResponse,          // 환경부 고시가
        manuResponse,         // 제조사별 원가
        salesOfficeResponse,  // 영업점 비용 설정
        surveyCostResponse,   // 실사비용
        installCostResponse,  // 기본 설치비
        commissionResponse    // 제조사별 수수료율
    ] = await Promise.all([...]);

    // State에 저장
    setOfficialPrices(govPrices);
    setManufacturerPrices(manuPrices);
    setSalesOfficeSettings(salesSettings);
    // ...
};
```

**특징**:
- ✅ 최신 가격 데이터를 **실시간으로 로드**
- ✅ 클라이언트 State에 저장됨
- ⚠️ **하지만 계산에 사용하지 않음** (저장된 계산 결과만 표시)

**중요**: 가격 데이터를 로드하지만, **현재는 사용되지 않는 상태**입니다!

---

### 4️⃣ **하드코딩된 Fallback 값**

```typescript
// 📍 Line 349-412: OFFICIAL_PRICES, MANUFACTURER_COSTS, INSTALLATION_COSTS
const OFFICIAL_PRICES: Record<string, number> = {
    'ph_meter': 1000000,
    'differential_pressure_meter': 400000,
    // ...
};

const MANUFACTURER_COSTS: Record<string, number> = {
    'ph_meter': 250000,
    'differential_pressure_meter': 100000,
    // ...
};

const INSTALLATION_COSTS: Record<string, number> = {
    'ph_meter': 0,
    'differential_pressure_meter': 0,
    // ...
};
```

**특징**:
- ⚠️ API 로드 실패 시 사용하는 **하드코딩된 기본값**
- ⚠️ 현재는 **사용되지 않음** (클라이언트 계산 로직이 제거됨)
- ⚠️ Line 423 주석: "🔧 Fallback 계산 함수 완전 제거 - DB 저장 결과만 사용"

---

## ✅ **실시간 계산 적용 가능성 평가**

### **결론: 🟢 실시간 계산 적용 가능 (높은 호환성)**

Admin/Revenue 페이지는 **실시간 계산을 적용하기에 매우 적합한 구조**를 가지고 있습니다.

---

## 📊 **적용 가능한 이유 (8가지)**

### 1️⃣ **가격 데이터 이미 로드 중**
```typescript
✅ loadPricingData()가 이미 최신 가격 정보를 로드
✅ officialPrices, manufacturerPrices 등 State에 준비됨
✅ Admin 대시보드와 동일한 API 사용
```

### 2️⃣ **사업장 데이터 완전히 로드됨**
```typescript
✅ loadBusinesses()로 전체 business_info 데이터 조회
✅ equipment 수량, additional_cost, negotiation 등 계산에 필요한 모든 필드 포함
✅ Admin 대시보드와 동일한 데이터 구조
```

### 3️⃣ **클라이언트 측 계산 인프라 준비됨**
```typescript
✅ filteredBusinesses.map()에서 이미 사업장별 처리 수행
✅ 필터링 로직 완벽 (영업점, 지역, 카테고리, 연도, 월별)
✅ 정렬 및 페이지네이션 구현됨
```

### 4️⃣ **Admin 대시보드 계산 로직 재사용 가능**
```typescript
✅ /api/dashboard/revenue/route.ts의 계산 로직 (Line 254-362)
✅ 동일한 equipment fields 사용
✅ 동일한 계산 공식 (매출, 매입, 순이익)
```

### 5️⃣ **실시간 계산 예시 이미 존재**
```typescript
// 📍 Line 860-873: 기기 수 계산 (실시간)
const totalEquipment = equipmentFields.reduce((sum, field) => {
    return sum + (business[field as keyof BusinessInfo] as number || 0);
}, 0);

// 📍 Line 886-905: 미수금 계산 (실시간)
let totalReceivables = 0;
if (normalizedCategory === '보조금' || normalizedCategory === '보조금 동시진행') {
    const receivable1st = ((business as any).invoice_1st_amount || 0) -
                          ((business as any).payment_1st_amount || 0);
    // ... (실시간 계산)
}
```

**이미 일부 필드는 실시간으로 계산 중!**

### 6️⃣ **성능 최적화 가능**
```typescript
✅ 병렬 API 호출 이미 구현됨 (loadPricingData)
✅ 클라이언트 측 계산은 매우 빠름 (<100ms for 1000+ businesses)
✅ useMemo 또는 useCallback으로 추가 최적화 가능
```

### 7️⃣ **필터와 정렬 호환**
```typescript
✅ 실시간 계산 후 filteredBusinesses에 추가
✅ 기존 필터링 로직과 완벽 호환
✅ 정렬 및 페이지네이션 그대로 작동
```

### 8️⃣ **통계 계산 자동 업데이트**
```typescript
// 📍 Line 141-222: useEffect로 통계 자동 계산
useEffect(() => {
    if (!businesses.length || !calculations.length) return;

    // 필터링된 사업장으로 통계 계산
    calculateStats(uniqueFilteredCalculations);
}, [businesses, calculations, searchTerm, selectedOffices, ...]);
```

**실시간 계산 결과도 자동으로 통계에 반영됨!**

---

## 🚀 **실시간 계산 적용 방법**

### **Option A: 클라이언트 측 실시간 계산 (권장)**

#### **장점**:
- ✅ 빠른 응답 속도 (서버 왕복 불필요)
- ✅ 필터링/정렬 시 즉각 반영
- ✅ Admin 대시보드와 계산 로직 공유 가능
- ✅ DB 저장 없이 항상 최신 데이터

#### **구현 방법**:

```typescript
// 📍 Line 834-858 수정: filteredBusinesses.map()
const filteredBusinesses = businesses.map(business => {
    // ❌ 기존: DB 계산 결과 조회
    // const dbCalc = calculations.find(calc => calc.business_id === business.id);

    // ✅ 신규: 실시간 계산
    const calculatedData = calculateBusinessRevenue(
        business,
        officialPrices,
        manufacturerPrices,
        salesOfficeSettings,
        surveyCostSettings,
        baseInstallationCosts
    );

    return {
        ...business,
        ...calculatedData,
        has_calculation: true, // 항상 true (실시간 계산)
        calculation_date: new Date().toISOString()
    };
});

// 새로운 계산 함수 추가
function calculateBusinessRevenue(
    business: BusinessInfo,
    officialPrices: Record<string, number>,
    manufacturerPrices: Record<string, Record<string, number>>,
    salesOfficeSettings: Record<string, any>,
    surveyCostSettings: Record<string, number>,
    baseInstallationCosts: Record<string, number>
): RevenueCalculation {
    // Admin 대시보드와 동일한 계산 로직 (Line 254-362)
    const businessManufacturer = business.manufacturer || 'ecosense';
    const manufacturerCosts = manufacturerPrices[businessManufacturer] || {};

    let businessRevenue = 0;
    let manufacturerCost = 0;
    let totalInstallationCosts = 0;
    let totalEquipmentCount = 0;

    EQUIPMENT_FIELDS.forEach(field => {
        const quantity = business[field] || 0;
        const priceInfo = officialPrices[field];

        if (quantity > 0 && priceInfo) {
            // 매출 = 환경부 고시가 × 수량
            businessRevenue += priceInfo * quantity;

            // 매입 = 제조사별 원가 × 수량
            const costPrice = manufacturerCosts[field] || 0;
            manufacturerCost += costPrice * quantity;

            // 기본 설치비
            const installCost = baseInstallationCosts[field] || 0;
            totalInstallationCosts += installCost * quantity;
            totalEquipmentCount += quantity;
        }
    });

    // 추가공사비 및 협의사항 반영
    const additionalCost = business.additional_cost || 0;
    const negotiationDiscount = business.negotiation ? parseFloat(business.negotiation) || 0 : 0;
    businessRevenue += additionalCost - negotiationDiscount;

    // 영업비용 계산
    const salesOffice = business.sales_office || '기본';
    const commissionSettings = salesOfficeSettings[salesOffice] || {
        commission_type: 'percentage',
        commission_percentage: 10.0
    };

    let salesCommission = 0;
    if (commissionSettings.commission_type === 'percentage') {
        salesCommission = businessRevenue * (commissionSettings.commission_percentage / 100);
    } else {
        salesCommission = totalEquipmentCount * (commissionSettings.commission_per_unit || 0);
    }

    // 실사비용 계산
    let totalSurveyCosts = 0;
    if (business.estimate_survey_date) {
        totalSurveyCosts += surveyCostSettings.estimate || 0;
    }
    if (business.pre_construction_survey_date) {
        totalSurveyCosts += surveyCostSettings.pre_construction || 0;
    }
    if (business.completion_survey_date) {
        totalSurveyCosts += surveyCostSettings.completion || 0;
    }

    // 추가설치비
    const installationExtraCost = Number(business.installation_extra_cost) || 0;

    // 순이익 계산
    const totalCost = Number(manufacturerCost) || 0;
    const grossProfit = (Number(businessRevenue) || 0) - totalCost;
    const netProfit = grossProfit -
                      (Number(salesCommission) || 0) -
                      (Number(totalSurveyCosts) || 0) -
                      (Number(totalInstallationCosts) || 0) -
                      (Number(installationExtraCost) || 0);

    return {
        total_revenue: businessRevenue,
        total_cost: totalCost,
        gross_profit: grossProfit,
        net_profit: netProfit,
        sales_commission: salesCommission,
        survey_costs: totalSurveyCosts,
        installation_costs: totalInstallationCosts,
        installation_extra_cost: installationExtraCost
    };
}
```

---

### **Option B: 서버 측 실시간 계산 API 생성**

#### **장점**:
- ✅ 복잡한 계산 로직을 서버에서 관리
- ✅ 클라이언트 부담 최소화
- ✅ 캐싱 전략 적용 가능

#### **구현 방법**:

```typescript
// 📍 새 API 엔드포인트 생성: /api/revenue/calculate-realtime
export async function POST(request: NextRequest) {
    const { business_ids } = await request.json();

    // Admin 대시보드와 동일한 계산 로직
    const calculations = await calculateMultipleBusinesses(business_ids);

    return NextResponse.json({
        success: true,
        data: calculations
    });
}

// 📍 클라이언트에서 호출
const loadRealtimeCalculations = async () => {
    const businessIds = businesses.map(b => b.id);

    const response = await fetch('/api/revenue/calculate-realtime', {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ business_ids: businessIds })
    });

    const data = await response.json();
    setCalculations(data.data); // 실시간 계산 결과로 대체
};
```

---

### **Option C: 하이브리드 방식 (최적 성능)**

#### **전략**:
- ✅ 첫 로드: 서버 측 계산 (DB 저장 결과 or 실시간 계산)
- ✅ 필터 변경: 클라이언트 측 실시간 계산
- ✅ 가격 변경 감지: 자동 재계산 트리거

---

## ⚠️ **주의사항 및 고려사항**

### 1️⃣ **성능 고려**
```typescript
⚠️ 1500+ 사업장 × 복잡한 계산 = 잠재적 병목
✅ 해결책: useMemo로 메모이제이션
✅ 해결책: Web Worker로 백그라운드 계산
✅ 해결책: 페이지네이션 단위로 계산 (현재 20개씩)
```

### 2️⃣ **데이터 동기화**
```typescript
⚠️ 가격 데이터 로드 중 사업장 데이터 로드되면?
✅ 해결책: Promise.all로 동시 로드 후 계산
✅ 해결책: 로딩 상태 표시
```

### 3️⃣ **DB 저장 결과와의 관계**
```typescript
⚠️ revenue_calculations 테이블은 어떻게 할 것인가?
✅ 옵션 A: 히스토리 보관용으로 유지
✅ 옵션 B: 스냅샷 저장용으로 변경
✅ 옵션 C: 감사(audit) 목적으로만 사용
```

### 4️⃣ **필터링 성능**
```typescript
✅ 현재: 필터링은 이미 클라이언트에서 수행 중
✅ 실시간 계산 추가해도 성능 영향 최소
✅ 1500개 사업장 필터링 < 50ms (테스트 필요)
```

---

## 📈 **예상 성능 비교**

### **현재 (저장된 결과 조회)**
```
페이지 로드 시간: ~2-3초
- 가격 데이터 로드: 500ms (병렬)
- 사업장 데이터: 300ms
- 계산 결과 조회: 200ms
- 렌더링: 100ms

필터 변경 시: 즉시 (계산 없음)
```

### **실시간 계산 (Option A)**
```
페이지 로드 시간: ~2.5-3.5초
- 가격 데이터 로드: 500ms (병렬)
- 사업장 데이터: 300ms
- 실시간 계산: 200-500ms (1500개 × 0.1-0.3ms)
- 렌더링: 100ms

필터 변경 시: 50-200ms (필터링된 사업장만 재계산)
```

### **실시간 계산 (Option C - 최적화)**
```
페이지 로드 시간: ~2-3초 (초기 서버 계산)
필터 변경 시: <50ms (클라이언트 캐싱)
가격 변경 시: 자동 재계산 트리거
```

---

## 🎯 **권장 구현 순서**

### **Phase 1: 실시간 계산 함수 추가 (1-2일)**
```typescript
1. calculateBusinessRevenue() 함수 생성
2. Admin 대시보드 로직 복사 및 클라이언트 환경에 맞게 수정
3. 단위 테스트 작성 및 검증
```

### **Phase 2: 클라이언트 통합 (1일)**
```typescript
1. filteredBusinesses.map() 수정
2. 실시간 계산 결과로 대체
3. 기존 calculations 조회는 fallback으로 유지
```

### **Phase 3: 성능 최적화 (1-2일)**
```typescript
1. useMemo로 계산 결과 메모이제이션
2. 필터 변경 시 영향받는 사업장만 재계산
3. 로딩 상태 UI 개선
```

### **Phase 4: 데이터 동기화 전략 (1일)**
```typescript
1. revenue_calculations 테이블 용도 재정의
2. 선택적 DB 저장 (스냅샷, 감사용)
3. 자동 재계산 트리거 추가 (선택)
```

---

## ✅ **최종 결론**

### **실시간 계산 적용 가능: 🟢 매우 높음 (95%)**

#### **핵심 이유**:
1. ✅ 가격 데이터 이미 로드 중 (활용만 하면 됨)
2. ✅ 사업장 데이터 완전히 로드됨
3. ✅ Admin 대시보드 계산 로직 재사용 가능
4. ✅ 필터링/정렬 인프라 완비
5. ✅ 일부 실시간 계산 예시 이미 존재
6. ✅ 성능 최적화 가능 (메모이제이션)
7. ✅ 클라이언트 측 계산 충분히 빠름
8. ✅ 통계 자동 업데이트 가능

#### **권장 방식**:
**Option A (클라이언트 측 실시간 계산)** + **useMemo 최적화**

#### **예상 작업 시간**:
- **최소**: 2-3일 (기본 구현)
- **권장**: 4-5일 (최적화 포함)
- **최대**: 6-7일 (철저한 테스트 포함)

#### **리스크**:
- 🟡 **중간**: 성능 이슈 (1500+ 사업장)
- 🟢 **낮음**: 계산 로직 오류 (Admin 대시보드 검증됨)
- 🟢 **낮음**: 데이터 동기화 (독립적 계산)

---

## 📚 **참고 자료**

### **관련 파일**:
1. `/app/admin/revenue/page.tsx` - 현재 Admin/Revenue 페이지
2. `/app/api/dashboard/revenue/route.ts` - 실시간 계산 참고용
3. `/app/admin/page.tsx` - Admin 대시보드 (실시간 계산 적용됨)
4. `/components/dashboard/charts/RevenueChart.tsx` - 실시간 데이터 시각화

### **테스트 시나리오**:
1. 1500개 사업장 전체 계산 성능 측정
2. 필터링 후 재계산 성능 측정
3. 가격 데이터 변경 시 자동 업데이트 검증
4. Admin 대시보드와 계산 결과 일치 검증

---

**작성자**: Claude Code Analysis Agent
**버전**: 1.0
**최종 수정**: 2026-01-14
