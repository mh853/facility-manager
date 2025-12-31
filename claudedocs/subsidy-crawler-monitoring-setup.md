# Subsidy Crawler Monitoring System - Setup Guide

## 개요

보조금 크롤러의 실행 스케줄, 결과 통계, AI 검증 등을 추적하는 종합 모니터링 시스템입니다.

## 주요 기능

### 1. 크롤링 실행 추적
- **스케줄 모니터링**: 언제 크롤링이 실행되었는지 추적 (매주 일요일 21시)
- **실행 상태**: running, completed, failed, partial
- **배치별 상세 결과**: 22개 배치 각각의 성공/실패 추적

### 2. 결과 통계
- **전체 URL 수**: 크롤링한 총 URL 개수 (230개)
- **성공/실패 URL**: 배치별 성공률 추적
- **발견된 공고 수**: 총 공고, 신규 공고, 관련 공고
- **AI 검증 공고 수**: Gemini AI가 관련있다고 판단한 공고

### 3. 유의미한 결과 분석
- **키워드 매칭**: 기존 키워드 시스템으로 필터링된 공고
- **AI 검증**: Gemini 1.5 Flash로 검증된 공고
- **불일치 추적**: 키워드와 AI 판단이 다른 경우 추적

### 4. URL 건강도 추적
- **성공률**: URL별 크롤링 성공률 (80% 이상이 건강)
- **응답 시간**: 평균/최대/최소 응답 시간
- **연속 실패**: 3회 이상 실패 시 경고
- **관련도**: 해당 URL에서 발견된 공고의 관련성 비율

## 데이터베이스 설정

### 1. SQL 스키마 실행

Supabase SQL Editor에서 다음 파일을 실행:

```bash
sql/subsidy_crawler_monitoring.sql
```

이 스크립트는 다음을 생성합니다:

**테이블 (4개)**:
- `crawl_runs` - 크롤링 실행 기록
- `crawl_batch_results` - 배치별 상세 결과
- `ai_verification_log` - AI 검증 로그
- `url_health_metrics` - URL 건강도 메트릭

**뷰 (3개)**:
- `vw_recent_crawl_runs` - 최근 크롤링 실행 요약
- `vw_url_health_summary` - URL 건강도 요약
- `vw_ai_disagreements` - AI/키워드 불일치 목록

**트리거 및 RLS 정책**: 자동 업데이트 및 보안

### 2. 환경 변수 설정

`.env.local`에 Gemini API 키 추가:

```env
# Existing Supabase config
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key

# NEW: Google Gemini API
GEMINI_API_KEY=your_gemini_api_key_here
```

**Gemini API 키 발급**:
1. https://ai.google.dev/ 방문
2. "Get API key" 클릭
3. 프로젝트 생성 또는 선택
4. API 키 복사

## API 엔드포인트

### 크롤링 실행 조회

```typescript
// GET /api/subsidy-crawler/runs
// 최근 크롤링 실행 목록 (페이지네이션, 필터링 지원)

const response = await fetch('/api/subsidy-crawler/runs?limit=20&offset=0');
const { data } = await response.json();

console.log(data.runs); // 크롤링 실행 목록
console.log(data.statistics); // 집계 통계
```

### 특정 실행 상세 조회

```typescript
// GET /api/subsidy-crawler/runs/[runId]
// 특정 크롤링 실행의 배치별 상세 결과

const response = await fetch('/api/subsidy-crawler/runs/run_2025-12-23_21:00');
const { data } = await response.json();

console.log(data.run); // 실행 요약
console.log(data.batches); // 22개 배치 결과
console.log(data.ai_verification_summary); // AI 검증 요약
```

### URL 건강도 조회

```typescript
// GET /api/subsidy-crawler/url-health
// URL별 건강도 메트릭 (문제 URL 우선 정렬)

const response = await fetch('/api/subsidy-crawler/url-health?unhealthy_only=true');
const { data } = await response.json();

console.log(data.metrics); // URL 건강도 목록
console.log(data.statistics); // 건강도 통계
```

### AI 검증 통계

```typescript
// GET /api/subsidy-crawler/ai-verification/stats
// AI 검증 통계 및 불일치 사례

const response = await fetch('/api/subsidy-crawler/ai-verification/stats');
const { data } = await response.json();

console.log(data.statistics); // AI 검증 통계
console.log(data.recent_disagreements); // 최근 불일치 사례
console.log(data.disagreement_breakdown); // 불일치 유형별 분류
```

