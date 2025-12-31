# Subsidy Crawler Monitoring System - Implementation Status

## 완료된 작업 (Phase 1 & 2)

### ✅ 데이터베이스 스키마 (Phase 1)

**파일**: [sql/subsidy_crawler_monitoring.sql](../sql/subsidy_crawler_monitoring.sql)

생성된 테이블:
- ✅ `crawl_runs` - 크롤링 실행 기록 추적
- ✅ `crawl_batch_results` - 22개 배치 각각의 상세 결과
- ✅ `ai_verification_log` - Gemini AI 검증 로그
- ✅ `url_health_metrics` - 230개 URL의 건강도 메트릭

생성된 뷰:
- ✅ `vw_recent_crawl_runs` - 최근 크롤링 실행 요약 (통계 계산 포함)
- ✅ `vw_url_health_summary` - URL 건강도 요약
- ✅ `vw_ai_disagreements` - 키워드/AI 불일치 추적

추가 기능:
- ✅ 자동 `updated_at` 트리거
- ✅ Row Level Security (RLS) 정책
- ✅ Generated columns (success_rate, relevance_rate, is_healthy, disagreement)

### ✅ TypeScript 타입 정의 (Phase 1)

**파일**: [types/index.ts](../types/index.ts)

추가된 인터페이스:
- ✅ `CrawlRun` - 크롤링 실행 타입
- ✅ `CrawlBatchResult` - 배치 결과 타입
- ✅ `AiVerificationLog` - AI 검증 로그 타입
- ✅ `UrlHealthMetric` - URL 건강도 타입
- ✅ `RecentCrawlRunView` - 실행 요약 뷰 타입
- ✅ `UrlHealthSummaryView` - 건강도 요약 뷰 타입
- ✅ `AiDisagreementView` - 불일치 뷰 타입

### ✅ 모니터링 API 엔드포인트 (Phase 2)

#### 1. 크롤링 실행 관리

**파일**: [app/api/subsidy-crawler/runs/route.ts](../app/api/subsidy-crawler/runs/route.ts)

- ✅ `GET /api/subsidy-crawler/runs` - 크롤링 실행 목록 조회
  - 페이지네이션 지원 (limit, offset)
  - 필터링 (status, trigger_type)
  - 집계 통계 (평균 성공률, 관련도, AI 검증률)
- ✅ `POST /api/subsidy-crawler/runs` - 새 크롤링 실행 생성

#### 2. 실행 상세 정보

**파일**: [app/api/subsidy-crawler/runs/[runId]/route.ts](../app/api/subsidy-crawler/runs/[runId]/route.ts)

- ✅ `GET /api/subsidy-crawler/runs/[runId]` - 특정 실행 상세 조회
  - 실행 요약
  - 22개 배치 상세 결과
  - AI 검증 요약
- ✅ `PATCH /api/subsidy-crawler/runs/[runId]` - 실행 상태 업데이트

#### 3. URL 건강도 모니터링

**파일**: [app/api/subsidy-crawler/url-health/route.ts](../app/api/subsidy-crawler/url-health/route.ts)

- ✅ `GET /api/subsidy-crawler/url-health` - URL 건강도 조회
  - 문제 URL 우선 정렬 (is_healthy=false first)
  - unhealthy_only 필터
  - 건강도 통계 (평균 성공률, 위험 URL 수)
- ✅ `POST /api/subsidy-crawler/url-health` - 건강도 메트릭 업데이트

#### 4. 배치 결과 로깅

**파일**: [app/api/subsidy-crawler/batches/route.ts](../app/api/subsidy-crawler/batches/route.ts)

- ✅ `POST /api/subsidy-crawler/batches` - 배치 결과 로깅
  - Upsert 방식 (중복 시 업데이트)

#### 5. AI 검증 시스템

**파일**: [app/api/subsidy-crawler/ai-verification/log/route.ts](../app/api/subsidy-crawler/ai-verification/log/route.ts)

- ✅ `POST /api/subsidy-crawler/ai-verification/log` - AI 검증 결과 로깅

**파일**: [app/api/subsidy-crawler/ai-verification/stats/route.ts](../app/api/subsidy-crawler/ai-verification/stats/route.ts)

- ✅ `GET /api/subsidy-crawler/ai-verification/stats` - AI 검증 통계
  - 전체 통계 (검증 수, 관련/무관 수)
  - 불일치 통계 (키워드만, AI만, 일치)
  - 평균 신뢰도, 토큰 사용량, 비용
  - 최근 불일치 사례

### ✅ Gemini AI 검증 라이브러리 (Phase 2)

**파일**: [lib/ai/gemini-verification.ts](../lib/ai/gemini-verification.ts)

구현된 기능:
- ✅ `verifyAnnouncementWithGemini()` - 단일 공고 AI 검증
- ✅ `batchVerifyAnnouncements()` - 다중 공고 배치 검증
- ✅ `summarizeVerificationResults()` - 검증 결과 요약

주요 특징:
- ✅ Gemini 1.5 Flash 사용 (비용 효율적)
- ✅ 한국어 시스템 프롬프트
- ✅ IoT 관련 판단 기준 명시
- ✅ JSON 구조화된 응답 파싱
- ✅ 토큰 사용량 추정
- ✅ API 비용 계산 (~$0.04/month)
- ✅ Rate limiting 고려 (배치 간 100ms 딜레이)

