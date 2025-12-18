# 매출관리 vs 월마감 필터 방식 차이 분석

## 문제 상황

**매출관리 (2025년 필터)**: ₩7,514,933,400 (약 75억원)
**월마감 (2025년)**: ₩6,937,253,400 (약 69억원)
**차이**: ₩577,680,000 (약 5억 7,768만원, 8.3% 차이)

## 근본 원인: 필터링 방식의 차이

### 매출관리 페이지
```typescript
// app/admin/revenue/page.tsx
// 필터링 방식: project_year (사업 연도)
const yearMatch = selectedProjectYears.length === 0 ||
                 selectedProjectYears.includes(String(business.project_year || ''));
```

**특징**:
- `business_info.project_year = 2025`인 사업장 필터링
- **설치 연도** 기준
- 매출 계산 날짜(`calculation_date`)는 고려하지 않음

### 월마감 페이지
```typescript
// app/api/admin/monthly-closing/route.ts
const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
const endDate = month === 12
  ? `${year + 1}-01-01`
  : `${year}-${String(month + 1).padStart(2, '0')}-01`;

query = query.gte('calculation_date', startDate).lt('calculation_date', endDate);
```

**특징**:
- `calculation_date`가 2025년인 매출 계산 레코드만 집계
- **매출 계산 날짜** 기준
- 사업 연도(`project_year`)는 고려하지 않음

---

## 검증 결과

### SQL 쿼리 결과

```sql
-- 1. project_year = 2025 기준 (매출관리 방식)
SELECT COUNT(DISTINCT business_id), SUM(total_revenue)
FROM business_info b
INNER JOIN revenue_calculations r ON b.id = r.business_id
WHERE b.project_year = 2025;
```

**결과**:
- 사업장 수: **1,072개**
- 총 매출: **₩6,409,253,400** (약 64억원)

```sql
-- 2. calculation_date in 2025 기준 (월마감 방식)
SELECT COUNT(DISTINCT business_id), SUM(total_revenue)
FROM revenue_calculations
WHERE calculation_date >= '2025-01-01' AND calculation_date < '2026-01-01';
```

**결과**:
- 사업장 수: **1,146개**
- 총 매출: **₩6,926,573,400** (약 69억원)

---

## 차이 분석

### 1. 사업장 수 차이

| 필터 방식 | 사업장 수 | 차이 |
|----------|---------|------|
| project_year = 2025 | 1,072개 | - |
| calculation_date in 2025 | 1,146개 | +74개 |

**74개 추가 사업장**:
- 2024년 이전에 설치(`project_year < 2025`)
- 2025년에 매출 계산됨(`calculation_date in 2025`)

### 2. 매출 차이

| 필터 방식 | 총 매출 | 차이 |
|----------|---------|------|
| project_year = 2025 | ₩6,409,253,400 | - |
| calculation_date in 2025 | ₩6,926,573,400 | +₩517,320,000 |

**추가 매출**: 약 5억 1,732만원

### 3. 매출관리 UI에서 표시되는 값

**현재 매출관리 페이지**: ₩7,514,933,400 (약 75억원)

**분석**:
- SQL 쿼리 결과(64억원)와 UI 표시(75억원) 차이: **약 11억원**
- 이는 **중복 계산 레코드**가 여전히 포함되어 있음을 의미
- 중복 제거 로직이 **프론트엔드에서만** 작동하고 있을 가능성

---

## 왜 이렇게 다른가?

### 시나리오 1: 2024년 설치, 2025년 계산

**사업장 A**:
- `project_year`: 2024
- `calculation_date`: 2025-01-15

**매출관리 (project_year)**: ❌ 제외 (2024년 사업)
**월마감 (calculation_date)**: ✅ 포함 (2025년 계산)

### 시나리오 2: 2025년 설치, 2024년 계산

**사업장 B**:
- `project_year`: 2025
- `calculation_date`: 2024-12-20

**매출관리 (project_year)**: ✅ 포함 (2025년 사업)
**월마감 (calculation_date)**: ❌ 제외 (2024년 계산)

### 시나리오 3: 2025년 설치, 2025년 계산

**사업장 C**:
- `project_year`: 2025
- `calculation_date`: 2025-06-10

**매출관리 (project_year)**: ✅ 포함
**월마감 (calculation_date)**: ✅ 포함

---

## 왜 매출관리가 75억인가?

### 가능성 1: 중복 레코드 미제거

브라우저 콘솔에서 확인:
```javascript
// 개발자 도구 > Console
fetch('/api/revenue/calculate?limit=10000')
  .then(r => r.json())
  .then(data => {
    const calcs = data.data.calculations;
    console.log('전체 레코드:', calcs.length);

    // 중복 확인
    const businessIds = calcs.map(c => c.business_id);
    const uniqueIds = [...new Set(businessIds)];
    console.log('고유 사업장:', uniqueIds.length);
    console.log('중복 레코드:', calcs.length - uniqueIds.length);
  });
```

### 가능성 2: 통계 계산 로직 문제

`calculateStats` 함수에서 중복 레코드를 포함하여 합산하고 있을 가능성:

