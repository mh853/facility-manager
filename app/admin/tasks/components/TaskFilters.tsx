'use client'

import React from 'react'
import { Search } from 'lucide-react'
import { TaskType, Priority, Task } from '../types'

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

  // 옵션
  className?: string
}

/**
 * 업무 필터 및 검색 컴포넌트
 * 업무 타입, 우선순위, 담당자 필터 및 검색 기능 제공
 */
export default function TaskFilters({
  selectedType,
  selectedPriority,
  selectedAssignee,
  searchTerm,
  onTypeChange,
  onPriorityChange,
  onAssigneeChange,
  onSearchChange,
  tasks,
  filteredTasks,
  assignees,
  className = ''
}: TaskFiltersProps) {
  return (
    <div className={`bg-white rounded-xl shadow-sm border border-gray-200 p-2 sm:p-3 md:p-4 ${className}`}>
      <div className="flex flex-col lg:flex-row gap-2 sm:gap-3 md:gap-4">
        {/* 필터 옵션들 */}
        <div className="flex flex-wrap gap-2 sm:gap-3">
          {/* 업무 타입 */}
          <select
            value={selectedType}
            onChange={(e) => onTypeChange(e.target.value as TaskType | 'all')}
            className="px-2 py-1.5 sm:px-3 sm:py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm sm:text-base"
            aria-label="업무 타입 필터"
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
            onChange={(e) => onPriorityChange(e.target.value as Priority | 'all')}
            className="px-2 py-1.5 sm:px-3 sm:py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm sm:text-base"
            aria-label="우선순위 필터"
          >
            <option value="all">전체 우선순위</option>
            <option value="high">높음</option>
            <option value="medium">보통</option>
            <option value="low">낮음</option>
          </select>

          {/* 담당자 */}
          <select
            value={selectedAssignee}
            onChange={(e) => onAssigneeChange(e.target.value)}
            className="px-2 py-1.5 sm:px-3 sm:py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm sm:text-base"
            aria-label="담당자 필터"
          >
            <option value="all">전체 담당자</option>
            {assignees.map(assignee => (
              <option key={assignee} value={assignee}>{assignee}</option>
            ))}
          </select>
        </div>

        {/* 검색창 */}
        <div className="flex-1 relative">
          <Search className="absolute left-2 sm:left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-3 h-3 sm:w-4 sm:h-4" />
          <input
            type="text"
            placeholder="업무명, 사업장명, 담당자로 검색..."
            className="w-full pl-8 pr-3 py-1.5 sm:pl-10 sm:pr-4 sm:py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm sm:text-base"
            onChange={(e) => onSearchChange(e.target.value)}
            defaultValue={searchTerm}
            aria-label="업무 검색"
          />
        </div>
      </div>

      {/* 결과 요약 */}
      <div className="mt-4 flex items-center justify-between text-sm text-gray-600">
        <div className="flex items-center gap-4">
          <span>총 {filteredTasks.length}개 업무</span>
          {selectedType !== 'all' && (
            <span className="px-2 py-1 bg-blue-100 text-blue-800 rounded text-xs sm:text-sm">
              {getTypeLabel(selectedType)}
            </span>
          )}
          {selectedPriority !== 'all' && (
            <span className="px-2 py-1 bg-purple-100 text-purple-800 rounded text-xs sm:text-sm">
              우선순위: {getPriorityLabel(selectedPriority)}
            </span>
          )}
          {selectedAssignee !== 'all' && (
            <span className="px-2 py-1 bg-green-100 text-green-800 rounded text-xs sm:text-sm">
              담당자: {selectedAssignee}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs hidden sm:inline">
            데이터 연결: 정상
          </span>
          <div className="w-2 h-2 rounded-full bg-green-500" title="데이터베이스 연결 정상" />
        </div>
      </div>
    </div>
  )
}

// ==================== 유틸리티 함수 ====================

/**
 * 업무 타입을 한글 레이블로 변환
 */
function getTypeLabel(type: TaskType | 'all'): string {
  switch (type) {
    case 'self':
      return '자비'
    case 'subsidy':
      return '보조금'
    case 'etc':
      return '기타'
    case 'as':
      return 'AS'
    case 'all':
      return '전체'
    default:
      return type
  }
}

/**
 * 우선순위를 한글 레이블로 변환
 */
function getPriorityLabel(priority: Priority | 'all'): string {
  switch (priority) {
    case 'high':
      return '높음'
    case 'medium':
      return '보통'
    case 'low':
      return '낮음'
    case 'all':
      return '전체'
    default:
      return priority
  }
}
