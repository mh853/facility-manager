'use client';

import { memo, useCallback, useMemo } from 'react';
import { Search, Calendar, User, Camera, ChevronDown, ChevronUp, CheckSquare } from 'lucide-react';

interface FilterPanelProps {
  // 검색어
  searchTerm: string;
  onSearchChange: (value: string) => void;

  // 실사자명 필터
  inspectorName: string;
  onInspectorChange: (value: string) => void;
  inspectorOptions: string[];

  // 날짜 범위 필터
  dateFrom: string;
  dateTo: string;
  onDateFromChange: (value: string) => void;
  onDateToChange: (value: string) => void;

  // 사진 등록 여부 필터
  photoStatus: 'all' | 'with_photos' | 'without_photos';
  onPhotoStatusChange: (value: 'all' | 'with_photos' | 'without_photos') => void;

  // Phase 필터 (진행 단계)
  phases: {
    presurvey: boolean;
    postinstall: boolean;
    aftersales: boolean;
  };
  onPhaseChange: (phase: 'presurvey' | 'postinstall' | 'aftersales', checked: boolean) => void;

  // 결과 통계
  filteredCount: number;
  totalCount: number;

  // 필터 확장/축소
  isExpanded: boolean;
  onToggleExpanded: () => void;

  // 필터 초기화
  onReset: () => void;
}

