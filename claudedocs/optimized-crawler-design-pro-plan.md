# Phase 2 크롤링 시스템 최적화 설계 (Pro Plan)

**작성일**: 2026-01-14
**대상**: Vercel Pro + Supabase Pro 활용
**목표**: 유료 플랜 기능을 최대한 활용한 안정적이고 효율적인 크롤링 시스템

---

## 🎯 설계 목표

### 현재 문제
- ❌ Vercel 10초 타임아웃 (Hobby 플랜 제약)
- ❌ 배치 실패율 30-40%
- ❌ 순차 처리로 인한 비효율
- ❌ 재시도 로직 없음

### 설계 목표
- ✅ Vercel Pro의 최대 300초 (5분) 타임아웃 활용
- ✅ Supabase Pro의 Edge Functions 활용
- ✅ 배치 실패율 <1%
- ✅ 병렬 처리 + 재시도 로직
- ✅ 실시간 모니터링 및 알림

---

## 💰 사용 가능한 리소스 (Pro Plans)

### Vercel Pro
출처: [Vercel Functions Duration](https://vercel.com/docs/functions/configuring-functions/duration)

**제공 기능**:
- ✅ **maxDuration**: 최대 300초 (기본), 800초 (Fluid Compute)
- ✅ **메모리**: 3GB (기본 1GB의 3배)
- ✅ **동시 실행**: 1000개 함수 (Hobby: 100개)
- ✅ **월 1000GB 대역폭**
- ✅ **실시간 로그 스트리밍**

### Supabase Pro
출처: [Supabase Pricing](https://supabase.com/pricing)

**제공 기능**:
- ✅ **Database**: 8GB 저장소 (60TB까지 확장 가능)
- ✅ **Edge Functions**: 200만 호출/월
- ✅ **CPU Time**: 요청당 2초
- ✅ **Idle Timeout**: 150초
- ✅ **실시간 알림** (Database Webhooks)

---

## 🏗️ 최적화 설계 아키텍처

### Option 1: Vercel Function 타임아웃 확장 (가장 간단)

#### 개요
**현재 10초 → 300초로 확장**하여 모든 센터를 한 번에 처리

#### 구현 변경사항

```typescript
// app/api/subsidy-crawler/route.ts
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 300; // ✅ 10 → 300초로 변경

// Vercel Pro에서 자동 적용됨 (설정 변경만)
```

#### 장점
- ✅ **코드 수정 최소**: 1줄만 변경
- ✅ **즉시 적용**: 배포 후 바로 효과
- ✅ **안정성**: 31개 센터 처리 충분한 시간 (평균 20초 × 15배 여유)
- ✅ **배치 분할 불필요**: 한 번에 모든 센터 처리 가능

#### 단점
- ⚠️ 병렬 처리 미적용 (순차 처리 유지)
- ⚠️ 실패 시 전체 재실행 필요

#### 예상 효과
- 실패율: **30-40% → 1-2%** (타임아웃 완전 해결)
- 실행 시간: **20초 유지** (변화 없음, but 안정적)
- 구현 시간: **5분** (배포 포함)

---

### Option 2: 병렬 처리 + 타임아웃 확장 (권장)

#### 개요
**300초 타임아웃 + 병렬 처리**로 속도와 안정성 동시 확보

#### 구현 변경사항

```typescript
// app/api/subsidy-crawler/route.ts
export const maxDuration = 300; // ✅ 300초 타임아웃

export async function POST(request: NextRequest) {
  const startTime = Date.now();

  // ... 인증, crawl_runs 생성 ...

  if (enable_phase2) {
    const batchSources = PHASE2_SOURCES.slice(startIdx, endIdx);

    // ✅ 병렬 처리로 전환
    const crawlPromises = batchSources.map(source =>
      crawlWithRetry(source, 3) // 3회 재시도
    );

    // Promise.allSettled로 부분 실패 허용
    const results = await Promise.allSettled(crawlPromises);

    // 성공/실패 분리 처리
    const succeeded = results.filter(r => r.status === 'fulfilled');
    const failed = results.filter(r => r.status === 'rejected');

    console.log(`[CRAWLER-P2] 성공: ${succeeded.length}, 실패: ${failed.length}`);

    // 성공한 센터들의 공고 처리
    for (const result of succeeded) {
      if (result.status === 'fulfilled') {
        const announcements = result.value;
        // DB 저장 로직
      }
    }

    // 실패한 센터들 기록
    for (const result of failed) {
      if (result.status === 'rejected') {
        results.errors.push(result.reason);
      }
    }
  }

  // DB 업데이트 (성공/실패 모두 기록)
  await supabase
    .from('crawl_runs')
    .update({
      completed_at: new Date().toISOString(),
      status: failed.length > 0 ? 'partial' : 'completed',
      successful_urls: succeeded.length,
      failed_urls: failed.length,
      ...
    })
    .eq('run_id', runId);

  return NextResponse.json({
    success: true,
    total_processed: succeeded.length + failed.length,
    successful: succeeded.length,
    failed: failed.length,
    duration_ms: Date.now() - startTime
  });
}

// ✅ 재시도 로직
async function crawlWithRetry(
  source: Phase2Source,
  maxRetries = 3
): Promise<CrawledAnnouncement[]> {
  let lastError: any;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      console.log(`[CRAWLER-P2] ${source.name} 시도 ${attempt}/${maxRetries}`);

      const announcements = await crawlPhase2Source(source);

      console.log(`[CRAWLER-P2] ${source.name} 성공: ${announcements.length}개`);
      return announcements;

    } catch (error: any) {
      lastError = error;
      console.error(`[CRAWLER-P2] ${source.name} 실패 (${attempt}/${maxRetries}):`, error.message);

      if (attempt < maxRetries) {
        // 지수 백오프 (1초, 2초, 4초)
        const delay = 1000 * Math.pow(2, attempt - 1);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }

  throw new Error(`${source.name} failed after ${maxRetries} attempts: ${lastError.message}`);
}
```

#### 장점
- ✅ **극적인 속도 향상**: 20초 → 2-4초 (80% 단축)
- ✅ **재시도 자동화**: 일시적 오류 자동 복구
- ✅ **부분 성공 허용**: 일부 센터 실패해도 나머지 성공
- ✅ **안정성**: 300초 타임아웃으로 여유 확보

#### 단점
- ⚠️ 코드 수정 필요 (2-3시간)
- ⚠️ 동시 요청 증가 (외부 사이트 부하 고려)

#### 예상 효과
- 실패율: **30-40% → <1%** (재시도 + 타임아웃)
- 실행 시간: **20초 → 2-4초** (85% 단축)
- 구현 시간: **2-3시간**

---

### Option 3: Supabase Edge Functions 활용 (고급)

#### 개요
**Vercel + Supabase Edge Functions** 하이브리드 아키텍처

#### 아키텍처

```
GitHub Actions (스케줄러)
    ↓
Vercel API (조정자, 300초)
    ↓
Supabase Edge Functions (크롤러, 150초 × 31개)
    ↓
Supabase Database (저장소)
```

#### 흐름

```typescript
// Vercel API: 조정자 역할
export const maxDuration = 300;

export async function POST(request: NextRequest) {
  // 1. crawl_runs 생성
  const runId = `run_phase2_${timestamp}`;
  await supabase.from('crawl_runs').insert({ run_id: runId, ... });

  // 2. 각 센터를 Supabase Edge Function에 위임
  const invocations = PHASE2_SOURCES.map(source =>
    supabase.functions.invoke('crawl-single-source', {
      body: { source, runId }
    })
  );

  // 3. 병렬 실행 (31개 동시)
  const results = await Promise.allSettled(invocations);

  // 4. 결과 집계 및 DB 업데이트
  const succeeded = results.filter(r => r.status === 'fulfilled').length;
  const failed = results.filter(r => r.status === 'rejected').length;

  await supabase
    .from('crawl_runs')
    .update({
      status: 'completed',
      successful_urls: succeeded,
      failed_urls: failed
    })
    .eq('run_id', runId);

  return NextResponse.json({ success: true, succeeded, failed });
}
```

```typescript
// Supabase Edge Function: supabase/functions/crawl-single-source/index.ts
Deno.serve(async (req) => {
  const { source, runId } = await req.json();

  try {
    // 개별 센터 크롤링 (최대 150초)
    const announcements = await crawlPhase2Source(source);

    // Supabase에 직접 저장
    await supabaseClient
      .from('subsidy_announcements')
      .insert(announcements);

    return new Response(
      JSON.stringify({
        success: true,
        source: source.name,
        count: announcements.length
      }),
      { headers: { "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error(`Edge Function failed for ${source.name}:`, error);

    return new Response(
      JSON.stringify({
        success: false,
        source: source.name,
        error: error.message
      }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
});
```

#### 장점
- ✅ **최고 성능**: 31개 센터 완전 병렬 처리
- ✅ **타임아웃 독립**: 각 센터 150초씩 독립 실행
- ✅ **확장성**: 센터 추가 시 자동 확장
- ✅ **비용 효율**: Edge Functions 무료 200만 호출 (31개 × 31일 = 961 호출/월)

#### 단점
- ⚠️ **복잡도 높음**: Edge Functions 별도 배포 필요
- ⚠️ **디버깅 어려움**: 분산 환경 로그 추적
- ⚠️ **개발 시간**: 1-2일 소요

#### 예상 효과
- 실패율: **30-40% → <0.5%** (완전 독립 실행)
- 실행 시간: **20초 → 1-2초** (완전 병렬)
- 구현 시간: **1-2일**

---

## 📊 옵션 비교표

| 항목 | Option 1: 타임아웃만 | Option 2: 병렬+타임아웃 | Option 3: Edge Functions |
|------|---------------------|------------------------|--------------------------|
| **구현 시간** | 5분 | 2-3시간 | 1-2일 |
| **실행 시간** | 20초 | 2-4초 | 1-2초 |
| **실패율** | 1-2% | <1% | <0.5% |
| **복잡도** | 매우 낮음 | 낮음 | 높음 |
| **유지보수** | 쉬움 | 쉬움 | 어려움 |
| **확장성** | 낮음 | 중간 | 높음 |
| **코드 수정** | 1줄 | 100줄 | 300줄+ |
| **비용** | $0 추가 | $0 추가 | $0 추가 |
| **추천도** | ⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐ |

---

## 🎯 권장 사항

### 🥇 **1순위 추천: Option 2 (병렬 + 타임아웃)**

**이유**:
1. ✅ **효과 최대**: 실패율 <1%, 실행 시간 85% 단축
2. ✅ **구현 간단**: 2-3시간으로 당일 완료 가능
3. ✅ **비용 $0**: 추가 비용 없음
4. ✅ **유지보수 쉬움**: 기존 아키텍처 유지
5. ✅ **검증 용이**: Vercel Runtime Logs에서 바로 확인

**구현 단계**:
```
1단계 (5분): maxDuration 300초로 변경 → 배포
2단계 (1시간): 병렬 처리 코드 작성
3단계 (1시간): 재시도 로직 추가
4단계 (30분): 테스트 및 검증
```

---

### 🥈 **2순위: Option 1 (타임아웃만) - 긴급 패치용**

**이유**:
- ✅ **즉시 효과**: 5분 내 배포 가능
- ✅ **안정성**: 타임아웃 완전 해결
- ⚠️ **속도 개선 없음**: 20초 유지

**추천 시나리오**:
- 오늘 당장 실패를 막아야 하는 경우
- Option 2 구현 전 임시 조치

**구현 후 로드맵**:
```
오늘: Option 1 배포 (긴급 패치)
내일: Option 2 구현 (최종 해결)
```

---

### 🥉 **3순위: Option 3 (Edge Functions) - 미래 확장용**

**이유**:
- ✅ **최고 성능**: 1-2초 실행
- ⚠️ **복잡도 높음**: 1-2일 소요
- ⚠️ **당장 불필요**: Option 2로 충분

**추천 시나리오**:
- 센터가 100개 이상으로 증가할 경우
- 실시간 크롤링 (1분마다) 필요한 경우
- 장기 로드맵으로 고려

---

## 🚀 즉시 실행 가능한 액션 플랜

### 🎯 **Plan A: 완벽한 해결 (권장)**

**Today (2-3시간)**:
```typescript
// Step 1: maxDuration 변경 (5분)
export const maxDuration = 300;

// Step 2: 병렬 처리 추가 (1시간)
const results = await Promise.allSettled(
  batchSources.map(source => crawlWithRetry(source, 3))
);

// Step 3: 재시도 로직 (1시간)
async function crawlWithRetry(source, maxRetries = 3) {
  // 지수 백오프 재시도
}

// Step 4: 테스트 (30분)
// - GitHub Actions 수동 실행
// - Vercel Runtime Logs 확인
// - 모니터링 대시보드 확인
```

**예상 결과**:
- ✅ 배치 실패율: 30-40% → <1%
- ✅ 실행 시간: 20초 → 2-4초
- ✅ 안정성: 300초 타임아웃으로 완전 해결

---

### 🎯 **Plan B: 긴급 패치 (5분)**

**Today (5분)**:
```typescript
// app/api/subsidy-crawler/route.ts
// 단 1줄만 변경
export const maxDuration = 300; // 10 → 300
```

**배포**:
```bash
git add app/api/subsidy-crawler/route.ts
git commit -m "fix: increase maxDuration to 300s for Phase 2 crawler"
git push origin main
```

**예상 결과**:
- ✅ 배치 실패율: 30-40% → 1-2%
- ⏸️ 실행 시간: 20초 유지
- ✅ 안정성: 타임아웃 완전 해결

**Tomorrow**: Plan A 구현 (병렬 처리 추가)

---

## 📋 구현 체크리스트

### Option 2 구현 (권장)

#### Phase 1: 타임아웃 확장 (5분)
- [ ] `maxDuration = 300` 설정
- [ ] 코드 커밋 및 푸시
- [ ] Vercel 자동 배포 확인
- [ ] Runtime Logs에서 300초 적용 확인

#### Phase 2: 병렬 처리 (1시간)
- [ ] `Promise.allSettled` 코드 작성
- [ ] 성공/실패 분리 로직 추가
- [ ] 에러 핸들링 강화
- [ ] 로컬 테스트 (API 호출)

#### Phase 3: 재시도 로직 (1시간)
- [ ] `crawlWithRetry` 함수 작성
- [ ] 지수 백오프 구현
- [ ] 재시도 로그 추가
- [ ] 최대 재시도 3회 설정

#### Phase 4: 테스트 및 검증 (30분)
- [ ] GitHub Actions 수동 실행
- [ ] Vercel Runtime Logs 확인
  - [ ] Duration < 10초 확인
  - [ ] 에러 없음 확인
  - [ ] 병렬 처리 로그 확인
- [ ] 모니터링 대시보드 확인
  - [ ] 배치 1/1 완료
  - [ ] URL 31개 처리
  - [ ] 성공률 95%+ 확인

---

## 💰 비용 영향 분석

### Vercel Pro ($20/월)
```
maxDuration 증가 (10 → 300초):
- 함수 실행 시간: 20초 (변화 없음, 병렬 처리 시 2-4초)
- 월 실행 횟수: 31회 (매일 1회)
- 총 실행 시간: 620초/월 (병렬) 또는 620초/월 (순차)
- 대역폭: 무시 가능 (<1MB)

추가 비용: $0 (기본 플랜 포함)
```

### Supabase Pro ($25/월)
```
Edge Functions 미사용 시:
- Database 쓰기: 31 센터 × 평균 5공고 = 155건/일 = 4,805건/월
- 트래픽: <100MB/월
- 저장소: <1GB

추가 비용: $0 (기본 플랜 포함)

Edge Functions 사용 시 (Option 3):
- 호출 횟수: 31 함수 × 31일 = 961건/월
- 무료 한도: 200만 건/월

추가 비용: $0 (무료 한도 충분)
```

**총 추가 비용**: **$0/월** ✅

---

## 📊 성능 예측

### Before (현재)
```
실행 시간: 20초 (타임아웃으로 실패)
성공률: 60-70%
배치 실패율: 30-40%
GitHub Actions: ✅ 성공
Vercel Runtime: ❌ 타임아웃
Supabase: ❌ 데이터 없음
```

### After Option 1 (타임아웃만)
```
실행 시간: 20초
성공률: 98-99%
배치 실패율: 1-2%
GitHub Actions: ✅ 성공
Vercel Runtime: ✅ 성공
Supabase: ✅ 데이터 기록
```

### After Option 2 (병렬+타임아웃)
```
실행 시간: 2-4초 (85% 단축)
성공률: 98-99%
배치 실패율: <1%
GitHub Actions: ✅ 성공
Vercel Runtime: ✅ 성공 (2-4초)
Supabase: ✅ 데이터 기록
```

### After Option 3 (Edge Functions)
```
실행 시간: 1-2초 (90% 단축)
성공률: 99%+
배치 실패율: <0.5%
GitHub Actions: ✅ 성공
Vercel Runtime: ✅ 성공 (조정만)
Supabase Edge: ✅ 31개 병렬 실행
Supabase DB: ✅ 데이터 기록
```

---

## 🎓 Sources

- [Vercel Functions Duration Configuration](https://vercel.com/docs/functions/configuring-functions/duration)
- [Vercel Functions Limitations](https://vercel.com/docs/functions/limitations)
- [Supabase Pricing](https://supabase.com/pricing)
- [Supabase Edge Functions Pricing](https://supabase.com/docs/guides/functions/pricing)
- [Supabase Edge Functions Limits](https://supabase.com/docs/guides/functions/limits)

---

**작성자**: Claude Sonnet 4.5
**작성일**: 2026-01-14
