// app/admin/document-automation/page.tsx - 문서 자동화 관리 페이지
'use client'

import { useState, useEffect } from 'react'
import AdminLayout from '@/components/ui/AdminLayout'
import StatsCard from '@/components/ui/StatsCard'
import { ConfirmModal } from '@/components/ui/Modal'
import PurchaseOrderModal from './components/PurchaseOrderModal'
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
  ShoppingCart
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
  const [activeTab, setActiveTab] = useState<'templates' | 'rules' | 'purchase_order' | 'history'>('purchase_order')
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [modalType, setModalType] = useState<'template' | 'rule'>('template')
  const [selectedItem, setSelectedItem] = useState<DocumentTemplate | AutomationRule | null>(null)

  // 발주서 관련 상태
  const [businesses, setBusinesses] = useState<any[]>([])
  const [searchTerm, setSearchTerm] = useState('')
  const [isPurchaseOrderModalOpen, setIsPurchaseOrderModalOpen] = useState(false)
  const [selectedBusiness, setSelectedBusiness] = useState<{ id: string; name: string } | null>(null)
  const [loadingBusinesses, setLoadingBusinesses] = useState(false)

  // 발주 필요 사업장 목록 로드
  useEffect(() => {
    if (activeTab === 'purchase_order') {
      loadBusinessesForPurchaseOrder()
    }
  }, [activeTab])

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
        <div className="flex gap-2">
          <button 
            onClick={() => {
              setModalType('template')
              setSelectedItem(null)
              setIsModalOpen(true)
            }}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors"
          >
            <Plus className="w-4 h-4" />
            템플릿 추가
          </button>
          <button 
            onClick={() => {
              setModalType('rule')
              setSelectedItem(null)
              setIsModalOpen(true)
            }}
            className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white text-sm font-medium rounded-lg transition-colors"
          >
            <Zap className="w-4 h-4" />
            규칙 추가
          </button>
        </div>
      }
    >
      <div className="space-y-6">
        {/* Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <StatsCard
            title="전체 템플릿"
            value={stats.totalTemplates.toString()}
            icon={FileText}
            color="blue"
            description="등록된 문서 템플릿 수"
          />
          <StatsCard
            title="활성 템플릿"
            value={stats.activeTemplates.toString()}
            icon={CheckCircle}
            color="green"
            description="사용 중인 템플릿 수"
          />
          <StatsCard
            title="자동화 규칙"
            value={stats.totalRules.toString()}
            icon={Settings}
            color="purple"
            description="설정된 자동화 규칙 수"
          />
          <StatsCard
            title="활성 규칙"
            value={stats.activeRules.toString()}
            icon={Zap}
            color="orange"
            description="실행 중인 규칙 수"
          />
          <StatsCard
            title="총 사용량"
            value={stats.totalUsage.toString()}
            icon={Database}
            color="indigo"
            description="템플릿 총 사용 횟수"
          />
        </div>

        {/* Tab Navigation */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200">
          <div className="border-b border-gray-200">
            <nav className="flex">
              {[
                { id: 'purchase_order', name: '발주서 관리', icon: ShoppingCart },
                { id: 'templates', name: '문서 템플릿', icon: FileText },
                { id: 'rules', name: '자동화 규칙', icon: Settings },
                { id: 'history', name: '실행 이력', icon: Clock }
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as any)}
                  className={`flex items-center gap-2 px-6 py-4 text-sm font-medium border-b-2 transition-colors ${
                    activeTab === tab.id
                      ? 'border-blue-500 text-blue-600 bg-blue-50'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                >
                  <tab.icon className="w-4 h-4" />
                  {tab.name}
                </button>
              ))}
            </nav>
          </div>

          <div className="p-6">
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
                <div className="flex items-center justify-between gap-3">
                  <div className="flex-1">
                    <input
                      type="text"
                      placeholder="사업장명으로 검색..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <button
                    onClick={loadBusinessesForPurchaseOrder}
                    disabled={loadingBusinesses}
                    className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors disabled:bg-gray-400"
                  >
                    <RefreshCw className={`w-4 h-4 ${loadingBusinesses ? 'animate-spin' : ''}`} />
                    새로고침
                  </button>
                </div>

                {/* 안내 메시지 */}
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <div className="flex items-start gap-3">
                    <ShoppingCart className="w-5 h-5 text-blue-600 mt-0.5" />
                    <div>
                      <h4 className="font-medium text-blue-900 mb-1">발주서 자동 생성</h4>
                      <p className="text-sm text-blue-700">
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
                  <div className="bg-gray-50 rounded-lg p-6 text-center">
                    <AlertTriangle className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                    <h3 className="text-lg font-medium text-gray-900 mb-2">발주 필요 사업장이 없습니다</h3>
                    <p className="text-gray-500 mb-4">
                      발주 관리 페이지에서 사업장을 "발주 필요(product_order)" 단계로 이동시켜주세요.
                    </p>
                    <button
                      onClick={() => window.location.href = '/admin/order-management'}
                      className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
                    >
                      발주 관리로 이동
                    </button>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {/* 필터링된 사업장 목록 */}
                    {businesses
                      .filter((business) =>
                        !searchTerm ||
                        business.business_name?.toLowerCase().includes(searchTerm.toLowerCase())
                      )
                      .map((business) => (
                        <div
                          key={business.id}
                          className="bg-white rounded-lg border border-gray-200 p-4 hover:border-blue-500 hover:shadow-md transition-all cursor-pointer"
                          onClick={() => {
                            setSelectedBusiness({
                              id: business.business_id,
                              name: business.business_name
                            })
                            setIsPurchaseOrderModalOpen(true)
                          }}
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex-1">
                              <div className="flex items-center gap-3 mb-2">
                                <h3 className="font-semibold text-gray-900">
                                  {business.business_name}
                                </h3>
                                {business.manufacturer && (
                                  <span className="px-2 py-1 bg-blue-100 text-blue-800 text-xs font-medium rounded">
                                    {business.manufacturer === 'ecosense' && '에코센스'}
                                    {business.manufacturer === 'gaia_cns' && '가이아씨앤에스'}
                                    {business.manufacturer === 'cleanearth' && '크린어스'}
                                    {business.manufacturer === 'evs' && 'EVS'}
                                  </span>
                                )}
                              </div>
                              {business.address && (
                                <p className="text-sm text-gray-600 mb-1">
                                  📍 {business.address}
                                </p>
                              )}
                              <div className="flex items-center gap-4 text-xs text-gray-500">
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
                                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded-lg transition-colors"
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
              <div className="text-center py-12">
                <Clock className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">실행 이력</h3>
                <p className="text-gray-500">자동화 규칙의 실행 이력이 여기에 표시됩니다.</p>
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
    </AdminLayout>
  )
}