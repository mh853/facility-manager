'use client';

import React, { createContext, useContext, useEffect, useState, ReactNode, useCallback, useRef, useMemo } from 'react';
import { useAuth } from './AuthContext';
import { TokenManager } from '@/lib/api-client';
import { useSupabaseRealtime } from '@/hooks/useSupabaseRealtime';
import type { RealtimePostgresChangesPayload } from '@supabase/supabase-js';

// 알림 타입 정의
export type NotificationCategory =
  | 'task_created' | 'task_updated' | 'task_assigned' | 'task_status_changed' | 'task_completed'
  | 'system_maintenance' | 'system_update'
  | 'security_alert' | 'login_attempt'
  | 'report_submitted' | 'report_approved'
  | 'user_created' | 'user_updated'
  | 'business_added' | 'file_uploaded'
  | 'backup_completed' | 'maintenance_scheduled';

export type NotificationPriority = 'low' | 'medium' | 'high' | 'critical';

export interface Notification {
  id: string;
  title: string;
  message: string;
  category: NotificationCategory;
  priority: NotificationPriority;
  relatedResourceType?: string;
  relatedResourceId?: string;
  relatedUrl?: string;
  metadata?: Record<string, any>;
  createdById?: string;
  createdByName?: string;
  createdAt: string;
  expiresAt: string;
  isSystemNotification: boolean;
  isRead: boolean;
}

export interface NotificationSettings {
  taskNotifications: boolean;
  systemNotifications: boolean;
  securityNotifications: boolean;
  reportNotifications: boolean;
  userNotifications: boolean;
  businessNotifications: boolean;
  fileNotifications: boolean;
  maintenanceNotifications: boolean;
  pushNotificationsEnabled: boolean;
  emailNotificationsEnabled: boolean;
  soundNotificationsEnabled: boolean;
  showLowPriority: boolean;
  showMediumPriority: boolean;
  showHighPriority: boolean;
  showCriticalPriority: boolean;
  quietHoursStart: string;
  quietHoursEnd: string;
  quietHoursEnabled: boolean;
}

interface NotificationContextType {
  notifications: Notification[];
  unreadCount: number;
  settings: NotificationSettings | null;
  loading: boolean;

  // 알림 관리
  fetchNotifications: () => Promise<void>;
  markAsRead: (notificationId: string) => Promise<void>;
  markAllAsRead: () => Promise<void>;
  deleteNotification: (notificationId: string) => Promise<void>;
  deleteAllNotifications: () => Promise<void>;
  deleteReadNotifications: () => Promise<void>;

  // 알림 생성
  createNotification: (notification: Omit<Notification, 'id' | 'createdAt' | 'expiresAt' | 'isRead'>) => Promise<void>;

  // 설정 관리
  updateSettings: (newSettings: Partial<NotificationSettings>) => Promise<void>;

  // Supabase Realtime 연결 상태
  isConnected: boolean;
  isConnecting: boolean;
  connectionError: string | null;
  lastEventTime: Date | null;

  // 실시간 업데이트
  subscribeToRealtime: () => void;
  unsubscribeFromRealtime: () => void;
  reconnectRealtime: () => void;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

export function NotificationProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [settings, setSettings] = useState<NotificationSettings | null>(null);
  const [loading, setLoading] = useState(true);

  // Supabase Realtime 실시간 알림 처리
  const {
    isConnected,
    isConnecting,
    connectionError,
    lastEvent: lastEventTime,
    subscribe,
    unsubscribe,
    reconnect,
    sendBroadcast
  } = useSupabaseRealtime({
    tableName: 'task_notifications',
    eventTypes: ['INSERT', 'UPDATE'],
    autoConnect: !!user,
    onNotification: handleRealtimeNotification,
    onConnect: () => {
      console.log('✅ [NOTIFICATIONS] Supabase Realtime 연결됨 - WebSocket 완전 대체');
    },
    onDisconnect: () => {
      console.log('❌ [NOTIFICATIONS] Supabase Realtime 연결 끊김');
    },
    onError: (error) => {
      console.error('❌ [NOTIFICATIONS] Supabase Realtime 오류:', error);
    }
  });

