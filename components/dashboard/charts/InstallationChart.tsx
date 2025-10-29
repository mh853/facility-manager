'use client'

import { useState, useEffect } from 'react'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ReferenceLine
} from 'recharts'
import { InstallationData, InstallationSummary, DashboardFilters } from '@/types/dashboard'
import { RefreshCw } from 'lucide-react'
import MonthDetailModal from '../modals/MonthDetailModal'
import { determineAggregationLevel, getCurrentTimeKey } from '@/lib/dashboard-utils'

interface InstallationChartProps {
  filters?: DashboardFilters;
}

export default function InstallationChart({ filters }: InstallationChartProps) {
  const [data, setData] = useState<InstallationData[]>([]);
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState<InstallationSummary | null>(null);
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

      const response = await fetch(`/api/dashboard/installations?${params}`);
      const result = await response.json();

      if (result.success) {
        setData(result.data);
        setSummary(result.summary);
        setLastUpdate(new Date());
      }
    } catch (error) {
      console.error('Failed to load installation data:', error);
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
          type: 'installation',
          data: clickedData
        });
        setIsDetailModalOpen(true);
      }
    }
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
          <p className="text-sm text-gray-600">총 {data.total}건</p>
          <div className="mt-2 space-y-1">
            {payload.map((entry: any, index: number) => (
              <p key={index} style={{ color: entry.color }} className="text-sm">
                {entry.name}: {entry.value}건
              </p>
            ))}
          </div>
          <div className="mt-2 pt-2 border-t border-gray-200">
            <p className="text-sm text-gray-600">
              완료율: {data.completionRate.toFixed(1)}%
            </p>
            {data.prevMonthChange !== 0 && (
              <p className={`text-sm ${data.prevMonthChange > 0 ? 'text-green-600' : 'text-red-600'}`}>
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
        <h2 className="text-lg md:text-xl font-bold">월별 설치 현황</h2>
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
        <div className="space-y-3 mb-4">
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
            <div className="bg-blue-50 p-3 rounded">
              <p className="text-xs text-gray-600">월평균 설치</p>
              <p className="text-base md:text-lg font-bold">
                {summary.avgMonthlyInstallations}건
              </p>
            </div>
            <div className="bg-green-50 p-3 rounded">
              <p className="text-xs text-gray-600">평균 완료율</p>
              <p className="text-base md:text-lg font-bold text-green-600">
                {summary.avgCompletionRate}%
              </p>
            </div>
            <div className="bg-purple-50 p-3 rounded col-span-2 lg:col-span-1">
              <p className="text-xs text-gray-600">총 설치</p>
              <p className="text-base md:text-lg font-bold text-purple-600">
                {summary.totalInstallations}건
              </p>
            </div>
          </div>

          {/* 설치 상태 안내 */}
          <div className="bg-blue-50 border border-blue-200 p-3 rounded-lg">
            <p className="text-xs font-medium text-blue-900 mb-2">📋 설치 상태 구분</p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-2 text-xs text-blue-800">
              <div className="flex items-start gap-1.5">
                <span className="inline-block w-3 h-3 bg-gray-400 rounded mt-0.5"></span>
                <div>
                  <span className="font-medium">대기:</span>
                  <span className="ml-1">설치 예정</span>
                </div>
              </div>
              <div className="flex items-start gap-1.5">
                <span className="inline-block w-3 h-3 bg-yellow-400 rounded mt-0.5"></span>
                <div>
                  <span className="font-medium">진행중:</span>
                  <span className="ml-1">설치 완료, 준공실사 대기</span>
                </div>
              </div>
              <div className="flex items-start gap-1.5">
                <span className="inline-block w-3 h-3 bg-green-500 rounded mt-0.5"></span>
                <div>
                  <span className="font-medium">완료:</span>
                  <span className="ml-1">모든 작업 완료</span>
                </div>
              </div>
            </div>
            <p className="text-[10px] text-blue-700 mt-2">
              💡 자비/대리점/AS는 준공실사 없이 설치 완료 시 '완료'로 표시됩니다
            </p>
          </div>
        </div>
      )}

      <ResponsiveContainer width="100%" height={320}>
        <BarChart data={data} onClick={handleBarClick}>
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
            tick={{ fontSize: 12 }}
            label={{ value: '건수', angle: -90, position: 'insideLeft', fontSize: 12 }}
          />
          <Tooltip content={<CustomTooltip />} />
          <Legend
            wrapperStyle={{ fontSize: '14px' }}
            iconType="square"
          />

          {/* 평균 라인 */}
          {summary && (
            <ReferenceLine
              y={summary.avgMonthlyInstallations}
              stroke="#888"
              strokeDasharray="3 3"
              label={{ value: '평균', fontSize: 12, fill: '#888' }}
            />
          )}

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

          <Bar dataKey="waiting" stackId="a" fill="#9ca3af" name="대기" cursor="pointer" />
          <Bar dataKey="inProgress" stackId="a" fill="#fbbf24" name="진행중" cursor="pointer" />
          <Bar dataKey="completed" stackId="a" fill="#10b981" name="완료" cursor="pointer" />
        </BarChart>
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
