# 대시보드 현재 시점 강조 기능

**날짜**: 2025-10-29
**상태**: ✅ 완료

## 요약

대시보드의 모든 차트(매출/미수금/설치현황)에서 X축의 현재 시점을 빨간색 점선으로 강조 표시하여 사용자가 현재 위치를 쉽게 파악할 수 있도록 개선했습니다.

## 요구사항

**사용자 요청**: "대시보드의 그래프들의 x축에 지금 시점에 해당하는 x축의 값을 강조해서 표현해줘"

**의도**:
- 현재 날짜/주차/월에 해당하는 X축 위치를 시각적으로 강조
- 사용자가 과거 데이터와 현재 시점을 쉽게 구분
- 모든 집계 레벨(일별/주별/월별)에서 동작

## 구현 내용

### 1. 유틸리티 함수 추가

**파일**: `lib/dashboard-utils.ts`

새로운 함수 `getCurrentTimeKey()` 추가:
```typescript
/**
 * 현재 시점의 집계 키 반환
 *
 * @param level 집계 단위
 * @returns 현재 시점의 집계 키 (YYYY-MM-DD, YYYY-Www, YYYY-MM)
 */
export function getCurrentTimeKey(level: AggregationLevel): string {
  const now = new Date();
  return getAggregationKey(now, level);
}
```

**동작 방식**:
- 일별 집계: `2025-10-29` 형식 반환
- 주별 집계: `2025-W44` 형식 반환
- 월별 집계: `2025-10` 형식 반환

### 2. 차트별 현재 시점 강조 구현

모든 차트 컴포넌트에 동일한 패턴으로 구현:

#### A. RevenueChart (매출/매입/이익 차트)

**파일**: `components/dashboard/charts/RevenueChart.tsx`

**추가 임포트**:
```typescript
import { determineAggregationLevel, getCurrentTimeKey } from '@/lib/dashboard-utils'
```

**현재 시점 계산 로직**:
```typescript
// 현재 시점 계산
const getCurrentTimePoint = () => {
  if (!filters) return null;

  // 집계 레벨 결정
  let aggregationLevel: 'daily' | 'weekly' | 'monthly' = 'monthly';

  if (filters.startDate && filters.endDate) {
    aggregationLevel = determineAggregationLevel(filters.startDate, filters.endDate);
  } else if (filters.periodMode === 'yearly' || filters.periodMode === 'recent' || !filters.periodMode) {
    aggregationLevel = 'monthly';
  }

  return getCurrentTimeKey(aggregationLevel);
};

const currentTimeKey = getCurrentTimePoint();
```

**ReferenceLine 추가**:
```typescript
{/* 현재 시점 강조 */}
{currentTimeKey && data.some(d => d.month === currentTimeKey) && (
  <ReferenceLine
    x={currentTimeKey}
    stroke="#ef4444"
    strokeWidth={2}
    strokeDasharray="5 5"
    label={{ value: '현재', position: 'top', fontSize: 11, fill: '#ef4444', fontWeight: 'bold' }}
  />
)}
```

#### B. ReceivableChart (미수금 차트)

**파일**: `components/dashboard/charts/ReceivableChart.tsx`

동일한 패턴으로 구현:
- 임포트 추가
- `getCurrentTimePoint()` 함수 추가
- ReferenceLine 컴포넌트 추가

#### C. InstallationChart (설치 현황 차트)

**파일**: `components/dashboard/charts/InstallationChart.tsx`

동일한 패턴으로 구현:
- 임포트 추가
- `getCurrentTimePoint()` 함수 추가
- ReferenceLine 컴포넌트 추가

## 시각적 표현

### 스타일 명세

- **색상**: `#ef4444` (빨간색 - red-500)
- **선 두께**: `2px`
- **선 스타일**: 점선 (`strokeDasharray="5 5"`)
- **레이블**: "현재" (상단 표시)
- **레이블 스타일**:
  - 폰트 크기: 11px
  - 색상: 빨간색
  - 굵기: bold

### 표시 조건

현재 시점 강조선은 다음 조건을 **모두** 만족할 때만 표시됩니다:

1. `currentTimeKey`가 존재 (필터 정보로부터 계산 가능)
2. 차트 데이터에 현재 시점 키가 포함됨 (`data.some(d => d.month === currentTimeKey)`)

**이유**: 과거 데이터만 조회하거나 미래 데이터만 조회할 경우 현재 시점이 차트에 없으므로 표시하지 않음

## 동작 시나리오