  // 실시간 알림 처리 함수
  function handleRealtimeNotification(payload: RealtimePostgresChangesPayload<any>) {
    try {
      const { eventType, new: newRecord, old: oldRecord } = payload;

      console.log('🔔 [REALTIME] 알림 이벤트 수신:', {
        eventType,
        recordId: (newRecord as any)?.id || (oldRecord as any)?.id,
        timestamp: new Date().toISOString()
      });

      if (eventType === 'INSERT' && newRecord) {
        // task_notifications 구조에 맞게 새 알림 추가
        const newNotification: Notification = {
          id: newRecord.id,
          title: `업무 알림: ${newRecord.business_name}`,
          message: newRecord.message,
          category: (newRecord.notification_type || 'task_updated') as NotificationCategory,
          priority: newRecord.priority as NotificationPriority,
          relatedResourceType: 'task',
          relatedResourceId: newRecord.task_id,
          relatedUrl: `/admin/tasks/${newRecord.task_id}`,
          metadata: { business_name: newRecord.business_name, task_id: newRecord.task_id },
          createdById: newRecord.user_id,
          createdByName: newRecord.user_name,
          createdAt: newRecord.created_at,
          expiresAt: newRecord.expires_at || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
          isSystemNotification: false,
          isRead: newRecord.is_read
        };

        setNotifications(prev => [newNotification, ...prev.slice(0, 49)]); // 최대 50개 유지

        // 브라우저 알림 표시
        if (settings?.pushNotificationsEnabled && 'Notification' in window && Notification.permission === 'granted') {
          new Notification(newNotification.title, {
            body: newNotification.message,
            icon: '/icon-192x192.png',
            badge: '/icon-192x192.png',
            tag: newNotification.id,
            requireInteraction: newNotification.priority === 'critical'
          });
        }

        // 소리 알림
        if (settings?.soundNotificationsEnabled) {
          playNotificationSound(newNotification.priority);
        }

      } else if (eventType === 'UPDATE' && newRecord) {
        // 알림 상태 업데이트 (읽음 처리 등)
        setNotifications(prev =>
          prev.map(notification =>
            notification.id === newRecord.id
              ? { ...notification, isRead: newRecord.is_read }
              : notification
          )
        );
      }
    } catch (error) {
      console.error('❌ [REALTIME] 알림 처리 오류:', error);
    }
  }