## 필요한 설정

### 1. 데이터베이스 설정 ⚙️

```bash
# Supabase SQL Editor에서 실행
sql/subsidy_crawler_monitoring.sql
```

### 2. 환경 변수 설정 ⚙️

`.env.local`에 추가:

```env
# Google Gemini API Key
GEMINI_API_KEY=your_gemini_api_key_here
```

**API 키 발급**: https://ai.google.dev/

### 3. NPM 패키지 설치 ⚙️

```bash
npm install @google/generative-ai
```

## 다음 단계 (Phase 3-5)

### 🔄 Phase 3: GitHub Actions 통합

**목표**: 크롤링 실행 시 자동으로 모니터링 데이터 기록

작업 내용:
- [ ] `.github/workflows/subsidy-crawler-direct.yml` 수정
  - [ ] 크롤링 시작 시 `POST /api/subsidy-crawler/runs` 호출
  - [ ] 각 배치 완료 시 `POST /api/subsidy-crawler/batches` 호출
  - [ ] 실행 완료 시 `PATCH /api/subsidy-crawler/runs/[runId]` 호출
- [ ] 환경 변수 추가 (VERCEL_URL, RUN_ID 전파)

**예상 시간**: 1-2시간

### 🔄 Phase 4: 크롤러 API AI 검증 통합

**목표**: 기존 크롤러에 AI 검증 추가

작업 내용:
- [ ] `app/api/subsidy-crawler/direct/route.ts` 수정
  - [ ] Gemini 검증 함수 import
  - [ ] 각 공고에 대해 AI 검증 실행
  - [ ] 검증 결과 로깅 (`POST /ai-verification/log`)
  - [ ] 키워드 + AI 모두 관련있을 때만 최종 포함
- [ ] Vercel timeout 고려 (10초 제한)
  - [ ] 배치당 공고 수 제한
  - [ ] AI 검증 병렬 처리 또는 선택적 실행

**예상 시간**: 2-3시간

### 🔄 Phase 5: 모니터링 UI 개발

**목표**: 관리자 페이지에서 모니터링 데이터 시각화

작업 내용:

#### 1. 크롤링 대시보드
- [ ] `app/admin/subsidy/monitoring/page.tsx` 생성
  - [ ] 최근 실행 목록
  - [ ] 실행별 성공률, 관련도, AI 검증률 표시
  - [ ] 상태별 색상 코딩 (running=파랑, completed=초록, failed=빨강)

#### 2. 실행 상세 뷰
- [ ] `app/admin/subsidy/monitoring/[runId]/page.tsx` 생성
  - [ ] 배치별 상세 결과 테이블
  - [ ] AI 검증 요약
  - [ ] 불일치 사례 표시

#### 3. URL 건강도 모니터
- [ ] `app/admin/subsidy/url-health/page.tsx` 생성
  - [ ] URL별 건강도 테이블
  - [ ] 문제 URL 강조 (is_healthy=false)
  - [ ] 연속 실패 경고 (consecutive_failures >= 3)

#### 4. AI 불일치 리뷰
- [ ] `app/admin/subsidy/ai-disagreements/page.tsx` 생성
  - [ ] 키워드만 매칭된 경우
  - [ ] AI만 관련있다고 판단한 경우
  - [ ] 각 사례별 상세 정보 (reasoning 표시)

**예상 시간**: 4-6시간

## 참고 문서

- [설계 문서](./subsidy-crawler-monitoring-design.md) - 전체 시스템 아키텍처
- [설정 가이드](./subsidy-crawler-monitoring-setup.md) - 상세 설정 및 사용법

## 비용 예상

### 월간 예상 비용

**Gemini API** (gemini-1.5-flash):
- 주당 공고 수: ~50개
- 월간 토큰: ~100,000 tokens
- **비용**: ~$0.04/month (~40원)

**Supabase**:
- 무료 플랜 충분 (500MB 데이터베이스)
- 추가 비용 없음

**총 비용**: ~$0.04/month

## 핵심 성과

### 질문 1: 어떤 스케줄로 크롤링하나?
✅ **답변 가능**: `crawl_runs` 테이블에서 `started_at`, `trigger_type` 조회

### 질문 2: 크롤링 결과가 몇 개인가?
✅ **답변 가능**: `total_announcements`, `new_announcements` 필드로 추적

### 질문 3: 유의미한 결과가 몇 개인가?
✅ **답변 가능**:
- `relevant_announcements` - 키워드 매칭
- `ai_verified_announcements` - AI 검증
- 불일치 추적으로 정확도 개선

### 질문 4: Gemini AI 검증 가능한가?
✅ **구현 완료**:
- Gemini 1.5 Flash 통합
- 한국어 IoT 공고 판단 프롬프트
- 비용 효율적 (~$0.04/month)
- 키워드와 AI 불일치 추적

## 다음 작업

1. **즉시**: 데이터베이스 스키마 실행 및 Gemini API 키 설정
2. **Phase 3**: GitHub Actions 워크플로우 통합
3. **Phase 4**: 크롤러 API에 AI 검증 추가
4. **Phase 5**: 모니터링 UI 개발

**총 예상 시간**: 7-11시간
