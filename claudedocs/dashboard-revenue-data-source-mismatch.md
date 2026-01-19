# 대시보드 vs 매출 관리 데이터 불일치 분석

## 📊 분석 일시
2026-01-15

## 🎯 문제 요약

**스크린샷 비교 결과**:

| 항목 | 대시보드 (2025-07) | 매출 관리 (2025년 7월 필터) | 차이 |
|------|-------------------|---------------------------|------|
| 총 사업장 | ? | 480개 | - |
| 총 매출 | ₩1,290,720,000 | ₩2,427,180,000 | +₩1,136,460,000 (+88%) |
| 총 매입 | ₩163,489,000 | ₩1,254,754,000 | +₩1,091,265,000 (+667%) |
| 총 영업비용 | ₩695,004,560 | ₩250,007,400 | -₩444,997,160 (-64%) |
| 총 설치비용 | ₩589,170,000 | ₩233,270,000 | -₩355,900,000 (-60%) |

## 🔍 근본 원인 분석

### 1. 두 페이지 모두 실시간 계산 사용 ✅

**매출 관리 페이지** (`/admin/revenue/page.tsx` Line 748):
```typescript
const calculatedData = calculateBusinessRevenue(business, pricingData);
```

**대시보드** (`/api/dashboard/revenue/route.ts` Line 267-350):
```typescript
// 동일한 계산 로직 사용
```

### 2. 필터링 조건의 차이 ❌

#### 대시보드 필터 (`/api/dashboard/revenue/route.ts`)
```typescript
// Line 45-53
WHERE is_active = true
  AND is_deleted = false
  AND installation_date IS NOT NULL
  AND installation_date >= $startDate  // 예: 2025-07-01
  AND installation_date <= $endDate    // 예: 2025-07-31
```

**조건**: 2025년 7월에 **설치 완료**된 사업장만

#### 매출 관리 필터 (`/admin/revenue/page.tsx`)
```typescript
// Line 730: 사업 진행 연도 필터
const yearMatch = selectedProjectYears.length === 0
  || selectedProjectYears.includes(String(business.project_year || ''));

// Line 733-743: 설치 월 필터
if (selectedMonths.length > 0) {
  const installDate = business.installation_date;
  if (installDate) {
    const date = new Date(installDate);
    const month = String(date.getMonth() + 1);
    monthMatch = selectedMonths.includes(month);
  } else {
    monthMatch = true;  // 🔴 설치일 없어도 포함!
  }
}
```

**조건**:
- `project_year = 2025` (사업 진행 연도)
- `MONTH(installation_date) = 7` (7월 설치)
- **설치일이 없어도 포함** (`monthMatch = true`)

### 3. 🚨 결정적 차이점

**대시보드**:
```sql
installation_date IS NOT NULL  -- 설치 완료된 사업장만
```

**매출 관리**:
```typescript
monthMatch = true;  -- 설치일 없으면 모두 포함!
```

## 📊 검증 가설

매출 관리 페이지가 더 큰 이유:
1. **미설치 사업장 포함**: `installation_date`가 NULL인 사업장도 포함
2. **사업 진행 연도 기준**: `project_year = 2025`인 모든 사업장 포함 (설치 완료 여부 무관)

대시보드가 더 작은 이유:
1. **설치 완료된 사업장만**: `installation_date IS NOT NULL` 조건
2. **좁은 날짜 범위**: 2025-07-01 ~ 2025-07-31만 포함

## 🔧 해결 방법

### 옵션 1: 대시보드를 매출 관리와 동일하게 수정 (권장)

`/api/dashboard/revenue/route.ts` 수정:
```typescript
// ❌ 기존 (설치일 필수)
queryParts.push('WHERE is_active = true AND is_deleted = false AND installation_date IS NOT NULL');

// ✅ 수정 (설치일 선택적)
queryParts.push('WHERE is_active = true AND is_deleted = false');

// 날짜 필터를 installation_date가 있는 경우에만 적용
if (startDate && endDate) {
  queryParts.push(`AND (installation_date IS NULL OR (installation_date >= $${paramIndex} AND installation_date <= $${paramIndex+1}))`);
  params.push(startDate);
  params.push(endDate);
  paramIndex += 2;
}
```

### 옵션 2: 매출 관리를 대시보드와 동일하게 수정

`/admin/revenue/page.tsx` 수정:
```typescript
// Line 741 수정
} else {
  monthMatch = false;  // 설치일 없으면 제외
}
```

## 🎯 권장 사항

**옵션 1 추천** - 대시보드를 매출 관리와 동일하게 수정

**이유**:
1. 매출 관리 페이지는 사용자가 실제 사용하는 주요 페이지
2. 사업 진행 중인 모든 사업장을 포함하는 것이 비즈니스 관점에서 합리적
3. 대시보드가 매출 관리 페이지의 요약본이어야 함

**예상 효과**:
- 대시보드 총 매출: ₩1,290,720,000 → ₩2,427,180,000
- 대시보드 총 매입: ₩163,489,000 → ₩1,254,754,000
- 두 페이지 금액 일치

---

**작성자**: Claude Code
**분석일**: 2026-01-15
**상태**: 🔴 Critical - 데이터 불일치
**우선순위**: 🔴 즉시 수정 필요
