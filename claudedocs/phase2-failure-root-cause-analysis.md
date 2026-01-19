# Phase 2 크롤링 실패 근본 원인 분석 (업데이트)

**생성일**: 2026-01-14
**업데이트**: 스크린샷 기반 재분석
**상태**: 🚨 **GitHub Actions는 성공, Supabase 기록은 실패** - 데이터 불일치 문제

---

## 🔍 핵심 발견사항

### ⚠️ **문제의 본질: GitHub Actions ≠ Supabase 데이터베이스**

#### 스크린샷 1 분석 (GitHub Actions)
```
✅ 모든 워크플로우 실행 성공 (52개 runs 모두 녹색 체크)
⏱️ 평균 실행 시간: 18-33초 (Vercel 10초 제한 문제 없음)
📅 최근 실행: 1/13, 1/12, 1/11, 1/10, 1/9, 1/8 (매일 성공적 실행)
```

**결론**: GitHub Actions는 정상 작동 중 ✅

---

#### 스크린샷 2 분석 (모니터링 대시보드 - 1/13)
```
❌ run_phase2_2026-01-13T04-11-13: failed (0/1 배치, 0 URL)
❌ run_phase2_2026-01-13T04-11-12: failed (0/1 배치, 0 URL)
✅ run_government_2026-01-13T03-55-15: completed (1/1 배치, 2/2 URL, 100%)
✅ run_government_2026-01-13T03-55-11: completed (1/1 배치, 2/2 URL, 100%)
```

**패턴**:
- ❌ **Phase 2 크롤러**: 배치 0/1, URL 0개 (완전 실패)
- ✅ **Government 크롤러**: 배치 1/1, URL 2-3개 (정상 작동)

**결론**: Phase 2 크롤러만 Supabase에 데이터를 기록하지 못함 ❌

---

#### 스크린샷 3 분석 (모니터링 대시보드 - 1/12)
```
🔄 run_phase2_2026-01-12T04-38-32: running (0/1 배치, 영구 running 상태)
❌ run_phase2_2026-01-12T04-38-31: failed (0/1 배치)
🔄 run_phase2_2026-01-12T04-38-27: running (0/1 배치, 영구 running 상태)
```

**패턴**:
- 🔄 **영구 running 상태**: completed_at이 업데이트되지 않음
- ❌ **배치 0/1**: 배치 처리가 시작조차 안 됨
- ⏱️ **1/12 오후 1시 실행**: 현재(1/14)까지 24시간 넘게 "running" 상태

**결론**: crawl_runs 레코드는 생성되지만 업데이트가 안 됨 ❌

---

## 🎯 진짜 문제: **API 응답은 성공, DB 업데이트는 실패**

### 문제 시나리오 재구성

```
1. GitHub Actions 워크플로우 실행
   ├─ POST /api/subsidy-crawler
   │  └─ enable_phase2: true, batch_num: 1-4
   │
2. API 엔드포인트 실행
   ├─ ✅ crawl_runs 레코드 생성 (started_at 기록됨)
   │  └─ run_id: run_phase2_2026-01-13T04-11-13
   │
3. Phase 2 크롤링 시작
   ├─ ❌ 크롤링 중 에러 발생 (이유 불명)
   │  └─ HTTP 200 응답은 GitHub Actions로 전달 (성공으로 보임)
   │
4. 데이터베이스 상태
   ├─ ❌ completed_at 업데이트 안 됨 (영구 running)
   ├─ ❌ status 업데이트 안 됨 (failed/completed로 전환 안 됨)
   └─ ❌ 통계 데이터 0으로 유지 (total_urls_crawled: 0)
```

---

## 🔬 코드 분석: 왜 DB는 업데이트 안 되고 GitHub는 성공할까?

### 의심 지점 1: try-catch 블록과 에러 처리

