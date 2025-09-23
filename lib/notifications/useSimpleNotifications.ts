// 단순화된 알림 훅 - 복잡성 제거 및 안정성 최우선
'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { ConnectionManager } from './connection-manager';
import { useAuth } from '@/contexts/AuthContext';

interface Notification {
  id: string;
  title: string;
  message: string;
  priority: 'low' | 'medium' | 'high' | 'critical';
  createdAt: string;
  isRead: boolean;
  category: string;
}

interface NotificationState {
  notifications: Notification[];
  unreadCount: number;
  connectionStatus: 'connected' | 'connecting' | 'degraded' | 'offline';
  lastUpdated: number;
}

export function useSimpleNotifications() {
  const { user } = useAuth();
  const [state, setState] = useState<NotificationState>({
    notifications: [],
    unreadCount: 0,
    connectionStatus: 'offline',
    lastUpdated: 0
  });

  const connectionManager = useRef<ConnectionManager | null>(null);
  const cacheKey = 'notifications-cache';
  const maxCacheAge = 5 * 60 * 1000; // 5분

  // 로컬 캐시 관리
  const saveToCache = useCallback((notifications: Notification[]) => {
    const cacheData = {
      notifications,
      timestamp: Date.now()
    };
    localStorage.setItem(cacheKey, JSON.stringify(cacheData));
  }, []);

  const loadFromCache = useCallback((): Notification[] => {
    try {
      const cached = localStorage.getItem(cacheKey);
      if (!cached) return [];

      const data = JSON.parse(cached);
      const age = Date.now() - data.timestamp;

      if (age < maxCacheAge) {
        return data.notifications || [];
      }
    } catch (error) {
      console.warn('캐시 로드 실패:', error);
    }
    return [];
  }, []);

  // 알림 목록 조회 (API)
  const fetchNotifications = useCallback(async (): Promise<Notification[]> => {
    if (!user) return [];

    try {
      const response = await fetch('/api/notifications/simple', {
        headers: {
          'Authorization': `Bearer ${(user as any).token || localStorage.getItem('token')}`
        }
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const data = await response.json();
      const notifications = data.notifications || [];

      // 캐시에 저장
      saveToCache(notifications);

      return notifications;
    } catch (error) {
      console.error('알림 조회 실패:', error);

      // 실패시 캐시에서 로드
      return loadFromCache();
    }
  }, [user, saveToCache, loadFromCache]);

  // 알림 읽음 처리
  const markAsRead = useCallback(async (notificationId: string) => {
    try {
      await fetch(`/api/notifications/${notificationId}/read`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${(user as any)?.token || localStorage.getItem('token')}`
        }
      });

      // 로컬 상태 즉시 업데이트
      setState(prev => ({
        ...prev,
        notifications: prev.notifications.map(n =>
          n.id === notificationId ? { ...n, isRead: true } : n
        )
      }));
    } catch (error) {
      console.error('읽음 처리 실패:', error);
    }
  }, [user]);

  // 연결 상태에 따른 알림 처리
  const handleNewNotification = useCallback((notification: Notification) => {
    setState(prev => {
      const exists = prev.notifications.some(n => n.id === notification.id);
      if (exists) return prev;

      const newNotifications = [notification, ...prev.notifications].slice(0, 100); // 최대 100개
      saveToCache(newNotifications);

      return {
        ...prev,
        notifications: newNotifications,
        lastUpdated: Date.now()
      };
    });

    // 브라우저 알림 (간단하게)
    if ('Notification' in window && Notification.permission === 'granted') {
      new Notification(notification.title, {
        body: notification.message,
        icon: '/icon-192x192.png'
      });
    }
  }, [saveToCache]);

  // 연결 관리자 초기화
  useEffect(() => {
    if (!user) return;

    const manager = new ConnectionManager({
      wsUrl: process.env.NEXT_PUBLIC_SUPABASE_URL || '',
      pollingInterval: 30000, // 30초
      maxRetries: 3,
      degradationThreshold: 2,
      token: (user as any).token || localStorage.getItem('token') || ''
    });

    // 이벤트 리스너
    manager.on('notification', handleNewNotification);
    manager.on('status', (connectionState: any) => {
      setState(prev => ({
        ...prev,
        connectionStatus: connectionState.status
      }));
    });

    connectionManager.current = manager;

    // 초기 연결 및 데이터 로드
    const initialize = async () => {
      // 1. 캐시된 데이터 먼저 로드
      const cachedNotifications = loadFromCache();
      if (cachedNotifications.length > 0) {
        setState(prev => ({
          ...prev,
          notifications: cachedNotifications
        }));
      }

      // 2. 최신 데이터 조회
      const freshNotifications = await fetchNotifications();
      setState(prev => ({
        ...prev,
        notifications: freshNotifications,
        lastUpdated: Date.now()
      }));

      // 3. 실시간 연결 시도
      await manager.connect();
    };

    initialize();

    return () => {
      manager.disconnect();
    };
  }, [user, handleNewNotification, loadFromCache, fetchNotifications]);

  // 읽지 않은 알림 수 계산
  useEffect(() => {
    const unreadCount = state.notifications.filter(n => !n.isRead).length;
    setState(prev => ({ ...prev, unreadCount }));
  }, [state.notifications]);

  // 수동 새로고침
  const refresh = useCallback(async () => {
    if (connectionManager.current) {
      await connectionManager.current.refresh();
    }
    const notifications = await fetchNotifications();
    setState(prev => ({
      ...prev,
      notifications,
      lastUpdated: Date.now()
    }));
  }, [fetchNotifications]);

  return {
    notifications: state.notifications,
    unreadCount: state.unreadCount,
    connectionStatus: state.connectionStatus,
    lastUpdated: state.lastUpdated,
    markAsRead,
    refresh
  };
}