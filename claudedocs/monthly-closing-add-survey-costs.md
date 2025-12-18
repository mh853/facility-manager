# 월 마감 시스템에 실사비용 항목 추가

## 목적

월 마감 데이터에 실사비용(survey_costs) 항목을 추가하여 비용 구조의 투명성과 신뢰성을 향상시킵니다.

## 현재 문제

### 매출 계산 API (revenue_calculations 테이블)
실사비용이 **포함**되어 있음:
```typescript
순이익 = 매출 - 매입 - 추가설치비 - 영업비용 - 실사비용 - 설치비용
```

**실제 데이터 (무계바이오 예시)**:
- 매출: 900,000원
- 실사비용: 100,000원
- 순이익: 800,000원

**비용 항목 설명**:
- **영업비용**: `adjusted_sales_commission` 우선, 없으면 `sales_commission` 사용 (조정 반영)
- **실사비용**: `survey_costs` (이미 조정 반영된 최종값)
- **설치비용**: `installation_costs` (기본 설치비 + 추가설치비 합계)

### 월 마감 시스템 (monthly_closings 테이블)
실사비용 항목이 **누락**되어 있음:

**현재 컬럼**:
- `total_revenue` (총 매출)
- `total_cost` (총 매입금액)
- `sales_commission_costs` (영업비 - 조정 반영)
- `installation_costs` (설치비 - 기본+추가 합계)
- `miscellaneous_costs` (기타 비용)
- `net_profit` (순이익)

**누락**: `survey_costs` (실사비용 - 조정 반영)

## 설계

### 1. 데이터베이스 스키마 변경

**파일**: `/sql/monthly_closings_add_survey_costs.sql` (새 파일)

```sql
-- Add survey_costs column to monthly_closings table
ALTER TABLE monthly_closings
ADD COLUMN IF NOT EXISTS survey_costs NUMERIC(12,2) NOT NULL DEFAULT 0;

-- Add comment for documentation
COMMENT ON COLUMN monthly_closings.survey_costs IS '총 실사비용: revenue_calculations.survey_costs의 합계';
```

### 2. TypeScript 타입 정의 업데이트

**파일**: `/types/index.ts`

**변경 위치**: `MonthlyClosing` interface (약 Line 208)

```typescript
export interface MonthlyClosing {
  id: string;
  year: number;
  month: number;
  totalRevenue: number;
  totalCost: number;
  salesCommissionCosts: number;
  surveyCosts: number;  // ✅ 추가
  installationCosts: number;
  miscellaneousCosts: number;
  netProfit: number;
  businessCount: number;
  isClosed: boolean;
  closedAt?: string;
  closedBy?: string;
  createdAt: string;
  updatedAt: string;
}
```

### 3. Backend API 수정

#### 3.1. GET /api/admin/monthly-closing

**파일**: `/app/api/admin/monthly-closing/route.ts`

**변경 1**: 전체 통계 계산 (Line 73-98)
```typescript
// SELECT 쿼리에 survey_costs 추가
const { data: allClosings } = await supabase
  .from('monthly_closings')
  .select('total_revenue, total_cost, sales_commission_costs, survey_costs, installation_costs, miscellaneous_costs, net_profit');

// summary reduce에 surveyCosts 추가
const summary = allClosings?.reduce((acc, closing) => ({
  totalRevenue: acc.totalRevenue + (Number(closing.total_revenue) || 0),
  totalCost: acc.totalCost + (Number(closing.total_cost) || 0),
  totalSalesCommission: acc.totalSalesCommission + (Number(closing.sales_commission_costs) || 0),
  totalSurveyCosts: acc.totalSurveyCosts + (Number(closing.survey_costs) || 0),  // ✅ 추가
  totalInstallationCosts: acc.totalInstallationCosts + (Number(closing.installation_costs) || 0),
  totalMiscCosts: acc.totalMiscCosts + (Number(closing.miscellaneous_costs) || 0),
  totalProfit: acc.totalProfit + (Number(closing.net_profit) || 0)
}), {
  totalRevenue: 0,
  totalCost: 0,
  totalSalesCommission: 0,
  totalSurveyCosts: 0,  // ✅ 추가
  totalInstallationCosts: 0,
  totalMiscCosts: 0,
  totalProfit: 0
});
```

