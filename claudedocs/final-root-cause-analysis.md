# 영업비용 조정 후 메인 테이블 업데이트 실패 - 최종 근본 원인 분석

## 📅 작업 일자
2025-11-10

## 🎯 문제 요약

**증상**: 영업비용 조정 후 모달을 닫아도 메인 테이블의 이익금액이 업데이트되지 않음

**사용자 보고**: "다시 테스트했지만 메인 테이블 이익금액에 자동 업데이트가 안되고 있어."

## 🔍 ROOT CAUSE 발견

### 진짜 문제: 데이터베이스 스키마 누락

**위치**: `revenue_calculations` 테이블 (Supabase)

**문제**:
1. `revenue_calculations` 테이블에 `adjusted_sales_commission` 컬럼이 **존재하지 않음**
2. API에서 저장할 때 `adjusted_sales_commission` 값을 **저장하지 않음**
3. 메인 테이블 코드는 `adjusted_sales_commission`을 조회하려고 시도 → **항상 undefined/null**

### 코드 분석

#### 1. 메인 테이블 코드 (`app/admin/revenue/page.tsx:870-876`)
```typescript
// ✅ 코드는 정상: adjusted_sales_commission 우선 조회
const salesCommission = revenueCalc?.adjusted_sales_commission
  || revenueCalc?.sales_commission
  || business.adjusted_sales_commission
  || business.sales_commission
  || 0;
```

**문제**: `revenueCalc`에 `adjusted_sales_commission` 필드가 없음 → 항상 두 번째 fallback (`sales_commission`) 사용

#### 2. API 저장 로직 (`app/api/revenue/calculate/route.ts:574-595`)

**Before (문제 코드)**:
```typescript
.insert({
  business_id,
  business_name: businessInfo.business_name,
  calculation_date: calcDate,
  total_revenue: adjustedRevenue,
  total_cost: totalCost,
  gross_profit: grossProfit,
  sales_commission: adjustedSalesCommission, // 🚨 조정된 값을 sales_commission에 저장
  // adjusted_sales_commission 필드 없음!
  survey_costs: totalSurveyCosts,
  installation_costs: totalInstallationCosts,
  net_profit: netProfit,
  ...
})
```

**문제점**:
1. `sales_commission`에 조정된 값(`adjustedSalesCommission`)을 저장
2. 기본 영업비용 값(`salesCommission`)이 손실됨
3. `adjusted_sales_commission` 필드를 아예 저장하지 않음
4. 결과적으로 조정 전/후 값을 구분할 수 없음

#### 3. 데이터베이스 스키마

**revenue_calculations 테이블**:
```sql
CREATE TABLE revenue_calculations (
  id UUID PRIMARY KEY,
  business_id UUID,
  sales_commission DECIMAL(12,2),
  -- adjusted_sales_commission 컬럼 없음! 🚨
  net_profit DECIMAL(12,2),
  ...
);
```

## 🔄 데이터 흐름 분석

### Before (실패 시나리오)

```
1. 사용자가 모달에서 영업비용 +1,000,000원 조정
   ↓
2. handleSaveAdjustment 실행
   - operating_cost_adjustments 테이블에 조정 데이터 저장 ✅
   - POST /api/revenue/calculate (save_result: true) ✅
   ↓
3. /api/revenue/calculate 처리
   - salesCommission = 500,000 (기본)
   - adjustedSalesCommission = 1,500,000 (조정 후)
   - netProfit 재계산 ✅
   ↓
4. DB 저장 (revenue_calculations)
   INSERT {
     sales_commission: 1,500,000  🚨 조정된 값
     adjusted_sales_commission: ??? (컬럼 없음)
   }
   ↓
5. 모달 닫기 → loadCalculations() 실행
   SELECT * FROM revenue_calculations WHERE business_id = 123
   ↓
6. 조회 결과
   {
     sales_commission: 1,500,000
     adjusted_sales_commission: undefined  🚨
   }
   ↓
7. 메인 테이블 계산
   salesCommission = revenueCalc?.adjusted_sales_commission  // undefined
     || revenueCalc?.sales_commission  // 1,500,000 (조정된 값이지만 구분 불가)
     || ...

   🤔 문제: 조정된 값인지 기본값인지 알 수 없음!
   ↓
8. React 재렌더링
   - salesCommission = 1,500,000 (운 좋으면 정상)
   - 하지만 조정이 삭제되면?
   - 여전히 1,500,000 표시 (기본값으로 돌아가지 않음) 🚨
```

### 왜 `save_result: true`로 바꿔도 작동하지 않았나?

