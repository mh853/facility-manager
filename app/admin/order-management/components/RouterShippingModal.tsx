'use client'

// app/admin/order-management/components/RouterShippingModal.tsx
// 라우터 출고일 일괄 입력 모달

import { useState } from 'react'
import { X, Calendar } from 'lucide-react'

interface RouterShippingModalProps {
  selectedRouterIds: string[]
  onClose: () => void
  onSuccess: () => void
}

export default function RouterShippingModal({
  selectedRouterIds,
  onClose,
  onSuccess
}: RouterShippingModalProps) {
  const [shippedDate, setShippedDate] = useState('')
  const [shippedBatch, setShippedBatch] = useState('')
  const [submitting, setSubmitting] = useState(false)

  // 제출 처리
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!shippedDate) {
      alert('출고일을 선택해주세요')
      return
    }

    try {
      setSubmitting(true)

      const token = typeof window !== 'undefined' ? localStorage.getItem('auth_token') : null

      const response = await fetch('/api/router-inventory/shipping', {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {})
        },
        body: JSON.stringify({
          router_ids: selectedRouterIds,
          shipped_date: shippedDate,
          shipped_batch: shippedBatch || undefined
        })
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || '출고일 업데이트 중 오류가 발생했습니다')
      }

      alert(result.message || `${selectedRouterIds.length}개 라우터의 출고일이 업데이트되었습니다`)
      onSuccess()
      onClose()
    } catch (error: any) {
      console.error('출고일 업데이트 오류:', error)
      alert(error.message)
    } finally {
      setSubmitting(false)
    }
  }

  // 오늘 날짜를 기본값으로 설정
  const today = new Date().toISOString().split('T')[0]

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full">
        {/* 헤더 */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <h2 className="text-xl font-semibold text-gray-900">출고일 일괄 입력</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* 본문 */}
        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* 선택된 라우터 수 */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="flex items-center gap-3">
              <Calendar className="w-5 h-5 text-blue-600 flex-shrink-0" />
              <p className="text-sm text-blue-900">
                <span className="font-semibold">{selectedRouterIds.length}개</span> 라우터의
                출고일을 일괄 입력합니다
              </p>
            </div>
          </div>

          {/* 출고일 입력 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              출고일 <span className="text-red-500">*</span>
            </label>
            <input
              type="date"
              value={shippedDate}
              onChange={(e) => setShippedDate(e.target.value)}
              max={today}
              required
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
            />
            <p className="mt-1 text-xs text-gray-500">업체에서 발송한 날짜를 입력하세요</p>
          </div>

          {/* 출고 배치 번호 (선택) */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              출고 배치 번호 (선택)
            </label>
            <input
              type="text"
              value={shippedBatch}
              onChange={(e) => setShippedBatch(e.target.value)}
              placeholder="예: BATCH-2025-001"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
            />
            <p className="mt-1 text-xs text-gray-500">
              같은 날 출고된 그룹을 구분하기 위한 번호입니다
            </p>
          </div>

          {/* 버튼 */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-200">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-white text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
            >
              취소
            </button>
            <button
              type="submit"
              disabled={submitting || !shippedDate}
              className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {submitting ? '업데이트 중...' : '출고일 입력'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