  // 알림 목록 조회 - Supabase Realtime으로 실시간 업데이트되므로 초기 로드만 담당
  const fetchNotifications = useCallback(async () => {
    if (!user) return;

    try {
      setLoading(true);

      const token = TokenManager.getToken();
      if (!token || token === 'null' || token === 'undefined') {
        console.warn('⚠️ [NOTIFICATIONS] 토큰이 없거나 유효하지 않음:', token);
        return;
      }

      // 토큰 유효성 검사
      if (!TokenManager.isTokenValid(token)) {
        console.warn('⚠️ [NOTIFICATIONS] 토큰이 만료됨');
        return;
      }

      console.log('🔑 [NOTIFICATIONS] 토큰 확인됨, 알림 조회 시작');

      // 일반 알림과 업무 알림을 동시에 조회
      const [generalResponse, taskResponse] = await Promise.all([
        fetch('/api/notifications', {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        }),
        fetch('/api/notifications?taskNotifications=true', {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        })
      ]);

      if (!generalResponse.ok || !taskResponse.ok) {
        throw new Error(`알림 조회 실패: ${generalResponse.status} / ${taskResponse.status}`);
      }

      const [generalData, taskData] = await Promise.all([
        generalResponse.json(),
        taskResponse.json()
      ]);

      const allNotifications: Notification[] = [];

      // 일반 알림 변환 (기존 notifications 테이블)
      if (generalData.success && generalData.data) {
        const generalNotifications = generalData.data.map((notif: any) => ({
          id: notif.id,
          title: notif.title,
          message: notif.message,
          category: notif.category as NotificationCategory,
          priority: notif.priority as NotificationPriority,
          relatedResourceType: notif.relatedResourceType,
          relatedResourceId: notif.relatedResourceId,
          relatedUrl: notif.relatedUrl,
          metadata: notif.metadata || {},
          createdById: notif.createdById,
          createdByName: notif.createdByName,
          createdAt: notif.createdAt,
          expiresAt: notif.expiresAt,
          isSystemNotification: notif.isSystemNotification,
          isRead: notif.isRead
        }));
        allNotifications.push(...generalNotifications);
      }

      // 업무 알림 변환 (task_notifications 테이블)
      if (taskData.success && taskData.taskNotifications) {
        const taskNotifications = taskData.taskNotifications.map((notif: any) => ({
          id: `task-${notif.id}`, // ID 충돌 방지
          title: `업무 할당: ${notif.business_name}`, // 업무 알림 제목
          message: notif.message,
          category: 'task_assigned' as NotificationCategory,
          priority: (notif.priority === 'urgent' ? 'critical' : notif.priority) as NotificationPriority,
          relatedResourceType: 'task',
          relatedResourceId: notif.task_id,
          relatedUrl: `/admin/tasks/${notif.task_id}`,
          metadata: {
            business_name: notif.business_name,
            task_id: notif.task_id,
            notification_type: notif.notification_type
          },
          createdById: notif.user_id,
          createdByName: notif.user_name || '시스템',
          createdAt: notif.created_at,
          expiresAt: notif.expires_at || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
          isSystemNotification: false,
          isRead: notif.is_read
        }));
        allNotifications.push(...taskNotifications);
      }

      // 생성 시간 순으로 정렬 (최신 순)
      allNotifications.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

      setNotifications(allNotifications);

        console.log('✅ [NOTIFICATIONS] 초기 알림 로드 완료:', {
          total: allNotifications.length,
          unread: allNotifications.filter((n: any) => !n.isRead).length,
          general: generalData.success ? (generalData.data?.length || 0) : 0,
          tasks: taskData.success ? (taskData.taskNotifications?.length || 0) : 0
        });
      }
    } catch (error) {
      console.error('❌ [NOTIFICATIONS] 알림 조회 오류:', error);
    } finally {
      setLoading(false);
    }
  }, [user]);

  // 알림 설정 조회
  const fetchSettings = useCallback(async () => {
    if (!user) return;

    try {
      const response = await fetch('/api/notifications/settings', {
        headers: {
          'Authorization': `Bearer ${TokenManager.getToken()}`
        }
      });

      if (!response.ok) {
        if (response.status === 401) {
          console.warn('⚠️ [NOTIFICATIONS] 인증 실패 - 캐시된 설정 확인 후 기본 설정 사용');

          // 먼저 캐시된 설정이 있는지 확인
          const cachedSettings = localStorage.getItem('notification-settings');
          if (cachedSettings) {
            try {
              const parsed = JSON.parse(cachedSettings);
              setSettings(parsed);
              console.log('✅ [NOTIFICATIONS] 캐시된 설정 로드 성공');
              return;
            } catch (error) {
              console.warn('⚠️ [NOTIFICATIONS] 캐시된 설정 파싱 실패:', error);
            }
          }

          // 캐시된 설정이 없으면 기본 설정 사용
          const defaultSettings = {
            taskNotifications: true,
            systemNotifications: true,
            securityNotifications: true,
            reportNotifications: true,
            userNotifications: true,
            businessNotifications: true,
            fileNotifications: true,
            maintenanceNotifications: true,
            pushNotificationsEnabled: true,
            emailNotificationsEnabled: false,
            soundNotificationsEnabled: true,
            showLowPriority: true,
            showMediumPriority: true,
            showHighPriority: true,
            showCriticalPriority: true,
            quietHoursStart: '22:00:00',
            quietHoursEnd: '08:00:00',
            quietHoursEnabled: false
          };
          setSettings(defaultSettings);

          // 기본 설정을 캐시에 저장
          localStorage.setItem('notification-settings', JSON.stringify(defaultSettings));
          console.log('✅ [NOTIFICATIONS] 기본 설정 적용 및 캐시 저장');
          return;
        }
        throw new Error('알림 설정을 불러오는데 실패했습니다.');
      }

      const data = await response.json();
      if (data.success) {
        setSettings(data.data);
        // 성공적으로 로드된 설정을 캐시에 저장
        localStorage.setItem('notification-settings', JSON.stringify(data.data));
        console.log('✅ [NOTIFICATIONS] 설정 로드 성공 및 캐시 저장');
      }
    } catch (error) {
      console.error('알림 설정 조회 오류:', error);
    }
  }, [user]);

  // 알림 읽음 처리
  const markAsRead = useCallback(async (notificationId: string) => {
    if (!user) return;

    try {
      const token = TokenManager.getToken();
      if (!token || !TokenManager.isTokenValid(token)) {
        console.warn('⚠️ [NOTIFICATIONS] markAsRead: 토큰이 유효하지 않음');
        return;
      }

      const response = await fetch(`/api/notifications/${notificationId}/read`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error('알림 읽음 처리에 실패했습니다.');
      }

      // 로컬 상태 업데이트
      setNotifications(prev =>
        prev.map(notification =>
          notification.id === notificationId
            ? { ...notification, isRead: true }
            : notification
        )
      );
    } catch (error) {
      console.error('알림 읽음 처리 오류:', error);
    }
  }, [user]);

  // 모든 알림 읽음 처리
  const markAllAsRead = useCallback(async () => {
    if (!user) return;

    try {
      const response = await fetch('/api/notifications/read-all', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${TokenManager.getToken()}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error('모든 알림 읽음 처리에 실패했습니다.');
      }

      // 로컬 상태 업데이트
      setNotifications(prev =>
        prev.map(notification => ({ ...notification, isRead: true }))
      );
    } catch (error) {
      console.error('모든 알림 읽음 처리 오류:', error);
    }
  }, [user]);

  // 알림 삭제
  const deleteNotification = useCallback(async (notificationId: string) => {
    if (!user) return;

    try {
      const response = await fetch(`/api/notifications/${notificationId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${TokenManager.getToken()}`
        }
      });

      if (!response.ok) {
        throw new Error('알림 삭제에 실패했습니다.');
      }

      // 로컬 상태 업데이트
      setNotifications(prev =>
        prev.filter(notification => notification.id !== notificationId)
      );
    } catch (error) {
      console.error('알림 삭제 오류:', error);
    }
  }, [user]);

  // 모든 알림 완전 삭제
  const deleteAllNotifications = useCallback(async () => {
    if (!user) return;

    try {
      const token = TokenManager.getToken();
      if (!token || !TokenManager.isTokenValid(token)) {
        console.warn('⚠️ [NOTIFICATIONS] deleteAllNotifications: 토큰이 유효하지 않음');
        return;
      }

      const response = await fetch('/api/notifications/delete-all', {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) {
        throw new Error('모든 알림 삭제에 실패했습니다.');
      }

      const data = await response.json();
      console.log('✅ [NOTIFICATIONS] 모든 알림 삭제 완료:', data.data);

      // 로컬 상태 초기화
      setNotifications([]);

    } catch (error) {
      console.error('❌ [NOTIFICATIONS] 모든 알림 삭제 오류:', error);
      throw error;
    }
  }, [user]);

  // 읽은 알림만 삭제
  const deleteReadNotifications = useCallback(async () => {
    if (!user) return;

    try {
      const response = await fetch('/api/notifications/delete-all', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${TokenManager.getToken()}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          deleteType: 'read'
        })
      });

      if (!response.ok) {
        throw new Error('읽은 알림 삭제에 실패했습니다.');
      }

      const data = await response.json();
      console.log('✅ [NOTIFICATIONS] 읽은 알림 삭제 완료:', data.data);

      // 로컬 상태 업데이트 (읽은 알림만 제거)
      setNotifications(prev =>
        prev.filter(notification => !notification.isRead)
      );

    } catch (error) {
      console.error('❌ [NOTIFICATIONS] 읽은 알림 삭제 오류:', error);
      throw error;
    }
  }, [user]);

  // 알림 생성
  const createNotification = useCallback(async (
    notification: Omit<Notification, 'id' | 'createdAt' | 'expiresAt' | 'isRead'>
  ) => {
    if (!user) return;

    try {
      const response = await fetch('/api/notifications', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${TokenManager.getToken()}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(notification)
      });

      if (!response.ok) {
        throw new Error('알림 생성에 실패했습니다.');
      }

      const data = await response.json();
      if (data.success) {
        // 실시간으로 알림이 추가되므로 여기서는 별도 처리 불필요
        console.log('알림이 생성되었습니다:', data.data);
      }
    } catch (error) {
      console.error('알림 생성 오류:', error);
    }
  }, [user]);

  // 설정 업데이트
  const updateSettings = useCallback(async (newSettings: Partial<NotificationSettings>) => {
    if (!user) return;

    try {
      const response = await fetch('/api/notifications/settings', {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${TokenManager.getToken()}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(newSettings)
      });

      if (!response.ok) {
        throw new Error('알림 설정 업데이트에 실패했습니다.');
      }

      const data = await response.json();
      if (data.success) {
        const updatedSettings = (prev: NotificationSettings | null) => prev ? { ...prev, ...newSettings } : null;
        const newSettingsData = updatedSettings(settings);
        setSettings(newSettingsData);

        // 업데이트된 설정을 캐시에 저장
        if (newSettingsData) {
          localStorage.setItem('notification-settings', JSON.stringify(newSettingsData));
          console.log('✅ [NOTIFICATIONS] 설정 업데이트 성공 및 캐시 갱신');
        }
      }
    } catch (error) {
      console.error('알림 설정 업데이트 오류:', error);
    }
  }, [user]);

  // 실시간 구독 관리 - Supabase Realtime 사용
  const subscribeToRealtime = useCallback(() => {
    console.log('📡 [REALTIME] 실시간 구독 시작');
    subscribe();
  }, [subscribe]);

  const unsubscribeFromRealtime = useCallback(() => {
    console.log('📡 [REALTIME] 실시간 구독 해제');
    unsubscribe();
  }, [unsubscribe]);

  const reconnectRealtime = useCallback(() => {
    console.log('🔄 [REALTIME] 수동 재연결');
    reconnect();
  }, [reconnect]);

  // 알림 소리 재생
  const playNotificationSound = useCallback((priority: NotificationPriority) => {
    try {
      const audio = new Audio();

      // 우선순위별 다른 소리
      switch (priority) {
        case 'critical':
          audio.src = '/sounds/critical-notification.mp3';
          break;
        case 'high':
          audio.src = '/sounds/high-notification.mp3';
          break;
        case 'medium':
          audio.src = '/sounds/medium-notification.mp3';
          break;
        case 'low':
          audio.src = '/sounds/low-notification.mp3';
          break;
        default:
          audio.src = '/sounds/default-notification.mp3';
      }

      audio.volume = 0.3; // 적당한 볼륨
      audio.play().catch(console.error);
    } catch (error) {
      console.error('알림 소리 재생 오류:', error);
    }
  }, []);

  // 브라우저 알림 권한 요청
  const requestNotificationPermission = useCallback(async () => {
    if ('Notification' in window && Notification.permission === 'default') {
      await Notification.requestPermission();
    }
  }, []);

  // 읽지 않은 알림 수 계산
  const unreadCount = useMemo(() => {
    return notifications.filter(notification => !notification.isRead).length;
  }, [notifications]);

  // 사용자 로그인 시 초기화
  useEffect(() => {
    if (user) {
      fetchNotifications();
      fetchSettings();
      requestNotificationPermission();
      // Supabase Realtime은 useSupabaseRealtime 훅에서 자동 관리됨
    } else {
      setNotifications([]);
      setSettings(null);
      // 로그아웃 시 실시간 구독 해제는 useSupabaseRealtime 훅에서 자동 처리됨
    }
  }, [user, fetchNotifications, fetchSettings, requestNotificationPermission]);

  const value: NotificationContextType = {
    notifications,
    unreadCount,
    settings,
    loading,
    fetchNotifications,
    markAsRead,
    markAllAsRead,
    deleteNotification,
    deleteAllNotifications,
    deleteReadNotifications,
    createNotification,
    updateSettings,
    isConnected,
    isConnecting,
    connectionError,
    lastEventTime,
    subscribeToRealtime,
    unsubscribeFromRealtime,
    reconnectRealtime
  };

  return (
    <NotificationContext.Provider value={value}>
      {children}
    </NotificationContext.Provider>
  );
}

