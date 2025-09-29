'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Bell, Check, Clock, User, FolderOpen, AlertCircle, X, Wifi, WifiOff, RefreshCw, Trash2, Filter } from 'lucide-react';
import { useTierNotifications, TierNotification, NotificationTier } from '@/contexts/TierNotificationContext';

interface TierNotificationBellProps {
  showTierFilter?: boolean;
  defaultTier?: 'all' | NotificationTier;
  className?: string;
}

export default function TierNotificationBell({
  showTierFilter = true,
  defaultTier = 'all',
  className = ''
}: TierNotificationBellProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedTier, setSelectedTier] = useState<'all' | NotificationTier>(defaultTier);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const {
    notifications,
    personalNotifications,
    teamNotifications,
    companyNotifications,
    unreadCount,
    unreadCountByTier,
    loading,
    isConnected,
    isConnecting,
    connectionError,
    lastEventTime,
    markAsRead,
    markAllAsRead,
    markTierAsRead,
    deleteAllNotifications,
    deleteReadNotifications,
    reconnectRealtime
  } = useTierNotifications();

  // 브라우저 알림 권한 요청
  useEffect(() => {
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

  // 현재 선택된 계층의 알림 목록
  const getDisplayNotifications = (): TierNotification[] => {
    switch (selectedTier) {
      case 'personal': return personalNotifications;
      case 'team': return teamNotifications;
      case 'company': return companyNotifications;
      default: return notifications;
    }
  };

  // 현재 선택된 계층의 읽지 않은 수
  const getDisplayUnreadCount = (): number => {
    switch (selectedTier) {
      case 'personal': return unreadCountByTier.personal;
      case 'team': return unreadCountByTier.team;
      case 'company': return unreadCountByTier.company;
      default: return unreadCount;
    }
  };

  // 계층별 아이콘
  const getTierIcon = (tier?: NotificationTier) => {
    switch (tier) {
      case 'personal': return <User className="h-4 w-4" />;
      case 'team': return <FolderOpen className="h-4 w-4" />;
      case 'company': return <AlertCircle className="h-4 w-4" />;
      default: return <Bell className="h-4 w-4" />;
    }
  };

  // 계층별 색상
  const getTierColor = (tier?: NotificationTier) => {
    switch (tier) {
      case 'personal': return 'text-blue-600 bg-blue-100';
      case 'team': return 'text-green-600 bg-green-100';
      case 'company': return 'text-purple-600 bg-purple-100';
      default: return 'text-gray-600 bg-gray-100';
    }
  };

  // 우선순위별 색상
  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'critical': return 'text-red-600 bg-red-100';
      case 'high': return 'text-orange-600 bg-orange-100';
      case 'medium': return 'text-blue-600 bg-blue-100';
      case 'low': return 'text-gray-600 bg-gray-100';
      default: return 'text-gray-600 bg-gray-100';
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

  // 계층별 읽음 처리
  const handleMarkTierAsRead = async () => {
    if (selectedTier === 'all') {
      await markAllAsRead();
    } else {
      await markTierAsRead(selectedTier);
    }
  };

  const displayNotifications = getDisplayNotifications();
  const displayUnreadCount = getDisplayUnreadCount();

  return (
    <div className={`relative ${className}`} ref={dropdownRef}>
      {/* 알림 벨 버튼 */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-md transition-colors duration-200"
        title={
          isConnected
            ? `3-tier 알림 시스템 연결됨${lastEventTime ? ` (마지막 업데이트: ${lastEventTime.toLocaleTimeString()})` : ''}`
            : isConnecting
            ? '3-tier 알림 시스템 연결 중...'
            : connectionError
            ? `연결 오류: ${connectionError}`
            : '오프라인'
        }
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
            : connectionError
            ? 'bg-red-500'
            : 'bg-gray-400'
        }`} />

        {/* 연결 오류 시 경고 표시 */}
        {connectionError && (
          <AlertCircle className="absolute -top-0.5 -right-0.5 h-3 w-3 text-red-500" />
        )}
      </button>

      {/* 드롭다운 메뉴 */}
      {isOpen && (
        <div className="absolute right-0 mt-2 w-96 bg-white rounded-lg shadow-xl border border-gray-200 z-50 max-h-96 overflow-hidden">
          {/* 헤더 */}
          <div className="flex items-center justify-between p-4 border-b border-gray-200">
            <div className="flex items-center space-x-3">
              <h3 className="text-lg font-semibold text-gray-900">알림</h3>

              {/* 연결 상태 표시 */}
              <div className="flex items-center space-x-1">
                {isConnected ? (
                  <div title="3-tier 알림 시스템 연결됨">
                    <Wifi className="h-4 w-4 text-green-500" />
                  </div>
                ) : isConnecting ? (
                  <div title="연결 중...">
                    <RefreshCw className="h-4 w-4 text-yellow-500 animate-spin" />
                  </div>
                ) : (
                  <div title="연결 끊김">
                    <WifiOff className="h-4 w-4 text-red-500" />
                  </div>
                )}
              </div>
            </div>

            <div className="flex items-center space-x-2">
              {/* 재연결 버튼 (연결이 끊어진 경우에만 표시) */}
              {!isConnected && !isConnecting && (
                <button
                  onClick={reconnectRealtime}
                  className="p-1 text-blue-600 hover:text-blue-800"
                  title="재연결"
                >
                  <RefreshCw className="h-4 w-4" />
                </button>
              )}

              {/* 계층별 읽음 버튼 */}
              {displayUnreadCount > 0 && (
                <button
                  onClick={handleMarkTierAsRead}
                  className="text-sm text-blue-600 hover:text-blue-800 font-medium"
                >
                  {selectedTier === 'all' ? '모두 읽음' : `${selectedTier} 읽음`}
                </button>
              )}

              {/* 모든 알림 제거 버튼 */}
              {notifications.length > 0 && (
                <button
                  onClick={deleteAllNotifications}
                  className="text-sm text-red-600 hover:text-red-800 font-medium flex items-center space-x-1"
                  title="모든 알림을 완전히 삭제합니다"
                >
                  <Trash2 className="h-3 w-3" />
                  <span>모든 알림 제거</span>
                </button>
              )}

              {/* 닫기 버튼 */}
              <button
                onClick={() => setIsOpen(false)}
                className="p-1 text-gray-400 hover:text-gray-600"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* 계층 필터 */}
          {showTierFilter && (
            <div className="border-b border-gray-200 bg-gray-50">
              <div className="flex items-center justify-between px-4 py-2">
                <div className="flex space-x-1">
                  <button
                    onClick={() => setSelectedTier('all')}
                    className={`px-3 py-1 text-sm font-medium rounded-md transition-colors ${
                      selectedTier === 'all'
                        ? 'bg-blue-100 text-blue-700 border-blue-300'
                        : 'text-gray-600 hover:bg-gray-100'
                    }`}
                  >
                    전체 ({unreadCount})
                  </button>
                  <button
                    onClick={() => setSelectedTier('personal')}
                    className={`px-3 py-1 text-sm font-medium rounded-md transition-colors flex items-center space-x-1 ${
                      selectedTier === 'personal'
                        ? 'bg-blue-100 text-blue-700 border-blue-300'
                        : 'text-gray-600 hover:bg-gray-100'
                    }`}
                  >
                    <User className="h-3 w-3" />
                    <span>개인 ({unreadCountByTier.personal})</span>
                  </button>
                  <button
                    onClick={() => setSelectedTier('team')}
                    className={`px-3 py-1 text-sm font-medium rounded-md transition-colors flex items-center space-x-1 ${
                      selectedTier === 'team'
                        ? 'bg-green-100 text-green-700 border-green-300'
                        : 'text-gray-600 hover:bg-gray-100'
                    }`}
                  >
                    <FolderOpen className="h-3 w-3" />
                    <span>팀 ({unreadCountByTier.team})</span>
                  </button>
                  <button
                    onClick={() => setSelectedTier('company')}
                    className={`px-3 py-1 text-sm font-medium rounded-md transition-colors flex items-center space-x-1 ${
                      selectedTier === 'company'
                        ? 'bg-purple-100 text-purple-700 border-purple-300'
                        : 'text-gray-600 hover:bg-gray-100'
                    }`}
                  >
                    <AlertCircle className="h-3 w-3" />
                    <span>전사 ({unreadCountByTier.company})</span>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* 알림 목록 */}
          <div className="max-h-80 overflow-y-auto">
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
              </div>
            ) : displayNotifications.length > 0 ? (
              <div className="divide-y divide-gray-200">
                {displayNotifications.map((notification) => (
                  <div
                    key={notification.id}
                    className={`p-4 hover:bg-gray-50 transition-colors duration-200 ${
                      !notification.isRead ? 'bg-blue-50 border-l-4 border-blue-500' : ''
                    }`}
                  >
                    <div className="flex items-start space-x-3">
                      {/* 계층 및 우선순위 아이콘 */}
                      <div className="flex flex-col space-y-1">
                        <div className={`p-1 rounded-full ${getTierColor(notification.tier)}`}>
                          {getTierIcon(notification.tier)}
                        </div>
                        <div className={`p-1 rounded-full ${getPriorityColor(notification.priority)}`}>
                          <div className="w-2 h-2 rounded-full bg-current"></div>
                        </div>
                      </div>

                      {/* 내용 */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center space-x-2">
                              <p className={`text-sm font-medium ${!notification.isRead ? 'text-gray-900' : 'text-gray-700'}`}>
                                {notification.title}
                              </p>
                              {notification.tier && (
                                <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${getTierColor(notification.tier)}`}>
                                  {notification.tier === 'personal' ? '개인' : notification.tier === 'team' ? '팀' : '전사'}
                                </span>
                              )}
                            </div>
                            <p className="text-sm text-gray-600 mt-1">
                              {notification.message}
                            </p>

                            {/* 추가 정보 */}
                            {(notification.createdByName || notification.relatedResourceType || notification.metadata) && (
                              <div className="flex items-center space-x-2 mt-2 text-xs text-gray-500">
                                {notification.createdByName && (
                                  <span>보낸이: {notification.createdByName}</span>
                                )}
                                {notification.relatedResourceType && (
                                  <span>유형: {notification.relatedResourceType}</span>
                                )}
                                {notification.metadata?.business_name && (
                                  <span>사업장: {notification.metadata.business_name}</span>
                                )}
                              </div>
                            )}

                            <p className="text-xs text-gray-500 mt-2">
                              {formatTime(notification.createdAt)}
                            </p>
                          </div>

                          {/* 읽음 처리 버튼 */}
                          {!notification.isRead && (
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
                    {notification.relatedUrl && (
                      <div className="mt-3">
                        <a
                          href={notification.relatedUrl}
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
                <p className="text-sm">
                  {selectedTier === 'all' ? '새로운 알림이 없습니다' : `${selectedTier} 알림이 없습니다`}
                </p>
              </div>
            )}
          </div>

          {/* 더보기 버튼 - 항상 표시 */}
          <div className="border-t border-gray-200 p-2">
            <button
              onClick={() => {
                setIsOpen(false);
                window.location.href = '/notifications/history';
              }}
              className="w-full text-sm text-blue-600 hover:text-blue-800 font-medium py-2 hover:bg-gray-50 rounded-md transition-colors duration-200"
            >
              이전 알림 보기
            </button>
          </div>
        </div>
      )}
    </div>
  );
}