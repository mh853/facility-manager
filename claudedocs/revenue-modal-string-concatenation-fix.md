# 매출금액 문자열 연결 버그 수정

## 문제 상황

BusinessRevenueModal에서 매출금액, 매입금액, 순이익이 문자열로 연결되어 잘못된 값으로 표시됨:

**Before (문자열 연결 버그)**:
```
매출금액: ₩57,800,001,300,000  (❌ 잘못된 문자열 연결)
매입금액: ₩1,870,000
순이익: ₩57,799,998,382,000  (❌ 잘못된 문자열 연결)
```

**Expected (정상 계산)**:
```
매출금액: ₩5,780,000  (✅ 숫자 합산)
매입금액: ₩1,870,000
순이익: ₩3,910,000  (✅ 숫자 합산)
```

## 근본 원인

**Primary Issue**: PostgreSQL Direct Query에서 반환되는 `business` 객체의 숫자 필드가 문자열 타입으로 전달됨.

**Secondary Issue**: BusinessRevenueModal의 `displayData` 객체 생성 시, Revenue Calculate API 결과가 없을 때 fallback으로 사용하는 `business` 객체 값에 `Number()` 변환이 누락되어 있었음.

**Impact**: JavaScript에서 문자열 + 문자열 = 문자열 연결 발생 (예: `'5780000' + '1300000'` = `'57800001300000'`)

### 영향받은 섹션

1. **매출/매입/이익 정보 카드** (Line 520-540)
2. **최종 매출금액 계산식** (Line 576-605)
3. **순이익 계산 공식** (Line 908-963)

## 해결 방법

### File: [components/business/BusinessRevenueModal.tsx](../components/business/BusinessRevenueModal.tsx)

**Two-Part Fix:**
1. **displayData 객체 생성 시 Number() 변환** (Lines 316-325) - 가장 중요한 수정
2. **모든 formatCurrency() 호출 시 Number() 변환** (Lines 526-961) - 방어적 코딩

### 0. displayData 객체 fallback 값 변환 (Lines 316-325) ⭐ **ROOT CAUSE FIX**

**Before**:
```typescript
const displayData = calculatedData ? {
  ...calculatedData,
} : {
  total_revenue: business.total_revenue || 0,  // ❌ String from PostgreSQL
  total_cost: business.total_cost || 0,
  net_profit: business.net_profit || 0,
  // ...
};
```

**After**:
```typescript
const displayData = calculatedData ? {
  ...calculatedData,
} : {
  total_revenue: Number(business.total_revenue) || 0,  // ✅ Converted to number
  total_cost: Number(business.total_cost) || 0,
  gross_profit: Number(business.gross_profit) || 0,
  sales_commission: Number(business.sales_commission) || 0,
  survey_costs: Number(business.survey_costs) || 0,
  installation_costs: Number(business.installation_costs) || 0,
  net_profit: Number(business.net_profit) || 0,
  survey_fee_adjustment: Number(business.survey_fee_adjustment) || 0,
  // ...
};
```

**변경 사항**:
- Line 316: `Number(business.total_revenue)`
- Line 317: `Number(business.total_cost)`
- Line 318: `Number(business.gross_profit)`
- Line 319: `Number(business.sales_commission)`
- Line 320: `Number(business.survey_costs)`
- Line 321: `Number(business.installation_costs)`
- Line 323: `Number(business.net_profit)`
- Line 325: `Number(business.survey_fee_adjustment)`

### 1. 매출/매입/이익 정보 카드 (Line 526-538)

**Before**:
```typescript
<p className="text-lg font-bold text-green-700">
  {formatCurrency(displayData.total_revenue)}
</p>
```

**After**:
```typescript
<p className="text-lg font-bold text-green-700">
  {formatCurrency(Number(displayData.total_revenue))}
</p>
```

**변경 사항**:
- Line 526: `formatCurrency(Number(displayData.total_revenue))`
- Line 532: `formatCurrency(Number(displayData.total_cost))`
- Line 535: `Number(displayData.net_profit) >= 0` (조건문)
- Line 536: `Number(displayData.net_profit) >= 0` (조건문)
- Line 538: `formatCurrency(Number(displayData.net_profit))`

### 2. 최종 매출금액 계산식 (Line 588-602)

**Before**:
```typescript
{business.additional_cost > 0 && (
  <div className="flex items-center justify-between text-green-700">
    <span>+ 추가공사비</span>
    <span className="font-mono">+{formatCurrency(business.additional_cost)}</span>
  </div>
)}
```

**After**:
```typescript
{Number(business.additional_cost) > 0 && (
  <div className="flex items-center justify-between text-green-700">
    <span>+ 추가공사비</span>
    <span className="font-mono">+{formatCurrency(Number(business.additional_cost))}</span>
  </div>
)}
```

**변경 사항**:
- Line 588: `Number(business.additional_cost) > 0`
- Line 591: `formatCurrency(Number(business.additional_cost))`
- Line 594: `Number(business.negotiation) > 0`
- Line 597: `formatCurrency(Number(business.negotiation))`
- Line 602: `formatCurrency(Number(displayData.total_revenue))`

### 3. 순이익 계산 공식 (Line 914-961)

