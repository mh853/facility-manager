import React, { useEffect } from 'react'
import {
  X,
  Calendar,
  Users,
  MapPin,
  Phone,
  Flag,
  Clock,
  Edit,
  Trash2,
  User,
  AlertCircle,
  CheckCircle
} from 'lucide-react'

// Task 타입
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
    high: {
      label: '높음',
      color: 'text-red-600',
      bg: 'bg-red-50',
      border: 'border-red-200'
    },
    medium: {
      label: '중간',
      color: 'text-yellow-600',
      bg: 'bg-yellow-50',
      border: 'border-yellow-200'
    },
    low: {
      label: '낮음',
      color: 'text-gray-600',
      bg: 'bg-gray-50',
      border: 'border-gray-200'
    }
  }

  // 업무 타입 레이블
  const typeLabels = {
    self: '자비 설치',
    subsidy: '보조금',
    as: 'AS',
    etc: '기타'
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
          ${
            isOpen
              ? 'translate-y-0'
              : 'translate-y-full md:translate-y-0 md:scale-95 md:opacity-0'
          }
        `}
      >
        <div className="bg-white w-full h-[90vh] md:h-auto md:max-h-[85vh] md:max-w-2xl md:rounded-2xl shadow-2xl flex flex-col overflow-hidden">
          {/* 헤더 */}
          <div className="flex-shrink-0 px-4 py-3 sm:px-6 sm:py-4 border-b border-gray-200 bg-gradient-to-r from-blue-50 to-blue-100">
            <div className="flex items-start justify-between">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-2 flex-wrap">
                  <span
                    className={`inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium border ${priority.bg} ${priority.color} ${priority.border}`}
                  >
                    <Flag className="w-3 h-3" />
                    {priority.label}
                  </span>
                  <span className="px-2 py-1 bg-blue-600 text-white text-xs font-medium rounded-md">
                    {typeLabels[task.type]}
                  </span>
                </div>
                <h2 className="text-lg sm:text-xl font-bold text-gray-900 pr-8">
                  {task.title}
                </h2>
              </div>
              <button
                onClick={onClose}
                className="flex-shrink-0 p-2 text-gray-400 hover:text-gray-600 hover:bg-white/50 rounded-full transition-colors"
                aria-label="닫기"
              >
                <X className="w-5 h-5 sm:w-6 sm:h-6" />
              </button>
            </div>
          </div>

          {/* 스크롤 가능한 본문 */}
          <div className="flex-1 overflow-y-auto">
            <div className="p-4 sm:p-6 space-y-6">
              {/* 진행 상태 */}
              {task.progressPercentage !== undefined && (
                <div className="bg-gray-50 rounded-xl p-4">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-sm font-medium text-gray-700">
                      {task._stepInfo?.label || '진행 상태'}
                    </span>
                    <span className="text-2xl font-bold text-blue-600">
                      {task.progressPercentage}%
                    </span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-3">
                    <div
                      className="bg-gradient-to-r from-blue-500 to-blue-600 h-3 rounded-full transition-all duration-500"
                      style={{ width: `${task.progressPercentage}%` }}
                    />
                  </div>
                </div>
              )}

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
                            <span
                              key={idx}
                              className="inline-flex items-center gap-1 px-2 py-1 bg-blue-50 text-blue-700 rounded-md text-xs"
                            >
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
                        <a
                          href={`tel:${task.businessInfo.contact}`}
                          className="text-blue-600 hover:underline"
                        >
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
                          <span>
                            {new Date(task.startDate).toLocaleDateString(
                              'ko-KR'
                            )}
                          </span>
                          <span className="text-gray-400 hidden sm:inline">
                            ~
                          </span>
                          <span className="text-gray-400 sm:hidden">↓</span>
                          <span>
                            {new Date(task.dueDate).toLocaleDateString('ko-KR')}
                          </span>
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
                        <span
                          className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium ${
                            task.delayStatus === 'delayed' ||
                            task.delayStatus === 'overdue'
                              ? 'bg-red-50 text-red-600'
                              : task.delayStatus === 'at_risk'
                              ? 'bg-yellow-50 text-yellow-600'
                              : 'bg-green-50 text-green-600'
                          }`}
                        >
                          {task.delayStatus === 'delayed' &&
                            task.delayDays && (
                              <>
                                <AlertCircle className="w-3 h-3" />
                                {`${task.delayDays}일 지연`}
                              </>
                            )}
                          {task.delayStatus === 'at_risk' && (
                            <>
                              <Clock className="w-3 h-3" />
                              위험
                            </>
                          )}
                          {task.delayStatus === 'overdue' && (
                            <>
                              <AlertCircle className="w-3 h-3" />
                              기한 초과
                            </>
                          )}
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
                  <p className="text-sm text-gray-700 leading-relaxed bg-gray-50 rounded-lg p-4 whitespace-pre-wrap">
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
                  <p className="text-sm text-gray-700 leading-relaxed bg-yellow-50 border-l-4 border-yellow-400 rounded-r-lg p-4 whitespace-pre-wrap">
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