**변경 2**: 월별 마감 데이터 응답 매핑 (Line 104-120)
```typescript
closings: closings?.map(c => ({
  id: c.id,
  year: c.year,
  month: c.month,
  totalRevenue: Number(c.total_revenue) || 0,
  totalCost: Number(c.total_cost) || 0,
  salesCommissionCosts: Number(c.sales_commission_costs) || 0,
  surveyCosts: Number(c.survey_costs) || 0,  // ✅ 추가
  installationCosts: Number(c.installation_costs) || 0,
  miscellaneousCosts: Number(c.miscellaneous_costs) || 0,
  netProfit: Number(c.net_profit) || 0,
  businessCount: c.business_count || 0,
  isClosed: c.is_closed || false,
  closedAt: c.closed_at,
  closedBy: c.closed_by,
  createdAt: c.created_at,
  updatedAt: c.updated_at
})) || []
```

#### 3.2. POST /api/admin/monthly-closing

**파일**: `/app/api/admin/monthly-closing/route.ts`

**변경 1**: 사업장 데이터 조회 (Line 183-187)
```typescript
const { data: businesses, error: businessError } = await supabase
  .from('revenue_calculations')
  .select('total_revenue, total_cost, sales_commission, survey_costs, installation_costs, adjusted_sales_commission')  // ✅ survey_costs 추가
  .gte('calculation_date', startDate)
  .lt('calculation_date', endDate);
```

**변경 2**: 실사비용 집계 (Line 197-204 이후)
```typescript
// 2. 집계 계산
const totalRevenue = businesses?.reduce((sum, b) => sum + (Number(b.total_revenue) || 0), 0) || 0;
const totalCost = businesses?.reduce((sum, b) => sum + (Number(b.total_cost) || 0), 0) || 0;
const salesCommission = businesses?.reduce((sum, b) =>
  sum + (Number(b.adjusted_sales_commission) || Number(b.sales_commission) || 0), 0) || 0;
const surveyCosts = businesses?.reduce((sum, b) =>
  sum + (Number(b.survey_costs) || 0), 0) || 0;  // ✅ 추가
const installationCosts = businesses?.reduce((sum, b) =>
  sum + (Number(b.installation_costs) || 0), 0) || 0;
```

**변경 3**: 저장 데이터 (Line 226-237)
```typescript
const closingData = {
  year,
  month,
  total_revenue: totalRevenue,
  total_cost: totalCost,
  sales_commission_costs: salesCommission,
  survey_costs: surveyCosts,  // ✅ 추가
  installation_costs: installationCosts,
  miscellaneous_costs: miscCosts,
  net_profit: netProfit,
  business_count: businesses?.length || 0,
  updated_at: new Date().toISOString()
};
```

**변경 4**: 응답 데이터 (Line 255-280)
```typescript
return NextResponse.json({
  success: true,
  data: {
    closing: {
      id: data.id,
      year: data.year,
      month: data.month,
      totalRevenue: Number(data.total_revenue) || 0,
      totalCost: Number(data.total_cost) || 0,
      salesCommissionCosts: Number(data.sales_commission_costs) || 0,
      surveyCosts: Number(data.survey_costs) || 0,  // ✅ 추가
      installationCosts: Number(data.installation_costs) || 0,
      miscellaneousCosts: Number(data.miscellaneous_costs) || 0,
      netProfit: Number(data.net_profit) || 0,
      businessCount: data.business_count || 0,
      isClosed: data.is_closed || false,
      createdAt: data.created_at,
      updatedAt: data.updated_at
    },
    businessCount: businesses?.length || 0,
    revenueBreakdown: {
      totalRevenue,
      totalCost,
      salesCommission,
      surveyCosts,  // ✅ 추가
      installationCosts,
      miscCosts,
      netProfit
    }
  }
});
```

