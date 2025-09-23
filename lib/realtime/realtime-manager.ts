// lib/realtime/realtime-manager.ts - Supabase Realtime 알림 관리자
import { supabase } from '@/lib/supabase';
import type { RealtimeChannel, RealtimePostgresChangesPayload } from '@supabase/supabase-js';

export interface RealtimeNotification {
  id: string;
  title: string;
  message: string;
  category: string;
  priority: 'low' | 'medium' | 'high' | 'critical';
  related_resource_type?: string;
  related_resource_id?: string;
  related_url?: string;
  metadata?: Record<string, any>;
  created_by_id?: string;
  created_by_name?: string;
  created_at: string;
  expires_at: string;
  is_system_notification: boolean;
}

export interface TaskNotification {
  id: string;
  user_id: string;
  task_id: string;
  business_name: string;
  message: string;
  notification_type: string;
  priority: 'normal' | 'high' | 'urgent';
  metadata?: Record<string, any>;
  is_read: boolean;
  created_at: string;
  expires_at: string;
}

// 알림 이벤트 콜백 타입
export type NotificationCallback = (notification: RealtimeNotification | TaskNotification) => void;
export type TaskUpdateCallback = (update: any) => void;
export type ConnectionCallback = (status: 'connected' | 'disconnected' | 'error', error?: any) => void;

class RealtimeManager {
  private channels: Map<string, RealtimeChannel> = new Map();
  private isConnected = false;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 1000; // 시작 지연시간 (ms)
  private connectionCallbacks: ConnectionCallback[] = [];
  private pollingFallbackEnabled = true;
  private pollingInterval: NodeJS.Timeout | null = null;
  private lastPollingCheck = 0;

  constructor() {
    this.setupConnectionMonitoring();
  }

