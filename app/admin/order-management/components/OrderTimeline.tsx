'use client'

// app/admin/order-management/components/OrderTimeline.tsx
// 발주 진행 타임라인 컴포넌트

import { useState, useEffect } from 'react'
import {
  Clock,
  CheckCircle,
  Edit,
  PlusCircle,
  AlertCircle,
  Loader2
} from 'lucide-react'
import type {
  OrderHistoryItem,
  OrderHistoryResponse
} from '@/types/order-management'

interface OrderTimelineProps {
  businessId: string
}

export default function OrderTimeline({ businessId }: OrderTimelineProps) {
  const [loading, setLoading] = useState(true)
  const [history, setHistory] = useState<OrderHistoryItem[]>([])

  useEffect(() => {
    loadHistory()
  }, [businessId])

  const loadHistory = async () => {
    try {
      setLoading(true)

      const response = await fetch(
        `/api/order-management/${businessId}/history`,
        {
          credentials: 'include'
        }
      )

      if (!response.ok) {
        throw new Error('Failed to load history')
      }

      const result: OrderHistoryResponse = await response.json()

      if (result.success && result.data) {
        setHistory(result.data.history)
      }
    } catch (error) {
      console.error('이력 로드 오류:', error)
    } finally {
      setLoading(false)
    }
  }

  // 액션 타입별 아이콘
  const getActionIcon = (actionType: string) => {
    switch (actionType) {
      case 'create':
        return <PlusCircle className="w-4 h-4 text-blue-600" />
      case 'update':
        return <Edit className="w-4 h-4 text-amber-600" />
      case 'complete':
        return <CheckCircle className="w-4 h-4 text-green-600" />
      case 'delete':
        return <AlertCircle className="w-4 h-4 text-red-600" />
      default:
        return <Clock className="w-4 h-4 text-gray-600" />
    }
  }

  // 액션 타입별 배경색
  const getActionBgColor = (actionType: string) => {
    switch (actionType) {
      case 'create':
        return 'bg-blue-100'
      case 'update':
        return 'bg-amber-100'
      case 'complete':
        return 'bg-green-100'
      case 'delete':
        return 'bg-red-100'
      default:
        return 'bg-gray-100'
    }
  }

  // 날짜 포맷팅
  const formatDateTime = (dateString: string) => {
    const date = new Date(dateString)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffMins = Math.floor(diffMs / 60000)
    const diffHours = Math.floor(diffMs / 3600000)
    const diffDays = Math.floor(diffMs / 86400000)

    // 상대 시간 표시
    let relativeTime = ''
    if (diffMins < 1) {
      relativeTime = '방금 전'
    } else if (diffMins < 60) {
      relativeTime = `${diffMins}분 전`
    } else if (diffHours < 24) {
      relativeTime = `${diffHours}시간 전`
    } else if (diffDays < 7) {
      relativeTime = `${diffDays}일 전`
    } else {
      relativeTime = date.toLocaleDateString('ko-KR', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      })
    }

    // 절대 시간
    const absoluteTime = date.toLocaleString('ko-KR', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    })

    return { relativeTime, absoluteTime }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="w-6 h-6 animate-spin text-green-600" />
        <span className="ml-2 text-gray-600">이력 로딩 중...</span>
      </div>
    )
  }

  if (history.length === 0) {
    return (
      <div className="text-center py-8">
        <Clock className="w-12 h-12 text-gray-300 mx-auto mb-3" />
        <p className="text-gray-500 text-sm">아직 진행 이력이 없습니다</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 mb-4">
        <Clock className="w-5 h-5 text-gray-600" />
        <h3 className="text-lg font-semibold text-gray-900">진행 이력</h3>
        <span className="text-sm text-gray-500">({history.length}건)</span>
      </div>

      {/* 타임라인 */}
      <div className="relative">
        {/* 세로 연결선 */}
        <div className="absolute left-6 top-0 bottom-0 w-0.5 bg-gray-200" />

        {/* 이력 아이템 */}
        <div className="space-y-4">
          {history.map((item, index) => {
            const { relativeTime, absoluteTime } = formatDateTime(
              item.changed_at
            )

            return (
              <div key={item.id} className="relative flex gap-4">
                {/* 아이콘 */}
                <div
                  className={`relative z-10 flex-shrink-0 w-12 h-12 rounded-full ${getActionBgColor(item.action_type)} flex items-center justify-center`}
                >
                  {getActionIcon(item.action_type)}
                </div>

                {/* 내용 */}
                <div className="flex-1 bg-white border border-gray-200 rounded-lg p-4 shadow-sm">
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <h4 className="font-semibold text-gray-900">
                        {item.step_name}
                      </h4>
                      <p className="text-sm text-gray-600 mt-1">
                        {item.change_summary}
                      </p>
                    </div>
                    <div className="text-right ml-4">
                      <div
                        className="text-xs text-gray-500"
                        title={absoluteTime}
                      >
                        {relativeTime}
                      </div>
                    </div>
                  </div>

                  {/* 변경자 정보 */}
                  <div className="flex items-center gap-4 text-xs text-gray-500 mt-3 pt-3 border-t border-gray-100">
                    <div className="flex items-center gap-1">
                      <span className="font-medium">변경자:</span>
                      <span>{item.changed_by_name || '시스템'}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <span className="font-medium">시간:</span>
                      <span>{absoluteTime}</span>
                    </div>
                  </div>

                  {/* 변경 사유 (있을 경우) */}
                  {item.change_reason && (
                    <div className="mt-2 pt-2 border-t border-gray-100">
                      <span className="text-xs text-gray-500 font-medium">
                        사유:
                      </span>
                      <span className="text-xs text-gray-600 ml-1">
                        {item.change_reason}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* 통계 */}
      <div className="mt-6 pt-6 border-t border-gray-200">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-center">
          <div className="bg-blue-50 rounded-lg p-3">
            <div className="text-2xl font-bold text-blue-600">
              {history.filter((h) => h.action_type === 'create').length}
            </div>
            <div className="text-xs text-gray-600 mt-1">최초 입력</div>
          </div>
          <div className="bg-amber-50 rounded-lg p-3">
            <div className="text-2xl font-bold text-amber-600">
              {history.filter((h) => h.action_type === 'update').length}
            </div>
            <div className="text-xs text-gray-600 mt-1">수정</div>
          </div>
          <div className="bg-green-50 rounded-lg p-3">
            <div className="text-2xl font-bold text-green-600">
              {history.filter((h) => h.action_type === 'complete').length}
            </div>
            <div className="text-xs text-gray-600 mt-1">완료</div>
          </div>
          <div className="bg-gray-50 rounded-lg p-3">
            <div className="text-2xl font-bold text-gray-600">
              {history.length}
            </div>
            <div className="text-xs text-gray-600 mt-1">전체 이력</div>
          </div>
        </div>
      </div>
    </div>
  )
}