#### 3.3. POST /api/admin/monthly-closing/auto-calculate

**파일**: `/app/api/admin/monthly-closing/auto-calculate/route.ts`

**변경 1**: 집계 데이터 조회 (Line 202-206)
```typescript
const { data: revenueData, error: revenueError } = await supabase
  .from('revenue_calculations')
  .select('total_revenue, total_cost, sales_commission, survey_costs, installation_costs, adjusted_sales_commission')  // ✅ survey_costs 추가
  .gte('calculation_date', startDate)
  .lt('calculation_date', endDate);
```

**변경 2**: 실사비용 집계 (Line 214-220 이후)
```typescript
const totalRevenue = revenueData?.reduce((sum, b) => sum + (Number(b.total_revenue) || 0), 0) || 0;
const totalCost = revenueData?.reduce((sum, b) => sum + (Number(b.total_cost) || 0), 0) || 0;
const salesCommission = revenueData?.reduce((sum, b) =>
  sum + (Number(b.adjusted_sales_commission) || Number(b.sales_commission) || 0), 0) || 0;
const surveyCosts = revenueData?.reduce((sum, b) =>
  sum + (Number(b.survey_costs) || 0), 0) || 0;  // ✅ 추가
const installationCosts = revenueData?.reduce((sum, b) =>
  sum + (Number(b.installation_costs) || 0), 0) || 0;
```

**변경 3**: 월 마감 저장 (Line 189-202)
```typescript
const { error: upsertError } = await supabase
  .from('monthly_closings')
  .upsert({
    year,
    month,
    total_revenue: totalRevenue,
    total_cost: totalCost,
    sales_commission_costs: salesCommission,
    survey_costs: surveyCosts,  // ✅ 추가
    installation_costs: installationCosts,
    miscellaneous_costs: miscCosts,
    net_profit: netProfit,
    business_count: revenueData?.length || 0,
    updated_at: new Date().toISOString()
  }, { onConflict: 'year,month' });
```

#### 3.4. GET /api/admin/monthly-closing/[id]/details

**파일**: `/app/api/admin/monthly-closing/[id]/details/route.ts`

**변경 1**: 사업장 상세 조회 (Line 61-77)
```typescript
const { data: revenueData, error: revenueError } = await supabase
  .from('revenue_calculations')
  .select(`
    id,
    business_id,
    business_name,
    calculation_date,
    total_revenue,
    total_cost,
    gross_profit,
    sales_commission,
    adjusted_sales_commission,
    survey_costs,
    installation_costs,
    net_profit,
    created_at
  `)
  .gte('calculation_date', startDate)
  .lt('calculation_date', endDate)
  .order('calculation_date', { ascending: true });
```

**변경 2**: 응답 매핑 (Line 91-104)
```typescript
const details = revenueData?.map(d => ({
  id: d.id,
  businessId: d.business_id,
  businessName: d.business_name,
  calculationDate: d.calculation_date,
  totalRevenue: Number(d.total_revenue) || 0,
  totalCost: Number(d.total_cost) || 0,
  grossProfit: Number(d.gross_profit) || 0,
  salesCommission: Number(d.adjusted_sales_commission) || Number(d.sales_commission) || 0,
  surveyCosts: Number(d.survey_costs) || 0,  // ✅ 추가
  installationCosts: Number(d.installation_costs) || 0,
  netProfit: Number(d.net_profit) || 0,
  createdAt: d.created_at
})) || [];
```

**변경 3**: closing 데이터 (Line 109-121)
```typescript
closing: {
  id: closing.id,
  year: closing.year,
  month: closing.month,
  totalRevenue: Number(closing.total_revenue) || 0,
  totalCost: Number(closing.total_cost) || 0,
  salesCommissionCosts: Number(closing.sales_commission_costs) || 0,
  surveyCosts: Number(closing.survey_costs) || 0,  // ✅ 추가
  installationCosts: Number(closing.installation_costs) || 0,
  miscellaneousCosts: Number(closing.miscellaneous_costs) || 0,
  netProfit: Number(closing.net_profit) || 0,
  businessCount: closing.business_count || 0
}
```

