'use client'

// components/ui/BusinessAutocomplete.tsx
// 사업장 검색 자동완성 컴포넌트

import { useState, useEffect, useRef } from 'react'
import { Search, X, ChevronDown } from 'lucide-react'

interface BusinessInfo {
  id: string
  business_name: string
}

interface BusinessAutocompleteProps {
  value: string // business_id
  onChange: (businessId: string, businessName: string) => void
  businessList: BusinessInfo[]
  placeholder?: string
  disabled?: boolean
  className?: string
  allowCreate?: boolean // 신규 사업장 생성 허용 여부
  onCreateNew?: (businessName: string) => Promise<{ id: string; name: string }> // 신규 생성 콜백
}

export default function BusinessAutocomplete({
  value,
  onChange,
  businessList,
  placeholder = '사업장 검색...',
  disabled = false,
  className = '',
  allowCreate = false,
  onCreateNew
}: BusinessAutocompleteProps) {
  const [searchTerm, setSearchTerm] = useState('')
  const [isOpen, setIsOpen] = useState(false)
  const [highlightedIndex, setHighlightedIndex] = useState(0)
  const [isCreating, setIsCreating] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  // 선택된 사업장 정보
  const selectedBusiness = businessList.find((b) => b.id === value)

  // 검색 필터링
  const filteredBusinesses = businessList.filter((business) =>
    business.business_name.toLowerCase().includes(searchTerm.toLowerCase())
  )

  // 디버그 로그
  useEffect(() => {
    console.log('[BusinessAutocomplete] 상태:', {
      businessListCount: businessList.length,
      searchTerm,
      filteredCount: filteredBusinesses.length,
      isOpen,
      sampleBusiness: businessList[0]
    })
  }, [businessList, searchTerm, filteredBusinesses, isOpen])

  // 외부 클릭 감지
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // 키보드 네비게이션
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!isOpen) {
      if (e.key === 'Enter' || e.key === 'ArrowDown') {
        setIsOpen(true)
        e.preventDefault()
      }
      return
    }

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault()
        setHighlightedIndex((prev) =>
          prev < filteredBusinesses.length - 1 ? prev + 1 : 0
        )
        break
      case 'ArrowUp':
        e.preventDefault()
        setHighlightedIndex((prev) =>
          prev > 0 ? prev - 1 : filteredBusinesses.length - 1
        )
        break
      case 'Enter':
        e.preventDefault()
        if (filteredBusinesses[highlightedIndex]) {
          handleSelect(filteredBusinesses[highlightedIndex])
        }
        break
      case 'Escape':
        setIsOpen(false)
        break
    }
  }

  // 사업장 선택
  const handleSelect = (business: BusinessInfo) => {
    onChange(business.id, business.business_name)
    setSearchTerm('')
    setIsOpen(false)
    setHighlightedIndex(0)
  }

  // 선택 해제
  const handleClear = () => {
    onChange('', '')
    setSearchTerm('')
    setIsOpen(false)
  }

  // 신규 사업장 생성
  const handleCreateNew = async () => {
    if (!searchTerm.trim() || !onCreateNew) return

    try {
      setIsCreating(true)
      const result = await onCreateNew(searchTerm.trim())
      onChange(result.id, result.name)
      setSearchTerm('')
      setIsOpen(false)
      setHighlightedIndex(0)
    } catch (error) {
      console.error('[BusinessAutocomplete] 신규 사업장 생성 오류:', error)
      alert('사업장 생성 중 오류가 발생했습니다')
    } finally {
      setIsCreating(false)
    }
  }

  // 검색어 변경
  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchTerm(e.target.value)
    setIsOpen(true)
    setHighlightedIndex(0)
  }

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      {/* 입력 필드 */}
      <div className="relative">
        <div className="absolute left-3 top-1/2 transform -translate-y-1/2">
          <Search className="w-4 h-4 text-gray-400" />
        </div>

        <input
          ref={inputRef}
          type="text"
          value={selectedBusiness ? selectedBusiness.business_name : searchTerm}
          onChange={handleSearchChange}
          onFocus={() => setIsOpen(true)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          disabled={disabled}
          className={`w-full pl-10 pr-20 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent ${
            disabled ? 'bg-gray-100 cursor-not-allowed' : ''
          }`}
        />

        {/* 우측 버튼들 */}
        <div className="absolute right-2 top-1/2 transform -translate-y-1/2 flex items-center gap-1">
          {selectedBusiness && !disabled && (
            <button
              onClick={handleClear}
              className="p-1 hover:bg-gray-100 rounded transition-colors"
              type="button"
            >
              <X className="w-4 h-4 text-gray-400" />
            </button>
          )}
          <button
            onClick={() => setIsOpen(!isOpen)}
            className="p-1 hover:bg-gray-100 rounded transition-colors"
            type="button"
            disabled={disabled}
          >
            <ChevronDown
              className={`w-4 h-4 text-gray-400 transition-transform ${
                isOpen ? 'rotate-180' : ''
              }`}
            />
          </button>
        </div>
      </div>

      {/* 드롭다운 목록 */}
      {isOpen && !disabled && (
        <div className="absolute z-50 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg max-h-60 overflow-y-auto">
          {filteredBusinesses.length === 0 ? (
            <div className="p-3 text-sm text-gray-500">
              {searchTerm ? (
                <>
                  <div className="text-center mb-2">검색 결과가 없습니다</div>
                  {allowCreate && onCreateNew && searchTerm.trim() && (
                    <button
                      onClick={handleCreateNew}
                      disabled={isCreating}
                      className="w-full px-3 py-2 bg-green-50 text-green-700 hover:bg-green-100 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      type="button"
                    >
                      {isCreating ? (
                        <span className="flex items-center justify-center gap-2">
                          <span className="animate-spin">⏳</span>
                          생성 중...
                        </span>
                      ) : (
                        <span className="flex items-center justify-center gap-2">
                          <span>+</span>
                          "{searchTerm}" 신규 등록
                        </span>
                      )}
                    </button>
                  )}
                </>
              ) : (
                <div className="text-center">사업장 이름을 입력하세요</div>
              )}
            </div>
          ) : (
            <>
              {filteredBusinesses.map((business, index) => (
                <button
                  key={business.id}
                  onClick={() => handleSelect(business)}
                  className={`w-full text-left px-3 py-2 text-sm transition-colors ${
                    index === highlightedIndex
                      ? 'bg-green-50 text-green-700'
                      : 'hover:bg-gray-50'
                  } ${selectedBusiness?.id === business.id ? 'bg-green-100 font-medium' : ''}`}
                  type="button"
                >
                  {business.business_name}
                </button>
              ))}
              {allowCreate && onCreateNew && searchTerm.trim() && (
                <button
                  onClick={handleCreateNew}
                  disabled={isCreating}
                  className="w-full text-left px-3 py-2 text-sm border-t border-gray-200 bg-green-50 text-green-700 hover:bg-green-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  type="button"
                >
                  {isCreating ? (
                    <span className="flex items-center gap-2">
                      <span className="animate-spin">⏳</span>
                      생성 중...
                    </span>
                  ) : (
                    <span className="flex items-center gap-2">
                      <span>+</span>
                      "{searchTerm}" 신규 등록
                    </span>
                  )}
                </button>
              )}
            </>
          )}
        </div>
      )}

      {/* 도움말 텍스트 */}
      {!selectedBusiness && (
        <p className="mt-1 text-xs text-gray-500">
          💡 사업장 이름을 입력하거나 목록에서 선택하세요
        </p>
      )}
    </div>
  )
}
