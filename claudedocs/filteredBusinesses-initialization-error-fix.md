# filteredBusinesses 초기화 오류 해결 보고서

## 📋 문제 분석

**오류 메시지**: `Cannot access 'filteredBusinesses' before initialization`

**Stack Trace**:
```
ReferenceError: Cannot access 'filteredBusinesses' before initialization
    at RevenueDashboard (webpack-internal:///(app-pages-browser)/./app/admin/revenue/page.tsx:589:9)
```

### 근본 원인

**React의 Temporal Dead Zone (TDZ) 위반**

JavaScript/React에서는 변수를 **선언하기 전에** 사용할 수 없습니다.

#### 문제 상황:
```typescript
// ❌ 잘못된 코드 순서

// Line 603-635: filteredBusinesses를 사용하는 useEffect (선언 전 사용)
useEffect(() => {
  if (!filteredBusinesses.length) {  // ← 오류 발생 지점
    setStats(null);
    return;
  }
  // ...
}, [filteredBusinesses]);

// ... (200줄 이상 떨어진 위치)

// Line 809-923: filteredBusinesses 선언
const filteredBusinesses = useMemo(() => {
  // 실시간 계산 로직
}, [dependencies]);
```

**React 컴포넌트 실행 순서**:
1. React가 컴포넌트 함수를 실행
2. Line 605에서 `filteredBusinesses` 참조 시도
3. **아직 Line 809에 도달하지 않음** → 변수가 선언되지 않음
4. ❌ ReferenceError 발생

---

## ✅ 해결 방법

### 해결책: useEffect를 filteredBusinesses 선언 이후로 이동

**Before (문제 코드)**:
```typescript
// Line 603: useEffect가 선언보다 먼저
useEffect(() => {
  if (!filteredBusinesses.length) { // ❌ 아직 선언되지 않음
    // ...
  }
}, [filteredBusinesses]);

// ... (200줄 이상의 다른 코드)

// Line 809: filteredBusinesses 선언
const filteredBusinesses = useMemo(() => {
  // ...
}, [dependencies]);
```

**After (수정 코드)**:
```typescript
// Line 809-923: filteredBusinesses 선언
const filteredBusinesses = useMemo(() => {
  // 실시간 계산 로직
}, [
  businesses,
  pricesLoaded,
  costSettingsLoaded,
  officialPrices,
  manufacturerPrices,
  salesOfficeSettings,
  surveyCostSettings,
  baseInstallationCosts,
  searchTerm,
  selectedOffices,
  selectedRegions,
  selectedCategories,
  selectedProjectYears,
  selectedMonths,
  revenueFilter,
  showReceivablesOnly,
  showUninstalledOnly
]);

// Line 925-957: useEffect를 선언 이후로 이동 ✅
useEffect(() => {
  if (!filteredBusinesses.length) { // ✅ 이제 정상 작동
    setStats(null);
    return;
  }

  const totalRevenue = filteredBusinesses.reduce((sum, biz) => sum + biz.total_revenue, 0);
  const totalProfit = filteredBusinesses.reduce((sum, biz) => sum + biz.net_profit, 0);
  const avgMargin = totalRevenue > 0 ? ((totalProfit / totalRevenue) * 100).toFixed(1) : '0';

  // 영업점별 수익 계산
  const officeStats = filteredBusinesses.reduce((acc, biz) => {
    const office = biz.sales_office || '기본';
    if (!acc[office]) {
      acc[office] = { revenue: 0, profit: 0 };
    }
    acc[office].revenue += biz.total_revenue;
    acc[office].profit += biz.net_profit;
    return acc;
  }, {} as Record<string, {revenue: number, profit: number}>);

  const topOffice = Object.entries(officeStats)
    .sort(([,a], [,b]) => b.profit - a.profit)[0]?.[0] || '';

  setStats({
    total_businesses: filteredBusinesses.length,
    total_revenue: totalRevenue,
    total_profit: totalProfit,
    average_margin: avgMargin + '%',
    top_performing_office: topOffice
  });
}, [filteredBusinesses]);
```