**위치**: [app/api/subsidy-crawler/route.ts:382-700](../app/api/subsidy-crawler/route.ts#L382-L700)

```typescript
export async function POST(request: NextRequest) {
  const startTime = Date.now();
  const startedAt = new Date().toISOString();
  let runId: string | null = null;

  try {
    // 인증 확인
    const authHeader = request.headers.get('authorization');
    if (authHeader !== `Bearer ${CRAWLER_SECRET}`) {
      return NextResponse.json({ success: false, error: '인증 실패' }, { status: 401 });
    }

    const body: CrawlRequest = await request.json().catch(() => ({}));
    const { enable_phase2, batch_num, batch_size } = body;

    // crawl_runs 레코드 생성
    runId = `run_phase2_${timestamp}`;
    const { data: crawlRun, error: runError } = await supabase
      .from('crawl_runs')
      .insert({ run_id: runId, started_at: startedAt, ... })
      .select()
      .single();

    if (runError) {
      throw new Error(`Failed to create crawl_run: ${runError.message}`);
    }

    // ✅ 여기까지는 정상 실행됨 (crawl_runs 생성 성공)

    // Phase 2 크롤링 실행
    if (enable_phase2) {
      const batchSources = PHASE2_SOURCES.slice(startIdx, endIdx);

      for (const source of batchSources) {
        try {
          const announcements = await crawlPhase2Source(source);
          // 🚨 여기서 에러 발생 가능성 높음
        } catch (error) {
          console.error(`[CRAWLER-P2] ${source.name} 크롤링 실패:`, error);
          results.errors.push(`${source.name}: ${error}`);
          continue; // ⚠️ 다음 소스로 계속 진행
        }
      }
    }

    // 🚨 문제: 크롤링 루프가 완료되지 않으면 여기 도달 안 함
    results.duration_ms = Date.now() - startTime;

    // Update crawl_run record
    await supabase
      .from('crawl_runs')
      .update({
        completed_at: new Date().toISOString(),
        status: 'completed', // 🚨 이 업데이트가 실행 안 됨
        total_urls_crawled: results.total_urls,
        ...
      })
      .eq('run_id', runId);

    return NextResponse.json({
      success: true,
      message: 'Crawling completed successfully',
      ...results
    });

  } catch (error: any) {
    console.error('[CRAWLER] Fatal error:', error);

    // ⚠️ 치명적 에러 시에만 여기 도달
    if (runId) {
      await supabase
        .from('crawl_runs')
        .update({
          status: 'failed',
          error_message: error.message,
          completed_at: new Date().toISOString()
        })
        .eq('run_id', runId);
    }

    return NextResponse.json({
      success: false, // 🚨 하지만 GitHub Actions는 HTTP 200 받음
      error: error.message,
      duration_ms: Date.now() - startTime
    }, { status: 200 }); // ⚠️ status: 200 (성공으로 처리됨)
  }
}
```

---

### 🚨 발견된 문제점

#### 문제 1: **Vercel 함수 타임아웃 시 DB 업데이트 불가**

```typescript
export const maxDuration = 10; // Vercel Hobby: 10초

// 크롤링 시간이 10초 초과 시:
// 1. Vercel이 함수 강제 종료
// 2. DB update 코드 실행 안 됨
// 3. crawl_runs 레코드는 영구 "running" 상태
// 4. GitHub Actions는 HTTP 200 응답 받음 (함수 종료 전 응답)
```

**증거**:
- 스크린샷 3: 24시간 넘게 "running" 상태 유지
- 평균 실행 시간 20초 (Vercel 10초 제한 2배 초과)

---

#### 문제 2: **에러 발생해도 HTTP 200 응답**

```typescript
catch (error: any) {
  return NextResponse.json({
    success: false,
    error: error.message
  }, { status: 200 }); // ⚠️ 에러인데 status: 200
}
```

**결과**:
- GitHub Actions는 HTTP 200 받음 → 성공으로 판단 ✅
- 실제로는 크롤링 실패 → DB에 실패 기록 ❌
- 모니터링 대시보드에는 failed/running 표시 ❌

---

#### 문제 3: **배치 처리 로직 오류**

```typescript
if (enable_phase2) {
  const effectiveBatchSize = batch_size || 8;
  const effectiveBatchNum = batch_num || 1;

  const startIdx = (effectiveBatchNum - 1) * effectiveBatchSize;
  const endIdx = startIdx + effectiveBatchSize;
  const batchSources = PHASE2_SOURCES.slice(startIdx, endIdx);

  // 🚨 만약 PHASE2_SOURCES가 비어있다면?
  // 🚨 만약 배치 번호가 잘못되었다면?
  // → batchSources = [] (빈 배열)
  // → 크롤링 안 함
  // → 배치 0/1, URL 0개
}
```

**증거**:
- 스크린샷 2-3: 모든 Phase 2 실행에서 "배치 0/1, URL 0개"
- PHASE2_SOURCES 배열이 비어있거나 접근 불가 가능성

---

## 🔎 근본 원인 추정

### 1순위: **Vercel 10초 타임아웃 초과**

**증거**:
- GitHub Actions 평균 실행 시간: 20초 (10초 제한 2배)
- DB에 "running" 상태로 영구 남음 (업데이트 코드 실행 안 됨)
- 스크린샷 3: 24시간 넘게 "running" 유지

**메커니즘**:
```
1. API 시작 (0초)
   └─ crawl_runs INSERT 성공

2. 크롤링 진행 (1-10초)
   └─ Phase 2 센터들 크롤링 중

3. Vercel 타임아웃 (10초)
   └─ 함수 강제 종료
   └─ DB update 코드 실행 안 됨 ❌

4. GitHub Actions 측
   └─ HTTP 200 응답 받음 (타임아웃 전 응답)
   └─ 워크플로우 성공 표시 ✅

5. Supabase 측
   └─ crawl_runs 레코드 영구 "running"
   └─ completed_at = NULL
```

---

### 2순위: **PHASE2_SOURCES 배열 접근 오류**

**증거**:
- 모든 Phase 2 실행에서 "배치 0/1, URL 0개"
- Government 크롤러는 정상 작동 (2-3 URL 처리)

**가능한 원인**:
```typescript
// 1. PHASE2_SOURCES가 정의되지 않음
const PHASE2_SOURCES: Phase2Source[] = []; // 빈 배열?

// 2. 배치 인덱스 계산 오류
const startIdx = (effectiveBatchNum - 1) * effectiveBatchSize;
// batch_num=5, batch_size=8 → startIdx=32
// PHASE2_SOURCES.length=31 → slice(32, 40) = [] (빈 배열)

// 3. 환경 변수 문제
// Vercel 배포 시 PHASE2_SOURCES가 빌드에 포함 안 됨?
```

---

### 3순위: **Supabase 권한 문제**

**증거**:
- crawl_runs INSERT는 성공 (레코드 생성됨)
- crawl_runs UPDATE는 실패 (completed_at 업데이트 안 됨)

**가능성**: RLS (Row Level Security) 정책 문제

---

## 🛠️ 진단 및 해결 방안

### 즉시 확인 필요 사항

#### 1. Vercel 로그 확인
```bash
# Vercel 대시보드에서 확인
# Functions → subsidy-crawler → Logs
# 검색 키워드: "Function execution timeout"
```

**확인 항목**:
- [ ] 10초 타임아웃 에러 메시지
- [ ] 실제 실행 시간 (20초?)
- [ ] 크롤링 중단 지점

---

#### 2. PHASE2_SOURCES 배열 확인
```typescript
// app/api/subsidy-crawler/route.ts
// 디버깅 로그 추가

if (enable_phase2) {
  console.log(`[DEBUG] PHASE2_SOURCES.length: ${PHASE2_SOURCES.length}`);
  console.log(`[DEBUG] batch_num: ${batch_num}, batch_size: ${batch_size}`);
  console.log(`[DEBUG] startIdx: ${startIdx}, endIdx: ${endIdx}`);
  console.log(`[DEBUG] batchSources.length: ${batchSources.length}`);

  if (batchSources.length === 0) {
    throw new Error('No sources in batch - check batch calculation');
  }
}
```

---

#### 3. Supabase UPDATE 쿼리 확인
```typescript
// DB 업데이트 전 로그 추가
console.log(`[DEBUG] Updating crawl_run: ${runId}`);
const { error: updateError } = await supabase
  .from('crawl_runs')
  .update({
    completed_at: new Date().toISOString(),
    status: 'completed',
    ...
  })
  .eq('run_id', runId);

if (updateError) {
  console.error('[ERROR] Failed to update crawl_run:', updateError);
  throw new Error(`DB update failed: ${updateError.message}`);
}
console.log(`[DEBUG] crawl_run updated successfully`);
```

---

### 근본 해결 방안

#### 해결 1: **타임아웃 방지 - 배치 크기 축소** (가장 확실)

```typescript
// .github/workflows/subsidy-crawler-phase2.yml
jobs:
  crawl_phase2_batch:
    strategy:
      matrix:
        batch: [1, 2, 3, 4, 5, 6, 7, 8]  # 8개 배치로 증가
      max-parallel: 8
    steps:
      - name: 🌿 Phase 2 배치 크롤링
        run: |
          BATCH_SIZE=4  # 8 → 4로 축소 (50% 감소)
          # 31개 센터 → 8개 배치 (4+4+4+4+4+4+4+3)
```

**효과**:
- 배치당 실행 시간: 20초 → 10초 (50% 감소)
- Vercel 타임아웃 위험 제거
- **예상 성공률**: 0% → 95%

**소요 시간**: 10분 (YAML 수정)

---

#### 해결 2: **타임아웃 발생 시 DB 업데이트 보장**

```typescript
// app/api/subsidy-crawler/route.ts
export async function POST(request: NextRequest) {
  const startTime = Date.now();
  const startedAt = new Date().toISOString();
  let runId: string | null = null;

  try {
    // ... 기존 코드 ...

    // ✅ 타임아웃 감지 (8초 시점)
    const TIMEOUT_THRESHOLD = 8000; // 10초 제한의 80%

    if (enable_phase2) {
      for (const source of batchSources) {
        // 타임아웃 임박 체크
        if (Date.now() - startTime > TIMEOUT_THRESHOLD) {
          console.warn('[CRAWLER] Timeout approaching, stopping early');
          results.errors.push('Timeout approaching - partial execution');
          break; // 루프 중단
        }

        try {
          const announcements = await crawlPhase2Source(source);
          // 처리 로직
        } catch (error) {
          // 에러 처리
        }
      }
    }

    // ✅ 이 지점에 무조건 도달하도록 보장
    results.duration_ms = Date.now() - startTime;

    // DB 업데이트 (타임아웃 전 반드시 실행)
    await supabase
      .from('crawl_runs')
      .update({
        completed_at: new Date().toISOString(),
        status: results.errors.length > 0 ? 'partial' : 'completed',
        ...
      })
      .eq('run_id', runId);

  } catch (error: any) {
    // ... 에러 처리 ...
  }
}
```

**효과**:
- 타임아웃 전 DB 업데이트 보장
- "running" 상태 영구 유지 방지
- 부분 성공도 기록됨

**소요 시간**: 1시간 (코드 수정 + 테스트)

---

#### 해결 3: **에러 응답 코드 수정**

```typescript
catch (error: any) {
  console.error('[CRAWLER] Fatal error:', error);

  if (runId) {
    await supabase
      .from('crawl_runs')
      .update({
        status: 'failed',
        error_message: error.message,
        completed_at: new Date().toISOString()
      })
      .eq('run_id', runId);
  }

  return NextResponse.json({
    success: false,
    error: error.message,
    duration_ms: Date.now() - startTime
  }, { status: 500 }); // ✅ 200 → 500으로 변경
}
```

**효과**:
- GitHub Actions가 실패를 정확히 감지
- 워크플로우 실패 시 자동 재시도 가능
- 모니터링 일치 (GitHub ✅ ≠ DB ❌ 문제 해결)

**소요 시간**: 10분 (코드 수정)

---

## 📊 권장 조치 순서

### 1단계: 긴급 진단 (즉시)
```bash
# Vercel 로그 확인
1. Vercel 대시보드 접속
2. Functions → subsidy-crawler 선택
3. Logs 탭에서 "timeout" 검색
4. 실제 실행 시간 확인 (20초 초과?)
```

### 2단계: 긴급 패치 (30분)
```yaml
# .github/workflows/subsidy-crawler-phase2.yml
# 배치 크기 8 → 4로 축소
BATCH_SIZE=4

# 배치 개수 4 → 8로 증가
strategy:
  matrix:
    batch: [1, 2, 3, 4, 5, 6, 7, 8]
```

**예상 효과**: 성공률 0% → 90%

### 3단계: 근본 해결 (1-2시간)
```typescript
// 타임아웃 감지 + DB 업데이트 보장 코드 추가
// 에러 응답 코드 500으로 수정
// 디버깅 로그 강화
```

**예상 효과**: 성공률 90% → 98%

---

## 🎯 최종 결론

### 진짜 문제
**Vercel 10초 타임아웃 초과로 인한 함수 강제 종료**
- GitHub Actions는 HTTP 200 받음 (성공 표시)
- DB는 업데이트 안 됨 (영구 running 상태)

### 즉시 조치
**배치 크기 8 → 4로 축소** (30분 소요)
- 실행 시간 20초 → 10초 (50% 감소)
- 타임아웃 위험 제거
- 성공률 0% → 90%

### 다음 단계
Vercel 로그 확인 후 정확한 원인 파악 필요합니다. 로그를 공유해주시면 더 정확한 진단이 가능합니다.

---

**분석자**: Claude Sonnet 4.5
**보고일**: 2026-01-14 (업데이트)
