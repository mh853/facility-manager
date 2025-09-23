// 안정화된 알림 버튼 - 깜빡임 현상 제거 및 성능 최적화
'use client';

import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Bell, BellRing, Settings, X, WifiOff, Wifi } from 'lucide-react';
import { useSimpleNotifications } from '@/lib/notifications/useSimpleNotifications';
import { useRouter } from 'next/navigation';

interface StableNotificationButtonProps {
  className?: string;
}

// 메모이제이션된 알림 아이템 컴포넌트
const NotificationItem = React.memo(({ notification, onRead, onDelete }: any) => {
  const handleClick = () => {
    if (!notification.isRead) {
      onRead(notification.id);
    }
  };

  return (
    <div
      className={`p-3 hover:bg-gray-50 cursor-pointer transition-colors border-l-4 ${
        !notification.isRead
          ? 'bg-blue-50/30 border-l-blue-500'
          : 'border-l-transparent'
      }`}
      onClick={handleClick}
    >
      <div className="flex items-start gap-3">
        {/* 우선순위 표시 */}
        <div className={`flex-shrink-0 w-2 h-2 rounded-full mt-2 ${
          notification.priority === 'critical' ? 'bg-red-500' :
          notification.priority === 'high' ? 'bg-orange-500' :
          notification.priority === 'medium' ? 'bg-blue-500' : 'bg-gray-400'
        }`} />

        {/* 알림 내용 */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1 min-w-0">
              <h4 className={`text-sm font-medium line-clamp-1 ${
                !notification.isRead ? 'text-gray-900' : 'text-gray-700'
              }`}>
                {notification.title}
              </h4>
              <p className="text-xs text-gray-600 mt-1 line-clamp-2">
                {notification.message}
              </p>

              {/* 시간 표시 */}
              <div className="mt-2 text-xs text-gray-500">
                {formatRelativeTime(notification.createdAt)}
              </div>
            </div>

            {/* 삭제 버튼 */}
            <button
              onClick={(e) => {
                e.stopPropagation();
                onDelete?.(notification.id);
              }}
              className="p-1 text-gray-400 hover:text-red-600 rounded opacity-0 group-hover:opacity-100 transition-opacity"
              title="삭제"
            >
              <X className="w-3 h-3" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
});

NotificationItem.displayName = 'NotificationItem';

// 상대 시간 포맷터 (메모이제이션)
const formatRelativeTime = (timestamp: string): string => {
  const now = new Date();
  const date = new Date(timestamp);
  const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

  if (diffInSeconds < 60) return '방금 전';
  if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}분 전`;
  if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}시간 전`;
  if (diffInSeconds < 604800) return `${Math.floor(diffInSeconds / 86400)}일 전`;

  return date.toLocaleDateString('ko-KR');
};

export default function StableNotificationButton({ className = '' }: StableNotificationButtonProps) {
  const {
    notifications,
    unreadCount,
    connectionStatus,
    markAsRead,
    refresh
  } = useSimpleNotifications();

  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [showUnreadOnly, setShowUnreadOnly] = useState(true);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // 표시할 알림 목록 (메모이제이션)
  const displayNotifications = useMemo(() => {
    const filtered = showUnreadOnly
      ? notifications.filter(n => !n.isRead)
      : notifications;
    return filtered.slice(0, 20); // 최대 20개
  }, [notifications, showUnreadOnly]);

  // 외부 클릭 감지
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

  // ESC 키 처리
  useEffect(() => {
    const handleEscKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && isOpen) {
        setIsOpen(false);
      }
    };

    document.addEventListener('keydown', handleEscKey);
    return () => document.removeEventListener('keydown', handleEscKey);
  }, [isOpen]);

  // 연결 상태에 따른 스타일
  const connectionIcon = connectionStatus === 'connected' ? Wifi : WifiOff;
  const connectionColor = connectionStatus === 'connected' ? 'text-green-500' : 'text-gray-400';

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
          <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full min-w-[20px] h-5 flex items-center justify-center font-medium px-1">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {/* 알림 드롭다운 */}
      {isOpen && (
        <div className="absolute right-0 top-full mt-2 w-80 bg-white rounded-lg shadow-xl border border-gray-200 z-50 max-h-[70vh] overflow-hidden">
          {/* 헤더 */}
          <div className="flex items-center justify-between p-4 border-b border-gray-100 bg-gray-50">
            <div className="flex items-center gap-2">
              <h3 className="font-semibold text-gray-900">알림</h3>
              {unreadCount > 0 && (
                <span className="px-2 py-1 bg-blue-100 text-blue-700 text-xs rounded-full">
                  {unreadCount}개
                </span>
              )}
            </div>

            <div className="flex items-center gap-1">
              {/* 연결 상태 */}
              <div className={`p-1 ${connectionColor}`} title={`연결 상태: ${connectionStatus}`}>
                {React.createElement(connectionIcon, { className: 'w-4 h-4' })}
              </div>

              {/* 새로고침 */}
              <button
                onClick={() => refresh()}
                className="p-1 text-gray-400 hover:text-gray-600 rounded"
                title="새로고침"
              >
                <Bell className="w-4 h-4" />
              </button>

              {/* 설정 */}
              <button
                onClick={() => {
                  setIsOpen(false);
                  router.push('/notifications/settings');
                }}
                className="p-1 text-gray-400 hover:text-gray-600 rounded"
                title="설정"
              >
                <Settings className="w-4 h-4" />
              </button>

              {/* 닫기 */}
              <button
                onClick={() => setIsOpen(false)}
                className="p-1 text-gray-400 hover:text-gray-600 rounded"
                title="닫기"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* 필터 토글 */}
          <div className="px-4 py-2 border-b border-gray-100 bg-gray-50">
            <div className="flex items-center gap-4">
              <button
                onClick={() => setShowUnreadOnly(true)}
                className={`text-xs px-3 py-1 rounded-full transition-colors ${
                  showUnreadOnly
                    ? 'bg-blue-100 text-blue-700'
                    : 'text-gray-600 hover:text-gray-800'
                }`}
              >
                읽지 않음 ({unreadCount})
              </button>
              <button
                onClick={() => setShowUnreadOnly(false)}
                className={`text-xs px-3 py-1 rounded-full transition-colors ${
                  !showUnreadOnly
                    ? 'bg-blue-100 text-blue-700'
                    : 'text-gray-600 hover:text-gray-800'
                }`}
              >
                전체 ({notifications.length})
              </button>
            </div>
          </div>

          {/* 알림 목록 */}
          <div className="max-h-96 overflow-y-auto">
            {displayNotifications.length === 0 ? (
              <div className="p-8 text-center text-gray-500">
                <Bell className="w-12 h-12 mx-auto mb-4 text-gray-300" />
                <p className="text-sm">
                  {showUnreadOnly ? '읽지 않은 알림이 없습니다.' : '알림이 없습니다.'}
                </p>
              </div>
            ) : (
              <div className="divide-y divide-gray-100">
                {displayNotifications.map((notification) => (
                  <div key={notification.id} className="group">
                    <NotificationItem
                      notification={notification}
                      onRead={markAsRead}
                      onDelete={() => {/* 구현 필요 */}}
                    />
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* 푸터 */}
          <div className="p-3 border-t border-gray-100 bg-gray-50">
            <button
              onClick={() => {
                setIsOpen(false);
                router.push('/notifications');
              }}
              className="w-full text-sm text-center text-blue-600 hover:text-blue-700 font-medium py-1"
            >
              모든 알림 보기
            </button>
          </div>
        </div>
      )}
    </div>
  );
}