---

## 🔧 적용한 수정 사항

### 파일: `/app/admin/revenue/page.tsx`

**1️⃣ Line 603-635 삭제**:
- `useEffect` 블록을 기존 위치에서 제거

**2️⃣ Line 925-957 추가**:
- `filteredBusinesses` 선언(Line 809-923) 직후에 `useEffect` 추가
- 동일한 로직, 순서만 변경

**변경 전후 비교**:

| 구분 | Before | After |
|------|--------|-------|
| useEffect 위치 | Line 603-635 | Line 925-957 |
| filteredBusinesses 선언 | Line 809-923 | Line 809-923 (동일) |
| 실행 순서 | ❌ useEffect → 선언 | ✅ 선언 → useEffect |

---

## ✅ 테스트 결과

### 빌드 테스트
```bash
npm run build
```

**결과**: ✅ 컴파일 성공

```
✓ Compiled successfully
  Skipping validation of types
  Skipping linting
  Collecting page data ...
✓ Generating static pages (77/77)
  Finalizing page optimization ...
```

### 기능 검증
- ✅ Admin/Revenue 페이지 정상 로드
- ✅ 실시간 계산 정상 작동
- ✅ 통계 자동 업데이트 정상 작동
- ✅ 필터 변경 시 재계산 정상 작동

---

## 📊 영향 범위

### 변경된 기능
- **Admin/Revenue 페이지 통계 계산**: `filteredBusinesses` 기반 통계 계산이 정상 작동

### 영향 없는 기능
- ✅ 실시간 매출 계산 로직 (변경 없음)
- ✅ 필터링 로직 (변경 없음)
- ✅ 정렬 및 페이지네이션 (변경 없음)
- ✅ 다른 페이지 (Admin 대시보드, 사업장 관리 등)

---

## 🎯 핵심 포인트

### React 변수 선언 규칙
1. **선언 → 사용 순서 준수**: 변수는 항상 사용하기 전에 선언되어야 함
2. **useMemo/useState/useEffect 순서**: Hook은 실행 순서가 중요
3. **Temporal Dead Zone**: 선언 전 참조 시 ReferenceError 발생

### 디버깅 팁
```
ReferenceError: Cannot access 'X' before initialization
→ 변수 X가 선언되기 전에 사용되고 있음
→ 변수 선언 위치를 찾아서 사용 위치보다 위로 이동
```

---

## 📝 변경 파일 목록

### 수정
1. **[`/app/admin/revenue/page.tsx`](../app/admin/revenue/page.tsx)**
   - Line 603-635: `useEffect` 삭제
   - Line 925-957: `useEffect` 추가 (filteredBusinesses 선언 이후)

---

## 🚀 추가 개선 사항 (없음)

이 수정은 **코드 순서 변경만** 수행했으며, 로직 변경은 없습니다.

---

## 📚 참고 자료

### 관련 이슈
- [React Temporal Dead Zone](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Statements/let#temporal_dead_zone_tdz)
- [JavaScript Variable Hoisting](https://developer.mozilla.org/en-US/docs/Glossary/Hoisting)

### 관련 파일
1. [`/app/admin/revenue/page.tsx`](../app/admin/revenue/page.tsx) - Admin/Revenue 페이지
2. [`/lib/revenue-calculator.ts`](../lib/revenue-calculator.ts) - 실시간 계산 유틸리티
3. [`claudedocs/realtime-calculation-implementation-summary.md`](realtime-calculation-implementation-summary.md) - 실시간 계산 구현 보고서

---

**작성자**: Claude Code Troubleshooting Agent
**날짜**: 2026-01-15
**버전**: 1.0
**상태**: ✅ 해결 완료 및 테스트 통과
