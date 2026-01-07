# Revenue Calculate API 문자열 연결 버그 수정

## 문제 상황

Revenue Calculate API에서 최종 매출금액(`adjustedRevenue`) 계산 시 숫자 덧셈이 아닌 문자열 연결이 발생:

**Before (문자열 연결)**:
```
기본 매출: 5,780,000 (정상)
추가공사비: 1,300,000 (정상)
최종 매출금액: 57,800,001,300,000 ❌ (문자열 연결)
```

**Expected (숫자 덧셈)**:
```
기본 매출: 5,780,000
추가공사비: 1,300,000
최종 매출금액: 7,080,000 ✅ (5,780,000 + 1,300,000)
```

## 근본 원인

**File**: [app/api/revenue/calculate/route.ts](../app/api/revenue/calculate/route.ts:470-477)

**Root Cause**: PostgreSQL Direct Query에서 반환되는 `businessInfo.additional_cost`가 **문자열 타입**이었음.

**Impact**: JavaScript 타입 강제 변환으로 인해 `Number + String = String concatenation` 발생

```typescript
// Line 470 - BEFORE
const additionalCost = businessInfo.additional_cost || 0; // ❌ String "1300000"

// Line 477 - BEFORE
const adjustedRevenue = totalRevenue + additionalCost - negotiationDiscount;
// 5780000 + "1300000" = "57800001300000" ❌ String concatenation!
```

## 해결 방법

### File: [app/api/revenue/calculate/route.ts](../app/api/revenue/calculate/route.ts)

**Three Number() conversions added** (Lines 465, 470, 479):

#### 1. survey_fee_adjustment (Line 465)

**Before**:
```typescript
const surveyFeeAdjustment = businessInfo.survey_fee_adjustment || 0; // ❌ String
```

**After**:
```typescript
const surveyFeeAdjustment = Number(businessInfo.survey_fee_adjustment) || 0; // ✅ Number
```

#### 2. additional_cost (Line 470) ⭐ **PRIMARY FIX**

**Before**:
```typescript
const additionalCost = businessInfo.additional_cost || 0; // ❌ String from PostgreSQL
```

**After**:
```typescript
const additionalCost = Number(businessInfo.additional_cost) || 0; // ✅ Converted to number
```

#### 3. installation_extra_cost (Line 479)

**Before**:
```typescript
const installationExtraCost = businessInfo.installation_extra_cost || 0; // ❌ String
```

**After**:
```typescript
const installationExtraCost = Number(businessInfo.installation_extra_cost) || 0; // ✅ Number
```

### Calculation Logic (Line 477)

**Already Correct** - No changes needed:
```typescript
const adjustedRevenue = totalRevenue + additionalCost - negotiationDiscount;
// Now: 5780000 + 1300000 - 0 = 7080000 ✅ Numeric addition!
```

## 기술적 세부사항

### Data Type Issue

PostgreSQL Direct Query returns numeric columns as strings for certain fields:
- `business_info.additional_cost`: INTEGER → returned as string `"1300000"`
- `business_info.survey_fee_adjustment`: INTEGER → returned as string
- `business_info.installation_extra_cost`: INTEGER → returned as string

### JavaScript Type Coercion

```javascript
// Without Number() conversion
5780000 + "1300000" = "57800001300000" ❌

// With Number() conversion
5780000 + Number("1300000") = 7080000 ✅
```

### Existing Fields Already Handled

`negotiationDiscount` was already using `parseFloat()` (Line 471):
```typescript
const negotiationDiscount = businessInfo.negotiation ? parseFloat(businessInfo.negotiation) || 0 : 0;
```

## 검증 절차

### 1. 브라우저에서 확인

1. 사업장 관리 페이지 접속: `http://localhost:3002/admin/business`
2. 사업장 상세보기 모달 열기
3. "매출 상세보기" 버튼 클릭
4. 확인 사항:
   - ✅ 기본 매출: 5,780,000 (정상)
   - ✅ 추가공사비: 1,300,000 (정상)
   - ✅ 매출금액: 7,080,000 (정상 덧셈)

### 2. API Response 확인

```bash
curl -X POST http://localhost:3002/api/revenue/calculate \
  -H "Content-Type: application/json" \
  -d '{"business_id": "bd3c672b-d705-44c7-88c1-4605758106ee"}'
```

**Expected Response**:
```json
{
  "success": true,
  "data": {
    "total_revenue": 7080000,  // ✅ 5,780,000 + 1,300,000
    "total_cost": 1870000,
    "net_profit": 5210000
  }
}
```

## 영향받은 데이터 흐름

### Before Fix

```
1. PostgreSQL → businessInfo.additional_cost = "1300000" (string)
2. Revenue Calculate API → adjustedRevenue = 5780000 + "1300000" = "57800001300000" ❌
3. BusinessRevenueModal → displayData.total_revenue = "57800001300000" ❌
4. formatCurrency(Number("57800001300000")) = "₩57,800,001,300,000" ❌
```

### After Fix

```
1. PostgreSQL → businessInfo.additional_cost = "1300000" (string)
2. Revenue Calculate API → additionalCost = Number("1300000") = 1300000 ✅
3. Revenue Calculate API → adjustedRevenue = 5780000 + 1300000 = 7080000 ✅
4. BusinessRevenueModal → displayData.total_revenue = 7080000 ✅
5. formatCurrency(Number(7080000)) = "₩7,080,000" ✅
```

## 관련 파일

| 파일 | 변경 사항 | 라인 |
|-----|---------|-----|
| `app/api/revenue/calculate/route.ts` | ✅ `Number(businessInfo.survey_fee_adjustment)` | 465 |
| `app/api/revenue/calculate/route.ts` | ✅ `Number(businessInfo.additional_cost)` ⭐ PRIMARY | 470 |
| `app/api/revenue/calculate/route.ts` | ✅ `Number(businessInfo.installation_extra_cost)` | 479 |

## 이전 수정 사항과의 관계

이 수정은 다음 문서들과 연관되어 있습니다:
- [매출금액 문자열 연결 버그 수정](./revenue-modal-string-concatenation-fix.md) - Frontend `displayData` fallback 수정
- [추가 비용 정보 표시 수정](./additional-cost-negotiation-display-fix.md) - `additional_cost` 컬럼 추가

**Two-Part Fix 완료**:
1. ✅ Backend API: Revenue Calculate API에서 Number() 변환 (이 문서)
2. ✅ Frontend Modal: BusinessRevenueModal displayData fallback Number() 변환

## 결론

**Root Cause**: Revenue Calculate API에서 PostgreSQL이 반환한 문자열 타입 숫자 필드를 Number() 변환 없이 사용하여 JavaScript 문자열 연결 발생

**Fix**: `additional_cost`, `survey_fee_adjustment`, `installation_extra_cost` 세 필드에 `Number()` 변환 추가

**Impact**: 모든 매출 계산이 정상적인 숫자 덧셈으로 수행되어 올바른 결과 표시
