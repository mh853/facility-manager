// 하이브리드 연결 관리자 - 단순화 및 안정성 우선
'use client';

interface ConnectionState {
  status: 'connected' | 'connecting' | 'degraded' | 'offline';
  lastConnected: number;
  failureCount: number;
  strategy: 'websocket' | 'polling' | 'cache';
}

interface ConnectionManagerOptions {
  wsUrl: string;
  pollingInterval: number;
  maxRetries: number;
  degradationThreshold: number;
  token: string;
}

export class ConnectionManager {
  private state: ConnectionState = {
    status: 'offline',
    lastConnected: 0,
    failureCount: 0,
    strategy: 'websocket'
  };

  private ws: WebSocket | null = null;
  private pollingTimer: NodeJS.Timeout | null = null;
  private retryTimer: NodeJS.Timeout | null = null;
  private options: ConnectionManagerOptions;
  private listeners = new Map<string, Function[]>();

  constructor(options: ConnectionManagerOptions) {
    this.options = options;
  }

  // 단순화된 연결 시작
  async connect(): Promise<void> {
    this.setState({ status: 'connecting' });

    // 1차: WebSocket 시도
    try {
      await this.tryWebSocket();
      this.setState({ status: 'connected', strategy: 'websocket', failureCount: 0 });
      return;
    } catch (error) {
      console.warn('WebSocket 연결 실패, 폴링으로 전환:', error);
      this.state.failureCount++;
    }

    // 2차: Smart Polling 전환
    if (this.state.failureCount >= this.options.degradationThreshold) {
      this.setState({ status: 'degraded', strategy: 'polling' });
      this.startPolling();
    } else {
      // 3차: 캐시 모드
      this.setState({ status: 'offline', strategy: 'cache' });
    }
  }

  private async tryWebSocket(): Promise<void> {
    return new Promise((resolve, reject) => {
      // Supabase Realtime 직접 사용 (Socket.IO 제거)
      const wsUrl = `${this.options.wsUrl}/realtime/v1/websocket?apikey=${this.options.token}&vsn=1.0.0`;

      this.ws = new WebSocket(wsUrl);

      const timeout = setTimeout(() => {
        this.ws?.close();
        reject(new Error('WebSocket 연결 타임아웃'));
      }, 10000);

      this.ws.onopen = () => {
        clearTimeout(timeout);
        this.state.lastConnected = Date.now();
        this.setupWebSocketListeners();
        resolve();
      };

      this.ws.onerror = (error) => {
        clearTimeout(timeout);
        reject(error);
      };
    });
  }

  private setupWebSocketListeners(): void {
    if (!this.ws) return;

    this.ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        this.emit('notification', data);
      } catch (error) {
        console.error('WebSocket 메시지 파싱 오류:', error);
      }
    };

    this.ws.onclose = () => {
      this.state.failureCount++;
      if (this.state.status === 'connected') {
        // 예상치 못한 연결 끊김 - 폴링으로 전환
        this.fallbackToPolling();
      }
    };
  }

  private startPolling(): void {
    if (this.pollingTimer) return;

    // 적응적 폴링 간격 (1초 ~ 30초)
    const interval = Math.min(
      this.options.pollingInterval * Math.pow(1.5, this.state.failureCount),
      30000
    );

    this.pollingTimer = setInterval(async () => {
      try {
        const response = await fetch('/api/notifications/poll', {
          headers: { 'Authorization': `Bearer ${this.options.token}` }
        });

        if (response.ok) {
          const data = await response.json();
          if (data.notifications?.length > 0) {
            data.notifications.forEach((notification: any) => {
              this.emit('notification', notification);
            });
          }

          // 폴링 성공시 WebSocket 재시도
          if (this.state.failureCount > 0) {
            this.state.failureCount--;
            if (this.state.failureCount === 0) {
              this.attemptUpgrade();
            }
          }
        }
      } catch (error) {
        console.error('폴링 오류:', error);
        this.state.failureCount++;
      }
    }, interval);
  }

  private fallbackToPolling(): void {
    this.ws?.close();
    this.ws = null;
    this.setState({ status: 'degraded', strategy: 'polling' });
    this.startPolling();
  }

  private attemptUpgrade(): void {
    // 폴링 중에 주기적으로 WebSocket 업그레이드 시도
    this.retryTimer = setTimeout(() => {
      if (this.state.strategy === 'polling') {
        this.connect(); // WebSocket 재시도
      }
    }, 60000); // 1분 후 재시도
  }

  // 이벤트 리스너 관리
  on(event: string, callback: Function): void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
    }
    this.listeners.get(event)!.push(callback);
  }

  private emit(event: string, data: any): void {
    const callbacks = this.listeners.get(event) || [];
    callbacks.forEach(callback => {
      try {
        callback(data);
      } catch (error) {
        console.error(`이벤트 ${event} 처리 오류:`, error);
      }
    });
  }

  private setState(updates: Partial<ConnectionState>): void {
    this.state = { ...this.state, ...updates };
    this.emit('status', this.state);
  }

  // 연결 해제
  disconnect(): void {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    if (this.pollingTimer) {
      clearInterval(this.pollingTimer);
      this.pollingTimer = null;
    }
    if (this.retryTimer) {
      clearTimeout(this.retryTimer);
      this.retryTimer = null;
    }
    this.setState({ status: 'offline' });
  }

  // 현재 상태 조회
  getState(): ConnectionState {
    return { ...this.state };
  }

  // 수동 새로고침 (사용자 액션)
  async refresh(): Promise<void> {
    this.state.failureCount = 0; // 리셋
    await this.connect();
  }
}