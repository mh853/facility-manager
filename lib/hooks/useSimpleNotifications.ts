// lib/hooks/useSimpleNotifications.ts - 안정적인 폴링 기반 알림 시스템
import { useState, useEffect, useCallback, useRef } from 'react';
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

export interface UseSimpleNotificationsResult {
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

export function useSimpleNotifications(userId?: string): UseSimpleNotificationsResult {
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [readStateCache, setReadStateCache] = useState<Set<string>>(new Set());
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // 알림 로드
  const loadNotifications = useCallback(async () => {
    try {
      console.log('📥 [SIMPLE-NOTIFICATIONS] 알림 로드 시작', { userId });

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
        .limit(20);

      if (globalError) {
        console.error('🔴 [SIMPLE-NOTIFICATIONS] 전역 알림 로드 오류:', globalError);
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
          .limit(20);

        if (taskError) {
          console.error('🔴 [SIMPLE-NOTIFICATIONS] 업무 알림 로드 오류:', taskError);
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
            business_name: notif.business_name,
            notification_type: notif.notification_type
          },
          type: 'task' as const
        }))
      ].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

      setNotifications(combinedNotifications);

      const unreadCount = combinedNotifications.filter(n => !n.read).length;
      console.log('✅ [SIMPLE-NOTIFICATIONS] 알림 로드 완료:', {
        global: globalNotifications?.length || 0,
        task: taskNotifications.length,
        total: combinedNotifications.length,
        unread: unreadCount
      });

    } catch (error) {
      console.error('🔴 [SIMPLE-NOTIFICATIONS] 알림 로드 실패:', error);
    }
  }, [userId, readStateCache]);

  // 폴링 시작
  const startPolling = useCallback(() => {
    if (pollingIntervalRef.current) return;

    console.log('🔄 [SIMPLE-NOTIFICATIONS] 폴링 시작');

    // 즉시 로드
    loadNotifications();

    // 30초마다 새로고침
    pollingIntervalRef.current = setInterval(() => {
      loadNotifications();
    }, 30000);
  }, [loadNotifications]);

  // 폴링 중지
  const stopPolling = useCallback(() => {
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current);
      pollingIntervalRef.current = null;
      console.log('⏹️ [SIMPLE-NOTIFICATIONS] 폴링 중지');
    }
  }, []);

  // 초기화
  useEffect(() => {
    startPolling();
    return () => stopPolling();
  }, [startPolling, stopPolling]);

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
          console.error('🔴 [SIMPLE-NOTIFICATIONS] 업무 알림 읽음 처리 오류:', error);
          // 실패 시 캐시에서 제거
          setReadStateCache(prev => {
            const newSet = new Set(prev);
            newSet.delete(notificationId);
            return newSet;
          });
          return;
        }
      }

      // 로컬 상태 업데이트
      setNotifications(prev =>
        prev.map(n => n.id === notificationId ? { ...n, read: true } : n)
      );

      console.log('✅ [SIMPLE-NOTIFICATIONS] 알림 읽음 처리:', notificationId);
    } catch (error) {
      console.error('🔴 [SIMPLE-NOTIFICATIONS] 읽음 처리 실패:', error);
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
        console.error('🔴 [SIMPLE-NOTIFICATIONS] 모든 알림 읽음 처리 오류:', error);
        return;
      }

      // 모든 알림을 읽음 캐시에 추가
      const allNotificationIds = notifications.map(n => n.id);
      setReadStateCache(prev => new Set([...prev, ...allNotificationIds]));

      // 로컬 상태 업데이트
      setNotifications(prev =>
        prev.map(n => ({ ...n, read: true }))
      );

      console.log('✅ [SIMPLE-NOTIFICATIONS] 모든 알림 읽음 처리 완료');
    } catch (error) {
      console.error('🔴 [SIMPLE-NOTIFICATIONS] 모든 읽음 처리 실패:', error);
    }
  }, [userId, notifications]);

  // 알림 제거 (로컬)
  const clearNotification = useCallback((notificationId: string) => {
    setNotifications(prev => prev.filter(n => n.id !== notificationId));
  }, []);

  // 모든 알림 제거 및 아카이브
  const clearAllNotifications = useCallback(async () => {
    try {
      if (!userId) {
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
          olderThanDays: 0
        })
      });

      if (response.ok) {
        const result = await response.json();
        console.log('✅ [SIMPLE-NOTIFICATIONS] 알림 아카이브 완료:', result.archivedCount);
      }

      // 로컬 상태 즉시 정리
      setNotifications([]);
      setReadStateCache(new Set());

      console.log('✅ [SIMPLE-NOTIFICATIONS] 모든 알림 정리 완료');
    } catch (error) {
      console.error('🔴 [SIMPLE-NOTIFICATIONS] 알림 정리 오류:', error);
      setNotifications([]);
    }
  }, [userId]);

  // 새로고침
  const refreshNotifications = useCallback(async () => {
    console.log('🔄 [SIMPLE-NOTIFICATIONS] 수동 새로고침');
    await loadNotifications();
  }, [loadNotifications]);

  // 재연결 (폴링 재시작)
  const reconnect = useCallback(async () => {
    console.log('🔄 [SIMPLE-NOTIFICATIONS] 재연결');
    stopPolling();
    setTimeout(() => startPolling(), 1000);
  }, [stopPolling, startPolling]);

  const unreadCount = notifications.filter(n => !n.read).length;

  return {
    notifications,
    unreadCount,
    isConnected: true, // 폴링 모드는 항상 연결됨
    connectionStatus: 'connected',
    markAsRead,
    markAllAsRead,
    clearNotification,
    clearAllNotifications,
    refreshNotifications,
    isPollingMode: true,
    reconnect
  };
}