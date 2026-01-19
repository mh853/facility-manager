# 매출 계산 API 날짜 필터 문제 해결 보고서

## 📋 문제 분석

**사용자 리포트**: "매출 상세 모달에 매입금액이 하나도 안나오고 있어."

### 서버 로그 분석

```
✅ [PG] Query executed: {
  text: 'SELECT * FROM manufacturer_pricing\n       WHERE ma',
  duration: '78ms',
  rows: 0  ← ❌ 0개 행 반환!
}

제조사 '에코센스'의 원가 데이터 없음:  (주)규원테크
⚠️ [API CALC] differential_pressure_meter: 제조사별 원가 없음
⚠️ [API CALC] temperature_meter: 제조사별 원가 없음
...
totalCost: 0  ← 매입금액 0원!
```

### 근본 원인

**날짜 필터 조건이 너무 엄격하여 데이터 조회 실패**

#### 문제 상황:

**SQL 쿼리 (Before)**:
```sql
SELECT * FROM manufacturer_pricing
WHERE manufacturer = $1
AND is_active = $2
AND effective_from <= $3           ← 문제!
AND (effective_to IS NULL OR effective_to >= $3)
```

**데이터 상태**:
```
DB 테이블 (manufacturer_pricing):
- effective_from: '2025-01-01'  (초기 데이터 설정)

사업장 계산일 (calcDate):
- 2024-10-27  (사업장의 설치일/완료일)

조건 검증:
2025-01-01 <= 2024-10-27  → FALSE ❌
```

**결과**:
- `rows: 0` → 제조사별 원가 데이터 조회 실패
- `manufacturerCostMap = {}` → 빈 객체
- 모든 장비의 매입단가 = 0원
- 총 매입금액 = 0원 → 모달에 표시 안 됨

---

## ✅ 해결 방법

### Option 2 적용: API 쿼리에서 날짜 조건 제거

**이유**:
- 시스템에서 `is_active=true`인 최신 데이터만 관리
- 과거 가격 이력 관리 기능 미사용
- 간단하고 빠른 해결책

---

## 🔧 적용한 수정 사항

### 파일: `/app/api/revenue/calculate/route.ts`

총 **6개 쿼리** 수정:

#### 1️⃣ manufacturer_pricing (제조사별 원가) - Lines 170-178

**Before**:
```typescript
const manufacturerPricing = await queryAll(
  `SELECT * FROM manufacturer_pricing
   WHERE manufacturer = $1
   AND is_active = $2
   AND effective_from <= $3
   AND (effective_to IS NULL OR effective_to >= $3)`,
  [manufacturer, true, calcDate]
);
```

**After**:
```typescript
// 날짜 조건 제거하여 최신 활성 데이터만 조회
const manufacturerPricing = await queryAll(
  `SELECT * FROM manufacturer_pricing
   WHERE manufacturer = $1
   AND is_active = $2`,
  [manufacturer, true]
);
```

#### 2️⃣ government_pricing (환경부 고시가) - Lines 130-135

**Before**:
```typescript
const pricingData = await queryAll(
  'SELECT * FROM government_pricing WHERE is_active = $1 AND effective_from <= $2',
  [true, calcDate]
);
```

**After**:
```typescript
// 날짜 조건 제거하여 최신 활성 데이터만 조회
const pricingData = await queryAll(
  'SELECT * FROM government_pricing WHERE is_active = $1',
  [true]
);
```

#### 3️⃣ equipment_installation_cost (기기별 설치비) - Lines 195-201

**Before**:
```typescript
const installationCosts = await queryAll(
  `SELECT * FROM equipment_installation_cost
   WHERE is_active = $1
   AND effective_from <= $2
   AND (effective_to IS NULL OR effective_to >= $2)`,
  [true, calcDate]
);
```

**After**:
```typescript
// 날짜 조건 제거하여 최신 활성 데이터만 조회
const installationCosts = await queryAll(
  `SELECT * FROM equipment_installation_cost
   WHERE is_active = $1`,
  [true]
);
```

#### 4️⃣ sales_office_commission_rates (영업점별 수수료율) - Lines 254-264

