# 월 마감 설치비 합계 저장 수정

## 문제 상황

**매출 계산 API**:
- 순이익 계산 시 **기본 설치비 + 추가설치비** 모두 차감
- 하지만 `revenue_calculations` 테이블에는 **기본 설치비만** 저장

**코드**:
```typescript
// app/api/revenue/calculate/route.ts Line 489
const netProfit = grossProfit - installationExtraCost - adjustedSalesCommission - totalSurveyCosts - totalInstallationCosts;

// app/api/revenue/calculate/route.ts Line 561
installation_costs: totalInstallationCosts,  // ❌ installationExtraCost 누락!
```

**결과**:
- `net_profit`: 정확 (두 설치비 모두 차감)
- `installation_costs`: 부정확 (기본 설치비만 저장)
- 월 마감 집계 시 설치비가 실제보다 적게 계산됨

## 해결 방안

### 옵션 1: 합계 저장 ✅ (채택)

**변경**:
```typescript
// app/api/revenue/calculate/route.ts Line 561
installation_costs: totalInstallationCosts + installationExtraCost,  // 합계 저장
```

**장점**:
- 월 마감 집계 간단 (한 필드만 조회)
- 스키마 변경 불필요
- 즉시 적용 가능

**설명 추가**:
- 스키마 주석에 "기본 설치비 + 추가설치비 합계" 명시
- 필요 시 `cost_breakdown` JSON에서 구분 가능

## 구현

### 1. Backend API 수정

**파일**: `/app/api/revenue/calculate/route.ts`

**변경 위치**: Line 561

**수정 전**:
```typescript
const { data: saved, error: saveError } = await supabaseAdmin
  .from('revenue_calculations')
  .upsert({
    business_id,
    business_name: businessInfo.business_name,
    calculation_date: calcDate,
    total_revenue: adjustedRevenue,
    total_cost: totalCost,
    gross_profit: grossProfit,
    sales_commission: salesCommission,
    adjusted_sales_commission: hasAdjustment ? adjustedSalesCommission : null,
    survey_costs: totalSurveyCosts,
    installation_costs: totalInstallationCosts,  // ❌ 기본 설치비만
    net_profit: netProfit,
    // ...
  }, {
    onConflict: 'business_id,calculation_date'
  })
```

**수정 후**:
```typescript
const { data: saved, error: saveError } = await supabaseAdmin
  .from('revenue_calculations')
  .upsert({
    business_id,
    business_name: businessInfo.business_name,
    calculation_date: calcDate,
    total_revenue: adjustedRevenue,
    total_cost: totalCost,
    gross_profit: grossProfit,
    sales_commission: salesCommission,
    adjusted_sales_commission: hasAdjustment ? adjustedSalesCommission : null,
    survey_costs: totalSurveyCosts,
    installation_costs: totalInstallationCosts + installationExtraCost,  // ✅ 합계 저장
    net_profit: netProfit,
    // ...
  }, {
    onConflict: 'business_id,calculation_date'
  })
```

### 2. 스키마 주석 업데이트 (선택사항)

**파일**: `/sql/update_installation_costs_comment.sql` (새 파일)

```sql
-- revenue_calculations.installation_costs 컬럼 설명 업데이트
COMMENT ON COLUMN revenue_calculations.installation_costs IS
'총 설치비용 (기본 설치비 + 추가설치비 합계). 상세 구분은 cost_breakdown에서 확인 가능';
```

### 3. cost_breakdown 구조 확인

**현재 구조** (`app/api/revenue/calculate/route.ts` Line 509-543):
```typescript
cost_breakdown: {
  sales_commission_type: commissionSettings.commission_type,
  sales_commission_rate: ...,
  sales_commission_amount: salesCommission,
  survey_costs: {
    estimate: surveyCostMap.estimate,
    pre_construction: surveyCostMap.pre_construction,
    completion: surveyCostMap.completion,
    adjustments: totalAdjustments,
    survey_fee_adjustment: surveyFeeAdjustment,
    total: totalSurveyCosts
  },
  installation_costs: installationCostMap,  // 기기별 기본 설치비 맵
  total_installation_costs: totalInstallationCosts,  // ✅ 기본 설치비 합계
  installation_extra_cost: installationExtraCost,  // ✅ 추가설치비
  // ...
}
```

