// utils/performance-tracker.ts - 고급 성능 추적
interface WebVitals {
  name: string;
  value: number;
  id: string;
  delta: number;
  entries: PerformanceEntry[];
}

interface PerformanceData {
  url: string;
  timestamp: number;
  metrics: {
    FCP?: number; // First Contentful Paint
    LCP?: number; // Largest Contentful Paint
    FID?: number; // First Input Delay
    CLS?: number; // Cumulative Layout Shift
    TTFB?: number; // Time to First Byte
    TTI?: number; // Time to Interactive
  };
  navigation: {
    DNS: number;
    TCP: number;
    Request: number;
    Response: number;
    DOM: number;
    Load: number;
    Total: number;
  };
  resources: {
    totalSize: number;
    jsSize: number;
    cssSize: number;
    imageSize: number;
    count: number;
  };
  deviceInfo: {
    userAgent: string;
    viewport: string;
    connection?: string;
    memory?: number;
  };
}

class PerformanceTracker {
  private data: PerformanceData[] = [];
  private vitalsCollected = new Set<string>();

  constructor() {
    if (typeof window !== 'undefined') {
      this.initializeTracking();
    }
  }

  private initializeTracking(): void {
    // Page Load 완료 후 메트릭 수집
    if (document.readyState === 'complete') {
      this.collectMetrics();
    } else {
      window.addEventListener('load', () => {
        setTimeout(() => this.collectMetrics(), 100);
      });
    }

    // Web Vitals 수집
    this.observeWebVitals();
    
    // Resource Loading 모니터링
    this.observeResources();
    
    // Long Tasks 모니터링
    this.observeLongTasks();
  }

  private collectMetrics(): void {
    const navigation = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
    if (!navigation) return;

    const performanceData: PerformanceData = {
      url: window.location.href,
      timestamp: Date.now(),
      metrics: {},
      navigation: {
        DNS: navigation.domainLookupEnd - navigation.domainLookupStart,
        TCP: navigation.connectEnd - navigation.connectStart,
        Request: navigation.responseStart - navigation.requestStart,
        Response: navigation.responseEnd - navigation.responseStart,
        DOM: navigation.domContentLoadedEventEnd - navigation.responseEnd,
        Load: navigation.loadEventEnd - navigation.loadEventStart,
        Total: navigation.loadEventEnd - navigation.startTime
      },
      resources: this.analyzeResources(),
      deviceInfo: this.getDeviceInfo()
    };

    this.data.push(performanceData);
    this.reportMetrics(performanceData);
  }

  private observeWebVitals(): void {
    // LCP (Largest Contentful Paint)
    if ('PerformanceObserver' in window) {
      try {
        const lcpObserver = new PerformanceObserver((entryList) => {
          const entries = entryList.getEntries();
          const lastEntry = entries[entries.length - 1];
          this.recordVital('LCP', lastEntry.startTime);
        });
        lcpObserver.observe({ entryTypes: ['largest-contentful-paint'] });
      } catch (e) {
        console.warn('LCP 측정 지원되지 않음');
      }

      // FID (First Input Delay)
      try {
        const fidObserver = new PerformanceObserver((entryList) => {
          const entries = entryList.getEntries();
          entries.forEach((entry: any) => {
            this.recordVital('FID', entry.processingStart - entry.startTime);
          });
        });
        fidObserver.observe({ entryTypes: ['first-input'] });
      } catch (e) {
        console.warn('FID 측정 지원되지 않음');
      }

      // CLS (Cumulative Layout Shift)
      try {
        let clsValue = 0;
        const clsObserver = new PerformanceObserver((entryList) => {
          const entries = entryList.getEntries();
          entries.forEach((entry: any) => {
            if (!entry.hadRecentInput) {
              clsValue += entry.value;
            }
          });
          this.recordVital('CLS', clsValue);
        });
        clsObserver.observe({ entryTypes: ['layout-shift'] });
      } catch (e) {
        console.warn('CLS 측정 지원되지 않음');
      }

      // FCP (First Contentful Paint)
      try {
        const fcpObserver = new PerformanceObserver((entryList) => {
          const entries = entryList.getEntries();
          entries.forEach((entry) => {
            if (entry.name === 'first-contentful-paint') {
              this.recordVital('FCP', entry.startTime);
            }
          });
        });
        fcpObserver.observe({ entryTypes: ['paint'] });
      } catch (e) {
        console.warn('FCP 측정 지원되지 않음');
      }
    }
  }

  private observeResources(): void {
    if ('PerformanceObserver' in window) {
      const resourceObserver = new PerformanceObserver((entryList) => {
        const entries = entryList.getEntries();
        entries.forEach((entry: PerformanceEntry) => {
          this.analyzeResourceTiming(entry as PerformanceResourceTiming);
        });
      });
      resourceObserver.observe({ entryTypes: ['resource'] });
    }
  }