  /**
   * 연결 상태 모니터링 설정
   */
  private setupConnectionMonitoring() {
    // Supabase Realtime은 채널별로 상태를 관리하므로
    // 여기서는 기본 설정만 진행하고 실제 연결 모니터링은 채널에서 수행
    console.log('🔧 [REALTIME] 연결 모니터링 설정 완료');

    // 페이지 가시성 변경 시 재연결 처리
    if (typeof window !== 'undefined') {
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible' && !this.isConnected) {
          console.log('🔄 [REALTIME] 페이지 복귀 - 재연결 시도');
          this.handleReconnection();
        }
      });
    }
  }

  /**
   * 재연결 처리
   */
  private async handleReconnection() {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.warn('⚠️ [REALTIME] 최대 재연결 시도 횟수 초과, 폴링 모드로 전환');
      this.startPollingFallback();
      return;
    }

    this.reconnectAttempts++;
    const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1); // 지수 백오프

    console.log(`🔄 [REALTIME] 재연결 시도 ${this.reconnectAttempts}/${this.maxReconnectAttempts} (${delay}ms 후)`);

    setTimeout(() => {
      // 모든 채널 재구독
      for (const [channelName, channel] of this.channels) {
        try {
          channel.unsubscribe();
          this.channels.delete(channelName);
        } catch (error) {
          console.warn('⚠️ [REALTIME] 채널 정리 오류:', error);
        }
      }

      // 채널 재생성은 각 구독 함수에서 다시 호출됨
    }, delay);
  }

  /**
   * 폴링 폴백 시작
   */
  private startPollingFallback() {
    if (!this.pollingFallbackEnabled || this.pollingInterval) return;

    console.log('🔄 [REALTIME] 폴링 폴백 모드 시작');
    this.pollingInterval = setInterval(() => {
      this.checkNotificationsPolling();
    }, 10000); // 10초마다 폴링
  }

  /**
   * 폴링 폴백 중지
   */
  private stopPollingFallback() {
    if (this.pollingInterval) {
      console.log('⏹️ [REALTIME] 폴링 폴백 모드 중지');
      clearInterval(this.pollingInterval);
      this.pollingInterval = null;
    }
  }

  /**
   * 폴링으로 알림 확인
   */
  private async checkNotificationsPolling() {
    try {
      const now = Date.now();
      const { data: notifications, error } = await supabase
        .from('notifications')
        .select('*')
        .gte('created_at', new Date(this.lastPollingCheck).toISOString())
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) {
        console.error('🔴 [REALTIME] 폴링 오류:', error);
        return;
      }

      if (notifications && notifications.length > 0) {
        console.log(`📨 [REALTIME] 폴링으로 ${notifications.length}개 알림 발견`);
        notifications.forEach(notification => {
          // 폴링으로 받은 알림도 동일한 콜백으로 처리
          this.handleNotificationUpdate({
            eventType: 'INSERT',
            new: notification,
            old: null,
            schema: 'public',
            table: 'notifications'
          } as any);
        });
      }

      this.lastPollingCheck = now;
    } catch (error) {
      console.error('🔴 [REALTIME] 폴링 확인 오류:', error);
    }
  }

  /**
   * 연결 상태 콜백 등록
   */
  public onConnectionChange(callback: ConnectionCallback) {
    this.connectionCallbacks.push(callback);
  }

  /**
   * 연결 상태 알림
   */
  private notifyConnectionStatus(status: 'connected' | 'disconnected' | 'error', error?: any) {
    this.connectionCallbacks.forEach(callback => {
      try {
        callback(status, error);
      } catch (err) {
        console.error('🔴 [REALTIME] 연결 상태 콜백 오류:', err);
      }
    });
  }

  /**
   * 전역 알림 구독
   */
  public subscribeToNotifications(callback: NotificationCallback): () => void {
    const channelName = 'notifications';

    if (this.channels.has(channelName)) {
      console.log('📡 [REALTIME] 이미 알림 채널 구독 중');
      return () => this.unsubscribeFromChannel(channelName);
    }

    const channel = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'notifications'
        },
        (payload) => this.handleNotificationUpdate(payload, callback)
      )
      .subscribe((status) => {
        console.log(`📡 [REALTIME] 알림 채널 구독 상태: ${status}`);
        if (status === 'SUBSCRIBED') {
          console.log('✅ [REALTIME] 전역 알림 구독 성공');
        } else if (status === 'CHANNEL_ERROR') {
          console.error('🔴 [REALTIME] 알림 채널 오류');
          this.startPollingFallback();
        }
      });

    this.channels.set(channelName, channel);
    return () => this.unsubscribeFromChannel(channelName);
  }

  /**
   * 사용자별 업무 알림 구독
   */
  public subscribeToTaskNotifications(userId: string, callback: NotificationCallback): () => void {
    const channelName = `task-notifications-${userId}`;

    if (this.channels.has(channelName)) {
      console.log(`📡 [REALTIME] 이미 업무 알림 채널 구독 중: ${userId}`);
      return () => this.unsubscribeFromChannel(channelName);
    }

    const channel = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'task_notifications',
          filter: `user_id=eq.${userId}`
        },
        (payload) => this.handleTaskNotificationUpdate(payload, callback)
      )
      .subscribe((status) => {
        console.log(`📡 [REALTIME] 업무 알림 채널 구독 상태: ${status} (사용자: ${userId})`);
        if (status === 'SUBSCRIBED') {
          console.log(`✅ [REALTIME] 사용자 업무 알림 구독 성공: ${userId}`);
        } else if (status === 'CHANNEL_ERROR') {
          console.error(`🔴 [REALTIME] 업무 알림 채널 오류: ${userId}`);
          this.startPollingFallback();
        }
      });

    this.channels.set(channelName, channel);
    return () => this.unsubscribeFromChannel(channelName);
  }

  /**
   * 시설 업무 변경 구독
   */
  public subscribeToFacilityTasks(callback: TaskUpdateCallback): () => void {
    const channelName = 'facility-tasks';

    if (this.channels.has(channelName)) {
      console.log('📡 [REALTIME] 이미 시설 업무 채널 구독 중');
      return () => this.unsubscribeFromChannel(channelName);
    }

    const channel = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'facility_tasks'
        },
        (payload) => this.handleFacilityTaskUpdate(payload, callback)
      )
      .subscribe((status) => {
        console.log(`📡 [REALTIME] 시설 업무 채널 구독 상태: ${status}`);
        if (status === 'SUBSCRIBED') {
          console.log('✅ [REALTIME] 시설 업무 구독 성공');
        } else if (status === 'CHANNEL_ERROR') {
          console.error('🔴 [REALTIME] 시설 업무 채널 오류');
          this.startPollingFallback();
        }
      });

    this.channels.set(channelName, channel);
    return () => this.unsubscribeFromChannel(channelName);
  }

  /**
   * 알림 업데이트 처리
   */
  private handleNotificationUpdate(
    payload: RealtimePostgresChangesPayload<any>,
    callback?: NotificationCallback
  ) {
    console.log('📨 [REALTIME] 알림 업데이트:', payload.eventType);

    if (payload.eventType === 'INSERT' && payload.new) {
      const notification = payload.new as RealtimeNotification;
      console.log('🔔 [REALTIME] 새 알림:', notification.title);

      if (callback) {
        try {
          callback(notification);
        } catch (error) {
          console.error('🔴 [REALTIME] 알림 콜백 오류:', error);
        }
      }
    }
  }

  /**
   * 업무 알림 업데이트 처리
   */
  private handleTaskNotificationUpdate(
    payload: RealtimePostgresChangesPayload<any>,
    callback?: NotificationCallback
  ) {
    console.log('📨 [REALTIME] 업무 알림 업데이트:', payload.eventType);

    if (payload.eventType === 'INSERT' && payload.new) {
      const notification = payload.new as TaskNotification;
      console.log('🔔 [REALTIME] 새 업무 알림:', notification.message);

      if (callback) {
        try {
          callback(notification);
        } catch (error) {
          console.error('🔴 [REALTIME] 업무 알림 콜백 오류:', error);
        }
      }
    }
  }

  /**
   * 시설 업무 업데이트 처리
   */
  private handleFacilityTaskUpdate(
    payload: RealtimePostgresChangesPayload<any>,
    callback?: TaskUpdateCallback
  ) {
    console.log('📋 [REALTIME] 시설 업무 업데이트:', payload.eventType);

    if (callback) {
      try {
        callback({
          eventType: payload.eventType,
          task: payload.new,
          oldTask: payload.old,
          timestamp: new Date().toISOString()
        });
      } catch (error) {
        console.error('🔴 [REALTIME] 업무 업데이트 콜백 오류:', error);
      }
    }
  }

  /**
   * 채널 구독 해제
   */
  public unsubscribeFromChannel(channelName: string) {
    const channel = this.channels.get(channelName);
    if (channel) {
      channel.unsubscribe();
      this.channels.delete(channelName);
      console.log(`🔇 [REALTIME] 채널 구독 해제: ${channelName}`);
    }
  }

  /**
   * 모든 채널 구독 해제
   */
  public unsubscribeAll() {
    console.log('🔇 [REALTIME] 모든 채널 구독 해제');
    for (const [channelName, channel] of this.channels) {
      try {
        channel.unsubscribe();
      } catch (error) {
        console.warn(`⚠️ [REALTIME] 채널 해제 오류 (${channelName}):`, error);
      }
    }
    this.channels.clear();
    this.stopPollingFallback();
  }

  /**
   * 연결 상태 확인
   */
  public isRealtimeConnected(): boolean {
    return this.isConnected;
  }

  /**
   * 수동 재연결 시도
   */
  public async reconnect() {
    console.log('🔄 [REALTIME] 수동 재연결 시도');
    this.reconnectAttempts = 0; // 재시도 카운터 리셋
    await this.handleReconnection();
  }

  /**
   * 폴링 폴백 활성화/비활성화
   */
  public setPollingFallback(enabled: boolean) {
    this.pollingFallbackEnabled = enabled;
    if (!enabled) {
      this.stopPollingFallback();
    }
  }

  /**
   * 연결 통계 조회
   */
  public getConnectionStats() {
    return {
      isConnected: this.isConnected,
      channelCount: this.channels.size,
      reconnectAttempts: this.reconnectAttempts,
      maxReconnectAttempts: this.maxReconnectAttempts,
      pollingEnabled: this.pollingFallbackEnabled,
      isPolling: !!this.pollingInterval
    };
  }
}

// 싱글톤 인스턴스
export const realtimeManager = new RealtimeManager();

// 편의 함수들
export const subscribeToNotifications = (callback: NotificationCallback) =>
  realtimeManager.subscribeToNotifications(callback);

export const subscribeToTaskNotifications = (userId: string, callback: NotificationCallback) =>
  realtimeManager.subscribeToTaskNotifications(userId, callback);

export const subscribeToFacilityTasks = (callback: TaskUpdateCallback) =>
  realtimeManager.subscribeToFacilityTasks(callback);

export const unsubscribeAll = () => realtimeManager.unsubscribeAll();

export default realtimeManager;