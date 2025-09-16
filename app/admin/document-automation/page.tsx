// app/admin/document-automation/page.tsx - 문서 자동화 관리 페이지
'use client'

import { useState, useEffect } from 'react'
import AdminLayout from '@/components/ui/AdminLayout'
import StatsCard from '@/components/ui/StatsCard'
import { ConfirmModal } from '@/components/ui/Modal'
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
  Zap
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
  const [activeTab, setActiveTab] = useState<'templates' | 'rules' | 'history'>('templates')
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [modalType, setModalType] = useState<'template' | 'rule'>('template')
  const [selectedItem, setSelectedItem] = useState<DocumentTemplate | AutomationRule | null>(null)

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
    </AdminLayout>
  )
}