  private observeLongTasks(): void {
    if ('PerformanceObserver' in window) {
      try {
        const longTaskObserver = new PerformanceObserver((entryList) => {
          const entries = entryList.getEntries();
          entries.forEach((entry) => {
            if (entry.duration > 50) {
              console.warn(`🐌 Long Task 감지: ${entry.duration.toFixed(2)}ms`);
              this.reportLongTask(entry);
            }
          });
        });
        longTaskObserver.observe({ entryTypes: ['longtask'] });
      } catch (e) {
        console.warn('Long Task 측정 지원되지 않음');
      }
    }
  }

  private recordVital(name: string, value: number): void {
    if (this.vitalsCollected.has(name)) return;
    
    this.vitalsCollected.add(name);
    
    if (this.data.length > 0) {
      this.data[this.data.length - 1].metrics[name as keyof PerformanceData['metrics']] = value;
    }

    // 임계값 체크
    this.checkThresholds(name, value);
  }

  private checkThresholds(metric: string, value: number): void {
    const thresholds = {
      FCP: { good: 1800, poor: 3000 },
      LCP: { good: 2500, poor: 4000 },
      FID: { good: 100, poor: 300 },
      CLS: { good: 0.1, poor: 0.25 },
      TTFB: { good: 800, poor: 1800 }
    };

    const threshold = thresholds[metric as keyof typeof thresholds];
    if (!threshold) return;

    let status = 'good';
    if (value > threshold.poor) {
      status = 'poor';
    } else if (value > threshold.good) {
      status = 'needs-improvement';
    }

    const emoji = status === 'good' ? '✅' : status === 'needs-improvement' ? '⚠️' : '❌';
    console.log(`${emoji} ${metric}: ${value.toFixed(2)}${metric === 'CLS' ? '' : 'ms'} (${status})`);
  }

  private analyzeResources(): PerformanceData['resources'] {
    const resources = performance.getEntriesByType('resource') as PerformanceResourceTiming[];
    
    let totalSize = 0;
    let jsSize = 0;
    let cssSize = 0;
    let imageSize = 0;

    resources.forEach((resource) => {
      const size = resource.transferSize || resource.encodedBodySize || 0;
      totalSize += size;

      if (resource.name.includes('.js') || resource.name.includes('javascript')) {
        jsSize += size;
      } else if (resource.name.includes('.css') || resource.name.includes('stylesheet')) {
        cssSize += size;
      } else if (resource.name.match(/\.(jpg|jpeg|png|gif|webp|svg|avif)$/i)) {
        imageSize += size;
      }
    });

    return {
      totalSize: Math.round(totalSize / 1024), // KB
      jsSize: Math.round(jsSize / 1024),
      cssSize: Math.round(cssSize / 1024),
      imageSize: Math.round(imageSize / 1024),
      count: resources.length
    };
  }

  private analyzeResourceTiming(resource: PerformanceResourceTiming): void {
    const duration = resource.responseEnd - resource.requestStart;
    const size = resource.transferSize || resource.encodedBodySize || 0;

    // 큰 리소스나 느린 로딩 감지
    if (duration > 2000) {
      console.warn(`🐌 느린 리소스: ${resource.name} (${duration.toFixed(2)}ms)`);
    }

    if (size > 500 * 1024) { // 500KB 이상
      console.warn(`📦 큰 리소스: ${resource.name} (${(size / 1024).toFixed(2)}KB)`);
    }
  }

  private reportLongTask(entry: PerformanceEntry): void {
    // Long Task 발생 시 추가 분석
    const attribution = (entry as any).attribution;
    if (attribution && attribution.length > 0) {
      console.warn('Long Task 원인:', attribution[0]);
    }
  }

  private getDeviceInfo(): PerformanceData['deviceInfo'] {
    const nav = navigator as any;
    
    return {
      userAgent: navigator.userAgent,
      viewport: `${window.innerWidth}x${window.innerHeight}`,
      connection: nav.connection?.effectiveType || 'unknown',
      memory: nav.deviceMemory || undefined
    };
  }

