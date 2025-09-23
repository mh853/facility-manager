'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNotification, NotificationSettings } from '@/contexts/NotificationContext';

// 캐시 키 상수
const CACHE_KEYS = {
  SETTINGS: 'notification-settings-v2',
  LAST_FETCH: 'notification-settings-last-fetch',
  UNREAD_COUNT: 'notification-unread-count',
} as const;

// 캐시 만료 시간 (30분)
const CACHE_EXPIRY = 30 * 60 * 1000;

// 기본 설정
const DEFAULT_SETTINGS: NotificationSettings = {
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
  quietHoursEnabled: false,
};

interface UseOptimizedNotificationsReturn {
  // 상태
  settings: NotificationSettings | null;
  loading: boolean;
  error: string | null;

  // 액션
  updateSettings: (newSettings: Partial<NotificationSettings>) => Promise<void>;
  refreshSettings: () => Promise<void>;
  clearCache: () => void;

  // 캐시 상태
  isCached: boolean;
  lastFetch: Date | null;
}

/**
 * 캐싱과 즉시 로딩을 지원하는 최적화된 알림 설정 훅
 */
export function useOptimizedNotifications(): UseOptimizedNotificationsReturn {
  const { settings: contextSettings, updateSettings: contextUpdateSettings, loading: contextLoading } = useNotification();

  const [settings, setSettings] = useState<NotificationSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isCached, setIsCached] = useState(false);
  const [lastFetch, setLastFetch] = useState<Date | null>(null);

  const initializationRef = useRef(false);
  const abortControllerRef = useRef<AbortController | null>(null);

  // 캐시된 설정 로드
  const loadCachedSettings = useCallback((): NotificationSettings | null => {
    try {
      const cachedSettings = localStorage.getItem(CACHE_KEYS.SETTINGS);
      const lastFetchStr = localStorage.getItem(CACHE_KEYS.LAST_FETCH);

      if (cachedSettings && lastFetchStr) {
        const lastFetchTime = new Date(lastFetchStr);
        const now = new Date();

        // 캐시가 유효한지 확인
        if (now.getTime() - lastFetchTime.getTime() < CACHE_EXPIRY) {
          const parsed = JSON.parse(cachedSettings);
          setLastFetch(lastFetchTime);
          setIsCached(true);
          console.log('✅ [NOTIFICATIONS] 캐시된 설정 로드 성공:', {
            lastFetch: lastFetchTime,
            age: `${Math.round((now.getTime() - lastFetchTime.getTime()) / 1000)}초`
          });
          return parsed;
        } else {
          console.log('⚠️ [NOTIFICATIONS] 캐시 만료됨, 새로고침 필요');
          // 만료된 캐시 정리
          localStorage.removeItem(CACHE_KEYS.SETTINGS);
          localStorage.removeItem(CACHE_KEYS.LAST_FETCH);
        }
      }

      return null;
    } catch (error) {
      console.error('❌ [NOTIFICATIONS] 캐시 로드 실패:', error);
      return null;
    }
  }, []);

  // 캐시에 설정 저장
  const saveCachedSettings = useCallback((settingsToCache: NotificationSettings) => {
    try {
      const now = new Date();
      localStorage.setItem(CACHE_KEYS.SETTINGS, JSON.stringify(settingsToCache));
      localStorage.setItem(CACHE_KEYS.LAST_FETCH, now.toISOString());
      setLastFetch(now);
      setIsCached(true);
      console.log('✅ [NOTIFICATIONS] 설정 캐시 저장 성공');
    } catch (error) {
      console.error('❌ [NOTIFICATIONS] 캐시 저장 실패:', error);
    }
  }, []);

  // 초기화 - 캐시된 설정을 즉시 로드
  useEffect(() => {
    if (initializationRef.current) return;
    initializationRef.current = true;

    console.log('🔄 [NOTIFICATIONS] 최적화된 훅 초기화 시작');

    // 1. 캐시된 설정 즉시 로드
    const cached = loadCachedSettings();
    if (cached) {
      setSettings(cached);
      setLoading(false);
      setError(null);
    } else {
      // 캐시가 없으면 기본 설정 사용
      setSettings(DEFAULT_SETTINGS);
      setLoading(false);
      setIsCached(false);
      console.log('📋 [NOTIFICATIONS] 기본 설정 적용');
    }
  }, [loadCachedSettings]);

  // Context 설정이 로드되면 업데이트
  useEffect(() => {
    if (contextSettings && !contextLoading) {
      console.log('🔄 [NOTIFICATIONS] Context 설정 동기화');
      setSettings(contextSettings);
      setLoading(false);
      setError(null);
      saveCachedSettings(contextSettings);
    }
  }, [contextSettings, contextLoading, saveCachedSettings]);

  // 설정 업데이트
  const updateSettings = useCallback(async (newSettings: Partial<NotificationSettings>) => {
    if (!settings) return;

    try {
      setError(null);

      // 낙관적 업데이트
      const updatedSettings = { ...settings, ...newSettings };
      setSettings(updatedSettings);
      saveCachedSettings(updatedSettings);

      // Context를 통해 서버 업데이트
      await contextUpdateSettings(newSettings);

      console.log('✅ [NOTIFICATIONS] 설정 업데이트 성공');
    } catch (error) {
      console.error('❌ [NOTIFICATIONS] 설정 업데이트 실패:', error);
      setError(error instanceof Error ? error.message : '설정 업데이트에 실패했습니다.');

      // 실패 시 이전 상태로 롤백
      if (contextSettings) {
        setSettings(contextSettings);
        saveCachedSettings(contextSettings);
      }
    }
  }, [settings, contextUpdateSettings, saveCachedSettings, contextSettings]);

  // 설정 새로고침
  const refreshSettings = useCallback(async () => {
    try {
      // 이전 요청 취소
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }

      abortControllerRef.current = new AbortController();
      setLoading(true);
      setError(null);

      // Context를 통해 최신 설정 가져오기
      // 이는 fetchSettings()를 직접 호출할 수 없으므로 컴포넌트 리마운트를 통해 처리
      window.location.reload();

    } catch (error) {
      console.error('❌ [NOTIFICATIONS] 설정 새로고침 실패:', error);
      setError(error instanceof Error ? error.message : '설정을 새로고침할 수 없습니다.');
    } finally {
      setLoading(false);
    }
  }, []);

  // 캐시 초기화
  const clearCache = useCallback(() => {
    try {
      localStorage.removeItem(CACHE_KEYS.SETTINGS);
      localStorage.removeItem(CACHE_KEYS.LAST_FETCH);
      localStorage.removeItem(CACHE_KEYS.UNREAD_COUNT);
      setIsCached(false);
      setLastFetch(null);
      console.log('🧹 [NOTIFICATIONS] 캐시 초기화 완료');
    } catch (error) {
      console.error('❌ [NOTIFICATIONS] 캐시 초기화 실패:', error);
    }
  }, []);

  // 컴포넌트 언마운트 시 정리
  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  // 메모이제이션된 반환값
  const returnValue = useMemo(() => ({
    settings,
    loading,
    error,
    updateSettings,
    refreshSettings,
    clearCache,
    isCached,
    lastFetch,
  }), [settings, loading, error, updateSettings, refreshSettings, clearCache, isCached, lastFetch]);

  return returnValue;
}

// 타입 가드
export function isValidNotificationSettings(value: any): value is NotificationSettings {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof value.taskNotifications === 'boolean' &&
    typeof value.systemNotifications === 'boolean' &&
    typeof value.pushNotificationsEnabled === 'boolean'
  );
}

// 설정 검증 및 마이그레이션
export function migrateNotificationSettings(oldSettings: any): NotificationSettings {
  if (isValidNotificationSettings(oldSettings)) {
    // 누락된 속성을 기본값으로 채움
    return {
      ...DEFAULT_SETTINGS,
      ...oldSettings,
    };
  }

  console.warn('⚠️ [NOTIFICATIONS] 잘못된 설정 포맷, 기본 설정 사용');
  return DEFAULT_SETTINGS;
}