# 시설 업무 관리 컴포넌트 가이드

리팩토링된 시설 업무 관리 페이지의 컴포넌트 사용 가이드입니다.

## 📁 디렉토리 구조

```
app/admin/tasks/
├── page.tsx              # 메인 페이지 (기존 2,433줄)
├── types.ts              # 타입 정의 (195줄)
├── README.md             # 이 문서
├── components/           # UI 컴포넌트
│   ├── TaskStats.tsx     # 통계 대시보드 (210줄)
│   ├── TaskFilters.tsx   # 필터 및 검색 (170줄)
│   ├── TaskKanban.tsx    # 칸반 보드 (380줄)
│   ├── TaskCreateModal.tsx  # 업무 생성 모달 (280줄)
│   ├── TaskEditModal.tsx    # 업무 수정 모달 (320줄)
│   ├── TaskCard.tsx      # 업무 카드 (기존)
│   ├── TaskCardList.tsx  # 카드 리스트 (기존)
│   └── TaskMobileModal.tsx  # 모바일 모달 (기존)
└── hooks/                # 커스텀 훅
    └── useTaskManagement.ts  # 업무 관리 훅 (250줄)
```

## 🎯 컴포넌트 개요

### 1. TaskStats - 통계 대시보드

업무 통계를 시각적으로 표시하는 컴포넌트입니다.

**Props:**
```typescript
interface TaskStatsProps {
  tasks: Task[]           // 통계를 계산할 업무 목록
  className?: string      // 추가 CSS 클래스
}
```

**사용 예시:**
```tsx
import TaskStats from './components/TaskStats'

function Page() {
  const [tasks, setTasks] = useState<Task[]>([])

  return (
    <TaskStats tasks={tasks} />
  )
}
```

**표시 항목:**
- 전체 업무 수
- 활성 단계 수 (업무가 있는 단계)
- 높은 우선순위 업무 수
- 지연 업무 수
- 위험 업무 수

---

### 2. TaskFilters - 필터 및 검색

업무를 필터링하고 검색하는 UI 컴포넌트입니다.

**Props:**
```typescript
interface TaskFiltersProps {
  // 필터 상태
  selectedType: TaskType | 'all'
  selectedPriority: Priority | 'all'
  selectedAssignee: string | 'all'
  searchTerm: string

  // 필터 변경 핸들러
  onTypeChange: (type: TaskType | 'all') => void
  onPriorityChange: (priority: Priority | 'all') => void
  onAssigneeChange: (assignee: string) => void
  onSearchChange: (term: string) => void

  // 데이터
  tasks: Task[]
  filteredTasks: Task[]
  assignees: string[]

  className?: string
}
```

**사용 예시:**
```tsx
import TaskFilters from './components/TaskFilters'

function Page() {
  const [selectedType, setSelectedType] = useState<TaskType | 'all'>('all')
  const [selectedPriority, setSelectedPriority] = useState<Priority | 'all'>('all')
  const [selectedAssignee, setSelectedAssignee] = useState('all')
  const [searchTerm, setSearchTerm] = useState('')

  return (
    <TaskFilters
      selectedType={selectedType}
      selectedPriority={selectedPriority}
      selectedAssignee={selectedAssignee}
      searchTerm={searchTerm}
      onTypeChange={setSelectedType}
      onPriorityChange={setSelectedPriority}
      onAssigneeChange={setSelectedAssignee}
      onSearchChange={setSearchTerm}
      tasks={tasks}
      filteredTasks={filteredTasks}
      assignees={assignees}
    />
  )
}
```

---

### 3. TaskKanban - 칸반 보드

업무 워크플로우를 칸반 형식으로 표시하는 컴포넌트입니다.

**Props:**
```typescript
interface TaskKanbanProps {
  tasks: Task[]
  selectedType: TaskType | 'all'
  isCompactMode: boolean
  onTaskClick?: (task: Task) => void
  onTaskDragStart?: (task: Task) => void
  onTaskDragEnd?: () => void
  onTaskDrop?: (status: TaskStatus) => void
  className?: string
}
```

**사용 예시:**
```tsx
import TaskKanban from './components/TaskKanban'

function Page() {
  const handleTaskClick = (task: Task) => {
    console.log('Clicked:', task)
  }

  const handleTaskDrop = (status: TaskStatus) => {
    console.log('Dropped to:', status)
  }

  return (
    <TaskKanban
      tasks={filteredTasks}
      selectedType={selectedType}
      isCompactMode={false}
      onTaskClick={handleTaskClick}
      onTaskDrop={handleTaskDrop}
    />
  )
}
```

**특징:**
- 자동 업무 그룹화 (상태별)
- 드래그 앤 드롭 지원
- 컴팩트/확장 모드
- 반응형 디자인

---

### 4. TaskCreateModal - 업무 생성 모달

