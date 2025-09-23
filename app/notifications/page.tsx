'use client';

import React, { useState, useMemo } from 'react';
import { useNotification, notificationHelpers, NotificationCategory, NotificationPriority } from '@/contexts/NotificationContext';
import { withAuth } from '@/contexts/AuthContext';
import {
  Bell,
  Filter,
  Search,
  Check,
  CheckCheck,
  Trash2,
  ExternalLink,
  Clock,
  User,
  AlertCircle,
  Settings,
  RefreshCw,
  Calendar,
  Tag,
  ChevronDown,
  X,
  Archive
} from 'lucide-react';
import Link from 'next/link';

// 카테고리 매핑
const categoryLabels: Record<NotificationCategory, string> = {
  'task_created': '업무 생성',
  'task_updated': '업무 수정',
  'task_assigned': '업무 할당',
  'task_status_changed': '업무 상태 변경',
  'task_completed': '업무 완료',
  'system_maintenance': '시스템 점검',
  'system_update': '시스템 업데이트',
  'security_alert': '보안 경고',
  'login_attempt': '로그인 시도',
  'report_submitted': '보고서 제출',
  'report_approved': '보고서 승인',
  'user_created': '사용자 생성',
  'user_updated': '사용자 수정',
  'business_added': '사업장 추가',
  'file_uploaded': '파일 업로드',
  'backup_completed': '백업 완료',
  'maintenance_scheduled': '점검 예약'
};

// 우선순위 매핑
const priorityLabels: Record<NotificationPriority, string> = {
  'low': '낮음',
  'medium': '보통',
  'high': '높음',
  'critical': '긴급'
};

