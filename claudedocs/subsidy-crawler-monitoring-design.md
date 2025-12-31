# 보조금 크롤링 모니터링 및 AI 검증 시스템 설계

## 📋 목차
1. [시스템 개요](#시스템-개요)
2. [데이터베이스 스키마](#데이터베이스-스키마)
3. [API 설계](#api-설계)
4. [Gemini AI 검증 시스템](#gemini-ai-검증-시스템)
5. [모니터링 UI](#모니터링-ui)
6. [구현 로드맵](#구현-로드맵)

---

## 시스템 개요

### 현재 상황
- **직접 URL**: 230개 등록 완료
- **스케줄**: 매주 일요일 밤 9시 (KST)
- **배치 크기**: 10개 URL/배치
- **실행 방식**: GitHub Actions (22개 배치 병렬 실행)

### 신규 요구사항
1. ✅ **크롤링 스케줄 모니터링**: 언제 실행되었는지
2. ✅ **크롤링 결과 통계**: 총 몇 개의 공고 발견
3. ✅ **유의미한 결과 분석**: 관련 공고 몇 개
4. ✅ **Gemini AI 검증**: AI 기반 공고 관련성 재검증

---

## 데이터베이스 스키마

### 1. `crawl_runs` - 크롤링 실행 이력

```sql
CREATE TABLE crawl_runs (
  -- 기본 정보
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id VARCHAR(100) UNIQUE NOT NULL,  -- GitHub Actions run_id

  -- 실행 정보
  trigger_type VARCHAR(20) NOT NULL,     -- 'scheduled', 'manual', 'retry'
  started_at TIMESTAMP NOT NULL,
  completed_at TIMESTAMP,
  status VARCHAR(20) NOT NULL,           -- 'running', 'completed', 'failed', 'partial'

  -- 크롤링 범위
  total_urls INTEGER NOT NULL,           -- 크롤링 대상 URL 수
  total_batches INTEGER NOT NULL,        -- 배치 수

  -- 크롤링 결과
  successful_urls INTEGER DEFAULT 0,     -- 성공한 URL 수
  failed_urls INTEGER DEFAULT 0,         -- 실패한 URL 수

  -- 공고 통계
  total_announcements INTEGER DEFAULT 0, -- 발견한 전체 공고 수
  new_announcements INTEGER DEFAULT 0,   -- 신규 공고 수
  duplicate_announcements INTEGER DEFAULT 0, -- 중복 공고 수

  -- 관련성 분석
  relevant_announcements INTEGER DEFAULT 0,    -- 키워드 매칭 관련 공고
  ai_verified_announcements INTEGER DEFAULT 0, -- AI 검증 통과 공고

  -- 성능 메트릭
  avg_crawl_time DECIMAL(10,2),         -- 평균 크롤링 시간 (초)
  total_execution_time INTEGER,         -- 전체 실행 시간 (초)

  -- 메타데이터
  github_workflow_url TEXT,
  error_summary TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

-- 인덱스
CREATE INDEX idx_crawl_runs_started_at ON crawl_runs(started_at DESC);
CREATE INDEX idx_crawl_runs_status ON crawl_runs(status);
CREATE INDEX idx_crawl_runs_trigger_type ON crawl_runs(trigger_type);
```

### 2. `crawl_batch_results` - 배치별 상세 결과

```sql
CREATE TABLE crawl_batch_results (
  -- 기본 정보
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  crawl_run_id UUID NOT NULL REFERENCES crawl_runs(id) ON DELETE CASCADE,
  batch_number INTEGER NOT NULL,

  -- 배치 실행 정보
  started_at TIMESTAMP NOT NULL,
  completed_at TIMESTAMP,
  status VARCHAR(20) NOT NULL,           -- 'running', 'completed', 'failed'

  -- 배치 결과
  urls_processed INTEGER DEFAULT 0,
  successful_urls INTEGER DEFAULT 0,
  failed_urls INTEGER DEFAULT 0,

  -- 공고 통계
  announcements_found INTEGER DEFAULT 0,
  new_announcements INTEGER DEFAULT 0,
  relevant_announcements INTEGER DEFAULT 0,

  -- 성능 메트릭
  execution_time INTEGER,                -- 실행 시간 (초)
  avg_url_time DECIMAL(10,2),           -- URL당 평균 시간 (초)

  -- 에러 정보
  error_count INTEGER DEFAULT 0,
  error_details JSONB,                   -- [{url, error, timestamp}]

  created_at TIMESTAMP DEFAULT NOW()
);

-- 인덱스
CREATE INDEX idx_crawl_batch_crawl_run ON crawl_batch_results(crawl_run_id);
CREATE INDEX idx_crawl_batch_number ON crawl_batch_results(batch_number);
```

### 3. `ai_verification_log` - AI 검증 이력

```sql
CREATE TABLE ai_verification_log (
  -- 기본 정보
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  announcement_id UUID NOT NULL REFERENCES subsidy_announcements(id) ON DELETE CASCADE,
  crawl_run_id UUID REFERENCES crawl_runs(id) ON DELETE SET NULL,

  -- AI 검증 정보
  ai_provider VARCHAR(20) NOT NULL,      -- 'gemini', 'gpt', 'claude'
  model_version VARCHAR(50),             -- 'gemini-1.5-flash', 'gpt-4', etc.

  -- 검증 결과
  is_relevant BOOLEAN NOT NULL,          -- AI 검증 결과
  confidence_score DECIMAL(3,2),         -- 신뢰도 (0.00 ~ 1.00)

  -- AI 분석 결과
  ai_reasoning TEXT,                     -- AI의 판단 근거
  matched_keywords JSONB,                -- AI가 발견한 키워드
  suggested_category VARCHAR(100),       -- AI 추천 카테고리

  -- 키워드 매칭과 비교
  keyword_match_result BOOLEAN,          -- 기존 키워드 매칭 결과
  agreement BOOLEAN,                     -- AI와 키워드 매칭 일치 여부

  -- 메타데이터
  processing_time INTEGER,               -- AI 처리 시간 (ms)
  token_usage JSONB,                     -- {prompt_tokens, completion_tokens}
  verified_at TIMESTAMP DEFAULT NOW(),

  created_at TIMESTAMP DEFAULT NOW()
);

-- 인덱스
CREATE INDEX idx_ai_verification_announcement ON ai_verification_log(announcement_id);
CREATE INDEX idx_ai_verification_crawl_run ON ai_verification_log(crawl_run_id);
CREATE INDEX idx_ai_verification_is_relevant ON ai_verification_log(is_relevant);
CREATE INDEX idx_ai_verification_agreement ON ai_verification_log(agreement);
```

### 4. `url_health_metrics` - URL 건강도 메트릭

```sql
CREATE TABLE url_health_metrics (
  -- 기본 정보
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  url_source_id UUID NOT NULL REFERENCES direct_url_sources(id) ON DELETE CASCADE,

  -- 크롤링 실행 정보
  crawl_run_id UUID REFERENCES crawl_runs(id) ON DELETE SET NULL,
  crawled_at TIMESTAMP NOT NULL,

  -- 성능 메트릭
  response_time INTEGER,                 -- 응답 시간 (ms)
  status_code INTEGER,                   -- HTTP 상태 코드

  -- 크롤링 결과
  announcements_found INTEGER DEFAULT 0,
  relevant_announcements INTEGER DEFAULT 0,
  crawl_success BOOLEAN NOT NULL,

  -- 에러 정보
  error_type VARCHAR(100),               -- 'timeout', 'network', 'parse', etc.
  error_message TEXT,

  created_at TIMESTAMP DEFAULT NOW()
);

-- 인덱스
CREATE INDEX idx_url_health_url_source ON url_health_metrics(url_source_id);
CREATE INDEX idx_url_health_crawl_run ON url_health_metrics(crawl_run_id);
CREATE INDEX idx_url_health_crawled_at ON url_health_metrics(crawled_at DESC);
```

---

## API 설계

### 1. 크롤링 실행 이력 API

#### `GET /api/subsidy-crawler/runs`
**목적**: 크롤링 실행 이력 조회

**Query Parameters**:
```typescript
{
  page?: number;           // 페이지 번호 (기본: 1)
  pageSize?: number;       // 페이지 크기 (기본: 20)
  status?: string;         // 'running', 'completed', 'failed', 'partial'
  triggerType?: string;    // 'scheduled', 'manual', 'retry'
  startDate?: string;      // 시작 날짜 (ISO 8601)
  endDate?: string;        // 종료 날짜 (ISO 8601)
}
```

**Response**:
```typescript
{
  success: boolean;
  data: {
    runs: [{
      id: string;
      run_id: string;
      trigger_type: string;
      started_at: string;
      completed_at: string;
      status: string;
      total_urls: number;
      successful_urls: number;
      failed_urls: number;
      total_announcements: number;
      new_announcements: number;
      relevant_announcements: number;
      ai_verified_announcements: number;
      success_rate: number;  // 계산: successful_urls / total_urls * 100
    }];
    pagination: {
      page: number;
      pageSize: number;
      totalRecords: number;
      totalPages: number;
    };
  };
}
```

### 2. 크롤링 상세 정보 API

#### `GET /api/subsidy-crawler/runs/:runId`
**목적**: 특정 크롤링 실행의 상세 정보

**Response**:
```typescript
{
  success: boolean;
  data: {
    run: {
      id: string;
      run_id: string;
      trigger_type: string;
      started_at: string;
      completed_at: string;
      status: string;
      total_urls: number;
      successful_urls: number;
      failed_urls: number;
      total_announcements: number;
      new_announcements: number;
      relevant_announcements: number;
      ai_verified_announcements: number;
      avg_crawl_time: number;
      total_execution_time: number;
      github_workflow_url: string;
    };
    batches: [{
      batch_number: number;
      started_at: string;
      completed_at: string;
      status: string;
      urls_processed: number;
      successful_urls: number;
      failed_urls: number;
      announcements_found: number;
      new_announcements: number;
      relevant_announcements: number;
      execution_time: number;
      error_count: number;
    }];
    statistics: {
      total_batches: number;
      completed_batches: number;
      failed_batches: number;
      avg_batch_time: number;
      success_rate: number;
    };
  };
}
```

### 3. AI 검증 통계 API

#### `GET /api/subsidy-crawler/ai-verification/stats`
**목적**: AI 검증 통계 조회

**Query Parameters**:
```typescript
{
  crawlRunId?: string;     // 특정 크롤링 실행 필터
  startDate?: string;      // 시작 날짜
  endDate?: string;        // 종료 날짜
}
```

**Response**:
```typescript
{
  success: boolean;
  data: {
    overall: {
      total_verified: number;
      ai_relevant: number;
      ai_irrelevant: number;
      avg_confidence: number;
      agreement_rate: number;  // AI와 키워드 매칭 일치율
    };
    by_provider: [{
      provider: string;
      model_version: string;
      total_verifications: number;
      relevant_count: number;
      avg_confidence: number;
      avg_processing_time: number;
      token_usage: {
        total_prompt_tokens: number;
        total_completion_tokens: number;
      };
    }];
    disagreements: [{
      announcement_id: string;
      title: string;
      keyword_result: boolean;
      ai_result: boolean;
      ai_confidence: number;
      ai_reasoning: string;
    }];
  };
}
```

### 4. URL 건강도 API

#### `GET /api/subsidy-crawler/url-health`
**목적**: URL별 건강도 조회

**Query Parameters**:
```typescript
{
  urlSourceId?: string;    // 특정 URL 필터
  status?: string;         // 'healthy', 'warning', 'critical'
  limit?: number;          // 결과 수 (기본: 50)
}
```

**Response**:
```typescript
{
  success: boolean;
  data: {
    urls: [{
      url_source_id: string;
      url: string;
      region_name: string;
      health_status: string;  // 'healthy', 'warning', 'critical'
      last_crawl: {
        crawled_at: string;
        success: boolean;
        response_time: number;
        announcements_found: number;
      };
      metrics_30d: {
        total_crawls: number;
        success_rate: number;
        avg_response_time: number;
        avg_announcements: number;
        error_count: number;
      };
      consecutive_failures: number;
    }];
  };
}
```

---

## Gemini AI 검증 시스템

### 1. 아키텍처

```
┌─────────────────────────────────────────────────────────┐
│                 크롤링 파이프라인                         │
├─────────────────────────────────────────────────────────┤
│                                                          │
│  1. URL 크롤링                                           │
│     ↓                                                    │
│  2. 키워드 매칭 (기존 로직)                               │
│     ↓                                                    │
│  3. 공고 저장 (DB)                                       │
│     ↓                                                    │
│  4. **Gemini AI 검증** (새로운 단계)                     │
│     ├─ 관련성 분석                                       │
│     ├─ 신뢰도 점수 산출                                  │
│     ├─ 카테고리 분류                                     │
│     └─ 판단 근거 생성                                    │
│     ↓                                                    │
│  5. AI 검증 결과 저장                                    │
│     ↓                                                    │
│  6. 불일치 케이스 리뷰                                   │
│                                                          │
└─────────────────────────────────────────────────────────┘
```

### 2. Gemini API 연동

#### 프롬프트 템플릿

```typescript
const AI_VERIFICATION_PROMPT = `
당신은 대한민국 지자체 보조금 공고의 관련성을 평가하는 전문가입니다.
다음 공고가 "IoT 기반 대기오염 방지시설" 지원사업과 관련이 있는지 분석해주세요.

## 공고 정보
제목: {title}
내용: {content}
지역: {region_name}
예산: {budget}
신청 기간: {application_period}

## 평가 기준
1. IoT, 사물인터넷 관련 기술 언급
2. 대기오염, 대기배출시설, 방지시설 관련
3. 환경 모니터링, 원격 감시 시스템 관련
4. 소규모 사업장 대상 지원사업

## 제외 기준
- 채용, 인력 모집 공고
- 입찰, 용역 공고
- 결과 발표, 선정 공고

## 응답 형식 (JSON)
{
  "is_relevant": boolean,
  "confidence": number (0.0 ~ 1.0),
  "reasoning": string,
  "matched_keywords": string[],
  "suggested_category": string,
  "exclusion_reasons": string[]
}
`;
```

#### Gemini API 호출 함수

```typescript
// lib/ai/gemini-verification.ts

import { GoogleGenerativeAI } from '@google/generative-ai';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

export interface GeminiVerificationResult {
  is_relevant: boolean;
  confidence: number;
  reasoning: string;
  matched_keywords: string[];
  suggested_category: string;
  exclusion_reasons: string[];
}

export async function verifyAnnouncementWithGemini(
  announcement: {
    title: string;
    content?: string;
    region_name: string;
    budget?: string;
    application_period?: string;
  }
): Promise<{
  result: GeminiVerificationResult;
  processingTime: number;
  tokenUsage: { promptTokens: number; completionTokens: number };
}> {
  const startTime = Date.now();

  try {
    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

    const prompt = AI_VERIFICATION_PROMPT
      .replace('{title}', announcement.title)
      .replace('{content}', announcement.content || '내용 없음')
      .replace('{region_name}', announcement.region_name)
      .replace('{budget}', announcement.budget || '미공개')
      .replace('{application_period}', announcement.application_period || '미공개');

    const result = await model.generateContent(prompt);
    const response = result.response;
    const text = response.text();

    // JSON 파싱
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('Invalid JSON response from Gemini');
    }

    const verificationResult: GeminiVerificationResult = JSON.parse(jsonMatch[0]);

    const processingTime = Date.now() - startTime;

    // 토큰 사용량 (Gemini API에서 제공하는 경우)
    const tokenUsage = {
      promptTokens: result.response.usageMetadata?.promptTokenCount || 0,
      completionTokens: result.response.usageMetadata?.candidatesTokenCount || 0,
    };

    return {
      result: verificationResult,
      processingTime,
      tokenUsage,
    };
  } catch (error) {
    console.error('Gemini verification error:', error);
    throw error;
  }
}
```

### 3. 배치 AI 검증 API

#### `POST /api/subsidy-crawler/ai-verification/batch`
**목적**: 크롤링 결과에 대한 일괄 AI 검증

**Request**:
```typescript
{
  crawl_run_id: string;      // 검증할 크롤링 실행 ID
  announcement_ids?: string[]; // 특정 공고만 검증 (선택)
  force_reverify?: boolean;  // 이미 검증된 공고도 재검증
}
```

**Response**:
```typescript
{
  success: boolean;
  data: {
    total_verified: number;
    ai_relevant: number;
    ai_irrelevant: number;
    avg_confidence: number;
    agreement_rate: number;
    processing_time: number;  // ms
    results: [{
      announcement_id: string;
      title: string;
      keyword_match: boolean;
      ai_result: boolean;
      ai_confidence: number;
      agreement: boolean;
      ai_reasoning: string;
    }];
  };
}
```

---

## 모니터링 UI

### 1. 크롤링 대시보드

```
┌─────────────────────────────────────────────────────────┐
│                  크롤링 모니터링 대시보드                   │
├─────────────────────────────────────────────────────────┤
│                                                          │
│  📊 전체 통계 (최근 30일)                                 │
│  ┌──────────────┬──────────────┬──────────────────┐    │
│  │ 총 실행 횟수  │ 발견한 공고   │ 관련 공고         │    │
│  │    12회      │   1,234건    │   456건 (37%)    │    │
│  └──────────────┴──────────────┴──────────────────┘    │
│                                                          │
│  📈 크롤링 실행 이력                                      │
│  ┌────────────────────────────────────────────────┐    │
│  │ 날짜/시간           │ 스케줄  │ URL │ 공고 │ 관련 │    │
│  ├────────────────────────────────────────────────┤    │
│  │ 2025-01-05 21:00  │ 자동   │ 230 │  87  │  32  │    │
│  │ 2024-12-29 21:00  │ 자동   │ 230 │  91  │  28  │    │
│  │ 2024-12-22 21:00  │ 자동   │ 230 │  95  │  41  │    │
│  └────────────────────────────────────────────────┘    │
│                                                          │
│  🤖 AI 검증 통계                                         │
│  ┌────────────────────────────────────────────────┐    │
│  │ AI 검증 공고: 1,234건                             │    │
│  │ AI 관련 판정: 489건 (39.6%)                      │    │
│  │ 키워드 일치율: 92.3%                              │    │
│  │ 평균 신뢰도: 0.87                                 │    │
│  └────────────────────────────────────────────────┘    │
│                                                          │
│  ⚠️ 불일치 케이스 (리뷰 필요)                            │
│  ┌────────────────────────────────────────────────┐    │
│  │ [부산] 스마트공장 IoT 지원 사업                    │    │
│  │ 키워드: ✅ 관련 | AI: ❌ 무관 (신뢰도: 0.78)     │    │
│  │ AI 판단: 제조업 대상, 환경 관련 아님               │    │
│  └────────────────────────────────────────────────┘    │
│                                                          │
└─────────────────────────────────────────────────────────┘
```

### 2. 크롤링 상세 페이지

```
┌─────────────────────────────────────────────────────────┐
│           크롤링 실행 상세 (2025-01-05 21:00)            │
├─────────────────────────────────────────────────────────┤
│                                                          │
│  📊 실행 정보                                             │
│  • 실행 ID: run_20250105_210000                         │
│  • 트리거: 자동 스케줄                                    │
│  • 실행 시간: 21:00 ~ 21:08 (8분 23초)                  │
│  • GitHub Actions: [워크플로우 보기]                     │
│                                                          │
│  📦 배치 실행 결과 (22개 배치)                            │
│  ┌────────────────────────────────────────────────┐    │
│  │ 배치 │ URL │ 성공 │ 실패 │ 공고 │ 관련 │ 시간  │    │
│  ├────────────────────────────────────────────────┤    │
│  │  1   │ 10  │  10  │  0   │  4   │  2   │ 18초 │    │
│  │  2   │ 10  │   9  │  1   │  3   │  1   │ 22초 │    │
│  │  3   │ 10  │  10  │  0   │  5   │  3   │ 19초 │    │
│  │ ...  │ ... │ ...  │ ...  │ ...  │ ...  │ ...  │    │
│  └────────────────────────────────────────────────┘    │
│                                                          │
│  🎯 공고 발견 통계                                        │
│  • 전체 공고: 87건                                       │
│  • 신규 공고: 32건                                       │
│  • 중복 공고: 55건                                       │
│  • 키워드 관련: 32건 (36.8%)                            │
│  • AI 검증 관련: 28건 (32.2%)                           │
│                                                          │
│  ⚡ 성능 메트릭                                           │
│  • 평균 URL 처리 시간: 2.3초                             │
│  • 평균 배치 시간: 20.1초                                │
│  • 성공률: 97.8% (225/230)                              │
│                                                          │
└─────────────────────────────────────────────────────────┘
```

### 3. URL 건강도 모니터링

```
┌─────────────────────────────────────────────────────────┐
│                    URL 건강도 모니터링                     │
├─────────────────────────────────────────────────────────┤
│                                                          │
│  🏥 건강도 요약                                           │
│  ┌──────────────┬──────────────┬──────────────────┐    │
│  │ 정상 (Green) │ 주의 (Yellow) │ 위험 (Red)       │    │
│  │   215개      │    12개      │     3개          │    │
│  └──────────────┴──────────────┴──────────────────┘    │
│                                                          │
│  ⚠️ 주의/위험 URL                                        │
│  ┌────────────────────────────────────────────────┐    │
│  │ 🔴 부산시청 공고                                  │    │
│  │    • 연속 실패: 5회                               │    │
│  │    • 마지막 성공: 3주 전                          │    │
│  │    • 오류: Timeout (8s)                          │    │
│  │    [재시도] [비활성화]                            │    │
│  ├────────────────────────────────────────────────┤    │
│  │ 🟡 대구시청 공고                                  │    │
│  │    • 연속 실패: 2회                               │    │
│  │    • 평균 응답 시간: 7.2초 (느림)                 │    │
│  │    • 30일 성공률: 85%                            │    │
│  │    [재시도]                                      │    │
│  └────────────────────────────────────────────────┘    │
│                                                          │
│  📊 URL별 통계 (전체 230개)                              │
│  ┌────────────────────────────────────────────────┐    │
│  │ 지역       │ URL │ 30일 성공률 │ 평균 공고 │      │    │
│  ├────────────────────────────────────────────────┤    │
│  │ 서울특별시  │  15 │    98.2%   │   4.2개  │  ✅  │    │
│  │ 부산광역시  │  12 │    87.5%   │   3.1개  │  🟡  │    │
│  │ 경기도      │  18 │    95.3%   │   5.8개  │  ✅  │    │
│  └────────────────────────────────────────────────┘    │
│                                                          │
└─────────────────────────────────────────────────────────┘
```

---

## 구현 로드맵

### Phase 1: 데이터베이스 및 로깅 (1주)
- [ ] `crawl_runs` 테이블 생성
- [ ] `crawl_batch_results` 테이블 생성
- [ ] `url_health_metrics` 테이블 생성
- [ ] GitHub Actions에서 크롤링 로그 저장 로직 추가
- [ ] 배치별 결과 저장 API 개발

### Phase 2: 모니터링 API (1주)
- [ ] `GET /api/subsidy-crawler/runs` API 개발
- [ ] `GET /api/subsidy-crawler/runs/:runId` API 개발
- [ ] `GET /api/subsidy-crawler/url-health` API 개발
- [ ] 통계 계산 로직 구현

### Phase 3: Gemini AI 검증 (2주)
- [ ] `ai_verification_log` 테이블 생성
- [ ] Gemini API 연동 (`lib/ai/gemini-verification.ts`)
- [ ] AI 검증 프롬프트 최적화
- [ ] `POST /api/subsidy-crawler/ai-verification/batch` API 개발
- [ ] `GET /api/subsidy-crawler/ai-verification/stats` API 개발
- [ ] GitHub Actions에 AI 검증 단계 추가

### Phase 4: 모니터링 UI (2주)
- [ ] 크롤링 대시보드 컴포넌트 (`CrawlDashboard.tsx`)
- [ ] 크롤링 상세 페이지 (`CrawlRunDetail.tsx`)
- [ ] URL 건강도 모니터링 (`UrlHealthMonitor.tsx`)
- [ ] AI 검증 불일치 리뷰 페이지 (`AiVerificationReview.tsx`)
- [ ] 차트 및 시각화 (Recharts)

### Phase 5: 알림 및 자동화 (1주)
- [ ] Slack 알림 개선 (AI 검증 결과 포함)
- [ ] 문제 URL 자동 비활성화
- [ ] 주간 리포트 자동 생성
- [ ] 대시보드 실시간 업데이트

---

## 기술 스택

### Backend
- **언어**: TypeScript
- **프레임워크**: Next.js 14 API Routes
- **데이터베이스**: PostgreSQL (Supabase)
- **AI**: Google Gemini 1.5 Flash

### Frontend
- **프레임워크**: React 18 + Next.js 14
- **UI 라이브러리**: Tailwind CSS, Lucide Icons
- **차트**: Recharts
- **상태 관리**: React Hooks

### 인프라
- **크롤링**: GitHub Actions
- **배포**: Vercel
- **스토리지**: Supabase

---

## 예상 비용

### Gemini API (Flash 1.5)
- **가격**: $0.075 / 1M input tokens, $0.30 / 1M output tokens
- **예상 사용량**:
  - 공고당 평균: 500 input tokens + 200 output tokens
  - 주간 크롤링: 약 100개 공고
  - 월간: 400개 공고
- **월 예상 비용**:
  - Input: 400 × 500 = 200K tokens → $0.015
  - Output: 400 × 200 = 80K tokens → $0.024
  - **총: ~$0.04/월** (매우 저렴!)

### Supabase Storage
- 추가 테이블 4개 (용량 증가 미미)
- **월 예상 비용**: 무료 티어 내 충분

---

## 결론

이 시스템을 구현하면:
1. ✅ **완벽한 크롤링 모니터링**: 언제, 얼마나, 어떤 결과
2. ✅ **AI 기반 고도화**: Gemini로 관련성 재검증
3. ✅ **URL 건강도 관리**: 문제 URL 조기 발견
4. ✅ **데이터 기반 의사결정**: 통계로 크롤링 전략 최적화

**비용은 거의 무료** (월 $0.04)이면서 **품질은 크게 향상**됩니다! 🎯
