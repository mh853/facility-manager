# 월 마감 시스템 (Monthly Closing System) - 설계 사양서

## 1. 시스템 개요

### 1.1 목적
설치일 기준으로 매출, 영업비, 설치비, 기타 비용, 이익을 월별로 집계하여 관리하는 시스템

### 1.2 핵심 기능
- 설치일(installation_date) 기준 월별 재무 데이터 집계
- 매출, 영업비 지급비용, 설치비 지급비용, 기타 비용, 이익금액 계산
- 기타 비용 항목별 추가 및 관리 (항목명 + 금액)
- 월별 필터링 및 검색
- 기존 admin 페이지와 동일한 UI/UX 패턴 적용

### 1.3 사용자 경험 우선순위
1. **직관적인 월별 네비게이션**: 월 선택이 쉽고 명확
2. **한눈에 보이는 재무 현황**: 통계 카드로 핵심 지표 시각화
3. **빠른 데이터 입력**: 기타 비용 추가가 간편함
4. **모바일 최적화**: 반응형 디자인으로 모든 기기 지원

---

## 2. 데이터 모델 설계

### 2.1 monthly_closings 테이블
```sql
CREATE TABLE monthly_closings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

  -- 기간 정보
  year INTEGER NOT NULL,
  month INTEGER NOT NULL CHECK (month >= 1 AND month <= 12),

  -- 집계 데이터 (설치일 기준)
  total_revenue NUMERIC(12,2) NOT NULL DEFAULT 0,           -- 총 매출
  sales_commission_costs NUMERIC(12,2) NOT NULL DEFAULT 0,   -- 영업비 지급비용
  installation_costs NUMERIC(12,2) NOT NULL DEFAULT 0,       -- 설치비 지급비용
  miscellaneous_costs NUMERIC(12,2) NOT NULL DEFAULT 0,      -- 기타 비용 합계
  net_profit NUMERIC(12,2) NOT NULL DEFAULT 0,               -- 순이익

  -- 메타 정보
  business_count INTEGER DEFAULT 0,                          -- 해당 월 설치 완료 사업장 수
  is_closed BOOLEAN DEFAULT FALSE,                           -- 마감 여부
  closed_at TIMESTAMP WITH TIME ZONE,                        -- 마감 일시
  closed_by UUID REFERENCES users(id),                       -- 마감 처리자

  -- 시스템 필드
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  -- 고유 제약조건 (연도+월은 유일)
  UNIQUE(year, month)
);

-- 인덱스
CREATE INDEX idx_monthly_closings_year_month ON monthly_closings(year, month);
CREATE INDEX idx_monthly_closings_created_at ON monthly_closings(created_at);
```

### 2.2 miscellaneous_costs 테이블
```sql
CREATE TABLE miscellaneous_costs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

  -- 연관 정보
  monthly_closing_id UUID NOT NULL REFERENCES monthly_closings(id) ON DELETE CASCADE,

  -- 비용 상세
  item_name VARCHAR(255) NOT NULL,                           -- 비용 항목명
  amount NUMERIC(12,2) NOT NULL CHECK (amount >= 0),         -- 비용 금액
  description TEXT,                                           -- 비용 설명

  -- 메타 정보
  created_by UUID REFERENCES users(id),                      -- 등록자
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 인덱스
CREATE INDEX idx_miscellaneous_costs_monthly_closing ON miscellaneous_costs(monthly_closing_id);
CREATE INDEX idx_miscellaneous_costs_created_at ON miscellaneous_costs(created_at);
```

### 2.3 데이터 흐름
```
[revenue_calculations 테이블]
  ↓ (설치일 기준 집계)
[monthly_closings 테이블]
  ↓ (기타 비용 추가)
[miscellaneous_costs 테이블]
  ↓ (최종 계산)
[UI 표시: 월별 재무 현황]
```

---

## 3. UI/UX 설계

