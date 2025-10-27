# 업무 관리 모바일 카드 뷰 구현 계획

## 🎯 구현 목표
1. **컴팩트 카드 뷰**: 모바일에서 업무 목록을 카드 형태로 표시
2. **모바일 상세 모달**: 전체 화면 슬라이드업 모달로 상세 정보 제공
3. **반응형 전환**: 데스크톱(테이블) ↔ 모바일(카드) 자동 전환

## 📁 파일 구조

```
app/admin/tasks/
├── page.tsx                          # 메인 페이지 (기존)
├── components/
│   ├── TaskCard.tsx                  # 🆕 모바일 카드 컴포넌트
│   ├── TaskMobileModal.tsx           # 🆕 모바일 상세 모달
│   ├── TaskTableView.tsx             # 기존 테이블 뷰 (분리)
│   └── TaskCardList.tsx              # 🆕 카드 리스트 컨테이너
```

## 🎨 컴팩트 카드 컴포넌트 상세 설계

### TaskCard.tsx

```tsx
import { Task } from '../types'
import {
  Flag, Users, MapPin, Calendar, AlertCircle,
  Clock, CheckCircle, Edit, ChevronRight
} from 'lucide-react'

interface TaskCardProps {
  task: Task
  onClick: (task: Task) => void
  onEdit?: (task: Task) => void
}

export default function TaskCard({ task, onClick, onEdit }: TaskCardProps) {
  // 우선순위 색상
  const priorityColors = {
    high: {
      border: 'border-l-red-500',
      bg: 'bg-red-50',
      text: 'text-red-600',
      icon: 'text-red-500'
    },
    medium: {
      border: 'border-l-yellow-500',
      bg: 'bg-yellow-50',
      text: 'text-yellow-600',
      icon: 'text-yellow-500'
    },
    low: {
      border: 'border-l-gray-400',
      bg: 'bg-gray-50',
      text: 'text-gray-600',
      icon: 'text-gray-500'
    }
  }

  // 업무 타입 색상
  const typeColors = {
    self: 'bg-blue-50 text-blue-700 border-blue-200',
    subsidy: 'bg-green-50 text-green-700 border-green-200',
    as: 'bg-orange-50 text-orange-700 border-orange-200',
    etc: 'bg-gray-50 text-gray-700 border-gray-200'
  }

  // 지연 상태
  const delayStatusConfig = {
    delayed: {
      bg: 'bg-red-50',
      text: 'text-red-600',
      icon: <AlertCircle className="w-3 h-3" />,
      label: `${task.delayDays}일 지연`
    },
    at_risk: {
      bg: 'bg-yellow-50',
      text: 'text-yellow-600',
      icon: <Clock className="w-3 h-3" />,
      label: '위험'
    },
    on_time: {
      bg: 'bg-green-50',
      text: 'text-green-600',
      icon: <CheckCircle className="w-3 h-3" />,
      label: '정상'
    }
  }

  const priorityColor = priorityColors[task.priority]
  const delayConfig = task.delayStatus ? delayStatusConfig[task.delayStatus] : null

  return (
    <div
      onClick={() => onClick(task)}
      className={`
        bg-white rounded-lg border-l-4 ${priorityColor.border}
        shadow-sm hover:shadow-md transition-all duration-200
        active:scale-[0.98] cursor-pointer
        p-3 sm:p-4
      `}
    >
      {/* 헤더: 우선순위 + 업무 타입 */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-1.5">
          <Flag className={`w-3 h-3 sm:w-4 sm:h-4 ${priorityColor.icon}`} />
          <span className={`text-xs sm:text-sm font-medium ${priorityColor.text}`}>
            {task.priority === 'high' ? '높음' : task.priority === 'medium' ? '중간' : '낮음'}
          </span>
        </div>
        <span className={`px-2 py-1 text-[10px] sm:text-xs font-medium border rounded-md ${typeColors[task.type]}`}>
          {task.type === 'self' ? '자비 설치' :
           task.type === 'subsidy' ? '보조금' :
           task.type === 'as' ? 'AS' : '기타'}
        </span>
      </div>

      {/* 업무명 */}
      <h3 className="font-semibold text-sm sm:text-base text-gray-900 mb-3 line-clamp-2">
        {task.title}
      </h3>

      {/* 정보 그리드 */}
      <div className="space-y-2">
        {/* 담당자 */}
        {task.assignees && task.assignees.length > 0 && (
          <div className="flex items-center gap-2 text-xs sm:text-sm text-gray-600">
            <Users className="w-3 h-3 sm:w-4 sm:h-4 flex-shrink-0" />
            <span className="truncate">
              {task.assignees.map(a => a.name).join(', ')}
            </span>
          </div>
        )}

        {/* 사업장 정보 */}
        {task.businessName && (
          <div className="flex items-center gap-2 text-xs sm:text-sm text-gray-600">
            <MapPin className="w-3 h-3 sm:w-4 sm:h-4 flex-shrink-0" />
            <span className="truncate">{task.businessName}</span>
          </div>
        )}

        {/* 주소 */}
        {task.businessInfo?.address && (
          <div className="flex items-center gap-2 text-xs text-gray-500">
            <span className="w-3 h-3 sm:w-4 sm:h-4" />
            <span className="truncate">{task.businessInfo.address}</span>
          </div>
        )}

        {/* 기간 */}
        {task.startDate && task.dueDate && (
          <div className="flex items-center gap-2 text-xs sm:text-sm text-gray-600">
            <Calendar className="w-3 h-3 sm:w-4 sm:h-4 flex-shrink-0" />
            <span>
              {new Date(task.startDate).toLocaleDateString('ko-KR', {month: '2-digit', day: '2-digit'})}
              {' ~ '}
              {new Date(task.dueDate).toLocaleDateString('ko-KR', {month: '2-digit', day: '2-digit'})}
            </span>
          </div>
        )}
      </div>

      {/* 진행률 바 */}
      {task.progressPercentage !== undefined && (
        <div className="mt-3">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[10px] sm:text-xs text-gray-600">
              {task._stepInfo?.label || '진행 중'}
            </span>
            <span className="text-[10px] sm:text-xs font-medium text-blue-600">
              {task.progressPercentage}%
            </span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-1.5 sm:h-2">
            <div
              className="bg-blue-600 h-1.5 sm:h-2 rounded-full transition-all duration-300"
              style={{width: `${task.progressPercentage}%`}}
            />
          </div>
        </div>
      )}

      {/* 지연 상태 배지 */}
      {delayConfig && task.delayStatus !== 'on_time' && (
        <div className={`mt-3 flex items-center gap-1.5 text-[10px] sm:text-xs ${delayConfig.text} ${delayConfig.bg} px-2 py-1.5 rounded-md`}>
          {delayConfig.icon}
          <span className="font-medium">{delayConfig.label}</span>
        </div>
      )}

      {/* 액션 버튼 영역 */}
      <div className="mt-3 pt-3 border-t border-gray-100 flex items-center justify-between">
        <button
          onClick={(e) => {
            e.stopPropagation()
            onClick(task)
          }}
          className="flex items-center gap-1 text-xs sm:text-sm text-blue-600 font-medium hover:text-blue-700"
        >
          상세보기
          <ChevronRight className="w-3 h-3 sm:w-4 sm:h-4" />
        </button>

        {onEdit && (
          <button
            onClick={(e) => {
              e.stopPropagation()
              onEdit(task)
            }}
            className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <Edit className="w-4 h-4" />
          </button>
        )}
      </div>
    </div>
  )
}
```

