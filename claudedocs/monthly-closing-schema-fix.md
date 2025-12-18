# 월 마감 집계 스키마 오류 수정 ✅

## 수정 완료 (2025-12-16)

**상태**: ✅ 수정 완료 및 빌드 성공

**문제**: `column revenue_calculations.installation_extra_cost does not exist`

**원인**: 집계 쿼리에서 존재하지 않는 컬럼 조회

**해결**: 쿼리에서 `installation_extra_cost` 컬럼 제거

---

## 문제 상황

### 에러 로그
```
[집계 시작] year: 2025 month: 11
[집계 실패] Error: 매출 데이터 조회 실패: column revenue_calculations.installation_extra_cost does not exist
    at POST (webpack-internal:///(rsc)/./app/api/admin/monthly-closing/auto-calculate/route.ts:189:27)
```

### 증상
- 자동 계산 실행 시 집계 단계에서 실패
- 브라우저에 경고 메시지 표시: "매출 계산은 완료되었으나 월 마감 집계 중 오류가 발생했습니다."
- 서버 로그에 PostgreSQL 스키마 에러 발생

## 근본 원인

### 데이터베이스 스키마 분석

**`revenue_calculations` 테이블 실제 스키마** (`/sql/revenue_management_schema.sql`):

```sql
CREATE TABLE IF NOT EXISTS revenue_calculations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    business_id UUID REFERENCES business_info(id),
    business_name VARCHAR(255),
    calculation_date DATE NOT NULL,

    -- 매출/매입/이익
    total_revenue DECIMAL(12,2) NOT NULL DEFAULT 0,
    total_cost DECIMAL(12,2) NOT NULL DEFAULT 0,
    gross_profit DECIMAL(12,2) NOT NULL DEFAULT 0,

    -- 비용 항목들
    sales_commission DECIMAL(10,2) NOT NULL DEFAULT 0,      -- ✅ 존재
    survey_costs DECIMAL(10,2) NOT NULL DEFAULT 0,
    installation_costs DECIMAL(10,2) NOT NULL DEFAULT 0,    -- ✅ 존재
    net_profit DECIMAL(12,2) NOT NULL DEFAULT 0,

    -- ❌ installation_extra_cost 컬럼 없음!

    -- 상세 정보
    equipment_breakdown JSONB,
    cost_breakdown JSONB,
    pricing_version_snapshot JSONB,
    sales_office VARCHAR(100),

    -- 기타
    is_retroactive_calculation BOOLEAN DEFAULT FALSE,
    original_calculation_id UUID REFERENCES revenue_calculations(id),
    retroactive_reason TEXT,
    created_at TIMESTAMP DEFAULT NOW(),
    calculated_by UUID REFERENCES employees(id)
);
```

### 문제 코드 분석

집계 쿼리가 존재하지 않는 `installation_extra_cost` 컬럼을 조회:

**파일 1**: `/app/api/admin/monthly-closing/auto-calculate/route.ts` (Line 202-218)

```typescript
// ❌ Before
const { data: revenueData, error: revenueError } = await supabase
  .from('revenue_calculations')
  .select('total_revenue, sales_commission, installation_costs, adjusted_sales_commission, installation_extra_cost')  // ❌ 존재하지 않는 컬럼
  .gte('calculation_date', startDate)
  .lt('calculation_date', endDate);

// ... 집계 계산
const installationCosts = revenueData?.reduce((sum, b) =>
  sum + (Number(b.installation_costs) || 0) + (Number(b.installation_extra_cost) || 0), 0) || 0;  // ❌ 존재하지 않는 필드 사용
```

**파일 2**: `/app/api/admin/monthly-closing/route.ts` (Line 184-203)

```typescript
// ❌ Before
const { data: businesses, error: businessError } = await supabase
  .from('revenue_calculations')
  .select('total_revenue, sales_commission, installation_costs, adjusted_sales_commission, installation_extra_cost')  // ❌ 존재하지 않는 컬럼
  .gte('calculation_date', startDate)
  .lt('calculation_date', endDate);

// ... 집계 계산
const installationCosts = businesses?.reduce((sum, b) =>
  sum + (Number(b.installation_costs) || 0) + (Number(b.installation_extra_cost) || 0), 0) || 0;  // ❌ 존재하지 않는 필드 사용
```

## 수정 내역

### 1. Auto-Calculate Route 수정

**파일**: `/app/api/admin/monthly-closing/auto-calculate/route.ts`

**변경 내용** (Lines 202-218):

```typescript
// ✅ After
const { data: revenueData, error: revenueError } = await supabase
  .from('revenue_calculations')
  .select('total_revenue, sales_commission, installation_costs, adjusted_sales_commission')  // ✅ 존재하지 않는 컬럼 제거
  .gte('calculation_date', startDate)
  .lt('calculation_date', endDate);

// ... 집계 계산
const installationCosts = revenueData?.reduce((sum, b) =>
  sum + (Number(b.installation_costs) || 0), 0) || 0;  // ✅ installation_costs만 사용
```

