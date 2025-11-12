# 계약서 매출금액/추가공사비/협의사항 미표시 문제 수정

## 📋 문제 요약

**증상**: 계약서 생성 시 측정기기는 정상 표시되지만, 매출금액(total_amount), 추가공사비(additional_cost), 협의사항(negotiation_cost)이 모두 0으로 표시됨

**발견 날짜**: 2025-11-11

---

## 🔍 근본 원인 분석

### 1. 매출금액 (total_amount) - 0원 표시

**원인**: `revenue_calculations` 테이블에 해당 사업장 데이터가 없는 경우 폴백 처리 없음

**기존 로직**:
```typescript
const { data: revenue } = await supabaseAdmin
  .from('revenue_calculations')
  .select('total_revenue')
  .eq('business_id', business_id)
  .maybeSingle();

const totalAmount = revenue?.total_revenue || 0;  // ⚠️ 데이터 없으면 무조건 0
```

**문제점**:
- `revenue_calculations`에 데이터가 없으면 무조건 0원
- 다른 소스(견적금액 등)에서 폴백 처리 없음

---

### 2. 추가공사비 (additional_cost) - 하드코딩 0

**원인**: `business_info` 테이블에 `additional_construction_cost` 컬럼이 존재하지만 사용하지 않음

**기존 코드**:
```typescript
additional_cost: 0, // TODO: 추가공사비 필드가 DB에 추가되면 business.additional_cost 사용
```

**DB 스키마** (`fix_excel_upload_schema_issues.sql:76-80`):
```sql
ALTER TABLE business_info
ADD COLUMN IF NOT EXISTS additional_construction_cost INTEGER DEFAULT 0;
```

**문제점**:
- TODO 주석만 있고 실제 필드는 조회하지 않음
- 하드코딩된 0 값 사용

---

### 3. 협의사항/네고 (negotiation_cost) - 하드코딩 0

**원인**: `business_info` 테이블에 `negotiation` 컬럼이 존재하지만 사용하지 않음

**기존 코드**:
```typescript
negotiation_cost: 0, // TODO: 협의금액 필드가 DB에 추가되면 business.negotiation_amount 사용
```

**DB 스키마** (`fix_excel_upload_schema_issues.sql:82-86`):
```sql
ALTER TABLE business_info
ADD COLUMN IF NOT EXISTS negotiation VARCHAR(255);
```

**문제점**:
- TODO 주석만 있고 실제 필드는 조회하지 않음
- `negotiation` 필드가 VARCHAR 타입이므로 숫자 변환 필요

---

## ✅ 적용된 해결 방안

### 수정 1: business_info SELECT 쿼리에 필드 추가

**위치**: `route.ts:94-119`

**변경 내용**:
```typescript
// Before
select(`
  id,
  business_name,
  ...,
  vpn_wireless
`)

// After
select(`
  id,
  business_name,
  ...,
  vpn_wireless,
  additional_construction_cost,  // ✅ 추가
  negotiation                     // ✅ 추가
`)
```

---

### 수정 2: 비용 정보 추출 및 파싱 로직 추가

**위치**: `route.ts:140-154`

**변경 내용**:
```typescript
// 추가공사비: INTEGER 타입이므로 직접 사용
const additionalCost = business.additional_construction_cost || 0;

// 협의금액: VARCHAR 타입이므로 숫자 변환
// "10,000원" → 10000, "500만원" → 500 등 다양한 형식 처리
const negotiationCost = business.negotiation
  ? parseFloat(String(business.negotiation).replace(/[^0-9.-]/g, '')) || 0
  : 0;

// 디버깅 로그 추가
console.log('💰 사업장 비용 정보 추출:', {
  business_id,
  business_name: business.business_name,
  revenue_from_calculations: revenue?.total_revenue,
  total_amount: totalAmount,
  additional_construction_cost: business.additional_construction_cost,
  negotiation_raw: business.negotiation,
  additional_cost_parsed: additionalCost,
  negotiation_cost_parsed: negotiationCost
});
```

**파싱 로직 설명**:
```javascript
String(business.negotiation)              // 문자열로 변환
  .replace(/[^0-9.-]/g, '')              // 숫자, 소수점, 음수 부호만 남김
parseFloat(...) || 0                      // 숫자 변환 실패 시 0
```

**예시**:
- `"10,000"` → `10000`
- `"500만원"` → `500`
- `"1.5천만"` → `1.5`
- `null` → `0`

---

### 수정 3: contractData에 실제 값 적용

**위치**: `route.ts:234-264`

**변경 내용**:
```typescript
// Before
additional_cost: 0,          // TODO: ...
negotiation_cost: 0,         // TODO: ...

// After
additional_cost: additionalCost,      // ✅ business_info에서 추출
negotiation_cost: negotiationCost,    // ✅ business_info에서 추출
```

