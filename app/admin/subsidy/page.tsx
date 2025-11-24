'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
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
  const [announcements, setAnnouncements] = useState<SubsidyAnnouncement[]>([]);
  const [stats, setStats] = useState<SubsidyDashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedAnnouncement, setSelectedAnnouncement] = useState<SubsidyAnnouncement | null>(null);

  // 페이지네이션 상태
  const [pagination, setPagination] = useState({
    total: 0,
    hasMore: false,
    pageSize: 20,
  });

  // 필터 상태 (기본값: 관련 공고만 표시 - 75% 이상)
  const [filter, setFilter] = useState({
    status: 'all',
    isRelevant: 'true',  // 관련도 75% 이상만 표시
    search: '',
    page: 1,
  });

  // 공고 목록 로드
  const loadAnnouncements = useCallback(async () => {
    try {
      const params = new URLSearchParams({
        page: filter.page.toString(),
        pageSize: '20',
        ...(filter.status !== 'all' && { status: filter.status }),
        ...(filter.isRelevant !== 'all' && { isRelevant: filter.isRelevant }),
        ...(filter.search && { search: filter.search }),
        sortBy: 'published_at',
        sortOrder: 'desc',
      });

      const response = await fetch(`/api/subsidy-announcements?${params}`);
      const data = await response.json();

      if (data.success) {
        setAnnouncements(data.data.announcements);
        setPagination({
          total: data.data.total,
          hasMore: data.data.hasMore,
          pageSize: data.data.pageSize,
        });
      }
    } catch (error) {
      console.error('공고 로드 실패:', error);
    }
  }, [filter]);

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
      await Promise.all([loadAnnouncements(), loadStats()]);
      setLoading(false);
    };
    loadData();
  }, [loadAnnouncements, loadStats]);

  // 상태 업데이트
  const updateAnnouncementStatus = async (id: string, status: AnnouncementStatus) => {
    try {
      const response = await fetch('/api/subsidy-announcements', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, status }),
      });

      if (response.ok) {
        setAnnouncements(prev =>
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

  // 읽음 처리
  const markAsRead = async (announcement: SubsidyAnnouncement) => {
    if (announcement.is_read) return;

    try {
      const response = await fetch('/api/subsidy-announcements', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: announcement.id, is_read: true }),
      });

      const result = await response.json();

      if (result.success) {
        setAnnouncements(prev =>
          prev.map(a => (a.id === announcement.id ? { ...a, is_read: true } : a))
        );
        loadStats();
      } else {
        console.error('읽음 처리 실패:', result.error);
      }
    } catch (error) {
      console.error('읽음 처리 실패:', error);
    }
  };

  // 제목에서 지역명 추출 (예: [전북], [경기] 등)
  const extractRegionFromTitle = (title: string, fallback: string): string => {
    // 대괄호 패턴 매칭: [전북], [경기], [서울] 등
    const bracketMatch = title.match(/\[([^\]]+)\]/);
    if (bracketMatch) {
      const region = bracketMatch[1];
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
      return regionMap[region] || region;
    }
    return fallback;
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
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">공고 목록을 불러오는 중...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* 헤더 */}
      <header className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">
                지자체 보조금 공고 모니터링
              </h1>
              <p className="text-sm text-gray-500 mt-1">
                소규모 대기배출시설 IoT 지원사업
              </p>
            </div>
            <Link
              href="/admin"
              className="text-gray-600 hover:text-gray-900 text-sm"
            >
              ← 관리자 메뉴로
            </Link>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-6">
        {/* 통계 카드 */}
        {stats && (
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
            <div className="bg-white rounded-lg shadow p-4">
              <div className="text-sm text-gray-500">전체 공고</div>
              <div className="text-2xl font-bold text-gray-900">
                {stats.total_announcements}
              </div>
            </div>
            <div className="bg-white rounded-lg shadow p-4">
              <div className="text-sm text-gray-500">관련 공고</div>
              <div className="text-2xl font-bold text-blue-600">
                {stats.relevant_announcements}
              </div>
            </div>
            <div className="bg-white rounded-lg shadow p-4">
              <div className="text-sm text-gray-500">읽지 않음</div>
              <div className="text-2xl font-bold text-red-600">
                {stats.unread_count}
              </div>
            </div>
            <div className="bg-white rounded-lg shadow p-4">
              <div className="text-sm text-gray-500">이번 주 신규</div>
              <div className="text-2xl font-bold text-green-600">
                {stats.new_this_week}
              </div>
            </div>
            <div className="bg-white rounded-lg shadow p-4">
              <div className="text-sm text-gray-500">마감 임박 (7일)</div>
              <div className="text-2xl font-bold text-orange-600">
                {stats.expiring_soon}
              </div>
            </div>
          </div>
        )}

        {/* 필터 */}
        <div className="bg-white rounded-lg shadow mb-6 p-4">
          <div className="flex flex-wrap gap-4 items-center">
            <div>
              <label className="block text-xs text-gray-500 mb-1">상태</label>
              <select
                value={filter.status}
                onChange={e => setFilter(f => ({ ...f, status: e.target.value, page: 1 }))}
                className="border rounded px-3 py-1.5 text-sm"
              >
                <option value="all">전체</option>
                <option value="new">신규</option>
                <option value="reviewing">검토중</option>
                <option value="applied">신청완료</option>
                <option value="expired">마감</option>
              </select>
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">관련성</label>
              <select
                value={filter.isRelevant}
                onChange={e => setFilter(f => ({ ...f, isRelevant: e.target.value, page: 1 }))}
                className="border rounded px-3 py-1.5 text-sm"
              >
                <option value="true">관련 공고만 (75%↑)</option>
                <option value="all">전체</option>
                <option value="false">무관</option>
              </select>
            </div>
            <div className="flex-1">
              <label className="block text-xs text-gray-500 mb-1">검색</label>
              <input
                type="text"
                value={filter.search}
                onChange={e => setFilter(f => ({ ...f, search: e.target.value }))}
                onKeyDown={e => e.key === 'Enter' && loadAnnouncements()}
                placeholder="제목, 지역명으로 검색..."
                className="w-full border rounded px-3 py-1.5 text-sm"
              />
            </div>
            <button
              onClick={() => loadAnnouncements()}
              className="bg-blue-600 text-white px-4 py-1.5 rounded text-sm hover:bg-blue-700 mt-5"
            >
              검색
            </button>
          </div>
        </div>

        {/* 공고 목록 */}
        <div className="bg-white rounded-lg shadow">
          {announcements.length === 0 ? (
            <div className="p-12 text-center text-gray-500">
              <div className="text-4xl mb-4">📋</div>
              <p>조회된 공고가 없습니다.</p>
              <p className="text-sm mt-2">
                크롤러가 실행되면 공고가 자동으로 수집됩니다.
              </p>
            </div>
          ) : (
            <div className="divide-y">
              {announcements.map(announcement => {
                const daysRemaining = getDaysRemaining(announcement.application_period_end);
                const isUrgent = daysRemaining !== null && daysRemaining <= 7 && daysRemaining >= 0;

                return (
                  <div
                    key={announcement.id}
                    className={`p-4 hover:bg-gray-50 cursor-pointer transition-colors ${
                      !announcement.is_read ? 'bg-blue-50/50' : ''
                    }`}
                    onClick={() => {
                      setSelectedAnnouncement(announcement);
                      markAsRead(announcement);
                    }}
                  >
                    <div className="flex items-start gap-4">
                      {/* 읽지 않음 표시 */}
                      <div className="flex-shrink-0 pt-1">
                        {!announcement.is_read && (
                          <div className="w-2 h-2 bg-blue-600 rounded-full"></div>
                        )}
                      </div>

                      {/* 메인 콘텐츠 */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className={`text-xs px-2 py-0.5 rounded ${statusColors[announcement.status].bg} ${statusColors[announcement.status].text}`}>
                            {statusColors[announcement.status].label}
                          </span>
                          <span className="text-xs text-gray-500">
                            {extractRegionFromTitle(announcement.title, announcement.region_name)}
                          </span>
                          {isUrgent && (
                            <span className="text-xs px-2 py-0.5 rounded bg-red-100 text-red-700 font-medium">
                              D-{daysRemaining}
                            </span>
                          )}
                        </div>

                        <h3 className="font-medium text-gray-900 truncate">
                          {announcement.title}
                        </h3>

                        <div className="flex items-center gap-4 mt-2 text-xs text-gray-500">
                          {announcement.application_period_end && (
                            <span>
                              마감: {formatDate(announcement.application_period_end)}
                            </span>
                          )}
                          {announcement.budget && (
                            <span>예산: {announcement.budget}</span>
                          )}
                          {announcement.relevance_score && (
                            <span>
                              관련도: {Math.round(announcement.relevance_score * 100)}%
                            </span>
                          )}
                        </div>
                      </div>

                      {/* 게시일 */}
                      <div className="flex-shrink-0 text-xs text-gray-400">
                        {formatDate(announcement.published_at)}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* 페이지네이션 */}
          {pagination.total > 0 && (
            <div className="flex items-center justify-between border-t pt-4 mt-4">
              <div className="text-sm text-gray-600">
                총 <span className="font-medium">{pagination.total}</span>건 중{' '}
                <span className="font-medium">
                  {(filter.page - 1) * pagination.pageSize + 1}-
                  {Math.min(filter.page * pagination.pageSize, pagination.total)}
                </span>건 표시
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setFilter(f => ({ ...f, page: f.page - 1 }))}
                  disabled={filter.page <= 1}
                  className="px-3 py-1.5 text-sm border rounded hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  ← 이전
                </button>
                <span className="text-sm text-gray-600">
                  {filter.page} / {Math.ceil(pagination.total / pagination.pageSize)}
                </span>
                <button
                  onClick={() => setFilter(f => ({ ...f, page: f.page + 1 }))}
                  disabled={!pagination.hasMore}
                  className="px-3 py-1.5 text-sm border rounded hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  다음 →
                </button>
              </div>
            </div>
          )}
        </div>

        {/* 상세 모달 */}
        {selectedAnnouncement && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-hidden">
              <div className="p-4 border-b flex items-center justify-between">
                <h2 className="font-bold text-lg">공고 상세</h2>
                <button
                  onClick={() => setSelectedAnnouncement(null)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  ✕
                </button>
              </div>

              <div className="p-4 overflow-y-auto max-h-[calc(90vh-140px)]">
                <div className="mb-4">
                  <span className={`text-xs px-2 py-0.5 rounded ${statusColors[selectedAnnouncement.status].bg} ${statusColors[selectedAnnouncement.status].text}`}>
                    {statusColors[selectedAnnouncement.status].label}
                  </span>
                  <span className="text-sm text-gray-500 ml-2">
                    {extractRegionFromTitle(selectedAnnouncement.title, selectedAnnouncement.region_name)}
                  </span>
                </div>

                <h3 className="text-xl font-bold mb-4">
                  {selectedAnnouncement.title}
                </h3>

                <div className="grid grid-cols-2 gap-4 mb-4 text-sm">
                  <div className="bg-gray-50 rounded p-3">
                    <div className="text-gray-500 text-xs">신청기간</div>
                    <div className="font-medium">
                      {formatDate(selectedAnnouncement.application_period_start)} ~{' '}
                      {formatDate(selectedAnnouncement.application_period_end)}
                    </div>
                  </div>
                  <div className="bg-gray-50 rounded p-3">
                    <div className="text-gray-500 text-xs">예산</div>
                    <div className="font-medium">
                      {selectedAnnouncement.budget || '-'}
                    </div>
                  </div>
                </div>

                {selectedAnnouncement.target_description && (
                  <div className="mb-4">
                    <div className="text-sm text-gray-500 mb-1">지원대상</div>
                    <div className="bg-gray-50 rounded p-3 text-sm">
                      {selectedAnnouncement.target_description}
                    </div>
                  </div>
                )}

                {selectedAnnouncement.support_amount && (
                  <div className="mb-4">
                    <div className="text-sm text-gray-500 mb-1">지원금액</div>
                    <div className="bg-gray-50 rounded p-3 text-sm">
                      {selectedAnnouncement.support_amount}
                    </div>
                  </div>
                )}

                {selectedAnnouncement.keywords_matched && selectedAnnouncement.keywords_matched.length > 0 && (
                  <div className="mb-4">
                    <div className="text-sm text-gray-500 mb-1">매칭 키워드</div>
                    <div className="flex flex-wrap gap-1">
                      {selectedAnnouncement.keywords_matched.map((kw, i) => (
                        <span
                          key={i}
                          className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded"
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
                  className="inline-flex items-center gap-1 text-blue-600 hover:underline text-sm mb-4"
                >
                  원문 보기 →
                </a>
              </div>

              {/* 액션 버튼 */}
              <div className="p-4 border-t bg-gray-50">
                <div className="flex flex-wrap gap-2">
                  <span className="text-sm text-gray-500 mr-2">상태 변경:</span>
                  {(['new', 'reviewing', 'applied', 'expired', 'not_relevant'] as AnnouncementStatus[]).map(
                    status => (
                      <button
                        key={status}
                        onClick={() => updateAnnouncementStatus(selectedAnnouncement.id, status)}
                        className={`text-xs px-3 py-1 rounded border transition-colors ${
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
      </main>
    </div>
  );
}
