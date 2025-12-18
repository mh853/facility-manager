# 매출관리 vs 월마감 매출 차이 분석

## 문제 상황

**매출관리** (2025년 필터): 약 **75억원**
**월마감** (2025년 필터): 약 **69억원**
**차이**: 약 **6억원** (8%)

## 원인 분석

### 1. 데이터 소스 차이

#### 매출관리 페이지 (`/app/admin/revenue/page.tsx`)
```typescript
// Line 536: GET /api/revenue/calculate 호출
const response = await fetch(`/api/revenue/calculate?${params}`, {
  headers: getAuthHeaders()
});

// 데이터 소스: revenue_calculations 테이블 전체
// 조건: limit=100 (최대 100개 레코드만 조회)
```

**특징**:
- `revenue_calculations` 테이블에서 **직접 조회**
- **페이지네이션**: 기본 limit=100으로 제한
- **필터**: 영업점 단일 선택만 가능 (다중 선택은 클라이언트에서 처리)
- **모든 계산 레코드** 포함 (사업장당 여러 개의 계산 레코드 가능)

#### 월마감 페이지 (`/app/admin/monthly-closing/route.ts`)
```typescript
// Line 192-196: POST 요청 시 특정 월의 데이터만 조회
const { data: businesses, error: businessError } = await supabase
  .from('revenue_calculations')
  .select('total_revenue, total_cost, sales_commission, installation_costs, adjusted_sales_commission')
  .gte('calculation_date', startDate)
  .lt('calculation_date', endDate);

// 데이터 소스: monthly_closings 테이블 (월별 집계)
// 조건: 특정 연도/월에 속하는 레코드만
```

**특징**:
- `monthly_closings` 테이블에서 **월별 집계 데이터** 조회
- **사업장당 월 1개의 레코드**만 존재
- **자동 계산 실행 시**에만 데이터 생성/업데이트

### 2. 핵심 차이점

| 항목 | 매출관리 | 월마감 |
|------|---------|--------|
| 데이터 소스 | `revenue_calculations` (원본) | `monthly_closings` (집계) |
| 레코드 수 | 사업장당 여러 개 가능 | 사업장당 월 1개 |
| 조회 제한 | limit=100 (페이지네이션) | 제한 없음 (월별 집계) |
| 데이터 갱신 | 즉시 반영 | 자동 계산 실행 시만 반영 |
| 중복 계산 | 가능 (같은 사업장 여러 번 계산) | 없음 (월별 집계) |

### 3. 매출 차이 발생 원인

#### 원인 1: 페이지네이션 제한 (limit=100) ⚠️
```typescript
// app/admin/revenue/page.tsx Line 532
params.append('limit', '100');
```

**문제**:
- 2025년 전체 사업장 수가 100개를 초과할 경우
- **100개 이후의 매출 데이터는 누락**

**확인 방법**:
```sql
SELECT COUNT(*)
FROM revenue_calculations
WHERE calculation_date >= '2025-01-01'
  AND calculation_date < '2026-01-01';
```

#### 원인 2: 중복 계산 레코드 포함 ⚠️
`revenue_calculations` 테이블에는 동일 사업장에 대한 **여러 개의 계산 레코드**가 존재할 수 있음:

**예시**:
- 사업장 A - 2025-01-15 계산: 1억원
- 사업장 A - 2025-01-20 재계산: 1.2억원 (수정)
- 사업장 A - 2025-01-25 재계산: 1.1억원 (최종)

**매출관리**: 3개 레코드 모두 합산 → **3.3억원** (중복)
**월마감**: 최종 1개만 반영 → **1.1억원** (정확)

#### 원인 3: 월마감 미실행 사업장 ⚠️
월마감의 "자동 계산"을 실행하지 않은 월/사업장의 경우:

**매출관리**: `revenue_calculations`에서 조회 → **포함**
**월마감**: `monthly_closings`에 없음 → **제외**

### 4. 검증 방법

#### Step 1: 전체 레코드 수 확인
```sql
-- 2025년 revenue_calculations 레코드 수
SELECT COUNT(*) as total_records
FROM revenue_calculations
WHERE calculation_date >= '2025-01-01'
  AND calculation_date < '2026-01-01';
```

**예상 결과**: 100개 초과 시 → limit 제한 문제

