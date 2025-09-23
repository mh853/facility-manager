// lib/hooks/useRealtimeNotifications.ts - Supabase Realtime 알림 훅
import { useState, useEffect, useCallback, useRef } from 'react';
import { realtimeManager, type NotificationCallback, type TaskUpdateCallback } from '@/lib/realtime/realtime-manager';
import { supabase } from '@/lib/supabase';

export interface NotificationItem {
  id: string;
  title: string;
  message: string;
  category?: string;
  priority: 'low' | 'medium' | 'high' | 'critical';
  timestamp: string;
  read: boolean;
  related_url?: string;
  metadata?: Record<string, any>;
  type?: 'global' | 'task';
}

export interface UseRealtimeNotificationsResult {
  notifications: NotificationItem[];
  unreadCount: number;
  isConnected: boolean;
  connectionStatus: 'connected' | 'disconnected' | 'error' | 'connecting';
  markAsRead: (notificationId: string) => Promise<void>;
  markAllAsRead: () => Promise<void>;
  clearNotification: (notificationId: string) => void;
  clearAllNotifications: () => void;
  refreshNotifications: () => Promise<void>;
  isPollingMode: boolean;
  reconnect: () => Promise<void>;
}

export function useRealtimeNotifications(userId?: string): UseRealtimeNotificationsResult {
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<'connected' | 'disconnected' | 'error' | 'connecting'>('connecting');
  const [isPollingMode, setIsPollingMode] = useState(false);

  // 클라이언트 읽음 상태 캐시 (실시간 업데이트 시 유지용)
  const [readStateCache, setReadStateCache] = useState<Set<string>>(new Set());

  const unsubscribeRefs = useRef<(() => void)[]>([]);
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // 알림 로드
  const loadInitialNotifications = useCallback(async () => {
    try {
      console.log('📥 [REALTIME-HOOK] 초기 알림 로드 시작', { userId });

      // 전역 알림 로드 (테스트 알림 제외)
      const { data: globalNotifications, error: globalError } = await supabase
        .from('notifications')
        .select('*')
        .gt('expires_at', new Date().toISOString())
        .not('title', 'like', '%테스트%')
        .not('title', 'like', '%🧪%')
        .not('message', 'like', '%테스트%')
        .not('created_by_name', 'in', '("System Test", "테스트 관리자")')
        .order('created_at', { ascending: false })
        .limit(50);

      if (globalError) {
        console.error('🔴 [REALTIME-HOOK] 전역 알림 로드 오류:', globalError);
      }

      let taskNotifications: any[] = [];

      // 사용자별 업무 알림 로드 (테스트 알림 제외)
      if (userId) {
        const { data: userTaskNotifications, error: taskError } = await supabase
          .from('task_notifications')
          .select('*')
          .eq('user_id', userId)
          .eq('is_read', false)
          .gt('expires_at', new Date().toISOString())
          .not('message', 'like', '%테스트%')
          .not('message', 'like', '%🧪%')
          .not('user_id', 'eq', 'test-user')
          .order('created_at', { ascending: false })
          .limit(50);

        if (taskError) {
          console.error('🔴 [REALTIME-HOOK] 업무 알림 로드 오류:', taskError);
        } else {
          taskNotifications = userTaskNotifications || [];
        }
      }

      // 알림 병합 및 표준화 (읽음 상태 캐시 적용)
      const combinedNotifications: NotificationItem[] = [
        ...(globalNotifications || []).map(notif => ({
          id: notif.id,
          title: notif.title,
          message: notif.message,
          category: notif.category,
          priority: notif.priority as 'low' | 'medium' | 'high' | 'critical',
          timestamp: notif.created_at,
          read: readStateCache.has(notif.id), // 캐시된 읽음 상태 적용
          related_url: notif.related_url,
          metadata: notif.metadata,
          type: 'global' as const
        })),
        ...taskNotifications.map(notif => ({
          id: notif.id,
          title: notif.notification_type === 'assignment' ? '새 업무 배정' :
                notif.notification_type === 'status_change' ? '업무 상태 변경' :
                notif.notification_type === 'unassignment' ? '업무 배정 해제' : '업무 알림',
          message: notif.message,
          category: notif.notification_type,
          priority: notif.priority === 'urgent' ? 'critical' :
                   notif.priority === 'high' ? 'high' : 'medium' as 'low' | 'medium' | 'high' | 'critical',
          timestamp: notif.created_at,
          read: readStateCache.has(notif.id) || notif.is_read, // 캐시 또는 DB 읽음 상태
          related_url: `/admin/tasks?task=${notif.task_id}`,
          metadata: {
            ...notif.metadata,
            task_id: notif.task_id,
            business_name: notif.business_name
          },
          type: 'task' as const
        }))
      ];

      // 시간순 정렬
      combinedNotifications.sort((a, b) =>
        new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
      );

      setNotifications(combinedNotifications);

      console.log('✅ [REALTIME-HOOK] 초기 알림 로드 완료:', {
        global: globalNotifications?.length || 0,
        task: taskNotifications.length,
        total: combinedNotifications.length,
        unread: combinedNotifications.filter(n => !n.read).length
      });

    } catch (error) {
      console.error('🔴 [REALTIME-HOOK] 초기 알림 로드 실패:', error);
    }
  }, [userId]);

  // 실시간 알림 콜백
  const handleNewNotification: NotificationCallback = useCallback((notification: any) => {
    console.log('🔔 [REALTIME-HOOK] 새 알림 수신:', notification);

    const newNotification: NotificationItem = {
      id: notification.id,
      title: notification.title || '알림',
      message: notification.message,
      category: notification.category || notification.notification_type,
      priority: notification.priority === 'urgent' ? 'critical' :
               notification.priority === 'high' ? 'high' :
               notification.priority === 'critical' ? 'critical' : 'medium',
      timestamp: notification.created_at || new Date().toISOString(),
      read: false,
      related_url: notification.related_url ||
                   (notification.task_id ? `/admin/tasks?task=${notification.task_id}` : undefined),
      metadata: notification.metadata || {},
      type: notification.task_id ? 'task' : 'global'
    };

    setNotifications(prev => {
      // 중복 제거 후 추가
      const filtered = prev.filter(n => n.id !== newNotification.id);
      return [newNotification, ...filtered].slice(0, 100); // 최대 100개 유지
    });

  }, []);

  // 시설 업무 업데이트 콜백
  const handleTaskUpdate: TaskUpdateCallback = useCallback((update: any) => {
    console.log('📋 [REALTIME-HOOK] 시설 업무 업데이트:', update);
    // 필요 시 업무 관련 추가 처리
  }, []);

  // 연결 상태 모니터링
  useEffect(() => {
    const handleConnectionChange = (status: 'connected' | 'disconnected' | 'error', error?: any) => {
      console.log(`🔌 [REALTIME-HOOK] 연결 상태 변경: ${status}`, error);
      setIsConnected(status === 'connected');
      setConnectionStatus(status);

      const stats = realtimeManager.getConnectionStats();
      setIsPollingMode(stats.isPolling);

      if (status === 'connected') {
        // 연결 복구 시 알림 새로고침
        loadInitialNotifications();
      }
    };

    realtimeManager.onConnectionChange(handleConnectionChange);

    return () => {
      // 연결 상태 콜백 정리는 RealtimeManager에서 지원하지 않으므로
      // 컴포넌트 언마운트 시 전체 정리로 처리
    };
  }, [loadInitialNotifications]);

  // 실시간 구독 설정
  useEffect(() => {
    console.log('🚀 [REALTIME-HOOK] 실시간 구독 설정 시작', { userId });

    // 초기 알림 로드
    loadInitialNotifications();

    // 전역 알림 구독
    const unsubscribeGlobal = realtimeManager.subscribeToNotifications(handleNewNotification);
    unsubscribeRefs.current.push(unsubscribeGlobal);

    // 사용자별 업무 알림 구독
    if (userId) {
      const unsubscribeTask = realtimeManager.subscribeToTaskNotifications(userId, handleNewNotification);
      unsubscribeRefs.current.push(unsubscribeTask);
    }

    // 시설 업무 변경 구독
    const unsubscribeFacility = realtimeManager.subscribeToFacilityTasks(handleTaskUpdate);
    unsubscribeRefs.current.push(unsubscribeFacility);

    // 폴링 폴백 (연결 실패 시)
    const startPollingFallback = () => {
      if (pollingIntervalRef.current) return;

      console.log('🔄 [REALTIME-HOOK] 폴링 폴백 시작');
      setIsPollingMode(true);

      pollingIntervalRef.current = setInterval(() => {
        loadInitialNotifications();
      }, 15000); // 15초마다 폴링
    };

    const stopPollingFallback = () => {
      if (pollingIntervalRef.current) {
        console.log('⏹️ [REALTIME-HOOK] 폴링 폴백 중지');
        clearInterval(pollingIntervalRef.current);
        pollingIntervalRef.current = null;
        setIsPollingMode(false);
      }
    };

    // 연결 실패 시 폴링 시작
    setTimeout(() => {
      if (!realtimeManager.isRealtimeConnected()) {
        startPollingFallback();
      }
    }, 5000);

    return () => {
      console.log('🧹 [REALTIME-HOOK] 구독 정리');
      unsubscribeRefs.current.forEach(unsubscribe => unsubscribe());
      unsubscribeRefs.current = [];
      stopPollingFallback();
    };
  }, [userId, handleNewNotification, handleTaskUpdate, loadInitialNotifications]);

  // 알림 읽음 처리
  const markAsRead = useCallback(async (notificationId: string) => {
    try {
      const notification = notifications.find(n => n.id === notificationId);
      if (!notification) return;

      // 캐시에 읽음 상태 저장 (즉시 적용)
      setReadStateCache(prev => new Set([...prev, notificationId]));

      if (notification.type === 'task') {
        // 업무 알림 읽음 처리 (백그라운드)
        const { error } = await supabase
          .from('task_notifications')
          .update({ is_read: true })
          .eq('id', notificationId);

        if (error) {
          console.error('🔴 [REALTIME-HOOK] 업무 알림 읽음 처리 오류:', error);
          // 실패 시 캐시에서 제거
          setReadStateCache(prev => {
            const newSet = new Set(prev);
            newSet.delete(notificationId);
            return newSet;
          });
          return;
        }
      }

      // 로컬 상태 업데이트 (캐시 적용 위해 다시 로드)
      setNotifications(prev =>
        prev.map(n => n.id === notificationId ? { ...n, read: true } : n)
      );

      console.log('✅ [REALTIME-HOOK] 알림 읽음 처리:', notificationId);
    } catch (error) {
      console.error('🔴 [REALTIME-HOOK] 읽음 처리 실패:', error);
    }
  }, [notifications]);

  // 모든 알림 읽음 처리
  const markAllAsRead = useCallback(async () => {
    try {
      if (!userId) return;

      // 업무 알림 모두 읽음 처리
      const { error } = await supabase
        .from('task_notifications')
        .update({ is_read: true })
        .eq('user_id', userId)
        .eq('is_read', false);

      if (error) {
        console.error('🔴 [REALTIME-HOOK] 모든 알림 읽음 처리 오류:', error);
        return;
      }

      // 로컬 상태 업데이트
      setNotifications(prev =>
        prev.map(n => ({ ...n, read: true }))
      );

      console.log('✅ [REALTIME-HOOK] 모든 알림 읽음 처리 완료');
    } catch (error) {
      console.error('🔴 [REALTIME-HOOK] 모든 읽음 처리 실패:', error);
    }
  }, [userId]);

  // 알림 제거 (로컬에서만)
  const clearNotification = useCallback((notificationId: string) => {
    setNotifications(prev => prev.filter(n => n.id !== notificationId));
  }, []);

  // 모든 알림 제거 및 아카이브 (서버 + 로컬)
  const clearAllNotifications = useCallback(async () => {
    try {
      if (!userId) {
        // userId가 없으면 로컬에서만 제거
        setNotifications([]);
        return;
      }

      // 서버에서 읽은 알림을 히스토리로 아카이브
      const response = await fetch('/api/notifications/history', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('auth_token') || ''}`
        },
        body: JSON.stringify({
          action: 'archive_read',
          olderThanDays: 0 // 모든 읽은 알림 즉시 아카이브
        })
      });

      if (response.ok) {
        const result = await response.json();
        console.log('✅ [REALTIME-HOOK] 알림 아카이브 완료:', result.archivedCount);
      } else {
        console.warn('⚠️ [REALTIME-HOOK] 알림 아카이브 실패');
      }

      // 로컬 상태 즉시 정리
      setNotifications([]);
      setReadStateCache(new Set()); // 읽음 캐시도 초기화

      console.log('✅ [REALTIME-HOOK] 모든 알림 정리 완료');
    } catch (error) {
      console.error('🔴 [REALTIME-HOOK] 알림 정리 오류:', error);
      // 실패해도 로컬은 정리
      setNotifications([]);
    }
  }, [userId]);

  // 알림 새로고침
  const refreshNotifications = useCallback(async () => {
    console.log('🔄 [REALTIME-HOOK] 수동 새로고침');
    await loadInitialNotifications();
  }, [loadInitialNotifications]);

  // 수동 재연결
  const reconnect = useCallback(async () => {
    console.log('🔌 [REALTIME-HOOK] 수동 재연결 시도');
    await realtimeManager.reconnect();
  }, []);

  // 읽지 않은 알림 개수 계산
  const unreadCount = notifications.filter(n => !n.read).length;

  return {
    notifications,
    unreadCount,
    isConnected,
    connectionStatus,
    markAsRead,
    markAllAsRead,
    clearNotification,
    clearAllNotifications,
    refreshNotifications,
    isPollingMode,
    reconnect
  };
}