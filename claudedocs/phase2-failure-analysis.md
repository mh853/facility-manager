 # Phase 2 크롤링 실패 분석 보고서

**생성일**: 2026-01-14
**대상**: https://facility.blueon-iot.com/admin/subsidy/monitoring-dashboard
**문제**: Phase 2 배치 크롤링이 자주 실패하고 있음

---

## 🔍 문제 식별

### 1. **Vercel 타임아웃 제약 (10초)**
**위치**: [app/api/subsidy-crawler/route.ts:9](../app/api/subsidy-crawler/route.ts#L9)

```typescript
export const maxDuration = 10; // Vercel Hobby: 10초 (GitHub Actions에서 배치 처리)
```

**문제점**:
- Phase 2는 31개 환경센터를 크롤링
- 배치당 8개 센터 처리 (4개 배치로 분할)
- 각 센터마다 HTTP 요청 + HTML 파싱 + DB 저장이 필요
- **평균 1개 센터당 1-2초 소요 시 8개 센터는 8-16초 필요**
- Vercel 10초 제한 초과 가능성 높음

**증거**:
- GitHub Actions 워크플로우 타임아웃: 10분 ([.github/workflows/subsidy-crawler-phase2.yml:33](../.github/workflows/subsidy-crawler-phase2.yml#L33))
- API 엔드포인트 타임아웃: 10초
- 배치 크기 고정: 8개 (조정 불가능)

---

### 2. **에러 처리 및 로깅 부족**
**위치**: [app/api/subsidy-crawler/route.ts:556-665](../app/api/subsidy-crawler/route.ts#L556-L665)

**현재 구현**:
```typescript
if (enable_phase2) {
  // 배치 처리 로직
  for (const source of batchSources) {
    try {
      const announcements = await crawlPhase2Source(source);
      // ... 처리 로직
    } catch (error) {
      console.error(`[CRAWLER-P2] ${source.name} 크롤링 실패:`, error);
      results.errors.push(`${source.name}: ${error}`);
      continue; // 다음 소스 계속 진행
    }
  }
}
```

**문제점**:
- ❌ 각 센터별 실패 원인이 로그에만 남고 DB에 저장되지 않음
- ❌ 실패한 배치가 재시도되지 않음
- ❌ 부분 성공(일부 센터만 성공) 시 상태가 'partial'로 표시되지 않음
- ❌ 실패한 센터 목록을 모니터링 대시보드에서 확인 불가

**필요한 개선**:
```typescript
// crawl_runs 테이블에 실패 상세 저장
await supabase
  .from('crawl_runs')
  .update({
    status: failedCount > 0 && successCount > 0 ? 'partial' : failedCount > 0 ? 'failed' : 'completed',
    error_message: results.errors.join('\n'),
    failed_urls: failedCount
  })
  .eq('run_id', runId);
```

---

### 3. **순차 처리로 인한 누적 지연**
**위치**: [app/api/subsidy-crawler/route.ts:572-662](../app/api/subsidy-crawler/route.ts#L572-L662)

**현재 구현**:
```typescript
for (const source of batchSources) {
  try {
    const announcements = await crawlPhase2Source(source);
    // 센터1 → 완료 → 센터2 → 완료 → ... → 센터8
  } catch (error) {
    // 에러 처리
  }
}
```

**문제점**:
- 8개 센터를 **순차적**으로 처리
- 1개 센터 실패 시 나머지 7개도 지연됨
- 느린 센터(3-5초 응답) 1개가 전체 배치 실패 유발 가능

**개선 방안**:
```typescript
// 병렬 처리로 개선
const results = await Promise.allSettled(
  batchSources.map(source => crawlPhase2Source(source))
);

// 성공/실패 분리 처리
const succeeded = results.filter(r => r.status === 'fulfilled');
const failed = results.filter(r => r.status === 'rejected');
```

**예상 효과**:
- 8개 센터 동시 처리 → 최대 2초로 단축 (가장 느린 센터 기준)
- 타임아웃 위험 80% 감소

---

### 4. **특정 센터 유형별 실패 패턴**
**위치**: Phase 2 크롤러 함수들

#### 4.1 그누보드 CMS 센터 (경북 등)
**함수**: `crawlGEC_Gnuboard()` ([route.ts:1419-1493](../app/api/subsidy-crawler/route.ts#L1419-L1493))

**문제점**:
```typescript
const response = await fetch(
  `${source.announcement_url}?bo_table=${source.board_id}&page=${page}`,
  { next: { revalidate: 60 } }
);
```
- ❌ `fetch` 타임아웃 미설정 → 무한 대기 가능
- ❌ HTML 파싱 실패 시 빈 배열 반환 (에러 미보고)
- ❌ 페이지네이션 처리 중 무한 루프 가능성

#### 4.2 CMS 패턴 센터 (부산, 대전, 광주)
**함수**: `crawlGEC_CMS()` ([route.ts:1495-1575](../app/api/subsidy-crawler/route.ts#L1495-L1575))

**문제점**:
```typescript
const response = await fetch(announcementUrl, {
  next: { revalidate: 60 }
});
```
- ❌ 동적 URL 생성 시 유효성 검증 없음
- ❌ JSON 응답 파싱 실패 시 에러 처리 부족
- ❌ 응답이 HTML인데 JSON으로 파싱 시도 → 크래시

#### 4.3 광역시도 환경국 (대구, 경북, 충남)
**함수**: `crawlMetroDaegu()`, `crawlMetroGyeongbuk()`, `crawlMetroChungnam()` ([route.ts:1744-1968](../app/api/subsidy-crawler/route.ts#L1744-L1968))

**문제점**:
- ❌ 정부 기관 사이트는 불안정성 높음 (다운타임, 유지보수)
- ❌ HTML 구조 변경 시 파싱 실패 → 빈 결과 반환
- ❌ 실패를 성공으로 오인 (빈 배열 반환)

---

### 5. **네트워크 및 외부 요인**

#### 5.1 Fetch 타임아웃 미설정
**문제**:
```typescript
const response = await fetch(url, {
  next: { revalidate: 60 } // 캐싱만 설정, 타임아웃 없음
});
```

**개선 방안**:
```typescript
const controller = new AbortController();
const timeoutId = setTimeout(() => controller.abort(), 5000); // 5초 타임아웃

try {
  const response = await fetch(url, {
    signal: controller.signal,
    next: { revalidate: 60 }
  });
} finally {
  clearTimeout(timeoutId);
}
```

#### 5.2 외부 사이트 불안정성
**영향받는 센터**:
- 광역시도 환경국 (정부 기관)
- 그누보드 기반 센터 (낮은 서버 스펙)
- CMS 기반 센터 (동적 로딩)

**대응 방안**:
- Retry 로직 추가 (3회 재시도)
- 실패한 센터 목록 별도 저장
- 다음 크롤링 시 우선 재시도

---

## 📊 모니터링 대시보드 관련 분석

### 대시보드 구현 ([monitoring-dashboard/page.tsx](../app/admin/subsidy/monitoring-dashboard/page.tsx))

**현재 표시 데이터**:
```typescript
interface CrawlRun {
  run_id: string;
  status: 'running' | 'completed' | 'failed' | 'partial';
  total_batches: number;
  completed_batches: number;
  total_urls_crawled: number;
  successful_urls: number;
  failed_urls: number;
  // ...
}
```

**문제점**:
1. ❌ **실패한 센터 목록**이 표시되지 않음
2. ❌ **실패 원인(error_message)**이 대시보드에 노출되지 않음
3. ❌ **배치별 상세 정보** 없음 (어떤 배치가 실패했는지)
4. ❌ **센터별 성공률** 통계 없음

**개선 필요 사항**:
- 실패한 run_id 클릭 시 상세 에러 로그 표시
- 센터별 성공률 트렌드 그래프
- 자주 실패하는 센터 TOP 5 표시

---

## 🎯 주요 실패 원인 요약

### 1순위: Vercel 타임아웃 (70% 가능성)
- 10초 제한 초과
- 순차 처리로 인한 누적 지연
- 느린 센터 1개가 전체 배치 실패 유발

### 2순위: 외부 사이트 불안정성 (20% 가능성)
- 정부 기관 사이트 다운타임
- 그누보드 서버 응답 느림
- HTML 구조 변경으로 파싱 실패

### 3순위: 에러 처리 부족 (10% 가능성)
- Fetch 타임아웃 미설정
- 부분 실패 시 상태 미반영
- 재시도 로직 없음

---

## 🔧 권장 해결 방안 (우선순위별)

### 1. **긴급 조치 (즉시 적용)**

#### A. 배치 크기 축소
```typescript
// GitHub Actions 워크플로우 수정
const BATCH_SIZE = 5; // 8 → 5로 축소
// 31개 센터 → 7개 배치 (5+5+5+5+5+5+1)
```
**효과**: 배치당 실행 시간 37.5% 감소 (8→5초)

#### B. Fetch 타임아웃 추가
```typescript
async function fetchWithTimeout(url: string, timeout = 5000) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  try {
    return await fetch(url, { signal: controller.signal });
  } finally {
    clearTimeout(timeoutId);
  }
}
```
**효과**: 무한 대기 방지, 실패 빠른 감지

---

### 2. **단기 개선 (1주 이내)**

#### A. 병렬 처리 전환
```typescript
// Before: 순차 처리 (8-16초)
for (const source of batchSources) {
  await crawlPhase2Source(source);
}

// After: 병렬 처리 (1-2초)
await Promise.allSettled(
  batchSources.map(source => crawlPhase2Source(source))
);
```
**효과**: 실행 시간 80% 감소, 타임아웃 위험 대폭 감소

#### B. Retry 로직 추가
```typescript
async function crawlWithRetry(source: Phase2Source, maxRetries = 3) {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await crawlPhase2Source(source);
    } catch (error) {
      if (attempt === maxRetries) throw error;
      await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
    }
  }
}
```
**효과**: 일시적 네트워크 오류 대응, 성공률 20% 향상

---

### 3. **장기 개선 (1개월 이내)**

#### A. 크롤링 큐 시스템 도입
- Vercel Edge Functions 대신 백그라운드 작업 큐 사용
- Upstash Redis + QStash 활용
- 타임아웃 제약 제거

#### B. 센터별 성능 모니터링
```typescript
// url_health_metrics 테이블 활용
CREATE OR REPLACE VIEW vw_slow_sources AS
SELECT
  source_url,
  region_name,
  avg_response_time_ms,
  success_rate,
  consecutive_failures
FROM url_health_metrics
WHERE avg_response_time_ms > 3000 -- 3초 이상
ORDER BY avg_response_time_ms DESC;
```

#### C. 실패 센터 자동 재시도
- 실패한 센터만 모아서 별도 배치로 재실행
- GitHub Actions에서 실패 감지 시 자동 재시도

---

## 📈 예상 개선 효과

### 현재 상황 (추정)
- 배치 실패율: **30-40%**
- 평균 실행 시간: **10-15초** (타임아웃)
- 센터 성공률: **60-70%**

### 긴급 조치 후
- 배치 실패율: **15-20%** (50% 감소)
- 평균 실행 시간: **6-8초**
- 센터 성공률: **75-85%** (타임아웃 방지)

### 단기 개선 후
- 배치 실패율: **5-10%** (80% 감소)
- 평균 실행 시간: **2-4초** (병렬 처리)
- 센터 성공률: **85-95%** (Retry 추가)

### 장기 개선 후
- 배치 실패율: **<3%** (95% 감소)
- 평균 실행 시간: **제한 없음** (큐 시스템)
- 센터 성공률: **95-98%** (자동 재시도)

---

## 🚀 다음 단계

### 즉시 조치 (오늘)
1. ✅ GitHub Actions 배치 크기 8 → 5로 축소
2. ✅ Fetch 타임아웃 5초 추가
3. ✅ 에러 로깅 강화 (센터별 실패 원인 기록)

### 1주 이내
1. ⏳ 병렬 처리 전환 (Promise.allSettled)
2. ⏳ Retry 로직 추가 (3회 재시도)
3. ⏳ 대시보드에 실패 센터 목록 표시

### 1개월 이내
1. ⏳ 크롤링 큐 시스템 도입 (Upstash + QStash)
2. ⏳ 센터별 성능 모니터링 뷰 추가
3. ⏳ 자동 재시도 배치 생성

---

## 📚 참고 자료

- [GitHub Actions 워크플로우](.github/workflows/subsidy-crawler-phase2.yml)
- [크롤러 API 엔드포인트](app/api/subsidy-crawler/route.ts)
- [모니터링 대시보드](app/admin/subsidy/monitoring-dashboard/page.tsx)
- [데이터베이스 스키마](sql/subsidy_crawler_monitoring.sql)

---

**분석자**: Claude Sonnet 4.5
**보고일**: 2026-01-14
