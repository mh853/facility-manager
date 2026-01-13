# 매출 모달 설치비 표시 문제 분석 보고서

## 📊 문제 요약

**현상**: admin/revenue 페이지에서 사업장 클릭 시 매출 상세 모달의 설치비가 ₩0으로 표시됨

**원인**: admin/revenue 페이지는 **DB 저장된 계산 결과**를 사용하지만, admin/business 페이지는 **실시간 API 계산**을 사용하는 구조적 차이

## 🔍 상세 분석

### 1. admin/business 페이지 (정상 동작)

**데이터 흐름**:
```
사용자 클릭 → BusinessRevenueModal 열림 → /api/revenue/calculate 호출 (실시간)
→ 최신 설치비 계산 → 모달에 표시 ✅
```

**코드 위치**: `app/admin/business/page.tsx`
- 모달에 전달되는 데이터: 원본 business 객체
- 모달 내부에서 `/api/revenue/calculate` API를 실시간으로 호출
- 최신 가격, 설치비 데이터로 즉시 계산

### 2. admin/revenue 페이지 (문제 발생)

**데이터 흐름**:
```
페이지 로드 → revenue_calculations 테이블 조회 (DB 저장값)
→ 사용자 클릭 → BusinessRevenueModal 열림 → 저장된 계산 결과 사용
→ 과거 계산값 표시 (설치비 = 0) ❌
```

**코드 위치**: `app/admin/revenue/page.tsx:814-837`

```typescript
// 🔧 DB 계산 결과 직접 조회 (calculations 배열에서 business_id 매칭)
const dbCalc = calculations.find(calc => calc.business_id === business.id);

const calculatedData = dbCalc ? {
  total_revenue: dbCalc.total_revenue || 0,
  total_cost: dbCalc.total_cost || 0,
  gross_profit: dbCalc.gross_profit || 0,
  net_profit: dbCalc.net_profit || 0,
  installation_costs: dbCalc.installation_costs || 0,  // ⚠️ DB 저장값 사용
  additional_installation_cost: dbCalc.installation_extra_cost || 0,
  sales_commission: dbCalc.sales_commission || 0,
  survey_costs: dbCalc.survey_costs || 0,
  has_calculation: true
} : {
  // 계산 결과 없을 때 기본값 (모두 0)
  total_revenue: 0,
  total_cost: 0,
  gross_profit: 0,
  net_profit: 0,
  installation_costs: 0,  // ⚠️ 0으로 초기화
  // ...
};
```

**문제점**:
1. DB에 저장된 계산 결과가 **게이트웨이 설치비 fallback 로직 적용 전**에 저장됨
2. 저장 당시 `gateway_1_2`, `gateway_3_4`에 대한 설치비가 0이었음
3. 모달이 이 저장된 0 값을 그대로 표시

### 3. BusinessRevenueModal 동작 방식

**코드 위치**: `components/business/BusinessRevenueModal.tsx:54-83`

```typescript
const fetchLatestCalculation = async () => {
  const response = await fetch('/api/revenue/calculate', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      business_id: business.id,
      save_result: false  // ⚠️ admin/revenue에서는 저장된 값 사용
    })
  });

  const data = await response.json();
  if (data.success && data.data && data.data.calculation) {
    setCalculatedData(data.data.calculation);  // 계산 결과 사용
  }
};
```

**모달 초기화 로직** (lines 85-116):
```typescript
useEffect(() => {
  if (isOpen && business) {
    // ⚠️ admin/revenue: business 객체에 이미 계산 결과 포함됨
    if (business.total_revenue !== undefined) {
      // DB 저장된 값을 그대로 사용 (실시간 계산 안 함)
      setCalculatedData({
        total_revenue: business.total_revenue || 0,
        installation_costs: business.installation_costs || 0,  // ⚠️ 0
        // ...
      });
    } else {
      // ⚠️ admin/business: 실시간 계산 수행
      fetchLatestCalculation();
    }
  }
}, [isOpen, business]);
```

## 🎯 근본 원인

### Timeline of Events

1. **과거 시점**: revenue_calculations 테이블에 계산 결과 저장
   - 당시 `installationCostMap['gateway_1_2']` = undefined
   - 당시 `installationCostMap['gateway_3_4']` = undefined
   - 저장된 `installation_costs` = 0

