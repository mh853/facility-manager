'use client'

// 발주 관리 전용 사업장 간단 뷰 모달
// BusinessDetailModal의 경량 버전 - 기본 정보만 표시

import { useState } from 'react'
import {
  X,
  Building2,
  MapPin,
  User,
  Phone,
  Package,
  Wifi,
  Key,
  Edit,
  ExternalLink
} from 'lucide-react'
import type { OrderDetailResponse } from '@/types/order-management'

interface BusinessQuickViewProps {
  isOpen: boolean
  business: OrderDetailResponse['data']['business']
  manufacturer: string
  onClose: () => void
}

export default function BusinessQuickView({
  isOpen,
  business,
  manufacturer,
  onClose
}: BusinessQuickViewProps) {
  if (!isOpen) return null

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose()
    }
  }

  const goToBusinessPage = () => {
    // 사업장 관리 페이지로 이동 (새 탭)
    const url = `/admin/business?business=${encodeURIComponent(business.business_name)}`
    window.open(url, '_blank')
  }

  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-60"
      onClick={handleBackdropClick}
    >
      <div className="bg-white rounded-lg shadow-2xl max-w-2xl w-full max-h-[85vh] overflow-hidden z-61">
        {/* 헤더 */}
        <div className="px-6 py-4 bg-gradient-to-r from-blue-600 to-indigo-600 text-white">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Building2 className="w-6 h-6" />
              <h2 className="text-xl font-bold">{business.business_name}</h2>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-white hover:bg-opacity-20 rounded-lg transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* 컨텐츠 */}
        <div className="p-6 overflow-y-auto max-h-[calc(85vh-80px)]">
          {/* 사업장 관리로 이동 버튼 */}
          <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <div className="flex items-center justify-between">
              <div className="flex-1">
                <h3 className="text-sm font-semibold text-blue-900 mb-1">
                  📋 전체 정보 확인하기
                </h3>
                <p className="text-xs text-blue-700">
                  메모, 업무, 시설 정보 등 상세 내용은 사업장 관리 페이지에서 확인하세요
                </p>
              </div>
              <button
                onClick={goToBusinessPage}
                className="ml-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2 text-sm font-medium whitespace-nowrap"
              >
                <ExternalLink className="w-4 h-4" />
                사업장 관리
              </button>
            </div>
          </div>

          {/* 기본 정보 */}
          <div className="space-y-4">
            <div className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg">
              <MapPin className="w-5 h-5 text-gray-400 mt-0.5 flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="text-sm text-gray-600 mb-1">주소</div>
                <div className="text-sm font-medium text-gray-900">
                  {business.address || '-'}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg">
                <User className="w-5 h-5 text-gray-400 mt-0.5 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="text-sm text-gray-600 mb-1">담당자</div>
                  <div className="text-sm font-medium text-gray-900">
                    {business.manager_name || '-'}{' '}
                    {business.manager_position ? `(${business.manager_position})` : ''}
                  </div>
                </div>
              </div>

              <div className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg">
                <Phone className="w-5 h-5 text-gray-400 mt-0.5 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="text-sm text-gray-600 mb-1">연락처</div>
                  <div className="text-sm font-medium text-gray-900">
                    {business.manager_contact || '-'}
                  </div>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg">
                <Package className="w-5 h-5 text-gray-400 mt-0.5 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="text-sm text-gray-600 mb-1">제조사</div>
                  <div className="text-sm font-medium text-gray-900">
                    {manufacturer}
                  </div>
                </div>
              </div>

              <div className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg">
                <Wifi className="w-5 h-5 text-gray-400 mt-0.5 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="text-sm text-gray-600 mb-1">VPN</div>
                  <div className="text-sm font-medium text-gray-900">
                    {business.vpn === 'wired' ? '유선' : '무선'}
                  </div>
                </div>
              </div>
            </div>

            <div className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg">
              <Key className="w-5 h-5 text-gray-400 mt-0.5 flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="text-sm text-gray-600 mb-1">그린링크 계정</div>
                <div className="text-sm font-medium text-gray-900 font-mono">
                  {business.greenlink_id || '-'} / {business.greenlink_pw || '-'}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
