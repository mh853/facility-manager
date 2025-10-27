import React from 'react'
import {
  Flag,
  Users,
  MapPin,
  Calendar,
  AlertCircle,
  Clock,
  CheckCircle,
  Edit,
  ChevronRight,
  User
} from 'lucide-react'

// Task 타입 (부모에서 import할 예정)
interface SelectedAssignee {
  id: string
  name: string
  department?: string
  team?: string
}

type TaskType = 'self' | 'subsidy' | 'etc' | 'as'
type TaskStatus = string
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
  assignees?: SelectedAssignee[]
  startDate?: string
  dueDate?: string
  progressPercentage?: number
  delayStatus?: 'on_time' | 'at_risk' | 'delayed' | 'overdue'
  delayDays?: number
  createdAt: string
  description?: string
  notes?: string
  _stepInfo?: { status: TaskStatus; label: string; color: string }
}

interface TaskCardProps {
  task: Task
  onClick: (task: Task) => void
  onEdit?: (task: Task) => void
}

export default function TaskCard({ task, onClick, onEdit }: TaskCardProps) {
  // 우선순위 색상 설정
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

  // 지연 상태 설정
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
    },
    overdue: {
      bg: 'bg-red-100',
      text: 'text-red-700',
      icon: <AlertCircle className="w-3 h-3" />,
      label: '기한 초과'
    }
  }

  const priorityColor = priorityColors[task.priority]
  const delayConfig = task.delayStatus ? delayStatusConfig[task.delayStatus] : null

  // 업무 타입 레이블
  const typeLabels = {
    self: '자비 설치',
    subsidy: '보조금',
    as: 'AS',
    etc: '기타'
  }

  // 우선순위 레이블
  const priorityLabels = {
    high: '높음',
    medium: '중간',
    low: '낮음'
  }

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
            {priorityLabels[task.priority]}
          </span>
        </div>
        <span className={`px-2 py-1 text-[10px] sm:text-xs font-medium border rounded-md ${typeColors[task.type]}`}>
          {typeLabels[task.type]}
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
              {new Date(task.startDate).toLocaleDateString('ko-KR', { month: '2-digit', day: '2-digit' })}
              {' ~ '}
              {new Date(task.dueDate).toLocaleDateString('ko-KR', { month: '2-digit', day: '2-digit' })}
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
              style={{ width: `${task.progressPercentage}%` }}
            />
          </div>
        </div>
      )}

      {/* 지연 상태 배지 */}
      {delayConfig && task.delayStatus !== 'on_time' && (
        <div
          className={`mt-3 flex items-center gap-1.5 text-[10px] sm:text-xs ${delayConfig.text} ${delayConfig.bg} px-2 py-1.5 rounded-md`}
        >
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
            aria-label="수정"
          >
            <Edit className="w-4 h-4" />
          </button>
        )}
      </div>
    </div>
  )
}