function NotificationsPage() {
  const {
    notifications,
    unreadCount,
    loading,
    fetchNotifications,
    markAsRead,
    markAllAsRead,
    deleteNotification,
    isConnected
  } = useNotification();

  // 필터 상태
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<NotificationCategory | 'all'>('all');
  const [selectedPriority, setSelectedPriority] = useState<NotificationPriority | 'all'>('all');
  const [showReadStatus, setShowReadStatus] = useState<'all' | 'unread' | 'read'>('all');
  const [sortBy, setSortBy] = useState<'newest' | 'oldest' | 'priority'>('newest');
  const [showFilters, setShowFilters] = useState(false);

  // 페이지네이션
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 20;

  // 필터링된 알림
  const filteredNotifications = useMemo(() => {
    let filtered = notifications.filter(notification => {
      // 검색어 필터
      if (searchTerm) {
        const searchLower = searchTerm.toLowerCase();
        if (
          !notification.title.toLowerCase().includes(searchLower) &&
          !notification.message.toLowerCase().includes(searchLower) &&
          !notification.createdByName?.toLowerCase().includes(searchLower)
        ) {
          return false;
        }
      }

      // 카테고리 필터
      if (selectedCategory !== 'all' && notification.category !== selectedCategory) {
        return false;
      }

      // 우선순위 필터
      if (selectedPriority !== 'all' && notification.priority !== selectedPriority) {
        return false;
      }

      // 읽음 상태 필터
      if (showReadStatus === 'unread' && notification.isRead) {
        return false;
      }
      if (showReadStatus === 'read' && !notification.isRead) {
        return false;
      }

      return true;
    });

    // 정렬
    filtered.sort((a, b) => {
      switch (sortBy) {
        case 'oldest':
          return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
        case 'priority':
          const priorityOrder = { 'critical': 4, 'high': 3, 'medium': 2, 'low': 1 };
          return priorityOrder[b.priority] - priorityOrder[a.priority];
        case 'newest':
        default:
          return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      }
    });

    return filtered;
  }, [notifications, searchTerm, selectedCategory, selectedPriority, showReadStatus, sortBy]);

  // 페이지네이션된 알림
  const paginatedNotifications = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    return filteredNotifications.slice(startIndex, endIndex);
  }, [filteredNotifications, currentPage, itemsPerPage]);

  const totalPages = Math.ceil(filteredNotifications.length / itemsPerPage);

  // 알림 클릭 처리
  const handleNotificationClick = async (notification: any) => {
    if (!notification.isRead) {
      await markAsRead(notification.id);
    }

    if (notification.relatedUrl) {
      window.open(notification.relatedUrl, '_blank');
    }
  };

  // 필터 초기화
  const resetFilters = () => {
    setSearchTerm('');
    setSelectedCategory('all');
    setSelectedPriority('all');
    setShowReadStatus('all');
    setSortBy('newest');
    setCurrentPage(1);
  };

  // 카테고리 통계
  const categoryStats = useMemo(() => {
    const stats: Record<string, number> = {};
    notifications.forEach(notification => {
      stats[notification.category] = (stats[notification.category] || 0) + 1;
    });
    return stats;
  }, [notifications]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">알림을 불러오는 중...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* 헤더 */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                <Bell className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">알림 관리</h1>
                <p className="text-gray-600">시스템 알림 및 업무 관련 알림을 관리합니다</p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              {/* 연결 상태 */}
              <div className={`flex items-center gap-2 px-3 py-1 rounded-full text-sm ${
                isConnected
                  ? 'bg-green-100 text-green-700'
                  : 'bg-red-100 text-red-700'
              }`}>
                <div className={`w-2 h-2 rounded-full ${
                  isConnected ? 'bg-green-500' : 'bg-red-500'
                }`} />
                {isConnected ? '실시간 연결됨' : '연결 끊김'}
              </div>

              {/* 새로고침 */}
              <button
                onClick={fetchNotifications}
                className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100"
                title="새로고침"
              >
                <RefreshCw className="w-5 h-5" />
              </button>

              {/* 설정 */}
              <Link
                href="/notifications/settings"
                className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100"
                title="알림 설정"
              >
                <Settings className="w-5 h-5" />
              </Link>
            </div>
          </div>

          {/* 통계 */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-blue-50 rounded-lg p-4">
              <div className="text-2xl font-bold text-blue-600">{notifications.length}</div>
              <div className="text-sm text-blue-600">전체 알림</div>
            </div>
            <div className="bg-orange-50 rounded-lg p-4">
              <div className="text-2xl font-bold text-orange-600">{unreadCount}</div>
              <div className="text-sm text-orange-600">읽지 않음</div>
            </div>
            <div className="bg-green-50 rounded-lg p-4">
              <div className="text-2xl font-bold text-green-600">{notifications.length - unreadCount}</div>
              <div className="text-sm text-green-600">읽음</div>
            </div>
            <div className="bg-purple-50 rounded-lg p-4">
              <div className="text-2xl font-bold text-purple-600">
                {notifications.filter(n => n.priority === 'high' || n.priority === 'critical').length}
              </div>
              <div className="text-sm text-purple-600">높은 우선순위</div>
            </div>
          </div>
        </div>

        {/* 필터 및 액션 */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
          <div className="flex flex-col lg:flex-row gap-4">
            {/* 검색 */}
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                <input
                  type="text"
                  placeholder="제목, 내용, 발신자로 검색..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
            </div>

            {/* 필터 토글 */}
            <button
              onClick={() => setShowFilters(!showFilters)}
              className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
            >
              <Filter className="w-4 h-4" />
              필터
              <ChevronDown className={`w-4 h-4 transition-transform ${showFilters ? 'rotate-180' : ''}`} />
            </button>

            {/* 액션 버튼 */}
            <div className="flex items-center gap-2">
              {unreadCount > 0 && (
                <button
                  onClick={markAllAsRead}
                  className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  <CheckCheck className="w-4 h-4" />
                  모두 읽음
                </button>
              )}
            </div>
          </div>

          {/* 필터 옵션 */}
          {showFilters && (
            <div className="mt-4 pt-4 border-t border-gray-200">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {/* 카테고리 필터 */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">카테고리</label>
                  <select
                    value={selectedCategory}
                    onChange={(e) => setSelectedCategory(e.target.value as NotificationCategory | 'all')}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="all">전체 카테고리</option>
                    {Object.entries(categoryLabels).map(([key, label]) => (
                      <option key={key} value={key}>
                        {label} ({categoryStats[key] || 0})
                      </option>
                    ))}
                  </select>
                </div>

                {/* 우선순위 필터 */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">우선순위</label>
                  <select
                    value={selectedPriority}
                    onChange={(e) => setSelectedPriority(e.target.value as NotificationPriority | 'all')}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="all">전체 우선순위</option>
                    {Object.entries(priorityLabels).map(([key, label]) => (
                      <option key={key} value={key}>{label}</option>
                    ))}
                  </select>
                </div>

                {/* 읽음 상태 필터 */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">읽음 상태</label>
                  <select
                    value={showReadStatus}
                    onChange={(e) => setShowReadStatus(e.target.value as 'all' | 'unread' | 'read')}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="all">전체</option>
                    <option value="unread">읽지 않음</option>
                    <option value="read">읽음</option>
                  </select>
                </div>

                {/* 정렬 */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">정렬</label>
                  <select
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value as 'newest' | 'oldest' | 'priority')}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="newest">최신순</option>
                    <option value="oldest">오래된순</option>
                    <option value="priority">우선순위순</option>
                  </select>
                </div>
              </div>

              <div className="flex justify-end mt-4">
                <button
                  onClick={resetFilters}
                  className="flex items-center gap-2 px-4 py-2 text-gray-600 hover:text-gray-800 rounded-lg hover:bg-gray-100"
                >
                  <X className="w-4 h-4" />
                  필터 초기화
                </button>
              </div>
            </div>
          )}
        </div>

        {/* 알림 목록 */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200">
          {paginatedNotifications.length === 0 ? (
            <div className="p-12 text-center">
              <Bell className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">알림이 없습니다</h3>
              <p className="text-gray-500">조건에 맞는 알림이 없습니다.</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-200">
              {paginatedNotifications.map((notification) => (
                <div
                  key={notification.id}
                  className={`p-6 hover:bg-gray-50 cursor-pointer transition-colors ${
                    !notification.isRead ? 'bg-blue-50/30' : ''
                  }`}
                  onClick={() => handleNotificationClick(notification)}
                >
                  <div className="flex items-start gap-4">
                    {/* 아이콘 */}
                    <div className={`flex-shrink-0 w-10 h-10 rounded-lg flex items-center justify-center text-lg ${
                      notificationHelpers.getPriorityColor(notification.priority)
                    }`}>
                      {notificationHelpers.getCategoryIcon(notification.category)}
                    </div>

                    {/* 내용 */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 min-w-0">
                          <h3 className={`text-base font-medium ${
                            !notification.isRead ? 'text-gray-900' : 'text-gray-700'
                          }`}>
                            {notification.title}
                          </h3>
                          <p className="text-sm text-gray-600 mt-1 line-clamp-2">
                            {notification.message}
                          </p>

                          {/* 메타데이터 */}
                          <div className="flex items-center gap-4 mt-3 text-xs text-gray-500">
                            <div className="flex items-center gap-1">
                              <Tag className="w-3 h-3" />
                              {categoryLabels[notification.category]}
                            </div>
                            {notification.createdByName && (
                              <div className="flex items-center gap-1">
                                <User className="w-3 h-3" />
                                {notification.createdByName}
                              </div>
                            )}
                            <div className="flex items-center gap-1">
                              <Clock className="w-3 h-3" />
                              {notificationHelpers.getRelativeTime(notification.createdAt)}
                            </div>
                          </div>
                        </div>

                        {/* 액션 */}
                        <div className="flex items-center gap-2 flex-shrink-0">
                          {/* 우선순위 배지 */}
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                            notificationHelpers.getPriorityColor(notification.priority)
                          }`}>
                            {priorityLabels[notification.priority]}
                          </span>

                          {/* 외부 링크 */}
                          {notification.relatedUrl && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleNotificationClick(notification);
                              }}
                              className="p-1 text-gray-400 hover:text-blue-600 rounded"
                              title="상세 보기"
                            >
                              <ExternalLink className="w-4 h-4" />
                            </button>
                          )}

                          {/* 읽음 처리 */}
                          {!notification.isRead && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                markAsRead(notification.id);
                              }}
                              className="p-1 text-gray-400 hover:text-green-600 rounded"
                              title="읽음 처리"
                            >
                              <Check className="w-4 h-4" />
                            </button>
                          )}

                          {/* 삭제 */}
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              deleteNotification(notification.id);
                            }}
                            className="p-1 text-gray-400 hover:text-red-600 rounded"
                            title="삭제"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>

                      {/* 읽지 않음 표시 */}
                      {!notification.isRead && (
                        <div className="w-2 h-2 bg-blue-500 rounded-full mt-3" />
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* 페이지네이션 */}
          {totalPages > 1 && (
            <div className="px-6 py-4 border-t border-gray-200">
              <div className="flex items-center justify-between">
                <div className="text-sm text-gray-700">
                  {filteredNotifications.length}개 중 {(currentPage - 1) * itemsPerPage + 1}-{Math.min(currentPage * itemsPerPage, filteredNotifications.length)}개 표시
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                    disabled={currentPage === 1}
                    className="px-3 py-1 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    이전
                  </button>

                  <div className="flex items-center gap-1">
                    {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                      const pageNum = i + 1;
                      return (
                        <button
                          key={pageNum}
                          onClick={() => setCurrentPage(pageNum)}
                          className={`px-3 py-1 text-sm rounded-lg ${
                            currentPage === pageNum
                              ? 'bg-blue-600 text-white'
                              : 'border border-gray-300 hover:bg-gray-50'
                          }`}
                        >
                          {pageNum}
                        </button>
                      );
                    })}
                  </div>

                  <button
                    onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                    disabled={currentPage === totalPages}
                    className="px-3 py-1 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    다음
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default withAuth(NotificationsPage);