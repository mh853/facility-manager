// utils/performance-monitor.ts - 성능 모니터링
interface PerformanceMetrics {
  timestamp: number;
  url: string;
  method: string;
  duration: number;
  status: number;
  cacheHit?: boolean;
  userAgent?: string;
}

class PerformanceMonitor {
  private metrics: PerformanceMetrics[] = [];
  private maxEntries = 1000;

  // API 성능 측정
  measureAPI(url: string, method: string, startTime: number, status: number, cacheHit?: boolean): void {
    const duration = Date.now() - startTime;
    
    this.addMetric({
      timestamp: Date.now(),
      url,
      method,
      duration,
      status,
      cacheHit,
      userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : undefined
    });

    // 느린 API 경고
    if (duration > 3000) {
      console.warn(`🐌 [PERFORMANCE] 느린 API 감지: ${method} ${url} (${duration}ms)`);
    }
  }

  // 메트릭 추가
  private addMetric(metric: PerformanceMetrics): void {
    this.metrics.push(metric);
    
    // 최대 항목 수 제한
    if (this.metrics.length > this.maxEntries) {
      this.metrics.shift();
    }
  }

  // 성능 통계
  getStats(timeWindow: number = 300000): {
    totalRequests: number;
    averageResponseTime: number;
    slowRequests: number;
    cacheHitRate: number;
    errorRate: number;
    topSlowUrls: Array<{url: string, avgTime: number}>;
  } {
    const now = Date.now();
    const recentMetrics = this.metrics.filter(m => now - m.timestamp <= timeWindow);
    
    if (recentMetrics.length === 0) {
      return {
        totalRequests: 0,
        averageResponseTime: 0,
        slowRequests: 0,
        cacheHitRate: 0,
        errorRate: 0,
        topSlowUrls: []
      };
    }

    const totalRequests = recentMetrics.length;
    const averageResponseTime = recentMetrics.reduce((sum, m) => sum + m.duration, 0) / totalRequests;
    const slowRequests = recentMetrics.filter(m => m.duration > 2000).length;
    const cacheHits = recentMetrics.filter(m => m.cacheHit === true).length;
    const cacheRequests = recentMetrics.filter(m => m.cacheHit !== undefined).length;
    const errors = recentMetrics.filter(m => m.status >= 400).length;

    // URL별 평균 응답 시간
    const urlStats = new Map<string, {total: number, count: number}>();
    recentMetrics.forEach(m => {
      const current = urlStats.get(m.url) || {total: 0, count: 0};
      urlStats.set(m.url, {
        total: current.total + m.duration,
        count: current.count + 1
      });
    });

    const topSlowUrls = Array.from(urlStats.entries())
      .map(([url, stats]) => ({url, avgTime: stats.total / stats.count}))
      .sort((a, b) => b.avgTime - a.avgTime)
      .slice(0, 5);

    return {
      totalRequests,
      averageResponseTime: Math.round(averageResponseTime),
      slowRequests,
      cacheHitRate: cacheRequests > 0 ? Math.round((cacheHits / cacheRequests) * 100) : 0,
      errorRate: Math.round((errors / totalRequests) * 100),
      topSlowUrls
    };
  }

  // 성능 리포트 출력
  printReport(): void {
    const stats = this.getStats();
    
    console.log(`
🚀 [PERFORMANCE REPORT]
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📊 총 요청: ${stats.totalRequests}개
⏱️  평균 응답시간: ${stats.averageResponseTime}ms
🐌 느린 요청: ${stats.slowRequests}개 (${Math.round(stats.slowRequests / stats.totalRequests * 100)}%)
💾 캐시 적중률: ${stats.cacheHitRate}%
❌ 에러율: ${stats.errorRate}%

🔝 가장 느린 URL:
${stats.topSlowUrls.map(item => `   ${item.url}: ${item.avgTime}ms`).join('\n')}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    `);
  }