  private reportMetrics(data: PerformanceData): void {
    console.log(`
🚀 [PERFORMANCE REPORT] - ${new Date().toLocaleTimeString()}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📊 Web Vitals:
   FCP: ${data.metrics.FCP?.toFixed(2) || 'N/A'}ms
   LCP: ${data.metrics.LCP?.toFixed(2) || 'N/A'}ms
   FID: ${data.metrics.FID?.toFixed(2) || 'N/A'}ms
   CLS: ${data.metrics.CLS?.toFixed(4) || 'N/A'}

⏱️  Navigation Timing:
   DNS: ${data.navigation.DNS}ms
   TCP: ${data.navigation.TCP}ms
   Request: ${data.navigation.Request}ms
   Response: ${data.navigation.Response}ms
   DOM: ${data.navigation.DOM}ms
   Total: ${data.navigation.Total}ms

📦 Resources:
   Total Size: ${data.resources.totalSize}KB
   JavaScript: ${data.resources.jsSize}KB
   CSS: ${data.resources.cssSize}KB
   Images: ${data.resources.imageSize}KB
   Count: ${data.resources.count}

📱 Device:
   Viewport: ${data.deviceInfo.viewport}
   Connection: ${data.deviceInfo.connection}
   Memory: ${data.deviceInfo.memory || 'N/A'}GB
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    `);

    // 성능 점수 계산
    const score = this.calculatePerformanceScore(data);
    this.displayPerformanceScore(score);
  }

  private calculatePerformanceScore(data: PerformanceData): number {
    let score = 100;
    
    // FCP 점수 (0-25점)
    if (data.metrics.FCP) {
      if (data.metrics.FCP > 3000) score -= 25;
      else if (data.metrics.FCP > 1800) score -= 15;
    }
    
    // LCP 점수 (0-25점)
    if (data.metrics.LCP) {
      if (data.metrics.LCP > 4000) score -= 25;
      else if (data.metrics.LCP > 2500) score -= 15;
    }
    
    // FID 점수 (0-25점)
    if (data.metrics.FID) {
      if (data.metrics.FID > 300) score -= 25;
      else if (data.metrics.FID > 100) score -= 15;
    }
    
    // CLS 점수 (0-25점)
    if (data.metrics.CLS) {
      if (data.metrics.CLS > 0.25) score -= 25;
      else if (data.metrics.CLS > 0.1) score -= 15;
    }

    return Math.max(0, Math.round(score));
  }

  private displayPerformanceScore(score: number): void {
    const emoji = score >= 90 ? '🟢' : score >= 70 ? '🟡' : '🔴';
    const grade = score >= 90 ? 'EXCELLENT' : score >= 70 ? 'GOOD' : 'NEEDS IMPROVEMENT';
    
    console.log(`
${emoji} PERFORMANCE SCORE: ${score}/100 (${grade})
${score >= 90 ? '축하합니다! 훌륭한 성능입니다.' :
  score >= 70 ? '양호한 성능입니다. 약간의 개선이 필요합니다.' :
  '성능 개선이 필요합니다.'}
    `);
  }

  // 공개 메서드
  public getLatestData(): PerformanceData | null {
    return this.data.length > 0 ? this.data[this.data.length - 1] : null;
  }

  public getAllData(): PerformanceData[] {
    return [...this.data];
  }

  public exportData(): string {
    return JSON.stringify(this.data, null, 2);
  }

  public clearData(): void {
    this.data = [];
    this.vitalsCollected.clear();
  }

  // 성능 개선 제안
  public getOptimizationSuggestions(): string[] {
    const latest = this.getLatestData();
    if (!latest) return [];

    const suggestions: string[] = [];

    if (latest.metrics.FCP && latest.metrics.FCP > 1800) {
      suggestions.push('🔧 First Contentful Paint 개선: Critical CSS 인라인화, 폰트 최적화');
    }

    if (latest.metrics.LCP && latest.metrics.LCP > 2500) {
      suggestions.push('🖼️ Largest Contentful Paint 개선: 이미지 최적화, 리소스 우선순위 조정');
    }

    if (latest.metrics.FID && latest.metrics.FID > 100) {
      suggestions.push('⚡ First Input Delay 개선: JavaScript 번들 크기 감소, 코드 스플리팅');
    }

    if (latest.metrics.CLS && latest.metrics.CLS > 0.1) {
      suggestions.push('📐 Cumulative Layout Shift 개선: 이미지 크기 명시, 폰트 로딩 최적화');
    }

    if (latest.resources.totalSize > 2000) {
      suggestions.push('📦 번들 크기 감소: 불필요한 라이브러리 제거, Tree shaking 확인');
    }

    return suggestions;
  }
}

// 전역 인스턴스
export const performanceTracker = new PerformanceTracker();

// 개발 환경에서만 성능 리포트 자동 출력
if (typeof window !== 'undefined' && process.env.NODE_ENV === 'development') {
  window.addEventListener('load', () => {
    setTimeout(() => {
      const suggestions = performanceTracker.getOptimizationSuggestions();
      if (suggestions.length > 0) {
        console.log('💡 성능 개선 제안:');
        suggestions.forEach(suggestion => console.log(`   ${suggestion}`));
      }
    }, 3000);
  });
}

// 글로벌 접근 (개발용)
if (typeof window !== 'undefined') {
  (window as any).performanceTracker = performanceTracker;
}
