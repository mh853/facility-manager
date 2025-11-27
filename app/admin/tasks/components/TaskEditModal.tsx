'use client'

import React, { useState, useEffect } from 'react'
import { X, History } from 'lucide-react'
import { Task, BusinessOption, TaskType, Priority, TaskStatus } from '../types'
import { SelectedAssignee } from '@/components/ui/MultiAssigneeSelector'
import MultiAssigneeSelector from '@/components/ui/MultiAssigneeSelector'
import TaskHistoryTimeline from '@/components/TaskHistoryTimeline'

interface TaskEditModalProps {
  isOpen: boolean
  onClose: () => void
  onUpdate: (taskId: string, updates: Partial<Task>) => Promise<void>
  task: Task | null
  availableBusinesses: BusinessOption[]
}

/**
 * 업무 수정 모달 컴포넌트
 *
 * 주요 기능:
 * - 기존 업무 정보 수정
 * - 상태 변경
 * - 진행률 업데이트
 * - 사업장 변경 (자동완성)
 * - 담당자 변경
 */
export default function TaskEditModal({
  isOpen,
  onClose,
  onUpdate,
  task,
  availableBusinesses
}: TaskEditModalProps) {
  const [editingTask, setEditingTask] = useState<Task | null>(task)
  const [businessSearchTerm, setBusinessSearchTerm] = useState(task?.businessName || '')
  const [showBusinessDropdown, setShowBusinessDropdown] = useState(false)
  const [selectedBusinessIndex, setSelectedBusinessIndex] = useState(-1)
  const [showHistory, setShowHistory] = useState(false)

  // task가 변경될 때마다 editingTask 업데이트
  useEffect(() => {
    if (task) {
      setEditingTask(task)
      setBusinessSearchTerm(task.businessName || '')
    }
  }, [task])

  // 모달이 닫혀있거나 task가 없으면 렌더링하지 않음
  if (!isOpen || !editingTask) return null

  // 폼 제출 핸들러
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    await onUpdate(editingTask.id, {
      ...editingTask,
      businessName: businessSearchTerm || editingTask.businessName
    })
  }

  // 필터링된 사업장 목록
  const filteredBusinesses = availableBusinesses
    .filter(business =>
      business.name?.toLowerCase().includes(businessSearchTerm.toLowerCase()) ||
      business.address?.toLowerCase().includes(businessSearchTerm.toLowerCase())
    )
    .slice(0, 10)

  // 사업장 선택 핸들러
  const handleBusinessSelect = (business: BusinessOption) => {
    setBusinessSearchTerm(business.name)
    setEditingTask({ ...editingTask, businessName: business.name })
    setShowBusinessDropdown(false)
    setSelectedBusinessIndex(-1)
  }

  // 키보드 네비게이션 핸들러
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!showBusinessDropdown || filteredBusinesses.length === 0) return

    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setSelectedBusinessIndex(prev =>
        prev < filteredBusinesses.length - 1 ? prev + 1 : prev
      )
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setSelectedBusinessIndex(prev => prev > 0 ? prev - 1 : -1)
    } else if (e.key === 'Enter' || e.key === 'Tab') {
      if (selectedBusinessIndex >= 0 && selectedBusinessIndex < filteredBusinesses.length) {
        e.preventDefault()
        handleBusinessSelect(filteredBusinesses[selectedBusinessIndex])
      }
    } else if (e.key === 'Escape') {
      setShowBusinessDropdown(false)
      setSelectedBusinessIndex(-1)
    }
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        {/* 헤더 */}
        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
          <h2 className="text-xl font-semibold text-gray-900">업무 수정</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
            aria-label="닫기"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* 폼 */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* 업무명 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              업무명 <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={editingTask.title}
              onChange={(e) => setEditingTask({ ...editingTask, title: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-base"
              required
            />
          </div>

          {/* 업무 타입 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              업무 타입
            </label>
            <select
              value={editingTask.type}
              onChange={(e) => setEditingTask({ ...editingTask, type: e.target.value as TaskType })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-base"
            >
              <option value="self">자비</option>
              <option value="subsidy">보조금</option>
              <option value="etc">기타</option>
              <option value="as">AS</option>
            </select>
          </div>

          {/* 사업장 */}
          {editingTask.type !== 'etc' && (
            <div className="relative">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                사업장
              </label>
              <input
                type="text"
                value={businessSearchTerm}
                onChange={(e) => {
                  setBusinessSearchTerm(e.target.value)
                  setShowBusinessDropdown(e.target.value.length >= 2)
                  setSelectedBusinessIndex(-1)
                }}
                onKeyDown={handleKeyDown}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-base"
                placeholder="사업장 이름 또는 주소로 검색..."
              />

              {/* 자동완성 드롭다운 */}
              {showBusinessDropdown && filteredBusinesses.length > 0 && (
                <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                  {filteredBusinesses.map((business, index) => (
                    <button
                      key={business.id}
                      type="button"
                      onClick={() => handleBusinessSelect(business)}
                      className={`w-full text-left px-4 py-2 transition-colors border-b border-gray-100 last:border-b-0 ${
                        index === selectedBusinessIndex
                          ? 'bg-blue-100 text-blue-900'
                          : 'hover:bg-blue-50'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="font-medium">{business.name}</div>
                        {business.progress_status && (
                          <span className="text-xs px-2 py-1 bg-gray-100 text-gray-700 rounded-full">
                            {business.progress_status}
                          </span>
                        )}
                      </div>
                      <div className="text-sm text-gray-600">{business.address}</div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* 상태 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              상태
            </label>
            <input
              type="text"
              value={editingTask.status}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-gray-50 text-base"
              disabled
              title="상태는 칸반 보드에서 드래그하여 변경할 수 있습니다"
            />
            <p className="text-xs text-gray-500 mt-1">
              * 상태 변경은 칸반 보드에서 드래그하여 변경하세요
            </p>
          </div>

          {/* 우선순위 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              우선순위
            </label>
            <select
              value={editingTask.priority}
              onChange={(e) => setEditingTask({ ...editingTask, priority: e.target.value as Priority })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-base"
            >
              <option value="high">높음</option>
              <option value="medium">보통</option>
              <option value="low">낮음</option>
            </select>
          </div>

          {/* 담당자 (다중 선택) */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              담당자
            </label>
            <MultiAssigneeSelector
              selectedAssignees={editingTask.assignees || []}
              onChange={(assignees: SelectedAssignee[]) =>
                setEditingTask({ ...editingTask, assignees })
              }
            />
          </div>

          {/* 시작일 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              시작일
            </label>
            <input
              type="date"
              value={editingTask.startDate || ''}
              onChange={(e) => setEditingTask({ ...editingTask, startDate: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-base"
            />
          </div>

          {/* 마감일 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              마감일
            </label>
            <input
              type="date"
              value={editingTask.dueDate || ''}
              onChange={(e) => setEditingTask({ ...editingTask, dueDate: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-base"
            />
          </div>

          {/* 설명 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              설명
            </label>
            <textarea
              value={editingTask.description || ''}
              onChange={(e) => setEditingTask({ ...editingTask, description: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-base"
              rows={3}
            />
          </div>

          {/* 메모 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              메모
            </label>
            <textarea
              value={editingTask.notes || ''}
              onChange={(e) => setEditingTask({ ...editingTask, notes: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-base"
              rows={3}
            />
          </div>

          {/* 단계 이력 */}
          <div className="border border-gray-200 rounded-lg p-4">
            <button
              type="button"
              onClick={() => setShowHistory(!showHistory)}
              className="w-full flex items-center justify-between mb-3 group"
            >
              <h3 className="text-base font-semibold text-gray-900 flex items-center gap-2">
                <History className="w-4 h-4 text-purple-600" />
                단계 이력
              </h3>
              <span className="text-xs text-gray-500 group-hover:text-gray-700">
                {showHistory ? '접기' : '펼치기'}
              </span>
            </button>
            {showHistory && (
              <div className="mt-4">
                <TaskHistoryTimeline taskId={editingTask.id} />
              </div>
            )}
          </div>

          {/* 버튼 */}
          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
            >
              취소
            </button>
            <button
              type="submit"
              className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              수정
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
