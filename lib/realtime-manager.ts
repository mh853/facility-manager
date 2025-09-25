'use client';

import { supabase } from '@/lib/supabase';
import type { RealtimeChannel, RealtimePostgresChangesPayload } from '@supabase/supabase-js';

type ConnectionState = 'connected' | 'connecting' | 'disconnected';
type EventCallback = (payload: RealtimePostgresChangesPayload<any>) => void;
type StatusCallback = (state: ConnectionState, error?: string) => void;

interface Subscription {
  id: string;
  tableName: string;
  eventTypes: ('INSERT' | 'UPDATE' | 'DELETE')[];
  callback: EventCallback;
  statusCallback?: StatusCallback;
}

/**
 * 전역 Realtime 연결 관리자
 * 앱 전체에서 단일 연결을 재사용하여 즉시 연결 경험 제공
 */
class RealtimeManager {
  private static instance: RealtimeManager;
  private channel: RealtimeChannel | null = null;
  private connectionState: ConnectionState = 'disconnected';
  private subscriptions = new Map<string, Subscription>();
  private connectionPromise: Promise<void> | null = null;
  private connectionError: string | null = null;
  private isInitialized = false;

  private constructor() {}

  static getInstance(): RealtimeManager {
    if (!RealtimeManager.instance) {
      RealtimeManager.instance = new RealtimeManager();
    }
    return RealtimeManager.instance;
  }

  /**
   * 백그라운드 연결 초기화 (로그인 시 호출)
   * 실제 페이지에서 구독하기 전에 미리 연결을 시작
   */
  async initializeConnection(): Promise<void> {
    if (this.isInitialized || this.connectionPromise) {
      return this.connectionPromise || Promise.resolve();
    }

    this.isInitialized = true;
    console.log('🚀 [REALTIME-MANAGER] 백그라운드 연결 초기화 시작');

    this.connectionPromise = this.establishConnection();
    return this.connectionPromise;
  }

  /**
   * 실제 Supabase 연결 설정
   */
  private async establishConnection(): Promise<void> {
    try {
      this.connectionState = 'connecting';
      this.notifyStatusSubscribers('connecting');

      // 기존 채널 정리
      if (this.channel) {
        await this.channel.unsubscribe();
        this.channel = null;
      }

      // 전역 채널 생성 - 고정된 이름 사용
      const channelName = 'global-notifications';
      this.channel = supabase.channel(channelName, {
        config: {
          presence: {
            key: 'user_id'
          },
          broadcast: {
            ack: true,
            self: false
          }
        }
      });

      // 채널 구독
      const subscriptionStatus = await this.channel.subscribe((status, error) => {
        console.log(`📡 [REALTIME-MANAGER] 상태 변경: ${status}`, error ? { error } : {});

        switch (status) {
          case 'SUBSCRIBED':
            this.connectionState = 'connected';
            this.connectionError = null;
            this.notifyStatusSubscribers('connected');
            console.log('✅ [REALTIME-MANAGER] 전역 연결 성공');
            break;

          case 'CHANNEL_ERROR':
          case 'TIMED_OUT':
          case 'CLOSED':
            this.connectionState = 'disconnected';
            this.connectionError = error?.message || `연결 오류: ${status}`;
            this.notifyStatusSubscribers('disconnected', this.connectionError);
            console.error('❌ [REALTIME-MANAGER] 연결 실패:', this.connectionError);
            break;
        }
      });

      console.log('📡 [REALTIME-MANAGER] 전역 채널 구독 시작:', subscriptionStatus);

    } catch (error) {
      console.error('❌ [REALTIME-MANAGER] 연결 설정 오류:', error);
      this.connectionState = 'disconnected';
      this.connectionError = error instanceof Error ? error.message : '알 수 없는 오류';
      this.notifyStatusSubscribers('disconnected', this.connectionError);
      throw error;
    }
  }