### 4. Frontend UI 수정

**파일**: `/app/admin/monthly-closing/page.tsx`

#### 4.1. State 업데이트

**변경**: summary state (약 Line 37-62)
```typescript
const [summary, setSummary] = useState({
  totalRevenue: 0,
  totalCost: 0,
  totalSalesCommission: 0,
  totalSurveyCosts: 0,  // ✅ 추가
  totalInstallationCosts: 0,
  totalMiscCosts: 0,
  totalProfit: 0
});
```

#### 4.2. loadClosings 함수 수정

**변경**: fallback 객체 (약 Line 100-107)
```typescript
setSummary(data.data.summary || {
  totalRevenue: 0,
  totalCost: 0,
  totalSalesCommission: 0,
  totalSurveyCosts: 0,  // ✅ 추가
  totalInstallationCosts: 0,
  totalMiscCosts: 0,
  totalProfit: 0
});
```

#### 4.3. 통계 카드 추가

**변경**: StatsCard 그리드 (약 Line 345-382)
```typescript
<div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-7 gap-2">  {/* 6 → 7 */}
  <StatsCard title="총 매출" value={formatCurrency(summary.totalRevenue)} icon={DollarSign} color="blue" />
  <StatsCard title="매입금액" value={formatCurrency(summary.totalCost)} icon={FileText} color="gray" />
  <StatsCard title="영업비" value={formatCurrency(summary.totalSalesCommission)} icon={Users} color="purple" />
  <StatsCard title="실사비용" value={formatCurrency(summary.totalSurveyCosts)} icon={ClipboardCheck} color="cyan" />  {/* ✅ 추가 */}
  <StatsCard title="설치비" value={formatCurrency(summary.totalInstallationCosts)} icon={Building2} color="indigo" />
  <StatsCard title="기타 비용" value={formatCurrency(summary.totalMiscCosts)} icon={FileText} color="orange" />
  <StatsCard title="순이익" value={formatCurrency(summary.totalProfit)} icon={TrendingUp} color="green" />
</div>
```

**아이콘 import 추가** (파일 상단):
```typescript
import { DollarSign, Users, Building2, FileText, TrendingUp, Calendar, ClipboardCheck } from 'lucide-react';  // ClipboardCheck 추가
```

#### 4.4. 테이블 컬럼 추가

**변경**: 테이블 헤더 (약 Line 481-490)
```typescript
<thead>
  <tr className="bg-gray-50 text-xs">
    <th className="px-2 py-2 text-left font-semibold text-gray-600">월</th>
    <th className="px-2 py-2 text-right font-semibold text-gray-600">매출</th>
    <th className="hidden md:table-cell px-2 py-2 text-right font-semibold text-gray-600">매입</th>
    <th className="hidden sm:table-cell px-2 py-2 text-right font-semibold text-gray-600">영업비</th>
    <th className="hidden lg:table-cell px-2 py-2 text-right font-semibold text-gray-600">실사비용</th>  {/* ✅ 추가 */}
    <th className="hidden sm:table-cell px-2 py-2 text-right font-semibold text-gray-600">설치비</th>
    <th className="px-2 py-2 text-right font-semibold text-gray-600">기타</th>
    <th className="px-2 py-2 text-right font-semibold text-gray-600">이익</th>
    <th className="px-2 py-2 text-center font-semibold text-gray-600">작업</th>
  </tr>
</thead>
```