1. `save_result: true`는 DB 저장을 활성화함 ✅
2. **BUT** `adjusted_sales_commission` 컬럼이 없어서 저장할 수 없음 ❌
3. `sales_commission`에만 값이 저장되고, 조정 전/후 구분 불가능

## ✅ 해결 방법

### 1. 데이터베이스 스키마 수정

**파일**: `sql/add_adjusted_sales_commission.sql`

```sql
-- adjusted_sales_commission 컬럼 추가
ALTER TABLE revenue_calculations
ADD COLUMN IF NOT EXISTS adjusted_sales_commission DECIMAL(12,2);

-- 인덱스 추가
CREATE INDEX IF NOT EXISTS idx_revenue_calc_adjusted_commission
ON revenue_calculations(adjusted_sales_commission)
WHERE adjusted_sales_commission IS NOT NULL;

-- 기존 데이터 마이그레이션
UPDATE revenue_calculations rc
SET adjusted_sales_commission = (
    CASE
        WHEN oca.adjustment_type = 'add' THEN rc.sales_commission + oca.adjustment_amount
        WHEN oca.adjustment_type = 'subtract' THEN rc.sales_commission - oca.adjustment_amount
        ELSE rc.sales_commission
    END
)
FROM operating_cost_adjustments oca
WHERE rc.business_id = oca.business_id
  AND rc.adjusted_sales_commission IS NULL;
```

### 2. API 저장 로직 수정

**파일**: `app/api/revenue/calculate/route.ts`

**After (수정 코드)**:
```typescript
.insert({
  business_id,
  business_name: businessInfo.business_name,
  calculation_date: calcDate,
  total_revenue: adjustedRevenue,
  total_cost: totalCost,
  gross_profit: grossProfit,
  sales_commission: salesCommission, // ✅ 기본 영업비용 (조정 전)
  adjusted_sales_commission: adjustedSalesCommission, // ✅ 조정된 영업비용 (조정 후)
  survey_costs: totalSurveyCosts,
  installation_costs: totalInstallationCosts,
  net_profit: netProfit,
  ...
})
```

**변경사항**:
- `sales_commission`: 조정 **전** 기본 영업비용 저장
- `adjusted_sales_commission`: 조정 **후** 영업비용 저장

### 3. 데이터 흐름 (수정 후)

```
1. 사용자가 모달에서 영업비용 +1,000,000원 조정
   ↓
2. handleSaveAdjustment 실행
   - operating_cost_adjustments 테이블에 조정 데이터 저장 ✅
   - POST /api/revenue/calculate (save_result: true) ✅
   ↓
3. /api/revenue/calculate 처리
   - salesCommission = 500,000 (기본)
   - adjustedSalesCommission = 1,500,000 (조정 후)
   - netProfit 재계산 ✅
   ↓
4. DB 저장 (revenue_calculations)
   INSERT {
     sales_commission: 500,000  ✅ 기본값
     adjusted_sales_commission: 1,500,000  ✅ 조정된 값
     net_profit: 계산된 순이익
   }
   ↓
5. 모달 닫기 → loadCalculations() 실행
   SELECT * FROM revenue_calculations WHERE business_id = 123
   ↓
6. 조회 결과
   {
     sales_commission: 500,000
     adjusted_sales_commission: 1,500,000  ✅ 조회 성공!
   }
   ↓
7. 메인 테이블 계산
   salesCommission = revenueCalc?.adjusted_sales_commission  // 1,500,000 ✅
     || revenueCalc?.sales_commission
     || ...

   netProfit = grossProfit - salesCommission - ...
   ↓
8. React 재렌더링
   - 메인 테이블 이익금액: 1,200,000원 ✅
   - 모달 순이익: 1,200,000원 ✅
   - 완벽히 동기화! 🎉
```

## 📊 실행 순서

### 1단계: 데이터베이스 마이그레이션
```sql
-- Supabase SQL Editor에서 실행
-- 파일: sql/add_adjusted_sales_commission.sql
ALTER TABLE revenue_calculations
ADD COLUMN IF NOT EXISTS adjusted_sales_commission DECIMAL(12,2);
```

### 2단계: 코드 배포
- `app/api/revenue/calculate/route.ts` 수정 완료 ✅
- `components/business/BusinessRevenueModal.tsx` 수정 완료 ✅
- `app/admin/revenue/page.tsx` 이미 준비됨 ✅

### 3단계: 테스트
1. 매출 관리 페이지 접속
2. 사업장 선택 → 모달 열기
3. 영업비용 조정 (+1,000,000원)
4. 저장 → 모달 닫기
5. ✅ 메인 테이블 이익금액 즉시 업데이트 확인