새 업무를 생성하는 모달 컴포넌트입니다.

**Props:**
```typescript
interface TaskCreateModalProps {
  isOpen: boolean
  onClose: () => void
  onCreate: (form: CreateTaskForm, businessSearchTerm: string) => Promise<void>
  availableBusinesses: BusinessOption[]
  initialForm?: Partial<CreateTaskForm>
}
```

**사용 예시:**
```tsx
import TaskCreateModal from './components/TaskCreateModal'

function Page() {
  const [showModal, setShowModal] = useState(false)

  const handleCreate = async (form: CreateTaskForm, businessTerm: string) => {
    try {
      await createTask(form, businessTerm)
      setShowModal(false)
      alert('업무가 생성되었습니다.')
    } catch (error) {
      alert('오류가 발생했습니다.')
    }
  }

  return (
    <>
      <button onClick={() => setShowModal(true)}>새 업무</button>
      <TaskCreateModal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        onCreate={handleCreate}
        availableBusinesses={businesses}
      />
    </>
  )
}
```

**기능:**
- 사업장 자동완성 검색
- 다중 담당자 선택
- 실시간 유효성 검증
- ESC 키로 닫기

---

### 5. TaskEditModal - 업무 수정 모달

기존 업무를 수정하는 모달 컴포넌트입니다.

**Props:**
```typescript
interface TaskEditModalProps {
  isOpen: boolean
  onClose: () => void
  onUpdate: (taskId: string, updates: Partial<Task>) => Promise<void>
  task: Task | null
  availableBusinesses: BusinessOption[]
}
```

**사용 예시:**
```tsx
import TaskEditModal from './components/TaskEditModal'

function Page() {
  const [showModal, setShowModal] = useState(false)
  const [selectedTask, setSelectedTask] = useState<Task | null>(null)

  const handleUpdate = async (taskId: string, updates: Partial<Task>) => {
    try {
      await updateTask(taskId, updates)
      setShowModal(false)
      alert('업무가 수정되었습니다.')
    } catch (error) {
      alert('오류가 발생했습니다.')
    }
  }

  return (
    <TaskEditModal
      isOpen={showModal}
      onClose={() => setShowModal(false)}
      onUpdate={handleUpdate}
      task={selectedTask}
      availableBusinesses={businesses}
    />
  )
}
```

---

### 6. useTaskManagement - 업무 관리 훅

업무 CRUD 로직을 관리하는 커스텀 훅입니다.

**반환값:**
```typescript
interface UseTaskManagementReturn {
  tasks: Task[]
  isLoading: boolean
  isRefreshing: boolean
  lastRefresh: Date
  loadTasks: () => Promise<void>
  createTask: (form: CreateTaskForm, businessSearchTerm: string) => Promise<void>
  updateTask: (taskId: string, updates: Partial<Task>) => Promise<void>
  deleteTask: (taskId: string) => Promise<void>
  refreshTasks: () => Promise<void>
}
```

**사용 예시:**
```tsx
import { useTaskManagement } from './hooks/useTaskManagement'
import { useEffect } from 'react'

function Page() {
  const {
    tasks,
    isLoading,
    loadTasks,
    createTask,
    updateTask,
    deleteTask,
    refreshTasks
  } = useTaskManagement()

  // 초기 로딩
  useEffect(() => {
    loadTasks()
  }, [loadTasks])

  // 생성
  const handleCreate = async (form: CreateTaskForm) => {
    try {
      await createTask(form, 'OO사업장')
      alert('생성 완료')
    } catch (error) {
      alert('생성 실패')
    }
  }

  // 수정
  const handleUpdate = async (taskId: string) => {
    try {
      await updateTask(taskId, { title: '수정된 제목' })
      alert('수정 완료')
    } catch (error) {
      alert('수정 실패')
    }
  }

  // 삭제
  const handleDelete = async (taskId: string) => {
    try {
      await deleteTask(taskId)
      alert('삭제 완료')
    } catch (error) {
      alert('삭제 실패')
    }
  }

  return <div>...</div>
}
```

---

## 🔧 타입 정의 (`types.ts`)

### 주요 타입

```typescript
// 업무 타입
type TaskType = 'self' | 'subsidy' | 'etc' | 'as'

// 우선순위
type Priority = 'high' | 'medium' | 'low'

// 업무 상태 (다양한 워크플로우 단계)
type TaskStatus =
  | 'pending' | 'customer_contact' | 'site_inspection'
  | 'quotation' | 'contract' | ...

// 업무 인터페이스
interface Task {
  id: string
  title: string
  businessName?: string
  type: TaskType
  status: TaskStatus
  priority: Priority
  assignees?: SelectedAssignee[]
  startDate?: string
  dueDate?: string
  progressPercentage?: number
  createdAt: string
  description?: string
  notes?: string
}

// 업무 생성 폼
interface CreateTaskForm {
  title: string
  businessName: string
  type: TaskType
  status: TaskStatus
  priority: Priority
  assignees: SelectedAssignee[]
  startDate: string
  dueDate: string
  description: string
  notes: string
}
```