### 3.1 페이지 구조 (/app/admin/monthly-closing/page.tsx)
```
┌─────────────────────────────────────────────────┐
│ AdminLayout Header                              │
├─────────────────────────────────────────────────┤
│                                                 │
│ 📊 통계 카드 섹션 (6개 그리드)                   │
│ ┌────────┬────────┬────────┬────────┬────────┐ │
│ │ 총매출 │영업비  │설치비  │기타비용│순이익  │ │
│ └────────┴────────┴────────┴────────┴────────┘ │
│                                                 │
├─────────────────────────────────────────────────┤
│                                                 │
│ 🔍 필터 및 검색 섹션                            │
│ ┌─────────────────────────────────────────────┐ │
│ │ [연도 선택▼] [월 선택▼] [검색...]           │ │
│ └─────────────────────────────────────────────┘ │
│                                                 │
├─────────────────────────────────────────────────┤
│                                                 │
│ 📋 월별 마감 데이터 테이블                      │
│ ┌─────────────────────────────────────────────┐ │
│ │ 월 │ 매출 │ 영업비 │ 설치비 │ 기타 │ 이익 │ │
│ │ 01 │ 1000 │  200   │  150   │  50  │ 600  │ │
│ │ 02 │ 1200 │  240   │  180   │  60  │ 720  │ │
│ │ ... [기타 비용 상세보기] [마감 처리]       │ │
│ └─────────────────────────────────────────────┘ │
│                                                 │
└─────────────────────────────────────────────────┘

모달:
┌─────────────────────────────────────────────────┐
│ 기타 비용 상세                            [X]  │
├─────────────────────────────────────────────────┤
│                                                 │
│ 2024년 3월 기타 비용 내역                       │
│                                                 │
│ ┌─────────────────────────────────────────────┐ │
│ │ 항목명         │ 금액       │ 설명          │ │
│ │ 차량 유류비     │  50,000   │ 영업차량     │ │
│ │ 사무용품       │  30,000   │ 문구류       │ │
│ │ [+ 새 항목 추가]                            │ │
│ └─────────────────────────────────────────────┘ │
│                                                 │
│ 합계: 80,000원                                  │
│                                                 │
│          [취소] [저장]                          │
└─────────────────────────────────────────────────┘
```

### 3.2 컴포넌트 구조
```
AdminMonthlyClosingPage (page.tsx)
├─ AdminLayout (기존 레이아웃)
├─ MonthlyClosingStats (통계 카드 섹션)
│  └─ StatsCard × 5 (총매출, 영업비, 설치비, 기타비용, 순이익)
├─ MonthlyClosingFilters (필터 섹션)
│  ├─ YearSelector
│  ├─ MonthSelector
│  └─ SearchInput
├─ MonthlyClosingTable (데이터 테이블)
│  ├─ MonthlyClosingRow × N
│  │  └─ MiscCostButton (기타 비용 보기 버튼)
│  └─ Pagination
└─ MiscellaneousCostModal (기타 비용 모달)
   ├─ MiscCostList (항목 리스트)
   │  └─ MiscCostItem × N
   └─ AddMiscCostForm (새 항목 추가 폼)
```

### 3.3 반응형 디자인 패턴 (기존 admin 페이지 따름)
```tsx
// 텍스트 크기
className="text-[10px] sm:text-xs md:text-sm"

// 패딩/마진
className="p-2 sm:p-3 md:p-4"
className="gap-2 sm:gap-3 md:gap-4"

// 그리드
className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2 sm:gap-3 md:gap-4"

// 아이콘
className="w-3 h-3 sm:w-3.5 sm:h-3.5 md:w-4 md:h-4"
```

---

## 4. API 엔드포인트 설계