**Before**:
```typescript
const commissionRate = await queryOne(
  `SELECT * FROM sales_office_commission_rates
   WHERE sales_office = $1
   AND manufacturer = $2
   AND effective_from <= $3
   AND (effective_to IS NULL OR effective_to >= $3)
   ORDER BY effective_from DESC
   LIMIT 1`,
  [salesOffice, manufacturerCode, calcDate]
);
```

**After**:
```typescript
// 날짜 조건 제거하여 최신 활성 데이터만 조회
const commissionRate = await queryOne(
  `SELECT * FROM sales_office_commission_rates
   WHERE sales_office = $1
   AND manufacturer = $2
   ORDER BY effective_from DESC
   LIMIT 1`,
  [salesOffice, manufacturerCode]
);
```

#### 5️⃣ sales_office_cost_settings (영업점 설정) - Lines 265-275

**Before**:
```typescript
const salesSettings = await queryOne(
  `SELECT * FROM sales_office_cost_settings
   WHERE sales_office = $1
   AND is_active = $2
   AND effective_from <= $3
   ORDER BY effective_from DESC
   LIMIT 1`,
  [salesOffice, true, calcDate]
);
```

**After**:
```typescript
// 날짜 조건 제거하여 최신 활성 데이터만 조회
const salesSettings = await queryOne(
  `SELECT * FROM sales_office_cost_settings
   WHERE sales_office = $1
   AND is_active = $2
   ORDER BY effective_from DESC
   LIMIT 1`,
  [salesOffice, true]
);
```

#### 6️⃣ survey_cost_settings (실사비용 설정) - Lines 302-308

**Before**:
```typescript
const surveyCosts = await queryAll(
  `SELECT * FROM survey_cost_settings
   WHERE is_active = $1
   AND effective_from <= $2`,
  [true, calcDate]
);
```

**After**:
```typescript
// 날짜 조건 제거하여 최신 활성 데이터만 조회
const surveyCosts = await queryAll(
  `SELECT * FROM survey_cost_settings
   WHERE is_active = $1`,
  [true]
);
```

---

## ⚠️ 유지한 날짜 조건

다음 쿼리들은 날짜 조건을 **유지**했습니다 (사업장별/날짜별 적용):

### business_additional_installation_cost (사업장별 추가 설치비)
```typescript
// applied_date 조건은 유지 (사업장별 추가 설치비는 날짜별로 적용)
const additionalCosts = await queryAll(
  `SELECT * FROM business_additional_installation_cost
   WHERE business_id = $1
   AND is_active = $2
   AND applied_date <= $3`,
  [business_id, true, calcDate]
);
```

### survey_cost_adjustments (실사비용 조정)
```typescript
// applied_date 조건은 유지 (조정 사항은 날짜별로 적용)
const surveyAdjustments = await queryAll(
  `SELECT * FROM survey_cost_adjustments
   WHERE business_id = $1
   AND applied_date <= $2`,
  [business_id, calcDate]
);
```

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
  Generating static pages (77/77)
  Finalizing page optimization ...
```

---

## 🎯 기대 효과

### Before (문제 상황)
```
사업장: (주)규원테크
제조사: 에코센스
calcDate: 2024-10-27

DB 쿼리:
effective_from <= 2024-10-27
→ 2025-01-01 <= 2024-10-27 = FALSE

결과:
rows: 0
매입금액: 0원 ❌
모달 표시: 매입금액 없음
```

### After (수정 후)
```
사업장: (주)규원테크
제조사: 에코센스

DB 쿼리:
is_active = true (날짜 조건 없음)
→ 최신 활성 데이터 조회 성공

결과:
rows: 5개 (차압계, 온도계, 송풍전류계 등)
매입금액: 정상 계산 ✅
모달 표시: 매입금액 정상 표시
```

---

## 📊 영향 범위

### 수정된 기능
- ✅ BusinessRevenueModal 매입금액 표시
- ✅ 제조사별 원가 조회
- ✅ 환경부 고시가 조회
- ✅ 기기별 설치비 조회
- ✅ 영업점 수수료율 조회
- ✅ 실사비용 설정 조회

### 영향 없는 기능
- ✅ Admin/Revenue 페이지 테이블 (클라이언트 계산)
- ✅ Admin 대시보드 (별도 API)
- ✅ 사업장별 추가 설치비 (날짜 조건 유지)
- ✅ 실사비용 조정 (날짜 조건 유지)

---

## 🔍 시스템 설계 고려사항

### 현재 시스템 특성
- `is_active=true`인 최신 데이터만 사용
- 과거 가격 이력 관리 기능 미사용
- `effective_from`, `effective_to` 컬럼 존재하지만 활용 안 함

### 향후 개선 방향 (선택적)

#### Option A: 과거 가격 이력 관리 활성화
```sql
-- 초기 데이터의 effective_from을 과거로 설정
UPDATE manufacturer_pricing
SET effective_from = '2024-01-01'
WHERE effective_from = '2025-01-01';

