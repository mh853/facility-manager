'use client'

import { useState, useEffect } from 'react'
import { X, Calendar, TrendingUp, TrendingDown, Minus } from 'lucide-react'

interface MonthDetailData {
  month: string;
  type: 'revenue' | 'receivable' | 'installation';
  data: any;
}

interface MonthDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  monthData: MonthDetailData | null;
}

export default function MonthDetailModal({
  isOpen,
  onClose,
  monthData
}: MonthDetailModalProps) {
  if (!isOpen || !monthData) return null;

  const formatCurrency = (value: number) => {
    return `${value.toLocaleString()}원`;
  };

  const formatPercent = (value: number) => {
    const icon = value > 0 ? <TrendingUp className="w-4 h-4" /> :
                  value < 0 ? <TrendingDown className="w-4 h-4" /> :
                  <Minus className="w-4 h-4" />;
    const color = value > 0 ? 'text-green-600' :
                  value < 0 ? 'text-red-600' :
                  'text-gray-600';

    return (
      <div className={`flex items-center gap-1 ${color}`}>
        {icon}
        <span>{value > 0 ? '+' : ''}{value.toFixed(1)}%</span>
      </div>
    );
  };

  const renderRevenueDetail = () => {
    const data = monthData.data;
    return (
      <div className="space-y-4">
        {/* 주요 지표 */}
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-blue-50 p-4 rounded-lg">
            <p className="text-xs text-gray-600 mb-1">매출</p>
            <p className="text-xl font-bold text-blue-700">
              {formatCurrency(data.revenue)}
            </p>
            <p className="text-[10px] text-gray-500 mt-1">총 수익</p>
          </div>
          <div className="bg-orange-50 p-4 rounded-lg">
            <p className="text-xs text-gray-600 mb-1">매입</p>
            <p className="text-xl font-bold text-orange-700">
              {formatCurrency(data.cost)}
            </p>
            <p className="text-[10px] text-gray-500 mt-1">총 비용</p>
          </div>
          <div className="bg-green-50 p-4 rounded-lg">
            <p className="text-xs text-gray-600 mb-1">순이익</p>
            <p className="text-xl font-bold text-green-700">
              {formatCurrency(data.profit)}
            </p>
            <p className="text-[10px] text-gray-500 mt-1">매출 - 매입</p>
          </div>
          <div className="bg-purple-50 p-4 rounded-lg">
            <p className="text-xs text-gray-600 mb-1">이익률</p>
            <p className="text-xl font-bold text-purple-700">
              {data.profitRate.toFixed(1)}%
            </p>
            <p className="text-[10px] text-gray-500 mt-1">순이익 / 매출</p>
          </div>
        </div>

        {/* 목표 대비 */}
        {data.target && (
          <div className="bg-indigo-50 border border-indigo-200 p-4 rounded-lg">
            <p className="text-sm font-medium text-gray-700 mb-3">🎯 목표 대비</p>
            <div className="flex items-center justify-between mb-2">
              <div>
                <p className="text-xs text-gray-600">목표</p>
                <p className="font-bold">{formatCurrency(data.target)}</p>
              </div>
              <div className="text-right">
                <p className="text-xs text-gray-600">달성률</p>
                <p className={`font-bold text-lg ${
                  data.achievementRate >= 100 ? 'text-green-600' : 'text-orange-600'
                }`}>
                  {data.achievementRate.toFixed(1)}%
                </p>
              </div>
            </div>
            <div className="flex-1 bg-gray-200 rounded-full h-2">
              <div
                className={`h-2 rounded-full transition-all ${
                  data.achievementRate >= 100 ? 'bg-green-600' : 'bg-orange-600'
                }`}
                style={{ width: `${Math.min(data.achievementRate, 100)}%` }}
              />
            </div>
            {data.achievementRate >= 100 ? (
              <p className="text-xs text-green-600 mt-2">✓ 목표 달성!</p>
            ) : (
              <p className="text-xs text-orange-600 mt-2">
                목표까지 {formatCurrency(data.target - data.revenue)}
              </p>
            )}
          </div>
        )}

        {/* 통계 정보 */}
        <div className="border-t border-gray-200 pt-4 space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-sm text-gray-600">전월 대비 증감</p>
            {formatPercent(data.prevMonthChange)}
          </div>
          <div className="flex items-center justify-between">
            <p className="text-sm text-gray-600">사업장 수</p>
            <p className="font-medium">{data.count}개</p>
          </div>
          <div className="flex items-center justify-between">
            <p className="text-sm text-gray-600">사업장당 평균 매출</p>
            <p className="font-medium">
              {formatCurrency(data.count > 0 ? Math.round(data.revenue / data.count) : 0)}
            </p>
          </div>
        </div>
      </div>
    );
  };

  const renderReceivableDetail = () => {
    const data = monthData.data;
    const totalAmount = data.outstanding + data.collected;
    return (
      <div className="space-y-4">
        {/* 미수금/회수금 */}
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-red-50 p-4 rounded-lg">
            <p className="text-xs text-gray-600 mb-1">미수금</p>
            <p className="text-xl font-bold text-red-700">
              {formatCurrency(data.outstanding)}
            </p>
            <p className="text-[10px] text-gray-500 mt-1">미입금액</p>
          </div>
          <div className="bg-green-50 p-4 rounded-lg">
            <p className="text-xs text-gray-600 mb-1">회수금</p>
            <p className="text-xl font-bold text-green-700">
              {formatCurrency(data.collected)}
            </p>
            <p className="text-[10px] text-gray-500 mt-1">입금완료액</p>
          </div>
        </div>

        {/* 총 청구액 */}
        <div className="bg-gray-50 border border-gray-200 p-3 rounded-lg">
          <div className="flex items-center justify-between">
            <p className="text-sm text-gray-600">총 청구액</p>
            <p className="font-bold text-gray-900">
              {formatCurrency(totalAmount)}
            </p>
          </div>
          <p className="text-xs text-gray-500 mt-1">
            미수금 + 회수금
          </p>
        </div>

        {/* 회수율 */}
        <div className="bg-blue-50 border border-blue-200 p-4 rounded-lg">
          <p className="text-sm font-medium text-gray-700 mb-3">💰 회수율</p>
          <div className="flex items-center justify-between mb-2">
            <p className="text-2xl font-bold text-blue-700">
              {data.collectionRate.toFixed(1)}%
            </p>
            <div className="text-right text-xs text-gray-600">
              <p>{formatCurrency(data.collected)}</p>
              <p className="text-gray-500">/ {formatCurrency(totalAmount)}</p>
            </div>
          </div>
          <div className="flex-1 bg-gray-200 rounded-full h-2">
            <div
              className="bg-green-600 h-2 rounded-full transition-all"
              style={{ width: `${Math.min(data.collectionRate, 100)}%` }}
            />
          </div>
        </div>

        {/* 통계 정보 */}
        <div className="border-t border-gray-200 pt-4 space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-sm text-gray-600">전월 대비 미수금 증감</p>
            {formatPercent(data.prevMonthChange)}
          </div>
          <p className="text-xs text-gray-500 bg-yellow-50 p-2 rounded">
            💡 미수금 증가(빨간색↑)는 주의 필요, 감소(초록색↓)는 개선 중
          </p>
        </div>
      </div>
    );
  };

  const renderInstallationDetail = () => {
    const data = monthData.data;
    return (
      <div className="space-y-4">
        {/* 상태별 현황 */}
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-gray-100 p-4 rounded-lg">
            <p className="text-xs text-gray-600 mb-1">대기</p>
            <p className="text-xl font-bold text-gray-700">
              {data.waiting}건
            </p>
            <p className="text-[10px] text-gray-500 mt-1">설치 예정</p>
          </div>
          <div className="bg-yellow-50 p-4 rounded-lg">
            <p className="text-xs text-gray-600 mb-1">진행중</p>
            <p className="text-xl font-bold text-yellow-700">
              {data.inProgress}건
            </p>
            <p className="text-[10px] text-gray-500 mt-1">준공실사 대기</p>
          </div>
          <div className="bg-green-50 p-4 rounded-lg">
            <p className="text-xs text-gray-600 mb-1">완료</p>
            <p className="text-xl font-bold text-green-700">
              {data.completed}건
            </p>
            <p className="text-[10px] text-gray-500 mt-1">준공실사 완료</p>
          </div>
          <div className="bg-blue-50 p-4 rounded-lg">
            <p className="text-xs text-gray-600 mb-1">전체</p>
            <p className="text-xl font-bold text-blue-700">
              {data.total}건
            </p>
          </div>
        </div>

        {/* 상태 설명 */}
        <div className="bg-blue-50 border border-blue-200 p-3 rounded-lg">
          <p className="text-xs font-medium text-blue-900 mb-2">📋 설치 상태 구분</p>
          <div className="space-y-1.5 text-xs text-blue-800">
            <div className="flex items-start gap-2">
              <span className="font-medium min-w-[48px]">대기:</span>
              <span>사업장 등록 완료, 설치 미시작</span>
            </div>
            <div className="flex items-start gap-2">
              <span className="font-medium min-w-[48px]">진행중:</span>
              <span>설치 완료, 준공실사 대기 중 (보조금)</span>
            </div>
            <div className="flex items-start gap-2">
              <span className="font-medium min-w-[48px]">완료:</span>
              <span>모든 작업 완료</span>
            </div>
          </div>
          <p className="text-[10px] text-blue-700 mt-2 pt-2 border-t border-blue-200">
            💡 <strong>진행구분별 완료 기준:</strong><br/>
            • 보조금: 설치 + 준공실사 완료<br/>
            • 자비/대리점/AS: 설치만 완료하면 됨
          </p>
        </div>

        {/* 완료율 */}
        <div className="bg-purple-50 p-4 rounded-lg">
          <p className="text-sm font-medium text-gray-700 mb-2">완료율</p>
          <div className="flex items-center justify-between">
            <div className="flex-1 bg-gray-200 rounded-full h-3 mr-3">
              <div
                className="bg-green-600 h-3 rounded-full transition-all"
                style={{ width: `${Math.min(data.completionRate, 100)}%` }}
              />
            </div>
            <p className="text-lg font-bold text-purple-700">
              {data.completionRate.toFixed(1)}%
            </p>
          </div>
          <p className="text-xs text-gray-600 mt-2">
            {data.completed}건 / {data.total}건 완료
          </p>
        </div>

        {/* 통계 정보 */}
        <div className="border-t border-gray-200 pt-4 space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-sm text-gray-600">전월 대비 증감</p>
            {formatPercent(data.prevMonthChange)}
          </div>
          <div className="flex items-center justify-between">
            <p className="text-sm text-gray-600">미완료</p>
            <p className="font-medium text-orange-600">
              {data.waiting + data.inProgress}건
            </p>
          </div>
        </div>
      </div>
    );
  };

  const getTitle = () => {
    switch (monthData.type) {
      case 'revenue':
        return '매출/매입/이익 상세';
      case 'receivable':
        return '미수금 상세';
      case 'installation':
        return '설치 현황 상세';
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* 헤더 */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div className="flex items-center gap-2">
            <Calendar className="w-6 h-6 text-blue-600" />
            <div>
              <h2 className="text-xl font-bold">{getTitle()}</h2>
              <p className="text-sm text-gray-600">{monthData.month}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-full transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* 본문 */}
        <div className="flex-1 overflow-y-auto p-6">
          {monthData.type === 'revenue' && renderRevenueDetail()}
          {monthData.type === 'receivable' && renderReceivableDetail()}
          {monthData.type === 'installation' && renderInstallationDetail()}
        </div>

        {/* 푸터 */}
        <div className="p-6 border-t border-gray-200">
          <button
            onClick={onClose}
            className="w-full px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700"
          >
            닫기
          </button>
        </div>
      </div>
    </div>
  );
}