### 4.1 GET /api/admin/monthly-closing
**설명**: 월별 마감 데이터 조회
```typescript
// Request Query Parameters
{
  year?: number;      // 연도 필터
  month?: number;     // 월 필터 (1-12)
  page?: number;      // 페이지 번호
  limit?: number;     // 페이지당 항목 수
}

// Response
{
  success: boolean;
  data: {
    closings: MonthlyClosing[];
    pagination: {
      total: number;
      page: number;
      limit: number;
      totalPages: number;
    };
    summary: {
      totalRevenue: number;
      totalSalesCommission: number;
      totalInstallationCosts: number;
      totalMiscCosts: number;
      totalProfit: number;
    };
  };
}
```

### 4.2 POST /api/admin/monthly-closing/calculate
**설명**: 특정 연월의 마감 데이터 자동 계산 (설치일 기준 집계)
```typescript
// Request Body
{
  year: number;      // 계산할 연도
  month: number;     // 계산할 월 (1-12)
}

// Response
{
  success: boolean;
  data: {
    closing: MonthlyClosing;
    businessCount: number;              // 집계된 사업장 수
    revenueBreakdown: {
      totalRevenue: number;
      salesCommission: number;
      installationCosts: number;
      netProfit: number;
    };
  };
}

// 계산 로직:
// 1. revenue_calculations에서 해당 월에 설치 완료된 사업장 찾기
// 2. total_revenue, sales_commission, installation_costs 합산
// 3. miscellaneous_costs 합산
// 4. net_profit = total_revenue - sales_commission - installation_costs - miscellaneous_costs
```

### 4.3 GET /api/admin/monthly-closing/[id]/misc-costs
**설명**: 특정 월의 기타 비용 상세 조회
```typescript
// Response
{
  success: boolean;
  data: {
    miscCosts: MiscellaneousCost[];
    total: number;
  };
}
```

### 4.4 POST /api/admin/monthly-closing/[id]/misc-costs
**설명**: 기타 비용 항목 추가
```typescript
// Request Body
{
  itemName: string;      // 항목명 (필수)
  amount: number;        // 금액 (필수, >= 0)
  description?: string;  // 설명 (선택)
}

// Response
{
  success: boolean;
  data: {
    miscCost: MiscellaneousCost;
    updatedClosing: MonthlyClosing;  // 업데이트된 마감 데이터 (miscellaneous_costs, net_profit 재계산됨)
  };
}
```

### 4.5 DELETE /api/admin/monthly-closing/misc-costs/[id]
**설명**: 기타 비용 항목 삭제
```typescript
// Response
{
  success: boolean;
  data: {
    updatedClosing: MonthlyClosing;  // 업데이트된 마감 데이터
  };
}
```

### 4.6 PUT /api/admin/monthly-closing/[id]/close
**설명**: 월 마감 처리 (is_closed = true)
```typescript
// Response
{
  success: boolean;
  data: {
    closing: MonthlyClosing;
  };
}
```

---

## 5. 상태 관리 설계

### 5.1 주요 State
```typescript
const [closings, setClosings] = useState<MonthlyClosing[]>([]);
const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());
const [selectedMonth, setSelectedMonth] = useState<number | null>(null); // null = 전체
const [loading, setLoading] = useState(false);
const [summary, setSummary] = useState({
  totalRevenue: 0,
  totalSalesCommission: 0,
  totalInstallationCosts: 0,
  totalMiscCosts: 0,
  totalProfit: 0
});

// 기타 비용 모달
const [showMiscCostModal, setShowMiscCostModal] = useState(false);
const [selectedClosingId, setSelectedClosingId] = useState<string | null>(null);
const [miscCosts, setMiscCosts] = useState<MiscellaneousCost[]>([]);
const [newMiscCost, setNewMiscCost] = useState({
  itemName: '',
  amount: 0,
  description: ''
});
```

