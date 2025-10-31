'use client'

// app/admin/order-management/components/RouterInventoryList.tsx
// 무선 라우터 재고 목록 컴포넌트

import { useState, useEffect } from 'react'
import { Search, Plus, Package, TrendingUp, AlertCircle, Calendar, Edit2, Download } from 'lucide-react'
import type { RouterInventoryItem, RouterListResponse, RouterStatus } from '@/types/router-inventory'
import RouterAddModal from './RouterAddModal'
import RouterShippingModal from './RouterShippingModal'
import RouterEditModal from './RouterEditModal'

interface RouterInventoryListProps {
  onRefresh?: () => void
  onSummaryChange?: (summary: { total: number; in_stock: number; assigned: number; shipped_pending: number }) => void
}

export default function RouterInventoryList({ onRefresh, onSummaryChange }: RouterInventoryListProps) {
  // 상태 관리
  const [routers, setRouters] = useState<RouterInventoryItem[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState<RouterStatus | 'all'>('all')
  const [currentPage, setCurrentPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [summary, setSummary] = useState({
    total: 0,
    in_stock: 0,
    assigned: 0,
    shipped_pending: 0
  })

  // 모달 상태
  const [showAddModal, setShowAddModal] = useState(false)
  const [showShippingModal, setShowShippingModal] = useState(false)
  const [showEditModal, setShowEditModal] = useState(false)
  const [selectedRouters, setSelectedRouters] = useState<string[]>([])
  const [editingRouter, setEditingRouter] = useState<RouterInventoryItem | null>(null)

  // 데이터 로드
  useEffect(() => {
    loadRouters()
  }, [searchTerm, statusFilter, currentPage])

  const loadRouters = async () => {
    try {
      setLoading(true)

      const params = new URLSearchParams({
        search: searchTerm,
        status: statusFilter,
        page: currentPage.toString(),
        limit: '20'
      })

      const token = typeof window !== 'undefined' ? localStorage.getItem('auth_token') : null

      const response = await fetch(`/api/router-inventory?${params}`, {
        credentials: 'include',
        headers: token ? { Authorization: `Bearer ${token}` } : {}
      })

      if (!response.ok) {
        throw new Error('Failed to load routers')
      }

      const result: RouterListResponse = await response.json()

      if (result.success && result.data) {
        setRouters(result.data.routers)
        setTotalPages(result.data.pagination.total_pages)
        setSummary(result.data.summary)
        // 부모 컴포넌트에 summary 전달
        if (onSummaryChange) {
          onSummaryChange(result.data.summary)
        }
      }
    } catch (error) {
      console.error('라우터 목록 로드 오류:', error)
      alert('라우터 목록을 불러오는 중 오류가 발생했습니다.')
    } finally {
      setLoading(false)
    }
  }

  // 체크박스 선택/해제
  const handleSelectRouter = (routerId: string) => {
    setSelectedRouters((prev) =>
      prev.includes(routerId)
        ? prev.filter((id) => id !== routerId)
        : [...prev, routerId]
    )
  }

  // 전체 선택/해제
  const handleSelectAll = () => {
    if (selectedRouters.length === routers.length) {
      setSelectedRouters([])
    } else {
      setSelectedRouters(routers.map((r) => r.id))
    }
  }

  // Excel 내보내기
  const handleExport = async () => {
    try {
      const token = typeof window !== 'undefined' ? localStorage.getItem('auth_token') : null

      const response = await fetch('/api/router-inventory/export', {
        credentials: 'include',
        headers: token ? { Authorization: `Bearer ${token}` } : {}
      })

      if (!response.ok) {
        throw new Error('내보내기 실패')
      }

      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `router_inventory_${new Date().toISOString().split('T')[0]}.csv`
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)
    } catch (error) {
      console.error('내보내기 오류:', error)
      alert('데이터 내보내기 중 오류가 발생했습니다.')
    }
  }

  // 편집 버튼 클릭
  const handleEditClick = (router: RouterInventoryItem) => {
    setEditingRouter(router)
    setShowEditModal(true)
  }

  // 상태 뱃지 렌더링
  const renderStatusBadge = (status: RouterStatus) => {
    const statusConfig = {
      in_stock: { label: '재고', color: 'bg-green-100 text-green-700' },
      assigned: { label: '할당됨', color: 'bg-blue-100 text-blue-700' }
    }

    const config = statusConfig[status]
    return (
      <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${config.color}`}>
        {config.label}
      </span>
    )
  }

  return (
    <div className="space-y-6">
      {/* 검색 및 필터 */}
      <div className="bg-white rounded-lg shadow p-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* 검색 */}
          <div className="md:col-span-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="S/N, MAC, IMEI, 할당 사업장명 검색..."
                value={searchTerm}
                onChange={(e) => {
                  setSearchTerm(e.target.value)
                  setCurrentPage(1)
                }}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
              />
            </div>
          </div>

          {/* 상태 필터 */}
          <div className="flex gap-2">
            <select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value as RouterStatus | 'all')
                setCurrentPage(1)
              }}
              className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
            >
              <option value="all">전체 상태</option>
              <option value="in_stock">재고</option>
              <option value="assigned">할당됨</option>
            </select>

            <button
              onClick={handleExport}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2"
            >
              <Download className="w-4 h-4" />
              내보내기
            </button>

            <button
              onClick={() => setShowAddModal(true)}
              className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors flex items-center gap-2"
            >
              <Plus className="w-4 h-4" />
              추가
            </button>
          </div>
        </div>
      </div>

      {/* 일괄 작업 버튼 */}
      {selectedRouters.length > 0 && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <span className="text-sm text-blue-900">
              {selectedRouters.length}개 라우터 선택됨
            </span>
            <div className="flex gap-2">
              <button
                onClick={() => setShowShippingModal(true)}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm"
              >
                출고일 일괄 입력
              </button>
              <button
                onClick={() => setSelectedRouters([])}
                className="px-4 py-2 bg-white text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors text-sm"
              >
                선택 해제
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 라우터 목록 테이블 */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left py-3 px-4">
                  <input
                    type="checkbox"
                    checked={selectedRouters.length === routers.length && routers.length > 0}
                    onChange={handleSelectAll}
                    className="rounded border-gray-300 text-green-600 focus:ring-green-500"
                  />
                </th>
                <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">
                  할당 사업장
                </th>
                <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">
                  상품명
                </th>
                <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">
                  S/N
                </th>
                <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">
                  MAC 주소
                </th>
                <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">
                  IMEI
                </th>
                <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">
                  상태
                </th>
                <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">
                  출고일
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {loading ? (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-gray-500">
                    로딩 중...
                  </td>
                </tr>
              ) : routers.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-gray-500">
                    라우터 재고가 없습니다
                  </td>
                </tr>
              ) : (
                routers.map((router) => (
                  <tr
                    key={router.id}
                    onClick={() => handleEditClick(router)}
                    className="hover:bg-gray-50 cursor-pointer transition-colors"
                  >
                    <td
                      className="py-3 px-4"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <input
                        type="checkbox"
                        checked={selectedRouters.includes(router.id)}
                        onChange={() => handleSelectRouter(router.id)}
                        className="rounded border-gray-300 text-green-600 focus:ring-green-500"
                      />
                    </td>
                    <td className="py-3 px-4 text-sm font-medium text-gray-900">
                      {router.assigned_business_name || '-'}
                    </td>
                    <td className="py-3 px-4 text-sm text-gray-600">
                      {router.product_name}
                    </td>
                    <td className="py-3 px-4 text-sm text-gray-600 font-mono">
                      {router.serial_number}
                    </td>
                    <td className="py-3 px-4 text-sm text-gray-600 font-mono">
                      {router.mac_address || '-'}
                    </td>
                    <td className="py-3 px-4 text-sm text-gray-600 font-mono">
                      {router.imei || '-'}
                    </td>
                    <td className="py-3 px-4 text-sm">
                      {renderStatusBadge(router.status)}
                    </td>
                    <td className="py-3 px-4 text-sm text-gray-600">
                      {router.shipped_date
                        ? new Date(router.shipped_date).toLocaleDateString('ko-KR')
                        : '-'}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* 페이지네이션 */}
        {totalPages > 1 && (
          <div className="bg-gray-50 px-4 py-3 flex items-center justify-between border-t border-gray-200">
            <div className="text-sm text-gray-600">
              페이지 {currentPage} / {totalPages}
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="px-3 py-1 border border-gray-300 rounded hover:bg-white disabled:opacity-50 disabled:cursor-not-allowed"
              >
                이전
              </button>
              <button
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="px-3 py-1 border border-gray-300 rounded hover:bg-white disabled:opacity-50 disabled:cursor-not-allowed"
              >
                다음
              </button>
            </div>
          </div>
        )}
      </div>

      {/* 라우터 추가 모달 */}
      {showAddModal && (
        <RouterAddModal
          onClose={() => setShowAddModal(false)}
          onSuccess={() => {
            loadRouters()
            setShowAddModal(false)
          }}
        />
      )}

      {/* 출고일 일괄 입력 모달 */}
      {showShippingModal && (
        <RouterShippingModal
          selectedRouterIds={selectedRouters}
          onClose={() => setShowShippingModal(false)}
          onSuccess={() => {
            loadRouters()
            setSelectedRouters([])
            setShowShippingModal(false)
          }}
        />
      )}

      {/* 라우터 편집 모달 */}
      {showEditModal && editingRouter && (
        <RouterEditModal
          router={editingRouter}
          onClose={() => {
            setShowEditModal(false)
            setEditingRouter(null)
          }}
          onSuccess={() => {
            loadRouters()
            setShowEditModal(false)
            setEditingRouter(null)
          }}
        />
      )}
    </div>
  )
}
