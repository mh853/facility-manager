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
  const lastConnectAttempt = useRef<number>(0);
  const minReconnectDelay = 1000; // 1초
  const maxReconnectDelay = 30000; // 30초
  const circuitBreakerTimeout = 300000; // 5분 후 재시도 허용

  // 하이브리드 알림 시스템: 단순 API 사용 + WebSocket 폴백
  const fetchNotifications = useCallback(async () => {
    if (!user) return;

    try {
      setLoading(true);

      // 먼저 단순 API로 시도
      const simpleResponse = await fetch('/api/notifications/simple', {
        headers: {
          'Authorization': `Bearer ${TokenManager.getToken()}`
        }
      });

      if (simpleResponse.ok) {
        const simpleData = await simpleResponse.json();

        if (simpleData.success && simpleData.data) {
          const transformedNotifications = simpleData.data.notifications.map((notif: any) => ({
            id: notif.id,
            title: notif.title,
            message: notif.message,
            category: notif.category as NotificationCategory,
            priority: notif.priority as NotificationPriority,
            relatedResourceType: notif.related_resource_type,
            relatedResourceId: notif.related_resource_id,
            relatedUrl: notif.related_url,
            metadata: notif.metadata,
            createdById: notif.created_by_id,
            createdByName: notif.created_by_name,
            createdAt: notif.created_at,
            expiresAt: notif.expires_at,
            isSystemNotification: notif.is_system_notification,
            isRead: notif.is_read
          }));

          setNotifications(transformedNotifications);

          console.log('✅ [NOTIFICATIONS] 하이브리드 시스템 - 단순 API 사용:', {
            total: simpleData.data.totalCount,
            unread: simpleData.data.unreadCount,
            source: 'simple_api'
          });

          return; // 성공 시 기존 로직 건너뛰기
        }
      }

      // 단순 API 실패 시 기존 로직으로 폴백
      console.warn('⚠️ [NOTIFICATIONS] 단순 API 실패, 기존 시스템으로 폴백');

      // 일반 알림과 업무 알림을 병렬로 조회
      const [notificationsResponse, taskNotificationsResponse] = await Promise.all([
        fetch('/api/notifications', {
          headers: {
            'Authorization': `Bearer ${TokenManager.getToken()}`
          }
        }),
        fetch('/api/notifications?taskNotifications=true', {
          headers: {
            'Authorization': `Bearer ${TokenManager.getToken()}`
          }
        })
      ]);

      if (!notificationsResponse.ok) {
        console.error('일반 알림 조회 실패:', notificationsResponse.status);
        return;
      }

      const notificationsData = await notificationsResponse.json();

      // 업무 알림 처리 - 실패 시 빈 배열로 fallback
      let taskNotificationsData = { data: { taskNotifications: [] } };
      if (taskNotificationsResponse.ok) {
        try {
          taskNotificationsData = await taskNotificationsResponse.json();
        } catch (error) {
          console.warn('업무 알림 파싱 실패:', error);
        }
      } else {
        console.warn('업무 알림 조회 실패:', taskNotificationsResponse.status);
      }

      // 업무 알림을 일반 알림 형식으로 변환
      const taskNotifications = (taskNotificationsData.data?.taskNotifications || []).map((taskNotif: any) => ({
        id: taskNotif.id,
        title: '업무 알림',
        message: taskNotif.message,
        category: 'task_assigned' as NotificationCategory,
        priority: taskNotif.priority === 'urgent' ? 'critical' as NotificationPriority :
                 taskNotif.priority === 'high' ? 'high' as NotificationPriority : 'medium' as NotificationPriority,
        relatedResourceType: 'task',
        relatedResourceId: taskNotif.task_id,
        metadata: {
          business_name: taskNotif.business_name,
          notification_type: taskNotif.notification_type
        },
        createdAt: taskNotif.created_at,
        expiresAt: taskNotif.expires_at || new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
        isSystemNotification: false,
        isRead: taskNotif.is_read
      }));

      // 일반 알림과 업무 알림을 통합하여 시간순 정렬
      const allNotifications = [
        ...(notificationsData.data || []),
        ...taskNotifications
      ].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

      setNotifications(allNotifications);

      console.log('✅ [NOTIFICATIONS] 하이브리드 시스템 - 기존 API 사용 (폴백):', {
        total: allNotifications.length,
        source: 'legacy_api'
      });

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

  // WebSocket 연결 (백오프 및 Circuit Breaker 패턴)
  const connectWebSocket = useCallback(async () => {
    if (!user || wsRef.current?.readyState === WebSocket.OPEN) return;

    const now = Date.now();

    // Circuit Breaker: 최대 재시도 횟수 초과 시 5분 대기
    if (reconnectAttempts.current >= maxReconnectAttempts) {
      if (now - lastConnectAttempt.current < circuitBreakerTimeout) {
        console.warn(`⚠️ WebSocket Circuit Breaker 활성화: ${Math.floor((circuitBreakerTimeout - (now - lastConnectAttempt.current)) / 1000)}초 후 재시도 가능`);
        return;
      } else {
        // Circuit Breaker 타임아웃 후 재시도 허용
        reconnectAttempts.current = 0;
        console.log('🔄 WebSocket Circuit Breaker 해제: 재연결 시도 재개');
      }
    }

    // 너무 빠른 재시도 방지 (최소 1초 간격)
    if (now - lastConnectAttempt.current < minReconnectDelay) {
      console.warn('⚠️ WebSocket 재연결 시도가 너무 빨름: 1초 후 재시도');
      setTimeout(() => connectWebSocket(), minReconnectDelay);
      return;
    }

    lastConnectAttempt.current = now;

    try {
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const token = TokenManager.getToken();

      if (!token) {
        console.warn('⚠️ WebSocket 연결 중단: 인증 토큰 없음');
        return;
      }

      // Socket.IO 클라이언트 동적 임포트
      const socketIOClient = await import('socket.io-client');
      const io = socketIOClient.io;

      console.log(`🔌 WebSocket 연결 시도 ${reconnectAttempts.current + 1}/${maxReconnectAttempts}: /api/socket`);

      const socket = io({
        path: '/api/socket',
        auth: { token },
        transports: ['websocket', 'polling'],
        timeout: 20000,
        reconnection: false // 수동 재연결 관리
      });

      wsRef.current = socket as any;

      socket.on('connect', () => {
        console.log('✅ 알림 WebSocket 연결됨');
        setIsConnected(true);
        reconnectAttempts.current = 0;
      });

      socket.on('disconnect', (reason) => {
        console.log(`❌ 알림 WebSocket 연결 끊김: ${reason}`);
        setIsConnected(false);

        // 정상적인 종료가 아닌 경우에만 재연결 시도
        if (reason !== 'io client disconnect' && reconnectAttempts.current < maxReconnectAttempts) {
          reconnectAttempts.current++;

          // 지수 백오프 계산 (1초 ~ 30초)
          const backoffDelay = Math.min(
            Math.pow(2, reconnectAttempts.current) * 1000 + Math.random() * 1000,
            maxReconnectDelay
          );

          console.log(`🔄 WebSocket 재연결 예약: ${Math.floor(backoffDelay / 1000)}초 후 (시도 ${reconnectAttempts.current}/${maxReconnectAttempts})`);

          reconnectTimeoutRef.current = setTimeout(() => {
            connectWebSocket();
          }, backoffDelay);
        } else if (reason !== 'io client disconnect') {
          console.error(`❌ WebSocket 최대 재시도 횟수 초과: Circuit Breaker 활성화 (${circuitBreakerTimeout / 1000}초)`);
        }
      });

      socket.on('connect_error', (error) => {
        console.error('❌ 알림 WebSocket 오류:', error);
        setIsConnected(false);
      });

      // 일반 알림 이벤트 핸들러
      socket.on('new_notification', (data) => {
        try {
          console.log('🔔 새 알림 수신:', data);

          // 새 알림 추가
          setNotifications(prev => [data, ...prev]);

          // 브라우저 알림 표시 (권한이 있는 경우)
          if (settings?.pushNotificationsEnabled && 'Notification' in window && Notification.permission === 'granted') {
            new Notification(data.title, {
              body: data.message,
              icon: '/icon-192x192.png',
              badge: '/icon-192x192.png',
              tag: data.id
            });
          }

          // 소리 알림 (설정된 경우)
          if (settings?.soundNotificationsEnabled) {
            playNotificationSound(data.priority);
          }
        } catch (error) {
          console.error('일반 알림 처리 오류:', error);
        }
      });

      // 업무 알림 이벤트 핸들러 (기존 서버에서 보내는 이벤트에 맞춤)
      socket.on('task_notification_created', (data) => {
        try {
          console.log('🔔 업무 알림 수신:', data);

          if (data.notification) {
            // 기존 알림 형식으로 변환하여 추가
            const taskNotification = {
              id: data.notification.id,
              title: '업무 알림',
              message: data.notification.message,
              category: 'task_assigned' as NotificationCategory,
              priority: data.notification.priority === 'urgent' ? 'critical' as NotificationPriority :
                       data.notification.priority === 'high' ? 'high' as NotificationPriority : 'medium' as NotificationPriority,
              relatedResourceType: 'task',
              relatedResourceId: data.notification.task_id,
              metadata: {
                business_name: data.notification.business_name,
                notification_type: data.notification.notification_type
              },
              createdAt: data.notification.created_at,
              expiresAt: data.notification.expires_at || new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
              isSystemNotification: false,
              isRead: false
            };

            setNotifications(prev => [taskNotification, ...prev]);

            // 브라우저 알림 표시
            if (settings?.pushNotificationsEnabled && 'Notification' in window && Notification.permission === 'granted') {
              new Notification('업무 알림', {
                body: data.notification.message,
                icon: '/icon-192x192.png',
                badge: '/icon-192x192.png',
                tag: data.notification.id
              });
            }

            // 소리 알림
            if (settings?.soundNotificationsEnabled) {
              playNotificationSound(taskNotification.priority);
            }
          }
        } catch (error) {
          console.error('업무 알림 처리 오류:', error);
        }
      });

      // 업무 알림 업데이트 이벤트 핸들러
      socket.on('task_notification_updated', (data) => {
        try {
          if (data.notificationId) {
            setNotifications(prev =>
              prev.map(notification =>
                notification.id === data.notificationId ? { ...notification, isRead: true } : notification
              )
            );
          }
        } catch (error) {
          console.error('업무 알림 업데이트 처리 오류:', error);
        }
      });
    } catch (error) {
      console.error('WebSocket 연결 생성 오류:', error);
      setIsConnected(false);
      reconnectAttempts.current++;
    }
  }, [user, settings]);

  // WebSocket 연결 해제
  const disconnectWebSocket = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }

    if (wsRef.current) {
      (wsRef.current as any).disconnect();
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