**Before**:
```typescript
<div className="flex justify-between border-b border-gray-200 pb-2">
  <span>매출금액</span>
  <span className="font-bold text-green-700">{formatCurrency(displayData.total_revenue)}</span>
</div>
```

**After**:
```typescript
<div className="flex justify-between border-b border-gray-200 pb-2">
  <span>매출금액</span>
  <span className="font-bold text-green-700">{formatCurrency(Number(displayData.total_revenue))}</span>
</div>
```

**변경 사항**:
- Line 914: `formatCurrency(Number(displayData.total_revenue))`
- Line 918: `formatCurrency(Number(displayData.total_cost))`
- Line 922: `formatCurrency(Number(displayData.gross_profit))`
- Line 927: `formatCurrency(Number(displayData.adjusted_sales_commission || displayData.sales_commission))`
- Line 932: `formatCurrency(Number(displayData.sales_commission))`
- Line 934: `formatCurrency(Number(displayData.operating_cost_adjustment.adjustment_amount))`
- Line 939: `formatCurrency(Number(displayData.survey_costs))`
- Line 943: `formatCurrency(Number(displayData.survey_costs || 0) - Number(displayData.survey_fee_adjustment || 0))`
- Line 945: `formatCurrency(Math.abs(Number(displayData.survey_fee_adjustment)))`
- Line 950: `formatCurrency(Number(displayData.installation_costs))`
- Line 952: `Number(displayData.additional_installation_revenue) > 0`
- Line 955: `formatCurrency(Number(displayData.additional_installation_revenue))`
- Line 960: `Number(displayData.net_profit) >= 0`
- Line 961: `formatCurrency(Number(displayData.net_profit))`

## 기술적 세부사항

### 데이터 타입 문제

Revenue Calculate API는 PostgreSQL Direct Query를 사용하며, 일부 숫자 필드가 문자열로 반환됨:
- `total_revenue`: string → number 변환 필요
- `total_cost`: string → number 변환 필요
- `net_profit`: string → number 변환 필요
- `survey_costs`: string → number 변환 필요
- 기타 비용 관련 필드들

### formatCurrency 함수

```typescript
function formatCurrency(value: number): string {
  return value.toLocaleString('ko-KR');
}
```

- 입력: `number` 타입 필요
- 문자열이 전달되면: 문자열 연결 발생 (예: `'5780000' + '100000'` = `'5780000100000'`)
- Number() 변환 후: 정상 숫자 덧셈 (예: `5780000 + 100000` = `5880000`)

## 검증 절차

### 1. 개발 서버 재시작
```bash
npm run dev
```

### 2. 브라우저에서 확인
1. 사업장 관리 페이지 접속
2. 사업장 상세보기 모달 열기
3. "매출 상세보기" 버튼 클릭

### 3. 확인 사항
✅ **매출/매입/이익 정보 카드**:
- 매출금액: 정상적인 숫자 형식 (예: ₩5,780,000)
- 매입금액: 정상적인 숫자 형식 (예: ₩1,870,000)
- 순이익: 정상적인 숫자 형식 (예: ₩3,910,000)

✅ **최종 매출금액 계산식**:
- 기본 매출 + 추가공사비 - 협의사항 = 최종 매출금액 (정상 계산)

✅ **순이익 계산 공식**:
- 매출금액 - 매입금액 - 영업비용 - 실사비용 - 설치비 = 순이익 (정상 계산)

## 관련 파일

| 파일 | 변경 사항 | 라인 |
|-----|---------|-----|
| `components/business/BusinessRevenueModal.tsx` | ✅ 모든 숫자 필드에 Number() 추가 | 526, 532, 535-538, 588-602, 914-961 |

## 이전 수정 사항과의 관계

이 수정은 다음 문서들과 연관되어 있습니다:
- [추가 비용 정보 표시 수정](./additional-cost-negotiation-display-fix.md) - `additional_cost` 컬럼 추가
- [Revenue API 문자열 연결 버그 수정](./revenue-api-string-concatenation-fix.md) - ⭐ Backend API Number() 변환 (최종 근본 원인 수정)
- 이 문서는 **Frontend 표시 계산 문제**를 해결

**Two-Part Fix**:
1. ✅ **Backend API** (revenue-api-string-concatenation-fix.md): Revenue Calculate API에서 `additional_cost`, `survey_fee_adjustment`, `installation_extra_cost` Number() 변환
2. ✅ **Frontend Modal** (이 문서): BusinessRevenueModal displayData fallback 값 Number() 변환

## 결론

**Root Cause (Primary)**: Revenue Calculate API에서 PostgreSQL이 반환한 문자열 타입 숫자 필드(`additional_cost` 등)를 Number() 변환 없이 사용하여 JavaScript 문자열 연결 발생

**Root Cause (Secondary)**: BusinessRevenueModal의 `displayData` fallback 객체에서도 Number() 변환 누락

**Fix**:
- Backend: Revenue Calculate API에서 Number() 변환 추가 (Lines 465, 470, 479)
- Frontend: displayData fallback 및 formatCurrency() 호출 시 Number() 변환 추가

**Impact**: 매출 상세보기 모달의 모든 숫자 표시가 정상적으로 계산되어 표시됨