## GitHub Actions 통합

### 1. 크롤링 시작 시 로깅

`.github/workflows/subsidy-crawler-direct.yml`에 추가:

```yaml
jobs:
  crawl:
    steps:
      # ... 기존 steps ...

      # NEW: 크롤링 시작 로깅
      - name: Log crawl run start
        run: |
          RUN_ID="run_$(date -u +%Y-%m-%d_%H:%M)"
          curl -X POST "${{ secrets.VERCEL_URL }}/api/subsidy-crawler/runs" \
            -H "Content-Type: application/json" \
            -d '{
              "run_id": "'"$RUN_ID"'",
              "trigger_type": "scheduled",
              "github_run_id": "${{ github.run_id }}",
              "total_batches": 22
            }'
          echo "RUN_ID=$RUN_ID" >> $GITHUB_ENV
```

### 2. 배치 결과 로깅

각 배치 실행 후:

```yaml
      # NEW: 배치 결과 로깅
      - name: Log batch result
        if: always()
        run: |
          curl -X POST "${{ secrets.VERCEL_URL }}/api/subsidy-crawler/batches" \
            -H "Content-Type: application/json" \
            -d '{
              "run_id": "${{ env.RUN_ID }}",
              "batch_number": ${{ matrix.batch }},
              "urls_in_batch": 10,
              "status": "completed",
              "total_announcements": '$TOTAL_ANNOUNCEMENTS',
              "relevant_announcements": '$RELEVANT_ANNOUNCEMENTS',
              "ai_verified_announcements": '$AI_VERIFIED'
            }'
```

### 3. AI 검증 통합

기존 크롤러 API (`/app/api/subsidy-crawler/direct/route.ts`)에 AI 검증 추가:

```typescript
import { verifyAnnouncementWithGemini } from '@/lib/ai/gemini-verification';

// ... 기존 코드 ...

// 각 공고에 대해 AI 검증 수행
for (const announcement of announcements) {
  // 1. 기존 키워드 매칭
  const keywordResult = analyzeAnnouncement(announcement);

  // 2. NEW: AI 검증
  const aiResult = await verifyAnnouncementWithGemini(
    announcement.title,
    announcement.content,
    sourceUrl
  );

  // 3. 검증 로그 저장
  await fetch('/api/subsidy-crawler/ai-verification/log', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      run_id: currentRunId,
      batch_number: currentBatch,
      announcement_url: announcement.url,
      announcement_title: announcement.title,
      announcement_content: announcement.content,
      source_url: sourceUrl,
      keyword_matched: keywordResult.isRelevant,
      matched_keywords: keywordResult.matchedKeywords,
      keyword_score: keywordResult.score,
      ai_verified: aiResult.is_relevant,
      ai_confidence: aiResult.confidence,
      ai_reasoning: aiResult.reasoning,
      prompt_tokens: aiResult.token_usage.prompt_tokens,
      completion_tokens: aiResult.token_usage.completion_tokens,
      total_tokens: aiResult.token_usage.total_tokens,
      api_cost_usd: aiResult.api_cost_usd,
      response_time_ms: aiResult.response_time_ms,
    }),
  });

  // 4. AI와 키워드 모두 관련있다고 판단한 경우만 최종 결과에 포함
  if (keywordResult.isRelevant || aiResult.is_relevant) {
    relevantAnnouncements.push({
      ...announcement,
      verification: {
        keyword: keywordResult,
        ai: aiResult,
        final_decision: keywordResult.isRelevant && aiResult.is_relevant,
      },
    });
  }
}
```

## 비용 분석

### Gemini API 비용 (gemini-1.5-flash)

**가격**:
- Input: $0.075 per 1M tokens
- Output: $0.30 per 1M tokens

**예상 사용량 (주간 크롤링)**:
- 공고 수: ~50개 (주당)
- 평균 토큰: ~500 tokens/announcement
- 총 토큰: 25,000 tokens/week = 100,000 tokens/month

**월간 비용**:
```
Input cost:  (100,000 / 1,000,000) * $0.075 = $0.0075
Output cost: (100,000 / 1,000,000) * $0.30  = $0.03
Total:       ~$0.04/month
```

