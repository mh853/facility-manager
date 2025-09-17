'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Bell, Check, CheckCheck, Clock, User, FolderOpen, AlertCircle, X, Wifi, WifiOff } from 'lucide-react';
import { useWebSocket } from '@/lib/hooks/useWebSocket';

interface Notification {
  id: string;
  type: string;
  title: string;
  message: string;
  priority: '낮음' | '보통' | '높음' | '긴급';
  is_read: boolean;
  created_at: string;
  sender_name?: string;
  project_name?: string;
  task_title?: string;
  action_url?: string;
  time_category: 'recent' | 'today' | 'this_week' | 'older';
}

interface NotificationData {
  notifications: Notification[];
  unreadCount: number;
}

export default function NotificationBell() {
  const [isOpen, setIsOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // 웹소켓 연결
  const {
    isConnected,
    isConnecting,
    onlineUsers,
    subscribeToNotifications
  } = useWebSocket({
    onConnect: () => {
      console.log('🔔 알림 시스템 연결됨');
      subscribeToNotifications();
    },
    onNotification: (newNotification) => {
      console.log('🔔 실시간 알림 수신:', newNotification);

      // 새 알림을 목록에 추가
      setNotifications(prev => [newNotification, ...prev.slice(0, 9)]);
      setUnreadCount(prev => prev + 1);

      // 브라우저 알림 표시 (권한이 있는 경우)
      if (Notification.permission === 'granted') {
        new Notification(newNotification.title, {
          body: newNotification.message,
          icon: '/icon-192x192.png',
          badge: '/icon-192x192.png'
        });
      }
    }
  });

  // 알림 목록 가져오기
  const fetchNotifications = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/notifications?limit=10');
      if (response.ok) {
        const data: { success: boolean; data: NotificationData } = await response.json();
        if (data.success) {
          setNotifications(data.data.notifications);
          setUnreadCount(data.data.unreadCount);
        }
      }
    } catch (error) {
      console.error('알림 조회 오류:', error);
    } finally {
      setLoading(false);
    }
  };

  // 컴포넌트 마운트 시 알림 가져오기
  useEffect(() => {
    fetchNotifications();

    // 브라우저 알림 권한 요청
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }
  }, []);

  // 외부 클릭 시 드롭다운 닫기
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  // 모든 알림 읽음 처리
  const markAllAsRead = async () => {
    try {
      const response = await fetch('/api/notifications', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ mark_all_read: true }),
      });

      if (response.ok) {
        setNotifications(notifications.map(n => ({ ...n, is_read: true })));
        setUnreadCount(0);
      }
    } catch (error) {
      console.error('읽음 처리 오류:', error);
    }
  };

  // 개별 알림 읽음 처리
  const markAsRead = async (notificationId: string) => {
    try {
      const response = await fetch('/api/notifications', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ notification_ids: [notificationId] }),
      });

      if (response.ok) {
        setNotifications(notifications.map(n =>
          n.id === notificationId ? { ...n, is_read: true } : n
        ));
        setUnreadCount(Math.max(0, unreadCount - 1));
      }
    } catch (error) {
      console.error('읽음 처리 오류:', error);
    }
  };

  // 알림 타입별 아이콘
  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'task_assigned':
      case 'task_completed':
      case 'task_overdue':
        return <Check className="h-4 w-4" />;
      case 'project_assigned':
      case 'project_status_changed':
        return <FolderOpen className="h-4 w-4" />;
      case 'mention':
      case 'comment_added':
        return <User className="h-4 w-4" />;
      case 'deadline_reminder':
        return <Clock className="h-4 w-4" />;
      default:
        return <Bell className="h-4 w-4" />;
    }
  };

  // 우선순위별 색상
  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case '긴급':
        return 'text-red-600 bg-red-100';
      case '높음':
        return 'text-orange-600 bg-orange-100';
      case '보통':
        return 'text-blue-600 bg-blue-100';
      case '낮음':
        return 'text-gray-600 bg-gray-100';
      default:
        return 'text-gray-600 bg-gray-100';
    }
  };

  // 시간 표시 포맷
  const formatTime = (dateString: string) => {
    const now = new Date();
    const notificationTime = new Date(dateString);
    const diffInMinutes = Math.floor((now.getTime() - notificationTime.getTime()) / (1000 * 60));

    if (diffInMinutes < 1) {
      return '방금 전';
    } else if (diffInMinutes < 60) {
      return `${diffInMinutes}분 전`;
    } else if (diffInMinutes < 1440) {
      return `${Math.floor(diffInMinutes / 60)}시간 전`;
    } else {
      return `${Math.floor(diffInMinutes / 1440)}일 전`;
    }
  };

  return (
    <div className="relative" ref={dropdownRef}>
      {/* 알림 벨 버튼 */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-md transition-colors duration-200"
        title={isConnected ? '실시간 알림 연결됨' : isConnecting ? '연결 중...' : '오프라인'}
      >
        <Bell className="h-6 w-6" />

        {/* 읽지 않은 알림 카운트 */}
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 inline-flex items-center justify-center px-2 py-1 text-xs font-bold leading-none text-white transform translate-x-1/2 -translate-y-1/2 bg-red-600 rounded-full">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}

        {/* 연결 상태 표시 */}
        <span className={`absolute -bottom-1 -left-1 w-3 h-3 rounded-full ${
          isConnected
            ? 'bg-green-500'
            : isConnecting
            ? 'bg-yellow-500 animate-pulse'
            : 'bg-gray-400'
        }`} />
      </button>

      {/* 드롭다운 메뉴 */}
      {isOpen && (
        <div className="absolute right-0 mt-2 w-96 bg-white rounded-lg shadow-xl border border-gray-200 z-50 max-h-96 overflow-hidden">
          {/* 헤더 */}
          <div className="flex items-center justify-between p-4 border-b border-gray-200">
            <h3 className="text-lg font-semibold text-gray-900">알림</h3>
            <div className="flex items-center space-x-2">
              {unreadCount > 0 && (
                <button
                  onClick={markAllAsRead}
                  className="text-sm text-blue-600 hover:text-blue-800 font-medium"
                >
                  모두 읽음
                </button>
              )}
              <button
                onClick={() => setIsOpen(false)}
                className="p-1 text-gray-400 hover:text-gray-600"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* 알림 목록 */}
          <div className="max-h-80 overflow-y-auto">
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
              </div>
            ) : notifications.length > 0 ? (
              <div className="divide-y divide-gray-200">
                {notifications.map((notification) => (
                  <div
                    key={notification.id}
                    className={`p-4 hover:bg-gray-50 transition-colors duration-200 ${
                      !notification.is_read ? 'bg-blue-50 border-l-4 border-blue-500' : ''
                    }`}
                  >
                    <div className="flex items-start space-x-3">
                      {/* 아이콘 */}
                      <div className={`p-2 rounded-full ${getPriorityColor(notification.priority)}`}>
                        {getNotificationIcon(notification.type)}
                      </div>

                      {/* 내용 */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <p className={`text-sm font-medium ${!notification.is_read ? 'text-gray-900' : 'text-gray-700'}`}>
                              {notification.title}
                            </p>
                            <p className="text-sm text-gray-600 mt-1">
                              {notification.message}
                            </p>

                            {/* 추가 정보 */}
                            {(notification.sender_name || notification.project_name || notification.task_title) && (
                              <div className="flex items-center space-x-2 mt-2 text-xs text-gray-500">
                                {notification.sender_name && (
                                  <span>보낸이: {notification.sender_name}</span>
                                )}
                                {notification.project_name && (
                                  <span>프로젝트: {notification.project_name}</span>
                                )}
                                {notification.task_title && (
                                  <span>작업: {notification.task_title}</span>
                                )}
                              </div>
                            )}

                            <p className="text-xs text-gray-500 mt-2">
                              {formatTime(notification.created_at)}
                            </p>
                          </div>

                          {/* 읽음 처리 버튼 */}
                          {!notification.is_read && (
                            <button
                              onClick={() => markAsRead(notification.id)}
                              className="ml-2 p-1 text-gray-400 hover:text-gray-600"
                              title="읽음 표시"
                            >
                              <Check className="h-4 w-4" />
                            </button>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* 액션 버튼 */}
                    {notification.action_url && (
                      <div className="mt-3">
                        <a
                          href={notification.action_url}
                          className="inline-flex items-center px-3 py-1 text-xs font-medium text-blue-600 bg-blue-100 rounded-md hover:bg-blue-200 transition-colors duration-200"
                          onClick={() => setIsOpen(false)}
                        >
                          보기
                        </a>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-8 text-gray-500">
                <Bell className="h-8 w-8 mb-2 opacity-50" />
                <p className="text-sm">새로운 알림이 없습니다</p>
              </div>
            )}
          </div>

          {/* 더보기 버튼 */}
          {notifications.length > 0 && (
            <div className="border-t border-gray-200 p-2">
              <button
                onClick={() => {
                  setIsOpen(false);
                  // TODO: 알림 전체 페이지로 이동
                }}
                className="w-full text-sm text-blue-600 hover:text-blue-800 font-medium py-2 hover:bg-gray-50 rounded-md transition-colors duration-200"
              >
                모든 알림 보기
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}