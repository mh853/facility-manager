'use client'

import { useState, useEffect } from 'react'
import AdminLayout from '@/components/ui/AdminLayout'
import {
  Plus,
  Search,
  Filter,
  MoreHorizontal,
  Calendar,
  User,
  Building2,
  AlertCircle,
  Clock,
  CheckCircle,
  PlayCircle,
  PauseCircle,
  Flag,
  ArrowRight,
  Edit,
  Trash2,
  Eye,
  X,
  ChevronDown,
  MapPin,
  Phone,
  Check,
  Loader2
} from 'lucide-react'

// 업무 타입 정의
type TaskType = 'self' | 'subsidy'
type TaskStatus =
  | 'customer_contact' | 'site_inspection' | 'quotation' | 'contract'
  | 'deposit_confirm' | 'product_order' | 'product_shipment' | 'installation_schedule'
  | 'installation' | 'balance_payment' | 'document_complete'
  // 보조금 전용 단계
  | 'application_submit' | 'document_supplement' | 'pre_construction_inspection'
  | 'pre_construction_supplement' | 'completion_inspection' | 'completion_supplement'
  | 'final_document_submit' | 'subsidy_payment'

type Priority = 'high' | 'medium' | 'low'

interface Task {
  id: string
  title: string
  businessName: string
  businessInfo?: {
    address: string
    contact: string
    manager: string
  }
  type: TaskType
  status: TaskStatus
  priority: Priority
  assignee?: string
  dueDate?: string
  createdAt: string
  description?: string
  notes?: string
}

// 더미 데이터 제거 - 실제 API에서 데이터 로딩

// 상태별 단계 정의 (자비)
const selfSteps: Array<{status: TaskStatus, label: string, color: string}> = [
  { status: 'customer_contact', label: '고객 상담', color: 'blue' },
  { status: 'site_inspection', label: '현장 실사', color: 'yellow' },
  { status: 'quotation', label: '견적서 작성', color: 'orange' },
  { status: 'contract', label: '계약 체결', color: 'purple' },
  { status: 'deposit_confirm', label: '계약금 확인', color: 'indigo' },
  { status: 'product_order', label: '제품 발주', color: 'cyan' },
  { status: 'product_shipment', label: '제품 출고', color: 'emerald' },
  { status: 'installation_schedule', label: '설치 협의', color: 'teal' },
  { status: 'installation', label: '제품 설치', color: 'green' },
  { status: 'balance_payment', label: '잔금 입금', color: 'lime' },
  { status: 'document_complete', label: '서류 발송 완료', color: 'green' }
]

// 상태별 단계 정의 (보조금)
const subsidySteps: Array<{status: TaskStatus, label: string, color: string}> = [
  { status: 'customer_contact', label: '고객 상담', color: 'blue' },
  { status: 'site_inspection', label: '현장 실사', color: 'yellow' },
  { status: 'quotation', label: '견적서 작성', color: 'orange' },
  { status: 'application_submit', label: '신청서 제출', color: 'purple' },
  { status: 'document_supplement', label: '서류 보완', color: 'red' },
  { status: 'pre_construction_inspection', label: '착공 전 실사', color: 'indigo' },
  { status: 'pre_construction_supplement', label: '착공 보완', color: 'pink' },
  { status: 'product_order', label: '제품 발주', color: 'cyan' },
  { status: 'product_shipment', label: '제품 출고', color: 'emerald' },
  { status: 'installation_schedule', label: '설치 협의', color: 'teal' },
  { status: 'installation', label: '제품 설치', color: 'green' },
  { status: 'completion_inspection', label: '준공 실사', color: 'violet' },
  { status: 'completion_supplement', label: '준공 보완', color: 'fuchsia' },
  { status: 'final_document_submit', label: '서류 제출', color: 'rose' },
  { status: 'subsidy_payment', label: '보조금 입금', color: 'green' }
]

// 업무 생성 모달 컴포넌트
interface TaskCreateModalProps {
  onClose: () => void
  onTaskCreated: (task: Task) => void
}

