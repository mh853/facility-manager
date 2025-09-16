'use client';

import { useState, useEffect, useRef } from 'react';
import { notificationAPI } from '@/lib/api-client';
import { Notification } from '@/types/work-management';
import { useAuth } from '@/contexts/AuthContext';
import {
  Bell,
  BellRing,
  Check,
  CheckCheck,
  X,
  Clock,
  AlertCircle,
  Info,
  Calendar,
  ExternalLink
} from 'lucide-react';

interface NotificationCenterProps {
  className?: string;
}

const NOTIFICATION_ICONS = {
  '업무요청': BellRing,
  '업무완료': Check,
  '업무이관': AlertCircle,
  '협조요청': Info,
  '마감임박': Clock,
  '보고서제출': Calendar,
  '시스템공지': Bell,
  '기타': Info
};

const NOTIFICATION_COLORS = {
  '긴급': 'border-l-red-500 bg-red-50',
  '높음': 'border-l-orange-500 bg-orange-50',
  '보통': 'border-l-blue-500 bg-blue-50',
  '낮음': 'border-l-gray-500 bg-gray-50'
};

export default function NotificationCenter({ className = '' }: NotificationCenterProps) {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);

  const dropdownRef = useRef<HTMLDivElement>(null);
  const { user } = useAuth();

  useEffect(() => {
    if (user) {
      loadNotifications(1, true);

      // 30초마다 새 알림 확인
      const interval = setInterval(() => {
        loadNotifications(1, true);
      }, 30000);

      return () => clearInterval(interval);
    }
  }, [user]);

  useEffect(() => {
    // 외부 클릭 시 드롭다운 닫기
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const loadNotifications = async (pageNum = 1, reset = false) => {
    try {
      setLoading(true);
      setError('');

      const response = await notificationAPI.getNotifications({
        page: pageNum,
        limit: 20
      });

      if (response.success && response.data) {
        const newNotifications = response.data.data;

        if (reset) {
          setNotifications(newNotifications);
        } else {
          setNotifications(prev => [...prev, ...newNotifications]);
        }

        setUnreadCount(response.data.meta.unreadCount);
        setHasMore(response.data.pagination.hasNext);
        setPage(pageNum);
      } else {
        setError(response.error?.message || '알림을 불러오는데 실패했습니다.');
      }
    } catch (error) {
      console.error('알림 조회 오류:', error);
      setError('네트워크 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  };

  const markAsRead = async (notificationId: string) => {
    try {
      const response = await notificationAPI.markAsRead(notificationId);

      if (response.success) {
        setNotifications(prev =>
          prev.map(notification =>
            notification.id === notificationId
              ? { ...notification, isRead: true, readAt: new Date() }
              : notification
          )
        );
        setUnreadCount(prev => Math.max(0, prev - 1));
      }
    } catch (error) {
      console.error('알림 읽음 처리 오류:', error);
    }
  };

  const markAllAsRead = async () => {
    try {
      const response = await notificationAPI.markAllAsRead();

      if (response.success) {
        setNotifications(prev =>
          prev.map(notification => ({
            ...notification,
            isRead: true,
            readAt: new Date()
          }))
        );
        setUnreadCount(0);
      }
    } catch (error) {
      console.error('전체 읽음 처리 오류:', error);
    }
  };

  const handleNotificationClick = (notification: Notification) => {
    if (!notification.isRead) {
      markAsRead(notification.id);
    }

    // 액션 URL이 있으면 이동
    if (notification.actionUrl) {
      window.location.href = notification.actionUrl;
    }
  };

  const formatRelativeTime = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

    if (diffInSeconds < 60) {
      return '방금 전';
    } else if (diffInSeconds < 3600) {
      return `${Math.floor(diffInSeconds / 60)}분 전`;
    } else if (diffInSeconds < 86400) {
      return `${Math.floor(diffInSeconds / 3600)}시간 전`;
    } else if (diffInSeconds < 604800) {
      return `${Math.floor(diffInSeconds / 86400)}일 전`;
    } else {
      return date.toLocaleDateString('ko-KR');
    }
  };

  const loadMore = () => {
    if (!loading && hasMore) {
      loadNotifications(page + 1, false);
    }
  };

  return (
    <div className={`relative ${className}`} ref={dropdownRef}>
      {/* 알림 버튼 */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-full transition-colors"
      >
        <Bell className="w-6 h-6" />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {/* 드롭다운 */}
      {isOpen && (
        <div className="absolute right-0 top-full mt-2 w-96 bg-white rounded-lg shadow-lg border border-gray-200 z-50 max-h-96 overflow-hidden">
          {/* 헤더 */}
          <div className="px-4 py-3 border-b border-gray-200 bg-gray-50">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-medium text-gray-900">
                알림
                {unreadCount > 0 && (
                  <span className="ml-2 inline-flex items-center px-2 py-1 bg-red-100 text-red-800 text-xs rounded-full">
                    {unreadCount}개 읽지 않음
                  </span>
                )}
              </h3>
              <div className="flex items-center gap-2">
                {unreadCount > 0 && (
                  <button
                    onClick={markAllAsRead}
                    className="text-xs text-blue-600 hover:text-blue-800"
                  >
                    모두 읽음
                  </button>
                )}
                <button
                  onClick={() => setIsOpen(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>

          {/* 알림 목록 */}
          <div className="max-h-80 overflow-y-auto">
            {loading && notifications.length === 0 ? (
              <div className="flex items-center justify-center py-8">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
              </div>
            ) : error ? (
              <div className="px-4 py-8 text-center">
                <AlertCircle className="w-8 h-8 text-red-500 mx-auto mb-2" />
                <p className="text-sm text-gray-600">{error}</p>
                <button
                  onClick={() => loadNotifications(1, true)}
                  className="mt-2 text-blue-600 hover:text-blue-800 text-sm"
                >
                  다시 시도
                </button>
              </div>
            ) : notifications.length === 0 ? (
              <div className="px-4 py-8 text-center">
                <Bell className="w-8 h-8 text-gray-300 mx-auto mb-2" />
                <p className="text-sm text-gray-600">새 알림이 없습니다.</p>
              </div>
            ) : (
              <div className="divide-y divide-gray-100">
                {notifications.map((notification) => {
                  const Icon = NOTIFICATION_ICONS[notification.notificationType as keyof typeof NOTIFICATION_ICONS] || Info;
                  const colorClass = NOTIFICATION_COLORS[notification.priority as keyof typeof NOTIFICATION_COLORS] || NOTIFICATION_COLORS['보통'];

                  return (
                    <div
                      key={notification.id}
                      onClick={() => handleNotificationClick(notification)}
                      className={`px-4 py-3 hover:bg-gray-50 cursor-pointer transition-colors border-l-4 ${colorClass} ${
                        !notification.isRead ? 'bg-blue-50' : ''
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <div className={`flex-shrink-0 p-1 rounded-full ${
                          notification.priority === '긴급' ? 'bg-red-100' :
                          notification.priority === '높음' ? 'bg-orange-100' :
                          'bg-blue-100'
                        }`}>
                          <Icon className={`w-4 h-4 ${
                            notification.priority === '긴급' ? 'text-red-600' :
                            notification.priority === '높음' ? 'text-orange-600' :
                            'text-blue-600'
                          }`} />
                        </div>

                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between mb-1">
                            <p className={`text-sm font-medium ${
                              !notification.isRead ? 'text-gray-900' : 'text-gray-700'
                            }`}>
                              {notification.title}
                            </p>
                            {!notification.isRead && (
                              <div className="w-2 h-2 bg-blue-600 rounded-full flex-shrink-0"></div>
                            )}
                          </div>

                          <p className="text-sm text-gray-600 line-clamp-2 mb-2">
                            {notification.message}
                          </p>

                          <div className="flex items-center justify-between">
                            <span className="text-xs text-gray-500">
                              {formatRelativeTime(notification.createdAt.toString())}
                            </span>

                            {notification.actionUrl && (
                              <div className="flex items-center text-xs text-blue-600">
                                <span>{notification.actionLabel || '보기'}</span>
                                <ExternalLink className="w-3 h-3 ml-1" />
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}

                {/* 더 보기 버튼 */}
                {hasMore && (
                  <div className="px-4 py-3 text-center border-t border-gray-100">
                    <button
                      onClick={loadMore}
                      disabled={loading}
                      className="text-sm text-blue-600 hover:text-blue-800 disabled:opacity-50"
                    >
                      {loading ? (
                        <div className="flex items-center justify-center">
                          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600 mr-2"></div>
                          로딩 중...
                        </div>
                      ) : (
                        '더 보기'
                      )}
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}