-- 날짜 조건 다시 활성화
AND effective_from <= $calcDate
```

**장점**: 과거 사업장 계산 시 당시 가격 사용
**단점**: 데이터 관리 복잡도 증가

#### Option B: 날짜 컬럼 제거 (현재 선택)
```sql
-- effective_from, effective_to 컬럼 제거
ALTER TABLE manufacturer_pricing
DROP COLUMN effective_from,
DROP COLUMN effective_to;

-- is_active만으로 최신 데이터 관리
```

**장점**: 간단한 데이터 구조, 관리 용이
**단점**: 과거 가격 이력 관리 불가

---

## 📝 변경 파일 목록

### 수정
1. **[`/app/api/revenue/calculate/route.ts`](../app/api/revenue/calculate/route.ts)**
   - Line 130-135: government_pricing 쿼리 날짜 조건 제거
   - Line 170-178: manufacturer_pricing 쿼리 날짜 조건 제거
   - Line 195-201: equipment_installation_cost 쿼리 날짜 조건 제거
   - Line 254-264: sales_office_commission_rates 쿼리 날짜 조건 제거
   - Line 265-275: sales_office_cost_settings 쿼리 날짜 조건 제거
   - Line 302-308: survey_cost_settings 쿼리 날짜 조건 제거

---

## 🧪 검증 방법

### 사용자 테스트
```bash
# 개발 서버 실행
npm run dev

# 테스트 절차:
1. Admin/Revenue 페이지 접속
2. (주)규원테크 선택
3. 상세 아이콘(돋보기) 클릭
4. BusinessRevenueModal 확인

기대 결과:
- 차압계: 매입단가 ₩140,000 표시 ✅
- 온도계: 매입단가 ₩120,000 표시 ✅
- 송풍전류계: 매입단가 ₩70,000 표시 ✅
- 게이트웨이(1,2): 매입단가 표시 ✅
- VPN(유선): 매입단가 표시 ✅
- 총 매입금액: 정상 표시 ✅

# 서버 로그 확인:
브라우저 개발자 도구 → Network 탭 → /api/revenue/calculate 응답
totalCost > 0 확인
```

---

## 📚 참고 자료

### 관련 이슈
1. [DEFAULT_COSTS 제거 1차](./revenue-calculator-default-costs-removal.md) - 클라이언트 수정
2. [DEFAULT_COSTS 제거 2차](./revenue-calculate-api-default-costs-removal.md) - API 수정
3. [제조사 이름 매칭](./manufacturer-matching-fix.md) - 정규화 로직

### 관련 파일
1. [`/app/api/revenue/calculate/route.ts`](../app/api/revenue/calculate/route.ts) - 모달 계산 API
2. [`/components/business/BusinessRevenueModal.tsx`](../components/business/BusinessRevenueModal.tsx) - 매출 상세 모달
3. [`/sql/manufacturer_pricing_system.sql`](../sql/manufacturer_pricing_system.sql) - DB 스키마

### SQL 스키마 참고
```sql
-- manufacturer_pricing 테이블 구조
CREATE TABLE manufacturer_pricing (
    id UUID PRIMARY KEY,
    equipment_type VARCHAR(100),
    manufacturer VARCHAR(20),
    cost_price DECIMAL(12,2),
    effective_from DATE NOT NULL,  -- 현재 미사용 (날짜 필터 제거됨)
    effective_to DATE NULL,         -- 현재 미사용
    is_active BOOLEAN DEFAULT TRUE  -- 활성 데이터 관리에 사용
);
```

---

**작성자**: Claude Code Implementation Agent
**날짜**: 2026-01-15
**버전**: 1.0
**상태**: ✅ 구현 완료 (사용자 테스트 대기)
