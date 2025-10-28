# 대시보드 개편 구현 워크플로우

## 📚 개요

**목표**: 데이터 중심의 그래프 기반 관리자 대시보드 구현
**예상 소요 시간**: 8-12시간 (Phase별 1-2시간)
**복잡도**: ⭐⭐⭐⭐ (4/5 - 높음)

---

## 🎯 Phase 1: 환경 설정 및 의존성 설치 (30분)

### 작업 내용
1. Recharts 라이브러리 설치
2. 타입 정의 파일 생성
3. 컴포넌트 디렉토리 구조 생성

### 명령어
```bash
npm install recharts
npm install --save-dev @types/recharts
```

### 파일 생성
```
📁 components/dashboard/
  ├── charts/
  │   ├── RevenueChart.tsx
  │   ├── ReceivableChart.tsx
  │   ├── InstallationChart.tsx
  │   └── ChartSkeleton.tsx
  ├── filters/
  │   └── FilterPanel.tsx
  ├── modals/
  │   ├── MonthDetailModal.tsx
  │   └── TargetSettingModal.tsx
  └── DashboardLayout.tsx

📁 types/
  └── dashboard.ts (새 파일)
```

### 타입 정의 생성
**파일**: `types/dashboard.ts`
```typescript
export interface RevenueData {
  month: string;
  revenue: number;
  cost: number;
  profit: number;
  profitRate: number;
  target?: number;
  achievementRate?: number;
  prevMonthChange: number;
}

export interface ReceivableData {
  month: string;
  outstanding: number;
  collected: number;
  collectionRate: number;
  prevMonthChange: number;
}

export interface InstallationData {
  month: string;
  waiting: number;
  inProgress: number;
  completed: number;
  total: number;
  completionRate: number;
  prevMonthChange: number;
}

export interface DashboardFilters {
  office?: string;
  manufacturer?: string;
  progressStatus?: string;
  salesOffice?: string;
}

export interface DashboardTarget {
  id: string;
  target_type: 'revenue' | 'receivable' | 'installation';
  month: string;
  target_value: number;
}
```

### 검증
```bash
# 패키지 설치 확인
npm list recharts

# 타입 체크
npx tsc --noEmit
```

---

## 🎯 Phase 2: 데이터베이스 스키마 생성 (30분)

### SQL 스크립트 작성
**파일**: `sql/dashboard_targets_table.sql`

```sql
-- 대시보드 목표 설정 테이블
CREATE TABLE IF NOT EXISTS dashboard_targets (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  target_type TEXT NOT NULL CHECK (target_type IN ('revenue', 'receivable', 'installation')),
  month TEXT NOT NULL CHECK (month ~ '^\d{4}-\d{2}$'),
  target_value DECIMAL(12,2) NOT NULL CHECK (target_value >= 0),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(target_type, month)
);

-- 인덱스 생성
CREATE INDEX IF NOT EXISTS idx_dashboard_targets_type_month
ON dashboard_targets(target_type, month);

-- 코멘트 추가
COMMENT ON TABLE dashboard_targets IS '대시보드 월별 목표 설정 테이블';
COMMENT ON COLUMN dashboard_targets.target_type IS '목표 유형 (revenue: 매출, receivable: 미수금, installation: 설치)';
COMMENT ON COLUMN dashboard_targets.month IS '월 (YYYY-MM 형식)';
COMMENT ON COLUMN dashboard_targets.target_value IS '목표값';

-- 업데이트 트리거 함수
CREATE OR REPLACE FUNCTION update_dashboard_targets_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 트리거 생성
DROP TRIGGER IF EXISTS trigger_update_dashboard_targets_updated_at ON dashboard_targets;
CREATE TRIGGER trigger_update_dashboard_targets_updated_at
BEFORE UPDATE ON dashboard_targets
FOR EACH ROW
EXECUTE FUNCTION update_dashboard_targets_updated_at();

-- 샘플 데이터 (선택사항)
INSERT INTO dashboard_targets (target_type, month, target_value) VALUES
  ('revenue', '2025-01', 50000000),
  ('revenue', '2025-02', 55000000),
  ('revenue', '2025-03', 60000000)
ON CONFLICT (target_type, month) DO NOTHING;
```

