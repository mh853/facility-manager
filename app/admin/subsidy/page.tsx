'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import AdminLayout from '@/components/ui/AdminLayout';
import UrlDataManager from '@/components/admin/UrlDataManager';
import { useAuth } from '@/contexts/AuthContext';
import type { SubsidyAnnouncement, SubsidyDashboardStats, AnnouncementStatus } from '@/types/subsidy';

// 상태별 색상
const statusColors: Record<AnnouncementStatus, { bg: string; text: string; label: string }> = {
  new: { bg: 'bg-blue-100', text: 'text-blue-800', label: '신규' },
  reviewing: { bg: 'bg-yellow-100', text: 'text-yellow-800', label: '검토중' },
  applied: { bg: 'bg-green-100', text: 'text-green-800', label: '신청완료' },
  expired: { bg: 'bg-gray-100', text: 'text-gray-600', label: '마감' },
  not_relevant: { bg: 'bg-red-100', text: 'text-red-800', label: '무관' },
};

export default function SubsidyAnnouncementsPage() {
  const { user, loading: authLoading } = useAuth();
  const [allAnnouncements, setAllAnnouncements] = useState<SubsidyAnnouncement[]>([]);
  const [stats, setStats] = useState<SubsidyDashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedAnnouncement, setSelectedAnnouncement] = useState<SubsidyAnnouncement | null>(null);

  // 필터 상태 (기본값: 관련 공고만 표시 - 75% 이상)
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterRelevant, setFilterRelevant] = useState('true');
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 20;

  // 디버깅: 사용자 정보 출력
  useEffect(() => {
    console.log('🔍 [Subsidy] User Info:', {
      user,
      permission_level: user?.permission_level,
      authLoading,
      canSeeUrlManager: user && user.permission_level >= 4
    });
  }, [user, authLoading]);

  // 전체 공고 목록 로드 (필터 없이)
  const loadAllAnnouncements = useCallback(async () => {
    try {
      const params = new URLSearchParams({
        page: '1',
        pageSize: '1000', // 충분히 큰 숫자로 전체 로드
        sortBy: 'published_at',
        sortOrder: 'desc',
      });

      const response = await fetch(`/api/subsidy-announcements?${params}`);
      const data = await response.json();

      if (data.success) {
        setAllAnnouncements(data.data.announcements);
      }
    } catch (error) {
      console.error('공고 로드 실패:', error);
    }
  }, []);

  // 통계 로드
  const loadStats = useCallback(async () => {
    try {
      const response = await fetch('/api/subsidy-announcements/stats');
      const data = await response.json();

      if (data.success) {
        setStats(data.data);
      }
    } catch (error) {
      console.error('통계 로드 실패:', error);
    }
  }, []);

  // 초기 로드
  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      await Promise.all([loadAllAnnouncements(), loadStats()]);
      setLoading(false);
    };
    loadData();
  }, [loadAllAnnouncements, loadStats]);

  // 클라이언트 사이드 필터링 (useMemo로 자동 적용)
  const filteredAnnouncements = useMemo(() => {
    let filtered = allAnnouncements;

    // 상태 필터
    if (filterStatus !== 'all') {
      filtered = filtered.filter(a => a.status === filterStatus);
    }

    // 관련성 필터
    if (filterRelevant === 'true') {
      filtered = filtered.filter(a => a.relevance_score && a.relevance_score >= 0.75);
    } else if (filterRelevant === 'false') {
      filtered = filtered.filter(a => !a.relevance_score || a.relevance_score < 0.75);
    }

    // 검색어 필터 (실시간)
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(a => {
        const searchableText = [
          a.title,
          a.region_name,
          a.target_description,
          a.support_amount,
          ...(a.keywords_matched || [])
        ].join(' ').toLowerCase();
        return searchableText.includes(query);
      });
    }

    return filtered;
  }, [allAnnouncements, filterStatus, filterRelevant, searchQuery]);

  // 페이지네이션 적용
  const paginatedAnnouncements = useMemo(() => {
    const startIndex = (currentPage - 1) * pageSize;
    const endIndex = startIndex + pageSize;
    return filteredAnnouncements.slice(startIndex, endIndex);
  }, [filteredAnnouncements, currentPage, pageSize]);

  // 페이지네이션 정보
  const totalPages = Math.ceil(filteredAnnouncements.length / pageSize);
  const hasMore = currentPage < totalPages;

  // 상태 업데이트
  const updateAnnouncementStatus = async (id: string, status: AnnouncementStatus) => {
    try {
      const response = await fetch('/api/subsidy-announcements', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, status }),
      });

      if (response.ok) {
        setAllAnnouncements(prev =>
          prev.map(a => (a.id === id ? { ...a, status } : a))
        );
        if (selectedAnnouncement?.id === id) {
          setSelectedAnnouncement(prev => prev ? { ...prev, status } : null);
        }
        loadStats();
      }
    } catch (error) {
      console.error('상태 업데이트 실패:', error);
    }
  };

  // 읽음 처리 (낙관적 업데이트)
  const markAsRead = async (announcement: SubsidyAnnouncement) => {
    if (announcement.is_read) return;

    // 낙관적 업데이트: UI 먼저 업데이트
    setAllAnnouncements(prev =>
      prev.map(a => (a.id === announcement.id ? { ...a, is_read: true } : a))
    );

    // 통계도 즉시 업데이트 (읽지 않은 수 -1)
    setStats(prev => prev ? { ...prev, unread_count: Math.max(0, prev.unread_count - 1) } : prev);

    try {
      const response = await fetch('/api/subsidy-announcements', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: announcement.id, is_read: true }),
      });

      const result = await response.json();

      if (!result.success) {
        // 실패 시 롤백
        console.error('읽음 처리 실패:', result.error);
        setAllAnnouncements(prev =>
          prev.map(a => (a.id === announcement.id ? { ...a, is_read: false } : a))
        );
        setStats(prev => prev ? { ...prev, unread_count: prev.unread_count + 1 } : prev);
      }
    } catch (error) {
      // 에러 시 롤백
      console.error('읽음 처리 실패:', error);
      setAllAnnouncements(prev =>
        prev.map(a => (a.id === announcement.id ? { ...a, is_read: false } : a))
      );
      setStats(prev => prev ? { ...prev, unread_count: prev.unread_count + 1 } : prev);
    }
  };

  // 제목에서 실제 대상 지역명 추출
  // 패턴: [출처지역] [대상지역] 제목... 또는 [대상지역] 제목...
  // 첫 번째 대괄호가 광역시/특별시면 출처이므로 두 번째 대괄호 사용
  const extractRegionFromTitle = (title: string, fallback: string): string => {
    // 모든 대괄호 내용 추출
    const bracketMatches = title.match(/\[([^\]]+)\]/g);
    if (!bracketMatches || bracketMatches.length === 0) {
      return fallback;
    }

    // 지역명 매핑 (약어 → 전체 지역명)
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

    // 출처 사이트 패턴 (이것들은 건너뛰어야 함)
    const sourcePatterns = [
      '서울특별시', '부산광역시', '대구광역시', '인천광역시',
      '광주광역시', '대전광역시', '울산광역시', '세종특별자치시',
      '경기도', '강원', '충북', '충남', '전북', '전남', '경북', '경남', '제주'
    ];

    // 광역시/특별시/도 전체 이름 패턴 (출처로 사용되는 경우가 많음)
    const fullNameSourcePatterns = [
      /^서울특별시$/,
      /^부산광역시$/,
      /^대구광역시$/,
      /^인천광역시$/,
      /^광주광역시$/,
      /^대전광역시$/,
      /^울산광역시$/,
      /^세종특별자치시$/,
    ];

    // 대괄호 내용들을 순회하며 실제 대상 지역 찾기
    const extractedRegions = bracketMatches.map(m => m.replace(/[\[\]]/g, ''));

    // 대괄호가 2개 이상이고 첫 번째가 광역시/특별시 전체명이면 두 번째 사용
    if (extractedRegions.length >= 2) {
      const firstRegion = extractedRegions[0];
      const isFirstSourcePattern = fullNameSourcePatterns.some(p => p.test(firstRegion));

      if (isFirstSourcePattern) {
        // 첫 번째는 출처, 두 번째가 실제 대상 지역
        const targetRegion = extractedRegions[1];
        return regionMap[targetRegion] || targetRegion;
      }
    }

    // 대괄호가 1개이거나 첫 번째가 출처가 아니면 첫 번째 사용
    const region = extractedRegions[0];
    return regionMap[region] || region;
  };

  // 타이틀에서 출처 지역 대괄호 제거
  // 예: "[서울특별시] [전북] 고창군..." → "[전북] 고창군..."
  const cleanTitle = (title: string): string => {
    // 광역시/특별시 전체 이름 패턴 (출처로 사용되는 경우)
    const sourcePatterns = [
      /^\[서울특별시\]\s*/,
      /^\[부산광역시\]\s*/,
      /^\[대구광역시\]\s*/,
      /^\[인천광역시\]\s*/,
      /^\[광주광역시\]\s*/,
      /^\[대전광역시\]\s*/,
      /^\[울산광역시\]\s*/,
      /^\[세종특별자치시\]\s*/,
    ];

    // 출처 패턴으로 시작하면 제거
    for (const pattern of sourcePatterns) {
      if (pattern.test(title)) {
        return title.replace(pattern, '');
      }
    }
    return title;
  };

  // 날짜 포맷
  const formatDate = (dateStr?: string) => {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleDateString('ko-KR', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  // D-day 계산
  const getDaysRemaining = (endDate?: string) => {
    if (!endDate) return null;
    const end = new Date(endDate);
    const today = new Date();
    const diff = Math.ceil((end.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    return diff;
  };

  if (loading) {
    return (
      <AdminLayout
        title="보조금 공고 모니터링"
        description="IoT 지원사업 관련 공고를 확인하세요"
      >
        <div className="flex items-center justify-center py-8 sm:py-12">
          <div className="text-center">
            <div className="animate-spin rounded-full h-10 w-10 sm:h-12 sm:w-12 border-b-2 border-blue-600 mx-auto"></div>
            <p className="mt-3 sm:mt-4 text-sm sm:text-base text-gray-600">공고 목록을 불러오는 중...</p>
          </div>
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout
      title="보조금 공고 모니터링"
      description="IoT 지원사업 관련 공고를 확인하세요"
    >
      <div className="space-y-6">
        {/* 통계 카드 */}
        {stats && (
          <div className="grid grid-cols-2 md:grid-cols-5 gap-2 sm:gap-3 md:gap-3 mb-4 sm:mb-6">
            <div className="bg-white rounded-md md:rounded-lg shadow p-2 sm:p-3 md:p-3">
              <div className="text-xs sm:text-xs text-gray-500">전체 공고</div>
              <div className="text-base sm:text-lg md:text-xl font-bold text-gray-900">
                {stats.total_announcements}
              </div>
            </div>
            <div className="bg-white rounded-md md:rounded-lg shadow p-2 sm:p-3 md:p-3">
              <div className="text-xs sm:text-xs text-gray-500">관련 공고</div>
              <div className="text-base sm:text-lg md:text-xl font-bold text-blue-600">
                {stats.relevant_announcements}
              </div>
            </div>
            <div className="bg-white rounded-md md:rounded-lg shadow p-2 sm:p-3 md:p-3">
              <div className="text-xs sm:text-xs text-gray-500">읽지 않음</div>
              <div className="text-base sm:text-lg md:text-xl font-bold text-red-600">
                {stats.unread_count}
              </div>
            </div>
            <div className="bg-white rounded-md md:rounded-lg shadow p-2 sm:p-3 md:p-3">
              <div className="text-xs sm:text-xs text-gray-500">이번 주 신규</div>
              <div className="text-base sm:text-lg md:text-xl font-bold text-green-600">
                {stats.new_this_week}
              </div>
            </div>
            <div className="bg-white rounded-md md:rounded-lg shadow p-2 sm:p-3 md:p-3">
              <div className="text-xs sm:text-xs text-gray-500">마감 임박 (7일)</div>
              <div className="text-base sm:text-lg md:text-xl font-bold text-orange-600">
                {stats.expiring_soon}
              </div>
            </div>
          </div>
        )}

        {/* URL 데이터 관리 - 권한 4(시스템 관리자)만 접근 가능 */}
        {!authLoading && user && user.permission_level >= 4 && (
          <UrlDataManager onUploadComplete={loadStats} user={user} />
        )}

        {/* 디버깅: 권한 정보 표시 (개발 환경에서만) */}
        {process.env.NODE_ENV === 'development' && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-md p-2 mb-4 text-xs">
            <strong>🔍 권한 디버그:</strong>
            {authLoading ? ' 로딩 중...' : (
              user ? (
                <>
                  {' '}사용자 레벨: {user.permission_level} |
                  URL 관리 접근: {user.permission_level >= 4 ? '✅ 가능' : '❌ 불가능'}
                </>
              ) : ' ⚠️ 사용자 정보 없음'
            )}
          </div>
        )}

        {/* 필터 */}
        <div className="bg-white rounded-md md:rounded-lg shadow mb-4 sm:mb-6 p-2 sm:p-3 md:p-3">
          <div className="flex flex-wrap gap-2 sm:gap-3 items-center">
            <div>
              <label className="block text-[10px] sm:text-xs text-gray-500 mb-1">상태</label>
              <select
                value={filterStatus}
                onChange={e => {
                  setFilterStatus(e.target.value);
                  setCurrentPage(1);
                }}
                className="border rounded px-2 sm:px-3 py-1 sm:py-1.5 text-xs sm:text-sm"
              >
                <option value="all">전체</option>
                <option value="new">신규</option>
                <option value="reviewing">검토중</option>
                <option value="applied">신청완료</option>
                <option value="expired">마감</option>
              </select>
            </div>
            <div>
              <label className="block text-[10px] sm:text-xs text-gray-500 mb-1">관련성</label>
              <select
                value={filterRelevant}
                onChange={e => {
                  setFilterRelevant(e.target.value);
                  setCurrentPage(1);
                }}
                className="border rounded px-2 sm:px-3 py-1 sm:py-1.5 text-xs sm:text-sm"
              >
                <option value="true">관련 공고만 (75%↑)</option>
                <option value="all">전체</option>
                <option value="false">무관</option>
              </select>
            </div>
            <div className="flex-1">
              <label className="block text-[10px] sm:text-xs text-gray-500 mb-1">검색 (실시간 필터링)</label>
              <input
                type="text"
                value={searchQuery}
                onChange={e => {
                  setSearchQuery(e.target.value);
                  setCurrentPage(1);
                }}
                placeholder="제목, 지역명으로 검색..."
                className="w-full border rounded px-2 sm:px-3 py-1 sm:py-1.5 text-xs sm:text-sm"
              />
            </div>
          </div>
        </div>

        {/* 공고 목록 */}
        <div className="bg-white rounded-md md:rounded-lg shadow">
          {paginatedAnnouncements.length === 0 ? (
            <div className="p-8 sm:p-12 text-center text-gray-500">
              <div className="text-3xl sm:text-4xl mb-3 sm:mb-4">📋</div>
              <p className="text-sm sm:text-base">조회된 공고가 없습니다.</p>
              <p className="text-xs sm:text-sm mt-2">
                {searchQuery || filterStatus !== 'all' || filterRelevant !== 'true'
                  ? '필터 조건을 변경해보세요.'
                  : '크롤러가 실행되면 공고가 자동으로 수집됩니다.'}
              </p>
            </div>
          ) : (
            <div className="divide-y">
              {paginatedAnnouncements.map(announcement => {
                const daysRemaining = getDaysRemaining(announcement.application_period_end);
                const isUrgent = daysRemaining !== null && daysRemaining <= 7 && daysRemaining >= 0;

                return (
                  <div
                    key={`${announcement.id}-${announcement.is_read}`}
                    className={`p-2 sm:p-3 md:p-3 hover:bg-gray-50 cursor-pointer transition-colors ${
                      !announcement.is_read ? 'bg-blue-50/50' : ''
                    }`}
                    onClick={() => {
                      setSelectedAnnouncement(announcement);
                      markAsRead(announcement);
                    }}
                  >
                    <div className="flex items-start gap-2 sm:gap-3">
                      {/* 읽지 않음 표시 */}
                      <div className="flex-shrink-0 pt-1">
                        {!announcement.is_read && (
                          <div className="w-1.5 h-1.5 sm:w-2 sm:h-2 bg-blue-600 rounded-full"></div>
                        )}
                      </div>

                      {/* 메인 콘텐츠 */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1 sm:gap-2 mb-0.5 sm:mb-1">
                          <span className={`text-[10px] sm:text-xs px-1.5 sm:px-2 py-0.5 rounded ${statusColors[announcement.status].bg} ${statusColors[announcement.status].text}`}>
                            {statusColors[announcement.status].label}
                          </span>
                          <span className="text-[10px] sm:text-xs text-gray-500">
                            {extractRegionFromTitle(announcement.title, announcement.region_name)}
                          </span>
                          {isUrgent && (
                            <span className="text-[10px] sm:text-xs px-1.5 sm:px-2 py-0.5 rounded bg-red-100 text-red-700 font-medium">
                              D-{daysRemaining}
                            </span>
                          )}
                        </div>

                        <h3 className="font-medium text-xs sm:text-sm text-gray-900 truncate">
                          {cleanTitle(announcement.title)}
                        </h3>

                        <div className="flex items-center gap-2 sm:gap-4 mt-1 sm:mt-2 text-[10px] sm:text-xs text-gray-500">
                          {announcement.application_period_end && (
                            <span>
                              마감: {formatDate(announcement.application_period_end)}
                            </span>
                          )}
                          {announcement.budget && (
                            <span className="hidden sm:inline">예산: {announcement.budget}</span>
                          )}
                          {announcement.relevance_score && (
                            <span>
                              관련도: {Math.round(announcement.relevance_score * 100)}%
                            </span>
                          )}
                        </div>
                      </div>

                      {/* 게시일 */}
                      <div className="flex-shrink-0 text-[10px] sm:text-xs text-gray-400">
                        {formatDate(announcement.published_at)}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* 페이지네이션 */}
          {filteredAnnouncements.length > 0 && (
            <div className="flex items-center justify-between border-t pt-2 sm:pt-3 mt-2 sm:mt-3 px-2 sm:px-3 pb-2 sm:pb-3">
              <div className="text-xs sm:text-sm text-gray-600">
                총 <span className="font-medium">{filteredAnnouncements.length}</span>건 중{' '}
                <span className="font-medium">
                  {(currentPage - 1) * pageSize + 1}-
                  {Math.min(currentPage * pageSize, filteredAnnouncements.length)}
                </span>건 표시
              </div>
              <div className="flex items-center gap-1 sm:gap-2">
                <button
                  onClick={() => setCurrentPage(p => p - 1)}
                  disabled={currentPage <= 1}
                  className="px-2 sm:px-3 py-1 sm:py-1.5 text-xs sm:text-sm border rounded hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  ← 이전
                </button>
                <span className="text-xs sm:text-sm text-gray-600">
                  {currentPage} / {totalPages}
                </span>
                <button
                  onClick={() => setCurrentPage(p => p + 1)}
                  disabled={!hasMore}
                  className="px-2 sm:px-3 py-1 sm:py-1.5 text-xs sm:text-sm border rounded hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  다음 →
                </button>
              </div>
            </div>
          )}
        </div>

        {/* 상세 모달 */}
        {selectedAnnouncement && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-2 sm:p-4">
            <div className="bg-white rounded-md md:rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-hidden">
              <div className="p-2 sm:p-3 border-b flex items-center justify-between">
                <h2 className="font-bold text-sm sm:text-base md:text-lg">공고 상세</h2>
                <button
                  onClick={() => setSelectedAnnouncement(null)}
                  className="text-gray-400 hover:text-gray-600 text-lg sm:text-xl"
                >
                  ✕
                </button>
              </div>

              <div className="p-2 sm:p-3 md:p-4 overflow-y-auto max-h-[calc(90vh-140px)]">
                <div className="mb-3 sm:mb-4">
                  <span className={`text-[10px] sm:text-xs px-1.5 sm:px-2 py-0.5 rounded ${statusColors[selectedAnnouncement.status].bg} ${statusColors[selectedAnnouncement.status].text}`}>
                    {statusColors[selectedAnnouncement.status].label}
                  </span>
                  <span className="text-xs sm:text-sm text-gray-500 ml-2">
                    {extractRegionFromTitle(selectedAnnouncement.title, selectedAnnouncement.region_name)}
                  </span>
                </div>

                <h3 className="text-base sm:text-lg md:text-xl font-bold mb-3 sm:mb-4">
                  {cleanTitle(selectedAnnouncement.title)}
                </h3>

                <div className="grid grid-cols-2 gap-2 sm:gap-3 mb-3 sm:mb-4 text-xs sm:text-sm">
                  <div className="bg-gray-50 rounded p-2 sm:p-3">
                    <div className="text-gray-500 text-[10px] sm:text-xs">신청기간</div>
                    <div className="font-medium text-xs sm:text-sm">
                      {formatDate(selectedAnnouncement.application_period_start)} ~{' '}
                      {formatDate(selectedAnnouncement.application_period_end)}
                    </div>
                  </div>
                  <div className="bg-gray-50 rounded p-2 sm:p-3">
                    <div className="text-gray-500 text-[10px] sm:text-xs">예산</div>
                    <div className="font-medium text-xs sm:text-sm">
                      {selectedAnnouncement.budget || '-'}
                    </div>
                  </div>
                </div>

                {selectedAnnouncement.target_description && (
                  <div className="mb-3 sm:mb-4">
                    <div className="text-xs sm:text-sm text-gray-500 mb-1">지원대상</div>
                    <div className="bg-gray-50 rounded p-2 sm:p-3 text-xs sm:text-sm">
                      {selectedAnnouncement.target_description}
                    </div>
                  </div>
                )}

                {selectedAnnouncement.support_amount && (
                  <div className="mb-3 sm:mb-4">
                    <div className="text-xs sm:text-sm text-gray-500 mb-1">지원금액</div>
                    <div className="bg-gray-50 rounded p-2 sm:p-3 text-xs sm:text-sm">
                      {selectedAnnouncement.support_amount}
                    </div>
                  </div>
                )}

                {selectedAnnouncement.keywords_matched && selectedAnnouncement.keywords_matched.length > 0 && (
                  <div className="mb-3 sm:mb-4">
                    <div className="text-xs sm:text-sm text-gray-500 mb-1">매칭 키워드</div>
                    <div className="flex flex-wrap gap-1">
                      {selectedAnnouncement.keywords_matched.map((kw, i) => (
                        <span
                          key={i}
                          className="text-[10px] sm:text-xs bg-blue-100 text-blue-700 px-1.5 sm:px-2 py-0.5 rounded"
                        >
                          {kw}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                <a
                  href={selectedAnnouncement.source_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-blue-600 hover:underline text-xs sm:text-sm mb-3 sm:mb-4"
                >
                  원문 보기 →
                </a>
              </div>

              {/* 액션 버튼 */}
              <div className="p-2 sm:p-3 md:p-4 border-t bg-gray-50">
                <div className="flex flex-wrap gap-1 sm:gap-2">
                  <span className="text-xs sm:text-sm text-gray-500 mr-1 sm:mr-2">상태 변경:</span>
                  {(['new', 'reviewing', 'applied', 'expired', 'not_relevant'] as AnnouncementStatus[]).map(
                    status => (
                      <button
                        key={status}
                        onClick={() => updateAnnouncementStatus(selectedAnnouncement.id, status)}
                        className={`text-[10px] sm:text-xs px-2 sm:px-3 py-0.5 sm:py-1 rounded border transition-colors ${
                          selectedAnnouncement.status === status
                            ? `${statusColors[status].bg} ${statusColors[status].text} border-current`
                            : 'bg-white hover:bg-gray-100'
                        }`}
                      >
                        {statusColors[status].label}
                      </button>
                    )
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