export function useNotification() {
  const context = useContext(NotificationContext);
  if (context === undefined) {
    throw new Error('useNotification must be used within a NotificationProvider');
  }
  return context;
}

// 알림 헬퍼 함수들
export const notificationHelpers = {
  // 카테고리별 아이콘 매핑
  getCategoryIcon: (category: NotificationCategory): string => {
    const iconMap: Record<NotificationCategory, string> = {
      'task_created': '📝',
      'task_updated': '✏️',
      'task_assigned': '👤',
      'task_status_changed': '🔄',
      'task_completed': '✅',
      'system_maintenance': '🔧',
      'system_update': '🆙',
      'security_alert': '🚨',
      'login_attempt': '🔐',
      'report_submitted': '📊',
      'report_approved': '✅',
      'user_created': '👤',
      'user_updated': '👤',
      'business_added': '🏢',
      'file_uploaded': '📎',
      'backup_completed': '💾',
      'maintenance_scheduled': '📅'
    };
    return iconMap[category] || '📢';
  },

  // 우선순위별 색상 매핑
  getPriorityColor: (priority: NotificationPriority): string => {
    const colorMap: Record<NotificationPriority, string> = {
      'low': 'text-gray-600 bg-gray-100',
      'medium': 'text-blue-600 bg-blue-100',
      'high': 'text-orange-600 bg-orange-100',
      'critical': 'text-red-600 bg-red-100'
    };
    return colorMap[priority];
  },

  // 상대 시간 표시
  getRelativeTime: (timestamp: string): string => {
    const now = new Date();
    const date = new Date(timestamp);
    const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

    if (diffInSeconds < 60) return '방금 전';
    if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}분 전`;
    if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}시간 전`;
    if (diffInSeconds < 604800) return `${Math.floor(diffInSeconds / 86400)}일 전`;

    return date.toLocaleDateString('ko-KR');
  }
};