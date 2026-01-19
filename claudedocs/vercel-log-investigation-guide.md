# Vercel 로그 조사 가이드

**목적**: Phase 2 크롤링 실패의 정확한 원인 파악
**대상**: https://facility.blueon-iot.com/api/subsidy-crawler
**조사 기간**: 2026-01-12 ~ 2026-01-14

---

## 🎯 조사 목표

다음 가설들을 Vercel 로그로 검증:

1. ⏱️ **Vercel 10초 타임아웃 발생 여부**
2. 🚨 **크롤링 중 에러 발생 패턴**
3. 📦 **배치 처리 로직 오류 여부**
4. 🗄️ **Supabase 연결/권한 문제**

---

## 📋 Step 1: Vercel 대시보드 접속

### 1.1 로그인
```
URL: https://vercel.com
→ 프로젝트 선택: facility-manager (또는 해당 프로젝트명)
```

### 1.2 Functions 탭 이동
```
Dashboard → 프로젝트 → Functions 탭
또는
프로젝트 → Deployments → 최신 배포 → Functions
```

### 1.3 subsidy-crawler 함수 선택
```
Functions 목록에서:
→ /api/subsidy-crawler (POST)
→ 또는 검색창에 "subsidy-crawler" 입력
```

---

## 🔍 Step 2: 로그 검색 및 분석

### 2.1 타임아웃 에러 검색

**검색 키워드**:
```
"timeout"
"FUNCTION_INVOCATION_TIMEOUT"
"execution time"
"maxDuration"
```

**기대 결과**:
```
✅ 타임아웃 발생 시:
[ERROR] Function execution timeout (10000ms)
[WARN] Function exceeded maxDuration: 10s

❌ 타임아웃 없음 시:
(관련 로그 없음)
```

**스크린샷 캡처 요청**:
- [ ] 타임아웃 에러 메시지 전체
- [ ] 에러 발생 시각 (KST 기준)
- [ ] 함수 실행 시간 (Duration)

---

### 2.2 Phase 2 크롤링 로그 검색

**검색 키워드**:
```
"[CRAWLER-P2]"
"enable_phase2"
"Phase 2"
"PHASE2_SOURCES"
```

**기대 결과**:
```
✅ 정상 실행 시:
[CRAWLER-P2] 31개 환경센터 크롤링 시작
[CRAWLER-P2] 배치 1 (0-8): 8개 센터 처리
[CRAWLER-P2] 경기환경에너지진흥원 크롤링 시작
[CRAWLER-P2] 경기환경에너지진흥원: 5개 관련 공고 처리 중

❌ 에러 발생 시:
[ERROR] PHASE2_SOURCES is undefined
[CRAWLER-P2] 배치 소스가 비어있음
[ERROR] Failed to fetch: ETIMEDOUT
```

**스크린샷 캡처 요청**:
- [ ] Phase 2 시작 로그
- [ ] 배치 처리 로그
- [ ] 개별 센터 크롤링 로그
- [ ] 에러 메시지 (있다면)

---

### 2.3 Supabase 관련 로그 검색

**검색 키워드**:
```
"crawl_runs"
"insert"
"update"
"Failed to create crawl_run"
"Failed to update crawl_run"
"Supabase"
```

**기대 결과**:
```
✅ 정상 실행 시:
[CRAWLER] Created crawl_run: run_phase2_2026-01-13T04-11-13
[DEBUG] Updating crawl_run: run_phase2_2026-01-13T04-11-13
[DEBUG] crawl_run updated successfully

❌ 에러 발생 시:
[ERROR] Failed to create crawl_run: [에러 메시지]
[ERROR] Failed to update crawl_run: [에러 메시지]
[ERROR] RLS policy violation
```

**스크린샷 캡처 요청**:
- [ ] crawl_runs INSERT 로그
- [ ] crawl_runs UPDATE 로그 (있다면)
- [ ] Supabase 에러 메시지 (있다면)

---

### 2.4 실행 시간 및 성능 로그

**확인 항목**:
```
1. Function Duration (총 실행 시간)
   → 10초 이상인가?
   → 평균 실행 시간은?

2. Memory Usage (메모리 사용량)
   → 제한(1024MB)에 근접한가?

3. Cold Start (콜드 스타트)
   → 첫 실행 시 초기화 시간
```

**스크린샷 캡처 요청**:
- [ ] Function Duration 그래프/숫자
- [ ] Memory Usage 그래프
- [ ] 개별 실행 로그의 Duration 값

