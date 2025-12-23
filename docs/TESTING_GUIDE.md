# GitHub Actions 크롤링 워크플로우 테스트 가이드

## 개요
이 문서는 직접 URL 크롤링 GitHub Actions 워크플로우의 테스트 및 배포 가이드입니다.

---

## 사전 준비 (필수)

### 1. GitHub Secrets 설정

**GitHub Repository Settings → Secrets and variables → Actions**

#### 필수 Secrets
```
CRAWLER_SECRET
├─ 값: 7r7VQkjb734CNIyqryJrDz9GtmtfRs0dQHrd74bVG00=
└─ 설명: 크롤러 API 인증 토큰 (.env.local의 CRAWLER_SECRET)

API_BASE_URL (선택, 기본값 있음)
├─ 값: https://facility.blueon-iot.com
└─ 설명: 프로덕션 API URL
```

#### 선택 Secrets (알림 활성화 시)
```
SLACK_WEBHOOK_URL
├─ 값: https://hooks.slack.com/services/YOUR/WEBHOOK/URL
└─ 설명: Slack 알림용 웹훅 URL
```

### 2. Supabase 데이터 준비

#### 211개 URL CSV 임포트
```sql
-- 1. CSV 파일 준비 (data/direct_urls.csv)
-- 2. Supabase Table Editor에서 direct_url_sources 테이블 열기
-- 3. "Insert" → "Import data from CSV" 선택
-- 4. CSV 파일 업로드

-- 또는 SQL로 임포트:
COPY direct_url_sources(url, region_code, region_name, category, notes)
FROM '/path/to/direct_urls.csv'
DELIMITER ','
CSV HEADER;
```

#### 데이터 검증
```sql
-- URL 개수 확인
SELECT COUNT(*) FROM direct_url_sources;
-- 예상: 211개

-- 활성 URL 확인
SELECT COUNT(*) FROM direct_url_sources WHERE is_active = true;
-- 예상: 211개

-- 카테고리별 분포 확인
SELECT category, COUNT(*)
FROM direct_url_sources
GROUP BY category;
```

---

## Phase 3.2: 소규모 테스트 (배치 1만 실행)

### 목적
- 워크플로우 구조 검증
- API 연동 확인
- Secrets 설정 확인
- 데이터베이스 기록 확인

### 실행 방법

#### 1. GitHub Actions 접속
1. GitHub Repository 페이지 이동
2. 상단 탭에서 **"Actions"** 클릭
3. 왼쪽 사이드바에서 **"Direct URL Subsidy Crawler"** 선택

#### 2. 수동 실행 (Workflow Dispatch)
1. 오른쪽 상단 **"Run workflow"** 버튼 클릭
2. 드롭다운에서 다음 입력:
   ```
   Use workflow from: main
   batch_number: 1
   retry_failed: false
   ```
3. **"Run workflow"** 클릭

#### 3. 실행 모니터링
- Workflow 실행 상태 확인 (⚪ Queued → 🟡 In progress → 🟢 Success)
- 각 Job 클릭하여 로그 확인:
  - `준비 및 상태 확인`
  - `배치 1 크롤링`
  - `결과 집계 및 알림`

### 검증 체크리스트

#### ✅ Workflow 실행
- [ ] Workflow가 정상적으로 시작됨
- [ ] Secrets가 정상적으로 주입됨 (401 Unauthorized 없음)
- [ ] 3개 Jobs 모두 성공 (🟢 Success)

#### ✅ API 연동
```bash
# 준비 Job에서 확인할 로그:
📡 직접 URL 크롤러 상태 확인 중...
📥 응답: {"success": true, "total_urls": 211, ...}
✅ 크롤링 대상 URL: 211개
📦 배치 수: 22개
```

#### ✅ 배치 1 크롤링
```bash
# 배치 1 Job에서 확인할 로그:
🤖 [배치 1/22] 크롤링 시작 (최대 10개 URL)
📍 Offset: 0, Limit: 10
📥 배치 1 URL 수: 10개
✅ 배치 1 완료: 신규 N건, 관련 M건
📊 성공: X개 URL, 실패: Y개 URL
```

#### ✅ 데이터베이스 기록
**Supabase SQL Editor에서 확인**:

```sql
-- 1. crawl_logs 테이블 확인
SELECT *
FROM crawl_logs
WHERE crawl_type = 'direct'
ORDER BY started_at DESC
LIMIT 1;
-- 확인: completed_at, successful_urls, new_announcements 등

-- 2. direct_url_sources 업데이트 확인
SELECT url, last_crawled_at, total_attempts, total_successes, consecutive_failures
FROM direct_url_sources
WHERE last_crawled_at IS NOT NULL
ORDER BY last_crawled_at DESC
LIMIT 10;
-- 확인: 10개 URL이 업데이트됨

-- 3. subsidy_announcements 저장 확인
SELECT COUNT(*)
FROM subsidy_announcements
WHERE crawled_at >= NOW() - INTERVAL '1 hour';
-- 확인: 신규 공고 개수
```

