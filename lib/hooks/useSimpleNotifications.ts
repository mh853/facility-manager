// lib/hooks/useSimpleNotifications.ts - 단순 폴링 기반 알림 훅
'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { TokenManager } from '@/lib/api-client';

export interface SimpleNotification {
  id: string;
  title: string;
  message: string;
  category: string;
  priority: 'low' | 'medium' | 'high' | 'critical';
  related_resource_type?: string;
  related_resource_id?: string;
  related_url?: string;
  metadata?: Record<string, any>;
  created_by_name?: string;
  created_at: string;
  expires_at: string;
  is_system_notification: boolean;
  is_read: boolean;
}

export interface NotificationStats {
  critical: number;
  high: number;
  medium: number;
  low: number;
}

export interface UseSimpleNotificationsResult {
  notifications: SimpleNotification[];
  unreadCount: number;
  totalCount: number;
  priorityStats: NotificationStats;
  loading: boolean;
  error: string | null;
  lastFetched: string | null;

  // 액션들
  fetchNotifications: () => Promise<void>;
  markAsRead: (notificationIds: string[]) => Promise<void>;
  markAllAsRead: () => Promise<void>;
  deleteNotification: (notificationId: string) => Promise<void>;

  // 폴링 제어
  startPolling: () => void;
  stopPolling: () => void;
  isPolling: boolean;
}

interface UseSimpleNotificationsOptions {
  pollingInterval?: number; // 기본 30초
  enablePolling?: boolean; // 기본 true
  maxRetries?: number; // 기본 3
  onError?: (error: Error) => void;
  onNewNotification?: (notification: SimpleNotification) => void;
}

/**
 * 단순 폴링 기반 알림 훅
 * WebSocket 대신 HTTP 폴링을 사용하여 서버리스 환경에 최적화
 */
