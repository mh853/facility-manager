# Phase 3: GitHub Actions 워크플로우 완료 요약

## 완료 일시
- **시작**: 2025-12-23 00:30 KST
- **완료**: 2025-12-23 00:45 KST
- **소요 시간**: 15분

---

## 구현 내용

### 생성된 파일
✅ `.github/workflows/subsidy-crawler-direct.yml` - 직접 URL 크롤링 GitHub Actions 워크플로우

---

## 워크플로우 설계

### 실행 스케줄
- **자동 실행**: 매주 일요일 21:00 KST (12:00 UTC)
- **수동 실행**: GitHub Actions UI에서 workflow_dispatch
  - `batch_number`: 특정 배치 번호 지정 (1-22)
  - `retry_failed`: 실패한 URL만 재시도

### 3-Job 구조

#### Job 1: 준비 및 상태 확인 (prepare)
**목적**: 크롤링 대상 확인 및 배치 수 계산

```yaml
steps:
  - 현재 시간 표시 (KST)
  - 크롤러 상태 확인 (GET /api/subsidy-crawler/direct?limit=211)
  - 배치 수 계산 (211 URLs ÷ 10 = 22 batches)
  - 통계 조회 (GET /api/subsidy-crawler/stats)
```

**출력**:
- `total_urls`: 크롤링 대상 URL 총 개수
- `total_batches`: 배치 총 개수 (22개)

---

#### Job 2: 배치 크롤링 (crawl) - Matrix Strategy
**목적**: 211개 URL을 22개 배치로 나누어 병렬 크롤링

**Matrix 전략**:
```yaml
strategy:
  max-parallel: 3      # 동시 실행 배치 수
  fail-fast: false     # 하나 실패해도 계속 진행
  matrix:
    batch: [1, 2, 3, ..., 22]  # 22개 배치
```

**각 배치 실행 흐름**:
1. **URL 가져오기**:
   - API 호출로 배치별 URL 목록 획득
   - Offset 계산: `(batch - 1) * 10`

2. **크롤링 실행**:
   ```bash
   POST /api/subsidy-crawler/direct
   {
     "direct_mode": true,
     "urls": ["url1", "url2", ..., "url10"]
   }
   ```

3. **재시도 메커니즘**:
   - 실패 시 10초 대기 후 재시도
   - `retry_failed=true` 옵션으로 실패 URL만 재시도

4. **결과 로그**:
   - 성공 여부
   - 신규 공고 수
   - 관련 공고 수
   - 성공/실패 URL 수

---

#### Job 3: 결과 집계 및 알림 (summary)
**목적**: 전체 크롤링 결과 집계 및 Slack 알림

**단계**:

1. **최종 통계 조회**:
   ```bash
   GET /api/subsidy-crawler/stats?details=true&problems=true
   ```

2. **관련 공고 알림** (관련 공고 > 0일 때):
   ```json
   {
     "text": "🚨 직접 URL 보조금 공고 알림\n새로운 IoT 지원사업 관련 공고 N건이 발견되었습니다."
   }
   ```

3. **실행 요약**:
   - 완료 시각
   - 크롤링 대상 URL 수
   - 배치 수
   - 신규/관련 공고 수
   - 성공률

4. **문제 URL 알림** (문제 URL ≥ 10개일 때):
   ```json
   {
     "text": "⚠️ 직접 URL 크롤링 문제 알림\n문제가 있는 URL이 N개 발견되었습니다."
   }
   ```

---

## 핵심 기능

### 1. 배치 처리 (Batch Processing)
- **배치 크기**: 10 URLs/batch
- **총 배치**: 22 batches (211 URLs)
- **병렬 실행**: 최대 3 batches 동시 실행
- **예상 실행 시간**: ~15분 (22 batches ÷ 3 parallel × 2초/batch)

### 2. 재시도 메커니즘 (Retry Mechanism)
- **1차 시도**: API 호출 실패 시
- **2차 시도**: 10초 대기 후 재시도
- **Circuit Breaker**: 5회 연속 실패 시 자동 비활성화 (DB 레벨)

### 3. Slack 알림 (Notifications)
**알림 조건 1**: 관련 공고 발견
- 조건: `relevant_count > 0`
- 내용: 신규 관련 공고 수, 성공률, 확인 링크

**알림 조건 2**: 문제 URL 다수 발견
- 조건: `problem_count >= 10`
- 내용: 문제 URL 수, 조치 필요 링크

### 4. 상세 모니터링
- 배치별 실행 로그
- 성공/실패 URL 추적
- 신규/관련 공고 집계
- 문제 URL 목록 (severity별)

---

## Vercel Hobby 호환성 검증

### ✅ 통과 항목
- **API 타임아웃**: `maxDuration = 10` (10초 제한 준수)
- **배치 크기**: 10 URLs/batch (API 테스트에서 2초 실행 확인)
- **병렬 처리**: API 레벨에서 병렬 크롤링 지원
- **무료 플랜**: GitHub Actions 무료, Vercel Hobby 무료

### 📊 성능 예측
- **단일 배치 실행 시간**: ~2초 (API 테스트 결과)
- **전체 실행 시간**: ~15분 (22 batches, 3 parallel)
- **성공률 목표**: 99%+ (Circuit Breaker + 재시도)

---

## 설정 필요 항목

