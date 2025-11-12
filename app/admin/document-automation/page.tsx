// app/admin/document-automation/page.tsx - 문서 자동화 관리 페이지
'use client'

import { useState, useEffect } from 'react'
import AdminLayout from '@/components/ui/AdminLayout'
import { ConfirmModal } from '@/components/ui/Modal'
import PurchaseOrderModal from './components/PurchaseOrderModal'
import EcosensePurchaseOrderForm from '@/components/EcosensePurchaseOrderForm'
import EstimateManagement from './components/EstimateManagement'
import ContractManagement from './components/ContractManagement'
import { useAuth } from '@/contexts/AuthContext'
import {
  FileText,
  Download,
  Upload,
  Settings,
  Plus,
  Edit,
  Trash2,
  Eye,
  RefreshCw,
  Calendar,
  Mail,
  Printer,
  Database,
  CheckCircle,
  Clock,
  AlertTriangle,
  Zap,
  ShoppingCart,
  X,
  FileCheck
} from 'lucide-react'

interface DocumentTemplate {
  id: string
  name: string
  description: string
  type: 'report' | 'certificate' | 'inspection' | 'notification'
  status: 'active' | 'inactive'
  created_at: string
  updated_at: string
  usage_count: number
  file_path?: string
}

interface AutomationRule {
  id: string
  name: string
  description: string
  trigger: 'schedule' | 'event' | 'manual'
  template_id: string
  status: 'active' | 'inactive'
  last_run?: string
  next_run?: string
}