2. **현재**: 게이트웨이 fallback 로직 추가 (commit 4abf442 이전)
   - `/api/revenue/calculate`에 fallback 로직 추가
   - `gateway_1_2`, `gateway_3_4` → `gateway` 기본설치비 사용

3. **문제**: admin/revenue는 과거 저장값 사용
   - DB에 저장된 0 값을 계속 표시
   - 새로운 fallback 로직 적용 안 됨

## ✅ 해결 방안

### Option 1: 저장된 계산 결과 재생성 (권장)

**방법**: 모든 사업장에 대해 최신 로직으로 재계산 후 DB 업데이트

**장점**:
- 모든 사업장의 매출 데이터가 최신 로직 반영
- 이력 관리 및 통계 정확성 확보
- admin/revenue 페이지 성능 유지 (DB 조회만)

**단점**:
- 한 번의 대량 업데이트 작업 필요

**구현**:
```typescript
// scripts/recalculate-all-revenue.ts
// 모든 사업장에 대해 /api/revenue/calculate 호출 (save_result: true)
```

### Option 2: admin/revenue도 실시간 계산으로 변경

**방법**: 모달 열 때 항상 `/api/revenue/calculate` 실시간 호출

**장점**:
- 항상 최신 로직 적용
- DB 업데이트 불필요

**단점**:
- 매출 페이지 로딩 속도 저하 (각 사업장마다 API 호출)
- 과거 시점 계산 결과 추적 불가
- 페이지 초기 로딩 시 계산 안 됨 (모달 열어야 계산)

### Option 3: Hybrid 방식 (최적)

**방법**:
1. DB 저장값을 우선 표시 (빠른 초기 로딩)
2. 모달 열릴 때 실시간 재계산 수행
3. 사용자에게 "재계산" 버튼 제공

**장점**:
- 빠른 초기 로딩
- 필요 시 최신 계산 가능
- 사용자 선택권 제공

**단점**:
- 구현 복잡도 증가
- UI/UX 설계 필요

## 🔧 즉시 적용 가능한 임시 조치

### 방안 A: 모달에서 항상 실시간 계산

**수정 파일**: `components/business/BusinessRevenueModal.tsx`

**변경 내용**:
```typescript
useEffect(() => {
  if (isOpen && business) {
    // ⚠️ 기존: DB 값 있으면 그대로 사용
    // ✅ 수정: 항상 실시간 계산
    fetchLatestCalculation();
  }
}, [isOpen, business]);
```

**영향**:
- ✅ 설치비 즉시 표시됨
- ⚠️ 모달 열 때마다 API 호출 (약간의 딜레이)

### 방안 B: DB 계산 결과 일괄 재생성

**스크립트**: `scripts/recalculate-all-revenue.ts`

**실행**:
```bash
npx tsx scripts/recalculate-all-revenue.ts
```

**영향**:
- ✅ 모든 사업장 최신 데이터로 업데이트
- ✅ admin/revenue 페이지 성능 유지
- ⚠️ 한 번의 작업 필요

## 📌 추가 발견 사항

### 콘솔 로그 디버깅 예상 결과

추가한 디버깅 로그 (`🔧 [설치비 디버깅]`)는 **admin/business 페이지**에서만 출력될 것입니다.

**이유**:
- admin/revenue 페이지: DB 저장값 사용 → API 호출 안 함 → 로그 없음
- admin/business 페이지: 실시간 계산 → API 호출 → 로그 출력

### 확인 방법

1. **admin/business 페이지** → 매출상세보기 클릭 → 콘솔에 `🔧 [설치비` 로그 출력 ✅
2. **admin/revenue 페이지** → 사업장 클릭 → 콘솔에 로그 없음 ❌

## 🎯 권장 조치

**즉시 조치** (임시):
- BusinessRevenueModal에서 항상 실시간 계산하도록 수정

**장기 조치**:
- 매출 재계산 스크립트 작성 및 실행
- 정기적 재계산 스케줄링 (월 1회 등)

## 📝 결론

문제는 **동일한 API를 사용하지 않는 것**이 아니라, **API 호출 시점과 데이터 소스**의 차이입니다:

- **admin/business**: 모달 열 때 API 호출 (실시간)
- **admin/revenue**: 페이지 로드 시 DB 조회 (저장값)

따라서 사용자의 가정 ("동일한 api를 사용하는데 동일한 모달이 아니라")은 부분적으로 맞습니다.
같은 모달 컴포넌트를 사용하지만, **전달받는 데이터의 출처와 시점이 다릅니다**.
