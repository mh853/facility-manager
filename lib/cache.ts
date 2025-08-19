// lib/cache.ts - 강화된 캐싱 시스템
interface CacheItem<T> {
  data: T;
  timestamp: number;
  ttl: number; // Time To Live in minutes
}

class MemoryCache {
  private cache = new Map<string, CacheItem<any>>();
  private maxSize = 1000; // 최대 캐시 항목 수
  private cleanupInterval: NodeJS.Timeout;

  constructor() {
    // 5분마다 만료된 캐시 정리
    this.cleanupInterval = setInterval(() => {
      this.cleanup();
    }, 5 * 60 * 1000);
  }

  set<T>(key: string, data: T, ttlMinutes: number = 10): void {
    // 캐시 크기 제한
    if (this.cache.size >= this.maxSize) {
      this.evictOldest();
    }

    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      ttl: ttlMinutes
    });
    
    console.log(`💾 [CACHE] 저장: ${key} (TTL: ${ttlMinutes}분)`);
  }

  get<T>(key: string): T | null {
    const item = this.cache.get(key);
    
    if (!item) {
      console.log(`💾 [CACHE] 미스: ${key}`);
      return null;
    }

    const now = Date.now();
    const ageMinutes = (now - item.timestamp) / (1000 * 60);
    
    if (ageMinutes > item.ttl) {
      console.log(`💾 [CACHE] 만료: ${key} (${ageMinutes.toFixed(1)}분 경과)`);
      this.cache.delete(key);
      return null;
    }

    console.log(`💾 [CACHE] 히트: ${key} (${ageMinutes.toFixed(1)}분 전 데이터)`);
    return item.data;
  }

  delete(key: string): boolean {
    const deleted = this.cache.delete(key);
    if (deleted) {
      console.log(`💾 [CACHE] 삭제: ${key}`);
    }
    return deleted;
  }

  clear(): void {
    this.cache.clear();
    console.log(`💾 [CACHE] 전체 삭제`);
  }

  // 만료된 항목 정리
  private cleanup(): void {
    const now = Date.now();
    let cleanedCount = 0;

    for (const [key, item] of this.cache.entries()) {
      const ageMinutes = (now - item.timestamp) / (1000 * 60);
      if (ageMinutes > item.ttl) {
        this.cache.delete(key);
        cleanedCount++;
      }
    }

    if (cleanedCount > 0) {
      console.log(`💾 [CACHE] 정리 완료: ${cleanedCount}개 항목 삭제`);
    }
  }

  // 가장 오래된 항목 제거
  private evictOldest(): void {
    let oldestKey = '';
    let oldestTime = Date.now();

    for (const [key, item] of this.cache.entries()) {
      if (item.timestamp < oldestTime) {
        oldestTime = item.timestamp;
        oldestKey = key;
      }
    }

    if (oldestKey) {
      this.cache.delete(oldestKey);
      console.log(`💾 [CACHE] LRU 제거: ${oldestKey}`);
    }
  }

  // 캐시 상태 정보
  getStats() {
    return {
      size: this.cache.size,
      maxSize: this.maxSize,
      keys: Array.from(this.cache.keys())
    };
  }

  // 정리 작업 중단
  destroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
    this.clear();
  }
}

// 전역 캐시 인스턴스
export const memoryCache = new MemoryCache();

// Next.js 환경에서 프로세스 종료 시 정리
if (typeof process !== 'undefined') {
  process.on('beforeExit', () => {
    memoryCache.destroy();
  });
}