export default memo(function FilterPanel({
  searchTerm,
  onSearchChange,
  inspectorName,
  onInspectorChange,
  inspectorOptions,
  dateFrom,
  dateTo,
  onDateFromChange,
  onDateToChange,
  photoStatus,
  onPhotoStatusChange,
  phases,
  onPhaseChange,
  filteredCount,
  totalCount,
  isExpanded,
  onToggleExpanded,
  onReset
}: FilterPanelProps) {

  // 활성 필터 개수 계산
  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (searchTerm.trim()) count++;
    if (inspectorName && inspectorName !== 'all') count++;
    if (dateFrom || dateTo) count++;
    if (photoStatus !== 'all') count++;
    // Phase 필터: 전체 선택되지 않은 경우만 카운트
    const allPhasesSelected = phases.presurvey && phases.postinstall && phases.aftersales;
    if (!allPhasesSelected && (phases.presurvey || phases.postinstall || phases.aftersales)) count++;
    return count;
  }, [searchTerm, inspectorName, dateFrom, dateTo, photoStatus, phases]);

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
      {/* 기본 검색 (항상 표시) */}
      <div className="p-3 sm:p-6 border-b border-gray-200">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
          <input
            type="text"
            lang="ko"
            inputMode="text"
            placeholder="사업장명, 주소, 실사자명 검색"
            value={searchTerm}
            onChange={(e) => onSearchChange(e.target.value)}
            className="w-full pl-11 pr-10 py-2 sm:py-3 border-2 border-gray-200 rounded-lg focus:border-blue-500 focus:ring-2 focus:ring-blue-100 text-xs sm:text-sm transition-all"
            autoComplete="off"
          />
          {searchTerm && (
            <button
              onClick={() => onSearchChange('')}
              className="absolute right-3 sm:right-4 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600 text-sm sm:text-base"
            >
              ✕
            </button>
          )}
        </div>

        {/* 고급 필터 토글 버튼 */}
        <button
          onClick={onToggleExpanded}
          className="flex items-center justify-between w-full mt-3 sm:mt-4 px-3 sm:px-4 py-1.5 sm:py-2 bg-gray-50 hover:bg-gray-100 rounded-lg transition-colors text-xs sm:text-sm font-medium text-gray-700"
        >
          <div className="flex items-center gap-2">
            <span>고급 필터</span>
            {activeFilterCount > 0 && (
              <span className="px-1.5 sm:px-2 py-0.5 bg-blue-600 text-white text-[10px] sm:text-xs rounded-full">
                {activeFilterCount}
              </span>
            )}
          </div>
          {isExpanded ? <ChevronUp className="w-3.5 h-3.5 sm:w-4 sm:h-4" /> : <ChevronDown className="w-3.5 h-3.5 sm:w-4 sm:h-4" />}
        </button>
      </div>

      {/* 고급 필터 (확장 시 표시) */}
      {isExpanded && (
        <div className="p-3 sm:p-6 space-y-3 sm:space-y-4 bg-gray-50 border-b border-gray-200">
          {/* 실사자명 필터 */}
          <div>
            <label className="flex items-center gap-1.5 sm:gap-2 text-xs sm:text-sm font-medium text-gray-700 mb-1.5 sm:mb-2">
              <User className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              실사자명
            </label>
            <select
              value={inspectorName}
              onChange={(e) => onInspectorChange(e.target.value)}
              className="w-full px-3 sm:px-4 py-1.5 sm:py-2 border-2 border-gray-200 rounded-lg focus:border-blue-500 focus:ring-2 focus:ring-blue-100 text-xs sm:text-sm transition-all"
            >
              <option value="all">전체</option>
              {inspectorOptions.map((name) => (
                <option key={name} value={name}>{name}</option>
              ))}
            </select>
          </div>

          {/* 실사일자 범위 필터 */}
          <div>
            <label className="flex items-center gap-1.5 sm:gap-2 text-xs sm:text-sm font-medium text-gray-700 mb-1.5 sm:mb-2">
              <Calendar className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              실사일자
            </label>
            <div className="grid grid-cols-2 gap-2 sm:gap-3">
              <div>
                <input
                  type="date"
                  value={dateFrom}
                  onChange={(e) => onDateFromChange(e.target.value)}
                  className="w-full px-2 sm:px-3 py-1.5 sm:py-2 border-2 border-gray-200 rounded-lg focus:border-blue-500 focus:ring-2 focus:ring-blue-100 text-xs sm:text-sm transition-all"
                  placeholder="시작일"
                />
                <span className="text-[10px] sm:text-xs text-gray-500 mt-1 block">시작일</span>
              </div>
              <div>
                <input
                  type="date"
                  value={dateTo}
                  onChange={(e) => onDateToChange(e.target.value)}
                  className="w-full px-2 sm:px-3 py-1.5 sm:py-2 border-2 border-gray-200 rounded-lg focus:border-blue-500 focus:ring-2 focus:ring-blue-100 text-xs sm:text-sm transition-all"
                  placeholder="종료일"
                />
                <span className="text-[10px] sm:text-xs text-gray-500 mt-1 block">종료일</span>
              </div>
            </div>
          </div>

          {/* 사진 등록 여부 필터 */}
          <div>
            <label className="flex items-center gap-1.5 sm:gap-2 text-xs sm:text-sm font-medium text-gray-700 mb-1.5 sm:mb-2">
              <Camera className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              사진 등록
            </label>
            <div className="flex gap-2 sm:gap-3">
              <button
                onClick={() => onPhotoStatusChange('all')}
                className={`flex-1 px-2 sm:px-4 py-1.5 sm:py-2 rounded-lg text-xs sm:text-sm font-medium transition-all ${
                  photoStatus === 'all'
                    ? 'bg-blue-600 text-white'
                    : 'bg-white border-2 border-gray-200 text-gray-700 hover:border-blue-300'
                }`}
              >
                전체
              </button>
              <button
                onClick={() => onPhotoStatusChange('with_photos')}
                className={`flex-1 px-2 sm:px-4 py-1.5 sm:py-2 rounded-lg text-xs sm:text-sm font-medium transition-all ${
                  photoStatus === 'with_photos'
                    ? 'bg-blue-600 text-white'
                    : 'bg-white border-2 border-gray-200 text-gray-700 hover:border-blue-300'
                }`}
              >
                📷 있음
              </button>
              <button
                onClick={() => onPhotoStatusChange('without_photos')}
                className={`flex-1 px-2 sm:px-4 py-1.5 sm:py-2 rounded-lg text-xs sm:text-sm font-medium transition-all ${
                  photoStatus === 'without_photos'
                    ? 'bg-blue-600 text-white'
                    : 'bg-white border-2 border-gray-200 text-gray-700 hover:border-blue-300'
                }`}
              >
                ❌ 없음
              </button>
            </div>
          </div>

          {/* Phase 필터 (진행 단계) */}
          <div>
            <label className="flex items-center gap-1.5 sm:gap-2 text-xs sm:text-sm font-medium text-gray-700 mb-1.5 sm:mb-2">
              <CheckSquare className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              진행 단계
            </label>
            <div className="space-y-1.5 sm:space-y-2">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={phases.presurvey}
                  onChange={(e) => onPhaseChange('presurvey', e.target.checked)}
                  className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                />
                <span className="text-xs sm:text-sm text-gray-700">🔍 설치 전 실사</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={phases.postinstall}
                  onChange={(e) => onPhaseChange('postinstall', e.target.checked)}
                  className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                />
                <span className="text-xs sm:text-sm text-gray-700">📸 설치 후 사진</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={phases.aftersales}
                  onChange={(e) => onPhaseChange('aftersales', e.target.checked)}
                  className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                />
                <span className="text-xs sm:text-sm text-gray-700">🔧 AS 사진</span>
              </label>
            </div>
          </div>

          {/* 필터 초기화 버튼 */}
          {activeFilterCount > 0 && (
            <button
              onClick={onReset}
              className="w-full px-3 sm:px-4 py-1.5 sm:py-2 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-lg text-xs sm:text-sm font-medium transition-colors"
            >
              필터 초기화 ({activeFilterCount}개)
            </button>
          )}
        </div>
      )}

      {/* 검색 결과 통계 */}
      <div className="px-3 sm:px-6 py-2 sm:py-3 bg-gray-50 border-t border-gray-200">
        <p className="text-xs sm:text-sm text-gray-600">
          <strong className="text-blue-600">{filteredCount}개</strong> 결과
          {filteredCount !== totalCount && (
            <span className="text-gray-400 ml-1">(전체 {totalCount}개)</span>
          )}
        </p>
      </div>
    </div>
  );
});