**결론**: 매우 저렴 (~40원/월)

## 모니터링 UI 예시

### 대시보드

```typescript
// app/admin/subsidy/monitoring/page.tsx
export default function MonitoringDashboard() {
  const [runs, setRuns] = useState<CrawlRun[]>([]);

  useEffect(() => {
    fetch('/api/subsidy-crawler/runs?limit=10')
      .then(res => res.json())
      .then(data => setRuns(data.data.runs));
  }, []);

  return (
    <div>
      <h1>크롤링 모니터링 대시보드</h1>

      {runs.map(run => (
        <div key={run.id}>
          <h2>{run.run_id}</h2>
          <p>실행 시간: {new Date(run.started_at).toLocaleString('ko-KR')}</p>
          <p>상태: {run.status}</p>
          <p>총 공고: {run.total_announcements}</p>
          <p>관련 공고: {run.relevant_announcements}</p>
          <p>AI 검증: {run.ai_verified_announcements}</p>
          <p>성공률: {run.success_rate}%</p>
        </div>
      ))}
    </div>
  );
}
```

### URL 건강도 모니터

```typescript
// app/admin/subsidy/url-health/page.tsx
export default function UrlHealthMonitor() {
  const [metrics, setMetrics] = useState<UrlHealthMetric[]>([]);

  useEffect(() => {
    fetch('/api/subsidy-crawler/url-health?unhealthy_only=true')
      .then(res => res.json())
      .then(data => setMetrics(data.data.metrics));
  }, []);

  return (
    <div>
      <h1>URL 건강도 모니터</h1>

      <table>
        <thead>
          <tr>
            <th>URL</th>
            <th>성공률</th>
            <th>연속 실패</th>
            <th>관련도</th>
            <th>상태</th>
          </tr>
        </thead>
        <tbody>
          {metrics.map(metric => (
            <tr key={metric.id} className={!metric.is_healthy ? 'text-red-600' : ''}>
              <td>{metric.source_url}</td>
              <td>{metric.success_rate.toFixed(1)}%</td>
              <td>{metric.consecutive_failures}</td>
              <td>{metric.relevance_rate.toFixed(1)}%</td>
              <td>{metric.is_healthy ? '✅ 정상' : '⚠️ 주의'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
```

## 다음 단계

### Phase 1: 완료 ✅
- ✅ 데이터베이스 스키마 생성
- ✅ TypeScript 타입 정의
- ✅ 모니터링 API 구현
- ✅ Gemini AI 검증 라이브러리

### Phase 2: 진행 중
- [ ] GitHub Actions 워크플로우 수정
- [ ] 크롤러 API에 AI 검증 통합
- [ ] URL 건강도 자동 업데이트

### Phase 3: 예정
- [ ] 모니터링 대시보드 UI
- [ ] URL 건강도 모니터 UI
- [ ] AI 불일치 리뷰 UI

### Phase 4: 향후
- [ ] Slack 알림 개선 (AI 검증 결과 포함)
- [ ] 문제 URL 자동 비활성화
- [ ] 주간 리포트 자동 생성

## 문제 해결

### Gemini API 오류

**증상**: "API key not found" 오류

**해결**:
```bash
# .env.local 파일 확인
cat .env.local | grep GEMINI

# API 키 재설정
# https://ai.google.dev/ 에서 새 키 발급
```

### 데이터베이스 연결 오류

**증상**: "relation does not exist" 오류

**해결**:
```sql
-- Supabase SQL Editor에서 테이블 존재 확인
SELECT tablename FROM pg_tables WHERE schemaname = 'public';

-- 스키마 재실행
-- sql/subsidy_crawler_monitoring.sql
```

### RLS 정책 오류

**증상**: "permission denied" 오류

**해결**:
```sql
-- Service role로 실행되는지 확인
-- API에서 SUPABASE_SERVICE_ROLE_KEY 사용 여부 확인

-- RLS 정책 재생성
DROP POLICY IF EXISTS "Service role has full access to crawl_runs" ON crawl_runs;
-- ... (스키마 파일에서 정책 재실행)
```

## 참고 자료

- [Google Gemini API Docs](https://ai.google.dev/docs)
- [Gemini Pricing](https://ai.google.dev/pricing)
- [Supabase Database](https://supabase.com/docs/guides/database)
- [GitHub Actions](https://docs.github.com/en/actions)
