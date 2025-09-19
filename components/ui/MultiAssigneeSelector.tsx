'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Search,
  X,
  ChevronDown,
  User,
  Building2,
  Check,
  Plus,
  Loader2
} from 'lucide-react';

// 담당자 인터페이스
export interface Assignee {
  id: string;
  name: string;
  email: string;
  employee_id: string;
  department?: string;
  position?: string;
  is_active: boolean;
}

// 선택된 담당자 인터페이스
export interface SelectedAssignee {
  id: string;
  name: string;
  position: string;
  email: string;
}

interface MultiAssigneeSelectorProps {
  selectedAssignees: SelectedAssignee[];
  onAssigneesChange: (assignees: SelectedAssignee[]) => void;
  placeholder?: string;
  maxAssignees?: number;
  disabled?: boolean;
  currentUserId?: string; // 현재 로그인한 사용자 ID (기본값으로 설정)
  showCurrentUserFirst?: boolean;
  className?: string;
}

export default function MultiAssigneeSelector({
  selectedAssignees,
  onAssigneesChange,
  placeholder = "담당자를 검색하여 선택하세요",
  maxAssignees = 10,
  disabled = false,
  currentUserId,
  showCurrentUserFirst = true,
  className = ""
}: MultiAssigneeSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [availableAssignees, setAvailableAssignees] = useState<Assignee[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const [error, setError] = useState<string | null>(null);

  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const searchTimeoutRef = useRef<NodeJS.Timeout>();

  // API에서 직원 목록 로딩
  const loadAssignees = useCallback(async (search?: string) => {
    try {
      setIsLoading(true);
      setError(null);

      const params = new URLSearchParams();
      if (search && search.length >= 2) {
        params.set('search', search);
      }
      params.set('limit', '20');
      params.set('includeInactive', 'false');

      const response = await fetch(`/api/users/employees?${params.toString()}`);
      if (!response.ok) {
        throw new Error('직원 목록을 불러오는데 실패했습니다.');
      }

      const data = await response.json();
      if (data.success && data.data) {
        let employees = data.data.employees || [];

        // 현재 사용자를 맨 앞으로 이동 (설정된 경우)
        if (showCurrentUserFirst && currentUserId) {
          const currentUserIndex = employees.findIndex((emp: Assignee) => emp.id === currentUserId);
          if (currentUserIndex > 0) {
            const currentUser = employees[currentUserIndex];
            employees = [currentUser, ...employees.filter((emp: Assignee) => emp.id !== currentUserId)];
          }
        }

        setAvailableAssignees(employees);
      }
    } catch (error) {
      console.error('Failed to load assignees:', error);
      setError('담당자 목록을 불러오는 중 오류가 발생했습니다.');
    } finally {
      setIsLoading(false);
    }
  }, [currentUserId, showCurrentUserFirst]);

  // 초기 로딩
  useEffect(() => {
    if (isOpen) {
      loadAssignees();
    }
  }, [isOpen, loadAssignees]);

  // 검색어 디바운싱
  useEffect(() => {
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    if (isOpen) {
      searchTimeoutRef.current = setTimeout(() => {
        loadAssignees(searchTerm);
      }, 300);
    }

    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, [searchTerm, isOpen, loadAssignees]);

  // 외부 클릭 감지
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node) &&
        inputRef.current &&
        !inputRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
        setSearchTerm('');
        setSelectedIndex(-1);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isOpen]);

  // 키보드 네비게이션
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (!isOpen) {
      if (e.key === 'Enter' || e.key === ' ' || e.key === 'ArrowDown') {
        e.preventDefault();
        setIsOpen(true);
      }
      return;
    }

    const filteredAssignees = getFilteredAssignees();

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setSelectedIndex(prev =>
          prev < filteredAssignees.length - 1 ? prev + 1 : 0
        );
        break;
      case 'ArrowUp':
        e.preventDefault();
        setSelectedIndex(prev =>
          prev > 0 ? prev - 1 : filteredAssignees.length - 1
        );
        break;
      case 'Enter':
        e.preventDefault();
        if (selectedIndex >= 0 && selectedIndex < filteredAssignees.length) {
          handleAssigneeSelect(filteredAssignees[selectedIndex]);
        }
        break;
      case 'Escape':
        e.preventDefault();
        setIsOpen(false);
        setSearchTerm('');
        setSelectedIndex(-1);
        break;
      case 'Backspace':
        if (searchTerm === '' && (selectedAssignees || []).length > 0) {
          e.preventDefault();
          const lastAssignee = (selectedAssignees || [])[selectedAssignees!.length - 1];
          if (lastAssignee) {
            handleAssigneeRemove(lastAssignee);
          }
        }
        break;
    }
  }, [isOpen, selectedIndex, searchTerm, selectedAssignees]);

  // 필터링된 담당자 목록
  const getFilteredAssignees = useCallback(() => {
    const alreadySelectedIds = (selectedAssignees || []).map(a => a.id);
    return (availableAssignees || []).filter(assignee =>
      !alreadySelectedIds.includes(assignee.id)
    );
  }, [availableAssignees, selectedAssignees]);

  // 담당자 선택
  const handleAssigneeSelect = useCallback((assignee: Assignee) => {
    if ((selectedAssignees || []).length >= maxAssignees) {
      setError(`최대 ${maxAssignees}명까지만 선택할 수 있습니다.`);
      return;
    }

    const newAssignee: SelectedAssignee = {
      id: assignee.id,
      name: assignee.name,
      position: assignee.position || '미정',
      email: assignee.email
    };

    const newAssignees = [...(selectedAssignees || []), newAssignee];
    onAssigneesChange(newAssignees);

    setSearchTerm('');
    setSelectedIndex(-1);
    setError(null);

    // 포커스를 입력 필드로 다시 이동
    if (inputRef.current) {
      inputRef.current.focus();
    }
  }, [selectedAssignees, maxAssignees, onAssigneesChange]);

  // 담당자 제거
  const handleAssigneeRemove = useCallback((assigneeToRemove: SelectedAssignee) => {
    const newAssignees = (selectedAssignees || []).filter(a => a.id !== assigneeToRemove.id);
    onAssigneesChange(newAssignees);
    setError(null);
  }, [selectedAssignees, onAssigneesChange]);

  // 현재 사용자를 기본값으로 추가
  const addCurrentUserAsDefault = useCallback(async () => {
    if (!currentUserId || (selectedAssignees || []).some(a => a.id === currentUserId)) {
      return;
    }

    try {
      const response = await fetch(`/api/users/employees?search=${currentUserId}`);
      if (response.ok) {
        const data = await response.json();
        const currentUser = data.data?.employees?.find((emp: Assignee) => emp.id === currentUserId);
        if (currentUser) {
          handleAssigneeSelect(currentUser);
        }
      }
    } catch (error) {
      console.error('Failed to add current user as default:', error);
    }
  }, [currentUserId, selectedAssignees, handleAssigneeSelect]);

  // 컴포넌트 마운트 시 현재 사용자를 기본값으로 추가
  useEffect(() => {
    if ((selectedAssignees || []).length === 0 && currentUserId && showCurrentUserFirst) {
      addCurrentUserAsDefault();
    }
  }, []);

  const filteredAssignees = getFilteredAssignees();

  return (
    <div className={`relative ${className}`}>
      {/* 선택된 담당자들 */}
      <div className="min-h-[42px] w-full px-3 py-2 border border-gray-300 rounded-lg bg-white focus-within:ring-2 focus-within:ring-blue-500 focus-within:border-transparent">
        <div className="flex flex-wrap gap-2 items-center">
          {/* 선택된 담당자 태그들 */}
          {(selectedAssignees || []).map((assignee) => (
            <span
              key={assignee.id}
              className="inline-flex items-center gap-1 px-2 py-1 bg-blue-100 text-blue-800 rounded-md text-sm font-medium"
            >
              <User className="w-3 h-3" />
              <span className="font-medium">{assignee.name}</span>
              {assignee.position && (
                <span className="text-blue-600">({assignee.position})</span>
              )}
              {!disabled && (
                <button
                  type="button"
                  onClick={() => handleAssigneeRemove(assignee)}
                  className="ml-1 hover:bg-blue-200 rounded-full p-0.5 transition-colors"
                  title={`${assignee.name} 제거`}
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </span>
          ))}

          {/* 입력 필드 */}
          <div className="flex-1 min-w-[120px]">
            <input
              ref={inputRef}
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              onFocus={() => setIsOpen(true)}
              onKeyDown={handleKeyDown}
              placeholder={(selectedAssignees || []).length === 0 ? placeholder : "더 추가..."}
              disabled={disabled || (selectedAssignees || []).length >= maxAssignees}
              className="w-full outline-none bg-transparent text-sm placeholder-gray-400"
            />
          </div>

          {/* 드롭다운 토글 버튼 */}
          <button
            type="button"
            onClick={() => setIsOpen(!isOpen)}
            disabled={disabled}
            className="p-1 text-gray-400 hover:text-gray-600 transition-colors"
          >
            <ChevronDown className={`w-4 h-4 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
          </button>
        </div>
      </div>

      {/* 오류 메시지 */}
      {error && (
        <div className="mt-1 text-sm text-red-600">
          {error}
        </div>
      )}

      {/* 선택 정보 */}
      <div className="mt-1 text-xs text-gray-500">
        {(selectedAssignees || []).length > 0 && (
          <span>{(selectedAssignees || []).length}명 선택됨</span>
        )}
        {maxAssignees && (
          <span className="ml-2">최대 {maxAssignees}명</span>
        )}
      </div>

      {/* 드롭다운 */}
      {isOpen && (
        <div
          ref={dropdownRef}
          className="absolute z-50 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg max-h-64 overflow-y-auto"
        >
          {/* 검색 상태 */}
          {isLoading && (
            <div className="flex items-center justify-center py-4">
              <Loader2 className="w-4 h-4 animate-spin text-gray-400" />
              <span className="ml-2 text-sm text-gray-500">검색 중...</span>
            </div>
          )}

          {/* 검색 결과 */}
          {!isLoading && filteredAssignees.length > 0 && (
            <>
              {searchTerm && (
                <div className="px-3 py-2 text-xs text-gray-500 bg-gray-50 border-b">
                  "{searchTerm}" 검색 결과 {filteredAssignees.length}명
                </div>
              )}
              {filteredAssignees.map((assignee, index) => (
                <button
                  key={assignee.id}
                  type="button"
                  onClick={() => handleAssigneeSelect(assignee)}
                  className={`w-full px-3 py-3 text-left hover:bg-gray-50 border-b border-gray-100 last:border-b-0 transition-colors ${
                    index === selectedIndex ? 'bg-blue-50 border-blue-200' : ''
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                      <User className="w-4 h-4 text-blue-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-gray-900 truncate">
                          {assignee.name}
                        </span>
                        {assignee.position && (
                          <span className="text-sm text-gray-600 bg-gray-100 px-2 py-0.5 rounded">
                            {assignee.position}
                          </span>
                        )}
                        {assignee.id === currentUserId && (
                          <span className="text-xs text-blue-600 bg-blue-100 px-2 py-0.5 rounded">
                            나
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 mt-1 text-xs text-gray-500">
                        {assignee.department && (
                          <span className="flex items-center gap-1">
                            <Building2 className="w-3 h-3" />
                            {assignee.department}
                          </span>
                        )}
                        <span>{assignee.email}</span>
                      </div>
                    </div>
                    {(selectedAssignees || []).some(selected => selected.id === assignee.id) && (
                      <Check className="w-4 h-4 text-blue-600" />
                    )}
                  </div>
                </button>
              ))}
            </>
          )}

          {/* 검색 결과 없음 */}
          {!isLoading && filteredAssignees.length === 0 && (
            <div className="px-3 py-4 text-center text-gray-500">
              {searchTerm ? (
                <div>
                  <Search className="w-8 h-8 mx-auto mb-2 text-gray-300" />
                  <p className="text-sm">"{searchTerm}"에 대한 검색 결과가 없습니다.</p>
                  <p className="text-xs mt-1">다른 검색어를 시도해보세요.</p>
                </div>
              ) : availableAssignees.length === (selectedAssignees || []).length ? (
                <div>
                  <Check className="w-8 h-8 mx-auto mb-2 text-green-300" />
                  <p className="text-sm">모든 담당자가 선택되었습니다.</p>
                </div>
              ) : (
                <div>
                  <User className="w-8 h-8 mx-auto mb-2 text-gray-300" />
                  <p className="text-sm">담당자 목록을 불러오는 중입니다.</p>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}