### 유틸리티 함수

```typescript
// 진행률 자동 계산
calculateProgressPercentage(type: TaskType, status: TaskStatus): number

// 타입별 단계 정보 가져오기
getStepsByType(type: TaskType): StepInfo[]

// 상태에 해당하는 단계 정보
getStepInfo(type: TaskType, status: TaskStatus): StepInfo | undefined
```

---

## 🎨 통합 예시

전체 컴포넌트를 통합한 예시:

```tsx
'use client'

import { useState, useEffect, useMemo } from 'react'
import { useTaskManagement } from './hooks/useTaskManagement'
import TaskStats from './components/TaskStats'
import TaskFilters from './components/TaskFilters'
import TaskKanban from './components/TaskKanban'
import TaskCreateModal from './components/TaskCreateModal'
import TaskEditModal from './components/TaskEditModal'

export default function TaskManagementPage() {
  // 업무 관리 훅
  const {
    tasks,
    isLoading,
    loadTasks,
    createTask,
    updateTask,
    deleteTask,
    refreshTasks
  } = useTaskManagement()

  // 필터 상태
  const [selectedType, setSelectedType] = useState<TaskType | 'all'>('all')
  const [selectedPriority, setSelectedPriority] = useState<Priority | 'all'>('all')
  const [selectedAssignee, setSelectedAssignee] = useState('all')
  const [searchTerm, setSearchTerm] = useState('')

  // 모달 상태
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [showEditModal, setShowEditModal] = useState(false)
  const [editingTask, setEditingTask] = useState<Task | null>(null)

  // 초기 로딩
  useEffect(() => {
    loadTasks()
  }, [loadTasks])

  // 필터링된 업무
  const filteredTasks = useMemo(() => {
    return tasks.filter(task => {
      // 타입 필터
      if (selectedType !== 'all' && task.type !== selectedType) return false

      // 우선순위 필터
      if (selectedPriority !== 'all' && task.priority !== selectedPriority) return false

      // 담당자 필터
      if (selectedAssignee !== 'all' && task.assignee !== selectedAssignee) return false

      // 검색어 필터
      if (searchTerm && !task.title.toLowerCase().includes(searchTerm.toLowerCase())) {
        return false
      }

      return true
    })
  }, [tasks, selectedType, selectedPriority, selectedAssignee, searchTerm])

  // 담당자 목록
  const assignees = useMemo(() => {
    const set = new Set<string>()
    tasks.forEach(task => {
      if (task.assignee) set.add(task.assignee)
    })
    return Array.from(set).sort()
  }, [tasks])

  return (
    <div className="space-y-6">
      {/* 통계 */}
      <TaskStats tasks={filteredTasks} />

      {/* 필터 */}
      <TaskFilters
        selectedType={selectedType}
        selectedPriority={selectedPriority}
        selectedAssignee={selectedAssignee}
        searchTerm={searchTerm}
        onTypeChange={setSelectedType}
        onPriorityChange={setSelectedPriority}
        onAssigneeChange={setSelectedAssignee}
        onSearchChange={setSearchTerm}
        tasks={tasks}
        filteredTasks={filteredTasks}
        assignees={assignees}
      />

      {/* 칸반 보드 */}
      <TaskKanban
        tasks={filteredTasks}
        selectedType={selectedType}
        isCompactMode={false}
        onTaskClick={(task) => {
          setEditingTask(task)
          setShowEditModal(true)
        }}
      />

      {/* 생성 모달 */}
      <TaskCreateModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onCreate={async (form, businessTerm) => {
          await createTask(form, businessTerm)
          setShowCreateModal(false)
        }}
        availableBusinesses={[]}
      />

      {/* 수정 모달 */}
      <TaskEditModal
        isOpen={showEditModal}
        onClose={() => setShowEditModal(false)}
        onUpdate={async (taskId, updates) => {
          await updateTask(taskId, updates)
          setShowEditModal(false)
        }}
        task={editingTask}
        availableBusinesses={[]}
      />
    </div>
  )
}
```

---

## 🚀 다음 단계

### 현재 상태
- ✅ 모든 컴포넌트 생성 완료
- ✅ 타입 정의 분리
- ✅ 커스텀 훅 생성
- ⏳ 메인 페이지 통합 대기

### 통합 작업
1. 기존 `page.tsx`를 백업
2. 새 컴포넌트로 교체
3. 기능 테스트
4. 성능 측정

### 최적화
- React.memo() 적용
- useMemo/useCallback 최적화
- 코드 스플리팅
- 번들 사이즈 분석

---

**작성일**: 2025-10-29
**버전**: 1.0.0
**작성자**: Claude Code
