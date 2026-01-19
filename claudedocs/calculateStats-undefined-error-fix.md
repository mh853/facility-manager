# calculateStats 미정의 오류 해결 보고서

## 📋 문제 분석

**오류 메시지**: `calculateStats is not defined`

**Stack Trace**:
```
ReferenceError: calculateStats is not defined
    at eval (webpack-internal:///(app-pages-browser)/./app/admin/revenue/page.tsx:186:9)
```

### 근본 원인

**이전 코드의 잔재가 남아있음**

실시간 계산 시스템으로 전환하면서 **이전 필터링 로직**이 삭제되지 않고 남아있었습니다.

#### 문제 상황:

**Before (실시간 계산 전)**:
```typescript
// 이전 시스템: DB 조회 기반
useEffect(() => {
  // 1. calculations 배열 필터링
  const filteredCalculations = calculations.filter(...)

  // 2. calculateStats() 함수 호출
  calculateStats(uniqueFilteredCalculations); // ← 함수 존재
}, [businesses, calculations, ...]);

// calculateStats 함수 정의
const calculateStats = (calculations) => {
  // 통계 계산 로직
};
```

**After (실시간 계산 전환 후)**:
```typescript
// 새로운 시스템: filteredBusinesses 기반
const filteredBusinesses = useMemo(() => {
  // 실시간 계산 로직
}, [dependencies]);

// calculateStats를 useEffect로 변경
useEffect(() => {
  // filteredBusinesses 기반 통계 계산
}, [filteredBusinesses]);

// ❌ 문제: 이전 useEffect가 남아있음
useEffect(() => {
  const filteredCalculations = calculations.filter(...)
  calculateStats(uniqueFilteredCalculations); // ← 함수가 존재하지 않음!
}, [businesses, calculations, ...]);
```

**결과**: `calculateStats` 함수가 **삭제되었는데** 호출하는 코드(Line 142-223)는 남아있어서 오류 발생

---

## ✅ 해결 방법

### 해결책: 이전 필터링 로직 완전 삭제

**삭제한 코드 (Line 142-223)**:
```typescript
// ❌ 삭제: 이전 시스템의 필터링 및 통계 계산 로직
useEffect(() => {
  if (!businesses.length || !calculations.length) return;

  // 필터링된 사업장 계산
  const filtered = businesses.filter(business => {
    const searchMatch = !searchTerm || ...;
    const officeMatch = selectedOffices.length === 0 || ...;
    const regionMatch = selectedRegions.length === 0 || ...;
    const categoryMatch = selectedCategories.length === 0 || ...;
    const yearMatch = selectedProjectYears.length === 0 || ...;

    let monthMatch = true;
    if (selectedMonths.length > 0) {
      const installDate = business.installation_date;
      if (installDate) {
        const date = new Date(installDate);
        const month = String(date.getMonth() + 1);
        monthMatch = selectedMonths.includes(month);
      } else {
        monthMatch = false;
      }
    }

    return searchMatch && officeMatch && regionMatch && categoryMatch && yearMatch && monthMatch;
  });

  // 필터링된 사업장 중 매출 계산이 있는 것만 추출
  const filteredCalculations = calculations.filter(calc => {
    const business = businesses.find(b => b.id === calc.business_id);
    if (!business) return false;

    const searchMatch = !searchTerm || ...;
    const officeMatch = selectedOffices.length === 0 || ...;
    const regionMatch = selectedRegions.length === 0 || ...;
    const categoryMatch = selectedCategories.length === 0 || ...;
    const yearMatch = selectedProjectYears.length === 0 || ...;

    let monthMatch = true;
    if (selectedMonths.length > 0) {
      const installDate = business.installation_date;
      if (installDate) {
        const date = new Date(installDate);
        const month = String(date.getMonth() + 1);
        monthMatch = selectedMonths.includes(month);
      } else {
        monthMatch = false;
      }
    }

    return searchMatch && officeMatch && regionMatch && categoryMatch && yearMatch && monthMatch;
  });

  // 중복 제거
  const latestCalcsMap = new Map();
  filteredCalculations.forEach(calc => {
    const existing = latestCalcsMap.get(calc.business_id);
    if (!existing ||
        calc.calculation_date > existing.calculation_date ||
        (calc.calculation_date === existing.calculation_date && calc.created_at > existing.created_at)) {
      latestCalcsMap.set(calc.business_id, calc);
    }
  });

  const uniqueFilteredCalculations = Array.from(latestCalcsMap.values());

  // ❌ 존재하지 않는 함수 호출
  calculateStats(uniqueFilteredCalculations);
}, [businesses, calculations, searchTerm, selectedOffices, selectedRegions, selectedCategories, selectedProjectYears, selectedMonths]);
```

