'use client';

import React, { useState, useRef, useEffect } from 'react';
import { Bell, BellRing, Settings, MoreHorizontal, Check, Trash2, ExternalLink, X } from 'lucide-react';
import { useNotification, notificationHelpers, Notification } from '@/contexts/NotificationContext';
import { useRouter } from 'next/navigation';

interface NotificationButtonProps {
  className?: string;
}

export default function NotificationButton({ className = '' }: NotificationButtonProps) {
  const {
    notifications,
    unreadCount,
    loading,
    markAsRead,
    markAllAsRead,
    deleteNotification,
    isConnected
  } = useNotification();

  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [showAllRead, setShowAllRead] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // 외부 클릭시 드롭다운 닫기
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isOpen]);

  // ESC 키로 드롭다운 닫기
  useEffect(() => {
    const handleEscKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && isOpen) {
        setIsOpen(false);
      }
    };

    document.addEventListener('keydown', handleEscKey);
    return () => document.removeEventListener('keydown', handleEscKey);
  }, [isOpen]);

  // 최근 알림만 표시 (최대 10개)
  const recentNotifications = notifications
    .slice(0, 10)
    .filter(notification => showAllRead || !notification.isRead);

  // 알림 클릭 처리
  const handleNotificationClick = async (notification: Notification) => {
    // 읽지 않은 알림인 경우 읽음 처리
    if (!notification.isRead) {
      await markAsRead(notification.id);
    }

    // 관련 페이지로 이동
    if (notification.relatedUrl) {
      setIsOpen(false);
      router.push(notification.relatedUrl);
    }
  };

  // 모든 알림 읽음 처리
  const handleMarkAllAsRead = async () => {
    await markAllAsRead();
  };

  // 알림 삭제
  const handleDeleteNotification = async (notificationId: string, event: React.MouseEvent) => {
    event.stopPropagation();
    await deleteNotification(notificationId);
  };

  return (
    <div className={`relative ${className}`} ref={dropdownRef}>
      {/* 알림 버튼 */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`relative p-2 rounded-lg transition-all duration-200 ${
          isOpen
            ? 'bg-blue-50 text-blue-600'
            : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
        }`}
        aria-label={`알림 ${unreadCount}개`}
      >
        {unreadCount > 0 ? (
          <BellRing className="w-5 h-5" />
        ) : (
          <Bell className="w-5 h-5" />
        )}

        {/* 읽지 않은 알림 배지 */}
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center font-medium">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}

        {/* 연결 상태 표시 */}
        <div className={`absolute bottom-0 right-0 w-2 h-2 rounded-full ${
          isConnected ? 'bg-green-400' : 'bg-gray-400'
        }`} title={isConnected ? '실시간 연결됨' : '연결 끊김'} />
      </button>

      {/* 알림 드롭다운 */}
      {isOpen && (
        <div className="absolute right-0 top-full mt-2 w-96 bg-white rounded-lg shadow-lg border border-gray-200 z-50 max-h-[80vh] overflow-hidden">
          {/* 헤더 */}
          <div className="flex items-center justify-between p-4 border-b border-gray-100">
            <div className="flex items-center gap-2">
              <h3 className="font-semibold text-gray-900">알림</h3>
              {loading && (
                <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
              )}
            </div>

            <div className="flex items-center gap-2">
              {/* 읽음/전체 토글 */}
              <button
                onClick={() => setShowAllRead(!showAllRead)}
                className="text-xs text-gray-500 hover:text-gray-700"
              >
                {showAllRead ? '읽지 않음만' : '전체 보기'}
              </button>

              {/* 모두 읽음 */}
              {unreadCount > 0 && (
                <button
                  onClick={handleMarkAllAsRead}
                  className="text-xs text-blue-600 hover:text-blue-700 flex items-center gap-1"
                >
                  <Check className="w-3 h-3" />
                  모두 읽음
                </button>
              )}

              {/* 설정 */}
              <button
                onClick={() => {
                  setIsOpen(false);
                  router.push('/notifications/settings');
                }}
                className="p-1 text-gray-400 hover:text-gray-600 rounded"
              >
                <Settings className="w-4 h-4" />
              </button>

              {/* 닫기 */}
              <button
                onClick={() => setIsOpen(false)}
                className="p-1 text-gray-400 hover:text-gray-600 rounded"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* 알림 목록 */}
          <div className="max-h-96 overflow-y-auto">
            {recentNotifications.length === 0 ? (
              <div className="p-8 text-center text-gray-500">
                <Bell className="w-12 h-12 mx-auto mb-4 text-gray-300" />
                <p className="text-sm">
                  {showAllRead ? '알림이 없습니다.' : '읽지 않은 알림이 없습니다.'}
                </p>
              </div>
            ) : (
              <div className="divide-y divide-gray-100">
                {recentNotifications.map((notification) => (
                  <div
                    key={notification.id}
                    className={`p-4 hover:bg-gray-50 cursor-pointer transition-colors ${
                      !notification.isRead ? 'bg-blue-50/50' : ''
                    }`}
                    onClick={() => handleNotificationClick(notification)}
                  >
                    <div className="flex items-start gap-3">
                      {/* 카테고리 아이콘 */}
                      <div className={`flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center text-sm ${
                        notificationHelpers.getPriorityColor(notification.priority)
                      }`}>
                        {notificationHelpers.getCategoryIcon(notification.category)}
                      </div>

                      {/* 알림 내용 */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1 min-w-0">
                            <h4 className={`text-sm font-medium ${
                              !notification.isRead ? 'text-gray-900' : 'text-gray-700'
                            }`}>
                              {notification.title}
                            </h4>
                            <p className="text-xs text-gray-600 mt-1 line-clamp-2">
                              {notification.message}
                            </p>

                            {/* 발신자 및 시간 */}
                            <div className="flex items-center gap-2 mt-2 text-xs text-gray-500">
                              {notification.createdByName && (
                                <span>{notification.createdByName}</span>
                              )}
                              <span>•</span>
                              <span>{notificationHelpers.getRelativeTime(notification.createdAt)}</span>
                            </div>
                          </div>

                          {/* 액션 버튼들 */}
                          <div className="flex items-center gap-1 flex-shrink-0">
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
                                <ExternalLink className="w-3 h-3" />
                              </button>
                            )}

                            {/* 삭제 */}
                            <button
                              onClick={(e) => handleDeleteNotification(notification.id, e)}
                              className="p-1 text-gray-400 hover:text-red-600 rounded"
                              title="삭제"
                            >
                              <Trash2 className="w-3 h-3" />
                            </button>
                          </div>
                        </div>

                        {/* 읽지 않음 표시 */}
                        {!notification.isRead && (
                          <div className="w-2 h-2 bg-blue-500 rounded-full mt-2" />
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* 푸터 */}
          {recentNotifications.length > 0 && (
            <div className="p-3 border-t border-gray-100 bg-gray-50">
              <button
                onClick={() => {
                  setIsOpen(false);
                  router.push('/notifications');
                }}
                className="w-full text-sm text-center text-blue-600 hover:text-blue-700 font-medium"
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