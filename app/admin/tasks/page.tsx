'use client'

import { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import AdminLayout from '@/components/ui/AdminLayout'
import { withAuth, useAuth } from '@/contexts/AuthContext'
import { TokenManager } from '@/lib/api-client'
import MultiAssigneeSelector, { SelectedAssignee } from '@/components/ui/MultiAssigneeSelector'
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
  Loader2,
  RefreshCw,
  RotateCcw,
  Users,
  Target,
  TrendingUp,
  FileText
} from 'lucide-react'

// 업무 타입 정의
type TaskType = 'self' | 'subsidy' | 'etc' | 'as'
type TaskStatus =
  | 'customer_contact' | 'site_inspection' | 'quotation' | 'contract'
  | 'deposit_confirm' | 'product_order' | 'product_shipment' | 'installation_schedule'
  | 'installation' | 'balance_payment' | 'document_complete'
  // 보조금 전용 단계
  | 'application_submit' | 'document_supplement' | 'pre_construction_inspection'
  | 'pre_construction_supplement' | 'completion_inspection' | 'completion_supplement'
  | 'final_document_submit' | 'subsidy_payment'
  // 기타 단계
  | 'etc_status'

type Priority = 'high' | 'medium' | 'low'

interface Task {
  id: string
  title: string
  businessName?: string
  businessInfo?: {
    address: string
    contact: string
    manager: string
  }
  type: TaskType
  status: TaskStatus
  priority: Priority
  assignee?: string // 기존 호환성
  assignees?: SelectedAssignee[] // 새로운 다중 담당자
  startDate?: string
  dueDate?: string
  progressPercentage?: number
  delayStatus?: 'on_time' | 'at_risk' | 'delayed' | 'overdue'
  delayDays?: number
  createdAt: string
  description?: string
  notes?: string
}

interface CreateTaskForm {
  title: string
  businessName: string
  type: TaskType
  status: TaskStatus
  priority: Priority
  assignee: string // 기존 호환성
  assignees: SelectedAssignee[] // 새로운 다중 담당자
  startDate: string
  dueDate: string
  description: string
  notes: string
}

interface BusinessOption {
  id: string
  name: string
  address: string
}

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

// 상태별 단계 정의 (기타)
const etcSteps: Array<{status: TaskStatus, label: string, color: string}> = [
  { status: 'etc_status', label: '기타', color: 'gray' }
]

// 상태별 단계 정의 (AS)
const asSteps: Array<{status: TaskStatus, label: string, color: string}> = [
  { status: 'customer_contact', label: '고객 상담', color: 'blue' },
  { status: 'site_inspection', label: '현장 확인', color: 'yellow' },
  { status: 'quotation', label: 'AS 견적', color: 'orange' },
  { status: 'contract', label: 'AS 계약', color: 'purple' },
  { status: 'product_order', label: '부품 발주', color: 'cyan' },
  { status: 'installation', label: 'AS 완료', color: 'green' }
]

