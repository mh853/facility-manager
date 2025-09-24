'use client';

import React, { createContext, useContext, useEffect, useState, ReactNode, useCallback } from 'react';
import { useAuth } from './AuthContext';
import { TokenManager } from '@/lib/api-client';

// 3-tier 알림 타입 정의
export type NotificationTier = 'personal' | 'team' | 'company';

export interface TierNotification {
  id: string;
  title: string;
  message: string;
  category: string;
  priority: 'low' | 'medium' | 'high' | 'critical';
  tier: NotificationTier;
  isRead: boolean;
  readAt?: string;
  createdAt: string;
  createdByName?: string;
  relatedResourceType?: string;
  relatedUrl?: string;
  metadata?: Record<string, any>;
}

export interface CreateTierNotificationRequest {
  title: string;
  message: string;
  category: string;
  priority: 'low' | 'medium' | 'high' | 'critical';
  notification_tier: NotificationTier;
  target_user_id?: string;
  target_team_id?: number;
  target_department_id?: number;
  related_resource_type?: string;
  related_resource_id?: string;
  related_url?: string;
  expires_at?: string;
  metadata?: Record<string, any>;
}

interface TierNotificationContextType {
  // 통합 알림
  notifications: TierNotification[];
  unreadCount: number;
  loading: boolean;

  // 계층별 알림
  personalNotifications: TierNotification[];
  teamNotifications: TierNotification[];
  companyNotifications: TierNotification[];

  // 계층별 읽지 않은 수
  unreadCountByTier: {
    personal: number;
    team: number;
    company: number;
    total: number;
  };

  // 연결 상태
  isConnected: boolean;
  isConnecting: boolean;
  connectionError: string | null;
  lastEventTime: Date | null;

  // 메서드
  getNotificationsByTier: (tier: NotificationTier) => TierNotification[];
  markAsRead: (notificationId: string) => Promise<void>;
  markAllAsRead: () => Promise<void>;
  markTierAsRead: (tier: NotificationTier) => Promise<void>;
  deleteAllNotifications: () => Promise<void>;
  deleteReadNotifications: () => Promise<void>;
  createNotification: (notification: CreateTierNotificationRequest) => Promise<void>;
  refreshNotifications: () => Promise<void>;
  reconnectRealtime: () => void;
}

const TierNotificationContext = createContext<TierNotificationContextType | undefined>(undefined);