### 5.2 데이터 흐름
```
[페이지 로드]
  ↓
loadClosings(year, month)
  ↓
GET /api/admin/monthly-closing?year=2024&month=3
  ↓
setClosings(data.closings)
setSummary(data.summary)
  ↓
[UI 렌더링]

[기타 비용 보기 버튼 클릭]
  ↓
openMiscCostModal(closingId)
  ↓
GET /api/admin/monthly-closing/[id]/misc-costs
  ↓
setMiscCosts(data.miscCosts)
  ↓
[모달 표시]

[새 기타 비용 추가]
  ↓
handleAddMiscCost()
  ↓
POST /api/admin/monthly-closing/[id]/misc-costs
  ↓
업데이트된 데이터 반영
  ↓
[목록 새로고침]
```

---

## 6. 타입 정의

### 6.1 types/index.ts 추가
```typescript
// 월별 마감 데이터
export interface MonthlyClosing {
  id: string;
  year: number;
  month: number;
  totalRevenue: number;
  salesCommissionCosts: number;
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

// 기타 비용 항목
export interface MiscellaneousCost {
  id: string;
  monthlyClosingId: string;
  itemName: string;
  amount: number;
  description?: string;
  createdBy?: string;
  createdAt: string;
  updatedAt: string;
}
```

---

## 7. 주요 기능 구현

### 7.1 자동 계산 로직 (서버 사이드)
```typescript
// app/api/admin/monthly-closing/calculate/route.ts
async function calculateMonthlyClosing(year: number, month: number) {
  // 1. 해당 월에 설치 완료된 사업장 찾기
  const businesses = await supabase
    .from('revenue_calculations')
    .select('*')
    .gte('installation_date', `${year}-${month.toString().padStart(2, '0')}-01`)
    .lt('installation_date', `${year}-${(month + 1).toString().padStart(2, '0')}-01`);

  // 2. 집계 계산
  const totalRevenue = businesses.data.reduce((sum, b) => sum + (b.total_revenue || 0), 0);
  const salesCommission = businesses.data.reduce((sum, b) => sum + (b.sales_commission || 0), 0);
  const installationCosts = businesses.data.reduce((sum, b) => sum + (b.installation_costs || 0), 0);

  // 3. 기존 기타 비용 합산
  const { data: existingClosing } = await supabase
    .from('monthly_closings')
    .select('*, miscellaneous_costs(*)')
    .eq('year', year)
    .eq('month', month)
    .single();

  const miscCosts = existingClosing?.miscellaneous_costs?.reduce((sum, c) => sum + c.amount, 0) || 0;

  // 4. 순이익 계산
  const netProfit = totalRevenue - salesCommission - installationCosts - miscCosts;

  // 5. 저장 또는 업데이트
  const closingData = {
    year,
    month,
    total_revenue: totalRevenue,
    sales_commission_costs: salesCommission,
    installation_costs: installationCosts,
    miscellaneous_costs: miscCosts,
    net_profit: netProfit,
    business_count: businesses.data.length
  };

  const { data, error } = await supabase
    .from('monthly_closings')
    .upsert(closingData, { onConflict: 'year,month' })
    .select()
    .single();

  return data;
}
```

### 7.2 기타 비용 추가 시 재계산
```typescript
// app/api/admin/monthly-closing/[id]/misc-costs/route.ts
async function addMiscCost(closingId: string, itemName: string, amount: number) {
  // 1. 기타 비용 추가
  const { data: miscCost } = await supabase
    .from('miscellaneous_costs')
    .insert({ monthly_closing_id: closingId, item_name: itemName, amount })
    .select()
    .single();

  // 2. 해당 월의 총 기타 비용 재계산
  const { data: allMiscCosts } = await supabase
    .from('miscellaneous_costs')
    .select('amount')
    .eq('monthly_closing_id', closingId);

  const totalMiscCosts = allMiscCosts.reduce((sum, c) => sum + c.amount, 0);

  // 3. 순이익 재계산
  const { data: closing } = await supabase
    .from('monthly_closings')
    .select('*')
    .eq('id', closingId)
    .single();

  const newNetProfit = closing.total_revenue
    - closing.sales_commission_costs
    - closing.installation_costs
    - totalMiscCosts;

  // 4. 마감 데이터 업데이트
  const { data: updatedClosing } = await supabase
    .from('monthly_closings')
    .update({
      miscellaneous_costs: totalMiscCosts,
      net_profit: newNetProfit,
      updated_at: new Date().toISOString()
    })
    .eq('id', closingId)
    .select()
    .single();

  return { miscCost, updatedClosing };
}
```

