'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';

interface UseWebSocketOptions {
  autoConnect?: boolean;
  onConnect?: () => void;
  onDisconnect?: (reason: string) => void;
  onNotification?: (notification: any) => void;
  onProjectUpdate?: (update: any) => void;
  onTaskUpdate?: (update: any) => void;
}

interface WebSocketState {
  isConnected: boolean;
  isConnecting: boolean;
  onlineUsers: any[];
  error: string | null;
}

export function useWebSocket(options: UseWebSocketOptions = {}) {
  const {
    autoConnect = true,
    onConnect,
    onDisconnect,
    onNotification,
    onProjectUpdate,
    onTaskUpdate
  } = options;

  const socketRef = useRef<Socket | null>(null);
  const [state, setState] = useState<WebSocketState>({
    isConnected: false,
    isConnecting: false,
    onlineUsers: [],
    error: null
  });

  // 연결 함수
  const connect = useCallback(() => {
    if (socketRef.current?.connected) return;

    setState(prev => ({ ...prev, isConnecting: true, error: null }));

    try {
      // JWT 토큰 가져오기
      const token = localStorage.getItem('auth-token') ||
                   document.cookie.split('; ').find(row => row.startsWith('auth-token='))?.split('=')[1];

      if (!token) {
        setState(prev => ({ ...prev, isConnecting: false, error: '인증 토큰이 없습니다.' }));
        return;
      }

      const socket = io({
        path: '/api/socket',
        auth: { token },
        transports: ['websocket', 'polling'],
        timeout: 20000,
        reconnection: true,
        reconnectionAttempts: 5,
        reconnectionDelay: 1000
      });

      // 연결 이벤트
      socket.on('connect', () => {
        console.log('✅ 웹소켓 연결 성공');
        setState(prev => ({ ...prev, isConnected: true, isConnecting: false, error: null }));
        onConnect?.();
      });

      // 연결 해제 이벤트
      socket.on('disconnect', (reason) => {
        console.log('❌ 웹소켓 연결 해제:', reason);
        setState(prev => ({ ...prev, isConnected: false, isConnecting: false }));
        onDisconnect?.(reason);
      });

      // 연결 오류 이벤트
      socket.on('connect_error', (error) => {
        console.error('🚫 웹소켓 연결 오류:', error.message);
        setState(prev => ({
          ...prev,
          isConnected: false,
          isConnecting: false,
          error: error.message
        }));
      });

      // 실시간 알림
      socket.on('new_notification', (notification) => {
        console.log('🔔 새 알림:', notification);
        onNotification?.(notification);
      });

      // 프로젝트 업데이트
      socket.on('project_updated', (update) => {
        console.log('📁 프로젝트 업데이트:', update);
        onProjectUpdate?.(update);
      });

      // 작업 업데이트
      socket.on('task_updated', (update) => {
        console.log('✅ 작업 업데이트:', update);
        onTaskUpdate?.(update);
      });

      // 온라인 사용자 목록 업데이트
      socket.on('online_users_update', (users) => {
        setState(prev => ({ ...prev, onlineUsers: users }));
      });

      // 타이핑 상태
      socket.on('user_typing', (data) => {
        console.log('⌨️ 사용자 타이핑:', data.userName);
      });

      socket.on('user_stop_typing', (data) => {
        console.log('⏹️ 타이핑 중단:', data.userName);
      });

      // 부서 공지
      socket.on('department_broadcast', (message) => {
        console.log('📢 부서 공지:', message);
      });

      socketRef.current = socket;
    } catch (error: any) {
      console.error('웹소켓 초기화 오류:', error);
      setState(prev => ({
        ...prev,
        isConnecting: false,
        error: error.message || '연결 실패'
      }));
    }
  }, [onConnect, onDisconnect, onNotification, onProjectUpdate, onTaskUpdate]);

  // 연결 해제 함수
  const disconnect = useCallback(() => {
    if (socketRef.current) {
      socketRef.current.disconnect();
      socketRef.current = null;
      setState(prev => ({ ...prev, isConnected: false, isConnecting: false }));
    }
  }, []);

  // 알림 구독
  const subscribeToNotifications = useCallback(() => {
    if (socketRef.current?.connected) {
      socketRef.current.emit('subscribe_notifications');
    }
  }, []);

  // 프로젝트 구독
  const subscribeToProject = useCallback((projectId: string) => {
    if (socketRef.current?.connected) {
      socketRef.current.emit('subscribe_project', projectId);
    }
  }, []);

  // 작업 구독
  const subscribeToTask = useCallback((taskId: string) => {
    if (socketRef.current?.connected) {
      socketRef.current.emit('subscribe_task', taskId);
    }
  }, []);

  // 타이핑 시작
  const startTyping = useCallback((taskId: string, commentId?: string) => {
    if (socketRef.current?.connected) {
      socketRef.current.emit('typing_start', { taskId, commentId });
    }
  }, []);

  // 타이핑 중단
  const stopTyping = useCallback((taskId: string) => {
    if (socketRef.current?.connected) {
      socketRef.current.emit('typing_stop', { taskId });
    }
  }, []);

  // 메시지 전송 (일반적인 이벤트)
  const emit = useCallback((event: string, data?: any) => {
    if (socketRef.current?.connected) {
      socketRef.current.emit(event, data);
    }
  }, []);

  // 하트비트 (연결 확인)
  const ping = useCallback(() => {
    if (socketRef.current?.connected) {
      socketRef.current.emit('ping');
    }
  }, []);

  // 자동 연결
  useEffect(() => {
    if (autoConnect) {
      connect();
    }

    return () => {
      disconnect();
    };
  }, [autoConnect, connect, disconnect]);

  // 주기적 하트비트
  useEffect(() => {
    if (state.isConnected) {
      const heartbeat = setInterval(() => {
        ping();
      }, 30000); // 30초마다 ping

      return () => clearInterval(heartbeat);
    }
  }, [state.isConnected, ping]);

  return {
    // 상태
    isConnected: state.isConnected,
    isConnecting: state.isConnecting,
    onlineUsers: state.onlineUsers,
    error: state.error,

    // 연결 관리
    connect,
    disconnect,

    // 구독 관리
    subscribeToNotifications,
    subscribeToProject,
    subscribeToTask,

    // 상호작용
    startTyping,
    stopTyping,
    emit,
    ping,

    // 소켓 인스턴스 (고급 사용)
    socket: socketRef.current
  };
}