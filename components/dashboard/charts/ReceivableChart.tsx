'use client'

import { useState, useEffect } from 'react'
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ReferenceLine
} from 'recharts'
import { ReceivableData, ReceivableSummary, DashboardFilters } from '@/types/dashboard'
import { RefreshCw } from 'lucide-react'
import MonthDetailModal from '../modals/MonthDetailModal'
import { determineAggregationLevel, getCurrentTimeKey } from '@/lib/dashboard-utils'

interface ReceivableChartProps {
  filters?: DashboardFilters;
}

export default function ReceivableChart({ filters }: ReceivableChartProps) {
  const [data, setData] = useState<ReceivableData[]>([]);
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState<ReceivableSummary | null>(null);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [selectedMonthData, setSelectedMonthData] = useState<any>(null);

  useEffect(() => {
    loadData();
  }, [filters]);

  const loadData = async () => {
    try {
      setLoading(true);

      // 기간 필터 파라미터 구성
      const periodParams: Record<string, string> = {};

      // startDate/endDate가 있으면 우선 사용 (빠른 필터 지원)
      if (filters?.startDate && filters?.endDate) {
        // YYYY-MM-DD 형식 그대로 전달 (API에서 자동으로 집계 단위 결정)
        periodParams.startDate = filters.startDate;
        periodParams.endDate = filters.endDate;
      } else if (filters?.periodMode === 'custom') {
        if (filters.startDate) periodParams.startDate = filters.startDate;
        if (filters.endDate) periodParams.endDate = filters.endDate;
      } else if (filters?.periodMode === 'yearly') {
        periodParams.year = String(filters.year || new Date().getFullYear());
      } else {
        // recent 모드 (기본값)
        periodParams.months = String(filters?.months || 12);
      }

      const params = new URLSearchParams({
        ...periodParams,
        ...(filters?.office && { office: filters.office }),
        ...(filters?.manufacturer && { manufacturer: filters.manufacturer }),
        ...(filters?.salesOffice && { salesOffice: filters.salesOffice }),
        ...(filters?.progressStatus && { progressStatus: filters.progressStatus })
      });

      const response = await fetch(`/api/dashboard/receivables?${params}`);
      const result = await response.json();

      if (result.success) {
        setData(result.data);
        setSummary(result.summary);
        setLastUpdate(new Date());
      }
    } catch (error) {
      console.error('Failed to load receivable data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleBarClick = (event: any) => {
    if (event && event.activeLabel) {
      const clickedMonth = event.activeLabel;
      const clickedData = data.find((item: any) => item.month === clickedMonth);

      if (clickedData) {
        setSelectedMonthData({
          month: clickedData.month,
          type: 'receivable',
          data: clickedData
        });
        setIsDetailModalOpen(true);
      }
    }
  };

  const formatCurrency = (value: number) => {
    if (value >= 100000000) {
      return `${(value / 100000000).toFixed(1)}억`;
    }
    return `${(value / 10000).toFixed(0)}만`;
  };

  // 현재 시점 계산
  const getCurrentTimePoint = () => {
    if (!filters) return null;

    // 집계 레벨 결정
    let aggregationLevel: 'daily' | 'weekly' | 'monthly' = 'monthly';

    if (filters.startDate && filters.endDate) {
      aggregationLevel = determineAggregationLevel(filters.startDate, filters.endDate);
    } else if (filters.periodMode === 'yearly' || filters.periodMode === 'recent' || !filters.periodMode) {
      aggregationLevel = 'monthly';
    }

    return getCurrentTimeKey(aggregationLevel);
  };

  const currentTimeKey = getCurrentTimePoint();

  // X축 레이블 포맷 함수
  const formatXAxisLabel = (value: string) => {
    // YYYY-MM-DD 형식 (일별): MM/DD로 변환
    if (value.match(/^\d{4}-\d{2}-\d{2}$/)) {
      const [, month, day] = value.split('-');
      return `${month}/${day}`;
    }
    // YYYY-Www 형식 (주별): ww주차로 변환
    if (value.match(/^\d{4}-W\d{2}$/)) {
      const weekNum = value.split('-W')[1];
      return `${weekNum}주`;
    }
    // 그 외 (월별): 그대로 표시
    return value;
  };

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="bg-white p-4 border border-gray-200 rounded-lg shadow-lg">
          <p className="font-bold mb-2">{label}</p>
          {payload.map((entry: any, index: number) => (
            <p key={index} style={{ color: entry.color }} className="text-sm">
              {entry.name}: {entry.value.toLocaleString()}원
            </p>
          ))}
          <div className="mt-2 pt-2 border-t border-gray-200">
            <p className="text-sm text-gray-600">
              회수율: {data.collectionRate.toFixed(1)}%
            </p>
            {data.prevMonthChange !== 0 && (
              <p className={`text-sm ${data.prevMonthChange > 0 ? 'text-red-600' : 'text-green-600'}`}>
                전월 대비: {data.prevMonthChange > 0 ? '+' : ''}{data.prevMonthChange.toFixed(1)}%
              </p>
            )}
          </div>
        </div>
      );
    }
    return null;
  };

  if (loading) {
    return (
      <div className="bg-white p-6 rounded-lg shadow">
        <div className="h-8 bg-gray-200 rounded w-48 mb-4 animate-pulse" />
        <div className="h-80 bg-gray-100 rounded animate-pulse" />
      </div>
    );
  }

  return (
    <div className="bg-white p-4 md:p-6 rounded-lg shadow">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-4 gap-2">
        <h2 className="text-lg md:text-xl font-bold">월별 미수금 현황</h2>
        <div className="flex items-center gap-2">
          {lastUpdate && (
            <span className="text-xs text-gray-500">
              {lastUpdate.toLocaleTimeString()}
            </span>
          )}
          <button
            onClick={loadData}
            disabled={loading}
            className="px-3 py-1.5 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:opacity-50 flex items-center gap-1 text-sm"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            <span className="hidden sm:inline">새로고침</span>
          </button>
        </div>
      </div>

      {summary && (
        <div className="grid grid-cols-2 gap-3 mb-4">
          <div className="bg-red-50 p-3 rounded">
            <p className="text-xs text-gray-600">총 미수금</p>
            <p className="text-base md:text-lg font-bold text-red-600">
              {summary.totalOutstanding.toLocaleString()}원
            </p>
          </div>
          <div className="bg-green-50 p-3 rounded">
            <p className="text-xs text-gray-600">평균 회수율</p>
            <p className="text-base md:text-lg font-bold text-green-600">
              {summary.avgCollectionRate}%
            </p>
          </div>
        </div>
      )}

      <ResponsiveContainer width="100%" height={320}>
        <AreaChart data={data} onClick={handleBarClick}>
          <defs>
            <linearGradient id="colorOutstanding" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#ef4444" stopOpacity={0.8}/>
              <stop offset="95%" stopColor="#ef4444" stopOpacity={0.1}/>
            </linearGradient>
            <linearGradient id="colorCollected" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#10b981" stopOpacity={0.8}/>
              <stop offset="95%" stopColor="#10b981" stopOpacity={0.1}/>
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis
            dataKey="month"
            tickFormatter={formatXAxisLabel}
            tick={{ fontSize: 12 }}
            angle={-45}
            textAnchor="end"
            height={80}
          />
          <YAxis
            tickFormatter={formatCurrency}
            tick={{ fontSize: 12 }}
          />
          <Tooltip content={<CustomTooltip />} />
          <Legend
            wrapperStyle={{ fontSize: '14px' }}
            iconType="square"
          />

          {/* 현재 시점 강조 */}
          {currentTimeKey && data.some(d => d.month === currentTimeKey) && (
            <ReferenceLine
              x={currentTimeKey}
              stroke="#ef4444"
              strokeWidth={2}
              strokeDasharray="5 5"
              label={{ value: '현재', position: 'top', fontSize: 11, fill: '#ef4444', fontWeight: 'bold' }}
            />
          )}

          <Area
            type="monotone"
            dataKey="outstanding"
            stroke="#ef4444"
            fillOpacity={1}
            fill="url(#colorOutstanding)"
            name="미수금"
            cursor="pointer"
          />
          <Area
            type="monotone"
            dataKey="collected"
            stroke="#10b981"
            fillOpacity={1}
            fill="url(#colorCollected)"
            name="회수금"
            cursor="pointer"
          />
        </AreaChart>
      </ResponsiveContainer>

      {data.length === 0 && !loading && (
        <div className="text-center text-gray-500 py-8">
          데이터가 없습니다.
        </div>
      )}

      {/* 월별 상세보기 모달 */}
      <MonthDetailModal
        isOpen={isDetailModalOpen}
        onClose={() => setIsDetailModalOpen(false)}
        monthData={selectedMonthData}
      />
    </div>
  );
}