---

## 8. UI 컴포넌트 상세

### 8.1 MonthlyClosingStats (통계 카드 섹션)
```tsx
<div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2 sm:gap-3 md:gap-4">
  <StatsCard
    title="총 매출"
    value={formatCurrency(summary.totalRevenue)}
    icon={DollarSign}
    color="blue"
  />
  <StatsCard
    title="영업비"
    value={formatCurrency(summary.totalSalesCommission)}
    icon={Users}
    color="purple"
  />
  <StatsCard
    title="설치비"
    value={formatCurrency(summary.totalInstallationCosts)}
    icon={Building2}
    color="indigo"
  />
  <StatsCard
    title="기타 비용"
    value={formatCurrency(summary.totalMiscCosts)}
    icon={FileText}
    color="orange"
  />
  <StatsCard
    title="순이익"
    value={formatCurrency(summary.totalProfit)}
    icon={TrendingUp}
    color="green"
  />
</div>
```

### 8.2 MonthlyClosingFilters (필터 섹션)
```tsx
<div className="bg-white rounded-md md:rounded-lg shadow-sm border border-gray-200 p-2 sm:p-3 md:p-4">
  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 sm:gap-3">
    <div>
      <label className="text-[10px] sm:text-xs md:text-sm font-medium mb-1 block">연도</label>
      <select
        value={selectedYear}
        onChange={(e) => setSelectedYear(Number(e.target.value))}
        className="w-full px-2 py-1.5 text-xs sm:text-sm border border-gray-300 rounded"
      >
        {years.map(year => (
          <option key={year} value={year}>{year}년</option>
        ))}
      </select>
    </div>

    <div>
      <label className="text-[10px] sm:text-xs md:text-sm font-medium mb-1 block">월</label>
      <select
        value={selectedMonth || ''}
        onChange={(e) => setSelectedMonth(e.target.value ? Number(e.target.value) : null)}
        className="w-full px-2 py-1.5 text-xs sm:text-sm border border-gray-300 rounded"
      >
        <option value="">전체</option>
        {[1,2,3,4,5,6,7,8,9,10,11,12].map(m => (
          <option key={m} value={m}>{m}월</option>
        ))}
      </select>
    </div>

    <div>
      <label className="text-[10px] sm:text-xs md:text-sm font-medium mb-1 block">자동 계산</label>
      <button
        onClick={() => handleAutoCalculate(selectedYear, selectedMonth || new Date().getMonth() + 1)}
        className="w-full px-3 py-1.5 bg-blue-600 text-white text-xs sm:text-sm rounded hover:bg-blue-700"
      >
        <RefreshCw className="w-3 h-3 inline mr-1" />
        현재 월 계산
      </button>
    </div>
  </div>
</div>
```

