'use client'

import { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import { useSSE, SSEEvent } from '@/hooks/useSSE'
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
  assignee?: string
  startDate?: string
  dueDate?: string
  estimatedDays?: number
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
  assignee: string
  startDate: string
  dueDate: string
  estimatedDays: string
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

export default function TaskManagementPage() {
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
    startDate: '',
    dueDate: '',
    estimatedDays: '',
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

  // SSE 메시지 핸들러
  const handleSSEMessage = useCallback((event: SSEEvent) => {
    switch (event.type) {
      case 'connected':
        console.log('✅ SSE 연결 성공:', event.message)
        break

      case 'initial':
        console.log('📥 초기 데이터 수신:', event.tasks?.length, '개 업무')
        if (event.tasks) {
          setTasks(event.tasks)
          setIsLoading(false)
          setLastRefresh(new Date())
        }
        break

      case 'task_added':
        console.log('➕ 새 업무 추가:', event.task?.title)
        if (event.task) {
          setTasks(prev => [...prev, event.task])
          setLastRefresh(new Date())
        }
        break

      case 'task_updated':
        console.log('🔄 업무 업데이트:', event.task?.title)
        if (event.task) {
          setTasks(prev => prev.map(task =>
            task.id === event.task.id ? { ...task, ...event.task } : task
          ))
          setLastRefresh(new Date())
        }
        break

      case 'task_deleted':
        console.log('🗑️ 업무 삭제:', event.task?.title)
        if (event.task) {
          setTasks(prev => prev.filter(task => task.id !== event.task.id))
          setLastRefresh(new Date())
        }
        break
    }
  }, [])

  // SSE 연결 설정
  const { connectionStatus, isConnected, reconnect } = useSSE({
    url: '/api/tasks/stream',
    onMessage: handleSSEMessage,
    onError: (error) => console.error('❌ SSE 연결 오류:', error),
    onOpen: () => console.log('🔗 SSE 연결 시작'),
    onClose: () => console.log('📴 SSE 연결 종료'),
    autoReconnect: true,
    reconnectInterval: 3000,
    maxReconnectAttempts: 5
  })

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

  // 수동 새로고침 (SSE 재연결)
  const refreshTasks = useCallback(async () => {
    setIsRefreshing(true)
    reconnect()
    setIsRefreshing(false)
  }, [reconnect])

  // SSE 테스트용 시뮬레이션 함수
  const simulateTaskChange = useCallback(async () => {
    try {
      const response = await fetch('/api/tasks/stream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'simulate_change' })
      })

      if (!response.ok) {
        throw new Error('시뮬레이션 요청 실패')
      }

      console.log('📡 SSE 시뮬레이션 요청 전송됨')
    } catch (error) {
      console.error('SSE 시뮬레이션 오류:', error)
    }
  }, [])

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
      // 상태 업데이트 (실제 API 호출로 대체 예정)
      setTasks(prev => prev.map(task =>
        task.id === draggedTask.id
          ? { ...task, status }
          : task
      ))

      // 성공 메시지 표시 (실제 구현에서는 toast 등 사용)
      console.log(`업무 "${draggedTask.title}"이(가) ${status} 상태로 이동되었습니다.`)
    } catch (error) {
      console.error('Failed to update task status:', error)
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

      const newTask: Task = {
        id: Date.now().toString(),
        title: createTaskForm.title,
        businessName: businessSearchTerm,
        type: createTaskForm.type,
        status: createTaskForm.status,
        priority: createTaskForm.priority,
        assignee: createTaskForm.assignee || undefined,
        startDate: createTaskForm.startDate || undefined,
        dueDate: createTaskForm.dueDate || undefined,
        estimatedDays: createTaskForm.estimatedDays ? (isNaN(parseInt(createTaskForm.estimatedDays)) ? undefined : parseInt(createTaskForm.estimatedDays)) : undefined,
        progressPercentage: 0,
        delayStatus: 'on_time',
        delayDays: 0,
        createdAt: new Date().toISOString(),
        description: createTaskForm.description || undefined,
        notes: createTaskForm.notes || undefined
      }

      // 업무 목록에 추가
      setTasks(prev => [newTask, ...prev])

      // 폼 초기화
      setCreateTaskForm({
        title: '',
        businessName: '',
        type: 'self',
        status: 'customer_contact',
        priority: 'medium',
        assignee: '',
        startDate: '',
        dueDate: '',
        estimatedDays: '',
        description: '',
        notes: ''
      })

      // 모달 닫기
      setShowCreateModal(false)

      alert('새 업무가 성공적으로 등록되었습니다.')
    } catch (error) {
      console.error('Failed to create task:', error)
      alert('업무 등록 중 오류가 발생했습니다.')
    }
  }, [createTaskForm])

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
      startDate: today,
      dueDate: '',
      estimatedDays: '',
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
    setEditBusinessSearchTerm(task.businessName)
    setShowEditBusinessDropdown(false)
    setShowEditModal(true)
  }, [])

  // 업무 수정 핸들러
  const handleUpdateTask = useCallback(async () => {
    if (!editingTask) return

    try {
      // 업무 목록에서 해당 업무 업데이트
      setTasks(prev => prev.map(task =>
        task.id === editingTask.id
          ? { ...editingTask, updatedAt: new Date().toISOString() }
          : task
      ))

      // 모달 닫기
      setShowEditModal(false)
      setEditingTask(null)

      alert('업무가 성공적으로 수정되었습니다.')
    } catch (error) {
      console.error('Failed to update task:', error)
      alert('업무 수정 중 오류가 발생했습니다.')
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
            onClick={simulateTaskChange}
            className="flex items-center gap-2 bg-orange-600 text-white px-3 py-2 rounded-lg hover:bg-orange-700 transition-colors text-xs"
          >
            테스트
          </button>
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
          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">전체 업무</p>
                <p className="text-2xl font-semibold text-gray-900">{dynamicStats.totalTasks}</p>
              </div>
              <Target className="w-8 h-8 text-blue-500" />
            </div>
          </div>
          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">활성 단계</p>
                <p className="text-2xl font-semibold text-orange-600">{dynamicStats.stepsWithTasks}</p>
              </div>
              <TrendingUp className="w-8 h-8 text-orange-500" />
            </div>
          </div>
          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">높은 우선순위</p>
                <p className="text-2xl font-semibold text-red-600">{dynamicStats.highPriorityTasks}</p>
              </div>
              <AlertCircle className="w-8 h-8 text-red-500" />
            </div>
          </div>
          <div className="bg-white rounded-lg border border-red-200 p-4 bg-red-50">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-red-600">지연 업무</p>
                <p className="text-2xl font-semibold text-red-700">{dynamicStats.delayedTasks}</p>
              </div>
              <Clock className="w-8 h-8 text-red-500" />
            </div>
          </div>
          <div className="bg-white rounded-lg border border-yellow-200 p-4 bg-yellow-50">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-yellow-600">위험 업무</p>
                <p className="text-2xl font-semibold text-yellow-700">{dynamicStats.atRiskTasks}</p>
              </div>
              <AlertCircle className="w-8 h-8 text-yellow-500" />
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
                SSE 연결: {connectionStatus === 'connected' ? '연결됨' :
                          connectionStatus === 'connecting' ? '연결중' :
                          connectionStatus === 'reconnecting' ? '재연결중' : '연결 끊김'}
              </span>
              <div className={`w-2 h-2 rounded-full ${
                connectionStatus === 'connected' ? 'bg-green-500' :
                connectionStatus === 'connecting' || connectionStatus === 'reconnecting' ? 'bg-yellow-500' :
                'bg-red-500'
              }`} />
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
                          <h4 className="font-medium text-gray-900 text-sm leading-tight flex-1 pr-2">
                            {task.title}
                          </h4>
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
                        <div className="flex items-center justify-between text-xs text-gray-500">
                          <div className="flex items-center gap-1">
                            <User className="w-3 h-3" />
                            <span>{task.assignee || '미배정'}</span>
                          </div>
                          {task.dueDate && (
                            <div className="flex items-center gap-1">
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
                          <div className="font-medium text-gray-900">{task.title}</div>
                          {task.description && (
                            <div className="text-xs text-gray-500 mt-1 truncate max-w-xs">{task.description}</div>
                          )}
                        </td>
                        <td className="py-3 px-4 text-sm">
                          <span className={`inline-flex px-2 py-1 text-xs rounded-full ${getColorClasses(step?.color || 'gray')}`}>
                            {step?.label || task.status}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-sm text-gray-600">
                          {task.assignee || '미배정'}
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
                              onClick={() => {
                                if (confirm('이 업무를 삭제하시겠습니까?')) {
                                  setTasks(prev => prev.filter(t => t.id !== task.id))
                                  alert('업무가 삭제되었습니다.')
                                }
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
                  <button
                    onClick={() => setShowCreateModal(false)}
                    className="text-white hover:text-green-200 bg-white bg-opacity-20 rounded-lg p-2 transition-colors"
                  >
                    <X className="w-5 h-5" />
                  </button>
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
                  {/* 담당자 */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">담당자</label>
                    <select
                      value={createTaskForm.assignee}
                      onChange={(e) => setCreateTaskForm(prev => ({ ...prev, assignee: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                    >
                      <option value="">담당자 선택</option>
                      {assignees.map(assignee => (
                        <option key={assignee} value={assignee}>{assignee}</option>
                      ))}
                    </select>
                  </div>

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

                {/* 버튼 영역 */}
                <div className="flex justify-end items-center mt-8 pt-6 border-t border-gray-200">
                  <div className="flex gap-3">
                    <button
                      onClick={() => setShowCreateModal(false)}
                      className="px-6 py-3 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors font-medium"
                    >
                      취소
                    </button>
                    <button
                      onClick={handleCreateTask}
                      className="px-6 py-3 bg-gradient-to-r from-green-600 to-green-700 text-white rounded-lg hover:from-green-700 hover:to-green-800 transition-all font-medium shadow-lg"
                    >
                      등록
                    </button>
                  </div>
                </div>
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
                  <button
                    onClick={() => {
                      setShowEditModal(false)
                      setEditingTask(null)
                    }}
                    className="text-white hover:text-blue-200 bg-white bg-opacity-20 rounded-lg p-2 transition-colors"
                  >
                    <X className="w-5 h-5" />
                  </button>
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
                  {/* 담당자 */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">담당자</label>
                    <select
                      value={editingTask.assignee || ''}
                      onChange={(e) => setEditingTask(prev => prev ? { ...prev, assignee: e.target.value || undefined } : null)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                    >
                      <option value="">담당자 선택</option>
                      {assignees.map(assignee => (
                        <option key={assignee} value={assignee}>{assignee}</option>
                      ))}
                    </select>
                  </div>

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

                {/* 예상 소요 일수 */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">예상 소요 일수</label>
                  <input
                    type="number"
                    min="1"
                    max="365"
                    value={editingTask.estimatedDays || ''}
                    onChange={(e) => setEditingTask(prev => prev ? { ...prev, estimatedDays: e.target.value ? parseInt(e.target.value) : undefined } : null)}
                    placeholder="예: 15"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                  />
                  <p className="text-xs text-gray-500 mt-1">업무 완료까지 예상되는 총 일수를 입력하세요.</p>
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

                {/* 버튼 영역 */}
                <div className="flex justify-between items-center mt-8 pt-6 border-t border-gray-200">
                  <button
                    onClick={() => {
                      if (confirm('이 업무를 삭제하시겠습니까?')) {
                        setTasks(prev => prev.filter(t => t.id !== editingTask.id))
                        setShowEditModal(false)
                        setEditingTask(null)
                        alert('업무가 삭제되었습니다.')
                      }
                    }}
                    className="flex items-center gap-2 px-4 py-2 text-red-600 bg-red-50 border border-red-200 rounded-lg hover:bg-red-100 transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                    삭제
                  </button>
                  <div className="flex gap-3">
                    <button
                      onClick={() => {
                        setShowEditModal(false)
                        setEditingTask(null)
                      }}
                      className="px-6 py-3 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors font-medium"
                    >
                      취소
                    </button>
                    <button
                      onClick={handleUpdateTask}
                      className="px-6 py-3 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-lg hover:from-blue-700 hover:to-blue-800 transition-all font-medium shadow-lg"
                    >
                      변경사항 저장
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </AdminLayout>
  );
}