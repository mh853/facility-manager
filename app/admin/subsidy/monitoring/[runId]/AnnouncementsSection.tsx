'use client';

import { useState, useEffect } from 'react';

// ============================================================
// AnnouncementsSection Component
// ============================================================
// 목적: 특정 크롤링 실행에서 발견된 공고 목록 표시
// 필터링, 페이지네이션 지원
// ============================================================

interface AnnouncementItem {
  id: string;
  title: string;
  region_name: string;
  source_url: string;
  published_at: string | null;
  application_period_start: string | null;
  application_period_end: string | null;
  budget: string | null;
  support_amount: string | null;
  is_relevant: boolean;
  relevance_score: number | null;
  keywords_matched: string[];
  crawled_at: string;
}

interface PaginationInfo {
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
}

interface FilterState {
  show_relevant_only: boolean;
  show_ai_verified_only: boolean;
}

interface AnnouncementsSectionProps {
  runId: string;
}

export default function AnnouncementsSection({ runId }: AnnouncementsSectionProps) {
  const [announcements, setAnnouncements] = useState<AnnouncementItem[]>([]);
  const [pagination, setPagination] = useState<PaginationInfo>({
    total: 0,
    page: 1,
    page_size: 20,
    total_pages: 0,
  });
  const [filters, setFilters] = useState<FilterState>({
    show_relevant_only: false,
    show_ai_verified_only: false,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadAnnouncements();
  }, [runId, pagination.page, filters]);

  const loadAnnouncements = async () => {
    setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams({
        page: pagination.page.toString(),
        page_size: pagination.page_size.toString(),
        relevant_only: filters.show_relevant_only.toString(),
        ai_verified_only: filters.show_ai_verified_only.toString(),
      });

      const response = await fetch(
        `/api/subsidy-crawler/runs/${runId}/announcements?${params}`
      );

      if (!response.ok) {
        throw new Error(`Failed to fetch announcements: ${response.statusText}`);
      }

      const result = await response.json();

      if (result.success && result.data) {
        setAnnouncements(result.data.announcements);
        setPagination(result.data.pagination);
      } else {
        throw new Error(result.error || 'Unknown error');
      }
    } catch (err) {
      console.error('Failed to load announcements:', err);
      setError(err instanceof Error ? err.message : 'Failed to load announcements');
    } finally {
      setLoading(false);
    }
  };

  const toggleFilter = (filterName: keyof FilterState) => {
    setFilters(prev => ({
      ...prev,
      [filterName]: !prev[filterName],
    }));
    setPagination(prev => ({ ...prev, page: 1 })); // Reset to page 1 when filtering
  };

  const goToPage = (page: number) => {
    setPagination(prev => ({ ...prev, page }));
  };

  return (
    <div className="bg-white rounded-lg shadow overflow-hidden">
      {/* 헤더 */}
      <div className="px-6 py-4 border-b border-gray-200 bg-gray-50">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900">
            📋 발견된 공고 목록
          </h2>
          <div className="flex items-center gap-2">
            <button
              onClick={() => toggleFilter('show_relevant_only')}
              className={`px-3 py-1 rounded-md text-sm font-medium transition-colors ${
                filters.show_relevant_only
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
              }`}
            >
              {filters.show_relevant_only ? '✅' : '🔲'} 관련 공고만
            </button>
            <button
              onClick={() => toggleFilter('show_ai_verified_only')}
              className={`px-3 py-1 rounded-md text-sm font-medium transition-colors ${
                filters.show_ai_verified_only
                  ? 'bg-purple-600 text-white'
                  : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
              }`}
            >
              {filters.show_ai_verified_only ? '🤖' : '🔲'} AI 검증만
            </button>
            <span className="text-sm text-gray-600 ml-2">
              전체 {pagination.total}건
            </span>
          </div>
        </div>
      </div>

      {/* 공고 목록 */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-3"></div>
            <p className="text-gray-600 text-sm">공고 목록 로딩 중...</p>
          </div>
        </div>
      ) : error ? (
        <div className="flex items-center justify-center py-12">
          <div className="text-center">
            <p className="text-red-600 mb-2">⚠️ 오류 발생</p>
            <p className="text-gray-600 text-sm">{error}</p>
            <button
              onClick={loadAnnouncements}
              className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              다시 시도
            </button>
          </div>
        </div>
      ) : announcements.length === 0 ? (
        <div className="flex items-center justify-center py-12">
          <div className="text-center text-gray-500">
            <p className="text-lg mb-2">📭</p>
            <p>발견된 공고가 없습니다.</p>
            {(filters.show_relevant_only || filters.show_ai_verified_only) && (
              <p className="text-sm mt-2">필터를 해제하고 다시 시도해보세요.</p>
            )}
          </div>
        </div>
      ) : (
        <>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    공고 제목
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    지역
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    신청 기간
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    지원 금액
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    관련도
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    링크
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {announcements.map((announcement) => (
                  <AnnouncementRow key={announcement.id} announcement={announcement} />
                ))}
              </tbody>
            </table>
          </div>

          {/* 페이지네이션 */}
          {pagination.total_pages > 1 && (
            <div className="px-6 py-4 border-t border-gray-200 bg-gray-50">
              <div className="flex items-center justify-between">
                <div className="text-sm text-gray-700">
                  페이지 {pagination.page} / {pagination.total_pages} (전체 {pagination.total}건)
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => goToPage(pagination.page - 1)}
                    disabled={pagination.page === 1}
                    className="px-3 py-1 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    ← 이전
                  </button>
                  <button
                    onClick={() => goToPage(pagination.page + 1)}
                    disabled={pagination.page === pagination.total_pages}
                    className="px-3 py-1 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    다음 →
                  </button>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

// 개별 공고 행 컴포넌트
function AnnouncementRow({ announcement }: { announcement: AnnouncementItem }) {
  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return 'N/A';
    return new Date(dateStr).toLocaleDateString('ko-KR', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
  };

  const getRelevanceBadge = (isRelevant: boolean, score: number | null) => {
    if (!isRelevant) {
      return <span className="text-gray-500 text-xs">무관</span>;
    }

    if (score !== null && score >= 0.7) {
      return (
        <div className="flex items-center gap-1">
          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-purple-100 text-purple-800">
            🤖 AI {Math.round(score * 100)}%
          </span>
        </div>
      );
    }

    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800">
        ✅ 키워드
      </span>
    );
  };

  return (
    <tr className="hover:bg-gray-50 transition-colors">
      <td className="px-6 py-4">
        <div className="max-w-md">
          <div className="font-medium text-gray-900 text-sm">
            {announcement.title}
          </div>
          {announcement.keywords_matched.length > 0 && (
            <div className="mt-1 flex flex-wrap gap-1">
              {announcement.keywords_matched.slice(0, 3).map((keyword, idx) => (
                <span
                  key={idx}
                  className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-700"
                >
                  #{keyword}
                </span>
              ))}
              {announcement.keywords_matched.length > 3 && (
                <span className="text-xs text-gray-500">
                  +{announcement.keywords_matched.length - 3}
                </span>
              )}
            </div>
          )}
        </div>
      </td>
      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
        {announcement.region_name}
      </td>
      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
        {announcement.application_period_start && announcement.application_period_end ? (
          <div>
            {formatDate(announcement.application_period_start)} ~<br />
            {formatDate(announcement.application_period_end)}
          </div>
        ) : (
          'N/A'
        )}
      </td>
      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
        {announcement.support_amount || announcement.budget || 'N/A'}
      </td>
      <td className="px-6 py-4 whitespace-nowrap">
        {getRelevanceBadge(announcement.is_relevant, announcement.relevance_score)}
      </td>
      <td className="px-6 py-4 whitespace-nowrap text-sm">
        <a
          href={announcement.source_url}
          target="_blank"
          rel="noopener noreferrer"
          className="text-blue-600 hover:text-blue-800 hover:underline"
        >
          🔗 원문
        </a>
      </td>
    </tr>
  );
}