function TaskManagementPage() {
  const { user } = useAuth()
  const [tasks, setTasks] = useState<Task[]>([])
  const [selectedType, setSelectedType] = useState<TaskType | 'all'>('all')
  const [searchTerm, setSearchTerm] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [selectedPriority, setSelectedPriority] = useState<Priority | 'all'>('all')
  const [selectedAssignee, setSelectedAssignee] = useState<string | 'all'>('all')
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date())
  const [isCompactMode, setIsCompactMode] = useState(true)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [showEditModal, setShowEditModal] = useState(false)
  const [selectedTask, setSelectedTask] = useState<Task | null>(null)
  const [editingTask, setEditingTask] = useState<Task | null>(null)
  const [draggedTask, setDraggedTask] = useState<Task | null>(null)
  const [createTaskForm, setCreateTaskForm] = useState<CreateTaskForm>({
    title: '',
    businessName: '',
    type: 'etc',
    status: 'etc_status',
    priority: 'medium',
    assignee: '',
    assignees: [],
    startDate: '',
    dueDate: '',
    description: '',
    notes: ''
  })
  const [availableBusinesses, setAvailableBusinesses] = useState<BusinessOption[]>([])
  const [businessSearchTerm, setBusinessSearchTerm] = useState('')
  const [showBusinessDropdown, setShowBusinessDropdown] = useState(false)
  const [editBusinessSearchTerm, setEditBusinessSearchTerm] = useState('')
  const [showEditBusinessDropdown, setShowEditBusinessDropdown] = useState(false)
  const [selectedBusinessIndex, setSelectedBusinessIndex] = useState(-1)
  const [editSelectedBusinessIndex, setEditSelectedBusinessIndex] = useState(-1)
  const searchTimeoutRef = useRef<NodeJS.Timeout>()
  const refreshIntervalRef = useRef<NodeJS.Timeout>()
  const businessSearchTimeoutRef = useRef<NodeJS.Timeout>()

  // 실제 업무 데이터 로딩
  const loadTasks = useCallback(async () => {
    try {
      setIsLoading(true)
      console.log('📋 시설 업무 목록 로딩 시작...')

      const token = TokenManager.getToken()
      const headers: HeadersInit = {
        'Content-Type': 'application/json',
      }

      if (token) {
        headers['Authorization'] = `Bearer ${token}`
      }

      const response = await fetch('/api/facility-tasks', {
        method: 'GET',
        headers
      })

      if (!response.ok) {
        throw new Error('업무 목록을 불러오는데 실패했습니다.')
      }

      const result = await response.json()
      console.log('✅ 업무 목록 로딩 성공:', result.data?.tasks?.length || 0, '개')

      if (result.success && result.data?.tasks) {
        // 데이터베이스 형식을 UI 형식으로 변환
        const convertedTasks: Task[] = result.data.tasks.map((dbTask: any) => ({
          id: dbTask.id,
          title: dbTask.title,
          businessName: dbTask.business_name,
          type: dbTask.task_type,
          status: dbTask.status,
          priority: dbTask.priority,
          assignee: dbTask.assignee || undefined,
          assignees: dbTask.assignees || [],
          startDate: dbTask.start_date || undefined,
          dueDate: dbTask.due_date || undefined,
          progressPercentage: 0,
          delayStatus: 'on_time',
          delayDays: 0,
          createdAt: dbTask.created_at,
          description: dbTask.description || undefined,
          notes: dbTask.notes || undefined
        }))

        setTasks(convertedTasks)
        setLastRefresh(new Date())
      }
    } catch (error) {
      console.error('❌ 업무 목록 로딩 실패:', error)
      alert('업무 목록을 불러오는 중 오류가 발생했습니다.')
    } finally {
      setIsLoading(false)
    }
  }, [])

  // 페이지 로드 시 데이터 로딩
  useEffect(() => {
    loadTasks()
  }, [loadTasks])

  // 로그인한 사용자를 담당자 필터 기본값으로 설정
  useEffect(() => {
    if (user && user.name && selectedAssignee === 'all') {
      setSelectedAssignee(user.name)
    }
  }, [user, selectedAssignee])

  // 사업장 목록 로딩
  const loadBusinesses = useCallback(async () => {
    try {
      const response = await fetch('/api/business-info-direct?includeFileStats=true')
      if (!response.ok) {
        throw new Error('사업장 데이터를 불러오는데 실패했습니다.')
      }
      const data = await response.json()

      if (data.success && data.data && Array.isArray(data.data)) {
        const businessOptions = data.data.map((business: any) => ({
          id: business.id,
          name: business.business_name,
          address: business.address || ''
        }))
        setAvailableBusinesses(businessOptions)
        console.log(`✅ ${businessOptions.length}개 사업장 정보 로딩 완료`)
      }
    } catch (error) {
      console.error('Failed to load businesses:', error)
    }
  }, [])

  // 초기 로딩
  useEffect(() => {
    loadBusinesses()

    return () => {
      if (refreshIntervalRef.current) {
        clearInterval(refreshIntervalRef.current)
      }
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current)
      }
      if (businessSearchTimeoutRef.current) {
        clearTimeout(businessSearchTimeoutRef.current)
      }
    }
  }, [loadBusinesses])

  // 수동 새로고침 (데이터 다시 로딩)
  const refreshTasks = useCallback(async () => {
    setIsRefreshing(true)
    try {
      await loadTasks()
    } catch (error) {
      console.error('새로고침 실패:', error)
    } finally {
      setIsRefreshing(false)
    }
  }, [loadTasks])

  // 업무 삭제 핸들러
  const handleDeleteTask = useCallback(async (taskId: string) => {
    if (!confirm('이 업무를 삭제하시겠습니까?')) {
      return
    }

    try {
      console.log('🗑️ 업무 삭제 요청:', taskId)

      const response = await fetch(`/api/facility-tasks?id=${taskId}`, {
        method: 'DELETE'
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.message || '업무 삭제에 실패했습니다.')
      }

      const result = await response.json()
      console.log('✅ 업무 삭제 성공:', result)

      // 로컬 상태에서 제거
      setTasks(prev => prev.filter(t => t.id !== taskId))

      // 수정 모달이 열려있다면 닫기
      if (editingTask?.id === taskId) {
        setShowEditModal(false)
        setEditingTask(null)
        setEditBusinessSearchTerm('')
        setShowEditBusinessDropdown(false)
      }

      alert('업무가 삭제되었습니다.')
    } catch (error) {
      console.error('Failed to delete task:', error)
      alert(`업무 삭제 중 오류가 발생했습니다: ${error instanceof Error ? error.message : '알 수 없는 오류'}`)
    }
  }, [editingTask])

  // 디바운스된 검색
  const debouncedSearch = useCallback((term: string) => {
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current)
    }
    searchTimeoutRef.current = setTimeout(() => {
      setSearchTerm(term)
    }, 300)
  }, [])

  // 사업장 자동완성 검색
  const handleBusinessSearch = useCallback((term: string, isEdit = false) => {
    if (isEdit) {
      setEditBusinessSearchTerm(term)
      setShowEditBusinessDropdown(term.length >= 2)
      setEditSelectedBusinessIndex(-1)
    } else {
      setBusinessSearchTerm(term)
      setShowBusinessDropdown(term.length >= 2)
      setSelectedBusinessIndex(-1)
    }
  }, [])

  // 필터링된 사업장 목록
  const filteredBusinesses = useMemo(() => {
    return availableBusinesses.filter(business =>
      business.name?.toLowerCase().includes(businessSearchTerm.toLowerCase()) ||
      business.address?.toLowerCase().includes(businessSearchTerm.toLowerCase())
    ).slice(0, 10) // 최대 10개만 표시
  }, [availableBusinesses, businessSearchTerm])

  // 수정용 필터링된 사업장 목록
  const filteredEditBusinesses = useMemo(() => {
    return availableBusinesses.filter(business =>
      business.name?.toLowerCase().includes(editBusinessSearchTerm.toLowerCase()) ||
      business.address?.toLowerCase().includes(editBusinessSearchTerm.toLowerCase())
    ).slice(0, 10)
  }, [availableBusinesses, editBusinessSearchTerm])

  // 키보드 네비게이션 핸들러
  const handleBusinessKeyDown = useCallback((e: React.KeyboardEvent, isEdit = false) => {
    const businesses = isEdit ? filteredEditBusinesses : filteredBusinesses
    const selectedIndex = isEdit ? editSelectedBusinessIndex : selectedBusinessIndex
    const setSelectedIndex = isEdit ? setEditSelectedBusinessIndex : setSelectedBusinessIndex

    if (e.key === 'ArrowDown') {
      e.preventDefault()
      const newIndex = selectedIndex < businesses.length - 1 ? selectedIndex + 1 : 0
      setSelectedIndex(newIndex)
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      const newIndex = selectedIndex > 0 ? selectedIndex - 1 : businesses.length - 1
      setSelectedIndex(newIndex)
    } else if (e.key === 'Enter' && selectedIndex >= 0) {
      e.preventDefault()
      const selectedBusiness = businesses[selectedIndex]
      handleBusinessSelect(selectedBusiness, isEdit)
    } else if (e.key === 'Escape') {
      e.preventDefault()
      if (isEdit) {
        setShowEditBusinessDropdown(false)
        setEditSelectedBusinessIndex(-1)
      } else {
        setShowBusinessDropdown(false)
        setSelectedBusinessIndex(-1)
      }
    }
  }, [filteredBusinesses, filteredEditBusinesses, selectedBusinessIndex, editSelectedBusinessIndex])

  // 사업장 선택
  const handleBusinessSelect = useCallback((business: BusinessOption, isEdit = false) => {
    if (isEdit && editingTask) {
      setEditingTask(prev => prev ? { ...prev, businessName: business.name } : null)
      setEditBusinessSearchTerm(business.name)
      setShowEditBusinessDropdown(false)
      setEditSelectedBusinessIndex(-1)
    } else {
      setCreateTaskForm(prev => ({ ...prev, businessName: business.name }))
      setBusinessSearchTerm(business.name)
      setShowBusinessDropdown(false)
      setSelectedBusinessIndex(-1)
    }
  }, [editingTask])

  // 컴팩트 모드에서 표시할 카드들 계산
  const getDisplayTasks = useCallback((tasks: Task[]) => {
    if (isCompactMode) {
      return tasks.slice(0, 2) // 컴팩트 모드: 최대 2개
    } else {
      return tasks.slice(0, 10) // 펼침 모드: 최대 10개
    }
  }, [isCompactMode])

  // 지연 상태 계산 함수
  const calculateDelayStatus = useCallback((task: Task): { delayStatus: string, delayDays: number } => {
    if (!task.startDate) {
      return { delayStatus: 'on_time', delayDays: 0 }
    }

    const startDate = new Date(task.startDate)
    const currentDate = new Date()

    // 날짜 유효성 검증
    if (isNaN(startDate.getTime())) {
      return { delayStatus: 'on_time', delayDays: 0 }
    }

    const daysSinceStart = Math.floor((currentDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24))

    // 업무 타입별 임계값 설정
    const thresholds = {
      self: { warning: 7, critical: 14, overdue: 21 },
      subsidy: { warning: 10, critical: 20, overdue: 30 },
      etc: { warning: 5, critical: 10, overdue: 15 },
      as: { warning: 3, critical: 7, overdue: 10 }
    }

    const threshold = thresholds[task.type] || thresholds.etc

    // 마감일 체크
    if (task.dueDate) {
      const dueDate = new Date(task.dueDate)

      // 마감일 유효성 검증
      if (!isNaN(dueDate.getTime())) {
        const daysUntilDue = Math.floor((dueDate.getTime() - currentDate.getTime()) / (1000 * 60 * 60 * 24))

        if (daysUntilDue < 0) {
          return { delayStatus: 'overdue', delayDays: Math.abs(daysUntilDue) }
        }
      }
    }

    // 시작일 기준 지연 계산
    if (daysSinceStart >= threshold.overdue) {
      return { delayStatus: 'overdue', delayDays: daysSinceStart - threshold.overdue }
    } else if (daysSinceStart >= threshold.critical) {
      return { delayStatus: 'delayed', delayDays: daysSinceStart - threshold.critical }
    } else if (daysSinceStart >= threshold.warning) {
      return { delayStatus: 'at_risk', delayDays: 0 }
    }

    return { delayStatus: 'on_time', delayDays: 0 }
  }, [])

  // 업무 목록 실시간 지연 상태 업데이트
  const tasksWithDelayStatus = useMemo(() => {
    return tasks.map(task => {
      const { delayStatus, delayDays } = calculateDelayStatus(task)
      return {
        ...task,
        delayStatus: delayStatus as Task['delayStatus'],
        delayDays
      }
    })
  }, [tasks, calculateDelayStatus])

  // 필터링된 업무 목록
  const filteredTasks = useMemo(() => {
    return tasksWithDelayStatus.filter(task => {
      const matchesSearch = searchTerm === '' ||
        task.title?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        task.businessName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        task.assignee?.toLowerCase().includes(searchTerm.toLowerCase())

      const matchesType = selectedType === 'all' || task.type === selectedType
      const matchesPriority = selectedPriority === 'all' || task.priority === selectedPriority
      const matchesAssignee = selectedAssignee === 'all' || task.assignee === selectedAssignee

      return matchesSearch && matchesType && matchesPriority && matchesAssignee
    })
  }, [tasksWithDelayStatus, searchTerm, selectedType, selectedPriority, selectedAssignee])

  // 상태별 업무 그룹화
  const tasksByStatus = useMemo(() => {
    const steps = selectedType === 'all' ? [...selfSteps, ...subsidySteps, ...etcSteps, ...asSteps] :
                  selectedType === 'self' ? selfSteps :
                  selectedType === 'subsidy' ? subsidySteps :
                  selectedType === 'etc' ? etcSteps : asSteps

    const grouped = {} as Record<TaskStatus, Task[]>
    steps.forEach(step => {
      grouped[step.status] = filteredTasks.filter(task => task.status === step.status)
    })

    return { grouped, steps }
  }, [filteredTasks, selectedType])

  // 동적 통계 계산
  const dynamicStats = useMemo(() => {
    const stepsWithTasks = tasksByStatus.steps.filter(step =>
      tasksByStatus.grouped[step.status]?.length > 0
    )
    const highPriorityCount = filteredTasks.filter(task => task.priority === 'high').length
    const delayedCount = filteredTasks.filter(task =>
      task.delayStatus === 'delayed' || task.delayStatus === 'overdue'
    ).length
    const atRiskCount = filteredTasks.filter(task => task.delayStatus === 'at_risk').length

    return {
      totalTasks: filteredTasks.length,
      stepsWithTasks: stepsWithTasks.length,
      highPriorityTasks: highPriorityCount,
      delayedTasks: delayedCount,
      atRiskTasks: atRiskCount,
      activeSteps: stepsWithTasks
    }
  }, [filteredTasks, tasksByStatus])

  // 담당자 목록
  const assignees = useMemo(() => {
    const uniqueAssignees = Array.from(new Set(tasks.filter(t => t.assignee).map(t => t.assignee)))
    return uniqueAssignees.sort()
  }, [tasks])

  // 드래그 앤 드롭 핸들러
  const handleDragStart = useCallback((task: Task) => {
    setDraggedTask(task)
  }, [])

  const handleDragEnd = useCallback(() => {
    setDraggedTask(null)
  }, [])

  const handleDrop = useCallback(async (status: TaskStatus) => {
    if (!draggedTask) return

    try {
      // API 호출로 실제 상태 업데이트
      const response = await fetch('/api/facility-tasks', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          id: draggedTask.id,
          status: status
        })
      })

      if (!response.ok) {
        throw new Error('업무 상태 업데이트에 실패했습니다.')
      }

      // 로컬 상태 업데이트
      setTasks(prev => prev.map(task =>
        task.id === draggedTask.id
          ? { ...task, status }
          : task
      ))

      console.log(`업무 "${draggedTask.title}"이(가) ${status} 상태로 이동되었습니다.`)
    } catch (error) {
      console.error('Failed to update task status:', error)
      alert('업무 상태 업데이트에 실패했습니다. 다시 시도해주세요.')
    }
  }, [draggedTask])

  // 헬퍼 함수들
  const getColorClasses = useCallback((color: string) => {
    const colorMap = {
      blue: 'bg-blue-100 text-blue-800 border-blue-200',
      yellow: 'bg-yellow-100 text-yellow-800 border-yellow-200',
      orange: 'bg-orange-100 text-orange-800 border-orange-200',
      purple: 'bg-purple-100 text-purple-800 border-purple-200',
      indigo: 'bg-indigo-100 text-indigo-800 border-indigo-200',
      cyan: 'bg-cyan-100 text-cyan-800 border-cyan-200',
      emerald: 'bg-emerald-100 text-emerald-800 border-emerald-200',
      teal: 'bg-teal-100 text-teal-800 border-teal-200',
      green: 'bg-green-100 text-green-800 border-green-200',
      lime: 'bg-lime-100 text-lime-800 border-lime-200',
      red: 'bg-red-100 text-red-800 border-red-200',
      pink: 'bg-pink-100 text-pink-800 border-pink-200',
      violet: 'bg-violet-100 text-violet-800 border-violet-200',
      fuchsia: 'bg-fuchsia-100 text-fuchsia-800 border-fuchsia-200',
      rose: 'bg-rose-100 text-rose-800 border-rose-200'
    }
    return colorMap[color as keyof typeof colorMap] || 'bg-gray-100 text-gray-800 border-gray-200'
  }, [])

  const getPriorityIcon = useCallback((priority: Priority) => {
    switch (priority) {
      case 'high': return <Flag className="w-4 h-4 text-red-500" />
      case 'medium': return <Flag className="w-4 h-4 text-yellow-500" />
      case 'low': return <Flag className="w-4 h-4 text-green-500" />
    }
  }, [])

  const formatDate = useCallback((dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('ko-KR', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    })
  }, [])

  // 업무 타입 뱃지 정보
  const getTaskTypeBadge = useCallback((taskType: string) => {
    const badgeMap = {
      self: { label: '자비', color: 'bg-blue-100 text-blue-800 border-blue-200' },
      subsidy: { label: '보조금', color: 'bg-green-100 text-green-800 border-green-200' },
      as: { label: 'AS', color: 'bg-orange-100 text-orange-800 border-orange-200' },
      etc: { label: '기타', color: 'bg-gray-100 text-gray-800 border-gray-200' }
    }
    return badgeMap[taskType as keyof typeof badgeMap] || badgeMap.etc
  }, [])

  // 새 업무 생성 핸들러
  const handleCreateTask = useCallback(async () => {
    try {
      // 필수 필드 검증 (기타 타입은 사업장 선택 불필요)
      if (createTaskForm.type !== 'etc' && !businessSearchTerm.trim()) {
        alert('사업장을 선택해주세요.')
        return
      }
      if (!createTaskForm.title.trim()) {
        alert('업무명을 입력해주세요.')
        return
      }

      // API 요청 데이터 준비
      const requestData = {
        title: createTaskForm.title,
        business_name: businessSearchTerm || '기타',
        task_type: createTaskForm.type,
        status: createTaskForm.status,
        priority: createTaskForm.priority,
        assignees: createTaskForm.assignees,
        due_date: createTaskForm.dueDate || null,
        description: createTaskForm.description || null,
        notes: createTaskForm.notes || null
      }

      console.log('📝 새 업무 생성 요청:', requestData)

      // 실제 데이터베이스에 저장
      const response = await fetch('/api/facility-tasks', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestData)
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.message || '업무 생성에 실패했습니다.')
      }

      const result = await response.json()
      console.log('✅ 업무 생성 성공:', result)

      // 로컬 상태 업데이트 (임시 - SSE를 통해 자동 업데이트될 예정)
      const newTask: Task = {
        id: result.data.task.id,
        title: result.data.task.title,
        businessName: result.data.task.business_name,
        type: result.data.task.task_type,
        status: result.data.task.status,
        priority: result.data.task.priority,
        assignee: result.data.task.assignee || undefined,
        assignees: result.data.task.assignees || [],
        startDate: createTaskForm.startDate || undefined,
        dueDate: result.data.task.due_date || undefined,
        progressPercentage: 0,
        delayStatus: 'on_time',
        delayDays: 0,
        createdAt: result.data.task.created_at,
        description: result.data.task.description || undefined,
        notes: result.data.task.notes || undefined
      }

      setTasks(prev => [newTask, ...prev])

      // 폼 초기화
      setCreateTaskForm({
        title: '',
        businessName: '',
        type: 'self',
        status: 'customer_contact',
        priority: 'medium',
        assignee: '',
        assignees: [],
        startDate: '',
        dueDate: '',
            description: '',
        notes: ''
      })

      // 모달 닫기
      setShowCreateModal(false)
      setBusinessSearchTerm('')
      setShowBusinessDropdown(false)

      alert('새 업무가 성공적으로 등록되었습니다.')
    } catch (error) {
      console.error('Failed to create task:', error)
      alert(`업무 등록 중 오류가 발생했습니다: ${error instanceof Error ? error.message : '알 수 없는 오류'}`)
    }
  }, [createTaskForm, businessSearchTerm])

  // ESC 키 핸들러
  useEffect(() => {
    const handleEscKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        if (showCreateModal) {
          setShowCreateModal(false)
          setBusinessSearchTerm('')
          setShowBusinessDropdown(false)
        }
        if (showEditModal) {
          setShowEditModal(false)
          setEditingTask(null)
          setEditBusinessSearchTerm('')
          setShowEditBusinessDropdown(false)
        }
      }
    }

    if (showCreateModal || showEditModal) {
      document.addEventListener('keydown', handleEscKey)
      return () => document.removeEventListener('keydown', handleEscKey)
    }
  }, [showCreateModal, showEditModal])

  // 모달 열기 핸들러
  const handleOpenCreateModal = useCallback(() => {
    const today = new Date().toISOString().split('T')[0]
    setCreateTaskForm({
      title: '',
      businessName: '',
      type: 'self',
      status: 'customer_contact',
      priority: 'medium',
      assignee: '',
      assignees: [],
      startDate: today,
      dueDate: '',
        description: '',
      notes: ''
    })
    setBusinessSearchTerm('')
    setShowBusinessDropdown(false)
    setShowCreateModal(true)
  }, [])

  // 수정 모달 열기 핸들러 (권한 체크 포함)
  const handleOpenEditModal = useCallback((task: Task) => {
    // 권한 체크: 담당자나 관리자만 수정 가능
    const currentUser = '관리자' // TODO: 실제 로그인 사용자 정보로 교체 필요
    const isAssignee = task.assignee === currentUser
    const isAdmin = true // TODO: 실제 사용자 권한 체크로 교체 필요

    if (!isAssignee && !isAdmin) {
      alert('이 업무를 수정할 권한이 없습니다. 담당자나 관리자만 수정할 수 있습니다.')
      return
    }

    setEditingTask(task)
    setEditBusinessSearchTerm(task.businessName || '')
    setShowEditBusinessDropdown(false)
    setShowEditModal(true)
  }, [])

  // 업무 수정 핸들러
  const handleUpdateTask = useCallback(async () => {
    if (!editingTask) return

    try {
      // API 요청 데이터 준비
      const requestData = {
        id: editingTask.id,
        title: editingTask.title,
        business_name: editingTask.businessName || '기타',
        task_type: editingTask.type,
        status: editingTask.status,
        priority: editingTask.priority,
        assignees: editingTask.assignees || [],
        start_date: editingTask.startDate || null,
        due_date: editingTask.dueDate || null,
        description: editingTask.description || null,
        notes: editingTask.notes || null
      }

      console.log('📝 업무 수정 요청:', requestData)

      // 실제 데이터베이스에 저장
      const response = await fetch('/api/facility-tasks', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestData)
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.message || '업무 수정에 실패했습니다.')
      }

      const result = await response.json()
      console.log('✅ 업무 수정 성공:', result)

      // 로컬 상태 업데이트
      setTasks(prev => prev.map(task =>
        task.id === editingTask.id
          ? {
              ...editingTask,
              createdAt: result.data.task.created_at,
              assignee: editingTask.assignees && editingTask.assignees.length > 0
                ? editingTask.assignees[0].name
                : undefined
            }
          : task
      ))

      // 모달 닫기
      setShowEditModal(false)
      setEditingTask(null)
      setEditBusinessSearchTerm('')
      setShowEditBusinessDropdown(false)

      alert('업무가 성공적으로 수정되었습니다.')
    } catch (error) {
      console.error('Failed to update task:', error)
      alert(`업무 수정 중 오류가 발생했습니다: ${error instanceof Error ? error.message : '알 수 없는 오류'}`)
    }
  }, [editingTask])

  return (
    <AdminLayout
      title="업무 관리"
      description="시설 설치 업무 흐름을 체계적으로 관리합니다"
      actions={
        <div className="flex items-center gap-3">
          <button
            onClick={refreshTasks}
            disabled={isRefreshing}
            className="flex items-center gap-2 bg-gray-100 text-gray-700 px-3 py-2 rounded-lg hover:bg-gray-200 transition-colors disabled:opacity-50"
          >
            {isRefreshing ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <RefreshCw className="w-4 h-4" />
            )}
            새로고침
          </button>
          <div className="text-xs text-gray-500">
            마지막 업데이트: {lastRefresh.toLocaleTimeString('ko-KR')}
          </div>
          <button
            onClick={handleOpenCreateModal}
            className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
          >
            <Plus className="w-4 h-4" />
            새 업무
          </button>
        </div>
      }
    >
      <div className="space-y-6">
        {/* 동적 통계 요약 */}
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          <div className="bg-white rounded-lg border border-gray-200 p-4 cursor-help relative group">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">전체 업무</p>
                <p className="text-2xl font-semibold text-gray-900">{dynamicStats.totalTasks}</p>
              </div>
              <Target className="w-8 h-8 text-blue-500" />
            </div>

            {/* 호버 툴팁 */}
            <div className="absolute left-0 top-full mt-2 w-48 p-3 bg-gray-900 text-white text-xs rounded-lg shadow-lg opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none z-50">
              <div className="font-semibold mb-2">📊 전체 업무</div>
              <div className="space-y-1">
                <div>• 시스템에 등록된 모든 업무</div>
                <div>• 삭제되지 않은 활성 상태 업무</div>
                <div>• 모든 단계와 우선순위 포함</div>
              </div>
              <div className="absolute bottom-full left-4 w-0 h-0 border-l-4 border-r-4 border-b-4 border-transparent border-b-gray-900"></div>
            </div>
          </div>
          <div className="bg-white rounded-lg border border-gray-200 p-4 cursor-help relative group">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">활성 단계</p>
                <p className="text-2xl font-semibold text-orange-600">{dynamicStats.stepsWithTasks}</p>
              </div>
              <TrendingUp className="w-8 h-8 text-orange-500" />
            </div>

            {/* 호버 툴팁 */}
            <div className="absolute left-0 top-full mt-2 w-52 p-3 bg-gray-900 text-white text-xs rounded-lg shadow-lg opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none z-50">
              <div className="font-semibold mb-2">🔄 활성 단계</div>
              <div className="space-y-1">
                <div>• 업무가 있는 워크플로우 단계 수</div>
                <div>• 총 7단계 중 업무가 진행 중인 단계</div>
                <div>• 비어있는 단계는 제외</div>
              </div>
              <div className="absolute bottom-full left-4 w-0 h-0 border-l-4 border-r-4 border-b-4 border-transparent border-b-gray-900"></div>
            </div>
          </div>
          <div className="bg-white rounded-lg border border-gray-200 p-4 cursor-help relative group">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">높은 우선순위</p>
                <p className="text-2xl font-semibold text-red-600">{dynamicStats.highPriorityTasks}</p>
              </div>
              <AlertCircle className="w-8 h-8 text-red-500" />
            </div>

            {/* 호버 툴팁 */}
            <div className="absolute left-0 top-full mt-2 w-48 p-3 bg-gray-900 text-white text-xs rounded-lg shadow-lg opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none z-50">
              <div className="font-semibold mb-2">🔴 높은 우선순위</div>
              <div className="space-y-1">
                <div>• 우선순위가 '높음'으로 설정된 업무</div>
                <div>• 즉시 처리가 필요한 긴급 업무</div>
                <div>• 빠른 대응이 요구되는 업무</div>
              </div>
              <div className="absolute bottom-full left-4 w-0 h-0 border-l-4 border-r-4 border-b-4 border-transparent border-b-gray-900"></div>
            </div>
          </div>
          <div
            className="bg-white rounded-lg border border-red-200 p-4 bg-red-50 cursor-help relative group"
            title="업무 타입별 지연 기준: 자비설치(21일), 보조금(30일), AS(10일), 기타(15일)"
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-red-600">지연 업무</p>
                <p className="text-2xl font-semibold text-red-700">{dynamicStats.delayedTasks}</p>
              </div>
              <Clock className="w-8 h-8 text-red-500" />
            </div>
            {/* 호버 도움말 */}
            <div className="absolute left-0 top-full mt-2 w-64 p-3 bg-gray-900 text-white text-xs rounded-lg shadow-lg opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none z-50">
              <div className="font-semibold mb-2">📅 지연 업무 기준</div>
              <div className="space-y-1">
                <div>• 자비 설치: 시작 후 21일</div>
                <div>• 보조금: 시작 후 30일</div>
                <div>• AS: 시작 후 10일</div>
                <div>• 기타: 시작 후 15일</div>
              </div>
              <div className="absolute bottom-full left-4 w-0 h-0 border-l-4 border-r-4 border-b-4 border-transparent border-b-gray-900"></div>
            </div>
          </div>
          <div
            className="bg-white rounded-lg border border-yellow-200 p-4 bg-yellow-50 cursor-help relative group"
            title="업무 타입별 위험 기준: 자비설치(14일), 보조금(20일), AS(7일), 기타(10일)"
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-yellow-600">위험 업무</p>
                <p className="text-2xl font-semibold text-yellow-700">{dynamicStats.atRiskTasks}</p>
              </div>
              <AlertCircle className="w-8 h-8 text-yellow-500" />
            </div>
            {/* 호버 도움말 */}
            <div className="absolute left-0 top-full mt-2 w-64 p-3 bg-gray-900 text-white text-xs rounded-lg shadow-lg opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none z-50">
              <div className="font-semibold mb-2">⚠️ 위험 업무 기준</div>
              <div className="space-y-1">
                <div>• 자비 설치: 시작 후 14일</div>
                <div>• 보조금: 시작 후 20일</div>
                <div>• AS: 시작 후 7일</div>
                <div>• 기타: 시작 후 10일</div>
              </div>
              <div className="absolute bottom-full left-4 w-0 h-0 border-l-4 border-r-4 border-b-4 border-transparent border-b-gray-900"></div>
            </div>
          </div>
        </div>

        {/* 필터 및 검색 */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
          <div className="flex flex-col lg:flex-row gap-4">
            {/* 필터 옵션들 */}
            <div className="flex flex-wrap gap-3">
              {/* 업무 타입 */}
              <select
                value={selectedType}
                onChange={(e) => setSelectedType(e.target.value as TaskType | 'all')}
                className="px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="all">전체 타입</option>
                <option value="self">자비</option>
                <option value="subsidy">보조금</option>
                <option value="etc">기타</option>
                <option value="as">AS</option>
              </select>

              {/* 우선순위 */}
              <select
                value={selectedPriority}
                onChange={(e) => setSelectedPriority(e.target.value as Priority | 'all')}
                className="px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="all">전체 우선순위</option>
                <option value="high">높음</option>
                <option value="medium">보통</option>
                <option value="low">낮음</option>
              </select>

              {/* 담당자 */}
              <select
                value={selectedAssignee}
                onChange={(e) => setSelectedAssignee(e.target.value)}
                className="px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="all">전체 담당자</option>
                {assignees.map(assignee => (
                  <option key={assignee} value={assignee}>{assignee}</option>
                ))}
              </select>
            </div>

            {/* 검색창 */}
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
              <input
                type="text"
                placeholder="업무명, 사업장명, 담당자로 검색..."
                className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                onChange={(e) => debouncedSearch(e.target.value)}
              />
            </div>
          </div>

          {/* 결과 요약 */}
          <div className="mt-4 flex items-center justify-between text-sm text-gray-600">
            <div className="flex items-center gap-4">
              <span>총 {filteredTasks.length}개 업무</span>
              {selectedType !== 'all' && (
                <span className="px-2 py-1 bg-blue-100 text-blue-800 rounded">
                  {selectedType === 'self' ? '자비' :
                   selectedType === 'subsidy' ? '보조금' :
                   selectedType === 'etc' ? '기타' : 'AS'}
                </span>
              )}
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs">
                데이터 연결: 정상
              </span>
              <div className="w-2 h-2 rounded-full bg-green-500" />
            </div>
          </div>
        </div>

        {/* 칸반 보드 */}
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <div className="text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
              <p className="text-gray-500">업무 목록을 불러오는 중...</p>
            </div>
          </div>
        ) : (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
            {/* 칸반 보드 헤더 */}
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">업무 흐름</h3>
              <button
                onClick={() => setIsCompactMode(!isCompactMode)}
                className="flex items-center gap-2 px-3 py-2 text-sm bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
              >
                {isCompactMode ? (
                  <>
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                    전체 보기
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                    </svg>
                    간소 보기
                  </>
                )}
              </button>
            </div>
            <div className="flex gap-4 overflow-x-auto pb-4">
              {tasksByStatus.steps.map((step) => (
                <div
                  key={step.status}
                  className="flex-shrink-0 w-64 bg-gray-50 rounded-lg p-3"
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={() => handleDrop(step.status)}
                >
                  {/* 칼럼 헤더 */}
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <div className={`w-3 h-3 rounded-full bg-${step.color}-500`} />
                      <h3 className="font-medium text-gray-900 text-sm">{step.label}</h3>
                    </div>
                    <span className="text-xs text-gray-500 bg-white px-2 py-1 rounded">
                      총 {tasksByStatus.grouped[step.status]?.length || 0}개
                    </span>
                  </div>

                  {/* 업무 카드들 */}
                  <div className={`space-y-2 ${isCompactMode ? 'min-h-[100px]' : 'max-h-[400px] overflow-y-auto'}`}>
                    {getDisplayTasks(tasksByStatus.grouped[step.status] || []).map((task) => (
                      <div
                        key={task.id}
                        draggable
                        onDragStart={() => handleDragStart(task)}
                        onDragEnd={handleDragEnd}
                        onClick={() => handleOpenEditModal(task)}
                        className={`bg-white border rounded-lg p-3 cursor-pointer hover:shadow-sm transition-all group ${
                          task.delayStatus === 'overdue'
                            ? 'border-red-300 bg-red-50'
                            : task.delayStatus === 'delayed'
                            ? 'border-red-200 bg-red-25'
                            : task.delayStatus === 'at_risk'
                            ? 'border-yellow-200 bg-yellow-25'
                            : 'border-gray-200 hover:border-gray-300'
                        }`}
                      >
                        {/* 카드 헤더 */}
                        <div className="flex items-start justify-between mb-2">
                          <div className="flex-1 pr-2">
                            {/* 타입 뱃지 (전체 필터일 때만 표시) */}
                            {selectedType === 'all' && (
                              <div className="mb-1">
                                <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${getTaskTypeBadge(task.type).color}`}>
                                  {getTaskTypeBadge(task.type).label}
                                </span>
                              </div>
                            )}
                            <h4 className="font-medium text-gray-900 text-sm leading-tight">
                              {task.title}
                            </h4>
                          </div>
                          <div className="flex items-center gap-1 flex-col">
                            <div className="flex items-center gap-1">
                              {getPriorityIcon(task.priority)}
                              <span className={`px-1.5 py-0.5 text-xs rounded ${
                                task.type === 'self'
                                  ? 'bg-blue-100 text-blue-800'
                                  : task.type === 'subsidy'
                                  ? 'bg-purple-100 text-purple-800'
                                  : task.type === 'etc'
                                  ? 'bg-gray-100 text-gray-800'
                                  : 'bg-orange-100 text-orange-800'
                              }`}>
                                {task.type === 'self' ? '자비' :
                                 task.type === 'subsidy' ? '보조금' :
                                 task.type === 'etc' ? '기타' : 'AS'}
                              </span>
                            </div>
                            {/* 지연 상태 표시 */}
                            {task.delayStatus && task.delayStatus !== 'on_time' && (
                              <span className={`px-1.5 py-0.5 text-xs rounded font-medium ${
                                task.delayStatus === 'overdue'
                                  ? 'bg-red-100 text-red-800'
                                  : task.delayStatus === 'delayed'
                                  ? 'bg-red-100 text-red-700'
                                  : 'bg-yellow-100 text-yellow-800'
                              }`}>
                                {task.delayStatus === 'overdue'
                                  ? `${task.delayDays}일 초과`
                                  : task.delayStatus === 'delayed'
                                  ? `${task.delayDays}일 지연`
                                  : '위험'}
                              </span>
                            )}
                          </div>
                        </div>

                        {/* 사업장 정보 */}
                        <div className="flex items-center gap-1 text-xs text-gray-600 mb-2">
                          <Building2 className="w-3 h-3" />
                          <span className="truncate">{task.businessName}</span>
                        </div>

                        {/* 담당자 및 마감일 */}
                        <div className="flex flex-col gap-2 text-xs">
                          {/* 담당자 (다중 지원) */}
                          <div className="flex items-center gap-1 text-gray-500">
                            {task.assignees && task.assignees.length > 0 ? (
                              <div className="flex flex-wrap gap-1">
                                <Users className="w-3 h-3 mt-0.5 text-gray-400" />
                                {task.assignees.slice(0, 2).map((assignee, index) => (
                                  <span
                                    key={assignee.id}
                                    className="inline-flex items-center px-1.5 py-0.5 bg-blue-100 text-blue-800 rounded text-xs font-medium"
                                    title={`${assignee.name} (${assignee.position})`}
                                  >
                                    {assignee.name}
                                  </span>
                                ))}
                                {task.assignees.length > 2 && (
                                  <span className="text-gray-400 text-xs">
                                    +{task.assignees.length - 2}명
                                  </span>
                                )}
                              </div>
                            ) : (
                              <div className="flex items-center gap-1">
                                <User className="w-3 h-3" />
                                <span>{task.assignee || '미배정'}</span>
                              </div>
                            )}
                          </div>

                          {/* 마감일 */}
                          {task.dueDate && (
                            <div className="flex items-center gap-1 text-gray-500">
                              <Calendar className="w-3 h-3" />
                              <span>{formatDate(task.dueDate)}</span>
                            </div>
                          )}
                        </div>

                        {/* 호버 시 액션 버튼 */}
                        <div className="opacity-0 group-hover:opacity-100 transition-opacity mt-2 flex justify-end gap-1">
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              handleOpenEditModal(task)
                            }}
                            className="p-1 text-gray-400 hover:text-green-600 rounded"
                            title="수정"
                          >
                            <Edit className="w-3 h-3" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 업무 리스트 뷰 */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-6">업무 목록</h2>

          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
              <span className="ml-2 text-gray-500">로딩 중...</span>
            </div>
          ) : filteredTasks.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              등록된 업무가 없습니다.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="text-left py-3 px-4 text-sm font-medium text-gray-700">사업장</th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-gray-700">업무명</th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-gray-700">업무 단계</th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-gray-700">담당자</th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-gray-700">상태</th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-gray-700">우선순위</th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-gray-700">마감일</th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-gray-700">작업</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredTasks.map((task, index) => {
                    const step = (task.type === 'self' ? selfSteps :
                                   task.type === 'subsidy' ? subsidySteps :
                                   task.type === 'etc' ? etcSteps : asSteps).find(s => s.status === task.status)
                    return (
                      <tr key={task.id} className={`border-b border-gray-100 hover:bg-gray-50 ${index % 2 === 0 ? 'bg-white' : 'bg-gray-25'}`}>
                        <td className="py-3 px-4 text-sm">
                          <div className="font-medium text-gray-900">{task.businessName}</div>
                        </td>
                        <td className="py-3 px-4 text-sm">
                          <div className="flex flex-col gap-1">
                            {/* 타입 뱃지 (전체 필터일 때만 표시) */}
                            {selectedType === 'all' && (
                              <div>
                                <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${getTaskTypeBadge(task.type).color}`}>
                                  {getTaskTypeBadge(task.type).label}
                                </span>
                              </div>
                            )}
                            <div className="font-medium text-gray-900">{task.title}</div>
                            {task.description && (
                              <div className="text-xs text-gray-500 mt-1 truncate max-w-xs">{task.description}</div>
                            )}
                          </div>
                        </td>
                        <td className="py-3 px-4 text-sm">
                          <span className={`inline-flex px-2 py-1 text-xs rounded-full ${getColorClasses(step?.color || 'gray')}`}>
                            {step?.label || task.status}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-sm text-gray-600">
                          {task.assignees && task.assignees.length > 0 ? (
                            <div className="flex flex-wrap gap-1">
                              {task.assignees.slice(0, 3).map((assignee) => (
                                <span
                                  key={assignee.id}
                                  className="inline-flex items-center px-2 py-1 bg-blue-100 text-blue-800 rounded text-xs font-medium"
                                  title={`${assignee.name} (${assignee.position})`}
                                >
                                  {assignee.name}
                                </span>
                              ))}
                              {task.assignees.length > 3 && (
                                <span className="text-gray-400 text-xs">
                                  +{task.assignees.length - 3}명
                                </span>
                              )}
                            </div>
                          ) : (
                            task.assignee || '미배정'
                          )}
                        </td>
                        <td className="py-3 px-4 text-sm">
                          <span className={`inline-flex px-2 py-1 text-xs rounded ${
                            task.type === 'self'
                              ? 'bg-blue-100 text-blue-800'
                              : task.type === 'subsidy'
                              ? 'bg-purple-100 text-purple-800'
                              : task.type === 'etc'
                              ? 'bg-gray-100 text-gray-800'
                              : 'bg-orange-100 text-orange-800'
                          }`}>
                            {task.type === 'self' ? '자비' :
                             task.type === 'subsidy' ? '보조금' :
                             task.type === 'etc' ? '기타' : 'AS'}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-sm">
                          <div className="flex items-center gap-1">
                            {getPriorityIcon(task.priority)}
                            <span className="capitalize">{task.priority}</span>
                          </div>
                        </td>
                        <td className="py-3 px-4 text-sm text-gray-600">
                          {task.dueDate ? formatDate(task.dueDate) : '-'}
                        </td>
                        <td className="py-3 px-4 text-sm">
                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => handleOpenEditModal(task)}
                              className="p-1 text-gray-400 hover:text-green-600 rounded"
                              title="수정"
                            >
                              <Edit className="w-4 h-4" />
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation()
                                handleDeleteTask(task.id)
                              }}
                              className="p-1 text-gray-400 hover:text-red-600 rounded"
                              title="삭제"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* 새 업무 등록 모달 */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl mx-4 max-h-[95vh] overflow-hidden">
            {/* 세련된 헤더 섹션 */}
            <div className="bg-gradient-to-r from-green-600 to-green-700 px-8 py-6 text-white">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="bg-white bg-opacity-20 rounded-xl p-3">
                    <Plus className="w-6 h-6" />
                  </div>
                  <div>
                    <h1 className="text-2xl font-bold">새 업무 등록</h1>
                    <p className="text-green-100 mt-1">새로운 업무를 시스템에 등록합니다</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className={`inline-flex px-3 py-1 text-sm rounded-full font-medium ${
                    createTaskForm.type === 'self'
                      ? 'bg-blue-100 text-blue-800'
                      : createTaskForm.type === 'subsidy'
                      ? 'bg-purple-100 text-purple-800'
                      : createTaskForm.type === 'etc'
                      ? 'bg-gray-100 text-gray-800'
                      : 'bg-orange-100 text-orange-800'
                  }`}>
                    {createTaskForm.type === 'self' ? '자비' :
                     createTaskForm.type === 'subsidy' ? '보조금' :
                     createTaskForm.type === 'etc' ? '기타' : 'AS'}
                  </span>

                  {/* 액션 버튼들 */}
                  <div className="flex items-center gap-2 ml-4">
                    <button
                      onClick={() => setShowCreateModal(false)}
                      className="px-4 py-2 text-white bg-white bg-opacity-20 rounded-lg hover:bg-opacity-30 transition-all font-medium backdrop-blur-sm border border-white border-opacity-30"
                    >
                      취소
                    </button>
                    <button
                      onClick={handleCreateTask}
                      className="px-6 py-2 bg-white text-green-700 rounded-lg hover:bg-green-50 transition-all font-medium shadow-lg"
                    >
                      등록
                    </button>
                  </div>
                </div>
              </div>
            </div>

            <div className="p-8 overflow-y-auto max-h-[calc(95vh-120px)]">
              {/* 핵심 정보 카드들 */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
                {/* 업무 정보 카드 */}
                <div className="bg-gradient-to-br from-green-50 to-green-100 rounded-xl p-6 border border-green-200">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="bg-green-600 rounded-lg p-2">
                      <FileText className="w-5 h-5 text-white" />
                    </div>
                    <h3 className="font-semibold text-gray-900">업무 정보</h3>
                  </div>
                  <div className="space-y-2">
                    <p className="text-sm text-gray-600">업무 타입</p>
                    <p className="font-medium text-gray-900">
                      {createTaskForm.type === 'self' ? '자비 업무' :
                       createTaskForm.type === 'subsidy' ? '보조금 업무' :
                       createTaskForm.type === 'etc' ? '기타 업무' : 'AS 업무'}
                    </p>
                  </div>
                </div>

                {/* 일정 관리 카드 */}
                <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-xl p-6 border border-blue-200">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="bg-blue-600 rounded-lg p-2">
                      <Calendar className="w-5 h-5 text-white" />
                    </div>
                    <h3 className="font-semibold text-gray-900">일정 관리</h3>
                  </div>
                  <div className="space-y-2">
                    <p className="text-sm text-gray-600">시작일</p>
                    <p className="font-medium text-gray-900">
                      {createTaskForm.startDate ? new Date(createTaskForm.startDate).toLocaleDateString('ko-KR') : '미설정'}
                    </p>
                  </div>
                </div>

                {/* 담당자 배정 카드 */}
                <div className="bg-gradient-to-br from-purple-50 to-purple-100 rounded-xl p-6 border border-purple-200">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="bg-purple-600 rounded-lg p-2">
                      <User className="w-5 h-5 text-white" />
                    </div>
                    <h3 className="font-semibold text-gray-900">담당자 배정</h3>
                  </div>
                  <div className="space-y-2">
                    <p className="text-sm text-gray-600">우선순위</p>
                    <p className="font-medium text-gray-900">
                      {createTaskForm.priority === 'high' ? '높음' :
                       createTaskForm.priority === 'medium' ? '보통' : '낮음'}
                    </p>
                  </div>
                </div>
              </div>

              {/* 수정 폼 */}
              <div className="bg-gray-50 rounded-xl p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-6">업무 정보 입력</h3>
                <div className="space-y-4">
                {/* 사업장 선택 (기타 타입일 때는 선택사항) */}
                <div className="relative">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    사업장 {createTaskForm.type !== 'etc' && <span className="text-red-500">*</span>}
                  </label>
                  <input
                    type="text"
                    value={businessSearchTerm}
                    onChange={(e) => handleBusinessSearch(e.target.value)}
                    onFocus={() => setShowBusinessDropdown(businessSearchTerm.length >= 2)}
                    onKeyDown={(e) => handleBusinessKeyDown(e)}
                    placeholder="사업장명을 입력하세요 (최소 2글자)"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                  />

                  {/* 자동완성 드롭다운 */}
                  {showBusinessDropdown && filteredBusinesses.length > 0 && (
                    <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                      {filteredBusinesses.map((business, index) => (
                        <div
                          key={business.id}
                          onClick={() => handleBusinessSelect(business)}
                          className={`p-3 cursor-pointer border-b border-gray-100 last:border-b-0 ${
                            index === selectedBusinessIndex
                              ? 'bg-blue-50 border-blue-200'
                              : 'hover:bg-gray-50'
                          }`}
                        >
                          <div className="font-medium text-gray-900">{business.name}</div>
                          <div className="text-sm text-gray-500">{business.address}</div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* 업무명 (필수) */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    업무명 <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={createTaskForm.title}
                    onChange={(e) => setCreateTaskForm(prev => ({ ...prev, title: e.target.value }))}
                    placeholder="업무명을 입력하세요"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* 업무 타입 */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">업무 타입</label>
                    <select
                      value={createTaskForm.type}
                      onChange={(e) => setCreateTaskForm(prev => ({ ...prev, type: e.target.value as TaskType }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                    >
                      <option value="self">자비</option>
                      <option value="subsidy">보조금</option>
                      <option value="etc">기타</option>
                      <option value="as">AS</option>
                    </select>
                  </div>

                  {/* 우선순위 */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">우선순위</label>
                    <select
                      value={createTaskForm.priority}
                      onChange={(e) => setCreateTaskForm(prev => ({ ...prev, priority: e.target.value as Priority }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                    >
                      <option value="high">높음</option>
                      <option value="medium">보통</option>
                      <option value="low">낮음</option>
                    </select>
                  </div>
                </div>

                {/* 시작 단계 */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">시작 단계</label>
                  <select
                    value={createTaskForm.status}
                    onChange={(e) => setCreateTaskForm(prev => ({ ...prev, status: e.target.value as TaskStatus }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                  >
                    {(createTaskForm.type === 'self' ? selfSteps :
                     createTaskForm.type === 'subsidy' ? subsidySteps :
                     createTaskForm.type === 'etc' ? etcSteps : asSteps).map(step => (
                      <option key={step.status} value={step.status}>{step.label}</option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {/* 담당자 (다중 선택) */}
                  <div className="md:col-span-3">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      담당자 <span className="text-gray-500 text-xs">(여러 명 선택 가능)</span>
                    </label>
                    <MultiAssigneeSelector
                      selectedAssignees={createTaskForm.assignees}
                      onAssigneesChange={(assignees) => setCreateTaskForm(prev => ({
                        ...prev,
                        assignees,
                        assignee: assignees.length > 0 ? assignees[0].name : ''
                      }))}
                      placeholder="담당자를 검색하여 선택하세요"
                      maxAssignees={5}
                      showCurrentUserFirst={true}
                      className="w-full"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">

                  {/* 시작일 */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">시작일</label>
                    <input
                      type="date"
                      value={createTaskForm.startDate}
                      onChange={(e) => setCreateTaskForm(prev => ({ ...prev, startDate: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                    />
                  </div>

                  {/* 마감일 */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">마감일</label>
                    <input
                      type="date"
                      value={createTaskForm.dueDate}
                      onChange={(e) => setCreateTaskForm(prev => ({ ...prev, dueDate: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                    />
                  </div>
                </div>


                {/* 업무 설명 */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">업무 설명</label>
                  <textarea
                    value={createTaskForm.description}
                    onChange={(e) => setCreateTaskForm(prev => ({ ...prev, description: e.target.value }))}
                    placeholder="업무에 대한 설명을 입력하세요"
                    rows={3}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                  />
                </div>

                {/* 메모 */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">메모</label>
                  <textarea
                    value={createTaskForm.notes}
                    onChange={(e) => setCreateTaskForm(prev => ({ ...prev, notes: e.target.value }))}
                    placeholder="메모나 추가 정보를 입력하세요"
                    rows={2}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                  />
                </div>
                </div>

                {/* 하단 여백 */}
                <div className="mt-6"></div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 업무 상세/수정 모달 */}
      {showEditModal && editingTask && (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl mx-4 max-h-[95vh] overflow-hidden">
            {/* 세련된 헤더 섹션 */}
            <div className="bg-gradient-to-r from-blue-600 to-blue-700 px-8 py-6 text-white">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="bg-white bg-opacity-20 rounded-xl p-3">
                    <Building2 className="w-6 h-6" />
                  </div>
                  <div>
                    <h1 className="text-2xl font-bold">{editingTask.title}</h1>
                    <p className="text-blue-100 mt-1">{editingTask.businessName}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className={`inline-flex px-3 py-1 text-sm rounded-full font-medium ${
                    editingTask.type === 'self'
                      ? 'bg-blue-100 text-blue-800'
                      : editingTask.type === 'subsidy'
                      ? 'bg-purple-100 text-purple-800'
                      : editingTask.type === 'etc'
                      ? 'bg-gray-100 text-gray-800'
                      : 'bg-orange-100 text-orange-800'
                  }`}>
                    {editingTask.type === 'self' ? '자비' :
                     editingTask.type === 'subsidy' ? '보조금' :
                     editingTask.type === 'etc' ? '기타' : 'AS'}
                  </span>

                  {/* 액션 버튼들 */}
                  <div className="flex items-center gap-2 ml-4">
                    <button
                      onClick={() => handleDeleteTask(editingTask.id)}
                      className="px-4 py-2 text-white bg-red-500 bg-opacity-90 rounded-lg hover:bg-red-600 transition-all font-medium"
                    >
                      삭제
                    </button>
                    <button
                      onClick={() => {
                        setShowEditModal(false)
                        setEditingTask(null)
                      }}
                      className="px-4 py-2 text-white bg-white bg-opacity-20 rounded-lg hover:bg-opacity-30 transition-all font-medium backdrop-blur-sm border border-white border-opacity-30"
                    >
                      취소
                    </button>
                    <button
                      onClick={handleUpdateTask}
                      className="px-6 py-2 bg-white text-blue-700 rounded-lg hover:bg-blue-50 transition-all font-medium shadow-lg"
                    >
                      변경사항 저장
                    </button>
                  </div>
                </div>
              </div>
            </div>

            <div className="p-8 overflow-y-auto max-h-[calc(95vh-120px)]">
              {/* 핵심 정보 카드들 */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
                {/* 진행 상태 카드 */}
                <div className="bg-gradient-to-br from-green-50 to-green-100 rounded-xl p-6 border border-green-200">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="bg-green-600 rounded-lg p-2">
                      <CheckCircle className="w-5 h-5 text-white" />
                    </div>
                    <h3 className="font-semibold text-gray-900">진행 상태</h3>
                  </div>
                  <div className="space-y-2">
                    <p className="text-sm text-gray-600">현재 단계</p>
                    <p className="font-medium text-gray-900">
                      {(editingTask.type === 'self' ? selfSteps :
                       editingTask.type === 'subsidy' ? subsidySteps :
                       editingTask.type === 'etc' ? etcSteps : asSteps)
                       .find(s => s.status === editingTask.status)?.label || editingTask.status}
                    </p>
                  </div>
                </div>

                {/* 우선순위 카드 */}
                <div className={`rounded-xl p-6 border ${
                  editingTask.priority === 'high'
                    ? 'bg-gradient-to-br from-red-50 to-red-100 border-red-200'
                    : editingTask.priority === 'medium'
                    ? 'bg-gradient-to-br from-yellow-50 to-yellow-100 border-yellow-200'
                    : 'bg-gradient-to-br from-green-50 to-green-100 border-green-200'
                }`}>
                  <div className="flex items-center gap-3 mb-4">
                    <div className={`rounded-lg p-2 ${
                      editingTask.priority === 'high'
                        ? 'bg-red-600'
                        : editingTask.priority === 'medium'
                        ? 'bg-yellow-600'
                        : 'bg-green-600'
                    }`}>
                      <Flag className="w-5 h-5 text-white" />
                    </div>
                    <h3 className="font-semibold text-gray-900">우선순위</h3>
                  </div>
                  <div className="space-y-2">
                    <p className="text-sm text-gray-600">중요도</p>
                    <p className="font-medium text-gray-900 capitalize">
                      {editingTask.priority === 'high' ? '높음' :
                       editingTask.priority === 'medium' ? '보통' : '낮음'}
                    </p>
                  </div>
                </div>

                {/* 담당자 카드 */}
                <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-xl p-6 border border-blue-200">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="bg-blue-600 rounded-lg p-2">
                      <User className="w-5 h-5 text-white" />
                    </div>
                    <h3 className="font-semibold text-gray-900">담당자</h3>
                  </div>
                  <div className="space-y-2">
                    <p className="text-sm text-gray-600">배정된 담당자</p>
                    <p className="font-medium text-gray-900">
                      {editingTask.assignee || '미배정'}
                    </p>
                  </div>
                </div>
              </div>

              {/* 수정 폼 */}
              <div className="bg-gray-50 rounded-xl p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-6">업무 정보 수정</h3>
                <div className="space-y-4">
                {/* 사업장 선택 (기타 타입일 때는 선택사항) */}
                <div className="relative">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    사업장 {editingTask?.type !== 'etc' && <span className="text-red-500">*</span>}
                  </label>
                  <input
                    type="text"
                    value={editBusinessSearchTerm}
                    onChange={(e) => handleBusinessSearch(e.target.value, true)}
                    onFocus={() => setShowEditBusinessDropdown(editBusinessSearchTerm.length >= 2)}
                    onKeyDown={(e) => handleBusinessKeyDown(e, true)}
                    placeholder="사업장명을 입력하세요 (최소 2글자)"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                  />

                  {/* 자동완성 드롭다운 */}
                  {showEditBusinessDropdown && filteredEditBusinesses.length > 0 && (
                    <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                      {filteredEditBusinesses.map((business, index) => (
                        <div
                          key={business.id}
                          onClick={() => handleBusinessSelect(business, true)}
                          className={`p-3 cursor-pointer border-b border-gray-100 last:border-b-0 ${
                            index === editSelectedBusinessIndex
                              ? 'bg-blue-50 border-blue-200'
                              : 'hover:bg-gray-50'
                          }`}
                        >
                          <div className="font-medium text-gray-900">{business.name}</div>
                          <div className="text-sm text-gray-500">{business.address}</div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* 업무명 (필수) */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    업무명 <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={editingTask.title}
                    onChange={(e) => setEditingTask(prev => prev ? { ...prev, title: e.target.value } : null)}
                    placeholder="업무명을 입력하세요"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* 업무 타입 */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">업무 타입</label>
                    <select
                      value={editingTask.type}
                      onChange={(e) => setEditingTask(prev => prev ? { ...prev, type: e.target.value as TaskType } : null)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    >
                      <option value="self">자비</option>
                      <option value="subsidy">보조금</option>
                      <option value="etc">기타</option>
                      <option value="as">AS</option>
                    </select>
                  </div>

                  {/* 우선순위 */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">우선순위</label>
                    <select
                      value={editingTask.priority}
                      onChange={(e) => setEditingTask(prev => prev ? { ...prev, priority: e.target.value as Priority } : null)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    >
                      <option value="high">높음</option>
                      <option value="medium">보통</option>
                      <option value="low">낮음</option>
                    </select>
                  </div>
                </div>

                {/* 현재 단계 */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">현재 단계</label>
                  <select
                    value={editingTask.status}
                    onChange={(e) => setEditingTask(prev => prev ? { ...prev, status: e.target.value as TaskStatus } : null)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    {(editingTask.type === 'self' ? selfSteps :
                     editingTask.type === 'subsidy' ? subsidySteps :
                     editingTask.type === 'etc' ? etcSteps : asSteps).map(step => (
                      <option key={step.status} value={step.status}>{step.label}</option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {/* 담당자 (다중 선택) */}
                  <div className="md:col-span-3">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      담당자 <span className="text-gray-500 text-xs">(여러 명 선택 가능)</span>
                    </label>
                    <MultiAssigneeSelector
                      selectedAssignees={editingTask.assignees || []}
                      onAssigneesChange={(assignees) => setEditingTask(prev => prev ? {
                        ...prev,
                        assignees,
                        assignee: assignees.length > 0 ? assignees[0].name : undefined
                      } : null)}
                      placeholder="담당자를 검색하여 선택하세요"
                      maxAssignees={5}
                      showCurrentUserFirst={true}
                      className="w-full"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">

                  {/* 시작일 */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">시작일</label>
                    <input
                      type="date"
                      value={editingTask.startDate || ''}
                      onChange={(e) => setEditingTask(prev => prev ? { ...prev, startDate: e.target.value || undefined } : null)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                    />
                  </div>

                  {/* 마감일 */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">마감일</label>
                    <input
                      type="date"
                      value={editingTask.dueDate || ''}
                      onChange={(e) => setEditingTask(prev => prev ? { ...prev, dueDate: e.target.value || undefined } : null)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                    />
                  </div>
                </div>


                {/* 업무 설명 */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">업무 설명</label>
                  <textarea
                    value={editingTask.description || ''}
                    onChange={(e) => setEditingTask(prev => prev ? { ...prev, description: e.target.value || undefined } : null)}
                    placeholder="업무에 대한 설명을 입력하세요"
                    rows={3}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                  />
                </div>

                {/* 메모 */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">메모</label>
                  <textarea
                    value={editingTask.notes || ''}
                    onChange={(e) => setEditingTask(prev => prev ? { ...prev, notes: e.target.value || undefined } : null)}
                    placeholder="메모나 추가 정보를 입력하세요"
                    rows={2}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                  />
                </div>
                </div>

                {/* 하단 여백 */}
                <div className="mt-6"></div>
              </div>
            </div>
          </div>
        </div>
      )}
    </AdminLayout>
  );
}

export default withAuth(TaskManagementPage, undefined, 1)