  // 브라우저 성능 메트릭 (클라이언트용)
  measurePagePerformance(): void {
    if (typeof window === 'undefined') return;

    window.addEventListener('load', () => {
      // Navigation Timing API 사용
      const navigation = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
      
      if (navigation) {
        const metrics = {
          DNS: navigation.domainLookupEnd - navigation.domainLookupStart,
          TCP: navigation.connectEnd - navigation.connectStart,
          Request: navigation.responseStart - navigation.requestStart,
          Response: navigation.responseEnd - navigation.responseStart,
          DOM: navigation.domContentLoadedEventEnd - navigation.responseEnd,
          Load: navigation.loadEventEnd - navigation.loadEventStart,
          Total: navigation.loadEventEnd - navigation.navigationStart
        };

        console.log(`
📈 [PAGE PERFORMANCE]
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🌐 DNS 조회: ${metrics.DNS}ms
🔌 TCP 연결: ${metrics.TCP}ms
📤 요청: ${metrics.Request}ms  
📥 응답: ${metrics.Response}ms
🏗️  DOM 구성: ${metrics.DOM}ms
📦 로드 완료: ${metrics.Load}ms
⏱️  총 시간: ${metrics.Total}ms
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
        `);

        // 성능 임계값 체크
        if (metrics.Total > 5000) {
          console.warn('🚨 페이지 로딩이 5초를 초과했습니다!');
        }
      }

      // Core Web Vitals 측정
      this.measureCoreWebVitals();
    });
  }

  // Core Web Vitals 측정
  private measureCoreWebVitals(): void {
    if (typeof window === 'undefined') return;

    // LCP (Largest Contentful Paint)
    new PerformanceObserver((entryList) => {
      const entries = entryList.getEntries();
      const lastEntry = entries[entries.length - 1];
      console.log(`📊 LCP: ${Math.round(lastEntry.startTime)}ms`);
    }).observe({entryTypes: ['largest-contentful-paint']});

    // FID (First Input Delay) - 사용자 상호작용 시 측정
    new PerformanceObserver((entryList) => {
      const entries = entryList.getEntries();
      entries.forEach(entry => {
        console.log(`👆 FID: ${Math.round(entry.processingStart - entry.startTime)}ms`);
      });
    }).observe({entryTypes: ['first-input']});

    // CLS (Cumulative Layout Shift)
    let clsValue = 0;
    new PerformanceObserver((entryList) => {
      const entries = entryList.getEntries();
      entries.forEach(entry => {
        if (!(entry as any).hadRecentInput) {
          clsValue += (entry as any).value;
        }
      });
      console.log(`📐 CLS: ${clsValue.toFixed(4)}`);
    }).observe({entryTypes: ['layout-shift']});
  }

  // 메모리 사용량 모니터링
  measureMemoryUsage(): void {
    if (typeof window === 'undefined' || !(performance as any).memory) return;

    const memory = (performance as any).memory;
    const memoryInfo = {
      used: Math.round(memory.usedJSHeapSize / 1024 / 1024),
      total: Math.round(memory.totalJSHeapSize / 1024 / 1024),
      limit: Math.round(memory.jsHeapSizeLimit / 1024 / 1024)
    };

    console.log(`
💾 [MEMORY USAGE]
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📊 사용중: ${memoryInfo.used}MB
📦 할당됨: ${memoryInfo.total}MB  
🚫 한계: ${memoryInfo.limit}MB
📈 사용률: ${Math.round(memoryInfo.used / memoryInfo.limit * 100)}%
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    `);

    // 메모리 사용량 경고
    if (memoryInfo.used / memoryInfo.limit > 0.8) {
      console.warn('⚠️ 메모리 사용량이 80%를 초과했습니다!');
    }
  }
}

// 전역 인스턴스
export const performanceMonitor = new PerformanceMonitor();

// 자동 성능 측정 (브라우저 환경에서만)
if (typeof window !== 'undefined') {
  performanceMonitor.measurePagePerformance();
  
  // 5분마다 리포트 출력
  setInterval(() => {
    performanceMonitor.printReport();
    performanceMonitor.measureMemoryUsage();
  }, 5 * 60 * 1000);
}