#### ✅ 통계 API
```bash
# 터미널에서 확인:
curl -s "https://facility.blueon-iot.com/api/subsidy-crawler/stats" | jq '.stats.direct_crawl_stats'

# 응답 예시:
{
  "total_runs": 1,
  "total_successful": X,
  "total_failed": Y,
  "avg_success_rate": Z.Z,
  "total_new_announcements": N,
  "total_relevant_announcements": M
}
```

### 문제 해결

#### ❌ 401 Unauthorized
**증상**: API 호출 시 "Unauthorized" 응답

**원인**: CRAWLER_SECRET 미설정 또는 잘못된 값

**해결**:
1. GitHub Repository Settings → Secrets 확인
2. `.env.local`의 CRAWLER_SECRET 값과 일치하는지 확인
3. Secret 재설정 후 워크플로우 다시 실행

#### ❌ No URLs to process
**증상**: "No URLs to process" 에러

**원인**: direct_url_sources 테이블에 데이터 없음

**해결**:
1. Supabase에서 direct_url_sources 테이블 확인
2. CSV 임포트 또는 수동 INSERT
3. 워크플로우 다시 실행

#### ❌ API Timeout
**증상**: API 호출이 10초 이내 완료되지 않음

**원인**:
- 네트워크 지연
- URL 응답 느림
- 배치 크기 너무 큼

**해결**:
1. `app/api/subsidy-crawler/direct/route.ts` 확인
2. `crawlDirectUrl()` 타임아웃 8초로 설정되어 있는지 확인
3. 필요 시 배치 크기 감소 (10 → 5)

---

## Phase 3.3: 전체 테스트 (211개 URL)

### 목적
- 전체 시스템 안정성 검증
- 배치 병렬 처리 확인
- 재시도 메커니즘 검증
- 성공률 측정
- Slack 알림 확인

### 실행 방법

#### 방법 1: 자동 스케줄 실행 (권장)
- 매주 **일요일 21:00 KST** 자동 실행
- 다음 일요일까지 대기

#### 방법 2: 수동 전체 실행
1. GitHub Actions → "Direct URL Subsidy Crawler"
2. "Run workflow" 클릭
3. 입력:
   ```
   batch_number: (비움)
   retry_failed: false
   ```
4. "Run workflow" 실행

### 실행 모니터링

#### 실시간 모니터링
```bash
# GitHub Actions 페이지에서 확인:
- 준비 및 상태 확인 (🟢)
- 배치 1 크롤링 (🟡) → (🟢)
- 배치 2 크롤링 (🟡) → (🟢)
- 배치 3 크롤링 (🟡) → (🟢)
- 배치 4 크롤링 (⚪) → (🟡) → (🟢)
  ...
- 배치 22 크롤링 (⚪) → (🟡) → (🟢)
- 결과 집계 및 알림 (🟢)

# 예상 실행 시간: ~15분 (3 parallel batches)
```

#### Slack 알림 확인
**관련 공고 발견 시**:
```
🚨 직접 URL 보조금 공고 알림
새로운 IoT 지원사업 관련 공고 N건이 발견되었습니다.
📦 배치 크롤링: 22개 배치 완료
📈 성공률: X.X%
👉 확인하기: https://facility.blueon-iot.com/admin/subsidy
```

**문제 URL 다수 발견 시**:
```
⚠️ 직접 URL 크롤링 문제 알림
문제가 있는 URL이 N개 발견되었습니다.
👉 확인 및 조치 필요: https://facility.blueon-iot.com/admin/subsidy
```

### 검증 체크리스트

#### ✅ 전체 실행
- [ ] 22개 배치 모두 실행됨
- [ ] 병렬 실행 확인 (최대 3개 동시)
- [ ] 모든 배치 성공 또는 재시도 성공
- [ ] 전체 실행 시간 < 20분

#### ✅ 크롤링 성과
```sql
-- 최종 통계 확인
SELECT * FROM crawl_stats_recent WHERE crawl_type = 'direct';

-- 확인 항목:
total_runs          -- 1 이상
total_successful    -- 200+ (목표: 211의 95%+)
total_failed        -- 10 이하
avg_success_rate    -- 95%+
total_new_announcements
total_relevant_announcements
```

#### ✅ URL 소스 업데이트
```sql
-- 전체 URL 크롤링 여부 확인
SELECT
  COUNT(*) as total_urls,
  COUNT(CASE WHEN last_crawled_at IS NOT NULL THEN 1 END) as crawled_urls,
  COUNT(CASE WHEN consecutive_failures >= 5 AND is_active = false THEN 1 END) as circuit_broken_urls
FROM direct_url_sources;

-- 예상 결과:
-- total_urls: 211
-- crawled_urls: 211 (100%)
-- circuit_broken_urls: < 10 (5% 미만)
```

