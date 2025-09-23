'use client';

import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { Bell, BellRing, Settings, MoreHorizontal, Check, Trash2, ExternalLink, X, Wifi, WifiOff } from 'lucide-react';
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
  const [connectionState, setConnectionState] = useState<'connected' | 'connecting' | 'disconnected'>('disconnected');
  const [loadingStates, setLoadingStates] = useState<Record<string, boolean>>({});

  const dropdownRef = useRef<HTMLDivElement>(null);
  const previousUnreadCount = useRef(unreadCount);

  // 연결 상태 업데이트
  useEffect(() => {
    if (isConnected && connectionState !== 'connected') {
      setConnectionState('connected');
    } else if (!isConnected && connectionState !== 'disconnected') {
      setConnectionState('disconnected');
    }
  }, [isConnected, connectionState]);

  // 메모이제이션된 이벤트 핸들러들
  const handleClickOutside = useCallback((event: MouseEvent) => {
    if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
      setIsOpen(false);
    }
  }, []);

  const handleEscKey = useCallback((event: KeyboardEvent) => {
    if (event.key === 'Escape' && isOpen) {
      setIsOpen(false);
    }
  }, [isOpen]);

  // 외부 클릭시 드롭다운 닫기
  useEffect(() => {
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isOpen, handleClickOutside]);

  // ESC 키로 드롭다운 닫기
  useEffect(() => {
    document.addEventListener('keydown', handleEscKey);
    return () => document.removeEventListener('keydown', handleEscKey);
  }, [handleEscKey]);

  // 메모이제이션된 최근 알림 목록
  const recentNotifications = useMemo(() => {
    return notifications
      .slice(0, 10)
      .filter(notification => showAllRead || !notification.isRead);
  }, [notifications, showAllRead]);

  // 메모이제이션된 이벤트 핸들러들
  const handleNotificationClick = useCallback(async (notification: Notification) => {
    if (loadingStates[notification.id]) return;

    setLoadingStates(prev => ({ ...prev, [notification.id]: true }));

    try {
      // 읽지 않은 알림인 경우 읽음 처리
      if (!notification.isRead) {
        await markAsRead(notification.id);
      }

      // 관련 페이지로 이동
      if (notification.relatedUrl) {
        setIsOpen(false);
        router.push(notification.relatedUrl);
      }
    } catch (error) {
      console.error('알림 클릭 처리 오류:', error);
    } finally {
      setLoadingStates(prev => ({ ...prev, [notification.id]: false }));
    }
  }, [markAsRead, router, loadingStates]);

  const handleMarkAllAsRead = useCallback(async () => {
    if (loadingStates.markAll) return;

    setLoadingStates(prev => ({ ...prev, markAll: true }));
    try {
      await markAllAsRead();
    } catch (error) {
      console.error('모든 알림 읽음 처리 오류:', error);
    } finally {
      setLoadingStates(prev => ({ ...prev, markAll: false }));
    }
  }, [markAllAsRead, loadingStates.markAll]);

  const handleDeleteNotification = useCallback(async (notificationId: string, event: React.MouseEvent) => {
    event.stopPropagation();
    if (loadingStates[notificationId]) return;

    setLoadingStates(prev => ({ ...prev, [notificationId]: true }));
    try {
      await deleteNotification(notificationId);
    } catch (error) {
      console.error('알림 삭제 오류:', error);
    } finally {
      setLoadingStates(prev => ({ ...prev, [notificationId]: false }));
    }
  }, [deleteNotification, loadingStates]);

  const handleSettingsClick = useCallback(() => {
    setIsOpen(false);
    router.push('/admin/settings/notifications');
  }, [router]);

  const handleToggleDropdown = useCallback(() => {
    setIsOpen(prev => !prev);
  }, []);

  const handleToggleShowAllRead = useCallback(() => {
    setShowAllRead(prev => !prev);
  }, []);

  return (
    <div className={`relative ${className}`} ref={dropdownRef}>
      {/* 알림 버튼 */}
      <button
        onClick={handleToggleDropdown}
        className={`relative p-2 rounded-lg transition-all duration-200 transform hover:scale-105 ${
          isOpen
            ? 'bg-blue-50 text-blue-600 shadow-md'
            : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
        }`}
        aria-label={`알림 ${unreadCount}개${isConnected ? ', 실시간 연결됨' : ', 연결 끊김'}`}
        disabled={loading}
      >
        {/* 아이콘 애니메이션 */}
        <div className={`transition-transform duration-200 ${unreadCount > 0 ? 'animate-pulse' : ''}`}>
          {unreadCount > 0 ? (
            <BellRing className="w-5 h-5" />
          ) : (
            <Bell className="w-5 h-5" />
          )}
        </div>

        {/* 읽지 않은 알림 배지 - 부드러운 애니메이션 */}
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center font-medium animate-in slide-in-from-top-2 slide-in-from-right-2 duration-300">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}

        {/* 개선된 연결 상태 표시 */}
        <div className="absolute bottom-0 right-0 flex items-center justify-center">
          {connectionState === 'connected' ? (
            <Wifi className="w-2 h-2 text-green-400" />
          ) : connectionState === 'connecting' ? (
            <div className="w-2 h-2 bg-yellow-400 rounded-full animate-pulse" />
          ) : (
            <WifiOff className="w-2 h-2 text-gray-400" />
          )}
        </div>

        {/* 로딩 인디케이터 */}
        {loading && (
          <div className="absolute inset-0 flex items-center justify-center bg-white bg-opacity-50 rounded-lg">
            <div className="w-3 h-3 border border-blue-500 border-t-transparent rounded-full animate-spin" />
          </div>
        )}
      </button>

      {/* 알림 드롭다운 - 부드러운 애니메이션 */}
      {isOpen && (
        <div className="absolute right-0 top-full mt-2 w-96 bg-white rounded-lg shadow-xl border border-gray-200 z-50 max-h-[80vh] overflow-hidden animate-in slide-in-from-top-2 duration-200">
          {/* 헤더 */}
          <div className="flex items-center justify-between p-4 border-b border-gray-100 bg-gray-50">
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2">
                <Bell className="w-4 h-4 text-gray-600" />
                <h3 className="font-semibold text-gray-900">알림</h3>
              </div>

              {/* 상태 정보 */}
              <div className="flex items-center gap-2 text-xs text-gray-500">
                {loading && (
                  <div className="flex items-center gap-1">
                    <div className="w-3 h-3 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                    <span>동기화 중...</span>
                  </div>
                )}

                {!loading && (
                  <div className="flex items-center gap-1">
                    {connectionState === 'connected' ? (
                      <>
                        <Wifi className="w-3 h-3 text-green-500" />
                        <span className="text-green-600">실시간</span>
                      </>
                    ) : (
                      <>
                        <WifiOff className="w-3 h-3 text-gray-400" />
                        <span>오프라인</span>
                      </>
                    )}
                  </div>
                )}
              </div>
            </div>

            <div className="flex items-center gap-1">
              {/* 읽음/전체 토글 */}
              <button
                onClick={handleToggleShowAllRead}
                className="px-2 py-1 text-xs text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded transition-colors"
              >
                {showAllRead ? '읽지 않음만' : '전체 보기'}
              </button>

              {/* 모두 읽음 */}
              {unreadCount > 0 && (
                <button
                  onClick={handleMarkAllAsRead}
                  disabled={loadingStates.markAll}
                  className="px-2 py-1 text-xs text-blue-600 hover:text-blue-700 hover:bg-blue-50 rounded flex items-center gap-1 transition-colors disabled:opacity-50"
                >
                  {loadingStates.markAll ? (
                    <div className="w-3 h-3 border border-blue-500 border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <Check className="w-3 h-3" />
                  )}
                  모두 읽음
                </button>
              )}

              {/* 설정 */}
              <button
                onClick={handleSettingsClick}
                className="p-1 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded transition-colors"
                title="알림 설정"
              >
                <Settings className="w-4 h-4" />
              </button>

              {/* 닫기 */}
              <button
                onClick={() => setIsOpen(false)}
                className="p-1 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* 알림 목록 */}
          <div className="max-h-96 overflow-y-auto scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-gray-100">
            {recentNotifications.length === 0 ? (
              <div className="p-8 text-center text-gray-500">
                <Bell className="w-12 h-12 mx-auto mb-4 text-gray-300" />
                <div className="space-y-2">
                  <p className="text-sm font-medium">
                    {showAllRead ? '알림이 없습니다' : '읽지 않은 알림이 없습니다'}
                  </p>
                  <p className="text-xs text-gray-400">
                    {showAllRead ? '새로운 알림을 기다리고 있습니다.' : '모든 알림을 확인했습니다.'}
                  </p>
                </div>
              </div>
            ) : (
              <div className="divide-y divide-gray-100">
                {recentNotifications.map((notification) => (
                  <div
                    key={notification.id}
                    className={`relative p-4 hover:bg-gray-50 cursor-pointer transition-all duration-200 group ${
                      !notification.isRead ? 'bg-blue-50/30' : ''
                    } ${loadingStates[notification.id] ? 'opacity-50 pointer-events-none' : ''}`}
                    onClick={() => handleNotificationClick(notification)}
                  >
                    {/* 로딩 오버레이 */}
                    {loadingStates[notification.id] && (
                      <div className="absolute inset-0 flex items-center justify-center bg-white bg-opacity-50 z-10">
                        <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                      </div>
                    )}

                    <div className="flex items-start gap-3">
                      {/* 카테고리 아이콘 */}
                      <div className={`flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center text-sm transition-colors ${
                        notificationHelpers.getPriorityColor(notification.priority)
                      }`}>
                        {notificationHelpers.getCategoryIcon(notification.category)}
                      </div>

                      {/* 알림 내용 */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1 min-w-0">
                            <h4 className={`text-sm font-medium transition-colors ${
                              !notification.isRead ? 'text-gray-900' : 'text-gray-700'
                            }`}>
                              {notification.title}
                            </h4>
                            <p className="text-xs text-gray-600 mt-1 line-clamp-2 leading-relaxed">
                              {notification.message}
                            </p>

                            {/* 발신자 및 시간 */}
                            <div className="flex items-center gap-2 mt-2 text-xs text-gray-500">
                              {notification.createdByName && (
                                <>
                                  <span className="font-medium">{notification.createdByName}</span>
                                  <span>•</span>
                                </>
                              )}
                              <span>{notificationHelpers.getRelativeTime(notification.createdAt)}</span>

                              {/* 우선순위 표시 */}
                              {notification.priority === 'critical' && (
                                <>
                                  <span>•</span>
                                  <span className="text-red-600 font-medium">긴급</span>
                                </>
                              )}
                              {notification.priority === 'high' && (
                                <>
                                  <span>•</span>
                                  <span className="text-orange-600 font-medium">중요</span>
                                </>
                              )}
                            </div>
                          </div>

                          {/* 액션 버튼들 */}
                          <div className="flex items-center gap-1 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                            {/* 외부 링크 */}
                            {notification.relatedUrl && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleNotificationClick(notification);
                                }}
                                className="p-1 text-gray-400 hover:text-blue-600 rounded hover:bg-blue-100 transition-colors"
                                title="상세 보기"
                              >
                                <ExternalLink className="w-3 h-3" />
                              </button>
                            )}

                            {/* 삭제 */}
                            <button
                              onClick={(e) => handleDeleteNotification(notification.id, e)}
                              disabled={loadingStates[notification.id]}
                              className="p-1 text-gray-400 hover:text-red-600 rounded hover:bg-red-100 transition-colors disabled:opacity-50"
                              title="삭제"
                            >
                              {loadingStates[notification.id] ? (
                                <div className="w-3 h-3 border border-red-500 border-t-transparent rounded-full animate-spin" />
                              ) : (
                                <Trash2 className="w-3 h-3" />
                              )}
                            </button>
                          </div>
                        </div>

                        {/* 읽지 않음 표시 */}
                        {!notification.isRead && (
                          <div className="flex items-center gap-2 mt-2">
                            <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse" />
                            <span className="text-xs text-blue-600 font-medium">읽지 않음</span>
                          </div>
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
              <div className="flex items-center justify-between">
                <span className="text-xs text-gray-500">
                  {recentNotifications.length}개 표시됨
                </span>
                <button
                  onClick={() => {
                    setIsOpen(false);
                    router.push('/admin/notifications');
                  }}
                  className="text-sm text-blue-600 hover:text-blue-700 font-medium hover:underline transition-colors"
                >
                  모든 알림 보기
                </button>
              </div>
            </div>
          )}

          {/* 빈 상태일 때의 액션 */}
          {recentNotifications.length === 0 && !loading && (
            <div className="p-3 border-t border-gray-100 bg-gray-50">
              <button
                onClick={handleSettingsClick}
                className="w-full text-sm text-center text-gray-600 hover:text-gray-700 font-medium flex items-center justify-center gap-2"
              >
                <Settings className="w-4 h-4" />
                알림 설정
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}