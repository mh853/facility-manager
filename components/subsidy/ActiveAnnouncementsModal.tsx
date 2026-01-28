'use client';

import { useState, useMemo, useEffect, useRef } from 'react';
import { X, Search, ChevronDown, ChevronUp } from 'lucide-react';
import type { SubsidyAnnouncement } from '@/types/subsidy';
import { setModalHideForToday } from '@/utils/modalHideControl';

interface ActiveAnnouncementsModalProps {
  isOpen: boolean;
  openMode?: 'auto' | 'manual' | null; // 모달 오픈 모드
  onClose: () => void;
  announcements: SubsidyAnnouncement[];
  registeredRegions?: string[]; // URL 관리에 등록된 지역 목록
  onAnnouncementClick: (announcement: SubsidyAnnouncement) => void;
}

type UrgencyLevel = 'urgent' | 'warning' | 'safe' | 'ongoing';
type SortField = 'dday' | 'budget' | 'region';
type SortOrder = 'asc' | 'desc';

interface DdayInfo {
  daysRemaining: number;
  urgency: UrgencyLevel;
  label: string;
  icon: string;
}

export default function ActiveAnnouncementsModal({
  isOpen,
  openMode,
  onClose,
  announcements,
  registeredRegions,
  onAnnouncementClick,
}: ActiveAnnouncementsModalProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedRegion, setSelectedRegion] = useState('all');
  const [sortField, setSortField] = useState<SortField>('dday');
  const [sortOrder, setSortOrder] = useState<SortOrder>('asc');
  const [selectedUrgency, setSelectedUrgency] = useState<UrgencyLevel | 'all'>('all');
  const [showUnannounceModal, setShowUnannounceModal] = useState(false); // 미공고 지자체 모달
  const [hideForToday, setHideForToday] = useState(false); // 오늘 하루 그만보기 체크박스

  const modalRef = useRef<HTMLDivElement>(null);

  // 긴급도 필터 핸들러
  const handleUrgencyFilter = (urgency: UrgencyLevel | 'all') => {
    // 같은 필터를 다시 클릭하면 전체로 초기화 (토글)
    if (selectedUrgency === urgency) {
      setSelectedUrgency('all');
    } else {
      setSelectedUrgency(urgency);
    }
  };

  // 모달 닫기 핸들러 (오늘 하루 그만보기 처리)
  const handleClose = () => {
    // auto 모드이고 체크박스가 체크된 경우에만 localStorage에 저장
    if (openMode === 'auto' && hideForToday) {
      setModalHideForToday();
      console.log('[Modal] 오늘 하루 그만보기 설정 저장됨');
    }
    onClose();
  };

  // D-day 계산 및 긴급도 판정
  const calculateDday = (endDate: string | null | undefined): DdayInfo => {
    // 마감일이 없는 경우 = 예산 소진 시까지 = 상시 모집
    if (!endDate) {
      return {
        daysRemaining: Infinity,
        urgency: 'ongoing',
        label: '예산소진시',
        icon: '♾️',
      };
    }

    const end = new Date(endDate);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    end.setHours(0, 0, 0, 0);

    const diffTime = end.getTime() - today.getTime();
    const daysRemaining = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    let urgency: UrgencyLevel;
    let icon: string;

    if (daysRemaining <= 7) {
      urgency = 'urgent';
      icon = '🔥';
    } else if (daysRemaining <= 14) {
      urgency = 'warning';
      icon = '⚠️';
    } else {
      urgency = 'safe';
      icon = '✅';
    }

    return {
      daysRemaining,
      urgency,
      label: `D-${daysRemaining}`,
      icon,
    };
  };

  // 예산 문자열 파싱
  const parseBudget = (budgetStr: string | null | undefined): number => {
    if (!budgetStr) return 0;
    const numbers = budgetStr.replace(/[^\d]/g, '');
    if (!numbers) return 0;

    if (budgetStr.includes('억')) {
      return parseInt(numbers) * 100000000;
    }
    return parseInt(numbers);
  };

  // 예산 포맷팅
  const formatBudget = (budget: string | null | undefined): string => {
    if (!budget) return '-';
    const value = parseBudget(budget);
    if (value === 0) return '-';

    if (value >= 100000000) {
      return `${(value / 100000000).toFixed(0)}억원`;
    }
    return budget;
  };

  // 날짜 포맷팅
  const formatDate = (dateStr?: string) => {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleDateString('ko-KR', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).replace(/\. /g, '.').replace(/\.$/, '');
  };

  // 지역명 추출
  const extractRegion = (title: string, regionName: string): string => {
    // region_name이 있으면 우선 사용 (IoT 같은 잘못된 추출 방지)
    if (regionName && regionName.trim()) {
      return regionName;
    }

    // region_name이 없으면 제목에서 추출
    const bracketMatches = title.match(/\[([^\]]+)\]/g);
    if (!bracketMatches || bracketMatches.length === 0) {
      return '미분류';
    }

    const regionMap: Record<string, string> = {
      '서울': '서울특별시',
      '부산': '부산광역시',
      '대구': '대구광역시',
      '인천': '인천광역시',
      '광주': '광주광역시',
      '대전': '대전광역시',
      '울산': '울산광역시',
      '세종': '세종특별자치시',
      '경기': '경기도',
      '강원': '강원특별자치도',
      '충북': '충청북도',
      '충남': '충청남도',
      '전북': '전북특별자치도',
      '전남': '전라남도',
      '경북': '경상북도',
      '경남': '경상남도',
      '제주': '제주특별자치도',
    };

    const fullNameSourcePatterns = [
      /^서울특별시$/, /^부산광역시$/, /^대구광역시$/, /^인천광역시$/,
      /^광주광역시$/, /^대전광역시$/, /^울산광역시$/, /^세종특별자치시$/,
    ];

    const extractedRegions = bracketMatches.map(m => m.replace(/[\[\]]/g, ''));

    if (extractedRegions.length >= 2) {
      const firstRegion = extractedRegions[0];
      const isFirstSourcePattern = fullNameSourcePatterns.some(p => p.test(firstRegion));

      if (isFirstSourcePattern) {
        const targetRegion = extractedRegions[1];
        return regionMap[targetRegion] || targetRegion;
      }
    }

    const region = extractedRegions[0];
    return regionMap[region] || region;
  };

  // 타이틀 클린업
  const cleanTitle = (title: string): string => {
    const sourcePatterns = [
      /^\[서울특별시\]\s*/, /^\[부산광역시\]\s*/, /^\[대구광역시\]\s*/,
      /^\[인천광역시\]\s*/, /^\[광주광역시\]\s*/, /^\[대전광역시\]\s*/,
      /^\[울산광역시\]\s*/, /^\[세종특별자치시\]\s*/,
    ];

    for (const pattern of sourcePatterns) {
      if (pattern.test(title)) {
        return title.replace(pattern, '');
      }
    }
    return title;
  };

  // 신청 가능한 공고 필터링
  const activeAnnouncements = useMemo(() => {
    const now = new Date();
    return announcements.filter(announcement => {
      // 마감일이 없으면 "상시 모집" = 항상 신청 가능
      if (!announcement.application_period_end) return true;

      const endDate = new Date(announcement.application_period_end);
      return endDate >= now;
    });
  }, [announcements]);

  // 검색 및 지역 필터링
  const filteredAnnouncements = useMemo(() => {
    let result = [...activeAnnouncements];

    // 검색 필터
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      result = result.filter(announcement => {
        const searchableText = [
          announcement.title,
          announcement.region_name,
          announcement.target_description,
          announcement.budget,
          ...(announcement.keywords_matched || [])
        ].join(' ').toLowerCase();
        return searchableText.includes(query);
      });
    }

    // 지역 필터
    if (selectedRegion !== 'all') {
      result = result.filter(announcement => {
        const region = extractRegion(announcement.title, announcement.region_name);
        return region === selectedRegion;
      });
    }

    return result;
  }, [activeAnnouncements, searchQuery, selectedRegion]);

  // 긴급도 필터링
  const urgencyFilteredAnnouncements = useMemo(() => {
    if (selectedUrgency === 'all') {
      return filteredAnnouncements;
    }

    return filteredAnnouncements.filter(announcement => {
      const dday = calculateDday(announcement.application_period_end);
      return dday.urgency === selectedUrgency;
    });
  }, [filteredAnnouncements, selectedUrgency]);

  // 정렬
  const sortedAnnouncements = useMemo(() => {
    const sorted = [...urgencyFilteredAnnouncements].sort((a, b) => {
      let comparison = 0;

      switch (sortField) {
        case 'dday': {
          const daysA = calculateDday(a.application_period_end).daysRemaining;
          const daysB = calculateDday(b.application_period_end).daysRemaining;

          // Infinity (상시모집)는 항상 뒤로
          if (daysA === Infinity && daysB !== Infinity) return 1;
          if (daysA !== Infinity && daysB === Infinity) return -1;

          comparison = daysA - daysB;
          break;
        }
        case 'budget': {
          const budgetA = parseBudget(a.budget);
          const budgetB = parseBudget(b.budget);
          comparison = budgetA - budgetB;
          break;
        }
        case 'region': {
          const regionA = extractRegion(a.title, a.region_name);
          const regionB = extractRegion(b.title, b.region_name);
          comparison = regionA.localeCompare(regionB, 'ko');
          break;
        }
      }

      return sortOrder === 'asc' ? comparison : -comparison;
    });

    return sorted;
  }, [urgencyFilteredAnnouncements, sortField, sortOrder]);

  // 긴급도별 통계
  const stats = useMemo(() => {
    const urgent = sortedAnnouncements.filter(a => {
      const dday = calculateDday(a.application_period_end);
      return dday.urgency === 'urgent';
    }).length;

    const warning = sortedAnnouncements.filter(a => {
      const dday = calculateDday(a.application_period_end);
      return dday.urgency === 'warning';
    }).length;

    const safe = sortedAnnouncements.filter(a => {
      const dday = calculateDday(a.application_period_end);
      return dday.urgency === 'safe';
    }).length;

    // 상시모집 (마감일 없음)
    const ongoing = sortedAnnouncements.filter(a => {
      const dday = calculateDday(a.application_period_end);
      return dday.urgency === 'ongoing';
    }).length;

    return { urgent, warning, safe, ongoing };
  }, [sortedAnnouncements]);

  // 미공고 지자체 계산
  const unannounceRegions = useMemo(() => {
    if (!registeredRegions || registeredRegions.length === 0) return [];

    const activeRegions = new Set(
      activeAnnouncements.map(a => extractRegion(a.title, a.region_name))
    );

    return registeredRegions.filter(region => !activeRegions.has(region));
  }, [registeredRegions, activeAnnouncements]);

  // 고유 지역 목록
  const uniqueRegions = useMemo(() => {
    const regions = new Set<string>();
    activeAnnouncements.forEach(announcement => {
      const region = extractRegion(announcement.title, announcement.region_name);
      if (region) regions.add(region);
    });
    return Array.from(regions).sort((a, b) => a.localeCompare(b, 'ko'));
  }, [activeAnnouncements]);

  // ESC 키 및 포커스 트랩
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }

      // Tab 트랩
      if (e.key === 'Tab') {
        const focusableElements = modalRef.current?.querySelectorAll(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        );

        if (!focusableElements || focusableElements.length === 0) return;

        const firstElement = focusableElements[0] as HTMLElement;
        const lastElement = focusableElements[focusableElements.length - 1] as HTMLElement;

        if (e.shiftKey) {
          if (document.activeElement === firstElement) {
            lastElement.focus();
            e.preventDefault();
          }
        } else {
          if (document.activeElement === lastElement) {
            firstElement.focus();
            e.preventDefault();
          }
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // 모달 열릴 때 첫 번째 요소에 포커스
  useEffect(() => {
    if (isOpen && modalRef.current) {
      const firstFocusable = modalRef.current.querySelector(
        'button, [href], input, select, textarea'
      ) as HTMLElement;
      firstFocusable?.focus();
    }
  }, [isOpen]);

  // 정렬 핸들러
  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortOrder('asc');
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      onClick={handleClose}
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-gray-900/50 backdrop-blur-sm transition-opacity duration-300"
        aria-hidden="true"
      />

      {/* Modal */}
      <div
        ref={modalRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
        aria-describedby="modal-description"
        className="relative bg-white rounded-2xl shadow-2xl max-w-7xl w-full max-h-[90vh] overflow-hidden transform transition-all duration-300"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header - Mobile Optimized */}
        <div className="sticky top-0 z-10 bg-gradient-to-br from-indigo-50 to-slate-50 border-b border-gray-200/60">
          {/* Title Bar - Compact */}
          <div className="flex items-center justify-between px-3 py-3">
            <div>
              <h2 id="modal-title" className="text-base font-bold text-gray-900 tracking-tight flex items-center gap-1.5">
                <span className="text-lg">📋</span>
                신청 가능한 공고
              </h2>
              <p id="modal-description" className="text-xs text-gray-600 mt-0.5">
                현재 신청기간이 유효한 공고 목록입니다
              </p>
            </div>

            <button
              onClick={handleClose}
              className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors flex-shrink-0"
              aria-label="닫기"
            >
              <X className="w-5 h-5 text-gray-500" />
            </button>
          </div>

          {/* Stats Summary - Horizontal Scroll (Mobile Optimized) */}
          <div className="px-3 pb-3 overflow-x-auto scrollbar-hide">
            <div className="flex gap-2 w-max">
              <button
                onClick={() => handleUrgencyFilter('all')}
                className={`
                  flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg transition-all flex-shrink-0
                  ${selectedUrgency === 'all'
                    ? 'bg-gray-100 border-2 border-gray-400 shadow-sm'
                    : 'bg-gray-50 border border-gray-200 active:bg-gray-100'}
                `}
              >
                <span className="text-base">📋</span>
                <span className="text-xs font-medium text-gray-800">전체 {sortedAnnouncements.length}건</span>
              </button>
              <button
                onClick={() => handleUrgencyFilter('urgent')}
                className={`
                  flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg transition-all flex-shrink-0
                  ${selectedUrgency === 'urgent'
                    ? 'bg-red-100 border-2 border-red-400 shadow-sm'
                    : 'bg-red-50 border border-red-200 active:bg-red-100'}
                `}
              >
                <span className="text-base">🔥</span>
                <span className="text-xs font-medium text-red-800">긴급 {stats.urgent}건</span>
              </button>
              <button
                onClick={() => handleUrgencyFilter('warning')}
                className={`
                  flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg transition-all flex-shrink-0
                  ${selectedUrgency === 'warning'
                    ? 'bg-amber-100 border-2 border-amber-400 shadow-sm'
                    : 'bg-amber-50 border border-amber-200 active:bg-amber-100'}
                `}
              >
                <span className="text-base">⚠️</span>
                <span className="text-xs font-medium text-amber-800">주의 {stats.warning}건</span>
              </button>
              <button
                onClick={() => handleUrgencyFilter('safe')}
                className={`
                  flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg transition-all flex-shrink-0
                  ${selectedUrgency === 'safe'
                    ? 'bg-emerald-100 border-2 border-emerald-400 shadow-sm'
                    : 'bg-emerald-50 border border-emerald-200 active:bg-emerald-100'}
                `}
              >
                <span className="text-base">✅</span>
                <span className="text-xs font-medium text-emerald-800">여유 {stats.safe}건</span>
              </button>
              <button
                onClick={() => handleUrgencyFilter('ongoing')}
                className={`
                  flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg transition-all flex-shrink-0
                  ${selectedUrgency === 'ongoing'
                    ? 'bg-purple-100 border-2 border-purple-400 shadow-sm'
                    : 'bg-purple-50 border border-purple-200 active:bg-purple-100'}
                `}
              >
                <span className="text-base">♾️</span>
                <span className="text-xs font-medium text-purple-800">예산소진시 {stats.ongoing}건</span>
              </button>

              {/* 미공고 지자체 배지 */}
              {registeredRegions && registeredRegions.length > 0 && (
                <button
                  onClick={() => setShowUnannounceModal(true)}
                  className={`
                    flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg transition-all flex-shrink-0
                    ${unannounceRegions.length === 0
                      ? 'bg-green-50 border border-green-200 cursor-default opacity-75'
                      : 'bg-slate-50 border border-slate-200 active:bg-slate-100'}
                  `}
                  disabled={unannounceRegions.length === 0}
                >
                  <span className="text-base">{unannounceRegions.length === 0 ? '✅' : '📭'}</span>
                  <span className={`text-xs font-medium whitespace-nowrap ${unannounceRegions.length === 0 ? 'text-green-800' : 'text-slate-800'}`}>
                    {unannounceRegions.length === 0 ? '전체 지자체 공고 있음' : `미공고 ${unannounceRegions.length}곳`}
                  </span>
                </button>
              )}
            </div>
          </div>

          {/* Filter Bar - Compact One Line (Mobile Optimized) */}
          <div className="px-3 py-2 bg-white border-t border-gray-200/40">
            <div className="grid grid-cols-12 gap-2 items-center">
              {/* Search Input - Takes 6 columns on mobile */}
              <div className="col-span-6">
                <div className="relative">
                  <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="검색..."
                    className="w-full pl-7 pr-2 py-1.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all text-xs"
                  />
                </div>
              </div>

              {/* Region Filter - 3 columns */}
              <select
                value={selectedRegion}
                onChange={(e) => setSelectedRegion(e.target.value)}
                className="col-span-3 px-2 py-1.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all text-xs font-medium bg-white"
              >
                <option value="all">전체</option>
                {uniqueRegions.map(region => (
                  <option key={region} value={region}>{region}</option>
                ))}
              </select>

              {/* Sort Dropdown - 3 columns */}
              <select
                value={`${sortField}-${sortOrder}`}
                onChange={(e) => {
                  const [field, order] = e.target.value.split('-');
                  setSortField(field as SortField);
                  setSortOrder(order as SortOrder);
                }}
                className="col-span-3 px-2 py-1.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all text-xs font-medium bg-white"
              >
                <option value="dday-asc">마감임박</option>
                <option value="dday-desc">마감여유</option>
                <option value="budget-desc">예산↓</option>
                <option value="budget-asc">예산↑</option>
              </select>
            </div>
          </div>
        </div>

        {/* Table - Desktop */}
        <div className="hidden md:block overflow-auto max-h-[calc(90vh-280px)]">
          <table className="w-full table-fixed">
            <colgroup>
              <col className="w-[8%]" /> {/* 상태 */}
              <col className="w-[18%]" /> {/* 지역 */}
              <col className="w-[40%]" /> {/* 제목 */}
              <col className="w-[14%]" /> {/* 신청기간 */}
              <col className="w-[10%]" /> {/* D-day */}
              <col className="w-[10%]" /> {/* 예산 */}
            </colgroup>
            <thead className="sticky top-0 bg-gradient-to-br from-gray-50 to-slate-50 border-b border-gray-200">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                  상태
                </th>
                <th
                  onClick={() => handleSort('region')}
                  className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider cursor-pointer hover:bg-gray-100/50 transition-colors"
                >
                  <div className="flex items-center gap-1">
                    지역
                    {sortField === 'region' && (
                      sortOrder === 'asc' ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />
                    )}
                  </div>
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                  공고 제목
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                  신청기간
                </th>
                <th
                  onClick={() => handleSort('dday')}
                  className="px-4 py-3 text-center text-xs font-semibold text-gray-700 uppercase tracking-wider cursor-pointer hover:bg-gray-100/50 transition-colors"
                >
                  <div className="flex items-center justify-center gap-1">
                    D-day
                    {sortField === 'dday' && (
                      sortOrder === 'asc' ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />
                    )}
                  </div>
                </th>
                <th
                  onClick={() => handleSort('budget')}
                  className="px-4 py-3 text-right text-xs font-semibold text-gray-700 uppercase tracking-wider cursor-pointer hover:bg-gray-100/50 transition-colors"
                >
                  <div className="flex items-center justify-end gap-1">
                    예산
                    {sortField === 'budget' && (
                      sortOrder === 'asc' ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />
                    )}
                  </div>
                </th>
              </tr>
            </thead>

            <tbody className="divide-y divide-gray-200">
              {sortedAnnouncements.map((announcement) => {
                const ddayInfo = calculateDday(announcement.application_period_end!);

                return (
                  <tr
                    key={announcement.id}
                    onClick={() => onAnnouncementClick(announcement)}
                    className="hover:bg-indigo-50/50 cursor-pointer transition-all duration-150 hover:-translate-y-0.5 hover:shadow-md"
                  >
                    {/* Status Icon */}
                    <td className="px-4 py-4">
                      <span className="text-2xl">{ddayInfo.icon}</span>
                    </td>

                    {/* Region */}
                    <td className="px-4 py-4">
                      <div
                        className="truncate text-sm font-medium text-gray-900"
                        title={extractRegion(announcement.title, announcement.region_name)}
                      >
                        {extractRegion(announcement.title, announcement.region_name)}
                      </div>
                    </td>

                    {/* Title */}
                    <td className="px-4 py-4">
                      <div className="flex items-start gap-2">
                        {!announcement.is_read && (
                          <div className="w-2 h-2 bg-blue-600 rounded-full mt-1.5 flex-shrink-0"></div>
                        )}
                        <p
                          className="text-sm font-medium text-gray-900 line-clamp-2 hover:text-indigo-600 transition-colors"
                          title={cleanTitle(announcement.title)}
                        >
                          {cleanTitle(announcement.title)}
                        </p>
                      </div>
                    </td>

                    {/* Period */}
                    <td className="px-4 py-4">
                      <div className="text-xs text-gray-600 overflow-hidden">
                        {announcement.application_period_start && (
                          <div className="truncate">{formatDate(announcement.application_period_start)}</div>
                        )}
                        {announcement.application_period_end ? (
                          <>
                            <div className="text-gray-400">~</div>
                            <div className="font-medium text-gray-900 truncate">
                              {formatDate(announcement.application_period_end)}
                            </div>
                          </>
                        ) : (
                          <div className="font-medium text-purple-700">
                            ~ 예산소진시
                          </div>
                        )}
                      </div>
                    </td>

                    {/* D-day Badge */}
                    <td className="px-4 py-4 text-center">
                      <span className={`
                        inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-bold
                        ${ddayInfo.urgency === 'urgent' ? 'bg-red-100 text-red-800 border border-red-300' : ''}
                        ${ddayInfo.urgency === 'warning' ? 'bg-amber-100 text-amber-800 border border-amber-300' : ''}
                        ${ddayInfo.urgency === 'safe' ? 'bg-emerald-100 text-emerald-800 border border-emerald-300' : ''}
                        ${ddayInfo.urgency === 'ongoing' ? 'bg-purple-100 text-purple-800 border border-purple-300' : ''}
                      `}>
                        {ddayInfo.icon} {ddayInfo.label}
                      </span>
                    </td>

                    {/* Budget */}
                    <td className="px-4 py-4 text-right">
                      <div
                        className="text-sm font-semibold text-gray-900 tabular-nums truncate"
                        title={formatBudget(announcement.budget)}
                      >
                        {formatBudget(announcement.budget)}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          {sortedAnnouncements.length === 0 && (
            <div className="p-12 text-center text-gray-500">
              <div className="text-4xl mb-4">📋</div>
              <p className="text-base">조회된 공고가 없습니다.</p>
              <p className="text-sm mt-2">필터 조건을 변경해보세요.</p>
            </div>
          )}
        </div>

        {/* Mobile Cards - Optimized for Maximum Content */}
        <div className="md:hidden overflow-auto max-h-[calc(90vh-200px)] divide-y divide-gray-100">
          {sortedAnnouncements.map((announcement) => {
            const ddayInfo = calculateDday(announcement.application_period_end!);

            return (
              <div
                key={announcement.id}
                onClick={() => onAnnouncementClick(announcement)}
                className="p-3 active:bg-indigo-50/50 cursor-pointer transition-colors"
              >
                {/* Card Header - Compact */}
                <div className="flex items-center justify-between mb-1.5">
                  <div className="flex items-center gap-1.5 flex-1 min-w-0 mr-2">
                    <span className="text-base flex-shrink-0">{ddayInfo.icon}</span>
                    <span
                      className="text-xs font-medium text-gray-700 truncate"
                      title={extractRegion(announcement.title, announcement.region_name)}
                    >
                      {extractRegion(announcement.title, announcement.region_name)}
                    </span>
                  </div>

                  <span className={`
                    px-2 py-0.5 rounded-full text-xs font-bold flex-shrink-0 whitespace-nowrap
                    ${ddayInfo.urgency === 'urgent' ? 'bg-red-100 text-red-800' : ''}
                    ${ddayInfo.urgency === 'warning' ? 'bg-amber-100 text-amber-800' : ''}
                    ${ddayInfo.urgency === 'safe' ? 'bg-emerald-100 text-emerald-800' : ''}
                    ${ddayInfo.urgency === 'ongoing' ? 'bg-purple-100 text-purple-800' : ''}
                  `}>
                    {ddayInfo.label}
                  </span>
                </div>

                {/* Card Title - Matching body text size */}
                <h3
                  className="text-sm font-semibold text-gray-900 line-clamp-2 mb-2 leading-snug"
                  title={cleanTitle(announcement.title)}
                >
                  {cleanTitle(announcement.title)}
                </h3>

                {/* Card Meta - Compact */}
                <div className="flex items-center justify-between text-xs text-gray-600">
                  <span className="flex items-center gap-1 truncate flex-1 min-w-0 mr-2" title={formatBudget(announcement.budget)}>
                    💰 <span className="truncate">{formatBudget(announcement.budget)}</span>
                  </span>
                  <span className="flex items-center gap-1 flex-shrink-0">
                    {announcement.application_period_end ? (
                      <span className="whitespace-nowrap">~{formatDate(announcement.application_period_end)}</span>
                    ) : (
                      <span className="text-purple-700 font-medium whitespace-nowrap">~예산소진시</span>
                    )}
                  </span>
                </div>
              </div>
            );
          })}

          {sortedAnnouncements.length === 0 && (
            <div className="p-8 text-center text-gray-500">
              <div className="text-3xl mb-3">📋</div>
              <p className="text-sm">조회된 공고가 없습니다.</p>
              <p className="text-xs mt-1.5 text-gray-400">필터 조건을 변경해보세요.</p>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="sticky bottom-0 bg-white border-t border-gray-200 px-6 py-4">
          <div className="flex items-center justify-between">
            {/* Left: 오늘 하루 그만보기 체크박스 (auto 모드일 때만 표시) */}
            <div className="flex items-center gap-4">
              {openMode === 'auto' && (
                <label className="flex items-center gap-2 cursor-pointer group">
                  <input
                    type="checkbox"
                    checked={hideForToday}
                    onChange={(e) => setHideForToday(e.target.checked)}
                    className="w-4 h-4 text-indigo-600 bg-gray-100 border-gray-300 rounded focus:ring-indigo-500 focus:ring-2 cursor-pointer"
                  />
                  <span className="text-sm text-gray-600 group-hover:text-gray-800 transition-colors select-none">
                    오늘 하루 그만보기
                  </span>
                </label>
              )}
              {openMode !== 'auto' && (
                <div className="text-sm text-gray-600">
                  총 <span className="font-bold text-gray-900">{sortedAnnouncements.length}</span>건의 신청 가능한 공고
                </div>
              )}
            </div>

            {/* Right: 닫기 버튼 */}
            <button
              onClick={handleClose}
              className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg transition-colors text-sm font-medium"
            >
              닫기
            </button>
          </div>
        </div>
      </div>

      {/* 미공고 지자체 목록 모달 */}
      {showUnannounceModal && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center p-4"
          onClick={() => setShowUnannounceModal(false)}
        >
          {/* Backdrop */}
          <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" />

          {/* Modal Content */}
          <div
            className="relative bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[80vh] overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="px-6 py-4 border-b border-gray-200 bg-gradient-to-r from-slate-50 to-gray-50">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="text-2xl">📭</span>
                  <div>
                    <h3 className="text-lg font-bold text-gray-900">미공고 지자체 목록</h3>
                    <p className="text-xs text-gray-600 mt-0.5">
                      URL 데이터관리에 등록되어 있지만 현재 공고가 없는 지역
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setShowUnannounceModal(false)}
                  className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                  aria-label="닫기"
                >
                  <X className="w-5 h-5 text-gray-500" />
                </button>
              </div>
            </div>

            {/* Body */}
            <div className="px-6 py-4 overflow-y-auto max-h-[calc(80vh-120px)]">
              {unannounceRegions.length === 0 ? (
                <div className="py-12 text-center">
                  <div className="text-6xl mb-4">✅</div>
                  <p className="text-lg font-semibold text-green-800 mb-2">
                    모든 등록된 지자체에 공고가 있습니다!
                  </p>
                  <p className="text-sm text-gray-600">
                    현재 URL 데이터관리에 등록된 모든 지역에서 신청가능한 공고가 게시되어 있습니다.
                  </p>
                </div>
              ) : (
                <>
                  {/* 요약 정보 */}
                  <div className="mb-4 p-4 bg-slate-50 rounded-lg border border-slate-200">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 text-sm text-slate-700">
                        <span className="font-semibold">총 {unannounceRegions.length}곳</span>
                        <span className="text-slate-500">·</span>
                        <span className="text-slate-600">전체 등록 지역 {registeredRegions?.length || 0}곳 중</span>
                      </div>
                      <div className="text-xs text-slate-500">
                        공고율: {Math.round(((registeredRegions?.length || 0) - unannounceRegions.length) / (registeredRegions?.length || 1) * 100)}%
                      </div>
                    </div>
                  </div>

                  {/* 지역 목록 그리드 */}
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                    {unannounceRegions.map((region, index) => (
                      <div
                        key={region}
                        className="px-4 py-3 bg-white border border-slate-200 rounded-lg hover:border-slate-300 hover:shadow-sm transition-all"
                      >
                        <div className="flex items-center gap-2">
                          <span className="flex-shrink-0 w-6 h-6 rounded-full bg-slate-100 text-slate-600 text-xs font-semibold flex items-center justify-center">
                            {index + 1}
                          </span>
                          <span className="text-sm font-medium text-gray-800 truncate" title={region}>
                            {region}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* 안내 메시지 */}
                  <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                    <div className="flex gap-3">
                      <span className="text-blue-600 flex-shrink-0">ℹ️</span>
                      <div className="text-sm text-blue-800">
                        <p className="font-medium mb-1">이 지역들은:</p>
                        <ul className="list-disc list-inside space-y-1 text-blue-700">
                          <li>URL 데이터관리에 등록되어 크롤링 대상입니다</li>
                          <li>현재 신청가능한 공고가 게시되어 있지 않습니다</li>
                          <li>크롤링 주기에 따라 새로운 공고가 등록될 수 있습니다</li>
                        </ul>
                      </div>
                    </div>
                  </div>
                </>
              )}
            </div>

            {/* Footer */}
            <div className="px-6 py-4 border-t border-gray-200 bg-gray-50">
              <button
                onClick={() => setShowUnannounceModal(false)}
                className="w-full px-4 py-2.5 bg-slate-600 hover:bg-slate-700 text-white rounded-lg font-medium transition-colors"
              >
                닫기
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
