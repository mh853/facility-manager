'use client';

import React, { createContext, useContext, useEffect, useState, ReactNode, useCallback, useRef, useMemo } from 'react';
import { useAuth } from './AuthContext';
import { TokenManager } from '@/lib/api-client';

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

  // 알림 생성
  createNotification: (notification: Omit<Notification, 'id' | 'createdAt' | 'expiresAt' | 'isRead'>) => Promise<void>;

  // 설정 관리
  updateSettings: (newSettings: Partial<NotificationSettings>) => Promise<void>;

  // WebSocket 연결 상태
  isConnected: boolean;

  // 실시간 업데이트
  subscribeToRealtime: () => void;
  unsubscribeFromRealtime: () => void;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

export function NotificationProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [settings, setSettings] = useState<NotificationSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [isConnected, setIsConnected] = useState(false);

  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const reconnectAttempts = useRef(0);
  const maxReconnectAttempts = 5;

  // 알림 목록 조회
  const fetchNotifications = useCallback(async () => {
    if (!user) return;

    try {
      setLoading(true);
      const response = await fetch('/api/notifications', {
        headers: {
          'Authorization': `Bearer ${TokenManager.getToken()}`
        }
      });

      if (!response.ok) {
        throw new Error('알림을 불러오는데 실패했습니다.');
      }

      const data = await response.json();
      if (data.success) {
        setNotifications(data.data || []);
      }
    } catch (error) {
      console.error('알림 조회 오류:', error);
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
        throw new Error('알림 설정을 불러오는데 실패했습니다.');
      }

      const data = await response.json();
      if (data.success) {
        setSettings(data.data);
      }
    } catch (error) {
      console.error('알림 설정 조회 오류:', error);
    }
  }, [user]);

  // 알림 읽음 처리
  const markAsRead = useCallback(async (notificationId: string) => {
    if (!user) return;

    try {
      const response = await fetch(`/api/notifications/${notificationId}/read`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${TokenManager.getToken()}`,
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
        setSettings(prev => prev ? { ...prev, ...newSettings } : null);
      }
    } catch (error) {
      console.error('알림 설정 업데이트 오류:', error);
    }
  }, [user]);

  // WebSocket 연결
  const connectWebSocket = useCallback(() => {
    if (!user || wsRef.current?.readyState === WebSocket.OPEN) return;

    try {
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const token = TokenManager.getToken();
      const wsUrl = `${protocol}//${window.location.host}/api/ws/notifications?token=${token}`;

      wsRef.current = new WebSocket(wsUrl);

      wsRef.current.onopen = () => {
        console.log('✅ 알림 WebSocket 연결됨');
        setIsConnected(true);
        reconnectAttempts.current = 0;
      };

      wsRef.current.onclose = () => {
        console.log('❌ 알림 WebSocket 연결 끊김');
        setIsConnected(false);

        // 자동 재연결 시도
        if (reconnectAttempts.current < maxReconnectAttempts) {
          reconnectAttempts.current++;
          reconnectTimeoutRef.current = setTimeout(() => {
            connectWebSocket();
          }, Math.pow(2, reconnectAttempts.current) * 1000); // 지수 백오프
        }
      };

      wsRef.current.onerror = (error) => {
        console.error('❌ 알림 WebSocket 오류:', error);
        setIsConnected(false);
      };

      wsRef.current.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);

          switch (data.type) {
            case 'notification_created':
              // 새 알림 추가
              setNotifications(prev => [data.notification, ...prev]);

              // 브라우저 알림 표시 (권한이 있는 경우)
              if (settings?.pushNotificationsEnabled && 'Notification' in window && Notification.permission === 'granted') {
                new Notification(data.notification.title, {
                  body: data.notification.message,
                  icon: '/icon-192x192.png',
                  badge: '/icon-192x192.png',
                  tag: data.notification.id
                });
              }

              // 소리 알림 (설정된 경우)
              if (settings?.soundNotificationsEnabled) {
                playNotificationSound(data.notification.priority);
              }
              break;

            case 'notification_updated':
              // 알림 업데이트
              setNotifications(prev =>
                prev.map(notification =>
                  notification.id === data.notification.id ? data.notification : notification
                )
              );
              break;

            case 'notification_deleted':
              // 알림 삭제
              setNotifications(prev =>
                prev.filter(notification => notification.id !== data.notificationId)
              );
              break;

            default:
              console.log('알 수 없는 WebSocket 메시지:', data);
          }
        } catch (error) {
          console.error('WebSocket 메시지 처리 오류:', error);
        }
      };
    } catch (error) {
      console.error('WebSocket 연결 오류:', error);
      setIsConnected(false);
    }
  }, [user, settings]);

  // WebSocket 연결 해제
  const disconnectWebSocket = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }

    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }

    setIsConnected(false);
  }, []);

  // 실시간 구독/해제
  const subscribeToRealtime = useCallback(() => {
    connectWebSocket();
  }, [connectWebSocket]);

  const unsubscribeFromRealtime = useCallback(() => {
    disconnectWebSocket();
  }, [disconnectWebSocket]);

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
      connectWebSocket();
    } else {
      setNotifications([]);
      setSettings(null);
      disconnectWebSocket();
    }

    return () => {
      disconnectWebSocket();
    };
  }, [user, fetchNotifications, fetchSettings, requestNotificationPermission, connectWebSocket, disconnectWebSocket]);

  // 페이지 가시성 변경 시 WebSocket 재연결
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && user && !isConnected) {
        connectWebSocket();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [user, isConnected, connectWebSocket]);

  const value: NotificationContextType = {
    notifications,
    unreadCount,
    settings,
    loading,
    fetchNotifications,
    markAsRead,
    markAllAsRead,
    deleteNotification,
    createNotification,
    updateSettings,
    isConnected,
    subscribeToRealtime,
    unsubscribeFromRealtime
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