### TaskCardList.tsx

```tsx
import { Task } from '../types'
import TaskCard from './TaskCard'

interface TaskCardListProps {
  tasks: Task[]
  onTaskClick: (task: Task) => void
  onTaskEdit?: (task: Task) => void
  isLoading?: boolean
}

export default function TaskCardList({
  tasks,
  onTaskClick,
  onTaskEdit,
  isLoading
}: TaskCardListProps) {
  if (isLoading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map(i => (
          <div key={i} className="bg-white rounded-lg border-l-4 border-gray-200 p-4 animate-pulse">
            <div className="flex items-center justify-between mb-3">
              <div className="h-4 bg-gray-200 rounded w-16"></div>
              <div className="h-6 bg-gray-200 rounded w-20"></div>
            </div>
            <div className="h-5 bg-gray-200 rounded w-3/4 mb-3"></div>
            <div className="space-y-2">
              <div className="h-4 bg-gray-200 rounded w-2/3"></div>
              <div className="h-4 bg-gray-200 rounded w-1/2"></div>
            </div>
          </div>
        ))}
      </div>
    )
  }

  if (tasks.length === 0) {
    return (
      <div className="text-center py-12">
        <div className="text-gray-400 mb-2">
          <svg className="w-16 h-16 mx-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
          </svg>
        </div>
        <p className="text-gray-600 font-medium">업무가 없습니다</p>
        <p className="text-gray-500 text-sm mt-1">새로운 업무를 등록해보세요</p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {tasks.map(task => (
        <TaskCard
          key={task.id}
          task={task}
          onClick={onTaskClick}
          onEdit={onTaskEdit}
        />
      ))}
    </div>
  )
}
```

