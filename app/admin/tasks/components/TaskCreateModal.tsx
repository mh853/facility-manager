'use client'

import React, { useState } from 'react'
import { X } from 'lucide-react'
import { CreateTaskForm, BusinessOption, TaskType, Priority } from '../types'
import { SelectedAssignee } from '@/components/ui/MultiAssigneeSelector'
import MultiAssigneeSelector from '@/components/ui/MultiAssigneeSelector'

interface TaskCreateModalProps {
  isOpen: boolean
  onClose: () => void
  onCreate: (form: CreateTaskForm, businessSearchTerm: string) => Promise<void>
  availableBusinesses: BusinessOption[]
  initialForm?: Partial<CreateTaskForm>
}

/**
 * 업무 생성 모달 컴포넌트
 *
 * 주요 기능:
 * - 업무 정보 입력 (제목, 사업장, 타입, 우선순위 등)
 * - 사업장 자동완성 검색
 * - 다중 담당자 선택
 * - 유효성 검증
 */
export default function TaskCreateModal({
  isOpen,
  onClose,
  onCreate,
  availableBusinesses,
  initialForm
}: TaskCreateModalProps) {
  const [form, setForm] = useState<CreateTaskForm>({
    title: '',
    businessName: '',
    type: 'self',
    status: 'customer_contact',
    priority: 'medium',
    assignee: '',
    assignees: [],
    startDate: new Date().toISOString().split('T')[0],
    dueDate: '',
    description: '',
    notes: '',
    ...initialForm
  })

  const [businessSearchTerm, setBusinessSearchTerm] = useState('')
  const [showBusinessDropdown, setShowBusinessDropdown] = useState(false)
  const [selectedBusinessIndex, setSelectedBusinessIndex] = useState(-1)

  // 모달이 닫혀있으면 렌더링하지 않음
  if (!isOpen) return null

  // 폼 제출 핸들러
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    // 유효성 검증
    if (form.type !== 'etc' && !businessSearchTerm.trim()) {
      alert('사업장을 선택해주세요.')
      return
    }
    if (!form.title.trim()) {
      alert('업무명을 입력해주세요.')
      return
    }

    await onCreate(form, businessSearchTerm)
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
    setForm({ ...form, businessName: business.name })
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
          <h2 className="text-xl font-semibold text-gray-900">새 업무 등록</h2>
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
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="예: OO사업장 방지시설 설치"
              required
            />
          </div>

          {/* 업무 타입 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              업무 타입 <span className="text-red-500">*</span>
            </label>
            <select
              value={form.type}
              onChange={(e) => setForm({ ...form, type: e.target.value as TaskType })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="self">자비</option>
              <option value="subsidy">보조금</option>
              <option value="etc">기타</option>
              <option value="as">AS</option>
            </select>
          </div>

          {/* 사업장 검색 (기타 타입 제외) */}
          {form.type !== 'etc' && (
            <div className="relative">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                사업장 <span className="text-red-500">*</span>
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
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="사업장 이름 또는 주소로 검색..."
                required={form.type !== 'etc'}
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

          {/* 우선순위 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              우선순위
            </label>
            <select
              value={form.priority}
              onChange={(e) => setForm({ ...form, priority: e.target.value as Priority })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
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
              selectedAssignees={form.assignees}
              onChange={(assignees: SelectedAssignee[]) =>
                setForm({ ...form, assignees })
              }
            />
          </div>

          {/* 마감일 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              마감일
            </label>
            <input
              type="date"
              value={form.dueDate}
              onChange={(e) => setForm({ ...form, dueDate: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          {/* 설명 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              설명
            </label>
            <textarea
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              rows={3}
              placeholder="업무에 대한 상세 설명..."
            />
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
              등록
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