```typescript
// app/admin/revenue/page.tsx
const calculateStats = (calculations: RevenueCalculation[]) => {
  const totalRevenue = calculations.reduce((sum, calc) =>
    sum + (calc.total_revenue || 0), 0
  );
  // ...
};
```

---

## 올바른 필터링은?

### 월마감 방식이 정확함 ✅

**이유**:
1. **회계 기준**: 매출은 **인식 시점**(계산일)에 따라 집계
2. **월마감 목적**: 특정 월/연도의 **실제 매출** 파악
3. **시계열 정확성**: 2025년 1월~12월의 실제 매출 반영

**매출관리의 project_year 필터**는:
- 사업 **설치 연도** 기준
- 특정 연도 **설치 사업장**의 총 매출 확인용
- 회계적 매출 집계와는 목적이 다름

---

## 해결 방안

### 옵션 1: 매출관리에 날짜 필터 추가 ✅ (권장)

**목적**: 매출관리 페이지에서도 `calculation_date` 기준 필터링 가능

**구현**:
1. "사업 전행 연도" 필터 유지 (기존 `project_year`)
2. **"매출 계산 연도" 필터 추가** (새로운 `calculation_year`)
3. 사용자가 선택 가능하도록 UI 제공

**장점**:
- 두 가지 관점 모두 지원
- 유연한 데이터 분석
- 월마감과 일치하는 매출 확인 가능

**단점**:
- UI 복잡도 증가
- 사용자 혼란 가능성

### 옵션 2: 매출관리를 calculation_date 기준으로 변경 ⚠️

**목적**: 월마감과 동일한 필터링 방식 사용

**구현**:
- `project_year` 필터를 `calculation_year` 필터로 교체
- 모든 필터링을 `calculation_date` 기준으로 변경

**장점**:
- 월마감과 완전히 일치
- 회계 기준 준수
- 데이터 일관성 확보

**단점**:
- 기존 "사업 연도별 매출" 확인 불가
- 기능 변경에 대한 사용자 혼란

### 옵션 3: 두 개의 통계 카드 제공 📊

**목적**: 두 가지 관점의 매출을 동시에 표시

**구현**:
```tsx
<StatsCard title="2025년 설치 사업장 매출" value={projectYearRevenue} />
<StatsCard title="2025년 계산 매출 (월마감 기준)" value={calculationDateRevenue} />
```

**장점**:
- 모든 정보 제공
- 혼란 최소화
- 비교 분석 가능

**단점**:
- UI 공간 필요
- 복잡도 증가

---

## 권장 솔루션

### 1단계: 중복 제거 확인 (즉시)

브라우저 콘솔에서 실제 API 응답 확인:
```javascript
fetch('/api/revenue/calculate?limit=10000')
  .then(r => r.json())
  .then(data => console.log('API 응답:', data.data.calculations.length));
```

서버 로그 확인:
```
📊 [REVENUE-API] 중복 제거 결과: {
  전체_레코드: 1148,
  중복_제거_후: ???,
  제거된_레코드: ???
}
```

### 2단계: 필터 개선 (단기)

**옵션 1-A: calculation_year 필터 추가**
- "사업 전행 연도" 필터 유지
- "매출 계산 연도" 필터 추가
- 사용자가 선택 가능

### 3단계: 문서화 (필수)

사용자 가이드 작성:
- "사업 전행 연도": 해당 연도에 설치된 사업장의 매출 (전체 기간)
- "매출 계산 연도": 해당 연도에 계산된 매출 (월마감과 일치)

---

## 검증 쿼리

### 중복 레코드 확인
```sql
SELECT
  business_id,
  business_name,
  COUNT(*) as count,
  SUM(total_revenue) as revenue
FROM revenue_calculations
WHERE calculation_date >= '2025-01-01' AND calculation_date < '2026-01-01'
GROUP BY business_id, business_name
HAVING COUNT(*) > 1
ORDER BY count DESC;
```

### 날짜 기준 차이 확인
```sql
SELECT
  b.project_year,
  EXTRACT(YEAR FROM r.calculation_date) as calculation_year,
  COUNT(*) as count
FROM business_info b
INNER JOIN revenue_calculations r ON b.id = r.business_id
WHERE b.project_year = 2025 OR EXTRACT(YEAR FROM r.calculation_date) = 2025
GROUP BY b.project_year, EXTRACT(YEAR FROM r.calculation_date)
ORDER BY b.project_year, calculation_year;
```

---

## 관련 파일

- `/app/admin/revenue/page.tsx` - 매출관리 페이지 (project_year 필터)
- `/app/api/admin/monthly-closing/route.ts` - 월마감 API (calculation_date 필터)
- `/app/api/revenue/calculate/route.ts` - 매출 계산 API

## 다음 단계

1. ✅ 필터 차이 원인 분석 완료
2. ✅ SQL 검증 완료
3. 🔄 중복 제거 로직 작동 확인 (브라우저 콘솔)
4. 🔄 필터 개선 방향 결정
5. 🔄 구현 및 테스트
