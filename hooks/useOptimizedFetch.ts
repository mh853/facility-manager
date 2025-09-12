// hooks/useOptimizedFetch.ts - 최적화된 API 요청 훅
'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { cachedFetch, revalidateInBackground, APICache } from '@/utils/api-cache';

interface FetchState<T> {
  data: T | null;
  loading: boolean;
  error: Error | null;
  isStale: boolean;
}

interface OptimizedFetchConfig {
  enabled?: boolean;
  refetchOnWindowFocus?: boolean;
  refetchOnReconnect?: boolean;
  staleTime?: number;
  cacheTime?: number;
  onSuccess?: (data: any) => void;
  onError?: (error: Error) => void;
}

export function useOptimizedFetch<T>(
  url: string | null,
  options: RequestInit & { cache?: { ttl?: number; staleWhileRevalidate?: number } } = {},
  config: OptimizedFetchConfig = {}
) {
  const {
    enabled = true,
    refetchOnWindowFocus = true,
    refetchOnReconnect = true,
    staleTime = 5 * 60 * 1000, // 5분
    cacheTime = 30 * 60 * 1000, // 30분
    onSuccess,
    onError
  } = config;

  const [state, setState] = useState<FetchState<T>>({
    data: null,
    loading: false,
    error: null,
    isStale: false
  });

  const abortControllerRef = useRef<AbortController | null>(null);
  const lastFetchTime = useRef<number>(0);

  // 실제 fetch 실행
  const executeFetch = useCallback(async (force = false) => {
    if (!url || !enabled) return;

    // 중복 요청 방지
    const now = Date.now();
    if (!force && now - lastFetchTime.current < 100) return;

    // 기존 요청 취소
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    abortControllerRef.current = new AbortController();
    
    try {
      setState(prev => ({ ...prev, loading: true, error: null }));
      lastFetchTime.current = now;

      const data = await cachedFetch<T>(url, {
        ...options,
        signal: abortControllerRef.current.signal,
        cache: {
          ttl: staleTime,
          staleWhileRevalidate: cacheTime,
          ...options.cache
        }
      });

      setState({
        data,
        loading: false,
        error: null,
        isStale: false
      });

      onSuccess?.(data);
    } catch (error) {
      if (error.name === 'AbortError') return;

      const err = error instanceof Error ? error : new Error(String(error));
      setState(prev => ({ ...prev, loading: false, error: err }));
      onError?.(err);
    }
  }, [url, enabled, options, staleTime, cacheTime, onSuccess, onError]);

  // Stale 상태 확인 및 background revalidation
  const checkStaleAndRevalidate = useCallback(() => {
    if (!url) return;

    const cacheKey = APICache.generateCacheKey(url);
    const cached = APICache.get(cacheKey);
    
    if (cached?.isStale) {
      setState(prev => ({ ...prev, isStale: true }));
      revalidateInBackground(url, options);
    }
  }, [url, options]);

  // 초기 fetch
  useEffect(() => {
    executeFetch();
  }, [executeFetch]);

  // Stale 상태 확인 (주기적)
  useEffect(() => {
    const interval = setInterval(checkStaleAndRevalidate, 30000); // 30초마다 확인
    return () => clearInterval(interval);
  }, [checkStaleAndRevalidate]);

  // Window focus 시 revalidation
  useEffect(() => {
    if (!refetchOnWindowFocus) return;

    const handleFocus = () => {
      checkStaleAndRevalidate();
    };

    window.addEventListener('focus', handleFocus);
    return () => window.removeEventListener('focus', handleFocus);
  }, [refetchOnWindowFocus, checkStaleAndRevalidate]);

  // 네트워크 재연결 시 revalidation
  useEffect(() => {
    if (!refetchOnReconnect) return;

    const handleOnline = () => {
      executeFetch(true);
    };

    window.addEventListener('online', handleOnline);
    return () => window.removeEventListener('online', handleOnline);
  }, [refetchOnReconnect, executeFetch]);

  // 컴포넌트 언마운트 시 요청 취소
  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  // 수동 refetch
  const refetch = useCallback(() => {
    return executeFetch(true);
  }, [executeFetch]);

  // 캐시 무효화
  const invalidate = useCallback(() => {
    if (!url) return;
    const cacheKey = APICache.generateCacheKey(url);
    APICache.invalidate(cacheKey);
    executeFetch(true);
  }, [url, executeFetch]);

  return {
    ...state,
    refetch,
    invalidate,
    isFetching: state.loading
  };
}

// 무한 스크롤용 페이지네이션 훅
export function useOptimizedInfiniteQuery<T>(
  getUrl: (page: number) => string | null,
  options: RequestInit = {},
  config: OptimizedFetchConfig = {}
) {
  const [pages, setPages] = useState<T[]>([]);
  const [currentPage, setCurrentPage] = useState(0);
  const [hasNextPage, setHasNextPage] = useState(true);

  const url = getUrl(currentPage);
  
  const { data, loading, error, refetch } = useOptimizedFetch<T>(
    hasNextPage ? url : null,
    options,
    {
      ...config,
      onSuccess: (data) => {
        setPages(prev => [...prev, data]);
        // 다음 페이지 존재 여부 확인 로직 (API 응답 구조에 따라 조정 필요)
        const hasNext = Array.isArray(data) && data.length > 0;
        setHasNextPage(hasNext);
        config.onSuccess?.(data);
      }
    }
  );

  const fetchNextPage = useCallback(() => {
    if (hasNextPage && !loading) {
      setCurrentPage(prev => prev + 1);
    }
  }, [hasNextPage, loading]);

  const reset = useCallback(() => {
    setPages([]);
    setCurrentPage(0);
    setHasNextPage(true);
  }, []);

  return {
    data: pages,
    fetchNextPage,
    hasNextPage,
    isFetching: loading,
    error,
    refetch: () => {
      reset();
      refetch();
    },
    reset
  };
}

export default useOptimizedFetch;