export function useSimpleNotifications(options: UseSimpleNotificationsOptions = {}): UseSimpleNotificationsResult {
  const {
    pollingInterval = 30000, // 30초
    enablePolling = true,
    maxRetries = 3,
    onError,
    onNewNotification
  } = options;

  // 상태 관리
  const [notifications, setNotifications] = useState<SimpleNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [totalCount, setTotalCount] = useState(0);
  const [priorityStats, setPriorityStats] = useState<NotificationStats>({
    critical: 0,
    high: 0,
    medium: 0,
    low: 0
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastFetched, setLastFetched] = useState<string | null>(null);
  const [isPolling, setIsPolling] = useState(false);

  // 참조 관리
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const retryCountRef = useRef(0);
  const isUnmountedRef = useRef(false);
  const lastETagRef = useRef<string | null>(null);

  // API 호출 함수
  const callAPI = useCallback(async (url: string, options: RequestInit = {}) => {
    const token = TokenManager.getToken();
    if (!token) {
      throw new Error('인증 토큰이 없습니다');
    }

    const headers = {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...options.headers
    };

    // ETag 지원 (조건부 요청)
    if (lastETagRef.current && options.method === undefined) {
      (headers as any)['If-None-Match'] = lastETagRef.current;
    }

    const response = await fetch(url, {
      ...options,
      headers
    });

    // 304 Not Modified 처리
    if (response.status === 304) {
      console.log('📦 [SIMPLE-NOTIFICATIONS] 캐시된 데이터 사용 (304 Not Modified)');
      return null; // 데이터 변경 없음
    }

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    // ETag 저장
    const etag = response.headers.get('ETag');
    if (etag) {
      lastETagRef.current = etag;
    }

    return response.json();
  }, []);

  // 알림 조회
  const fetchNotifications = useCallback(async () => {
    if (isUnmountedRef.current) return;

    try {
      setError(null);

      const data = await callAPI('/api/notifications/simple');

      // 304 응답 시 데이터 업데이트 하지 않음
      if (data === null) return;

      if (data.success && data.data) {
        const { notifications: newNotifications, unreadCount: newUnreadCount, totalCount: newTotalCount, priorityStats: newPriorityStats, lastFetched: newLastFetched } = data.data;

        // 새 알림 감지 및 콜백 호출
        if (notifications.length > 0 && newNotifications.length > notifications.length) {
          const newNotifs = newNotifications.slice(0, newNotifications.length - notifications.length);
          newNotifs.forEach((notif: SimpleNotification) => {
            if (onNewNotification) {
              onNewNotification(notif);
            }
          });
        }

        setNotifications(newNotifications);
        setUnreadCount(newUnreadCount);
        setTotalCount(newTotalCount);
        setPriorityStats(newPriorityStats);
        setLastFetched(newLastFetched);

        retryCountRef.current = 0; // 성공 시 재시도 카운터 리셋

        console.log('✅ [SIMPLE-NOTIFICATIONS] 알림 조회 성공:', {
          total: newTotalCount,
          unread: newUnreadCount,
          cached: data.data.cached || false
        });
      } else {
        throw new Error(data.error || '알림 조회에 실패했습니다');
      }
    } catch (err: any) {
      console.error('🔴 [SIMPLE-NOTIFICATIONS] 조회 오류:', err);

      retryCountRef.current++;
      const errorMessage = err.message || '알림 조회 중 오류가 발생했습니다';

      // 최대 재시도 횟수 초과 시에만 에러 상태 설정
      if (retryCountRef.current >= maxRetries) {
        setError(errorMessage);
        if (onError) {
          onError(new Error(errorMessage));
        }
      }
    } finally {
      setLoading(false);
    }
  }, [callAPI, notifications.length, maxRetries, onError, onNewNotification]);

  // 읽음 처리
  const markAsRead = useCallback(async (notificationIds: string[]) => {
    try {
      const data = await callAPI('/api/notifications/simple', {
        method: 'POST',
        body: JSON.stringify({
          action: 'markAsRead',
          notificationIds
        })
      });

      if (data?.success) {
        // 로컬 상태 업데이트
        setNotifications(prev =>
          prev.map(notif =>
            notificationIds.includes(notif.id)
              ? { ...notif, is_read: true }
              : notif
          )
        );

        // 읽지 않은 알림 수 재계산
        setUnreadCount(prev => Math.max(0, prev - notificationIds.length));

        console.log('✅ [SIMPLE-NOTIFICATIONS] 읽음 처리 성공:', notificationIds.length);
      } else {
        throw new Error(data?.error || '읽음 처리에 실패했습니다');
      }
    } catch (err: any) {
      console.error('🔴 [SIMPLE-NOTIFICATIONS] 읽음 처리 오류:', err);
      if (onError) {
        onError(new Error(err.message || '읽음 처리 중 오류가 발생했습니다'));
      }
    }
  }, [callAPI, onError]);

  // 모든 알림 읽음 처리
  const markAllAsRead = useCallback(async () => {
    try {
      const data = await callAPI('/api/notifications/simple', {
        method: 'POST',
        body: JSON.stringify({
          action: 'markAllAsRead',
          markAllAsRead: true
        })
      });

      if (data?.success) {
        // 로컬 상태 업데이트
        setNotifications(prev =>
          prev.map(notif => ({ ...notif, is_read: true }))
        );
        setUnreadCount(0);

        console.log('✅ [SIMPLE-NOTIFICATIONS] 모든 알림 읽음 처리 성공');
      } else {
        throw new Error(data?.error || '모든 알림 읽음 처리에 실패했습니다');
      }
    } catch (err: any) {
      console.error('🔴 [SIMPLE-NOTIFICATIONS] 모든 알림 읽음 처리 오류:', err);
      if (onError) {
        onError(new Error(err.message || '모든 알림 읽음 처리 중 오류가 발생했습니다'));
      }
    }
  }, [callAPI, onError]);

  // 알림 삭제
  const deleteNotification = useCallback(async (notificationId: string) => {
    try {
      const data = await callAPI(`/api/notifications/simple?id=${notificationId}`, {
        method: 'DELETE'
      });

      if (data?.success) {
        // 로컬 상태 업데이트
        setNotifications(prev => prev.filter(notif => notif.id !== notificationId));
        setTotalCount(prev => Math.max(0, prev - 1));

        console.log('✅ [SIMPLE-NOTIFICATIONS] 알림 삭제 성공:', notificationId);
      } else {
        throw new Error(data?.error || '알림 삭제에 실패했습니다');
      }
    } catch (err: any) {
      console.error('🔴 [SIMPLE-NOTIFICATIONS] 삭제 오류:', err);
      if (onError) {
        onError(new Error(err.message || '알림 삭제 중 오류가 발생했습니다'));
      }
    }
  }, [callAPI, onError]);

  // 폴링 시작
  const startPolling = useCallback(() => {
    if (pollingIntervalRef.current || !enablePolling) return;

    console.log('🔄 [SIMPLE-NOTIFICATIONS] 폴링 시작 (간격:', pollingInterval, 'ms)');
    setIsPolling(true);

    pollingIntervalRef.current = setInterval(() => {
      if (!isUnmountedRef.current) {
        fetchNotifications();
      }
    }, pollingInterval);
  }, [enablePolling, pollingInterval, fetchNotifications]);

  // 폴링 중지
  const stopPolling = useCallback(() => {
    if (pollingIntervalRef.current) {
      console.log('⏹️ [SIMPLE-NOTIFICATIONS] 폴링 중지');
      clearInterval(pollingIntervalRef.current);
      pollingIntervalRef.current = null;
      setIsPolling(false);
    }
  }, []);

  // 초기 로드 및 폴링 시작
  useEffect(() => {
    fetchNotifications();

    if (enablePolling) {
      startPolling();
    }

    return () => {
      isUnmountedRef.current = true;
      stopPolling();
    };
  }, [fetchNotifications, startPolling, stopPolling, enablePolling]);

  // 페이지 가시성 변경 시 폴링 제어
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        if (enablePolling && !pollingIntervalRef.current) {
          startPolling();
        }
        // 페이지가 다시 활성화될 때 즉시 업데이트
        fetchNotifications();
      } else {
        stopPolling();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [enablePolling, startPolling, stopPolling, fetchNotifications]);

  return {
    notifications,
    unreadCount,
    totalCount,
    priorityStats,
    loading,
    error,
    lastFetched,
    fetchNotifications,
    markAsRead,
    markAllAsRead,
    deleteNotification,
    startPolling,
    stopPolling,
    isPolling
  };
}