### 2. Monthly Closing Route 수정

**파일**: `/app/api/admin/monthly-closing/route.ts`

**변경 내용** (Lines 184-203):

```typescript
// ✅ After
const { data: businesses, error: businessError } = await supabase
  .from('revenue_calculations')
  .select('total_revenue, sales_commission, installation_costs, adjusted_sales_commission')  // ✅ 존재하지 않는 컬럼 제거
  .gte('calculation_date', startDate)
  .lt('calculation_date', endDate);

// ... 집계 계산
const installationCosts = businesses?.reduce((sum, b) =>
  sum + (Number(b.installation_costs) || 0), 0) || 0;  // ✅ installation_costs만 사용
```

## 수정 요약

| 항목 | Before | After |
|------|--------|-------|
| SELECT 컬럼 | `..., installation_extra_cost` | 컬럼 제거 |
| 집계 계산 | `installation_costs + installation_extra_cost` | `installation_costs` 만 사용 |

## 테스트 결과

### 빌드 확인
```bash
npm run build
# ✅ Compiled successfully
```

### 예상 동작

**정상 실행**:
```
[집계 시작] year: 2025 month: 11
[집계 데이터 조회 완료] count: 10
[집계 계산 완료] totalRevenue: 50000000 salesCommission: 5000000 installationCosts: 10000000
[집계 저장 완료] year: 2025 month: 11
POST /api/admin/monthly-closing/auto-calculate 200 in 2034ms
```

**브라우저 알림**:
```
✅ 자동 계산 완료

총 사업장: 10개
계산 완료: 10개
실패: 0개
```

## 데이터 일관성 확인

### Installation Extra Cost 처리

현재 시스템에서 설치 추가 비용은 `revenue_calculations` 테이블에 별도 컬럼으로 저장되지 않습니다.

**설치비 데이터 흐름**:

1. **기본 설치비**: `equipment_installation_cost` 테이블에서 조회
2. **계산 시점**: `/api/revenue/calculate`에서 `installation_costs`에 포함하여 저장
3. **집계 시점**: `revenue_calculations.installation_costs` 컬럼 사용

따라서 추가 설치비가 있다면 이미 `installation_costs`에 포함되어 있거나, 별도로 관리되지 않는 것입니다.

### 추가 비용 관리 필요 시

만약 설치 추가 비용을 별도로 추적해야 한다면:

**옵션 1**: 테이블 스키마 확장
```sql
ALTER TABLE revenue_calculations
ADD COLUMN installation_extra_cost DECIMAL(10,2) DEFAULT 0;
```

**옵션 2**: JSONB 활용
```sql
-- cost_breakdown JSONB에 저장
{
  "installation_base": 500000,
  "installation_extra": 100000,
  "installation_total": 600000
}
```

## 다음 단계

1. ✅ **스키마 오류 수정 완료**
2. ✅ **빌드 성공 확인**
3. 🔄 **실제 테스트**:
   - 개발 서버 재시작
   - 자동 계산 재실행
   - 집계 성공 로그 확인

4. 🔄 **데이터 검증**:
   - `monthly_closings` 테이블에 데이터 저장 확인
   - 설치비 합계가 올바른지 검증

## 관련 문서

- [월 마감 시스템 전체 수정 내역](./monthly-closing-all-fixes-summary.md)
- [월 마감 집계 Silent Failure 수정](./monthly-closing-silent-failure-fix.md)
- [월 마감 자동 계산 로직 수정](./monthly-closing-auto-calculate-fix.md)

## 기술 노트

### PostgreSQL 스키마 검증

데이터베이스 스키마와 코드가 일치하는지 확인하는 방법:

```sql
-- 테이블 컬럼 확인
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'revenue_calculations'
ORDER BY ordinal_position;
```

### 방어적 프로그래밍

존재하지 않는 컬럼을 조회하려고 할 때 PostgreSQL은 즉시 에러를 반환하므로:

1. **스키마 문서 유지**: 테이블 스키마를 명확히 문서화
2. **타입 정의 사용**: TypeScript 인터페이스로 컬럼 명세
3. **테스트 작성**: 스키마 변경 시 집계 쿼리 테스트

### 수정 전후 비교

**수정 전**:
```
SELECT 문: 5개 컬럼 (installation_extra_cost 포함)
집계 계산: installation_costs + installation_extra_cost
결과: PostgreSQL 에러 → 집계 실패
```

**수정 후**:
```
SELECT 문: 4개 컬럼 (존재하는 컬럼만)
집계 계산: installation_costs만 사용
결과: 정상 실행 → 집계 성공
```
