// 알림 시스템 성능 설정 및 균형점 정의
export const NotificationPerformanceConfig = {
  // 연결 관리
  connection: {
    // WebSocket 연결 타임아웃 (10초)
    websocketTimeout: 10000,

    // 최대 재시도 횟수 (서버리스 환경 고려)
    maxRetries: 3,

    // 폴링으로 전환되는 실패 임계값
    degradationThreshold: 2,

    // Circuit Breaker 대기 시간 (5분)
    circuitBreakerTimeout: 300000
  },

  // 폴링 전략
  polling: {
    // 기본 폴링 간격 (30초)
    defaultInterval: 30000,

    // 최소 폴링 간격 (5초)
    minInterval: 5000,

    // 최대 폴링 간격 (5분)
    maxInterval: 300000,

    // 적응적 폴링 승수
    adaptiveMultiplier: 1.5,

    // 우선순위별 폴링 간격 조정
    priorityAdjustment: {
      critical: 0.5,  // 2배 빠르게
      high: 0.8,      // 1.25배 빠르게
      medium: 1.0,    // 기본
      low: 2.0        // 2배 느리게
    }
  },

  // 캐시 관리
  cache: {
    // 로컬 캐시 만료 시간 (5분)
    localExpiry: 300000,

    // API 응답 캐시 시간 (30초)
    apiCacheExpiry: 30000,

    // 최대 캐시 항목 수
    maxCacheItems: 1000,

    // 캐시 정리 임계값
    cleanupThreshold: 1200
  },

  // UI 최적화
  ui: {
    // 드롭다운 최대 알림 수
    maxDropdownItems: 20,

    // 읽지 않은 알림 배지 최대 표시 수
    maxBadgeCount: 99,

    // 상대 시간 업데이트 간격 (1분)
    relativeTimeUpdateInterval: 60000,

    // 애니메이션 지속 시간
    animationDuration: 200,

    // 디바운스 지연 시간
    debounceDelay: 300
  },

  // 알림 처리
  notifications: {
    // 최대 알림 보관 수
    maxStoredNotifications: 100,

    // 만료된 알림 정리 간격 (1시간)
    cleanupInterval: 3600000,

    // 브라우저 알림 표시 시간 (5초)
    browserNotificationDuration: 5000,

    // 소리 알림 볼륨
    soundVolume: 0.3,

    // 배치 처리 크기
    batchSize: 50
  },

  // 성능 임계값
  thresholds: {
    // 연결 지연 경고 임계값 (2초)
    connectionLatencyWarning: 2000,

    // API 응답 시간 경고 임계값 (3초)
    apiResponseWarning: 3000,

    // 메모리 사용량 경고 임계값 (50MB)
    memoryWarning: 50 * 1024 * 1024,

    // CPU 사용률 경고 임계값 (80%)
    cpuWarning: 80
  },

  // 우선순위별 처리 전략
  priorityStrategy: {
    critical: {
      // 즉시 처리
      maxDelay: 0,
      // 항상 브라우저 알림 표시
      forceNotification: true,
      // 음성 알림 사용
      useSound: true,
      // 폴링 간격 단축
      pollingBoost: 0.5
    },
    high: {
      maxDelay: 1000,
      forceNotification: true,
      useSound: true,
      pollingBoost: 0.8
    },
    medium: {
      maxDelay: 5000,
      forceNotification: false,
      useSound: false,
      pollingBoost: 1.0
    },
    low: {
      maxDelay: 30000,
      forceNotification: false,
      useSound: false,
      pollingBoost: 2.0
    }
  },

  // 네트워크 상태별 전략
  networkStrategy: {
    // 빠른 연결 (>1Mbps)
    fast: {
      strategy: 'websocket',
      pollingInterval: 30000,
      enableAnimations: true,
      prefetchData: true
    },
    // 보통 연결 (>100kbps)
    medium: {
      strategy: 'polling',
      pollingInterval: 60000,
      enableAnimations: true,
      prefetchData: false
    },
    // 느린 연결 (<100kbps)
    slow: {
      strategy: 'cache',
      pollingInterval: 300000,
      enableAnimations: false,
      prefetchData: false
    }
  },

  // 사용자 경험 최적화
  ux: {
    // 깜빡임 방지를 위한 최소 표시 시간
    minDisplayTime: 100,

    // 상태 변경 디바운스 시간
    stateChangeDebounce: 150,

    // 로딩 상태 표시 지연
    loadingStateDelay: 500,

    // 오류 메시지 표시 시간
    errorMessageDuration: 5000,

    // 성공 메시지 표시 시간
    successMessageDuration: 3000
  }
};

// 현재 환경에 따른 설정 조정
export function getOptimizedConfig() {
  const config = { ...NotificationPerformanceConfig };

  // 모바일 환경 감지
  if (typeof window !== 'undefined') {
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);

    if (isMobile) {
      // 모바일에서는 더 보수적인 설정
      config.polling.defaultInterval = 60000; // 1분
      config.ui.maxDropdownItems = 10;
      config.notifications.maxStoredNotifications = 50;
    }
  }

  // 프로덕션 환경에서는 더 안정적인 설정
  if (process.env.NODE_ENV === 'production') {
    config.connection.maxRetries = 5;
    config.polling.defaultInterval = 45000; // 45초
    config.cache.apiCacheExpiry = 60000; // 1분
  }

  return config;
}