function TaskCreateModal({ onClose, onTaskCreated }: TaskCreateModalProps) {
  const [businessList, setBusinessList] = useState<string[]>([])
  const [selectedBusiness, setSelectedBusiness] = useState('')
  const [businessInfo, setBusinessInfo] = useState<any>(null)
  const [isLoadingBusinesses, setIsLoadingBusinesses] = useState(false)
  const [isLoadingBusinessInfo, setIsLoadingBusinessInfo] = useState(false)
  const [showBusinessDropdown, setShowBusinessDropdown] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')

  const [formData, setFormData] = useState({
    title: '',
    type: 'self' as TaskType,
    status: 'customer_contact' as TaskStatus,
    priority: 'medium' as Priority,
    assignee: '',
    dueDate: '',
    description: ''
  })

  // 사업장 목록 불러오기
  useEffect(() => {
    const loadBusinessList = async () => {
      setIsLoadingBusinesses(true)
      try {
        const response = await fetch('/api/business-list')
        const data = await response.json()
        if (data.success && data.data.businesses) {
          setBusinessList(data.data.businesses)
        }
      } catch (error) {
        console.error('사업장 목록 로드 실패:', error)
      } finally {
        setIsLoadingBusinesses(false)
      }
    }

    loadBusinessList()
  }, [])

  // 선택된 사업장 정보 불러오기
  useEffect(() => {
    if (!selectedBusiness) return

    const loadBusinessInfo = async () => {
      setIsLoadingBusinessInfo(true)
      try {
        const response = await fetch(`/api/business-info?businessName=${encodeURIComponent(selectedBusiness)}`)
        const data = await response.json()
        if (data.success && data.data) {
          setBusinessInfo(data.data)
        }
      } catch (error) {
        console.error('사업장 정보 로드 실패:', error)
      } finally {
        setIsLoadingBusinessInfo(false)
      }
    }

    loadBusinessInfo()
  }, [selectedBusiness])

  // 필터링된 사업장 목록
  const filteredBusinesses = businessList.filter(business =>
    business.toLowerCase().includes(searchTerm.toLowerCase())
  )

  // 업무 생성
  const handleCreateTask = async () => {
    if (!formData.title || !selectedBusiness) return

    try {
      const response = await fetch('/api/facility-tasks', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          title: formData.title,
          description: formData.description,
          business_name: selectedBusiness,
          task_type: formData.type,
          status: formData.status,
          priority: formData.priority,
          assignee: formData.assignee || null,
          due_date: formData.dueDate || null,
          notes: ''
        }),
      })

      const data = await response.json()

      if (data.success) {
        // API 응답을 UI 형태로 변환
        const newTask: Task = {
          id: data.data.task.id,
          title: data.data.task.title,
          businessName: data.data.task.business_name,
          businessInfo: businessInfo ? {
            address: businessInfo.address || '',
            contact: businessInfo.담당자연락처 || businessInfo.사업장연락처 || '',
            manager: businessInfo.담당자명 || businessInfo.manager || ''
          } : undefined,
          type: data.data.task.task_type,
          status: data.data.task.status,
          priority: data.data.task.priority,
          assignee: data.data.task.assignee,
          dueDate: data.data.task.due_date,
          createdAt: data.data.task.created_at.split('T')[0],
          description: data.data.task.description
        }

        onTaskCreated(newTask)
      } else {
        console.error('업무 생성 실패:', data.error)
        alert('업무 생성에 실패했습니다: ' + data.error)
      }
    } catch (error) {
      console.error('API 요청 실패:', error)
      alert('업무 생성 중 오류가 발생했습니다')
    }
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        {/* 헤더 */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900">새 업무 생성</h3>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        {/* 폼 내용 */}
        <div className="p-6 space-y-6">
          {/* 업무명 (필수) */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              업무명 <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={formData.title}
              onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
              placeholder="예: 대기배출시설 설치 검토"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>

          {/* 사업장 선택 (필수) */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              사업장 <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <button
                onClick={() => setShowBusinessDropdown(!showBusinessDropdown)}
                className={`w-full px-3 py-2 border border-gray-300 rounded-lg text-left flex items-center justify-between focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                  isLoadingBusinesses ? 'cursor-wait' : 'cursor-pointer'
                }`}
                disabled={isLoadingBusinesses}
              >
                <span className={selectedBusiness ? 'text-gray-900' : 'text-gray-500'}>
                  {isLoadingBusinesses ? '사업장 목록 로딩 중...' :
                   selectedBusiness || '사업장을 선택하세요'}
                </span>
                <ChevronDown className={`w-5 h-5 text-gray-400 transition-transform ${showBusinessDropdown ? 'rotate-180' : ''}`} />
              </button>

              {/* 드롭다운 */}
              {showBusinessDropdown && (
                <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-300 rounded-lg shadow-lg z-10 max-h-60 overflow-hidden">
                  {/* 검색 */}
                  <div className="p-3 border-b border-gray-200">
                    <div className="relative">
                      <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 transform -translate-y-1/2" />
                      <input
                        type="text"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        placeholder="사업장명 검색..."
                        className="w-full pl-9 pr-3 py-2 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                      />
                    </div>
                  </div>

                  {/* 사업장 목록 */}
                  <div className="max-h-40 overflow-y-auto">
                    {filteredBusinesses.length > 0 ? (
                      filteredBusinesses.map((business) => (
                        <button
                          key={business}
                          onClick={() => {
                            setSelectedBusiness(business)
                            setShowBusinessDropdown(false)
                            setSearchTerm('')
                          }}
                          className="w-full px-3 py-2 text-left text-sm hover:bg-gray-50 focus:bg-gray-50 focus:outline-none"
                        >
                          {business}
                        </button>
                      ))
                    ) : (
                      <div className="px-3 py-4 text-sm text-gray-500 text-center">
                        {searchTerm ? '검색 결과가 없습니다' : '사업장이 없습니다'}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* 선택된 사업장 정보 */}
            {selectedBusiness && (
              <div className="mt-3 p-3 bg-gray-50 rounded-lg">
                {isLoadingBusinessInfo ? (
                  <div className="text-sm text-gray-500">사업장 정보 로딩 중...</div>
                ) : businessInfo ? (
                  <div className="space-y-1 text-sm">
                    <div className="font-medium text-gray-900">{selectedBusiness}</div>
                    {businessInfo.address && (
                      <div className="flex items-center gap-1 text-gray-600">
                        <MapPin className="w-3 h-3" />
                        <span>{businessInfo.address}</span>
                      </div>
                    )}
                    {(businessInfo.담당자연락처 || businessInfo.사업장연락처) && (
                      <div className="flex items-center gap-1 text-gray-600">
                        <Phone className="w-3 h-3" />
                        <span>{businessInfo.담당자연락처 || businessInfo.사업장연락처}</span>
                      </div>
                    )}
                    {businessInfo.담당자명 && (
                      <div className="flex items-center gap-1 text-gray-600">
                        <User className="w-3 h-3" />
                        <span>{businessInfo.담당자명} {businessInfo.담당자직급 && `(${businessInfo.담당자직급})`}</span>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="text-sm text-gray-500">사업장 정보를 불러올 수 없습니다</div>
                )}
              </div>
            )}
          </div>

          {/* 업무 타입 및 시작 단계 */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">업무 타입</label>
              <select
                value={formData.type}
                onChange={(e) => {
                  const newType = e.target.value as TaskType
                  setFormData(prev => ({
                    ...prev,
                    type: newType,
                    status: 'customer_contact' // 타입 변경 시 기본 단계로 리셋
                  }))
                }}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="self">자비 진행</option>
                <option value="subsidy">보조금 진행</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">시작 단계</label>
              <select
                value={formData.status}
                onChange={(e) => setFormData(prev => ({ ...prev, status: e.target.value as TaskStatus }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                {(formData.type === 'self' ? selfSteps : subsidySteps).map((step, index) => (
                  <option key={step.status} value={step.status}>
                    {index + 1}. {step.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* 우선순위 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">우선순위</label>
            <select
              value={formData.priority}
              onChange={(e) => setFormData(prev => ({ ...prev, priority: e.target.value as Priority }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="low">낮음</option>
              <option value="medium">보통</option>
              <option value="high">높음</option>
            </select>
          </div>

          {/* 담당자 및 마감일 */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">담당자</label>
              <input
                type="text"
                value={formData.assignee}
                onChange={(e) => setFormData(prev => ({ ...prev, assignee: e.target.value }))}
                placeholder="예: 김철수"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">마감일</label>
              <input
                type="date"
                value={formData.dueDate}
                onChange={(e) => setFormData(prev => ({ ...prev, dueDate: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
          </div>

          {/* 업무 설명 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">업무 설명</label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
              placeholder="업무에 대한 상세 설명을 입력하세요..."
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none"
            />
          </div>
        </div>

        {/* 푸터 */}
        <div className="flex items-center justify-end gap-3 p-6 border-t border-gray-200">
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
          >
            취소
          </button>
          <button
            onClick={handleCreateTask}
            disabled={!formData.title || !selectedBusiness}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
          >
            업무 생성
          </button>
        </div>
      </div>
    </div>
  )
}

export default function TaskManagementPage() {
  const [tasks, setTasks] = useState<Task[]>([])
  const [selectedType, setSelectedType] = useState<TaskType | 'all'>('all')
  const [searchTerm, setSearchTerm] = useState('')
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [completingTask, setCompletingTask] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // 업무 목록 불러오기
  const loadTasks = async () => {
    try {
      setIsLoading(true)
      setError(null)

      const params = new URLSearchParams()
      if (selectedType !== 'all') {
        params.append('type', selectedType)
      }

      const response = await fetch(`/api/facility-tasks?${params.toString()}`)
      const data = await response.json()

      if (data.success) {
        // API 응답을 UI 형태로 변환
        const formattedTasks: Task[] = data.data.tasks.map((apiTask: any) => ({
          id: apiTask.id,
          title: apiTask.title,
          businessName: apiTask.business_name,
          businessInfo: undefined, // 필요시 business-info API로 별도 로딩
          type: apiTask.task_type,
          status: apiTask.status,
          priority: apiTask.priority,
          assignee: apiTask.assignee,
          dueDate: apiTask.due_date,
          createdAt: apiTask.created_at.split('T')[0],
          description: apiTask.description,
          notes: apiTask.notes
        }))

        setTasks(formattedTasks)
      } else {
        setError(data.error || '업무 목록을 불러오는데 실패했습니다')
      }
    } catch (error) {
      console.error('업무 목록 로딩 실패:', error)
      setError('업무 목록을 불러오는 중 오류가 발생했습니다')
    } finally {
      setIsLoading(false)
    }
  }

  // 컴포넌트 마운트 시 및 타입 변경 시 데이터 로딩
  useEffect(() => {
    loadTasks()
  }, [selectedType])

  // 현재 선택된 타입에 따른 단계들
  const currentSteps = selectedType === 'self' ? selfSteps :
                      selectedType === 'subsidy' ? subsidySteps :
                      [...selfSteps, ...subsidySteps]

  // 필터링된 태스크
  const filteredTasks = tasks.filter(task => {
    const matchesType = selectedType === 'all' || task.type === selectedType
    const matchesSearch = task.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         task.businessName.toLowerCase().includes(searchTerm.toLowerCase())
    return matchesType && matchesSearch
  })

  // 우선순위 색상
  const getPriorityColor = (priority: Priority) => {
    switch (priority) {
      case 'high': return 'bg-red-100 text-red-800 border-red-200'
      case 'medium': return 'bg-yellow-100 text-yellow-800 border-yellow-200'
      case 'low': return 'bg-green-100 text-green-800 border-green-200'
    }
  }

  // 상태 색상
  const getStatusColor = (status: TaskStatus) => {
    const step = [...selfSteps, ...subsidySteps].find(s => s.status === status)
    return step?.color || 'gray'
  }

  // 날짜 포맷
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('ko-KR', {
      month: 'short',
      day: 'numeric'
    })
  }

  // D-Day 계산
  const getDday = (dateString?: string) => {
    if (!dateString) return null
    const diff = new Date(dateString).getTime() - new Date().getTime()
    const days = Math.ceil(diff / (1000 * 60 * 60 * 24))
    if (days < 0) return `D+${Math.abs(days)}`
    if (days === 0) return 'D-Day'
    return `D-${days}`
  }

  // 단계별 태스크 그룹핑
  const getTasksByStep = (stepStatus: TaskStatus) => {
    return filteredTasks.filter(task => task.status === stepStatus)
  }

  // 다음 단계 찾기
  const getNextStep = (currentStatus: TaskStatus, taskType: TaskType): TaskStatus | null => {
    const steps = taskType === 'self' ? selfSteps : subsidySteps
    const currentIndex = steps.findIndex(step => step.status === currentStatus)
    if (currentIndex >= 0 && currentIndex < steps.length - 1) {
      return steps[currentIndex + 1].status
    }
    return null // 마지막 단계인 경우
  }

  // 업무 완료 처리
  const handleCompleteTask = async (taskId: string) => {
    const task = tasks.find(t => t.id === taskId)
    if (!task) return

    const nextStep = getNextStep(task.status, task.type)
    const stepName = [...selfSteps, ...subsidySteps].find(s => s.status === task.status)?.label

    let confirmMessage = ''
    let newStatus = ''

    if (nextStep) {
      // 다음 단계로 이동
      const nextStepName = [...selfSteps, ...subsidySteps].find(s => s.status === nextStep)?.label
      confirmMessage = `"${stepName}" 단계를 완료하고 "${nextStepName}" 단계로 이동하시겠습니까?`
      newStatus = nextStep
    } else {
      // 마지막 단계 완료
      confirmMessage = `"${stepName}" 단계를 완료하시겠습니까? 이 업무는 완료 처리됩니다.`
      newStatus = task.type === 'self' ? 'document_complete' : 'subsidy_payment'
    }

    if (!confirm(confirmMessage)) return

    try {
      setCompletingTask(taskId)

      // API 호출
      const response = await fetch('/api/facility-tasks', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          id: taskId,
          status: newStatus,
          completed_at: newStatus === 'document_complete' || newStatus === 'subsidy_payment'
            ? new Date().toISOString()
            : null
        }),
      })

      const data = await response.json()

      if (data.success) {
        // UI 업데이트
        setTasks(prev => prev.map(t =>
          t.id === taskId ? { ...t, status: newStatus } : t
        ))

        // 완료 메시지 표시
        setTimeout(() => setCompletingTask(null), 2000)
      } else {
        console.error('업무 상태 업데이트 실패:', data.error)
        alert('업무 상태 업데이트에 실패했습니다: ' + data.error)
        setCompletingTask(null)
      }
    } catch (error) {
      console.error('API 요청 실패:', error)
      alert('업무 상태 업데이트 중 오류가 발생했습니다')
      setCompletingTask(null)
    }
  }

  return (
    <AdminLayout
      title="업무 관리"
      description="시설 설치 업무 흐름을 체계적으로 관리합니다"
      actions={
        <button
          onClick={() => setShowCreateModal(true)}
          className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
        >
          <Plus className="w-4 h-4" />
          새 업무
        </button>
      }
    >
      <div className="space-y-6">
        {/* 필터 및 검색 */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="flex flex-col lg:flex-row gap-4">
            {/* 타입 필터 */}
            <div className="flex gap-2">
              <button
                onClick={() => setSelectedType('all')}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  selectedType === 'all'
                    ? 'bg-blue-100 text-blue-700 border border-blue-200'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                전체
              </button>
              <button
                onClick={() => setSelectedType('self')}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  selectedType === 'self'
                    ? 'bg-green-100 text-green-700 border border-green-200'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                자비 진행
              </button>
              <button
                onClick={() => setSelectedType('subsidy')}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  selectedType === 'subsidy'
                    ? 'bg-purple-100 text-purple-700 border border-purple-200'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                보조금 진행
              </button>
            </div>

            {/* 검색 */}
            <div className="flex-1">
              <div className="relative">
                <Search className="w-5 h-5 text-gray-400 absolute left-3 top-1/2 transform -translate-y-1/2" />
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="업무명 또는 사업장명으로 검색..."
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
            </div>
          </div>

          {/* 통계 요약 */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mt-6 pt-6 border-t border-gray-200">
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-600">{filteredTasks.length}</div>
              <div className="text-sm text-gray-600">전체 업무</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-green-600">
                {filteredTasks.filter(t => t.status === 'document_complete' || t.status === 'subsidy_payment').length}
              </div>
              <div className="text-sm text-gray-600">완료 업무</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-red-600">
                {filteredTasks.filter(t => t.priority === 'high').length}
              </div>
              <div className="text-sm text-gray-600">높은 우선순위</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-orange-600">
                {filteredTasks.filter(t => {
                  if (!t.dueDate) return false
                  const dday = getDday(t.dueDate)
                  return dday && (dday.includes('D+') || dday === 'D-Day')
                }).length}
              </div>
              <div className="text-sm text-gray-600">지연/임박</div>
            </div>
          </div>
        </div>

        {/* 칸반 보드 */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-6">
            업무 진행 현황
            <span className="text-sm font-normal text-gray-500 ml-2">
              ({selectedType === 'all' ? '전체' : selectedType === 'self' ? '자비' : '보조금'} 흐름)
            </span>
          </h2>

          {/* 로딩 상태 */}
          {isLoading && (
            <div className="flex items-center justify-center py-12">
              <div className="text-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
                <p className="text-gray-500">업무 목록을 불러오는 중...</p>
              </div>
            </div>
          )}

          {/* 에러 상태 */}
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
              <div className="flex">
                <AlertCircle className="w-5 h-5 text-red-400 mr-3 mt-0.5" />
                <div>
                  <h3 className="text-sm font-medium text-red-800">오류 발생</h3>
                  <p className="text-sm text-red-700 mt-1">{error}</p>
                  <button
                    onClick={loadTasks}
                    className="text-sm text-red-600 hover:text-red-800 underline mt-2"
                  >
                    다시 시도
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* 칸반보드 - 로딩/에러가 아닐 때만 표시 */}
          {!isLoading && !error && (
            <>
              {/* 데스크탑: 가로 스크롤, 모바일: 세로 스택 */}
              <div className="lg:overflow-x-auto">
                <div className="flex lg:flex-row flex-col lg:gap-4 gap-6 lg:min-w-max lg:pb-4">
              {currentSteps.map((step, index) => {
                const stepTasks = getTasksByStep(step.status)

                return (
                  <div
                    key={step.status}
                    className={`
                      lg:flex-shrink-0 lg:w-64 w-full bg-gray-50 rounded-lg p-3 border-t-4
                      border-${step.color}-500
                    `}
                  >
                    {/* 단계 헤더 */}
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex-1 min-w-0">
                        <h3 className="font-semibold text-gray-900 text-xs truncate">
                          {index + 1}. {step.label}
                        </h3>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="text-xs text-gray-500">
                            {stepTasks.length}개
                          </span>
                          {stepTasks.filter(t => t.priority === 'high').length > 0 && (
                            <span className="text-xs bg-red-100 text-red-600 px-1.5 py-0.5 rounded-full">
                              긴급 {stepTasks.filter(t => t.priority === 'high').length}
                            </span>
                          )}
                        </div>
                      </div>
                      {index < currentSteps.length - 1 && (
                        <ArrowRight className="w-3 h-3 text-gray-400 flex-shrink-0 lg:block hidden" />
                      )}
                    </div>

                    {/* 태스크 카드들 */}
                    <div className="space-y-2 lg:max-h-80 max-h-60 overflow-y-auto">
                      {stepTasks.map(task => (
                        <div
                          key={task.id}
                          className="relative bg-white rounded-lg p-3 shadow-sm border border-gray-200 hover:shadow-md transition-shadow cursor-pointer"
                        >
                          {/* 태스크 헤더 */}
                          <div className="flex items-start justify-between mb-2">
                            <div className="flex-1 min-w-0">
                              <h4 className="font-medium text-gray-900 text-xs leading-tight truncate">
                                {task.title}
                              </h4>
                              <div className="flex items-center gap-1 mt-0.5">
                                <Building2 className="w-2.5 h-2.5 text-gray-400 flex-shrink-0" />
                                <span className="text-xs text-gray-600 truncate">
                                  {task.businessName}
                                </span>
                              </div>
                            </div>
                            <button className="flex-shrink-0 p-0.5 hover:bg-gray-100 rounded">
                              <MoreHorizontal className="w-3 h-3 text-gray-400" />
                            </button>
                          </div>

                          {/* 우선순위 및 타입 */}
                          <div className="flex items-center gap-1 mb-2">
                            <span className={`
                              inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium
                              ${getPriorityColor(task.priority)}
                            `}>
                              <Flag className="w-2 h-2 mr-0.5" />
                              {task.priority === 'high' ? '높음' : task.priority === 'medium' ? '보통' : '낮음'}
                            </span>
                            <span className={`
                              inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium
                              ${task.type === 'self'
                                ? 'bg-green-100 text-green-800'
                                : 'bg-purple-100 text-purple-800'
                              }
                            `}>
                              {task.type === 'self' ? '자비' : '보조금'}
                            </span>
                          </div>

                          {/* 담당자 및 날짜 */}
                          <div className="space-y-1">
                            {task.assignee && (
                              <div className="flex items-center gap-1 text-xs text-gray-600">
                                <User className="w-2.5 h-2.5" />
                                <span className="truncate">{task.assignee}</span>
                              </div>
                            )}
                            {task.dueDate && (
                              <div className="flex items-center justify-between text-xs">
                                <div className="flex items-center gap-1 text-gray-600 min-w-0">
                                  <Calendar className="w-2.5 h-2.5 flex-shrink-0" />
                                  <span className="truncate">{formatDate(task.dueDate)}</span>
                                </div>
                                <span className={`
                                  font-medium px-1.5 py-0.5 rounded-full text-xs flex-shrink-0 ml-1
                                  ${getDday(task.dueDate)?.includes('D+') || getDday(task.dueDate) === 'D-Day'
                                    ? 'bg-red-100 text-red-700'
                                    : 'bg-blue-100 text-blue-700'
                                  }
                                `}>
                                  {getDday(task.dueDate)}
                                </span>
                              </div>
                            )}
                          </div>

                          {/* 액션 버튼들 */}
                          <div className="flex items-center gap-0.5 mt-2 pt-2 border-t border-gray-100">
                            <button className="flex-1 flex items-center justify-center gap-0.5 py-1 text-xs text-blue-600 hover:bg-blue-50 rounded">
                              <Eye className="w-2.5 h-2.5" />
                              보기
                            </button>
                            <button className="flex-1 flex items-center justify-center gap-0.5 py-1 text-xs text-gray-600 hover:bg-gray-50 rounded">
                              <Edit className="w-2.5 h-2.5" />
                              수정
                            </button>
                            <button
                              onClick={() => handleCompleteTask(task.id)}
                              disabled={completingTask === task.id}
                              className="flex-1 flex items-center justify-center gap-0.5 py-1 text-xs text-green-600 hover:bg-green-50 rounded disabled:opacity-50"
                            >
                              {completingTask === task.id ? (
                                <Loader2 className="w-2.5 h-2.5 animate-spin" />
                              ) : (
                                <Check className="w-2.5 h-2.5" />
                              )}
                              완료
                            </button>
                          </div>

                          {/* 완료 처리 중 표시 */}
                          {completingTask === task.id && (
                            <div className="absolute inset-0 bg-green-50 bg-opacity-90 flex items-center justify-center rounded-lg">
                              <div className="text-sm font-medium text-green-700 flex items-center gap-2">
                                <CheckCircle className="w-4 h-4" />
                                처리 완료!
                              </div>
                            </div>
                          )}
                        </div>
                      ))}

                      {/* 빈 상태 */}
                      {stepTasks.length === 0 && (
                        <div className="text-center py-8 text-gray-400">
                          <Clock className="w-8 h-8 mx-auto mb-2 opacity-50" />
                          <p className="text-sm">해당 단계 업무 없음</p>
                        </div>
                      )}
                    </div>
                  </div>
                )
                })}
                </div>
              </div>
            </>
          )}
        </div>

        {/* 업무 생성 모달 */}
        {showCreateModal && <TaskCreateModal onClose={() => setShowCreateModal(false)} onTaskCreated={(newTask) => {
          setTasks(prev => [...prev, newTask])
          setShowCreateModal(false)
          // 업무 생성 후 목록 새로고침
          loadTasks()
        }} />}
      </div>
    </AdminLayout>
  )
}