**변경**: 테이블 데이터 행 (약 Line 520-562)
```typescript
<tr
  key={closing.id}
  className="border-b hover:bg-gray-50 cursor-pointer text-xs"
  onClick={() => openDetailModal(closing)}
>
  <td className="px-2 py-2 text-left">{closing.month}월 ({closing.businessCount}개)</td>
  <td className="px-2 py-2 text-right">{formatCurrency(closing.totalRevenue)}</td>
  <td className="hidden md:table-cell px-2 py-2 text-right">{formatCurrency(closing.totalCost)}</td>
  <td className="hidden sm:table-cell px-2 py-2 text-right">{formatCurrency(closing.salesCommissionCosts)}</td>
  <td className="hidden lg:table-cell px-2 py-2 text-right">{formatCurrency(closing.surveyCosts)}</td>  {/* ✅ 추가 */}
  <td className="hidden sm:table-cell px-2 py-2 text-right">{formatCurrency(closing.installationCosts)}</td>
  <td className="px-2 py-2 text-right">{formatCurrency(closing.miscellaneousCosts)}</td>
  <td className="px-2 py-2 text-right">{formatCurrency(closing.netProfit)}</td>
  <td className="px-2 py-2 text-center">
    <button
      onClick={(e) => {
        e.stopPropagation();
        openMiscCostModal(closing.id, closing.year, closing.month);
      }}
      className="text-xs px-2 py-1 bg-orange-500 text-white rounded hover:bg-orange-600"
    >
      기타 비용
    </button>
  </td>
</tr>
```

#### 4.5. 상세 모달 UI 업데이트

**변경 1**: Summary 카드 (약 Line 669-720)
```typescript
<div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-7 gap-2 p-3 sm:p-4">  {/* 6 → 7 */}
  <div className="bg-blue-50 p-2 sm:p-3 rounded">
    <p className="text-xs text-gray-600">총 매출</p>
    <p className="text-sm sm:text-base font-semibold text-blue-700">{formatCurrency(detailClosing.totalRevenue)}</p>
  </div>
  <div className="bg-gray-50 p-2 sm:p-3 rounded">
    <p className="text-xs text-gray-600">매입금액</p>
    <p className="text-sm sm:text-base font-semibold text-gray-700">{formatCurrency(detailClosing.totalCost)}</p>
  </div>
  <div className="bg-purple-50 p-2 sm:p-3 rounded">
    <p className="text-xs text-gray-600">영업비</p>
    <p className="text-sm sm:text-base font-semibold text-purple-700">{formatCurrency(detailClosing.salesCommissionCosts)}</p>
  </div>
  <div className="bg-cyan-50 p-2 sm:p-3 rounded">  {/* ✅ 추가 */}
    <p className="text-xs text-gray-600">실사비용</p>
    <p className="text-sm sm:text-base font-semibold text-cyan-700">{formatCurrency(detailClosing.surveyCosts)}</p>
  </div>
  <div className="bg-indigo-50 p-2 sm:p-3 rounded">
    <p className="text-xs text-gray-600">설치비</p>
    <p className="text-sm sm:text-base font-semibold text-indigo-700">{formatCurrency(detailClosing.installationCosts)}</p>
  </div>
  <div className="bg-orange-50 p-2 sm:p-3 rounded">
    <p className="text-xs text-gray-600">기타 비용</p>
    <p className="text-sm sm:text-base font-semibold text-orange-700">{formatCurrency(detailClosing.miscellaneousCosts)}</p>
  </div>
  <div className="bg-green-50 p-2 sm:p-3 rounded">
    <p className="text-xs text-gray-600">순이익</p>
    <p className="text-sm sm:text-base font-semibold text-green-700">{formatCurrency(detailClosing.netProfit)}</p>
  </div>
</div>
```