### 시나리오 1: 오늘 필터 선택

**상황**: 사용자가 "오늘" 버튼 클릭
- 집계 레벨: 일별 (daily)
- 현재 시점: `2025-10-29`
- 표시: X축의 "10/29" 위치에 빨간색 점선 표시

### 시나리오 2: 이번주 필터 선택

**상황**: 사용자가 "이번주" 버튼 클릭
- 집계 레벨: 일별 (7일 이하)
- 현재 시점: `2025-10-29`
- 표시: X축의 "10/29" 위치에 빨간색 점선 표시

### 시나리오 3: 이번달 필터 선택

**상황**: 사용자가 "이번달" 버튼 클릭
- 집계 레벨: 주별 (30일)
- 현재 시점: `2025-W44` (44주차)
- 표시: X축의 "44주" 위치에 빨간색 점선 표시

### 시나리오 4: 최근 12개월 필터

**상황**: 기본 "최근 12개월" 필터
- 집계 레벨: 월별
- 현재 시점: `2025-10`
- 표시: X축의 "2025-10" 위치에 빨간색 점선 표시

### 시나리오 5: 과거 데이터만 조회

**상황**: 사용자가 "2024-01-01 ~ 2024-12-31" 기간 선택
- 현재 시점: `2025-10` (2024년 범위 밖)
- 표시: **현재 시점 선 표시되지 않음** (데이터에 현재 시점 없음)

## 기술적 세부사항

### Recharts ReferenceLine 사용

Recharts 라이브러리의 `ReferenceLine` 컴포넌트를 사용:
- X축 기준 수직선: `x` prop 사용
- Y축 기준 수평선: `y` prop 사용 (평균선에 사용됨)

### 데이터 존재 확인

```typescript
data.some(d => d.month === currentTimeKey)
```

**이유**:
- 차트 데이터에 현재 시점이 없으면 ReferenceLine이 표시되지 않음
- 과거/미래 데이터만 조회 시 불필요한 선 표시 방지
- 성능 최적화: 불필요한 렌더링 방지

### 집계 레벨 자동 결정

필터 모드에 따라 자동으로 집계 레벨 결정:

1. **기간 지정 모드** (`startDate` & `endDate` 존재):
   - `determineAggregationLevel()` 함수 사용
   - 7일 이하: 일별
   - 8~60일: 주별
   - 61일 이상: 월별

2. **연도별/최근 기간 모드**:
   - 항상 월별 집계

## 수정된 파일

1. ✅ `lib/dashboard-utils.ts` - `getCurrentTimeKey()` 함수 추가
2. ✅ `components/dashboard/charts/RevenueChart.tsx` - 현재 시점 강조 추가
3. ✅ `components/dashboard/charts/ReceivableChart.tsx` - 현재 시점 강조 추가
4. ✅ `components/dashboard/charts/InstallationChart.tsx` - 현재 시점 강조 추가

## 테스트 체크리스트

- [x] 일별 집계 (오늘, 어제 필터)에서 현재 시점 표시 확인
- [x] 주별 집계 (이번주, 이번달 필터)에서 현재 시점 표시 확인
- [x] 월별 집계 (최근 12개월, 연도별)에서 현재 시점 표시 확인
- [x] 현재 시점이 데이터 범위 밖일 때 표시되지 않는지 확인
- [x] 모든 차트(RevenueChart, ReceivableChart, InstallationChart)에서 동작 확인
- [x] 개발 서버 컴파일 오류 없음
- [x] TypeScript 타입 오류 없음

## 사용자 경험 개선

1. **시각적 명확성**: 현재 위치를 빨간색 점선으로 명확히 표시
2. **일관성**: 모든 차트에서 동일한 스타일 적용
3. **지능적 표시**: 현재 시점이 없는 경우 자동으로 숨김
4. **다중 레벨 지원**: 일별/주별/월별 모든 집계에서 동작
5. **레이블 제공**: "현재" 텍스트로 의미 명확화

## 향후 개선 가능 사항

1. **커스터마이징**: 사용자가 강조선 색상/스타일 변경 가능
2. **애니메이션**: 현재 시점 선에 깜빡임 효과 추가
3. **호버 효과**: 현재 시점 선 위에 마우스 올릴 때 상세 정보 표시
4. **범례 추가**: 차트 범례에 "현재 시점" 항목 추가

## 관련 문서

- [대시보드 필터 개선 문서](./dashboard-filter-enhancements.md)
- [대시보드 동적 집계 구현](./dashboard-dynamic-aggregation.md)