---

## 📊 Step 3: 특정 실행 로그 상세 분석

### 3.1 실패한 실행 선택

**대상 run_id** (모니터링 대시보드에서 확인):
```
❌ run_phase2_2026-01-13T04-11-13 (failed)
❌ run_phase2_2026-01-13T04-11-12 (failed)
🔄 run_phase2_2026-01-12T04-38-32 (running)
```

**Vercel에서 해당 시각 로그 찾기**:
```
1. Logs 탭에서 시간 필터 설정
   → 2026-01-13 04:11:00 ~ 04:12:00 (UTC)
   → 한국 시각(KST) = UTC + 9시간

2. 해당 시각의 POST /api/subsidy-crawler 로그 확인

3. Request/Response 상세 보기
   → Request body (enable_phase2, batch_num 등)
   → Response status (200? 500?)
   → Response body
```

**스크린샷 캡처 요청**:
- [ ] 실패한 실행의 전체 로그 (시작부터 끝까지)
- [ ] Request body
- [ ] Response status & body

---

### 3.2 성공한 Government 크롤링과 비교

**대상 run_id**:
```
✅ run_government_2026-01-13T03-55-15 (completed, 100%)
```

**비교 항목**:
```
1. 실행 시간
   - Government: ?초
   - Phase 2: ?초

2. 로그 패턴
   - Government: 어떤 로그가 출력되는가?
   - Phase 2: 어디서 멈추는가?

3. 데이터베이스 작업
   - Government: UPDATE 성공?
   - Phase 2: UPDATE 실패?
```

**스크린샷 캡처 요청**:
- [ ] Government 크롤링 성공 로그
- [ ] Phase 2 크롤링 실패 로그
- [ ] 두 로그의 차이점 하이라이트

---

## 🔬 Step 4: 고급 진단 (선택 사항)

### 4.1 실시간 로그 모니터링

**방법**:
```bash
# Vercel CLI 설치
npm i -g vercel

# 로그인
vercel login

# 실시간 로그 스트리밍
vercel logs --follow

# Phase 2 크롤링 수동 실행 (GitHub Actions)
# → 실시간 로그 확인
```

---

### 4.2 로컬 환경에서 디버깅

**임시 디버그 로그 추가**:
```typescript
// app/api/subsidy-crawler/route.ts
// 배포 전 임시로 추가

export async function POST(request: NextRequest) {
  const startTime = Date.now();
  console.log(`[DEBUG] ==================== START ====================`);
  console.log(`[DEBUG] Timestamp: ${new Date().toISOString()}`);

  try {
    const body = await request.json();
    console.log(`[DEBUG] Request body:`, JSON.stringify(body, null, 2));

    const { enable_phase2, batch_num, batch_size } = body;
    console.log(`[DEBUG] enable_phase2: ${enable_phase2}`);
    console.log(`[DEBUG] batch_num: ${batch_num}, batch_size: ${batch_size}`);

    if (enable_phase2) {
      console.log(`[DEBUG] PHASE2_SOURCES.length: ${PHASE2_SOURCES.length}`);

      const effectiveBatchSize = batch_size || 8;
      const effectiveBatchNum = batch_num || 1;
      const startIdx = (effectiveBatchNum - 1) * effectiveBatchSize;
      const endIdx = startIdx + effectiveBatchSize;

      console.log(`[DEBUG] Batch calculation:`);
      console.log(`[DEBUG]   startIdx: ${startIdx}, endIdx: ${endIdx}`);
      console.log(`[DEBUG]   effectiveBatchSize: ${effectiveBatchSize}`);
      console.log(`[DEBUG]   effectiveBatchNum: ${effectiveBatchNum}`);

      const batchSources = PHASE2_SOURCES.slice(startIdx, endIdx);
      console.log(`[DEBUG] batchSources.length: ${batchSources.length}`);
      console.log(`[DEBUG] batchSources:`, batchSources.map(s => s.name));

      if (batchSources.length === 0) {
        console.error(`[ERROR] No sources in batch!`);
        throw new Error('Batch sources is empty - check batch calculation');
      }

      console.log(`[DEBUG] Starting Phase 2 crawling...`);

      for (let i = 0; i < batchSources.length; i++) {
        const source = batchSources[i];
        const elapsed = Date.now() - startTime;
        console.log(`[DEBUG] [${i+1}/${batchSources.length}] Processing ${source.name} (elapsed: ${elapsed}ms)`);

        try {
          const announcements = await crawlPhase2Source(source);
          console.log(`[DEBUG] ${source.name}: ${announcements.length} announcements found`);
        } catch (error: any) {
          console.error(`[ERROR] ${source.name} failed:`, error.message);
        }
      }
    }

    const duration = Date.now() - startTime;
    console.log(`[DEBUG] Total duration: ${duration}ms`);
    console.log(`[DEBUG] ==================== END ====================`);

  } catch (error: any) {
    console.error(`[ERROR] Fatal error:`, error);
    console.log(`[DEBUG] ==================== ERROR ====================`);
  }
}
```