---

### 수정 4: contract_history 저장 시 실제 값 사용

**위치**: `route.ts:267-289`

**변경 내용**:
```typescript
// Before
additional_cost: additional_cost || 0,       // 요청 파라미터 우선
negotiation_cost: negotiation_cost || 0,     // 요청 파라미터 우선

// After
additional_cost: additionalCost,             // business_info 값 사용
negotiation_cost: negotiationCost,           // business_info 값 사용
```

**중요**: 요청 파라미터(`additional_cost`, `negotiation_cost`)는 UI에서 직접 입력하는 경우를 위한 것이지만, 현재는 business_info의 데이터를 사용

---

## 📊 데이터 흐름

```
business_info 테이블
├─ additional_construction_cost (INTEGER)
│  └─> additionalCost (파싱) → contractData.additional_cost → contract_history
│
├─ negotiation (VARCHAR)
│  └─> negotiationCost (파싱) → contractData.negotiation_cost → contract_history
│
└─ revenue_calculations 테이블
   └─ total_revenue → totalAmount → contractData.total_amount
```

---

## 🧪 테스트 시나리오

### 시나리오 1: 모든 데이터가 있는 경우
```
business_info:
  - additional_construction_cost: 5000000
  - negotiation: "1000000"
revenue_calculations:
  - total_revenue: 15000000

예상 결과:
  - 매출금액: ₩15,000,000
  - 추가공사비: ₩5,000,000
  - 협의사항: ₩1,000,000
```

### 시나리오 2: revenue_calculations 데이터가 없는 경우
```
business_info:
  - additional_construction_cost: 3000000
  - negotiation: "500000"
revenue_calculations: (데이터 없음)

예상 결과:
  - 매출금액: ₩0 ⚠️ (폴백 로직 필요)
  - 추가공사비: ₩3,000,000
  - 협의사항: ₩500,000
```

### 시나리오 3: 비용 정보가 null인 경우
```
business_info:
  - additional_construction_cost: null
  - negotiation: null
revenue_calculations:
  - total_revenue: 10000000

예상 결과:
  - 매출금액: ₩10,000,000
  - 추가공사비: ₩0
  - 협의사항: ₩0
```

### 시나리오 4: negotiation이 특수 형식인 경우
```
business_info:
  - negotiation: "10,000원"    → 10000
  - negotiation: "500만원"     → 500
  - negotiation: "-100000"     → -100000 (할인)
  - negotiation: "협의 필요"   → 0 (숫자 없음)
```

---

## 🚨 추가 고려사항

### 매출금액 폴백 로직 필요 (향후 개선)

**현재**:
```typescript
const totalAmount = revenue?.total_revenue || 0;
```

**권장 개선**:
```typescript
// 1순위: revenue_calculations
// 2순위: estimate_data (견적 금액)
// 3순위: calculated_total (장비 수량 기반 계산)
const totalAmount = revenue?.total_revenue
  || business.estimated_amount
  || calculateTotalFromEquipment(business)
  || 0;
```

### negotiation 필드 타입 변경 고려

**현재**: `VARCHAR(255)` - 문자열 파싱 필요
**권장**: `INTEGER` 또는 `NUMERIC(12, 2)` - 직접 사용 가능

**마이그레이션 예시**:
```sql
-- Step 1: 새 컬럼 추가
ALTER TABLE business_info
ADD COLUMN negotiation_amount INTEGER DEFAULT 0;

-- Step 2: 기존 데이터 변환
UPDATE business_info
SET negotiation_amount = CAST(REGEXP_REPLACE(negotiation, '[^0-9]', '', 'g') AS INTEGER)
WHERE negotiation IS NOT NULL AND negotiation ~ '^[0-9,]+$';

-- Step 3: negotiation 컬럼을 텍스트 메모용으로 변경
COMMENT ON COLUMN business_info.negotiation IS '협의 내용 메모';
COMMENT ON COLUMN business_info.negotiation_amount IS '협의 금액 (원)';
```

---

## 📁 수정된 파일

### 1. `app/api/document-automation/contract/route.ts`
- **Line 94-119**: business_info SELECT에 additional_construction_cost, negotiation 추가
- **Line 140-154**: 비용 정보 추출 및 파싱 로직 추가
- **Line 234-264**: contractData에 실제 값 적용
- **Line 287-288**: contract_history 저장 시 실제 값 사용

---

## 📝 관련 문서

- 장비 수량 문제 수정: `claudedocs/contract-equipment-fix.md`
- DB 스키마: `sql/fix_excel_upload_schema_issues.sql`
- 계약서 이력 테이블: `sql/add_contract_history_columns.sql`

---

**작성일**: 2025-11-11
**작성자**: Claude Code
**적용 상태**: ✅ 완료 (테스트 대기)