#### Step 2: 중복 계산 확인
```sql
-- 사업장별 계산 횟수 확인
SELECT
  business_id,
  business_name,
  COUNT(*) as calculation_count,
  SUM(total_revenue) as total_revenue_sum
FROM revenue_calculations
WHERE calculation_date >= '2025-01-01'
  AND calculation_date < '2026-01-01'
GROUP BY business_id, business_name
HAVING COUNT(*) > 1
ORDER BY calculation_count DESC;
```

**예상 결과**: 여러 번 계산된 사업장 리스트

#### Step 3: 매출관리와 월마감 데이터 비교
```sql
-- 매출관리 총 매출 (중복 포함, limit 100)
WITH revenue_data AS (
  SELECT total_revenue
  FROM revenue_calculations
  WHERE calculation_date >= '2025-01-01'
    AND calculation_date < '2026-01-01'
  ORDER BY calculation_date DESC
  LIMIT 100
)
SELECT SUM(total_revenue) as revenue_total FROM revenue_data;

-- 월마감 총 매출 (월별 집계)
SELECT SUM(total_revenue) as closing_total
FROM monthly_closings
WHERE year = 2025;
```

#### Step 4: 월마감 누락 월 확인
```sql
-- 2025년 월마감 데이터 확인
SELECT
  month,
  total_revenue,
  business_count,
  is_closed
FROM monthly_closings
WHERE year = 2025
ORDER BY month;
```

**예상 결과**: 일부 월이 누락되었거나 business_count가 적을 수 있음

## 해결 방안

### 해결책 1: 매출관리 페이지 limit 제거 ✅ (권장)

**변경**:
```typescript
// app/admin/revenue/page.tsx Line 532
// 변경 전
params.append('limit', '100');

// 변경 후
params.append('limit', '10000'); // 충분히 큰 값으로 설정
```

**장점**:
- 간단한 수정
- 즉시 적용 가능
- 모든 레코드 조회 가능

**단점**:
- 중복 계산 문제는 여전히 존재
- 성능 저하 가능성

### 해결책 2: 매출관리를 월마감 기준으로 변경 ✅✅ (근본적 해결)

**개념**:
매출관리 페이지도 `monthly_closings` 테이블을 기준으로 조회

**장점**:
- 중복 계산 문제 해결
- 월마감과 동일한 데이터 표시
- 데이터 일관성 확보

**단점**:
- 월마감 실행 필요
- 구현 복잡도 증가

### 해결책 3: revenue_calculations에서 최신 레코드만 조회 ✅ (추천)

**변경**:
```typescript
// 사업장별 최신 계산 레코드만 조회
WITH latest_calculations AS (
  SELECT DISTINCT ON (business_id)
    *
  FROM revenue_calculations
  WHERE calculation_date >= '2025-01-01'
    AND calculation_date < '2026-01-01'
  ORDER BY business_id, calculation_date DESC, created_at DESC
)
SELECT * FROM latest_calculations
ORDER BY calculation_date DESC;
```

**장점**:
- 중복 제거
- 최신 데이터 반영
- limit 제한 해결

**단점**:
- API 수정 필요

## 권장 솔루션

**1순위**: 해결책 3 (최신 레코드만 조회)
**2순위**: 해결책 1 (limit 증가) + 중복 제거 로직 추가
**3순위**: 해결책 2 (월마감 기준으로 변경)

## 구현 계획

### Phase 1: 원인 검증 (5분)
1. SQL 쿼리 실행하여 전체 레코드 수 확인
2. 중복 계산 사업장 확인
3. 월마감 누락 월 확인

### Phase 2: 수정 (30분)
1. `/app/api/revenue/calculate/route.ts` GET 엔드포인트 수정
2. DISTINCT ON으로 사업장별 최신 레코드만 조회
3. limit 기본값을 10000으로 증가

### Phase 3: 검증 (10분)
1. 매출관리 페이지에서 2025년 필터 적용
2. 월마감 페이지와 총 매출 비교
3. 차이가 없는지 확인

## 관련 파일

- `/app/admin/revenue/page.tsx` - 매출관리 페이지
- `/app/api/revenue/calculate/route.ts` - 매출 계산 API
- `/app/api/admin/monthly-closing/route.ts` - 월마감 API
- `/app/api/admin/monthly-closing/auto-calculate/route.ts` - 자동 계산 API

## 다음 단계

1. ✅ 원인 분석 완료
2. 🔄 SQL 쿼리로 실제 데이터 검증
3. 🔄 API 수정 (DISTINCT ON 적용)
4. 🔄 테스트 및 검증