export default function DocumentAutomationPage() {
  const [templates, setTemplates] = useState<DocumentTemplate[]>([])
  const [rules, setRules] = useState<AutomationRule[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<'templates' | 'rules' | 'purchase_order' | 'estimate' | 'contract' | 'history'>('estimate')
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [modalType, setModalType] = useState<'template' | 'rule'>('template')
  const [selectedItem, setSelectedItem] = useState<DocumentTemplate | AutomationRule | null>(null)

  // 발주서 관련 상태
  const [businesses, setBusinesses] = useState<any[]>([])
  const [searchTerm, setSearchTerm] = useState('')
  const [isPurchaseOrderModalOpen, setIsPurchaseOrderModalOpen] = useState(false)
  const [selectedBusiness, setSelectedBusiness] = useState<{ id: string; name: string } | null>(null)
  const [loadingBusinesses, setLoadingBusinesses] = useState(false)

  // 문서 이력 관련 상태
  const [documentHistory, setDocumentHistory] = useState<any[]>([])
  const [historyFilter, setHistoryFilter] = useState({
    search: '',
    document_type: '',
    file_format: '',
    start_date: '',
    end_date: ''
  })
  const [historyPagination, setHistoryPagination] = useState({
    page: 1,
    limit: 20,
    total: 0,
    total_pages: 0
  })
  const [historySummary, setHistorySummary] = useState({
    total_documents: 0,
    by_type: { purchase_order: 0, estimate: 0, contract: 0, other: 0 },
    by_format: { excel: 0, pdf: 0 }
  })
  const [loadingHistory, setLoadingHistory] = useState(false)
  const [previewDocument, setPreviewDocument] = useState<any | null>(null)

  // AuthContext에서 사용자 정보 및 권한 가져오기
  const { user } = useAuth()
  const userPermissionLevel = user?.permission_level || 0

  // 발주 필요 사업장 목록 로드
  useEffect(() => {
    if (activeTab === 'purchase_order') {
      loadBusinessesForPurchaseOrder()
    } else if (activeTab === 'history') {
      loadDocumentHistory()
    }
  }, [activeTab, historyPagination.page, historyFilter])

  const loadBusinessesForPurchaseOrder = async () => {
    try {
      setLoadingBusinesses(true)

      const token = localStorage.getItem('auth_token')
      const params = new URLSearchParams({
        status: 'in_progress',  // 발주 필요 (product_order 상태)
        manufacturer: 'all',
        sort: 'latest',
        page: '1',
        limit: '100'
      })

      const response = await fetch(`/api/order-management?${params}`, {
        credentials: 'include',
        headers: {
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
          'Cache-Control': 'no-cache'
        }
      })

      if (!response.ok) {
        throw new Error('사업장 목록 조회 실패')
      }

      const result = await response.json()

      console.log('[DOCUMENT-AUTOMATION] 발주 필요 사업장:', {
        count: result.data?.orders?.length || 0,
        orders: result.data?.orders
      })

      if (result.success && result.data?.orders) {
        setBusinesses(result.data.orders)
      }
    } catch (error) {
      console.error('사업장 목록 로드 오류:', error)
      alert('사업장 목록을 불러오는 중 오류가 발생했습니다.')
    } finally {
      setLoadingBusinesses(false)
    }
  }

  // 문서 이력 로드
  const loadDocumentHistory = async () => {
    try {
      setLoadingHistory(true)

      const token = localStorage.getItem('auth_token')
      const params = new URLSearchParams({
        page: historyPagination.page.toString(),
        limit: historyPagination.limit.toString()
      })

      // 필터 추가
      if (historyFilter.search) params.append('search', historyFilter.search)
      if (historyFilter.document_type) params.append('document_type', historyFilter.document_type)
      if (historyFilter.file_format) params.append('file_format', historyFilter.file_format)
      if (historyFilter.start_date) params.append('start_date', historyFilter.start_date)
      if (historyFilter.end_date) params.append('end_date', historyFilter.end_date)

      const response = await fetch(`/api/document-automation/history?${params}`, {
        credentials: 'include',
        headers: {
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
          'Cache-Control': 'no-cache'
        }
      })

      if (!response.ok) {
        throw new Error('문서 이력 조회 실패')
      }

      const result = await response.json()

      if (result.success && result.data) {
        setDocumentHistory(result.data.documents || [])
        setHistoryPagination(result.data.pagination || historyPagination)
        setHistorySummary(result.data.summary || historySummary)
      }
    } catch (error) {
      console.error('문서 이력 로드 오류:', error)
      alert('문서 이력을 불러오는 중 오류가 발생했습니다.')
    } finally {
      setLoadingHistory(false)
    }
  }

  const deleteDocumentHistory = async (documentId: string, documentType: string) => {
    if (!confirm('이 문서를 삭제하시겠습니까?')) return

    try {
      const token = localStorage.getItem('auth_token')

      // 문서 타입에 따라 다른 API 호출
      const endpoint = documentType === 'estimate'
        ? `/api/estimates/${documentId}`
        : `/api/document-automation/history/${documentId}`

      const response = await fetch(endpoint, {
        method: 'DELETE',
        credentials: 'include',
        headers: {
          ...(token ? { Authorization: `Bearer ${token}` } : {})
        }
      })

      const result = await response.json()

      if (result.success) {
        alert('문서가 삭제되었습니다.')

        // 현재 페이지에 1개만 남아있고 첫 페이지가 아니면 이전 페이지로 이동
        if (documentHistory.length === 1 && historyPagination.page > 1) {
          setHistoryPagination({
            ...historyPagination,
            page: historyPagination.page - 1
          })
        } else {
          await loadDocumentHistory()
        }
      } else {
        alert(result.error || '삭제에 실패했습니다.')
      }
    } catch (error) {
      console.error('문서 삭제 오류:', error)
      alert('문서 삭제 중 오류가 발생했습니다.')
    }
  }

  // Mock data - replace with actual API calls
  useEffect(() => {
    const loadData = async () => {
      setIsLoading(true)
      
      // Simulate API call
      setTimeout(() => {
        setTemplates([
          {
            id: '1',
            name: '시설점검 보고서',
            description: '사업장 시설 점검 결과 보고서 템플릿',
            type: 'report',
            status: 'active',
            created_at: '2024-01-15',
            updated_at: '2024-03-10',
            usage_count: 45,
            file_path: '/templates/inspection-report.docx'
          },
          {
            id: '2',
            name: '대기배출 허가증',
            description: '대기배출시설 허가증 문서 템플릿',
            type: 'certificate',
            status: 'active',
            created_at: '2024-02-20',
            updated_at: '2024-03-15',
            usage_count: 23,
            file_path: '/templates/air-permit.docx'
          },
          {
            id: '3',
            name: '설치 완료 통지서',
            description: '시설 설치 완료 통지서 템플릿',
            type: 'notification',
            status: 'active',
            created_at: '2024-03-01',
            updated_at: '2024-03-20',
            usage_count: 67,
            file_path: '/templates/installation-notice.docx'
          }
        ])

        setRules([
          {
            id: '1',
            name: '월간 점검 보고서 자동 생성',
            description: '매월 마지막 날 모든 사업장의 점검 보고서를 자동 생성',
            trigger: 'schedule',
            template_id: '1',
            status: 'active',
            last_run: '2024-02-29',
            next_run: '2024-03-31'
          },
          {
            id: '2',
            name: '허가증 갱신 알림',
            description: '허가증 만료 30일 전 자동 알림 발송',
            trigger: 'event',
            template_id: '2',
            status: 'active',
            last_run: '2024-03-15',
            next_run: '2024-04-15'
          }
        ])

        setIsLoading(false)
      }, 1000)
    }

    loadData()
  }, [])

  const stats = {
    totalTemplates: templates.length,
    activeTemplates: templates.filter(t => t.status === 'active').length,
    totalRules: rules.length,
    activeRules: rules.filter(r => r.status === 'active').length,
    totalUsage: templates.reduce((sum, t) => sum + t.usage_count, 0),
  }

  const getTypeColor = (type: DocumentTemplate['type']) => {
    switch (type) {
      case 'report': return 'bg-blue-100 text-blue-800'
      case 'certificate': return 'bg-green-100 text-green-800'
      case 'inspection': return 'bg-yellow-100 text-yellow-800'
      case 'notification': return 'bg-purple-100 text-purple-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  const getTypeLabel = (type: DocumentTemplate['type']) => {
    switch (type) {
      case 'report': return '보고서'
      case 'certificate': return '허가증'
      case 'inspection': return '점검표'
      case 'notification': return '통지서'
      default: return '기타'
    }
  }

  const getTriggerColor = (trigger: AutomationRule['trigger']) => {
    switch (trigger) {
      case 'schedule': return 'bg-blue-100 text-blue-800'
      case 'event': return 'bg-orange-100 text-orange-800'
      case 'manual': return 'bg-gray-100 text-gray-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  const getTriggerLabel = (trigger: AutomationRule['trigger']) => {
    switch (trigger) {
      case 'schedule': return '일정'
      case 'event': return '이벤트'
      case 'manual': return '수동'
      default: return '기타'
    }
  }

  return (
    <AdminLayout 
      title="문서 자동화"
      description="문서 템플릿 및 자동화 규칙 관리"
      actions={
        <div className="flex gap-1.5 sm:gap-2">
          <button
            onClick={() => {
              setModalType('template')
              setSelectedItem(null)
              setIsModalOpen(true)
            }}
            className="flex items-center gap-1 sm:gap-1.5 md:gap-2 px-2.5 sm:px-3 md:px-4 py-1.5 sm:py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs sm:text-sm font-medium rounded-lg transition-colors"
          >
            <Plus className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            <span className="hidden sm:inline">템플릿 추가</span>
            <span className="sm:hidden">템플릿</span>
          </button>
          <button
            onClick={() => {
              setModalType('rule')
              setSelectedItem(null)
              setIsModalOpen(true)
            }}
            className="flex items-center gap-1 sm:gap-1.5 md:gap-2 px-2.5 sm:px-3 md:px-4 py-1.5 sm:py-2 bg-green-600 hover:bg-green-700 text-white text-xs sm:text-sm font-medium rounded-lg transition-colors"
          >
            <Zap className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            <span className="hidden sm:inline">규칙 추가</span>
            <span className="sm:hidden">규칙</span>
          </button>
        </div>
      }
    >
      <div className="space-y-3 sm:space-y-4 md:space-y-6">
        {/* Tab Navigation */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200">
          <div className="border-b border-gray-200">
            <nav className="flex overflow-x-auto">
              {[
                { id: 'estimate', name: '견적서 관리', icon: FileText },
                { id: 'contract', name: '계약서 관리', icon: FileCheck },
                { id: 'purchase_order', name: '발주서 관리', icon: ShoppingCart },
                { id: 'templates', name: '문서 템플릿', icon: FileText },
                { id: 'rules', name: '자동화 규칙', icon: Settings },
                { id: 'history', name: '실행 이력', icon: Clock }
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as any)}
                  className={`flex items-center gap-1 sm:gap-1.5 md:gap-2 px-3 sm:px-4 md:px-6 py-2 sm:py-3 md:py-4 text-xs sm:text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                    activeTab === tab.id
                      ? 'border-blue-500 text-blue-600 bg-blue-50'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                >
                  <tab.icon className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                  <span className="hidden sm:inline">{tab.name}</span>
                  <span className="sm:hidden">{tab.name.split(' ')[0]}</span>
                </button>
              ))}
            </nav>
          </div>

          <div className="p-3 sm:p-4 md:p-6">
            {activeTab === 'estimate' && (
              <EstimateManagement />
            )}

            {activeTab === 'contract' && (
              <ContractManagement />
            )}

            {activeTab === 'templates' && (
              <div className="space-y-4">
                {isLoading ? (
                  <div className="flex items-center justify-center py-12">
                    <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
                  </div>
                ) : (
                  templates.map((template) => (
                    <div key={template.id} className="bg-gray-50 rounded-lg p-4 hover:bg-gray-100 transition-colors">
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-2">
                            <h3 className="font-medium text-gray-900">{template.name}</h3>
                            <span className={`px-2 py-1 rounded-full text-xs font-medium ${getTypeColor(template.type)}`}>
                              {getTypeLabel(template.type)}
                            </span>
                            <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                              template.status === 'active' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                            }`}>
                              {template.status === 'active' ? '활성' : '비활성'}
                            </span>
                          </div>
                          <p className="text-sm text-gray-600 mb-2">{template.description}</p>
                          <div className="flex items-center gap-4 text-xs text-gray-500">
                            <span>사용 횟수: {template.usage_count}</span>
                            <span>마지막 수정: {template.updated_at}</span>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <button className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors">
                            <Eye className="w-4 h-4" />
                          </button>
                          <button className="p-2 text-gray-400 hover:text-green-600 hover:bg-green-50 rounded-lg transition-colors">
                            <Download className="w-4 h-4" />
                          </button>
                          <button className="p-2 text-gray-400 hover:text-orange-600 hover:bg-orange-50 rounded-lg transition-colors">
                            <Edit className="w-4 h-4" />
                          </button>
                          <button className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors">
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}

            {activeTab === 'rules' && (
              <div className="space-y-4">
                {isLoading ? (
                  <div className="flex items-center justify-center py-12">
                    <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
                  </div>
                ) : (
                  rules.map((rule) => (
                    <div key={rule.id} className="bg-gray-50 rounded-lg p-4 hover:bg-gray-100 transition-colors">
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-2">
                            <h3 className="font-medium text-gray-900">{rule.name}</h3>
                            <span className={`px-2 py-1 rounded-full text-xs font-medium ${getTriggerColor(rule.trigger)}`}>
                              {getTriggerLabel(rule.trigger)}
                            </span>
                            <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                              rule.status === 'active' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                            }`}>
                              {rule.status === 'active' ? '활성' : '비활성'}
                            </span>
                          </div>
                          <p className="text-sm text-gray-600 mb-2">{rule.description}</p>
                          <div className="flex items-center gap-4 text-xs text-gray-500">
                            {rule.last_run && <span>마지막 실행: {rule.last_run}</span>}
                            {rule.next_run && <span>다음 실행: {rule.next_run}</span>}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <button className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors">
                            <Eye className="w-4 h-4" />
                          </button>
                          <button className="p-2 text-gray-400 hover:text-green-600 hover:bg-green-50 rounded-lg transition-colors">
                            <RefreshCw className="w-4 h-4" />
                          </button>
                          <button className="p-2 text-gray-400 hover:text-orange-600 hover:bg-orange-50 rounded-lg transition-colors">
                            <Edit className="w-4 h-4" />
                          </button>
                          <button className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors">
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}

            {activeTab === 'purchase_order' && (
              <div className="space-y-4">
                {/* 검색 및 새로고침 */}
                <div className="flex items-center justify-between gap-2 sm:gap-3">
                  <div className="flex-1">
                    <input
                      type="text"
                      placeholder="사업장명으로 검색..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="w-full px-2.5 sm:px-3 md:px-4 py-1.5 sm:py-2 text-xs sm:text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <button
                    onClick={loadBusinessesForPurchaseOrder}
                    disabled={loadingBusinesses}
                    className="flex items-center gap-1 sm:gap-1.5 md:gap-2 px-2.5 sm:px-3 md:px-4 py-1.5 sm:py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs sm:text-sm rounded-lg transition-colors disabled:bg-gray-400 whitespace-nowrap"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 sm:w-4 sm:h-4 ${loadingBusinesses ? 'animate-spin' : ''}`} />
                    <span className="hidden sm:inline">새로고침</span>
                    <span className="sm:hidden">새로</span>
                  </button>
                </div>

                {/* 안내 메시지 */}
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 sm:p-4">
                  <div className="flex items-start gap-2 sm:gap-3">
                    <ShoppingCart className="w-4 h-4 sm:w-4.5 sm:h-4.5 text-blue-600 mt-0.5 shrink-0" />
                    <div>
                      <h4 className="font-medium text-blue-900 mb-1 text-xs sm:text-sm">발주서 자동 생성</h4>
                      <p className="text-[11px] sm:text-xs text-blue-700 leading-relaxed">
                        발주 필요 단계(product_order)에 있는 사업장을 선택하면 등록된 측정기기 정보를 바탕으로 발주서를 자동으로 생성합니다.
                        엑셀 또는 PDF 형식으로 다운로드할 수 있습니다.
                      </p>
                    </div>
                  </div>
                </div>

                {/* 사업장 목록 */}
                {loadingBusinesses ? (
                  <div className="flex items-center justify-center py-12">
                    <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
                  </div>
                ) : businesses.length === 0 ? (
                  <div className="bg-gray-50 rounded-lg p-4 sm:p-6 text-center">
                    <AlertTriangle className="w-10 h-10 sm:w-12 sm:h-12 text-gray-400 mx-auto mb-3 sm:mb-4" />
                    <h3 className="text-base sm:text-lg font-medium text-gray-900 mb-2">발주 필요 사업장이 없습니다</h3>
                    <p className="text-sm sm:text-base text-gray-500 mb-3 sm:mb-4">
                      발주 관리 페이지에서 사업장을 "발주 필요(product_order)" 단계로 이동시켜주세요.
                    </p>
                    <button
                      onClick={() => window.location.href = '/admin/order-management'}
                      className="px-3 sm:px-4 py-1.5 sm:py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs sm:text-sm rounded-lg transition-colors"
                    >
                      발주 관리로 이동
                    </button>
                  </div>
                ) : (
                  <div className="space-y-2 sm:space-y-3">
                    {/* 필터링된 사업장 목록 */}
                    {businesses
                      .filter((business) =>
                        !searchTerm ||
                        business.business_name?.toLowerCase().includes(searchTerm.toLowerCase())
                      )
                      .map((business) => (
                        <div
                          key={business.id}
                          className="bg-white rounded-lg border border-gray-200 p-3 sm:p-4 hover:border-blue-500 hover:shadow-md transition-all cursor-pointer"
                          onClick={() => {
                            setSelectedBusiness({
                              id: business.business_id,
                              name: business.business_name
                            })
                            setIsPurchaseOrderModalOpen(true)
                          }}
                        >
                          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 sm:gap-3 mb-2">
                                <h3 className="font-semibold text-sm sm:text-base text-gray-900 truncate">
                                  {business.business_name}
                                </h3>
                                {business.manufacturer && (
                                  <span className="px-1.5 sm:px-2 py-0.5 sm:py-1 bg-blue-100 text-blue-800 text-[10px] sm:text-xs font-medium rounded whitespace-nowrap">
                                    {business.manufacturer === 'ecosense' && '에코센스'}
                                    {business.manufacturer === 'gaia_cns' && '가이아씨앤에스'}
                                    {business.manufacturer === 'cleanearth' && '크린어스'}
                                    {business.manufacturer === 'evs' && 'EVS'}
                                  </span>
                                )}
                              </div>
                              {business.address && (
                                <p className="text-xs sm:text-sm text-gray-600 mb-1 truncate">
                                  📍 {business.address}
                                </p>
                              )}
                              <div className="flex items-center gap-3 sm:gap-4 text-[10px] sm:text-xs text-gray-500">
                                <span>진행률: {business.progress_percentage || 0}%</span>
                                <span>
                                  단계: {business.steps_completed || 0}/{business.steps_total || 0}
                                </span>
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation()
                                  setSelectedBusiness({
                                    id: business.business_id,
                                    name: business.business_name
                                  })
                                  setIsPurchaseOrderModalOpen(true)
                                }}
                                className="w-full sm:w-auto px-3 sm:px-4 py-1.5 sm:py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs sm:text-sm rounded-lg transition-colors whitespace-nowrap"
                              >
                                발주서 생성
                              </button>
                            </div>
                          </div>
                        </div>
                      ))}
                  </div>
                )}
              </div>
            )}

            {activeTab === 'history' && (
              <div className="space-y-6">
                {/* 통계 요약 */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2 sm:gap-3 md:gap-4">
                  <div className="bg-white p-3 sm:p-4 rounded-lg border border-gray-200">
                    <div className="text-xs sm:text-sm text-gray-500 mb-1">전체 문서</div>
                    <div className="text-xl sm:text-2xl font-bold text-gray-900">{historySummary.total_documents}</div>
                  </div>
                  <div className="bg-white p-3 sm:p-4 rounded-lg border border-gray-200">
                    <div className="text-xs sm:text-sm text-gray-500 mb-1">발주서</div>
                    <div className="text-xl sm:text-2xl font-bold text-blue-600">{historySummary.by_type.purchase_order}</div>
                  </div>
                  <div className="bg-white p-3 sm:p-4 rounded-lg border border-gray-200">
                    <div className="text-xs sm:text-sm text-gray-500 mb-1">견적서</div>
                    <div className="text-xl sm:text-2xl font-bold text-green-600">{historySummary.by_type.estimate}</div>
                  </div>
                  <div className="bg-white p-3 sm:p-4 rounded-lg border border-gray-200">
                    <div className="text-xs sm:text-sm text-gray-500 mb-1">계약서</div>
                    <div className="text-xl sm:text-2xl font-bold text-red-600">{historySummary.by_type.contract}</div>
                  </div>
                </div>

                {/* 필터 */}
                <div className="bg-white p-3 sm:p-4 rounded-lg border border-gray-200">
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-2 sm:gap-3 md:gap-4">
                    <div className="sm:col-span-2">
                      <input
                        type="text"
                        placeholder="사업장명 검색..."
                        value={historyFilter.search}
                        onChange={(e) => {
                          setHistoryFilter({ ...historyFilter, search: e.target.value })
                          setHistoryPagination({ ...historyPagination, page: 1 })
                        }}
                        className="w-full px-2.5 sm:px-3 py-1.5 sm:py-2 text-xs sm:text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      />
                    </div>
                    <select
                      value={historyFilter.document_type}
                      onChange={(e) => {
                        setHistoryFilter({ ...historyFilter, document_type: e.target.value })
                        setHistoryPagination({ ...historyPagination, page: 1 })
                      }}
                      className="px-2.5 sm:px-3 py-1.5 sm:py-2 text-xs sm:text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    >
                      <option value="">전체 문서</option>
                      <option value="purchase_order">발주서</option>
                      <option value="estimate">견적서</option>
                      <option value="contract">계약서</option>
                      <option value="other">기타</option>
                    </select>
                    <select
                      value={historyFilter.file_format}
                      onChange={(e) => {
                        setHistoryFilter({ ...historyFilter, file_format: e.target.value })
                        setHistoryPagination({ ...historyPagination, page: 1 })
                      }}
                      className="px-2.5 sm:px-3 py-1.5 sm:py-2 text-xs sm:text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    >
                      <option value="">전체 형식</option>
                      <option value="excel">Excel</option>
                      <option value="pdf">PDF</option>
                    </select>
                    <button
                      onClick={() => {
                        setHistoryFilter({ search: '', document_type: '', file_format: '', start_date: '', end_date: '' })
                        setHistoryPagination({ ...historyPagination, page: 1 })
                      }}
                      className="px-3 sm:px-4 py-1.5 sm:py-2 text-xs sm:text-sm text-gray-600 hover:text-gray-900 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                    >
                      초기화
                    </button>
                  </div>
                </div>

                {/* 이력 테이블 */}
                {loadingHistory ? (
                  <div className="text-center py-12">
                    <RefreshCw className="w-8 h-8 text-blue-600 animate-spin mx-auto mb-4" />
                    <p className="text-gray-500">문서 이력을 불러오는 중...</p>
                  </div>
                ) : documentHistory.length === 0 ? (
                  <div className="text-center py-8 sm:py-12 bg-white rounded-lg border border-gray-200">
                    <FileText className="w-10 h-10 sm:w-12 sm:h-12 text-gray-400 mx-auto mb-3 sm:mb-4" />
                    <h3 className="text-base sm:text-lg font-medium text-gray-900 mb-2">문서 이력 없음</h3>
                    <p className="text-sm sm:text-base text-gray-500 px-4">발주서 관리 탭에서 문서를 생성하면 이력이 표시됩니다.</p>
                  </div>
                ) : (
                  <>
                    {/* Mobile card view */}
                    <div className="md:hidden space-y-2 sm:space-y-3">
                      {documentHistory.map((doc: any) => (
                        <div key={doc.id} className="bg-white border border-gray-200 rounded-lg p-3 sm:p-4">
                          {/* Business name and badges */}
                          <div className="flex items-start justify-between gap-2 mb-2">
                            <div className="flex-1 min-w-0">
                              <h3 className="font-semibold text-sm text-gray-900 truncate">{doc.business_name}</h3>
                              {doc.address && (
                                <p className="text-[10px] sm:text-xs text-gray-500 truncate">{doc.address}</p>
                              )}
                            </div>
                            <div className="flex gap-1 shrink-0">
                              <span className={`px-1.5 py-0.5 text-[10px] font-semibold rounded-full whitespace-nowrap ${
                                doc.document_type === 'purchase_order' ? 'bg-blue-100 text-blue-800' :
                                doc.document_type === 'estimate' ? 'bg-green-100 text-green-800' :
                                doc.document_type === 'contract' ? 'bg-purple-100 text-purple-800' :
                                'bg-gray-100 text-gray-800'
                              }`}>
                                {doc.document_type === 'purchase_order' ? '발주서' :
                                 doc.document_type === 'estimate' ? '견적서' :
                                 doc.document_type === 'contract' ? '계약서' : '기타'}
                              </span>
                              <span className={`px-1.5 py-0.5 text-[10px] font-semibold rounded-full whitespace-nowrap ${
                                doc.file_format === 'excel' ? 'bg-green-100 text-green-800' :
                                doc.file_format === 'pdf' ? 'bg-red-100 text-red-800' :
                                'bg-gray-100 text-gray-800'
                              }`}>
                                {doc.file_format === 'excel' ? 'Excel' :
                                 doc.file_format === 'pdf' ? 'PDF' : doc.file_format}
                              </span>
                            </div>
                          </div>

                          {/* Document name */}
                          <p className="text-xs sm:text-sm text-gray-700 mb-2 break-words">{doc.document_name}</p>

                          {/* Info grid */}
                          <div className="grid grid-cols-2 gap-2 mb-3 text-[10px] sm:text-xs">
                            <div>
                              <span className="text-gray-500">생성일</span>
                              <p className="text-gray-900 font-medium">
                                {new Date(doc.created_at).toLocaleString('ko-KR', {
                                  year: 'numeric',
                                  month: '2-digit',
                                  day: '2-digit',
                                  hour: '2-digit',
                                  minute: '2-digit'
                                })}
                              </p>
                            </div>
                            <div>
                              <span className="text-gray-500">생성자</span>
                              <p className="text-gray-900 font-medium truncate">{doc.created_by_name || '-'}</p>
                              {doc.created_by_email && (
                                <p className="text-gray-500 truncate">{doc.created_by_email}</p>
                              )}
                            </div>
                          </div>

                          {/* Action buttons */}
                          <div className="flex items-center gap-2">
                            {doc.document_type === 'purchase_order' && doc.document_data && (
                              <button
                                onClick={() => setPreviewDocument(doc)}
                                className="flex-1 flex items-center justify-center gap-1 px-3 py-1.5 text-green-600 hover:text-green-900 border border-green-200 hover:border-green-300 rounded-lg transition-colors text-xs"
                              >
                                <Eye className="w-3.5 h-3.5" />
                                보기
                              </button>
                            )}
                            {doc.file_path ? (
                              <button
                                onClick={async () => {
                                  try {
                                    const { createClient } = await import('@supabase/supabase-js')
                                    const supabase = createClient(
                                      process.env.NEXT_PUBLIC_SUPABASE_URL!,
                                      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
                                    )

                                    const { data: urlData } = supabase.storage
                                      .from('facility-files')
                                      .getPublicUrl(doc.file_path)

                                    if (urlData?.publicUrl) {
                                      window.open(urlData.publicUrl, '_blank')
                                    } else {
                                      alert('파일 URL을 가져올 수 없습니다.')
                                    }
                                  } catch (error) {
                                    console.error('다운로드 오류:', error)
                                    alert('파일 다운로드 중 오류가 발생했습니다.')
                                  }
                                }}
                                className="flex-1 flex items-center justify-center gap-1 px-3 py-1.5 text-blue-600 hover:text-blue-900 border border-blue-200 hover:border-blue-300 rounded-lg transition-colors text-xs"
                              >
                                <Download className="w-3.5 h-3.5" />
                                다운로드
                              </button>
                            ) : (
                              <span className="flex-1 text-center text-gray-400 text-xs py-1.5">파일 없음</span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* Desktop table view */}
                    <div className="hidden md:block bg-white rounded-lg border border-gray-200 overflow-hidden">
                      <div className="overflow-x-auto">
                      <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                          <tr>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                              사업장명
                            </th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                              문서명
                            </th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                              문서타입
                            </th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                              형식
                            </th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                              생성일
                            </th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                              생성자
                            </th>
                            <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                              작업
                            </th>
                          </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                          {documentHistory.map((doc: any) => (
                            <tr key={doc.id} className="hover:bg-gray-50">
                              <td className="px-6 py-4 whitespace-nowrap">
                                <div className="text-sm font-medium text-gray-900">{doc.business_name}</div>
                                {doc.address && (
                                  <div className="text-sm text-gray-500">{doc.address}</div>
                                )}
                              </td>
                              <td className="px-6 py-4">
                                <div className="text-sm text-gray-900">{doc.document_name}</div>
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap">
                                <span className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${
                                  doc.document_type === 'purchase_order' ? 'bg-blue-100 text-blue-800' :
                                  doc.document_type === 'estimate' ? 'bg-green-100 text-green-800' :
                                  doc.document_type === 'contract' ? 'bg-purple-100 text-purple-800' :
                                  'bg-gray-100 text-gray-800'
                                }`}>
                                  {doc.document_type === 'purchase_order' ? '발주서' :
                                   doc.document_type === 'estimate' ? '견적서' :
                                   doc.document_type === 'contract' ? '계약서' : '기타'}
                                </span>
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap">
                                <span className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${
                                  doc.file_format === 'excel' ? 'bg-green-100 text-green-800' :
                                  doc.file_format === 'pdf' ? 'bg-red-100 text-red-800' :
                                  'bg-gray-100 text-gray-800'
                                }`}>
                                  {doc.file_format === 'excel' ? 'Excel' :
                                   doc.file_format === 'pdf' ? 'PDF' : doc.file_format}
                                </span>
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                {new Date(doc.created_at).toLocaleString('ko-KR', {
                                  year: 'numeric',
                                  month: '2-digit',
                                  day: '2-digit',
                                  hour: '2-digit',
                                  minute: '2-digit'
                                })}
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap">
                                <div className="text-sm text-gray-900">{doc.created_by_name || '-'}</div>
                                {doc.created_by_email && (
                                  <div className="text-sm text-gray-500">{doc.created_by_email}</div>
                                )}
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                <div className="flex items-center justify-end gap-2">
                                  {/* 보기 버튼 (발주서 & 견적서) */}
                                  {doc.document_type === 'purchase_order' && doc.document_data && (
                                    <button
                                      onClick={() => setPreviewDocument(doc)}
                                      className="text-green-600 hover:text-green-900 inline-flex items-center gap-1"
                                      title="발주서 보기"
                                    >
                                      <Eye className="w-4 h-4" />
                                      보기
                                    </button>
                                  )}
                                  {doc.document_type === 'estimate' && doc.metadata && (
                                    <button
                                      onClick={() => setPreviewDocument(doc)}
                                      className="text-green-600 hover:text-green-900 inline-flex items-center gap-1"
                                      title="견적서 보기"
                                    >
                                      <Eye className="w-4 h-4" />
                                      보기
                                    </button>
                                  )}

                                  {/* 다운로드 버튼 */}
                                  {doc.file_path ? (
                                    <button
                                      onClick={async () => {
                                        try {
                                          // Supabase Storage에서 공개 URL 가져오기
                                          const { createClient } = await import('@supabase/supabase-js')
                                          const supabase = createClient(
                                            process.env.NEXT_PUBLIC_SUPABASE_URL!,
                                            process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
                                          )

                                          const { data: urlData } = supabase.storage
                                            .from('facility-files')
                                            .getPublicUrl(doc.file_path)

                                          if (urlData?.publicUrl) {
                                            // 새 탭에서 파일 열기
                                            window.open(urlData.publicUrl, '_blank')
                                          } else {
                                            alert('파일 URL을 가져올 수 없습니다.')
                                          }
                                        } catch (error) {
                                          console.error('다운로드 오류:', error)
                                          alert('파일 다운로드 중 오류가 발생했습니다.')
                                        }
                                      }}
                                      className="text-blue-600 hover:text-blue-900 inline-flex items-center gap-1"
                                    >
                                      <Download className="w-4 h-4" />
                                      다운로드
                                    </button>
                                  ) : (
                                    <span className="text-gray-400 text-xs">
                                      -
                                    </span>
                                  )}

                                  {/* 삭제 버튼 (슈퍼관리자만) */}
                                  {userPermissionLevel >= 4 && (
                                    <button
                                      onClick={() => deleteDocumentHistory(doc.id, doc.document_type)}
                                      className="text-red-600 hover:text-red-900 inline-flex items-center gap-1"
                                      title="삭제"
                                    >
                                      <Trash2 className="w-4 h-4" />
                                      삭제
                                    </button>
                                  )}
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                      </div>
                    </div>
                  </>
                )}

                {/* 페이지네이션 */}
                {!loadingHistory && documentHistory.length > 0 && (
                  <div className="flex items-center justify-between bg-white px-3 sm:px-4 py-2.5 sm:py-3 border border-gray-200 rounded-lg">
                    <div className="flex-1 flex justify-between sm:hidden">
                      <button
                        onClick={() => setHistoryPagination({ ...historyPagination, page: Math.max(1, historyPagination.page - 1) })}
                        disabled={historyPagination.page === 1}
                        className="relative inline-flex items-center px-3 py-1.5 border border-gray-300 text-xs font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        이전
                      </button>
                      <span className="text-xs text-gray-700">
                        {historyPagination.page} / {historyPagination.total_pages}
                      </span>
                      <button
                        onClick={() => setHistoryPagination({ ...historyPagination, page: Math.min(historyPagination.total_pages, historyPagination.page + 1) })}
                        disabled={historyPagination.page === historyPagination.total_pages}
                        className="relative inline-flex items-center px-3 py-1.5 border border-gray-300 text-xs font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        다음
                      </button>
                    </div>
                    <div className="hidden sm:flex-1 sm:flex sm:items-center sm:justify-between">
                      <div>
                        <p className="text-sm text-gray-700">
                          전체 <span className="font-medium">{historyPagination.total}</span>개 중{' '}
                          <span className="font-medium">{(historyPagination.page - 1) * historyPagination.limit + 1}</span>
                          {' '}-{' '}
                          <span className="font-medium">
                            {Math.min(historyPagination.page * historyPagination.limit, historyPagination.total)}
                          </span>
                          {' '}표시
                        </p>
                      </div>
                      <div>
                        <nav className="relative z-0 inline-flex rounded-md shadow-sm -space-x-px">
                          <button
                            onClick={() => setHistoryPagination({ ...historyPagination, page: Math.max(1, historyPagination.page - 1) })}
                            disabled={historyPagination.page === 1}
                            className="relative inline-flex items-center px-2 py-2 rounded-l-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            이전
                          </button>
                          {[...Array(Math.min(5, historyPagination.total_pages))].map((_, idx) => {
                            const pageNum = idx + 1
                            return (
                              <button
                                key={pageNum}
                                onClick={() => setHistoryPagination({ ...historyPagination, page: pageNum })}
                                className={`relative inline-flex items-center px-4 py-2 border text-sm font-medium ${
                                  historyPagination.page === pageNum
                                    ? 'z-10 bg-blue-50 border-blue-500 text-blue-600'
                                    : 'bg-white border-gray-300 text-gray-500 hover:bg-gray-50'
                                }`}
                              >
                                {pageNum}
                              </button>
                            )
                          })}
                          <button
                            onClick={() => setHistoryPagination({ ...historyPagination, page: Math.min(historyPagination.total_pages, historyPagination.page + 1) })}
                            disabled={historyPagination.page === historyPagination.total_pages}
                            className="relative inline-flex items-center px-2 py-2 rounded-r-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            다음
                          </button>
                        </nav>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 발주서 생성 모달 */}
      {isPurchaseOrderModalOpen && selectedBusiness && (
        <PurchaseOrderModal
          isOpen={isPurchaseOrderModalOpen}
          onClose={() => {
            setIsPurchaseOrderModalOpen(false)
            setSelectedBusiness(null)
          }}
          businessId={selectedBusiness.id}
          businessName={selectedBusiness.name}
        />
      )}

      {/* 발주서 미리보기 모달 */}
      {previewDocument && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-2 sm:p-3 md:p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-full sm:max-w-[98vw] md:max-w-[95vw] lg:max-w-7xl h-[95vh] sm:h-auto sm:max-h-[95vh] flex flex-col">
            {/* 헤더 */}
            <div className="flex items-center justify-between p-3 sm:p-4 border-b border-gray-200 flex-shrink-0">
              <div className="flex-1 min-w-0 mr-2">
                <h2 className="text-sm sm:text-base md:text-lg font-bold text-gray-900 truncate">
                  {previewDocument.document_type === 'estimate' ? '견적서 미리보기' : '발주서 미리보기'}
                </h2>
                <p className="text-[10px] sm:text-xs md:text-sm text-gray-500 mt-0.5 sm:mt-1 truncate">
                  {previewDocument.business_name} - {previewDocument.document_name}
                </p>
              </div>
              <button
                onClick={() => setPreviewDocument(null)}
                className="p-1.5 sm:p-2 hover:bg-gray-100 rounded-lg transition-colors shrink-0"
              >
                <X className="w-4 h-4 sm:w-5 sm:h-5" />
              </button>
            </div>

            {/* 내용 */}
            <div className="flex-1 overflow-y-auto p-2 sm:p-3 md:p-4 lg:p-6 min-h-0">
              <div className="max-w-5xl mx-auto text-sm">
                {previewDocument.document_type === 'purchase_order' ? (
                  <EcosensePurchaseOrderForm
                    data={previewDocument.document_data}
                    showPrintButton={false}
                  />
                ) : previewDocument.document_type === 'estimate' && previewDocument.metadata ? (
                  <div className="bg-white p-6 rounded-lg shadow">
                    <h1 className="text-2xl font-bold text-center mb-6">IoT 설치 견적서</h1>

                    {/* 공급받는자 / 공급자 */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                      {/* 공급받는자 */}
                      <div className="border border-gray-300 rounded">
                        <div className="bg-blue-50 px-3 py-2 border-b border-gray-300">
                          <h3 className="font-bold text-sm">공급받는자</h3>
                        </div>
                        <div className="p-3 space-y-1 text-xs">
                          <div className="grid grid-cols-3 gap-2">
                            <span className="text-gray-600">상호:</span>
                            <span className="col-span-2 font-medium">{previewDocument.metadata.business_name}</span>
                          </div>
                          <div className="grid grid-cols-3 gap-2">
                            <span className="text-gray-600">사업장주소:</span>
                            <span className="col-span-2">{previewDocument.metadata.customer_address}</span>
                          </div>
                          <div className="grid grid-cols-3 gap-2">
                            <span className="text-gray-600">전화:</span>
                            <span className="col-span-2">{previewDocument.metadata.customer_phone}</span>
                          </div>
                          <div className="grid grid-cols-3 gap-2">
                            <span className="text-gray-600">담당자:</span>
                            <span className="col-span-2">{previewDocument.metadata.customer_manager}</span>
                          </div>
                          <div className="grid grid-cols-3 gap-2">
                            <span className="text-gray-600">담당자연락처:</span>
                            <span className="col-span-2">{previewDocument.metadata.customer_manager_contact}</span>
                          </div>
                        </div>
                      </div>

                      {/* 공급자 */}
                      <div className="border border-gray-300 rounded">
                        <div className="bg-green-50 px-3 py-2 border-b border-gray-300">
                          <h3 className="font-bold text-sm">공급자</h3>
                        </div>
                        <div className="p-3 space-y-1 text-xs">
                          <div className="grid grid-cols-3 gap-2">
                            <span className="text-gray-600">상호:</span>
                            <span className="col-span-2 font-medium">{previewDocument.metadata.supplier_info?.company_name}</span>
                          </div>
                          <div className="grid grid-cols-3 gap-2">
                            <span className="text-gray-600">사업자번호:</span>
                            <span className="col-span-2">{previewDocument.metadata.supplier_info?.registration_number}</span>
                          </div>
                          <div className="grid grid-cols-3 gap-2">
                            <span className="text-gray-600">대표자:</span>
                            <span className="col-span-2">{previewDocument.metadata.supplier_info?.representative}</span>
                          </div>
                          <div className="grid grid-cols-3 gap-2">
                            <span className="text-gray-600">주소:</span>
                            <span className="col-span-2">{previewDocument.metadata.supplier_info?.address}</span>
                          </div>
                          <div className="grid grid-cols-3 gap-2">
                            <span className="text-gray-600">전화:</span>
                            <span className="col-span-2">{previewDocument.metadata.supplier_info?.phone}</span>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* 품목 테이블 */}
                    <div className="overflow-x-auto mb-4">
                      <table className="w-full border-collapse border border-gray-300 text-xs">
                        <thead className="bg-gray-100">
                          <tr>
                            <th className="border border-gray-300 px-2 py-2 w-12">No</th>
                            <th className="border border-gray-300 px-2 py-2">품명</th>
                            <th className="border border-gray-300 px-2 py-2 w-20">규격</th>
                            <th className="border border-gray-300 px-2 py-2 w-16">수량</th>
                            <th className="border border-gray-300 px-2 py-2 w-24">단가</th>
                            <th className="border border-gray-300 px-2 py-2 w-24">공급가액</th>
                            <th className="border border-gray-300 px-2 py-2 w-20">부가세</th>
                          </tr>
                        </thead>
                        <tbody>
                          {previewDocument.metadata.estimate_items?.map((item: any) => (
                            <tr key={item.no}>
                              <td className="border border-gray-300 px-2 py-1 text-center">{item.no}</td>
                              <td className="border border-gray-300 px-2 py-1">{item.name}</td>
                              <td className="border border-gray-300 px-2 py-1 text-center">{item.spec}</td>
                              <td className="border border-gray-300 px-2 py-1 text-right">{item.quantity}</td>
                              <td className="border border-gray-300 px-2 py-1 text-right">
                                {item.unit_price.toLocaleString()}
                              </td>
                              <td className="border border-gray-300 px-2 py-1 text-right">
                                {item.supply_amount.toLocaleString()}
                              </td>
                              <td className="border border-gray-300 px-2 py-1 text-right">
                                {item.vat_amount.toLocaleString()}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    {/* 참고사항 */}
                    {previewDocument.metadata.reference_notes && (
                      <div className="bg-gray-50 border border-gray-200 rounded p-4 mb-4">
                        <h3 className="font-bold text-sm mb-2">참고사항</h3>
                        <div className="text-xs text-gray-700 whitespace-pre-wrap">
                          {previewDocument.metadata.reference_notes}
                        </div>
                      </div>
                    )}

                    {/* 합계 */}
                    <div className="bg-yellow-50 border border-yellow-300 rounded p-4 mb-4">
                      <div className="grid grid-cols-3 gap-4 text-sm">
                        <div className="text-center">
                          <div className="text-gray-600 mb-1">공급가액</div>
                          <div className="text-lg font-bold">
                            ₩{previewDocument.metadata.subtotal.toLocaleString()}
                          </div>
                        </div>
                        <div className="text-center">
                          <div className="text-gray-600 mb-1">부가세</div>
                          <div className="text-lg font-bold">
                            ₩{previewDocument.metadata.vat_amount.toLocaleString()}
                          </div>
                        </div>
                        <div className="text-center">
                          <div className="text-gray-600 mb-1">합계금액</div>
                          <div className="text-xl font-bold text-blue-600">
                            ₩{previewDocument.metadata.total_amount.toLocaleString()}
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* 안내사항 */}
                    {previewDocument.metadata.terms_and_conditions && (
                      <div className="bg-gray-50 border border-gray-200 rounded p-4">
                        <h3 className="font-bold text-sm mb-2">안내사항</h3>
                        <div className="text-xs text-gray-700 whitespace-pre-wrap">
                          {previewDocument.metadata.terms_and_conditions}
                        </div>
                      </div>
                    )}

                    {/* 대기배출시설 허가증 */}
                    {previewDocument.metadata.air_permit && (
                      <div className="mt-6 border-t-2 border-blue-600 pt-6">
                        <div className="text-center mb-6 border-b-2 border-blue-600 pb-3">
                          <h2 className="text-xl font-bold mb-1">대기배출시설 허가증</h2>
                          <p className="text-sm text-gray-600">{previewDocument.metadata.business_name}</p>
                        </div>

                        {/* 기본 정보 */}
                        <div className="mb-6">
                          <h3 className="text-sm font-bold text-blue-600 mb-3 border-l-3 border-blue-600 pl-2">기본 정보</h3>
                          <div className="grid grid-cols-4 gap-2 text-xs">
                            <div className="col-span-1 bg-gray-100 p-2 border font-semibold">업종</div>
                            <div className="col-span-1 p-2 border">{previewDocument.metadata.air_permit.business_type || '-'}</div>
                            <div className="col-span-1 bg-gray-100 p-2 border font-semibold">종별</div>
                            <div className="col-span-1 p-2 border">{previewDocument.metadata.air_permit.category || '-'}</div>
                            <div className="col-span-1 bg-gray-100 p-2 border font-semibold">최초신고일</div>
                            <div className="col-span-1 p-2 border">{previewDocument.metadata.air_permit.first_report_date || '-'}</div>
                            <div className="col-span-1 bg-gray-100 p-2 border font-semibold">가동개시일</div>
                            <div className="col-span-1 p-2 border">{previewDocument.metadata.air_permit.operation_start_date || '-'}</div>
                          </div>
                        </div>

                        {/* 배출시설 */}
                        <div className="mb-6">
                          <h3 className="text-sm font-bold text-red-600 mb-3 bg-red-50 p-2 border-l-3 border-red-600">🏭 배출시설</h3>
                          <div className="overflow-x-auto">
                            <table className="w-full border-collapse text-xs">
                              <thead className="bg-red-100">
                                <tr>
                                  <th className="border border-gray-300 px-2 py-2 text-center" style={{width: '8%'}}>시설<br/>번호</th>
                                  <th className="border border-gray-300 px-2 py-2 text-center" style={{width: '30%'}}>시설명</th>
                                  <th className="border border-gray-300 px-2 py-2 text-center" style={{width: '18%'}}>용량</th>
                                  <th className="border border-gray-300 px-2 py-2 text-center" style={{width: '10%'}}>수량</th>
                                  <th className="border border-gray-300 px-2 py-2 text-center" style={{width: '34%'}}>측정기기</th>
                                </tr>
                              </thead>
                              <tbody>
                                {previewDocument.metadata.air_permit.emission_facilities?.map((facility: any, idx: number) => (
                                  <tr key={idx}>
                                    <td className="border border-gray-300 px-2 py-2 text-center">{facility.facility_number || '-'}</td>
                                    <td className="border border-gray-300 px-2 py-2">{facility.name || '-'}</td>
                                    <td className="border border-gray-300 px-2 py-2 text-center">{facility.capacity || '-'}</td>
                                    <td className="border border-gray-300 px-2 py-2 text-center">{facility.quantity || '-'}</td>
                                    <td className="border border-gray-300 px-2 py-2">
                                      {facility.measuring_devices?.map((device: any) => `${device.device_name}(${device.quantity}개)`).join(', ') || '-'}
                                    </td>
                                  </tr>
                                ))}
                                {!previewDocument.metadata.air_permit.emission_facilities?.length && (
                                  <tr>
                                    <td colSpan={5} className="border border-gray-300 px-2 py-3 text-center text-gray-500">데이터 없음</td>
                                  </tr>
                                )}
                              </tbody>
                            </table>
                          </div>
                        </div>

                        {/* 방지시설 */}
                        <div>
                          <h3 className="text-sm font-bold text-green-600 mb-3 bg-green-50 p-2 border-l-3 border-green-600">🛡️ 방지시설</h3>
                          <div className="overflow-x-auto">
                            <table className="w-full border-collapse text-xs">
                              <thead className="bg-green-100">
                                <tr>
                                  <th className="border border-gray-300 px-2 py-2 text-center" style={{width: '8%'}}>시설<br/>번호</th>
                                  <th className="border border-gray-300 px-2 py-2 text-center" style={{width: '30%'}}>시설명</th>
                                  <th className="border border-gray-300 px-2 py-2 text-center" style={{width: '18%'}}>용량</th>
                                  <th className="border border-gray-300 px-2 py-2 text-center" style={{width: '10%'}}>수량</th>
                                  <th className="border border-gray-300 px-2 py-2 text-center" style={{width: '34%'}}>측정기기</th>
                                </tr>
                              </thead>
                              <tbody>
                                {previewDocument.metadata.air_permit.prevention_facilities?.map((facility: any, idx: number) => (
                                  <tr key={idx}>
                                    <td className="border border-gray-300 px-2 py-2 text-center">{facility.facility_number || '-'}</td>
                                    <td className="border border-gray-300 px-2 py-2">{facility.name || '-'}</td>
                                    <td className="border border-gray-300 px-2 py-2 text-center">{facility.capacity || '-'}</td>
                                    <td className="border border-gray-300 px-2 py-2 text-center">{facility.quantity || '-'}</td>
                                    <td className="border border-gray-300 px-2 py-2">
                                      {facility.measuring_devices?.map((device: any) => `${device.device_name}(${device.quantity}개)`).join(', ') || '-'}
                                    </td>
                                  </tr>
                                ))}
                                {!previewDocument.metadata.air_permit.prevention_facilities?.length && (
                                  <tr>
                                    <td colSpan={5} className="border border-gray-300 px-2 py-3 text-center text-gray-500">데이터 없음</td>
                                  </tr>
                                )}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                ) : null}
              </div>
            </div>

            {/* 푸터 */}
            <div className="flex items-center justify-end p-3 sm:p-4 border-t border-gray-200 bg-gray-50 flex-shrink-0">
              <button
                onClick={() => setPreviewDocument(null)}
                className="px-3 sm:px-4 py-1.5 sm:py-2 text-xs sm:text-sm text-gray-700 hover:bg-gray-200 rounded-lg transition-colors"
              >
                닫기
              </button>
            </div>
          </div>
        </div>
      )}
    </AdminLayout>
  )
}