**배포 후 확인**:
```
1. Vercel에 배포
2. GitHub Actions 수동 실행 (workflow_dispatch)
3. Vercel 로그에서 [DEBUG] 태그 검색
4. 어디서 멈추는지 정확히 확인
```

---

## 📸 수집해야 할 스크린샷/정보

### 필수 정보 체크리스트

#### ✅ Vercel 대시보드
- [ ] Functions 탭 전체 화면
- [ ] subsidy-crawler 함수 상세 페이지
- [ ] Logs 탭 (검색 결과 포함)

#### ✅ 타임아웃 관련
- [ ] "timeout" 검색 결과
- [ ] Function Duration 값 (10초 이상인지 확인)
- [ ] 타임아웃 에러 메시지 (있다면)

#### ✅ Phase 2 크롤링 로그
- [ ] "[CRAWLER-P2]" 검색 결과
- [ ] 배치 처리 로그
- [ ] 개별 센터 크롤링 로그
- [ ] 에러 메시지 (있다면)

#### ✅ Supabase 로그
- [ ] "crawl_runs" 검색 결과
- [ ] INSERT/UPDATE 로그
- [ ] Supabase 에러 (있다면)

#### ✅ 실패 사례 상세
- [ ] `run_phase2_2026-01-13T04-11-13` 전체 로그
- [ ] Request body
- [ ] Response status & body

#### ✅ 성공 사례 비교
- [ ] `run_government_2026-01-13T03-55-15` 전체 로그
- [ ] Government vs Phase 2 차이점

---

## 🎯 조사 결과 정리 템플릿

조사 완료 후 다음 형식으로 정리해주세요:

```markdown
## Vercel 로그 조사 결과

### 1. 타임아웃 발생 여부
- [ ] 타임아웃 발생함 (에러 메시지: _____________)
- [ ] 타임아웃 발생 안 함
- 평균 실행 시간: _____초

### 2. Phase 2 크롤링 로그
- PHASE2_SOURCES.length: _____
- batchSources.length: _____
- 크롤링 시작 여부: [ ] 예 / [ ] 아니오
- 에러 메시지: _____________

### 3. Supabase 작업
- crawl_runs INSERT: [ ] 성공 / [ ] 실패
- crawl_runs UPDATE: [ ] 성공 / [ ] 실패
- 에러 메시지: _____________

### 4. 특이사항
(발견한 이상한 점, 예상 밖의 로그 등)

### 5. 스크린샷
(관련 스크린샷 첨부)
```

---

## 🔧 조사 후 다음 단계

로그 조사 결과에 따라:

### 시나리오 A: 타임아웃 확인됨
→ **배치 크기 축소** (8 → 4) 즉시 적용

### 시나리오 B: PHASE2_SOURCES 비어있음
→ **배치 인덱스 계산 오류** 수정

### 시나리오 C: Supabase 권한 문제
→ **RLS 정책** 확인 및 수정

### 시나리오 D: 알 수 없는 에러
→ **디버그 로그 추가 후 재조사**

---

## 💡 추가 팁

### Vercel 로그 검색 팁
```
1. 시간 범위 좁히기
   → 실패한 시각 ±5분으로 필터링

2. 여러 키워드 동시 검색
   → "phase2 OR timeout OR error"

3. 로그 레벨 필터
   → Error/Warning만 보기

4. Function별 필터
   → subsidy-crawler만 보기
```

### 로그가 너무 많을 때
```
1. 가장 최근 실패 케이스 1개만 집중 분석
2. 성공 케이스 1개와 비교
3. 차이점만 추출
```

---

**작성자**: Claude Sonnet 4.5
**작성일**: 2026-01-14