#### ✅ 문제 URL 확인
```sql
-- 문제 URL 목록
SELECT * FROM problem_urls
ORDER BY consecutive_failures DESC
LIMIT 20;

-- Circuit Breaker 발동 확인
SELECT url, consecutive_failures, last_error, is_active
FROM direct_url_sources
WHERE consecutive_failures >= 5
ORDER BY consecutive_failures DESC;
```

#### ✅ Slack 알림
- [ ] 관련 공고 알림 수신 (관련 공고 > 0일 때)
- [ ] 문제 URL 알림 수신 (문제 URL ≥ 10개일 때)
- [ ] 알림 내용 정확성 확인

---

## 성능 최적화

### 배치 크기 조정
현재: 10 URLs/batch → 필요 시 변경

**`.github/workflows/subsidy-crawler-direct.yml`**:
```yaml
env:
  BATCH_SIZE: 10  # 5 또는 15로 변경 가능
```

**주의**: 배치 크기 변경 시 Matrix 개수도 조정 필요
- 5 URLs/batch → 43 batches
- 15 URLs/batch → 15 batches

### 병렬 실행 수 조정
현재: max 3 parallel → 필요 시 변경

```yaml
strategy:
  max-parallel: 3  # 1, 2, 5 등으로 변경 가능
```

**권장**:
- `max-parallel: 1` - 순차 실행 (안정성 우선)
- `max-parallel: 3` - 균형 (기본값)
- `max-parallel: 5` - 속도 우선 (리소스 주의)

### 스케줄 조정
현재: 매주 일요일 21:00 KST

```yaml
schedule:
  - cron: '0 12 * * 0'   # 일요일 12:00 UTC = 21:00 KST

# 변경 예시:
# - cron: '0 12 * * 1'   # 매주 월요일 21:00 KST
# - cron: '0 12 1,15 * *' # 매월 1일, 15일 21:00 KST
```

---

## 문제 해결

### 공통 문제

#### 1. 배치 실패 반복
**증상**: 특정 배치가 계속 실패

**원인**:
- 특정 URL들이 타임아웃 또는 오류
- 네트워크 일시적 문제

**해결**:
1. 실패한 배치 번호 확인
2. 수동으로 해당 배치만 재실행:
   ```
   batch_number: [실패한 배치 번호]
   retry_failed: true
   ```
3. 여전히 실패 시 problem_urls 확인
4. Circuit Breaker 작동 확인 (5회 실패 시 자동 비활성화)

#### 2. 전체 실행 시간 초과
**증상**: 전체 실행이 30분 이상 소요

**원인**:
- 배치당 실행 시간 증가
- 재시도 많음
- 병렬 실행 수 적음

**해결**:
1. `max-parallel` 증가 (3 → 5)
2. 배치 크기 감소 (10 → 5)
3. 타임아웃 설정 확인 (8초)

#### 3. Slack 알림 없음
**증상**: 관련 공고가 있는데 알림 없음

**원인**:
- SLACK_WEBHOOK_URL 미설정
- 웹훅 URL 잘못됨
- Slack 앱 권한 문제

**해결**:
1. GitHub Secrets에서 SLACK_WEBHOOK_URL 확인
2. Slack에서 웹훅 URL 재생성
3. 워크플로우 로그에서 알림 발송 확인

---

## 유지보수

### 주간 점검 사항
- [ ] 성공률 확인 (목표: 95%+)
- [ ] problem_urls 확인 및 조치
- [ ] Circuit Breaker 발동 URL 검토
- [ ] 신규 관련 공고 확인

### 월간 점검 사항
- [ ] 전체 URL 유효성 검토
- [ ] 비활성화된 URL 재활성화 검토
- [ ] 새로운 URL 추가
- [ ] 성능 지표 분석

### 데이터베이스 정리
```sql
-- 6개월 이상 된 크롤링 로그 삭제
DELETE FROM crawl_logs
WHERE started_at < NOW() - INTERVAL '6 months'
AND crawl_type = 'direct';

-- 비활성화된 URL 통계 초기화 (선택)
UPDATE direct_url_sources
SET
  consecutive_failures = 0,
  is_active = true
WHERE is_active = false
AND last_crawled_at < NOW() - INTERVAL '1 month';
```

---

## 다음 단계: Phase 4

Phase 3.3 전체 테스트 성공 후:
1. **모니터링 대시보드** 구축 (`app/admin/subsidy/page.tsx`)
2. **URL 수동 등록 폼** 추가
3. **실패 URL 재시도 UI** 구현

**참고 문서**:
- `docs/crawling-implementation-progress.md` - 전체 진행 상황
- `docs/PHASE3_SUMMARY.md` - Phase 3 요약
- `docs/API_TEST_RESULTS.md` - API 테스트 결과