**변경 2**: 사업장 상세 테이블 (약 Line 730-770)
```typescript
<thead>
  <tr className="bg-gray-50 text-xs">
    <th className="px-2 py-2 text-left font-semibold text-gray-600">사업장명</th>
    <th className="hidden sm:table-cell px-2 py-2 text-center font-semibold text-gray-600">계산일</th>
    <th className="px-2 py-2 text-right font-semibold text-gray-600">매출</th>
    <th className="hidden md:table-cell px-2 py-2 text-right font-semibold text-gray-600">매입</th>
    <th className="hidden sm:table-cell px-2 py-2 text-right font-semibold text-gray-600">영업비</th>
    <th className="hidden lg:table-cell px-2 py-2 text-right font-semibold text-gray-600">실사비용</th>  {/* ✅ 추가 */}
    <th className="hidden sm:table-cell px-2 py-2 text-right font-semibold text-gray-600">설치비</th>
    <th className="px-2 py-2 text-right font-semibold text-gray-600">이익</th>
  </tr>
</thead>
<tbody>
  {detailBusinesses.map((business) => (
    <tr key={business.id} className="border-b hover:bg-gray-50 text-xs">
      <td className="px-2 py-2 text-left">{business.businessName}</td>
      <td className="hidden sm:table-cell px-2 py-2 text-center text-gray-500">
        {formatDate(business.calculationDate)}
      </td>
      <td className="px-2 py-2 text-right">{formatCurrency(business.totalRevenue)}</td>
      <td className="hidden md:table-cell px-2 py-2 text-right">{formatCurrency(business.totalCost)}</td>
      <td className="hidden sm:table-cell px-2 py-2 text-right">{formatCurrency(business.salesCommission)}</td>
      <td className="hidden lg:table-cell px-2 py-2 text-right">{formatCurrency(business.surveyCosts)}</td>  {/* ✅ 추가 */}
      <td className="hidden sm:table-cell px-2 py-2 text-right">{formatCurrency(business.installationCosts)}</td>
      <td className="px-2 py-2 text-right">{formatCurrency(business.netProfit)}</td>
    </tr>
  ))}
</tbody>
```

## 구현 순서

1. **데이터베이스 마이그레이션 실행**
   ```sql
   -- sql/monthly_closings_add_survey_costs.sql
   ALTER TABLE monthly_closings ADD COLUMN survey_costs...
   ```

2. **TypeScript 타입 업데이트**
   - `/types/index.ts`

3. **Backend API 수정**
   - `/app/api/admin/monthly-closing/route.ts` (GET, POST)
   - `/app/api/admin/monthly-closing/auto-calculate/route.ts`
   - `/app/api/admin/monthly-closing/[id]/details/route.ts`

4. **Frontend UI 수정**
   - `/app/admin/monthly-closing/page.tsx`

5. **빌드 및 테스트**
   ```bash
   npm run build
   ```

6. **2025년 월마감 재계산**
   - 기존 데이터에 survey_costs를 반영하기 위해 각 월 재계산 필요

## 검증

### 1. 데이터 검증
```sql
-- 특정 월의 실사비용 합계 확인
SELECT
  SUM(survey_costs) as total_survey_costs
FROM revenue_calculations
WHERE
  calculation_date >= '2025-01-01'
  AND calculation_date < '2025-02-01';

-- monthly_closings 테이블과 비교
SELECT survey_costs
FROM monthly_closings
WHERE year = 2025 AND month = 1;
```

### 2. UI 검증
- 통계 카드에 "실사비용" 표시 확인
- 테이블에 실사비용 컬럼 표시 확인 (lg 화면 이상)
- 상세 모달에서 실사비용 표시 확인
- 각 사업장별 실사비용 표시 확인

### 3. 무계바이오 검증
```
매출: 900,000원
매입: 0원 (원가 데이터 문제)
영업비: 0원
실사비용: 100,000원  ← 새로 표시됨
설치비: 0원
기타: 0원
이익: 800,000원 (900,000 - 100,000)
```

## 기대 효과

1. **투명성 향상**: 모든 비용 항목이 명확하게 표시됨
2. **신뢰성 향상**: 매출 계산과 월 마감의 데이터 일관성 유지
3. **분석 개선**: 실사비용 트렌드 및 비율 분석 가능
4. **의사결정 지원**: 정확한 비용 구조로 경영 의사결정 개선

## 관련 파일

- `/sql/monthly_closings_add_survey_costs.sql` - 스키마 마이그레이션
- `/types/index.ts` - TypeScript 타입 정의
- `/app/api/admin/monthly-closing/route.ts` - 월마감 GET/POST API
- `/app/api/admin/monthly-closing/auto-calculate/route.ts` - 자동 계산 API
- `/app/api/admin/monthly-closing/[id]/details/route.ts` - 상세 조회 API
- `/app/admin/monthly-closing/page.tsx` - 월마감 UI