### GitHub Secrets 설정
Repository Settings → Secrets and variables → Actions → New repository secret

**필수**:
- `CRAWLER_SECRET`: 크롤러 인증 토큰 (`.env.local`의 `CRAWLER_SECRET` 값)
- `API_BASE_URL`: 프로덕션 URL (기본값: `https://facility.blueon-iot.com`)

**선택**:
- `SLACK_WEBHOOK_URL`: Slack 알림용 웹훅 URL

### 설정 방법
```bash
# 1. GitHub Repository Settings 접속
# 2. Settings → Secrets and variables → Actions
# 3. New repository secret 클릭
# 4. 아래 값 입력:

Name: CRAWLER_SECRET
Value: 7r7VQkjb734CNIyqryJrDz9GtmtfRs0dQHrd74bVG00=

Name: API_BASE_URL
Value: https://facility.blueon-iot.com

Name: SLACK_WEBHOOK_URL (선택)
Value: https://hooks.slack.com/services/YOUR/WEBHOOK/URL
```

---

## 테스트 계획

### Phase 3.2: 소규모 테스트 (10개 URL)
**방법**:
1. GitHub Actions 탭 이동
2. "Direct URL Subsidy Crawler" 워크플로우 선택
3. "Run workflow" 클릭
4. `batch_number`: `1` 입력 (첫 번째 배치만 실행)
5. "Run workflow" 실행

**검증 사항**:
- ✅ API 호출 성공
- ✅ URL 크롤링 성공
- ✅ Supabase 저장 확인
- ✅ crawl_logs 기록 확인
- ✅ direct_url_sources 업데이트 확인
- ✅ 통계 정상 집계

### Phase 3.3: 전체 테스트 (211개 URL)
**방법**:
1. **자동 실행**: 일요일 21:00 KST 대기
2. **수동 실행**: GitHub Actions에서 "Run workflow" (batch_number 비움)

**검증 사항**:
- ✅ 22개 배치 모두 실행
- ✅ 병렬 실행 (max 3 batches)
- ✅ 재시도 메커니즘 작동
- ✅ Slack 알림 전송 (관련 공고 발견 시)
- ✅ 전체 실행 시간 < 20분
- ✅ 성공률 ≥ 95%

---

## 다음 단계

### 즉시 실행 가능
1. **Secrets 설정**: GitHub Repository Secrets 설정
2. **소규모 테스트**: 배치 1 수동 실행 및 검증
3. **전체 테스트**: 일요일 21:00 자동 실행 또는 수동 실행

### Phase 4로 진행 전 확인
- [ ] Phase 3.2 소규모 테스트 성공
- [ ] Phase 3.3 전체 테스트 성공
- [ ] 성공률 ≥ 95% 달성
- [ ] Slack 알림 정상 작동
- [ ] 문제 URL Circuit Breaker 작동 확인

---

## 파일 목록

### 생성된 파일
1. ✅ `.github/workflows/subsidy-crawler-direct.yml` - GitHub Actions 워크플로우
2. ✅ `docs/PHASE3_SUMMARY.md` - Phase 3 완료 요약 (이 파일)

### 업데이트된 파일
1. ✅ `docs/crawling-implementation-progress.md` - 진행 상황 업데이트

---

## 기술 스택

### GitHub Actions
- **Matrix Strategy**: 22개 배치 병렬 실행
- **Job Dependencies**: prepare → crawl → summary
- **Conditional Execution**: 실패 시 재시도, 알림 조건부 실행
- **Secrets Management**: 안전한 인증 토큰 관리

### API Integration
- **GET** `/api/subsidy-crawler/direct`: URL 목록 조회
- **POST** `/api/subsidy-crawler/direct`: 크롤링 실행
- **GET** `/api/subsidy-crawler/stats`: 통계 조회

### Monitoring
- **Slack Webhooks**: 실시간 알림
- **GitHub Actions Logs**: 상세 실행 로그
- **Supabase Views**: 통계 대시보드

---

## 성공 지표

### 목표 달성 여부
- ✅ **Vercel Hobby 호환**: 10초 제한 준수
- ✅ **무료 운영**: $0/월 (GitHub Actions + Vercel Hobby)
- ✅ **배치 처리**: 211 URLs → 22 batches (10 URLs/batch)
- ✅ **병렬 실행**: Max 3 batches 동시 실행
- ✅ **재시도 메커니즘**: 3-tier retry (API + Workflow + Circuit Breaker)
- ✅ **자동 스케줄**: 매주 일요일 21:00 KST
- ✅ **알림 시스템**: Slack 통합 (관련 공고, 문제 URL)
- ⏸️ **성공률**: 99%+ (테스트 후 검증)

---

## 참고 문서

- **API 테스트 결과**: `docs/API_TEST_RESULTS.md`
- **진행 상황**: `docs/crawling-implementation-progress.md`
- **기존 워크플로우**: `.github/workflows/subsidy-crawler.yml` (자동 검색 크롤러)
- **SQL 스키마**: `sql/create_crawl_logs_fixed.sql`, `sql/create_direct_url_sources.sql`

---

## Phase 3 완료 ✅

**요약**: GitHub Actions 워크플로우 구현 완료. 211개 직접 URL을 22개 배치로 나누어 주간 자동 크롤링 준비 완료.

**다음 단계**: Secrets 설정 및 소규모 테스트 (Phase 3.2)