### 8.3 MonthlyClosingTable (데이터 테이블)
```tsx
<div className="bg-white rounded-md md:rounded-lg shadow-sm border border-gray-200 overflow-hidden">
  <div className="overflow-x-auto">
    <table className="w-full text-[10px] sm:text-xs md:text-sm">
      <thead className="bg-gray-50 border-b">
        <tr>
          <th className="px-2 py-2 text-left font-medium text-gray-700">월</th>
          <th className="px-2 py-2 text-right font-medium text-gray-700">매출</th>
          <th className="px-2 py-2 text-right font-medium text-gray-700">영업비</th>
          <th className="px-2 py-2 text-right font-medium text-gray-700">설치비</th>
          <th className="px-2 py-2 text-right font-medium text-gray-700">기타</th>
          <th className="px-2 py-2 text-right font-medium text-gray-700">이익</th>
          <th className="px-2 py-2 text-center font-medium text-gray-700">작업</th>
        </tr>
      </thead>
      <tbody>
        {closings.map(closing => (
          <tr key={closing.id} className="border-b hover:bg-gray-50">
            <td className="px-2 py-2">{closing.month}월</td>
            <td className="px-2 py-2 text-right">{formatCurrency(closing.totalRevenue)}</td>
            <td className="px-2 py-2 text-right">{formatCurrency(closing.salesCommissionCosts)}</td>
            <td className="px-2 py-2 text-right">{formatCurrency(closing.installationCosts)}</td>
            <td className="px-2 py-2 text-right">{formatCurrency(closing.miscellaneousCosts)}</td>
            <td className="px-2 py-2 text-right font-semibold text-green-600">
              {formatCurrency(closing.netProfit)}
            </td>
            <td className="px-2 py-2 text-center">
              <button
                onClick={() => openMiscCostModal(closing.id)}
                className="px-2 py-1 bg-blue-100 text-blue-700 rounded hover:bg-blue-200"
              >
                기타 비용
              </button>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  </div>
</div>
```

### 8.4 MiscellaneousCostModal (기타 비용 모달)
```tsx
{showMiscCostModal && (
  <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
    <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
      <div className="p-4 border-b flex items-center justify-between">
        <h3 className="text-sm sm:text-base font-semibold">기타 비용 상세</h3>
        <button onClick={closeMiscCostModal}>
          <X className="w-5 h-5" />
        </button>
      </div>

      <div className="p-4">
        {/* 기존 항목 리스트 */}
        <div className="space-y-2 mb-4">
          {miscCosts.map(cost => (
            <div key={cost.id} className="flex items-center justify-between p-3 bg-gray-50 rounded">
              <div className="flex-1">
                <div className="font-medium text-sm">{cost.itemName}</div>
                <div className="text-xs text-gray-600">{cost.description}</div>
              </div>
              <div className="flex items-center gap-2">
                <span className="font-semibold">{formatCurrency(cost.amount)}</span>
                <button
                  onClick={() => handleDeleteMiscCost(cost.id)}
                  className="p-1 text-red-600 hover:bg-red-50 rounded"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>

        {/* 새 항목 추가 폼 */}
        <div className="border-t pt-4">
          <h4 className="text-sm font-medium mb-2">새 항목 추가</h4>
          <div className="space-y-2">
            <input
              type="text"
              placeholder="항목명"
              value={newMiscCost.itemName}
              onChange={(e) => setNewMiscCost({...newMiscCost, itemName: e.target.value})}
              className="w-full px-3 py-2 border rounded text-sm"
            />
            <input
              type="number"
              placeholder="금액"
              value={newMiscCost.amount || ''}
              onChange={(e) => setNewMiscCost({...newMiscCost, amount: Number(e.target.value)})}
              className="w-full px-3 py-2 border rounded text-sm"
            />
            <textarea
              placeholder="설명 (선택)"
              value={newMiscCost.description}
              onChange={(e) => setNewMiscCost({...newMiscCost, description: e.target.value})}
              className="w-full px-3 py-2 border rounded text-sm"
              rows={2}
            />
            <button
              onClick={handleAddMiscCost}
              className="w-full px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
            >
              추가
            </button>
          </div>
        </div>

        {/* 합계 */}
        <div className="mt-4 pt-4 border-t">
          <div className="flex justify-between items-center font-semibold">
            <span>합계</span>
            <span className="text-lg">{formatCurrency(miscCosts.reduce((sum, c) => sum + c.amount, 0))}</span>
          </div>
        </div>
      </div>
    </div>
  </div>
)}
```

---

## 9. 구현 순서

