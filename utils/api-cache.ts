// utils/api-cache.ts - API 응답 캐싱 및 최적화
type CacheEntry<T> = {
  data: T;
  timestamp: number;
  etag?: string;
  expiresAt: number;
};

type CacheConfig = {
  ttl?: number; // Time to live in milliseconds
  staleWhileRevalidate?: number; // Stale time in milliseconds
  maxSize?: number; // Max cache entries
};

export class APICache {
  private static cache = new Map<string, CacheEntry<any>>();
  private static accessTimes = new Map<string, number>();
  private static defaultConfig: Required<CacheConfig> = {
    ttl: 5 * 60 * 1000, // 5 minutes
    staleWhileRevalidate: 30 * 60 * 1000, // 30 minutes
    maxSize: 100
  };

  // 캐시 키 생성
  static generateCacheKey(url: string, params?: Record<string, any>): string {
    const baseKey = url.replace(/^\/api\//, '').replace(/\//g, ':');
    if (!params) return baseKey;
    
    const sortedParams = Object.keys(params)
      .sort()
      .map(key => `${key}=${encodeURIComponent(params[key])}`)
      .join('&');
    
    return `${baseKey}?${sortedParams}`;
  }

  // 캐시에서 데이터 가져오기
  static get<T>(key: string): { data: T; isStale: boolean } | null {
    const entry = this.cache.get(key);
    if (!entry) return null;

    const now = Date.now();
    this.accessTimes.set(key, now);

    // 만료된 경우 삭제
    if (now > entry.expiresAt) {
      this.cache.delete(key);
      this.accessTimes.delete(key);
      return null;
    }

    // Fresh 또는 stale 판단
    const isStale = now > entry.timestamp + this.defaultConfig.ttl;
    return { data: entry.data, isStale };
  }

  // 캐시에 데이터 저장
  static set<T>(key: string, data: T, config: CacheConfig = {}, etag?: string): void {
    const finalConfig = { ...this.defaultConfig, ...config };
    const now = Date.now();

    // 캐시 크기 제한
    if (this.cache.size >= finalConfig.maxSize) {
      this.evictLRU();
    }

    this.cache.set(key, {
      data,
      timestamp: now,
      etag,
      expiresAt: now + finalConfig.staleWhileRevalidate
    });
    
    this.accessTimes.set(key, now);
    console.log(`📋 [API-CACHE] 캐시 저장: ${key} (TTL: ${finalConfig.ttl/1000}s)`);
  }

  // LRU 방식으로 오래된 항목 제거
  private static evictLRU(): void {
    let oldestKey = '';
    let oldestTime = Date.now();

    for (const [key, time] of this.accessTimes.entries()) {
      if (time < oldestTime) {
        oldestTime = time;
        oldestKey = key;
      }
    }

    if (oldestKey) {
      this.cache.delete(oldestKey);
      this.accessTimes.delete(oldestKey);
      console.log(`🗑️ [API-CACHE] LRU 제거: ${oldestKey}`);
    }
  }

  // ETag 검증
  static validateETag(key: string, etag: string): boolean {
    const entry = this.cache.get(key);
    return entry?.etag === etag;
  }

  // 캐시 무효화
  static invalidate(pattern?: string): void {
    if (!pattern) {
      this.cache.clear();
      this.accessTimes.clear();
      console.log('🧹 [API-CACHE] 전체 캐시 클리어');
      return;
    }

    const regex = new RegExp(pattern);
    const keysToDelete: string[] = [];

    for (const key of this.cache.keys()) {
      if (regex.test(key)) {
        keysToDelete.push(key);
      }
    }

    keysToDelete.forEach(key => {
      this.cache.delete(key);
      this.accessTimes.delete(key);
    });

    console.log(`🧹 [API-CACHE] 패턴 캐시 클리어: ${pattern} (${keysToDelete.length}개)`);
  }

  // 캐시 통계
  static getStats(): {
    size: number;
    maxSize: number;
    hitRate: number;
    oldestEntry: string | null;
  } {
    const stats = {
      size: this.cache.size,
      maxSize: this.defaultConfig.maxSize,
      hitRate: 0, // 실제 구현시 히트율 계산 필요
      oldestEntry: null as string | null
    };

    if (this.accessTimes.size > 0) {
      let oldestKey = '';
      let oldestTime = Date.now();

      for (const [key, time] of this.accessTimes.entries()) {
        if (time < oldestTime) {
          oldestTime = time;
          oldestKey = key;
        }
      }

      stats.oldestEntry = oldestKey;
    }

    return stats;
  }
}

// Fetch wrapper with caching
export async function cachedFetch<T>(
  url: string,
  options: RequestInit & { cache?: CacheConfig } = {}
): Promise<T> {
  const { cache: cacheConfig, ...fetchOptions } = options;
  const method = (fetchOptions.method || 'GET').toUpperCase();
  
  // POST/PUT/DELETE는 캐시하지 않음
  if (method !== 'GET') {
    const response = await fetch(url, fetchOptions);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    return response.json();
  }

  const cacheKey = APICache.generateCacheKey(url, fetchOptions.body ? JSON.parse(fetchOptions.body as string) : undefined);
  
  // 캐시 확인
  const cached = APICache.get<T>(cacheKey);
  if (cached && !cached.isStale) {
    console.log(`⚡ [API-CACHE] 캐시 히트: ${cacheKey}`);
    return cached.data;
  }

  try {
    // 조건부 요청 (If-None-Match)
    const headers = { ...fetchOptions.headers };
    const cachedEntry = cached ? APICache.cache.get(cacheKey) : null;
    if (cachedEntry?.etag) {
      headers['If-None-Match'] = cachedEntry.etag;
    }

    const response = await fetch(url, {
      ...fetchOptions,
      headers
    });

    // 304 Not Modified - 캐시된 데이터 사용
    if (response.status === 304 && cached) {
      console.log(`🔄 [API-CACHE] 304 Not Modified: ${cacheKey}`);
      return cached.data;
    }

    if (!response.ok) {
      // 네트워크 에러시 stale 캐시 사용
      if (cached) {
        console.log(`⚠️ [API-CACHE] 네트워크 에러, stale 캐시 사용: ${cacheKey}`);
        return cached.data;
      }
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();
    const etag = response.headers.get('etag') || undefined;

    // 캐시 저장
    APICache.set(cacheKey, data, cacheConfig, etag);

    return data;
  } catch (error) {
    // 에러시 stale 캐시 폴백
    if (cached) {
      console.log(`⚠️ [API-CACHE] 에러 발생, stale 캐시 사용: ${cacheKey}`);
      return cached.data;
    }
    throw error;
  }
}

// Background revalidation
export function revalidateInBackground<T>(
  url: string,
  options: RequestInit = {}
): void {
  setTimeout(async () => {
    try {
      console.log(`🔄 [API-CACHE] Background revalidation: ${url}`);
      await cachedFetch<T>(url, options);
    } catch (error) {
      console.warn(`⚠️ [API-CACHE] Background revalidation 실패: ${url}`, error);
    }
  }, 100);
}

export default APICache;