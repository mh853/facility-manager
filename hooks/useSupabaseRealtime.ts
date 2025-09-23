'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '@/lib/supabase';
import type { RealtimeChannel, RealtimePostgresChangesPayload } from '@supabase/supabase-js';

interface UseSupabaseRealtimeOptions {
  tableName?: string;
  eventTypes?: ('INSERT' | 'UPDATE' | 'DELETE')[];
  onNotification?: (payload: RealtimePostgresChangesPayload<any>) => void;
  onConnect?: () => void;
  onDisconnect?: () => void;
  onError?: (error: Error) => void;
  autoConnect?: boolean;
  reconnectDelay?: number;
}

interface RealtimeState {
  isConnected: boolean;
  isConnecting: boolean;
  connectionError: string | null;
  lastEvent: Date | null;
  subscriptionCount: number;
}

/**
 * Supabase Realtime 전용 훅 - WebSocket 완전 대체
 * 안정적인 연결 관리와 즉시 알림 수신을 위한 최적화된 구현
 */
export function useSupabaseRealtime(options: UseSupabaseRealtimeOptions = {}) {
  const {
    tableName = 'notifications',
    eventTypes = ['INSERT', 'UPDATE'],
    onNotification,
    onConnect,
    onDisconnect,
    onError,
    autoConnect = true,
    reconnectDelay = 1000
  } = options;

  const [state, setState] = useState<RealtimeState>({
    isConnected: false,
    isConnecting: false,
    connectionError: null,
    lastEvent: null,
    subscriptionCount: 0
  });

  const channelRef = useRef<RealtimeChannel | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const reconnectAttemptsRef = useRef(0);
  const maxReconnectAttempts = 5;
  const isComponentMountedRef = useRef(true);

  // 연결 상태 업데이트 함수
  const updateState = useCallback((updates: Partial<RealtimeState>) => {
    if (!isComponentMountedRef.current) return;
    setState(prev => ({ ...prev, ...updates }));
  }, []);

  // 채널 구독
  const subscribe = useCallback(async () => {
    if (!isComponentMountedRef.current) return;

    try {
      updateState({ isConnecting: true, connectionError: null });

      // 기존 채널 정리
      if (channelRef.current) {
        await channelRef.current.unsubscribe();
        channelRef.current = null;
      }

      // 새 채널 생성 - 고유한 채널명으로 충돌 방지
      const channelName = `realtime:${tableName}:${Date.now()}`;
      const channel = supabase.channel(channelName, {
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

      // 데이터베이스 변경 사항 구독
      eventTypes.forEach(eventType => {
        (channel as any).on(
          'postgres_changes',
          {
            event: eventType,
            schema: 'public',
            table: tableName
          },
          (payload: any) => {
            if (!isComponentMountedRef.current) return;

            console.log(`📡 [REALTIME] ${eventType} 이벤트 수신:`, {
              table: tableName,
              eventType,
              timestamp: new Date().toISOString(),
              recordId: payload.new?.id || payload.old?.id
            });

            updateState({
              lastEvent: new Date(),
              subscriptionCount: state.subscriptionCount + 1
            });

            onNotification?.(payload);
          }
        );
      });

      // 브로드캐스트 메시지 구독 (실시간 알림용)
      channel.on('broadcast', { event: 'notification' }, (payload) => {
        if (!isComponentMountedRef.current) return;

        console.log('📡 [REALTIME] 브로드캐스트 알림 수신:', payload);
        updateState({
          lastEvent: new Date(),
          subscriptionCount: state.subscriptionCount + 1
        });

        onNotification?.(payload as any);
      });

      // 채널 구독 및 상태 관리
      const subscriptionStatus = await channel.subscribe((status, error) => {
        if (!isComponentMountedRef.current) return;

        console.log(`📡 [REALTIME] 구독 상태 변경: ${status}`, error ? { error } : {});

        switch (status) {
          case 'SUBSCRIBED':
            reconnectAttemptsRef.current = 0;
            updateState({
              isConnected: true,
              isConnecting: false,
              connectionError: null
            });
            onConnect?.();
            break;

          case 'CHANNEL_ERROR':
          case 'TIMED_OUT':
          case 'CLOSED':
            updateState({
              isConnected: false,
              isConnecting: false,
              connectionError: error?.message || `연결 오류: ${status}`
            });
            onDisconnect?.();

            // 자동 재연결 시도
            if (autoConnect && reconnectAttemptsRef.current < maxReconnectAttempts) {
              reconnectAttemptsRef.current++;
              const delay = Math.min(reconnectDelay * Math.pow(2, reconnectAttemptsRef.current - 1), 30000);

              console.log(`🔄 [REALTIME] 재연결 시도 ${reconnectAttemptsRef.current}/${maxReconnectAttempts} (${delay}ms 후)`);

              reconnectTimeoutRef.current = setTimeout(() => {
                if (isComponentMountedRef.current) {
                  subscribe();
                }
              }, delay);
            } else if (reconnectAttemptsRef.current >= maxReconnectAttempts) {
              const errorMessage = `최대 재연결 시도 횟수 초과 (${maxReconnectAttempts}회)`;
              updateState({ connectionError: errorMessage });
              onError?.(new Error(errorMessage));
            }
            break;
        }
      });

      channelRef.current = channel;

      console.log('📡 [REALTIME] 채널 구독 시작:', {
        channelName,
        tableName,
        eventTypes,
        status: subscriptionStatus
      });

    } catch (error) {
      console.error('❌ [REALTIME] 구독 오류:', error);
      const errorMessage = error instanceof Error ? error.message : '알 수 없는 오류';
      updateState({
        isConnected: false,
        isConnecting: false,
        connectionError: errorMessage
      });
      onError?.(error instanceof Error ? error : new Error(errorMessage));
    }
  }, [tableName, eventTypes, onNotification, onConnect, onDisconnect, onError, autoConnect, reconnectDelay, updateState]);

  // 구독 해제
  const unsubscribe = useCallback(async () => {
    console.log('📡 [REALTIME] 구독 해제 시작');

    // 재연결 타이머 정리
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }

    // 채널 구독 해제
    if (channelRef.current) {
      try {
        await channelRef.current.unsubscribe();
        console.log('✅ [REALTIME] 채널 구독 해제 완료');
      } catch (error) {
        console.error('❌ [REALTIME] 구독 해제 오류:', error);
      }
      channelRef.current = null;
    }

    updateState({
      isConnected: false,
      isConnecting: false,
      connectionError: null
    });
  }, [updateState]);

  // 수동 재연결
  const reconnect = useCallback(() => {
    console.log('🔄 [REALTIME] 수동 재연결 시도');
    reconnectAttemptsRef.current = 0;
    subscribe();
  }, [subscribe]);

  // 브로드캐스트 메시지 전송 (다른 클라이언트에게 알림)
  const sendBroadcast = useCallback(async (event: string, payload: any) => {
    if (!channelRef.current || !state.isConnected) {
      console.warn('⚠️ [REALTIME] 연결되지 않아 브로드캐스트 전송 불가');
      return false;
    }

    try {
      await channelRef.current.send({
        type: 'broadcast',
        event,
        payload
      });

      console.log('📤 [REALTIME] 브로드캐스트 전송 성공:', { event, payload });
      return true;
    } catch (error) {
      console.error('❌ [REALTIME] 브로드캐스트 전송 실패:', error);
      return false;
    }
  }, [state.isConnected]);

  // 연결 상태 확인
  const checkConnection = useCallback(() => {
    const channel = channelRef.current;
    if (!channel) return false;

    // Supabase 채널의 상태 확인
    return channel.state === 'joined';
  }, []);

  // 초기 연결
  useEffect(() => {
    if (autoConnect && isComponentMountedRef.current) {
      subscribe();
    }

    return () => {
      isComponentMountedRef.current = false;
      unsubscribe();
    };
  }, [autoConnect, subscribe, unsubscribe]);

  // 페이지 가시성 변경 시 자동 재연결
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && autoConnect && !state.isConnected && isComponentMountedRef.current) {
        console.log('👁️ [REALTIME] 페이지 활성화 - 자동 재연결');
        reconnect();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [autoConnect, state.isConnected, reconnect]);

  // 온라인/오프라인 상태 감지
  useEffect(() => {
    const handleOnline = () => {
      if (autoConnect && !state.isConnected && isComponentMountedRef.current) {
        console.log('🌐 [REALTIME] 온라인 상태 복구 - 자동 재연결');
        reconnect();
      }
    };

    const handleOffline = () => {
      console.log('📡 [REALTIME] 오프라인 상태 감지');
      updateState({ connectionError: '네트워크 연결이 끊어졌습니다.' });
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [autoConnect, state.isConnected, reconnect, updateState]);

  return {
    // 상태
    isConnected: state.isConnected,
    isConnecting: state.isConnecting,
    connectionError: state.connectionError,
    lastEvent: state.lastEvent,
    subscriptionCount: state.subscriptionCount,

    // 액션
    subscribe,
    unsubscribe,
    reconnect,
    sendBroadcast,
    checkConnection,

    // 채널 참조 (고급 사용)
    channel: channelRef.current
  };
}

// Supabase Realtime 상태 체크 유틸리티
export function checkSupabaseRealtimeHealth(): Promise<boolean> {
  return new Promise((resolve) => {
    const testChannel = supabase.channel('health-check', {
      config: { presence: { key: 'test' } }
    });

    const timeout = setTimeout(() => {
      testChannel.unsubscribe();
      resolve(false);
    }, 5000);

    testChannel.subscribe((status) => {
      if (status === 'SUBSCRIBED') {
        clearTimeout(timeout);
        testChannel.unsubscribe();
        resolve(true);
      }
    });
  });
}

// 타입 내보내기
export type { UseSupabaseRealtimeOptions, RealtimeState };