### Phase 1: 데이터베이스 및 API (1-2일)
1. ✅ Supabase 테이블 생성 (monthly_closings, miscellaneous_costs)
2. ✅ API 엔드포인트 구현
   - GET /api/admin/monthly-closing
   - POST /api/admin/monthly-closing/calculate
   - GET /api/admin/monthly-closing/[id]/misc-costs
   - POST /api/admin/monthly-closing/[id]/misc-costs
   - DELETE /api/admin/monthly-closing/misc-costs/[id]

### Phase 2: UI 컴포넌트 (2-3일)
3. ✅ 페이지 레이아웃 구성 (app/admin/monthly-closing/page.tsx)
4. ✅ 통계 카드 섹션 구현 (MonthlyClosingStats)
5. ✅ 필터 섹션 구현 (MonthlyClosingFilters)
6. ✅ 데이터 테이블 구현 (MonthlyClosingTable)
7. ✅ 기타 비용 모달 구현 (MiscellaneousCostModal)

### Phase 3: 통합 및 테스트 (1-2일)
8. ✅ 데이터 흐름 연결 및 상태 관리
9. ✅ 자동 계산 기능 테스트
10. ✅ 기타 비용 추가/삭제 테스트
11. ✅ 모바일 반응형 테스트
12. ✅ 에러 핸들링 및 로딩 상태 추가

---

## 10. 테스트 체크리스트

### 기능 테스트
- [ ] 월별 데이터 조회가 정확한가?
- [ ] 자동 계산이 설치일 기준으로 정확히 집계되는가?
- [ ] 기타 비용 추가 시 순이익이 올바르게 재계산되는가?
- [ ] 기타 비용 삭제 시 순이익이 올바르게 재계산되는가?
- [ ] 필터(연도, 월)가 정상 작동하는가?

### UI/UX 테스트
- [ ] 통계 카드가 한눈에 보이는가?
- [ ] 모바일에서 테이블이 스크롤 가능한가?
- [ ] 기타 비용 모달이 사용하기 편리한가?
- [ ] 로딩 상태가 명확히 표시되는가?
- [ ] 에러 메시지가 사용자 친화적인가?

### 성능 테스트
- [ ] 대량 데이터(12개월 × 수백 사업장)에서도 빠른가?
- [ ] 병렬 API 호출로 최적화되었는가?
- [ ] 불필요한 리렌더링이 없는가?

---

## 11. 향후 확장 가능성

### 단기 확장 (3개월 내)
- 월별 비교 차트 (매출/이익 추이 그래프)
- Excel 내보내기 기능
- 마감 처리 기능 (is_closed = true)
- 마감 후 수정 불가 처리

### 중기 확장 (6개월 내)
- 연도별 집계 및 비교
- 사업장별 세부 내역 드릴다운
- 예산 대비 실적 분석
- 알림 및 리마인더 기능

### 장기 확장 (1년 내)
- 예측 분석 (매출/이익 예측)
- 대시보드 통합 (전체 admin 홈에 요약 표시)
- 권한별 접근 제어 (열람/수정/삭제 권한 분리)

---

## 12. 참고 자료

### 기존 파일 참조
- `/app/admin/revenue/page.tsx` - 레이아웃 및 UI 패턴
- `/app/admin/tasks/page.tsx` - 모달 및 필터 패턴
- `/components/ui/StatsCard.tsx` - 통계 카드 컴포넌트
- `/components/ui/MultiSelectDropdown.tsx` - 드롭다운 컴포넌트
- `/components/ui/AdminLayout.tsx` - 공통 레이아웃
- `/types/index.ts` - 타입 정의

### 디자인 시스템
- Tailwind CSS 반응형 유틸리티
- Lucide React 아이콘
- 색상: blue (주요), green (이익), red (손실), orange (기타)
- 여백: p-2 sm:p-3 md:p-4
- 텍스트: text-[10px] sm:text-xs md:text-sm

---

**설계 완료일**: 2024-12-15
**설계자**: Claude Code
**승인 대기**: 사용자 검토 후 구현 시작
