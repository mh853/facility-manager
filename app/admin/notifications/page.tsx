'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Bell,
  BellRing,
  Search,
  Filter,
  SortDesc,
  Check,
  Trash2,
  ExternalLink,
  Calendar,
  User,
  AlertTriangle,
  Info,
  CheckCircle,
  X,
  RefreshCw,
  Settings,
  ChevronDown,
  ChevronRight
} from 'lucide-react';
import { useNotification, notificationHelpers, Notification, NotificationCategory, NotificationPriority } from '@/contexts/NotificationContext';
import { useRouter } from 'next/navigation';

type FilterType = 'all' | 'unread' | 'read';
type SortType = 'newest' | 'oldest' | 'priority';

export default function NotificationsPage() {
  const {
    notifications,
    unreadCount,
    loading,
    markAsRead,
    markAllAsRead,
    deleteNotification,
    fetchNotifications,
    isConnected
  } = useNotification();

  const router = useRouter();

  // 상태 관리
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<FilterType>('all');
  const [sortType, setSortType] = useState<SortType>('newest');
  const [selectedCategories, setSelectedCategories] = useState<NotificationCategory[]>([]);
  const [selectedPriorities, setSelectedPriorities] = useState<NotificationPriority[]>([]);
  const [showFilters, setShowFilters] = useState(false);
  const [selectedNotifications, setSelectedNotifications] = useState<string[]>([]);
  const [actionLoading, setActionLoading] = useState<Record<string, boolean>>({});

  // 필터링된 알림 목록
  const filteredNotifications = useMemo(() => {
    let filtered = notifications;

    // 텍스트 검색
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(notification =>
        notification.title.toLowerCase().includes(query) ||
        notification.message.toLowerCase().includes(query) ||
        notification.createdByName?.toLowerCase().includes(query)
      );
    }

    // 읽음/안읽음 필터
    if (filterType === 'unread') {
      filtered = filtered.filter(notification => !notification.isRead);
    } else if (filterType === 'read') {
      filtered = filtered.filter(notification => notification.isRead);
    }

    // 카테고리 필터
    if (selectedCategories.length > 0) {
      filtered = filtered.filter(notification =>
        selectedCategories.includes(notification.category)
      );
    }

    // 우선순위 필터
    if (selectedPriorities.length > 0) {
      filtered = filtered.filter(notification =>
        selectedPriorities.includes(notification.priority)
      );
    }

    // 정렬
    filtered.sort((a, b) => {
      switch (sortType) {
        case 'oldest':
          return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
        case 'priority':
          const priorityOrder = { critical: 3, high: 2, medium: 1, low: 0 };
          return priorityOrder[b.priority] - priorityOrder[a.priority];
        case 'newest':
        default:
          return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      }
    });

    return filtered;
  }, [notifications, searchQuery, filterType, selectedCategories, selectedPriorities, sortType]);

  // 카테고리 토글
  const toggleCategory = useCallback((category: NotificationCategory) => {
    setSelectedCategories(prev =>
      prev.includes(category)
        ? prev.filter(c => c !== category)
        : [...prev, category]
    );
  }, []);

  // 우선순위 토글
  const togglePriority = useCallback((priority: NotificationPriority) => {
    setSelectedPriorities(prev =>
      prev.includes(priority)
        ? prev.filter(p => p !== priority)
        : [...prev, priority]
    );
  }, []);

  // 알림 선택 토글
  const toggleNotificationSelection = useCallback((notificationId: string) => {
    setSelectedNotifications(prev =>
      prev.includes(notificationId)
        ? prev.filter(id => id !== notificationId)
        : [...prev, notificationId]
    );
  }, []);

  // 전체 선택/해제
  const toggleSelectAll = useCallback(() => {
    if (selectedNotifications.length === filteredNotifications.length) {
      setSelectedNotifications([]);
    } else {
      setSelectedNotifications(filteredNotifications.map(n => n.id));
    }
  }, [selectedNotifications.length, filteredNotifications]);

  // 선택된 알림들을 읽음 처리
  const markSelectedAsRead = useCallback(async () => {
    if (selectedNotifications.length === 0) return;

    setActionLoading(prev => ({ ...prev, markSelected: true }));

    try {
      for (const notificationId of selectedNotifications) {
        const notification = notifications.find(n => n.id === notificationId);
        if (notification && !notification.isRead) {
          await markAsRead(notificationId);
        }
      }
      setSelectedNotifications([]);
    } catch (error) {
      console.error('선택된 알림 읽음 처리 실패:', error);
    } finally {
      setActionLoading(prev => ({ ...prev, markSelected: false }));
    }
  }, [selectedNotifications, notifications, markAsRead]);

  // 선택된 알림들 삭제
  const deleteSelectedNotifications = useCallback(async () => {
    if (selectedNotifications.length === 0) return;

    const confirmed = window.confirm(`선택된 ${selectedNotifications.length}개의 알림을 삭제하시겠습니까?`);
    if (!confirmed) return;

    setActionLoading(prev => ({ ...prev, deleteSelected: true }));

    try {
      for (const notificationId of selectedNotifications) {
        await deleteNotification(notificationId);
      }
      setSelectedNotifications([]);
    } catch (error) {
      console.error('선택된 알림 삭제 실패:', error);
    } finally {
      setActionLoading(prev => ({ ...prev, deleteSelected: false }));
    }
  }, [selectedNotifications, deleteNotification]);

  // 개별 알림 클릭 처리
  const handleNotificationClick = useCallback(async (notification: Notification) => {
    if (actionLoading[notification.id]) return;

    setActionLoading(prev => ({ ...prev, [notification.id]: true }));

    try {
      if (!notification.isRead) {
        await markAsRead(notification.id);
      }

      if (notification.relatedUrl) {
        router.push(notification.relatedUrl);
      }
    } catch (error) {
      console.error('알림 클릭 처리 실패:', error);
    } finally {
      setActionLoading(prev => ({ ...prev, [notification.id]: false }));
    }
  }, [markAsRead, router, actionLoading]);

  // 개별 알림 삭제
  const handleDeleteNotification = useCallback(async (notificationId: string, event: React.MouseEvent) => {
    event.stopPropagation();
    if (actionLoading[notificationId]) return;

    setActionLoading(prev => ({ ...prev, [notificationId]: true }));

    try {
      await deleteNotification(notificationId);
      setSelectedNotifications(prev => prev.filter(id => id !== notificationId));
    } catch (error) {
      console.error('알림 삭제 실패:', error);
    } finally {
      setActionLoading(prev => ({ ...prev, [notificationId]: false }));
    }
  }, [deleteNotification, actionLoading]);

  // 카테고리별 통계
  const categoryStats = useMemo(() => {
    const stats: Record<NotificationCategory, number> = {} as any;
    notifications.forEach(notification => {
      stats[notification.category] = (stats[notification.category] || 0) + 1;
    });
    return stats;
  }, [notifications]);

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* 헤더 */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-3">
                <Bell className="w-7 h-7 text-blue-600" />
                알림 관리
              </h1>
              <p className="mt-2 text-gray-600">
                시스템의 모든 알림을 확인하고 관리할 수 있습니다.
              </p>
            </div>

            <div className="flex items-center gap-3">
              {/* 연결 상태 */}
              <div className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm ${
                isConnected
                  ? 'bg-green-100 text-green-800'
                  : 'bg-red-100 text-red-800'
              }`}>
                {isConnected ? (
                  <>
                    <CheckCircle className="w-4 h-4" />
                    실시간 연결됨
                  </>
                ) : (
                  <>
                    <AlertTriangle className="w-4 h-4" />
                    연결 끊김
                  </>
                )}
              </div>

              {/* 새로고침 */}
              <button
                onClick={fetchNotifications}
                disabled={loading}
                className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors flex items-center gap-2 disabled:opacity-50"
              >
                <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                새로고침
              </button>

              {/* 설정 */}
              <button
                onClick={() => router.push('/admin/settings/notifications')}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2"
              >
                <Settings className="w-4 h-4" />
                설정
              </button>
            </div>
          </div>

          {/* 통계 */}
          <div className="mt-6 grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="bg-white p-4 rounded-lg border border-gray-200">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">전체 알림</p>
                  <p className="text-2xl font-bold text-gray-900">{notifications.length}</p>
                </div>
                <Bell className="w-8 h-8 text-gray-400" />
              </div>
            </div>

            <div className="bg-white p-4 rounded-lg border border-gray-200">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">읽지 않음</p>
                  <p className="text-2xl font-bold text-blue-600">{unreadCount}</p>
                </div>
                <BellRing className="w-8 h-8 text-blue-400" />
              </div>
            </div>

            <div className="bg-white p-4 rounded-lg border border-gray-200">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">오늘 알림</p>
                  <p className="text-2xl font-bold text-green-600">
                    {notifications.filter(n => {
                      const today = new Date();
                      const notifDate = new Date(n.createdAt);
                      return notifDate.toDateString() === today.toDateString();
                    }).length}
                  </p>
                </div>
                <Calendar className="w-8 h-8 text-green-400" />
              </div>
            </div>

            <div className="bg-white p-4 rounded-lg border border-gray-200">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">긴급 알림</p>
                  <p className="text-2xl font-bold text-red-600">
                    {notifications.filter(n => n.priority === 'critical').length}
                  </p>
                </div>
                <AlertTriangle className="w-8 h-8 text-red-400" />
              </div>
            </div>
          </div>
        </div>

        {/* 검색 및 필터 */}
        <div className="bg-white rounded-lg border border-gray-200 p-6 mb-6">
          <div className="flex flex-col lg:flex-row gap-4">
            {/* 검색 */}
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                <input
                  type="text"
                  placeholder="알림 제목, 내용, 발신자로 검색..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            {/* 필터 버튼들 */}
            <div className="flex items-center gap-2">
              {/* 읽음 상태 필터 */}
              <select
                value={filterType}
                onChange={(e) => setFilterType(e.target.value as FilterType)}
                className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="all">전체</option>
                <option value="unread">읽지 않음</option>
                <option value="read">읽음</option>
              </select>

              {/* 정렬 */}
              <select
                value={sortType}
                onChange={(e) => setSortType(e.target.value as SortType)}
                className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="newest">최신순</option>
                <option value="oldest">오래된순</option>
                <option value="priority">우선순위순</option>
              </select>

              {/* 고급 필터 토글 */}
              <button
                onClick={() => setShowFilters(!showFilters)}
                className="px-3 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors flex items-center gap-2"
              >
                <Filter className="w-4 h-4" />
                고급 필터
                {showFilters ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* 고급 필터 */}
          {showFilters && (
            <div className="mt-6 pt-6 border-t border-gray-200">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* 카테고리 필터 */}
                <div>
                  <h3 className="text-sm font-medium text-gray-900 mb-3">카테고리</h3>
                  <div className="space-y-2 max-h-40 overflow-y-auto">
                    {Object.keys(categoryStats).map(category => (
                      <label key={category} className="flex items-center">
                        <input
                          type="checkbox"
                          checked={selectedCategories.includes(category as NotificationCategory)}
                          onChange={() => toggleCategory(category as NotificationCategory)}
                          className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                        />
                        <span className="ml-2 text-sm text-gray-700 flex items-center gap-2">
                          <span>{notificationHelpers.getCategoryIcon(category as NotificationCategory)}</span>
                          {category}
                          <span className="text-gray-500">({categoryStats[category as NotificationCategory]})</span>
                        </span>
                      </label>
                    ))}
                  </div>
                </div>

                {/* 우선순위 필터 */}
                <div>
                  <h3 className="text-sm font-medium text-gray-900 mb-3">우선순위</h3>
                  <div className="space-y-2">
                    {(['critical', 'high', 'medium', 'low'] as NotificationPriority[]).map(priority => (
                      <label key={priority} className="flex items-center">
                        <input
                          type="checkbox"
                          checked={selectedPriorities.includes(priority)}
                          onChange={() => togglePriority(priority)}
                          className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                        />
                        <span className="ml-2 text-sm text-gray-700 flex items-center gap-2">
                          <span className={`px-2 py-1 text-xs rounded-full ${notificationHelpers.getPriorityColor(priority)}`}>
                            {priority === 'critical' ? '긴급' :
                             priority === 'high' ? '높음' :
                             priority === 'medium' ? '보통' : '낮음'}
                          </span>
                          ({notifications.filter(n => n.priority === priority).length})
                        </span>
                      </label>
                    ))}
                  </div>
                </div>
              </div>

              {/* 필터 초기화 */}
              <div className="mt-4 flex justify-end">
                <button
                  onClick={() => {
                    setSelectedCategories([]);
                    setSelectedPriorities([]);
                    setSearchQuery('');
                    setFilterType('all');
                    setSortType('newest');
                  }}
                  className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  필터 초기화
                </button>
              </div>
            </div>
          )}
        </div>

        {/* 벌크 액션 */}
        {selectedNotifications.length > 0 && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
            <div className="flex items-center justify-between">
              <span className="text-sm text-blue-800">
                {selectedNotifications.length}개의 알림이 선택됨
              </span>

              <div className="flex items-center gap-3">
                <button
                  onClick={markSelectedAsRead}
                  disabled={actionLoading.markSelected}
                  className="px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm flex items-center gap-2 disabled:opacity-50"
                >
                  {actionLoading.markSelected ? (
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <Check className="w-4 h-4" />
                  )}
                  읽음 처리
                </button>

                <button
                  onClick={deleteSelectedNotifications}
                  disabled={actionLoading.deleteSelected}
                  className="px-3 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors text-sm flex items-center gap-2 disabled:opacity-50"
                >
                  {actionLoading.deleteSelected ? (
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <Trash2 className="w-4 h-4" />
                  )}
                  삭제
                </button>

                <button
                  onClick={() => setSelectedNotifications([])}
                  className="px-3 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors text-sm"
                >
                  선택 해제
                </button>
              </div>
            </div>
          </div>
        )}

        {/* 알림 목록 */}
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
          {/* 헤더 */}
          <div className="px-6 py-4 border-b border-gray-200 bg-gray-50">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={selectedNotifications.length === filteredNotifications.length && filteredNotifications.length > 0}
                    onChange={toggleSelectAll}
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="ml-2 text-sm text-gray-700">전체 선택</span>
                </label>

                {unreadCount > 0 && (
                  <button
                    onClick={markAllAsRead}
                    className="text-sm text-blue-600 hover:text-blue-700 font-medium"
                  >
                    모든 알림 읽음 처리
                  </button>
                )}
              </div>

              <span className="text-sm text-gray-500">
                {filteredNotifications.length}개 중 {selectedNotifications.length}개 선택됨
              </span>
            </div>
          </div>

          {/* 알림 목록 */}
          <div className="divide-y divide-gray-200">
            {loading && filteredNotifications.length === 0 ? (
              // 로딩 스켈레톤
              Array.from({ length: 5 }).map((_, index) => (
                <div key={index} className="p-6 animate-pulse">
                  <div className="flex items-start gap-4">
                    <div className="w-4 h-4 bg-gray-200 rounded"></div>
                    <div className="w-8 h-8 bg-gray-200 rounded-lg"></div>
                    <div className="flex-1 space-y-2">
                      <div className="h-4 bg-gray-200 rounded w-3/4"></div>
                      <div className="h-3 bg-gray-200 rounded w-full"></div>
                      <div className="h-3 bg-gray-200 rounded w-1/2"></div>
                    </div>
                  </div>
                </div>
              ))
            ) : filteredNotifications.length === 0 ? (
              <div className="p-12 text-center text-gray-500">
                <Bell className="w-12 h-12 mx-auto mb-4 text-gray-300" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">알림이 없습니다</h3>
                <p className="text-gray-600">
                  {searchQuery || selectedCategories.length > 0 || selectedPriorities.length > 0
                    ? '검색 조건에 맞는 알림이 없습니다.'
                    : '새로운 알림을 기다리고 있습니다.'
                  }
                </p>
              </div>
            ) : (
              filteredNotifications.map((notification) => (
                <div
                  key={notification.id}
                  className={`p-6 hover:bg-gray-50 cursor-pointer transition-all duration-200 group ${
                    !notification.isRead ? 'bg-blue-50/30' : ''
                  } ${actionLoading[notification.id] ? 'opacity-50 pointer-events-none' : ''}`}
                  onClick={() => handleNotificationClick(notification)}
                >
                  <div className="flex items-start gap-4">
                    {/* 체크박스 */}
                    <label
                      className="mt-1"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <input
                        type="checkbox"
                        checked={selectedNotifications.includes(notification.id)}
                        onChange={() => toggleNotificationSelection(notification.id)}
                        className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                      />
                    </label>

                    {/* 카테고리 아이콘 */}
                    <div className={`flex-shrink-0 w-10 h-10 rounded-lg flex items-center justify-center text-sm ${
                      notificationHelpers.getPriorityColor(notification.priority)
                    }`}>
                      {notificationHelpers.getCategoryIcon(notification.category)}
                    </div>

                    {/* 알림 내용 */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 min-w-0">
                          <h3 className={`text-sm font-medium transition-colors ${
                            !notification.isRead ? 'text-gray-900' : 'text-gray-700'
                          }`}>
                            {notification.title}
                          </h3>
                          <p className="text-sm text-gray-600 mt-1 line-clamp-2 leading-relaxed">
                            {notification.message}
                          </p>

                          {/* 메타데이터 */}
                          <div className="flex items-center gap-4 mt-3 text-xs text-gray-500">
                            {notification.createdByName && (
                              <div className="flex items-center gap-1">
                                <User className="w-3 h-3" />
                                <span>{notification.createdByName}</span>
                              </div>
                            )}

                            <div className="flex items-center gap-1">
                              <Calendar className="w-3 h-3" />
                              <span>{notificationHelpers.getRelativeTime(notification.createdAt)}</span>
                            </div>

                            {notification.priority === 'critical' && (
                              <span className="px-2 py-1 bg-red-100 text-red-800 rounded-full font-medium">
                                긴급
                              </span>
                            )}

                            {notification.priority === 'high' && (
                              <span className="px-2 py-1 bg-orange-100 text-orange-800 rounded-full font-medium">
                                중요
                              </span>
                            )}

                            {!notification.isRead && (
                              <span className="px-2 py-1 bg-blue-100 text-blue-800 rounded-full font-medium">
                                읽지 않음
                              </span>
                            )}
                          </div>
                        </div>

                        {/* 액션 버튼들 */}
                        <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                          {notification.relatedUrl && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleNotificationClick(notification);
                              }}
                              className="p-2 text-gray-400 hover:text-blue-600 rounded-lg hover:bg-blue-100 transition-colors"
                              title="상세 보기"
                            >
                              <ExternalLink className="w-4 h-4" />
                            </button>
                          )}

                          <button
                            onClick={(e) => handleDeleteNotification(notification.id, e)}
                            disabled={actionLoading[notification.id]}
                            className="p-2 text-gray-400 hover:text-red-600 rounded-lg hover:bg-red-100 transition-colors disabled:opacity-50"
                            title="삭제"
                          >
                            {actionLoading[notification.id] ? (
                              <div className="w-4 h-4 border-2 border-red-500 border-t-transparent rounded-full animate-spin" />
                            ) : (
                              <Trash2 className="w-4 h-4" />
                            )}
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* 로딩 오버레이 */}
                  {actionLoading[notification.id] && (
                    <div className="absolute inset-0 flex items-center justify-center bg-white bg-opacity-50">
                      <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                    </div>
                  )}
                </div>
              ))
            )}
          </div>

          {/* 페이지네이션 (향후 추가 가능) */}
          {filteredNotifications.length > 0 && (
            <div className="px-6 py-4 border-t border-gray-200 bg-gray-50">
              <div className="text-sm text-gray-500 text-center">
                총 {filteredNotifications.length}개의 알림
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}