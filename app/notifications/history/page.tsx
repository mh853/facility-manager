'use client';

import React, { useState, useEffect } from 'react';
import {
  Bell,
  Search,
  Filter,
  Clock,
  User,
  AlertCircle,
  CheckCircle,
  ArrowLeft,
  Calendar,
  Tag,
  ChevronDown,
  RefreshCw
} from 'lucide-react';
import Link from 'next/link';

interface HistoryNotification {
  id: string;
  title: string;
  message: string;
  type_category: string;
  priority: 'low' | 'medium' | 'high' | 'critical';
  related_url?: string;
  user_id: string;
  created_by_name?: string;
  notification_created_at: string;
  read_at: string | null;
  archived_at: string;
  source_type: 'global' | 'task';
  task_id?: string;
  business_name?: string;
}

interface HistoryStats {
  totalCount: number;
  currentPage: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
}

interface TypeBreakdown {
  global?: number;
  task?: number;
}

export default function NotificationHistoryPage() {
  const [notifications, setNotifications] = useState<HistoryNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [stats, setStats] = useState<HistoryStats>({
    totalCount: 0,
    currentPage: 1,
    totalPages: 1,
    hasNext: false,
    hasPrev: false
  });
  const [typeBreakdown, setTypeBreakdown] = useState<TypeBreakdown>({});

  // 필터 상태
  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState<'all' | 'global' | 'task'>('all');
  const [priorityFilter, setPriorityFilter] = useState<'all' | 'low' | 'medium' | 'high' | 'critical'>('all');
  const [daysFilter, setDaysFilter] = useState(30);
  const [currentPage, setCurrentPage] = useState(1);

  // 알림 히스토리 로드
  const loadNotificationHistory = async (page: number = 1) => {
    try {
      setLoading(true);
      setError(null);

      const params = new URLSearchParams({
        page: page.toString(),
        limit: '20',
        days: daysFilter.toString()
      });

      if (searchTerm.trim()) {
        params.set('search', searchTerm.trim());
      }
      if (typeFilter !== 'all') {
        params.set('type', typeFilter);
      }
      if (priorityFilter !== 'all') {
        params.set('priority', priorityFilter);
      }

      const response = await fetch(`/api/notifications/history?${params}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('auth_token') || localStorage.getItem('supabase_auth_token') || ''}`
        }
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();

      if (data.success) {
        setNotifications(data.history || []);
        setStats(data.stats || stats);
        setTypeBreakdown(data.typeBreakdown || {});
        setCurrentPage(page);
      } else {
        throw new Error(data.error || '히스토리 로드 실패');
      }

    } catch (err: any) {
      console.error('히스토리 로드 오류:', err);
      setError(err.message || '히스토리를 불러오는데 실패했습니다');
    } finally {
      setLoading(false);
    }
  };

  // 초기 로드
  useEffect(() => {
    loadNotificationHistory(1);
  }, [searchTerm, typeFilter, priorityFilter, daysFilter]);

  // 시간 포맷팅
  const formatTime = (timestamp: string) => {
    const date = new Date(timestamp);
    return date.toLocaleDateString('ko-KR', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  // 우선순위별 스타일
  const getPriorityStyle = (priority: string) => {
    switch (priority) {
      case 'critical':
        return 'bg-red-50 border-l-4 border-red-500';
      case 'high':
        return 'bg-orange-50 border-l-4 border-orange-500';
      case 'medium':
        return 'bg-blue-50 border-l-4 border-blue-500';
      case 'low':
      default:
        return 'bg-gray-50 border-l-4 border-gray-300';
    }
  };

  // 카테고리 아이콘
  const getCategoryIcon = (category: string, sourceType: string) => {
    if (sourceType === 'task') {
      return <User className="w-4 h-4 text-blue-500" />;
    }

    switch (category) {
      case 'system_update':
        return <AlertCircle className="w-4 h-4 text-purple-500" />;
      case 'security_alert':
        return <AlertCircle className="w-4 h-4 text-red-500" />;
      default:
        return <Bell className="w-4 h-4 text-gray-400" />;
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* 헤더 */}
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center space-x-4">
              <Link
                href="/"
                className="flex items-center text-gray-600 hover:text-gray-900"
              >
                <ArrowLeft className="w-5 h-5 mr-2" />
                <span>돌아가기</span>
              </Link>
              <div className="h-6 border-l border-gray-300" />
              <div className="flex items-center space-x-2">
                <Clock className="w-5 h-5 text-blue-600" />
                <h1 className="text-xl font-semibold text-gray-900">알림 히스토리</h1>
              </div>
            </div>
            <button
              onClick={() => loadNotificationHistory(currentPage)}
              className="flex items-center space-x-2 px-3 py-2 text-sm text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg"
            >
              <RefreshCw className="w-4 h-4" />
              <span>새로고침</span>
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* 통계 요약 */}
        <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-gray-900">{stats.totalCount}</div>
              <div className="text-sm text-gray-500">전체 알림</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-600">{typeBreakdown.global || 0}</div>
              <div className="text-sm text-gray-500">시스템 알림</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-green-600">{typeBreakdown.task || 0}</div>
              <div className="text-sm text-gray-500">업무 알림</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-purple-600">{daysFilter}</div>
              <div className="text-sm text-gray-500">일 이내</div>
            </div>
          </div>
        </div>

        {/* 필터 */}
        <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
            {/* 검색 */}
            <div className="lg:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-2">검색</label>
              <div className="relative">
                <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="제목, 내용, 업체명으로 검색..."
                  className="pl-10 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
            </div>

            {/* 유형 필터 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">유형</label>
              <select
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value as any)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="all">전체</option>
                <option value="global">시스템</option>
                <option value="task">업무</option>
              </select>
            </div>

            {/* 우선순위 필터 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">우선순위</label>
              <select
                value={priorityFilter}
                onChange={(e) => setPriorityFilter(e.target.value as any)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="all">전체</option>
                <option value="critical">긴급</option>
                <option value="high">높음</option>
                <option value="medium">보통</option>
                <option value="low">낮음</option>
              </select>
            </div>

            {/* 기간 필터 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">기간</label>
              <select
                value={daysFilter}
                onChange={(e) => setDaysFilter(Number(e.target.value))}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value={7}>7일</option>
                <option value={30}>30일</option>
                <option value={90}>90일</option>
                <option value={365}>1년</option>
              </select>
            </div>
          </div>
        </div>

        {/* 알림 목록 */}
        <div className="bg-white rounded-lg shadow-sm">
          {loading ? (
            <div className="p-8 text-center">
              <RefreshCw className="w-8 h-8 mx-auto mb-4 text-gray-400 animate-spin" />
              <p className="text-gray-500">히스토리를 불러오는 중...</p>
            </div>
          ) : error ? (
            <div className="p-8 text-center">
              <AlertCircle className="w-8 h-8 mx-auto mb-4 text-red-500" />
              <p className="text-red-600 mb-4">{error}</p>
              <button
                onClick={() => loadNotificationHistory(currentPage)}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                다시 시도
              </button>
            </div>
          ) : notifications.length === 0 ? (
            <div className="p-8 text-center">
              <Clock className="w-8 h-8 mx-auto mb-4 text-gray-400" />
              <p className="text-gray-500">선택한 기간에 알림 히스토리가 없습니다</p>
            </div>
          ) : (
            <>
              <div className="divide-y divide-gray-200">
                {notifications.map((notification) => (
                  <div
                    key={notification.id}
                    className={`p-6 hover:bg-gray-50 ${getPriorityStyle(notification.priority)}`}
                  >
                    <div className="flex items-start space-x-4">
                      <div className="flex-shrink-0 mt-1">
                        {getCategoryIcon(notification.type_category, notification.source_type)}
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <h3 className="text-sm font-medium text-gray-900">
                              {notification.title}
                            </h3>
                            <p className="text-sm text-gray-600 mt-1 line-clamp-2">
                              {notification.message}
                            </p>

                            {/* 메타데이터 */}
                            <div className="flex items-center space-x-4 mt-3 text-xs text-gray-500">
                              <div className="flex items-center space-x-1">
                                <Calendar className="w-3 h-3" />
                                <span>{formatTime(notification.notification_created_at)}</span>
                              </div>

                              {notification.read_at && (
                                <div className="flex items-center space-x-1">
                                  <CheckCircle className="w-3 h-3 text-green-500" />
                                  <span>읽음: {formatTime(notification.read_at)}</span>
                                </div>
                              )}

                              <div className="flex items-center space-x-1">
                                <Tag className="w-3 h-3" />
                                <span className={`px-2 py-0.5 rounded-full text-xs ${
                                  notification.source_type === 'task'
                                    ? 'bg-blue-100 text-blue-800'
                                    : 'bg-gray-100 text-gray-800'
                                }`}>
                                  {notification.source_type === 'task' ? '업무' : '시스템'}
                                </span>
                              </div>

                              {notification.priority === 'critical' && (
                                <span className="px-2 py-0.5 bg-red-100 text-red-800 rounded-full text-xs">
                                  긴급
                                </span>
                              )}

                              {notification.business_name && (
                                <div className="flex items-center space-x-1">
                                  <User className="w-3 h-3" />
                                  <span>{notification.business_name}</span>
                                </div>
                              )}
                            </div>
                          </div>

                          {notification.related_url && (
                            <a
                              href={notification.related_url}
                              className="ml-4 flex items-center text-blue-600 hover:text-blue-800 text-sm"
                            >
                              <span>보기</span>
                              <ArrowLeft className="w-4 h-4 ml-1 rotate-180" />
                            </a>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* 페이지네이션 */}
              {stats.totalPages > 1 && (
                <div className="px-6 py-4 border-t border-gray-200 flex items-center justify-between">
                  <div className="text-sm text-gray-500">
                    {stats.totalCount}개 중 {((currentPage - 1) * 20) + 1}-{Math.min(currentPage * 20, stats.totalCount)}번째
                  </div>

                  <div className="flex space-x-2">
                    <button
                      onClick={() => loadNotificationHistory(currentPage - 1)}
                      disabled={!stats.hasPrev}
                      className="px-3 py-1 text-sm border border-gray-300 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
                    >
                      이전
                    </button>

                    <span className="px-3 py-1 text-sm bg-blue-600 text-white rounded-lg">
                      {currentPage} / {stats.totalPages}
                    </span>

                    <button
                      onClick={() => loadNotificationHistory(currentPage + 1)}
                      disabled={!stats.hasNext}
                      className="px-3 py-1 text-sm border border-gray-300 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
                    >
                      다음
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}