## 🎯 왜 이전 수정들이 실패했는가?

### 시도 1: `save_result: false` → `true` 변경
- **목적**: DB 저장 활성화
- **결과**: 실패 ❌
- **이유**: `adjusted_sales_commission` 컬럼이 없어서 저장해도 소용없음

### 시도 2: `loadBusinesses()` + `loadCalculations()` 병렬 호출
- **목적**: 모달 닫을 때 데이터 재조회
- **결과**: 실패 ❌
- **이유**: DB에 `adjusted_sales_commission` 데이터가 없어서 조회해도 null

### 시도 3: 우선순위 로직 (`adjusted_sales_commission` 우선)
- **목적**: 조정된 값 우선 사용
- **결과**: 실패 ❌
- **이유**: 조회할 데이터가 DB에 존재하지 않음

## 🔑 핵심 교훈

### 1. 전체 데이터 흐름 추적 중요성
- 클라이언트 코드만 보면 문제 없어 보임
- API 코드도 일견 정상
- **하지만 DB 스키마가 빠져있음!**

### 2. 3-Tier 아키텍처 검증
```
Frontend (React) ✅
   ↓
Backend (API) ⚠️ (저장 로직 불완전)
   ↓
Database (Supabase) ❌ (컬럼 누락)
```

### 3. 타입과 실제 스키마 불일치
```typescript
// TypeScript 타입 정의
interface CalculatedData {
  adjusted_sales_commission?: number;  // ✅ 타입에는 있음
}

// 실제 DB 스키마
CREATE TABLE revenue_calculations (
  -- adjusted_sales_commission 없음!  ❌
);
```

**타입스크립트는 런타임 DB 스키마를 검증하지 않음!**

## 📁 수정된 파일

1. **`sql/add_adjusted_sales_commission.sql`** (신규)
   - `adjusted_sales_commission` 컬럼 추가
   - 인덱스 생성
   - 기존 데이터 마이그레이션

2. **`app/api/revenue/calculate/route.ts`**
   - Line 583: `sales_commission: salesCommission` (기본값)
   - Line 584: `adjusted_sales_commission: adjustedSalesCommission` (조정된 값)

3. **`components/business/BusinessRevenueModal.tsx`**
   - Line 144, 207: `save_result: true` (이미 수정됨)

4. **`app/admin/revenue/page.tsx`**
   - Line 870-876: `adjusted_sales_commission` 우선순위 로직 (이미 준비됨)

## ✅ 작업 완료 체크리스트

- [x] ROOT CAUSE 분석 완료
- [x] 데이터 흐름 전체 추적
- [x] DB 마이그레이션 스크립트 작성
- [x] API 저장 로직 수정
- [x] 상세 문서화
- [ ] **DB 마이그레이션 실행 (Supabase)**
- [ ] 애플리케이션 재시작
- [ ] End-to-End 테스트
- [ ] 프로덕션 배포

## 🚀 다음 단계

### 즉시 실행 필요 (사용자)
1. Supabase SQL Editor 접속
2. `sql/add_adjusted_sales_commission.sql` 실행
3. 애플리케이션 재시작 (Next.js dev server)
4. 테스트:
   - 영업비용 조정 추가
   - 저장 → 모달 닫기
   - 메인 테이블 이익금액 즉시 업데이트 확인

### 검증 쿼리
```sql
-- 1. 컬럼 추가 확인
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'revenue_calculations'
  AND column_name = 'adjusted_sales_commission';

-- 2. 조정이 있는 사업장의 최근 계산 결과 확인
SELECT
  rc.business_name,
  rc.calculation_date,
  rc.sales_commission AS "기본 영업비용",
  rc.adjusted_sales_commission AS "조정된 영업비용",
  oca.adjustment_amount AS "조정 금액",
  oca.adjustment_type AS "조정 유형"
FROM revenue_calculations rc
LEFT JOIN operating_cost_adjustments oca ON rc.business_id = oca.business_id
WHERE oca.id IS NOT NULL
ORDER BY rc.created_at DESC
LIMIT 5;
```

## 🎉 예상 결과

수정 완료 후:
1. ✅ 모달에서 영업비용 조정 → 순이익 변경 확인
2. ✅ 저장 → DB에 `adjusted_sales_commission` 저장
3. ✅ 모달 닫기 → `loadCalculations()`가 조정된 값 조회
4. ✅ 메인 테이블 이익금액 즉시 업데이트
5. ✅ 모달 순이익 = 메인 테이블 이익금액 (완벽히 동기화!)

**사용자는 더 이상 페이지를 새로고침할 필요가 없습니다!** 🚀