**확인**: `cost_breakdown`에 이미 두 설치비가 구분되어 저장되므로, 필요 시 상세 내역 확인 가능

## 검증

### 1. 매출 계산 API 테스트

**테스트 데이터**:
- 기본 설치비 (totalInstallationCosts): 500,000원
- 추가설치비 (installationExtraCost): 200,000원
- 합계: 700,000원

**예상 결과**:
```json
{
  "success": true,
  "data": {
    "installation_costs": 700000,  // ✅ 합계
    "net_profit": "...",  // (매출 - 매입 - 영업비 - 실사비 - 700,000)
    "cost_breakdown": {
      "total_installation_costs": 500000,  // 기본 설치비
      "installation_extra_cost": 200000,   // 추가설치비
      "installation_costs": { ... }  // 기기별 상세
    }
  }
}
```

### 2. 월 마감 집계 검증

**기존 데이터 재계산 필요**:
```sql
-- 기존 레코드의 installation_costs에 추가설치비 반영 확인
SELECT
  business_name,
  installation_costs,  -- DB 저장값
  (cost_breakdown->>'total_installation_costs')::numeric as base_install,
  (cost_breakdown->>'installation_extra_cost')::numeric as extra_install,
  (cost_breakdown->>'total_installation_costs')::numeric +
  COALESCE((cost_breakdown->>'installation_extra_cost')::numeric, 0) as calculated_total
FROM revenue_calculations
WHERE installation_costs != (
  (cost_breakdown->>'total_installation_costs')::numeric +
  COALESCE((cost_breakdown->>'installation_extra_cost')::numeric, 0)
)
LIMIT 10;
```

**결과**: 기존 데이터는 재계산 필요

### 3. 기존 데이터 수정 (선택사항)

**방법 1**: 자동 계산 재실행
- 각 월의 "자동 계산" 버튼 클릭
- 모든 사업장 재계산

**방법 2**: SQL로 일괄 업데이트
```sql
-- 주의: cost_breakdown에 installation_extra_cost가 있는 경우에만
UPDATE revenue_calculations
SET
  installation_costs =
    (cost_breakdown->>'total_installation_costs')::numeric +
    COALESCE((cost_breakdown->>'installation_extra_cost')::numeric, 0),
  updated_at = NOW()
WHERE
  cost_breakdown ? 'installation_extra_cost'
  AND (cost_breakdown->>'installation_extra_cost')::numeric > 0
  AND installation_costs = (cost_breakdown->>'total_installation_costs')::numeric;
```

## 기대 효과

1. **정확한 설치비 집계**: 월 마감에서 실제 설치비 총액 정확히 표시
2. **데이터 일관성**: `net_profit` 계산과 `installation_costs` 저장값 일치
3. **투명성 유지**: `cost_breakdown`에서 기본/추가 구분 가능
4. **간단한 구현**: 스키마 변경 없이 한 줄 수정으로 해결

## 영향 범위

### 수정 필요 파일
1. `/app/api/revenue/calculate/route.ts` - Line 561 (필수)
2. `/sql/update_installation_costs_comment.sql` - 스키마 주석 (선택)

### 수정 불필요 (이미 정확함)
1. `/app/api/admin/monthly-closing/route.ts` - 집계 로직 (installation_costs 그대로 사용)
2. `/app/api/admin/monthly-closing/auto-calculate/route.ts` - 집계 로직
3. `/app/admin/monthly-closing/page.tsx` - UI (변경 없음)

## 다음 단계

1. ✅ 설계 문서 작성 완료
2. 🔄 `/app/api/revenue/calculate/route.ts` 수정
3. 🔄 빌드 및 테스트
4. 🔄 기존 데이터 재계산 (2025년 월마감)
5. 🔄 검증 쿼리 실행

## 관련 문서

- [월 마감 실사비용 추가](./monthly-closing-add-survey-costs.md)
- [월 마감 시스템 전체 수정 내역](./monthly-closing-all-fixes-summary.md)