export function TierNotificationProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();

  // 상태 관리
  const [notifications, setNotifications] = useState<TierNotification[]>([]);
  const [personalNotifications, setPersonalNotifications] = useState<TierNotification[]>([]);
  const [teamNotifications, setTeamNotifications] = useState<TierNotification[]>([]);
  const [companyNotifications, setCompanyNotifications] = useState<TierNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [unreadCountByTier, setUnreadCountByTier] = useState({
    personal: 0,
    team: 0,
    company: 0,
    total: 0
  });
  const [loading, setLoading] = useState(true);
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const [lastEventTime, setLastEventTime] = useState<Date | null>(null);

  // 계층별 알림 조회
  const fetchTierNotifications = useCallback(async (tier: NotificationTier) => {
    if (!user) return [];

    const token = TokenManager.getToken();
    if (!token || !TokenManager.isTokenValid(token)) {
      console.warn(`⚠️ [${tier.toUpperCase()}-NOTIFICATIONS] 토큰이 유효하지 않음`);
      return [];
    }

    try {
      console.log(`📡 [${tier.toUpperCase()}-NOTIFICATIONS] 조회 시작`);

      const response = await fetch(`/api/notifications?tier=${tier}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();

      if (data.success && data.data.notifications) {
        const tierNotifications = data.data.notifications.map((notif: any) => ({
          ...notif,
          tier
        }));

        console.log(`✅ [${tier.toUpperCase()}-NOTIFICATIONS] 조회 성공:`, tierNotifications.length, '개');
        return tierNotifications;
      }

      return [];
    } catch (error) {
      console.error(`🔴 [${tier.toUpperCase()}-NOTIFICATIONS] 조회 실패:`, error);
      setConnectionError((error as Error).message);
      return [];
    }
  }, [user]);

  // 레거시 업무 알림 조회 (하위 호환성)
  const fetchTaskNotifications = useCallback(async () => {
    if (!user) return [];

    const token = TokenManager.getToken();
    if (!token || !TokenManager.isTokenValid(token)) return [];

    try {
      const response = await fetch('/api/notifications?taskNotifications=true', {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const data = await response.json();
        if (data.success && data.data.taskNotifications) {
          const formattedNotifications = data.data.taskNotifications.map((notif: any) => ({
            id: notif.id,
            title: notif.business_name || '업무 알림',
            message: notif.message,
            category: notif.notification_type,
            priority: notif.priority,
            tier: 'personal' as NotificationTier,
            isRead: notif.is_read,
            readAt: notif.read_at,
            createdAt: notif.created_at,
            createdByName: notif.user_name,
            relatedResourceType: 'task',
            relatedUrl: `/tasks/${notif.task_id}`,
            metadata: {
              business_name: notif.business_name,
              task_id: notif.task_id
            }
          }));

          console.log('✅ [TASK-NOTIFICATIONS] 레거시 업무 알림 로드:', formattedNotifications.length, '개');
          return formattedNotifications;
        }
      }
      return [];
    } catch (error) {
      console.error('🔴 [TASK-NOTIFICATIONS] 레거시 알림 로드 실패:', error);
      return [];
    }
  }, [user]);

  // 모든 알림 새로고침
  const refreshNotifications = useCallback(async () => {
    if (!user) return;

    try {
      setLoading(true);
      setConnectionError(null);

      console.log('🔄 [TIER-NOTIFICATIONS] 전체 알림 새로고침 시작');

      // 모든 계층의 알림을 병렬로 조회
      const [personal, team, company, legacy] = await Promise.all([
        fetchTierNotifications('personal'),
        fetchTierNotifications('team'),
        fetchTierNotifications('company'),
        fetchTaskNotifications()
      ]);

      // 레거시 업무 알림을 개인 알림에 추가
      const mergedPersonal = [...personal, ...legacy]
        .filter((notif, index, self) =>
          index === self.findIndex(n => n.id === notif.id)
        ) // 중복 제거
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

      // 상태 업데이트
      setPersonalNotifications(mergedPersonal);
      setTeamNotifications(team);
      setCompanyNotifications(company);

      setIsConnected(true);
      setLastEventTime(new Date());

      console.log('✅ [TIER-NOTIFICATIONS] 전체 알림 새로고침 완료:', {
        personal: mergedPersonal.length,
        team: team.length,
        company: company.length
      });

    } catch (error) {
      console.error('🔴 [TIER-NOTIFICATIONS] 전체 알림 새로고침 실패:', error);
      setConnectionError((error as Error).message);
      setIsConnected(false);
    } finally {
      setLoading(false);
    }
  }, [user, fetchTierNotifications, fetchTaskNotifications]);

  // 통합 알림 및 읽지 않은 수 계산
  useEffect(() => {
    const allNotifications = [
      ...personalNotifications,
      ...teamNotifications,
      ...companyNotifications
    ].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    setNotifications(allNotifications);

    const counts = {
      personal: personalNotifications.filter(n => !n.isRead).length,
      team: teamNotifications.filter(n => !n.isRead).length,
      company: companyNotifications.filter(n => !n.isRead).length,
      total: 0
    };
    counts.total = counts.personal + counts.team + counts.company;

    setUnreadCount(counts.total);
    setUnreadCountByTier(counts);

    console.log('📊 [TIER-NOTIFICATIONS] 통합 상태 업데이트:', {
      total: allNotifications.length,
      unreadByTier: counts
    });
  }, [personalNotifications, teamNotifications, companyNotifications]);

  // 사용자 로그인 시 알림 로드
  useEffect(() => {
    if (user) {
      refreshNotifications();
    }
  }, [user, refreshNotifications]);

  // 계층별 알림 조회
  const getNotificationsByTier = useCallback((tier: NotificationTier) => {
    switch (tier) {
      case 'personal': return personalNotifications;
      case 'team': return teamNotifications;
      case 'company': return companyNotifications;
      default: return [];
    }
  }, [personalNotifications, teamNotifications, companyNotifications]);

  // 알림 읽음 처리
  const markAsRead = useCallback(async (notificationId: string) => {
    if (!user) return;

    const token = TokenManager.getToken();
    if (!token || !TokenManager.isTokenValid(token)) {
      console.warn('⚠️ [TIER-NOTIFICATIONS] markAsRead: 토큰이 유효하지 않음');
      return;
    }

    try {
      const response = await fetch('/api/notifications', {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          notification_ids: [notificationId],
          user_id: user.id
        })
      });

      if (!response.ok) {
        throw new Error('알림 읽음 처리 실패');
      }

      // 로컬 상태 업데이트
      const updateRead = (notifications: TierNotification[]) =>
        notifications.map(n =>
          n.id === notificationId ? { ...n, isRead: true, readAt: new Date().toISOString() } : n
        );

      setPersonalNotifications(updateRead);
      setTeamNotifications(updateRead);
      setCompanyNotifications(updateRead);

      console.log('✅ [TIER-NOTIFICATIONS] 읽음 처리 완료:', notificationId);
    } catch (error) {
      console.error('🔴 [TIER-NOTIFICATIONS] 읽음 처리 실패:', error);
    }
  }, [user]);

  // 모든 알림 읽음 처리
  const markAllAsRead = useCallback(async () => {
    if (!user) return;

    const token = TokenManager.getToken();
    if (!token || !TokenManager.isTokenValid(token)) return;

    try {
      const response = await fetch('/api/notifications', {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          user_id: user.id,
          mark_all_read: true
        })
      });

      if (!response.ok) {
        throw new Error('모든 알림 읽음 처리 실패');
      }

      // 로컬 상태 업데이트
      const markAllRead = (notifications: TierNotification[]) =>
        notifications.map(n => ({ ...n, isRead: true, readAt: new Date().toISOString() }));

      setPersonalNotifications(markAllRead);
      setTeamNotifications(markAllRead);
      setCompanyNotifications(markAllRead);

      console.log('✅ [TIER-NOTIFICATIONS] 모든 알림 읽음 처리 완료');
    } catch (error) {
      console.error('🔴 [TIER-NOTIFICATIONS] 모든 알림 읽음 처리 실패:', error);
    }
  }, [user]);

  // 계층별 읽음 처리
  const markTierAsRead = useCallback(async (tier: NotificationTier) => {
    const tierNotifications = getNotificationsByTier(tier);
    const unreadIds = tierNotifications.filter(n => !n.isRead).map(n => n.id);

    if (unreadIds.length === 0) return;

    for (const id of unreadIds) {
      await markAsRead(id);
    }

    console.log(`✅ [${tier.toUpperCase()}-NOTIFICATIONS] 계층별 읽음 처리 완료:`, unreadIds.length, '개');
  }, [getNotificationsByTier, markAsRead]);

  // 모든 알림 삭제
  const deleteAllNotifications = useCallback(async () => {
    if (!user) return;

    const token = TokenManager.getToken();
    if (!token || !TokenManager.isTokenValid(token)) return;

    try {
      const response = await fetch('/api/notifications/delete-all', {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ user_id: user.id })
      });

      if (!response.ok) {
        throw new Error('모든 알림 삭제 실패');
      }

      // 로컬 상태 초기화
      setPersonalNotifications([]);
      setTeamNotifications([]);
      setCompanyNotifications([]);

      console.log('✅ [TIER-NOTIFICATIONS] 모든 알림 삭제 완료');
    } catch (error) {
      console.error('🔴 [TIER-NOTIFICATIONS] 모든 알림 삭제 실패:', error);
    }
  }, [user]);

  // 읽은 알림 삭제
  const deleteReadNotifications = useCallback(async () => {
    if (!user) return;

    const token = TokenManager.getToken();
    if (!token || !TokenManager.isTokenValid(token)) return;

    try {
      const response = await fetch('/api/notifications/delete-all', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          user_id: user.id,
          delete_read: true
        })
      });

      if (!response.ok) {
        throw new Error('읽은 알림 삭제 실패');
      }

      // 로컬 상태에서 읽은 알림 제거
      const filterUnread = (notifications: TierNotification[]) =>
        notifications.filter(n => !n.isRead);

      setPersonalNotifications(filterUnread);
      setTeamNotifications(filterUnread);
      setCompanyNotifications(filterUnread);

      console.log('✅ [TIER-NOTIFICATIONS] 읽은 알림 삭제 완료');
    } catch (error) {
      console.error('🔴 [TIER-NOTIFICATIONS] 읽은 알림 삭제 실패:', error);
    }
  }, [user]);

  // 새 알림 생성
  const createNotification = useCallback(async (notification: CreateTierNotificationRequest) => {
    if (!user) return;

    const token = TokenManager.getToken();
    if (!token || !TokenManager.isTokenValid(token)) return;

    try {
      const response = await fetch('/api/notifications', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(notification)
      });

      if (!response.ok) {
        throw new Error('알림 생성 실패');
      }

      const data = await response.json();
      console.log('✅ [TIER-NOTIFICATIONS] 새 알림 생성 완료:', data);

      // 알림 목록 새로고침
      await refreshNotifications();
    } catch (error) {
      console.error('🔴 [TIER-NOTIFICATIONS] 알림 생성 실패:', error);
    }
  }, [user, refreshNotifications]);

  // 재연결
  const reconnectRealtime = useCallback(() => {
    console.log('🔄 [TIER-NOTIFICATIONS] 수동 재연결 시작');
    refreshNotifications();
  }, [refreshNotifications]);

  const contextValue: TierNotificationContextType = {
    notifications,
    unreadCount,
    loading,
    personalNotifications,
    teamNotifications,
    companyNotifications,
    unreadCountByTier,
    isConnected,
    isConnecting,
    connectionError,
    lastEventTime,
    getNotificationsByTier,
    markAsRead,
    markAllAsRead,
    markTierAsRead,
    deleteAllNotifications,
    deleteReadNotifications,
    createNotification,
    refreshNotifications,
    reconnectRealtime
  };

  return (
    <TierNotificationContext.Provider value={contextValue}>
      {children}
    </TierNotificationContext.Provider>
  );
}

export function useTierNotifications() {
  const context = useContext(TierNotificationContext);
  if (context === undefined) {
    throw new Error('useTierNotifications must be used within a TierNotificationProvider');
  }
  return context;
}