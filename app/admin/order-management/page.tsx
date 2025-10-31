'use client'

// app/admin/order-management/page.tsx
// 발주 관리 메인 페이지

import { useState, useEffect } from 'react'
import AdminLayout from '@/components/ui/AdminLayout'
import { Search, Filter, Calendar, TrendingUp, Package, AlertCircle } from 'lucide-react'
import type {
  OrderListItem,
  OrderListResponse,
  Manufacturer,
  OrderStatus
} from '@/types/order-management'
import { MANUFACTURERS } from '@/types/order-management'
import OrderDetailModal from './components/OrderDetailModal'
import RouterInventoryList from './components/RouterInventoryList'

export default function OrderManagementPage() {
  // 상태 관리
  const [activeTab, setActiveTab] = useState<'in_progress' | 'not_started' | 'completed' | 'router_management'>('in_progress')
  const [orders, setOrders] = useState<OrderListItem[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [manufacturerFilter, setManufacturerFilter] = useState<
    Manufacturer | 'all'
  >('all')
  const [sortBy, setSortBy] = useState<'latest' | 'name' | 'updated'>('latest')
  const [currentPage, setCurrentPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [summary, setSummary] = useState({
    total_orders: 0,
    in_progress: 0,
    not_started: 0,
    completed: 0,
    by_manufacturer: { ecosense: 0, gaia_cns: 0, cleanearth: 0, evs: 0 }
  })

  // 라우터 통계 상태
  const [routerSummary, setRouterSummary] = useState({
    total: 0,
    in_stock: 0,
    assigned: 0,
    shipped_pending: 0
  })

  // 모달 상태
  const [selectedBusinessId, setSelectedBusinessId] = useState<string | null>(
    null
  )
  const [isModalOpen, setIsModalOpen] = useState(false)

  // 데이터 로드
  useEffect(() => {
    loadOrders()
  }, [searchTerm, manufacturerFilter, activeTab, sortBy, currentPage])

  const loadOrders = async () => {
    // 라우터 관리 탭에서는 발주 목록을 로드하지 않음
    if (activeTab === 'router_management') {
      setLoading(false)
      return
    }

    try {
      setLoading(true)

      const params = new URLSearchParams({
        search: searchTerm,
        manufacturer: manufacturerFilter,
        status: activeTab,
        sort: sortBy,
        page: currentPage.toString(),
        limit: '20'
      })

      const token = typeof window !== 'undefined' ? localStorage.getItem('auth_token') : null

      const response = await fetch(`/api/order-management?${params}`, {
        credentials: 'include',
        headers: token ? { Authorization: `Bearer ${token}` } : {}
      })

      if (!response.ok) {
        throw new Error('Failed to load orders')
      }

      const result: OrderListResponse = await response.json()

      if (result.success && result.data) {
        setOrders(result.data.orders)
        setTotalPages(result.data.pagination.total_pages)
        setSummary(result.data.summary)
      }
    } catch (error) {
      console.error('발주 목록 로드 오류:', error)
      alert('발주 목록을 불러오는 중 오류가 발생했습니다.')
    } finally {
      setLoading(false)
    }
  }

  // 모달 열기
  const handleOpenModal = (businessId: string) => {
    setSelectedBusinessId(businessId)
    setIsModalOpen(true)
  }

  // 모달 닫기 및 새로고침
  const handleCloseModal = (shouldRefresh: boolean = false) => {
    setIsModalOpen(false)
    setSelectedBusinessId(null)
    if (shouldRefresh) {
      loadOrders()
    }
  }

  // 검색 필터 리셋
  const handleResetFilters = () => {
    setSearchTerm('')
    setManufacturerFilter('all')
    setSortBy('latest')
    setCurrentPage(1)
  }

  // 탭 변경
  const handleTabChange = (tab: 'in_progress' | 'not_started' | 'completed' | 'router_management') => {
    setActiveTab(tab)
    setCurrentPage(1)
  }

  return (
    <AdminLayout
      title="발주 관리"
      description="제품 발주 단계의 사업장 진행 상황을 관리합니다"
    >
      <div className="space-y-6">
      {/* 통계 카드 */}
      {activeTab === 'router_management' ? (
        // 라우터 관리 통계
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white rounded-lg shadow p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-gray-600">전체 재고</span>
              <Package className="w-4 h-4 text-gray-400" />
            </div>
            <div className="text-2xl font-bold text-gray-900">{routerSummary.total}</div>
          </div>

          <div className="bg-white rounded-lg shadow p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-gray-600">가용 재고</span>
              <TrendingUp className="w-4 h-4 text-green-400" />
            </div>
            <div className="text-2xl font-bold text-green-600">{routerSummary.in_stock}</div>
            {routerSummary.in_stock < 10 && (
              <div className="flex items-center gap-1 mt-1">
                <AlertCircle className="w-3 h-3 text-orange-500" />
                <span className="text-xs text-orange-500">재고 부족</span>
              </div>
            )}
          </div>

          <div className="bg-white rounded-lg shadow p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-gray-600">할당됨</span>
              <Calendar className="w-4 h-4 text-blue-400" />
            </div>
            <div className="text-2xl font-bold text-blue-600">{routerSummary.assigned}</div>
          </div>

          <div className="bg-white rounded-lg shadow p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-gray-600">출고 대기</span>
              <AlertCircle className="w-4 h-4 text-orange-400" />
            </div>
            <div className="text-2xl font-bold text-orange-600">{routerSummary.shipped_pending}</div>
          </div>
        </div>
      ) : (
        // 발주 관리 통계
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white rounded-lg shadow p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-gray-600">전체</span>
              <TrendingUp className="w-4 h-4 text-gray-400" />
            </div>
            <div className="text-2xl font-bold text-gray-900">
              {summary.total_orders}
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-gray-600">진행중</span>
              <Calendar className="w-4 h-4 text-blue-400" />
            </div>
            <div className="text-2xl font-bold text-blue-600">
              {summary.in_progress}
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-gray-600">완료</span>
              <Package className="w-4 h-4 text-green-400" />
            </div>
            <div className="text-2xl font-bold text-green-600">
              {summary.completed}
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-4">
            <div className="text-sm text-gray-600 mb-2">제조사별</div>
            <div className="space-y-1">
              {Object.entries(summary.by_manufacturer).map(
                ([key, value]) =>
                  value > 0 && (
                    <div
                      key={key}
                      className="flex items-center justify-between text-xs"
                    >
                      <span className="text-gray-600">
                        {MANUFACTURERS[key as Manufacturer].name}
                      </span>
                      <span className="font-semibold">{value}</span>
                    </div>
                  )
              )}
            </div>
          </div>
        </div>
      )}

      {/* 탭 메뉴 */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="flex border-b border-gray-200">
          <button
            onClick={() => handleTabChange('in_progress')}
            className={`flex-1 px-6 py-3 text-sm font-medium transition-colors ${
              activeTab === 'in_progress'
                ? 'text-green-600 border-b-2 border-green-600 bg-white'
                : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
            }`}
          >
            <div className="flex items-center justify-center gap-2">
              <Calendar className="w-4 h-4" />
              발주 필요 ({summary.in_progress})
            </div>
          </button>
          <button
            onClick={() => handleTabChange('not_started')}
            className={`flex-1 px-6 py-3 text-sm font-medium transition-colors ${
              activeTab === 'not_started'
                ? 'text-green-600 border-b-2 border-green-600 bg-white'
                : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
            }`}
          >
            <div className="flex items-center justify-center gap-2">
              <TrendingUp className="w-4 h-4" />
              발주 진행 전 ({summary.not_started})
            </div>
          </button>
          <button
            onClick={() => handleTabChange('completed')}
            className={`flex-1 px-6 py-3 text-sm font-medium transition-colors ${
              activeTab === 'completed'
                ? 'text-green-600 border-b-2 border-green-600 bg-white'
                : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
            }`}
          >
            <div className="flex items-center justify-center gap-2">
              <Package className="w-4 h-4" />
              발주 완료 ({summary.completed})
            </div>
          </button>
          <button
            onClick={() => handleTabChange('router_management')}
            className={`flex-1 px-6 py-3 text-sm font-medium transition-colors ${
              activeTab === 'router_management'
                ? 'text-green-600 border-b-2 border-green-600 bg-white'
                : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
            }`}
          >
            <div className="flex items-center justify-center gap-2">
              <Package className="w-4 h-4" />
              무선 라우터 관리
            </div>
          </button>
        </div>
      </div>

      {/* 라우터 관리 탭 컨텐츠 */}
      {activeTab === 'router_management' ? (
        <RouterInventoryList onSummaryChange={setRouterSummary} />
      ) : (
        <>
      {/* 필터 및 검색 */}
      <div className="bg-white rounded-lg shadow p-4">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* 검색 */}
          <div className="lg:col-span-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="사업장명 검색..."
                value={searchTerm}
                onChange={(e) => {
                  setSearchTerm(e.target.value)
                  setCurrentPage(1)
                }}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
              />
            </div>
          </div>

          {/* 제조사 필터 */}
          <div>
            <select
              value={manufacturerFilter}
              onChange={(e) => {
                setManufacturerFilter(e.target.value as Manufacturer | 'all')
                setCurrentPage(1)
              }}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
            >
              <option value="all">전체 제조사</option>
              {Object.entries(MANUFACTURERS).map(([key, info]) => (
                <option key={key} value={key}>
                  {info.name}
                </option>
              ))}
            </select>
          </div>

          {/* 정렬 */}
          <div className="flex gap-2">
            <select
              value={sortBy}
              onChange={(e) =>
                setSortBy(e.target.value as 'latest' | 'name' | 'updated')
              }
              className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
            >
              <option value="latest">최신순</option>
              <option value="name">사업장명순</option>
              <option value="updated">업데이트순</option>
            </select>

            <button
              onClick={handleResetFilters}
              className="px-3 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
              title="필터 초기화"
            >
              <Filter className="w-4 h-4 text-gray-600" />
            </button>
          </div>
        </div>
      </div>

      {/* 발주 목록 테이블 */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">
                  사업장명
                </th>
                <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">
                  주소
                </th>
                <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">
                  제조사
                </th>
                <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">
                  진행률
                </th>
                <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">
                  상태
                </th>
                <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">
                  최종 업데이트
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {loading ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-gray-500">
                    로딩 중...
                  </td>
                </tr>
              ) : orders.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-gray-500">
                    발주 대상 사업장이 없습니다
                  </td>
                </tr>
              ) : (
                orders.map((order) => (
                  <tr
                    key={order.id}
                    onClick={() => handleOpenModal(order.business_id)}
                    className="hover:bg-gray-50 cursor-pointer transition-colors"
                  >
                    <td className="py-3 px-4 text-sm font-medium text-gray-900">
                      {order.business_name}
                    </td>
                    <td className="py-3 px-4 text-sm text-gray-600">
                      {order.address || '-'}
                    </td>
                    <td className="py-3 px-4 text-sm">
                      {order.manufacturer && MANUFACTURERS[order.manufacturer] ? (
                        <span
                          className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium
                          ${
                            order.manufacturer === 'ecosense'
                              ? 'bg-blue-100 text-blue-700'
                              : order.manufacturer === 'gaia_cns'
                                ? 'bg-green-100 text-green-700'
                                : order.manufacturer === 'cleanearth'
                                  ? 'bg-purple-100 text-purple-700'
                                  : 'bg-orange-100 text-orange-700'
                          }`}
                        >
                          {MANUFACTURERS[order.manufacturer].name}
                        </span>
                      ) : (
                        <span className="text-gray-400 text-xs">-</span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-sm">
                      <div className="flex items-center gap-2">
                        <div className="flex-1 bg-gray-200 rounded-full h-2 max-w-[100px]">
                          <div
                            className="bg-green-500 h-2 rounded-full transition-all"
                            style={{
                              width: `${order.progress_percentage}%`
                            }}
                          />
                        </div>
                        <span className="text-xs font-medium text-gray-700">
                          {order.progress_percentage}%
                        </span>
                      </div>
                      <div className="text-xs text-gray-500 mt-1">
                        {order.steps_completed}/{order.steps_total} 단계
                      </div>
                    </td>
                    <td className="py-3 px-4 text-sm">
                      {order.status === 'completed' ? (
                        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-700">
                          완료
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-700">
                          진행중
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-sm text-gray-600">
                      {new Date(order.last_updated).toLocaleDateString('ko-KR')}
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
                onClick={() =>
                  setCurrentPage((p) => Math.min(totalPages, p + 1))
                }
                disabled={currentPage === totalPages}
                className="px-3 py-1 border border-gray-300 rounded hover:bg-white disabled:opacity-50 disabled:cursor-not-allowed"
              >
                다음
              </button>
            </div>
          </div>
        )}
      </div>

      {/* 발주 상세 모달 */}
      {isModalOpen && selectedBusinessId && (
        <OrderDetailModal
          businessId={selectedBusinessId}
          onClose={handleCloseModal}
        />
      )}
      </>
      )}
      </div>
    </AdminLayout>
  )
}