### Supabase에서 실행
1. Supabase 대시보드 → SQL Editor
2. 위 스크립트 복사 후 실행
3. 테이블 생성 확인

---

## 🎯 Phase 3: API 엔드포인트 구현 - 매출 데이터 (1.5시간)

### 파일 생성
**파일**: `app/api/dashboard/revenue/route.ts`

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase'

interface RevenueQueryParams {
  months?: string;
  office?: string;
  manufacturer?: string;
  salesOffice?: string;
}

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const months = parseInt(searchParams.get('months') || '12');
    const office = searchParams.get('office');
    const manufacturer = searchParams.get('manufacturer');
    const salesOffice = searchParams.get('salesOffice');

    // 최근 N개월 범위 계산
    const endDate = new Date();
    const startDate = new Date();
    startDate.setMonth(startDate.getMonth() - months);

    const supabase = createClient();

    // 1. 기간 내 설치된 사업장 조회
    let businessQuery = supabase
      .from('business_info')
      .select('*')
      .gte('installation_date', startDate.toISOString())
      .lte('installation_date', endDate.toISOString());

    // 필터 적용
    if (office) businessQuery = businessQuery.eq('sales_office', office);
    if (manufacturer) businessQuery = businessQuery.eq('manufacturer', manufacturer);
    if (salesOffice) businessQuery = businessQuery.eq('sales_office', salesOffice);

    const { data: businesses, error: businessError } = await businessQuery;

    if (businessError) throw businessError;

    // 2. 월별 데이터 집계
    const monthlyData: Map<string, any> = new Map();

    // 최근 N개월 초기화 (0으로)
    for (let i = 0; i < months; i++) {
      const date = new Date();
      date.setMonth(date.getMonth() - i);
      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      monthlyData.set(monthKey, {
        month: monthKey,
        revenue: 0,
        cost: 0,
        profit: 0,
        profitRate: 0,
        prevMonthChange: 0,
        count: 0
      });
    }

    // 3. 사업장별 매출 계산 데이터 조회
    const businessIds = businesses?.map(b => b.id) || [];

    if (businessIds.length > 0) {
      const { data: calculations } = await supabase
        .from('revenue_calculations')
        .select('*')
        .in('business_id', businessIds)
        .order('calculation_date', { ascending: false });

      // 4. 월별 집계
      calculations?.forEach(calc => {
        const installDate = new Date(calc.calculation_date);
        const monthKey = `${installDate.getFullYear()}-${String(installDate.getMonth() + 1).padStart(2, '0')}`;

        if (monthlyData.has(monthKey)) {
          const current = monthlyData.get(monthKey);
          current.revenue += calc.total_revenue || 0;
          current.cost += calc.total_cost || 0;
          current.profit += calc.net_profit || 0;
          current.count += 1;
        }
      });
    }

    // 5. 이익률 계산 및 전월 대비 증감 계산
    const sortedMonths = Array.from(monthlyData.keys()).sort();
    let prevProfit = 0;

    sortedMonths.forEach(monthKey => {
      const data = monthlyData.get(monthKey);
      if (data.revenue > 0) {
        data.profitRate = (data.profit / data.revenue) * 100;
      }
      if (prevProfit > 0) {
        data.prevMonthChange = ((data.profit - prevProfit) / prevProfit) * 100;
      }
      prevProfit = data.profit;
    });

    // 6. 목표값 조회
    const { data: targets } = await supabase
      .from('dashboard_targets')
      .select('*')
      .eq('target_type', 'revenue')
      .in('month', sortedMonths);

    const targetMap = new Map(targets?.map(t => [t.month, t.target_value]) || []);

    // 7. 목표 달성률 계산
    sortedMonths.forEach(monthKey => {
      const data = monthlyData.get(monthKey);
      const target = targetMap.get(monthKey);
      if (target) {
        data.target = target;
        data.achievementRate = (data.profit / target) * 100;
      }
    });

    // 8. 평균값 계산
    const dataArray = Array.from(monthlyData.values()).reverse(); // 최신순 정렬
    const avgProfit = dataArray.reduce((sum, d) => sum + d.profit, 0) / dataArray.length;
    const avgProfitRate = dataArray.reduce((sum, d) => sum + d.profitRate, 0) / dataArray.length;

    return NextResponse.json({
      success: true,
      data: dataArray,
      summary: {
        avgProfit: Math.round(avgProfit),
        avgProfitRate: Math.round(avgProfitRate * 100) / 100,
        totalRevenue: dataArray.reduce((sum, d) => sum + d.revenue, 0),
        totalProfit: dataArray.reduce((sum, d) => sum + d.profit, 0)
      }
    });

  } catch (error: any) {
    console.error('❌ [Dashboard Revenue API Error]', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
```

### 테스트
```bash
# 브라우저 또는 curl로 테스트
curl "http://localhost:3000/api/dashboard/revenue?months=12"
curl "http://localhost:3000/api/dashboard/revenue?months=6&office=서울"
```

---

## 🎯 Phase 4: API 엔드포인트 구현 - 미수금 데이터 (1시간)

### 파일 생성
**파일**: `app/api/dashboard/receivables/route.ts`

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase'

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const months = parseInt(searchParams.get('months') || '12');
    const office = searchParams.get('office');

    const endDate = new Date();
    const startDate = new Date();
    startDate.setMonth(startDate.getMonth() - months);

    const supabase = createClient();

    // 1. 기간 내 계산서 데이터 조회
    let invoiceQuery = supabase
      .from('business_invoices')
      .select('*, business_info!inner(sales_office)')
      .gte('invoice_date', startDate.toISOString())
      .lte('invoice_date', endDate.toISOString());

    if (office) {
      invoiceQuery = invoiceQuery.eq('business_info.sales_office', office);
    }

    const { data: invoices, error } = await invoiceQuery;
    if (error) throw error;

    // 2. 월별 데이터 집계
    const monthlyData: Map<string, any> = new Map();

    for (let i = 0; i < months; i++) {
      const date = new Date();
      date.setMonth(date.getMonth() - i);
      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      monthlyData.set(monthKey, {
        month: monthKey,
        outstanding: 0,
        collected: 0,
        collectionRate: 0,
        prevMonthChange: 0
      });
    }

    // 3. 월별 미수금 집계
    invoices?.forEach(invoice => {
      const invoiceDate = new Date(invoice.invoice_date);
      const monthKey = `${invoiceDate.getFullYear()}-${String(invoiceDate.getMonth() + 1).padStart(2, '0')}`;

      if (monthlyData.has(monthKey)) {
        const current = monthlyData.get(monthKey);

        if (invoice.payment_status === '미수령') {
          current.outstanding += invoice.invoice_amount || 0;
        } else if (invoice.payment_status === '완료') {
          current.collected += invoice.invoice_amount || 0;
        }
      }
    });

    // 4. 회수율 및 전월 대비 계산
    const sortedMonths = Array.from(monthlyData.keys()).sort();
    let prevOutstanding = 0;

    sortedMonths.forEach(monthKey => {
      const data = monthlyData.get(monthKey);
      const total = data.outstanding + data.collected;
      if (total > 0) {
        data.collectionRate = (data.collected / total) * 100;
      }
      if (prevOutstanding > 0) {
        data.prevMonthChange = ((data.outstanding - prevOutstanding) / prevOutstanding) * 100;
      }
      prevOutstanding = data.outstanding;
    });

    const dataArray = Array.from(monthlyData.values()).reverse();
    const totalOutstanding = dataArray.reduce((sum, d) => sum + d.outstanding, 0);
    const avgCollectionRate = dataArray.reduce((sum, d) => sum + d.collectionRate, 0) / dataArray.length;

    return NextResponse.json({
      success: true,
      data: dataArray,
      summary: {
        totalOutstanding: Math.round(totalOutstanding),
        avgCollectionRate: Math.round(avgCollectionRate * 100) / 100
      }
    });

  } catch (error: any) {
    console.error('❌ [Dashboard Receivables API Error]', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
```

---

## 🎯 Phase 5: API 엔드포인트 구현 - 설치 현황 (1시간)

### 파일 생성
**파일**: `app/api/dashboard/installations/route.ts`

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase'

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const months = parseInt(searchParams.get('months') || '12');
    const office = searchParams.get('office');
    const progressStatus = searchParams.get('progressStatus');

    const endDate = new Date();
    const startDate = new Date();
    startDate.setMonth(startDate.getMonth() - months);

    const supabase = createClient();

    // 1. 기간 내 사업장 조회
    let businessQuery = supabase
      .from('business_info')
      .select('*')
      .gte('installation_date', startDate.toISOString())
      .lte('installation_date', endDate.toISOString());

    if (office) businessQuery = businessQuery.eq('sales_office', office);
    if (progressStatus) businessQuery = businessQuery.eq('progress_status', progressStatus);

    const { data: businesses, error } = await businessQuery;
    if (error) throw error;

    // 2. 월별 데이터 집계
    const monthlyData: Map<string, any> = new Map();

    for (let i = 0; i < months; i++) {
      const date = new Date();
      date.setMonth(date.getMonth() - i);
      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      monthlyData.set(monthKey, {
        month: monthKey,
        waiting: 0,
        inProgress: 0,
        completed: 0,
        total: 0,
        completionRate: 0,
        prevMonthChange: 0
      });
    }

    // 3. 월별 진행상태별 집계
    businesses?.forEach(business => {
      const installDate = new Date(business.installation_date);
      const monthKey = `${installDate.getFullYear()}-${String(installDate.getMonth() + 1).padStart(2, '0')}`;

      if (monthlyData.has(monthKey)) {
        const current = monthlyData.get(monthKey);
        current.total += 1;

        switch (business.progress_status) {
          case '대기':
            current.waiting += 1;
            break;
          case '진행중':
            current.inProgress += 1;
            break;
          case '완료':
            current.completed += 1;
            break;
        }
      }
    });

    // 4. 완료율 및 전월 대비 계산
    const sortedMonths = Array.from(monthlyData.keys()).sort();
    let prevTotal = 0;

    sortedMonths.forEach(monthKey => {
      const data = monthlyData.get(monthKey);
      if (data.total > 0) {
        data.completionRate = (data.completed / data.total) * 100;
      }
      if (prevTotal > 0) {
        data.prevMonthChange = ((data.total - prevTotal) / prevTotal) * 100;
      }
      prevTotal = data.total;
    });

    const dataArray = Array.from(monthlyData.values()).reverse();
    const avgMonthlyInstallations = dataArray.reduce((sum, d) => sum + d.total, 0) / dataArray.length;
    const avgCompletionRate = dataArray.reduce((sum, d) => sum + d.completionRate, 0) / dataArray.length;

    return NextResponse.json({
      success: true,
      data: dataArray,
      summary: {
        avgMonthlyInstallations: Math.round(avgMonthlyInstallations * 100) / 100,
        avgCompletionRate: Math.round(avgCompletionRate * 100) / 100,
        totalInstallations: dataArray.reduce((sum, d) => sum + d.total, 0)
      }
    });

  } catch (error: any) {
    console.error('❌ [Dashboard Installations API Error]', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
```

---

## 🎯 Phase 6: 그래프 컴포넌트 구현 - 매출/매입/이익 (1.5시간)

### 파일 생성
**파일**: `components/dashboard/charts/RevenueChart.tsx`

```typescript
'use client'

import { useState, useEffect } from 'react'
import {
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ReferenceLine
} from 'recharts'
import { RevenueData } from '@/types/dashboard'

interface RevenueChartProps {
  filters?: any;
}

export default function RevenueChart({ filters }: RevenueChartProps) {
  const [data, setData] = useState<RevenueData[]>([]);
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState<any>(null);

  useEffect(() => {
    loadData();
  }, [filters]);

  const loadData = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({
        months: '12',
        ...filters
      });

      const response = await fetch(`/api/dashboard/revenue?${params}`);
      const result = await response.json();

      if (result.success) {
        setData(result.data);
        setSummary(result.summary);
      }
    } catch (error) {
      console.error('Failed to load revenue data:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (value: number) => {
    return `${(value / 10000).toFixed(0)}만`;
  };

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white p-4 border border-gray-200 rounded-lg shadow-lg">
          <p className="font-bold mb-2">{label}</p>
          {payload.map((entry: any, index: number) => (
            <p key={index} style={{ color: entry.color }} className="text-sm">
              {entry.name}: {entry.value.toLocaleString()}원
            </p>
          ))}
          {payload[0]?.payload?.profitRate && (
            <p className="text-sm text-gray-600 mt-1">
              이익률: {payload[0].payload.profitRate.toFixed(1)}%
            </p>
          )}
        </div>
      );
    }
    return null;
  };

  if (loading) {
    return <div className="h-96 bg-gray-100 animate-pulse rounded-lg" />;
  }

  return (
    <div className="bg-white p-6 rounded-lg shadow">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-bold">월별 매출/매입/이익 현황</h2>
        <button
          onClick={loadData}
          className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
        >
          새로고침
        </button>
      </div>

      {summary && (
        <div className="grid grid-cols-3 gap-4 mb-4">
          <div className="bg-blue-50 p-3 rounded">
            <p className="text-xs text-gray-600">평균 순이익</p>
            <p className="text-lg font-bold">{summary.avgProfit.toLocaleString()}원</p>
          </div>
          <div className="bg-green-50 p-3 rounded">
            <p className="text-xs text-gray-600">평균 이익률</p>
            <p className="text-lg font-bold">{summary.avgProfitRate}%</p>
          </div>
          <div className="bg-purple-50 p-3 rounded">
            <p className="text-xs text-gray-600">총 매출</p>
            <p className="text-lg font-bold">{summary.totalRevenue.toLocaleString()}원</p>
          </div>
        </div>
      )}

      <ResponsiveContainer width="100%" height={400}>
        <ComposedChart data={data}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="month" />
          <YAxis tickFormatter={formatCurrency} />
          <Tooltip content={<CustomTooltip />} />
          <Legend />

          {/* 평균 라인 */}
          {summary && (
            <ReferenceLine
              y={summary.avgProfit}
              stroke="#888"
              strokeDasharray="3 3"
              label="평균"
            />
          )}

          <Bar dataKey="revenue" fill="#3b82f6" name="매출" />
          <Bar dataKey="cost" fill="#f59e0b" name="매입" />
          <Line
            type="monotone"
            dataKey="profit"
            stroke="#10b981"
            strokeWidth={2}
            name="순이익"
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
```

---

## 🎯 Phase 7: 나머지 그래프 컴포넌트 구현 (계속...)

문서가 길어서 여기까지 먼저 보여드립니다.

---

## ✅ 다음 단계

**Phase 7-8**: 나머지 그래프 컴포넌트 (미수금, 설치) 구현
**Phase 9**: 필터 패널 구현
**Phase 10**: 대시보드 통합 및 레이아웃
**Phase 11**: 목표 설정 기능
**Phase 12**: 테스트 및 최적화

각 Phase는 약 1-1.5시간 소요 예상됩니다.