## 📱 모바일 상세 모달 설계

### TaskMobileModal.tsx

```tsx
import { Task } from '../types'
import { X, Calendar, Users, MapPin, Phone, Flag, Clock, Edit, Trash2 } from 'lucide-react'
import { useEffect } from 'react'

interface TaskMobileModalProps {
  task: Task | null
  isOpen: boolean
  onClose: () => void
  onEdit?: (task: Task) => void
  onDelete?: (task: Task) => void
}

export default function TaskMobileModal({
  task,
  isOpen,
  onClose,
  onEdit,
  onDelete
}: TaskMobileModalProps) {
  // 스크롤 방지
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = 'unset'
    }
    return () => {
      document.body.style.overflow = 'unset'
    }
  }, [isOpen])

  if (!task) return null

  // 우선순위 설정
  const priorityConfig = {
    high: { label: '높음', color: 'text-red-600', bg: 'bg-red-50', border: 'border-red-200' },
    medium: { label: '중간', color: 'text-yellow-600', bg: 'bg-yellow-50', border: 'border-yellow-200' },
    low: { label: '낮음', color: 'text-gray-600', bg: 'bg-gray-50', border: 'border-gray-200' }
  }

  const priority = priorityConfig[task.priority]

  return (
    <>
      {/* 백드롭 */}
      <div
        className={`
          fixed inset-0 bg-black transition-opacity duration-300 z-40
          ${isOpen ? 'opacity-50' : 'opacity-0 pointer-events-none'}
        `}
        onClick={onClose}
      />

      {/* 모달 */}
      <div
        className={`
          fixed inset-x-0 bottom-0 md:inset-0 md:flex md:items-center md:justify-center
          z-50 transition-transform duration-300 ease-out
          ${isOpen ? 'translate-y-0' : 'translate-y-full md:translate-y-0 md:scale-95 md:opacity-0'}
        `}
      >
        <div className="bg-white w-full h-[90vh] md:h-auto md:max-h-[85vh] md:max-w-2xl md:rounded-2xl shadow-2xl flex flex-col overflow-hidden">
          {/* 헤더 */}
          <div className="flex-shrink-0 px-4 py-3 sm:px-6 sm:py-4 border-b border-gray-200 bg-gradient-to-r from-blue-50 to-blue-100">
            <div className="flex items-start justify-between">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-2">
                  <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium border ${priority.bg} ${priority.color} ${priority.border}`}>
                    <Flag className="w-3 h-3" />
                    {priority.label}
                  </span>
                  <span className="px-2 py-1 bg-blue-600 text-white text-xs font-medium rounded-md">
                    {task.type === 'self' ? '자비 설치' :
                     task.type === 'subsidy' ? '보조금' :
                     task.type === 'as' ? 'AS' : '기타'}
                  </span>
                </div>
                <h2 className="text-lg sm:text-xl font-bold text-gray-900 pr-8">
                  {task.title}
                </h2>
              </div>
              <button
                onClick={onClose}
                className="flex-shrink-0 p-2 text-gray-400 hover:text-gray-600 hover:bg-white/50 rounded-full transition-colors"
              >
                <X className="w-5 h-5 sm:w-6 sm:h-6" />
              </button>
            </div>
          </div>

          {/* 스크롤 가능한 본문 */}
          <div className="flex-1 overflow-y-auto">
            <div className="p-4 sm:p-6 space-y-6">
              {/* 진행 상태 */}
              <div className="bg-gray-50 rounded-xl p-4">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-sm font-medium text-gray-700">
                    {task._stepInfo?.label || '진행 상태'}
                  </span>
                  <span className="text-2xl font-bold text-blue-600">
                    {task.progressPercentage || 0}%
                  </span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-3">
                  <div
                    className="bg-gradient-to-r from-blue-500 to-blue-600 h-3 rounded-full transition-all duration-500"
                    style={{width: `${task.progressPercentage || 0}%`}}
                  />
                </div>
              </div>

              {/* 기본 정보 */}
              <div className="space-y-4">
                <h3 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
                  <div className="w-1 h-4 bg-blue-600 rounded-full"></div>
                  기본 정보
                </h3>

                <dl className="space-y-3">
                  {/* 담당자 */}
                  {task.assignees && task.assignees.length > 0 && (
                    <div className="flex items-start gap-3">
                      <dt className="flex items-center gap-2 text-sm text-gray-600 w-20 flex-shrink-0">
                        <Users className="w-4 h-4" />
                        담당자
                      </dt>
                      <dd className="text-sm font-medium text-gray-900 flex-1">
                        <div className="flex flex-wrap gap-2">
                          {task.assignees.map((assignee, idx) => (
                            <span key={idx} className="inline-flex items-center gap-1 px-2 py-1 bg-blue-50 text-blue-700 rounded-md text-xs">
                              <User className="w-3 h-3" />
                              {assignee.name}
                            </span>
                          ))}
                        </div>
                      </dd>
                    </div>
                  )}

                  {/* 사업장 */}
                  {task.businessName && (
                    <div className="flex items-start gap-3">
                      <dt className="flex items-center gap-2 text-sm text-gray-600 w-20 flex-shrink-0">
                        <MapPin className="w-4 h-4" />
                        사업장
                      </dt>
                      <dd className="text-sm font-medium text-gray-900 flex-1">
                        {task.businessName}
                      </dd>
                    </div>
                  )}

                  {/* 주소 */}
                  {task.businessInfo?.address && (
                    <div className="flex items-start gap-3">
                      <dt className="text-sm text-gray-600 w-20 flex-shrink-0 pl-6">
                        주소
                      </dt>
                      <dd className="text-sm text-gray-700 flex-1">
                        {task.businessInfo.address}
                      </dd>
                    </div>
                  )}

                  {/* 연락처 */}
                  {task.businessInfo?.contact && (
                    <div className="flex items-start gap-3">
                      <dt className="flex items-center gap-2 text-sm text-gray-600 w-20 flex-shrink-0">
                        <Phone className="w-4 h-4" />
                        연락처
                      </dt>
                      <dd className="text-sm text-gray-700 flex-1">
                        <a href={`tel:${task.businessInfo.contact}`} className="text-blue-600 hover:underline">
                          {task.businessInfo.contact}
                        </a>
                      </dd>
                    </div>
                  )}

                  {/* 기간 */}
                  {task.startDate && task.dueDate && (
                    <div className="flex items-start gap-3">
                      <dt className="flex items-center gap-2 text-sm text-gray-600 w-20 flex-shrink-0">
                        <Calendar className="w-4 h-4" />
                        기간
                      </dt>
                      <dd className="text-sm font-medium text-gray-900 flex-1">
                        <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2">
                          <span>{new Date(task.startDate).toLocaleDateString('ko-KR')}</span>
                          <span className="text-gray-400 hidden sm:inline">~</span>
                          <span className="text-gray-400 sm:hidden">↓</span>
                          <span>{new Date(task.dueDate).toLocaleDateString('ko-KR')}</span>
                        </div>
                      </dd>
                    </div>
                  )}

                  {/* 지연 상태 */}
                  {task.delayStatus && task.delayStatus !== 'on_time' && (
                    <div className="flex items-start gap-3">
                      <dt className="flex items-center gap-2 text-sm text-gray-600 w-20 flex-shrink-0">
                        <Clock className="w-4 h-4" />
                        상태
                      </dt>
                      <dd className="text-sm flex-1">
                        <span className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium ${
                          task.delayStatus === 'delayed' ? 'bg-red-50 text-red-600' :
                          task.delayStatus === 'at_risk' ? 'bg-yellow-50 text-yellow-600' :
                          'bg-green-50 text-green-600'
                        }`}>
                          {task.delayStatus === 'delayed' && `${task.delayDays}일 지연`}
                          {task.delayStatus === 'at_risk' && '위험'}
                        </span>
                      </dd>
                    </div>
                  )}
                </dl>
              </div>

              {/* 설명 */}
              {task.description && (
                <div className="space-y-3">
                  <h3 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
                    <div className="w-1 h-4 bg-blue-600 rounded-full"></div>
                    설명
                  </h3>
                  <p className="text-sm text-gray-700 leading-relaxed bg-gray-50 rounded-lg p-4">
                    {task.description}
                  </p>
                </div>
              )}

              {/* 메모 */}
              {task.notes && (
                <div className="space-y-3">
                  <h3 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
                    <div className="w-1 h-4 bg-blue-600 rounded-full"></div>
                    메모
                  </h3>
                  <p className="text-sm text-gray-700 leading-relaxed bg-yellow-50 border-l-4 border-yellow-400 rounded-r-lg p-4">
                    {task.notes}
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* 하단 액션 버튼 */}
          <div className="flex-shrink-0 p-4 sm:p-6 border-t border-gray-200 bg-gray-50">
            <div className="flex gap-3">
              {onEdit && (
                <button
                  onClick={() => {
                    onEdit(task)
                    onClose()
                  }}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-blue-600 text-white font-medium rounded-xl hover:bg-blue-700 active:scale-95 transition-all"
                >
                  <Edit className="w-4 h-4" />
                  수정
                </button>
              )}
              {onDelete && (
                <button
                  onClick={() => {
                    if (confirm('이 업무를 삭제하시겠습니까?')) {
                      onDelete(task)
                      onClose()
                    }
                  }}
                  className="flex items-center justify-center gap-2 px-4 py-3 border border-gray-300 text-gray-700 font-medium rounded-xl hover:bg-gray-100 active:scale-95 transition-all"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
```

## 🔧 메인 페이지 통합

### page.tsx 수정사항

```tsx
import TaskCardList from './components/TaskCardList'
import TaskMobileModal from './components/TaskMobileModal'

// 상태 추가
const [mobileModalOpen, setMobileModalOpen] = useState(false)
const [selectedTask, setSelectedTask] = useState<Task | null>(null)

// 핸들러
const handleTaskClick = (task: Task) => {
  setSelectedTask(task)
  setMobileModalOpen(true)
}

// JSX에서
return (
  <div>
    {/* 모바일: 카드 뷰 */}
    <div className="md:hidden">
      <TaskCardList
        tasks={filteredTasks}
        onTaskClick={handleTaskClick}
        onTaskEdit={openEditModal}
        isLoading={isLoadingTasks}
      />
    </div>

    {/* 데스크톱: 기존 테이블 */}
    <div className="hidden md:block">
      {/* 기존 테이블 코드 */}
    </div>

    {/* 모바일 상세 모달 */}
    <TaskMobileModal
      task={selectedTask}
      isOpen={mobileModalOpen}
      onClose={() => {
        setMobileModalOpen(false)
        setSelectedTask(null)
      }}
      onEdit={openEditModal}
      onDelete={handleDelete}
    />
  </div>
)
```

## 🎯 구현 체크리스트

### Phase 1: 기본 카드 뷰 (필수)
- [ ] TaskCard.tsx 컴포넌트 생성
- [ ] TaskCardList.tsx 컨테이너 생성
- [ ] page.tsx에 반응형 전환 로직 추가
- [ ] 기본 스타일링 및 색상 적용

### Phase 2: 모바일 모달 (필수)
- [ ] TaskMobileModal.tsx 컴포넌트 생성
- [ ] 슬라이드업 애니메이션 구현
- [ ] 스크롤 방지 로직 추가
- [ ] 액션 버튼 연결

### Phase 3: 인터랙션 개선 (선택)
- [ ] 카드 터치 피드백 개선
- [ ] 로딩 스켈레톤 UI
- [ ] 빈 상태 UI
- [ ] 에러 상태 처리

### Phase 4: 성능 최적화 (선택)
- [ ] 가상 스크롤링 (업무 100개 이상 시)
- [ ] 이미지 레이지 로딩
- [ ] 메모이제이션 적용

## 📊 성능 고려사항

### 렌더링 최적화
```tsx
// TaskCard를 React.memo로 감싸기
export default React.memo(TaskCard, (prevProps, nextProps) => {
  return prevProps.task.id === nextProps.task.id &&
         prevProps.task.progressPercentage === nextProps.task.progressPercentage
})
```

### 스크롤 성능
```tsx
// 가상 스크롤링 (업무가 많을 때)
import { useVirtualizer } from '@tanstack/react-virtual'

const parentRef = useRef<HTMLDivElement>(null)
const virtualizer = useVirtualizer({
  count: tasks.length,
  getScrollElement: () => parentRef.current,
  estimateSize: () => 180, // 카드 예상 높이
  overscan: 5 // 미리 렌더링할 아이템 수
})
```

## 🎨 애니메이션 & 전환

### 카드 등장 효과
```tsx
className="animate-in slide-in-from-bottom-4 fade-in duration-300"
style={{ animationDelay: `${index * 50}ms` }}
```

### 모달 전환
```css
.modal-enter {
  transform: translateY(100%);
}

.modal-enter-active {
  transform: translateY(0);
  transition: transform 300ms ease-out;
}
```

## 📱 모바일 UX 가이드라인

### 터치 영역
- 최소 44x44px (iOS 가이드라인)
- 버튼 간 최소 8px 간격

### 가독성
- 최소 폰트 크기: 12px
- 줄간격: 1.5배
- 대비 비율: 4.5:1 이상

### 인터랙션 피드백
- 터치: `active:scale-[0.98]`
- 로딩: 스피너 또는 스켈레톤
- 에러: 인라인 메시지