**최종 코드 (정리 후)**:
```typescript
useEffect(() => {
  // 가격 데이터가 로드되면 사업장 데이터 로드
  if (pricesLoaded) {
    loadBusinesses();
    loadCalculations();
  }
}, [pricesLoaded]);

// ✅ 이전 useEffect 완전 삭제

const getAuthHeaders = () => {
  const token = TokenManager.getToken();
  return {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  };
};
```

---

## 🔧 적용한 수정 사항

### 파일: `/app/admin/revenue/page.tsx`

**1️⃣ Line 142-223 삭제**:
- 이전 시스템의 `calculations` 배열 필터링 로직
- `calculateStats()` 함수 호출 (존재하지 않음)
- 중복된 필터링 로직

**2️⃣ 남아있는 시스템**:
- ✅ Line 809-923: `filteredBusinesses` 실시간 계산 (useMemo)
- ✅ Line 925-957: `useEffect` 기반 통계 계산

---

## 📊 코드 정리 전후 비교

### Before (오류 발생)
```
Line 134-140: useEffect - 가격 데이터 로드 후 사업장/계산 로드
Line 142-223: useEffect - ❌ 이전 필터링 + calculateStats() 호출 (오류)
...
Line 809-923: useMemo - filteredBusinesses 실시간 계산
Line 925-957: useEffect - 통계 계산 (새 시스템)
```

**문제**: Line 142-223의 `calculateStats()` 호출이 정의되지 않은 함수를 참조

### After (정상 작동)
```
Line 134-140: useEffect - 가격 데이터 로드 후 사업장/계산 로드
Line 142: getAuthHeaders 함수 시작 (이전 코드 삭제됨)
...
Line 809-923: useMemo - filteredBusinesses 실시간 계산
Line 925-957: useEffect - 통계 계산
```

**해결**: 중복 로직 제거, 실시간 계산 시스템만 유지

---

## ✅ 테스트 결과

### 기능 검증
- ✅ Admin/Revenue 페이지 정상 로드
- ✅ 실시간 계산 정상 작동
- ✅ 통계 자동 업데이트 정상 작동
- ✅ 필터 변경 시 재계산 정상 작동
- ✅ `calculateStats is not defined` 오류 해결

### TypeScript 검증
```bash
npx tsc --noEmit --skipLibCheck
```

**결과**: `/app/admin/revenue/page.tsx`에는 타입 오류 없음
(다른 파일의 기존 타입 오류는 이 수정과 무관)

---

## 🎯 핵심 포인트

### 코드 마이그레이션 주의사항

1. **이전 코드 완전 제거**: 새 시스템으로 전환 시 이전 코드를 모두 제거해야 함
2. **함수 호출 검색**: 삭제한 함수를 호출하는 코드가 남아있는지 확인
3. **중복 로직 제거**: 같은 기능을 수행하는 코드가 여러 곳에 있으면 제거

### 디버깅 팁
```
ReferenceError: X is not defined
→ 함수 X가 삭제되었는데 호출하는 코드가 남아있음
→ Grep으로 X를 검색해서 모든 호출 위치 확인
→ 필요 없는 호출 제거
```

---

## 📝 변경 파일 목록

### 수정
1. **[`/app/admin/revenue/page.tsx`](../app/admin/revenue/page.tsx)**
   - Line 142-223: 이전 필터링 및 통계 계산 로직 **삭제**

---

## 🚀 시스템 아키텍처 (최종)

### 데이터 흐름
```
1. 가격 데이터 로드 (Line 134-140)
   ↓
2. 사업장 데이터 로드
   ↓
3. filteredBusinesses 실시간 계산 (Line 809-923)
   - 필터링
   - 실시간 매출/매입/이익 계산
   ↓
4. useEffect 통계 계산 (Line 925-957)
   - filteredBusinesses 기반 통계 집계
   - 총 매출, 총 이익, 평균 마진 계산
```

### 제거된 시스템
```
❌ calculations 배열 기반 필터링 (Line 142-223)
❌ calculateStats() 함수 호출
❌ DB 조회 결과(revenue_calculations) 의존성
```

---

## 📚 참고 자료

### 관련 이슈
1. [filteredBusinesses 초기화 오류](./filteredBusinesses-initialization-error-fix.md) - 첫 번째 오류 해결
2. [제조사 이름 매칭 문제](./manufacturer-matching-fix.md) - 매출/매입 차이 해결
3. [실시간 계산 구현](./realtime-calculation-implementation-summary.md) - 전체 시스템 구현 보고서

### 관련 파일
1. [`/app/admin/revenue/page.tsx`](../app/admin/revenue/page.tsx) - Admin/Revenue 페이지
2. [`/lib/revenue-calculator.ts`](../lib/revenue-calculator.ts) - 실시간 계산 유틸리티

---

**작성자**: Claude Code Troubleshooting Agent
**날짜**: 2026-01-15
**버전**: 1.0
**상태**: ✅ 해결 완료 및 테스트 통과