  /**
   * 테이블별 구독 등록
   * 이미 연결된 채널에 새로운 테이블 구독만 추가
   */
  subscribe(
    id: string,
    tableName: string,
    eventTypes: ('INSERT' | 'UPDATE' | 'DELETE')[],
    callback: EventCallback,
    statusCallback?: StatusCallback
  ): void {
    const subscription: Subscription = {
      id,
      tableName,
      eventTypes,
      callback,
      statusCallback
    };

    this.subscriptions.set(id, subscription);

    // 이미 연결된 경우 즉시 구독 추가
    if (this.channel && this.connectionState === 'connected') {
      this.addTableSubscription(subscription);
      statusCallback?.('connected');
    } else {
      // 연결 대기 중인 경우 연결 완료 후 구독
      statusCallback?.('connecting');
      this.initializeConnection().then(() => {
        if (this.channel && this.connectionState === 'connected') {
          this.addTableSubscription(subscription);
          statusCallback?.('connected');
        }
      }).catch((error) => {
        statusCallback?.('disconnected', error.message);
      });
    }

    console.log(`📋 [REALTIME-MANAGER] 구독 등록: ${tableName} (${id})`);
  }

  /**
   * 채널에 테이블 구독 추가
   */
  private addTableSubscription(subscription: Subscription): void {
    if (!this.channel) return;

    subscription.eventTypes.forEach(eventType => {
      this.channel!.on(
        'postgres_changes',
        {
          event: eventType,
          schema: 'public',
          table: subscription.tableName
        },
        (payload: RealtimePostgresChangesPayload<any>) => {
          console.log(`📨 [REALTIME-MANAGER] ${eventType} 이벤트 수신:`, {
            table: subscription.tableName,
            subscriptionId: subscription.id,
            recordId: payload.new?.id || payload.old?.id
          });

          subscription.callback(payload);
        }
      );
    });
  }

  /**
   * 구독 해제
   */
  unsubscribe(id: string): void {
    const subscription = this.subscriptions.get(id);
    if (subscription) {
      this.subscriptions.delete(id);
      console.log(`📋 [REALTIME-MANAGER] 구독 해제: ${subscription.tableName} (${id})`);
    }

    // 모든 구독이 해제되면 채널 정리
    if (this.subscriptions.size === 0 && this.channel) {
      this.channel.unsubscribe();
      this.channel = null;
      this.connectionState = 'disconnected';
      this.isInitialized = false;
      this.connectionPromise = null;
      console.log('🧹 [REALTIME-MANAGER] 전역 채널 정리 완료');
    }
  }

  /**
   * 연결 상태 확인
   */
  getConnectionState(): {
    state: ConnectionState;
    error: string | null;
    subscriberCount: number;
  } {
    return {
      state: this.connectionState,
      error: this.connectionError,
      subscriberCount: this.subscriptions.size
    };
  }

  /**
   * 상태 변경 알림
   */
  private notifyStatusSubscribers(state: ConnectionState, error?: string): void {
    this.subscriptions.forEach(sub => {
      sub.statusCallback?.(state, error);
    });
  }

  /**
   * 강제 재연결
   */
  async reconnect(): Promise<void> {
    console.log('🔄 [REALTIME-MANAGER] 강제 재연결 시작');
    this.isInitialized = false;
    this.connectionPromise = null;

    if (this.channel) {
      await this.channel.unsubscribe();
      this.channel = null;
    }

    await this.initializeConnection();
  }
}

// 전역 인스턴스 내보내기
export const realtimeManager = RealtimeManager.getInstance();

// 편의 함수들
export function initializeRealtimeConnection(): Promise<void> {
  return realtimeManager.initializeConnection();
}

export function subscribeToRealtime(
  id: string,
  tableName: string,
  eventTypes: ('INSERT' | 'UPDATE' | 'DELETE')[],
  callback: EventCallback,
  statusCallback?: StatusCallback
): void {
  realtimeManager.subscribe(id, tableName, eventTypes, callback, statusCallback);
}

export function unsubscribeFromRealtime(id: string): void {
  realtimeManager.unsubscribe(id);
}

export function getRealtimeConnectionState() {
  return realtimeManager.getConnectionState();
}

export function reconnectRealtime(): Promise<void> {
  return realtimeManager.reconnect();
}