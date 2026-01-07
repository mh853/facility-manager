# GitHub Actions 크롤러 마이그레이션 가이드

## 현재 상황

- ✅ **Repository**: `mhc-projects/facility-manager` (연결 완료)
- ✅ **Workflow 파일**: 3개 크롤러 워크플로우 존재
- 🔴 **GitHub Secrets**: 새 저장소에 설정 필요

## 크롤러 워크플로우 목록

| 파일 | 스케줄 | 설명 |
|------|--------|------|
| `subsidy-crawler-direct.yml` | 매주 월/수/금 21:00 KST | 직접 URL 230개 크롤링 (현재 활성) |
| `subsidy-crawler.yml` | (확인 필요) | 기본 크롤러 |
| `subsidy-crawler-phase2.yml` | (확인 필요) | Phase 2 크롤러 |

## 필수: GitHub Secrets 설정

### 1. GitHub Repository 접속

```
https://github.com/mhc-projects/facility-manager/settings/secrets/actions
```

**경로**: Repository → Settings → Secrets and variables → Actions

### 2. 필수 Secrets 추가

**"New repository secret"** 버튼 클릭 후 다음 3개 추가:

#### Secret 1: CRAWLER_SECRET (필수)

```
Name: CRAWLER_SECRET
Secret: 7r7VQkjb734CNIyqryJrDz9GtmtfRs0dQHrd74bVG00=
```

**용도**: 크롤러 API 인증 토큰

#### Secret 2: API_BASE_URL (선택사항)

```
Name: API_BASE_URL
Secret: https://facility.blueon-iot.com
```

**용도**: 프로덕션 API 엔드포인트 URL (설정 안 하면 워크플로우의 기본값 사용)

#### Secret 3: SLACK_WEBHOOK_URL (선택사항)

```
Name: SLACK_WEBHOOK_URL
Secret: https://hooks.slack.com/services/YOUR/WEBHOOK/URL
```

**용도**: Slack 알림 (없으면 Slack 알림 스킵)

## 검증: Secrets 설정 확인

설정 완료 후 다음 확인:

```
https://github.com/mhc-projects/facility-manager/settings/secrets/actions
```

**Expected**:
- ✅ `CRAWLER_SECRET` - Set (마스킹되어 값 표시 안 됨)
- ✅ `API_BASE_URL` - Set (선택사항)
- ⚠️ `SLACK_WEBHOOK_URL` - Set (선택사항, 없으면 건너뛰기)

## 크롤러 수동 실행 테스트

Secrets 설정 후 **수동 실행**으로 테스트:

### 방법 1: GitHub Actions UI에서 실행

1. **Repository → Actions 탭**
   ```
   https://github.com/mhc-projects/facility-manager/actions
   ```

2. **왼쪽 워크플로우 목록에서 "Direct URL Subsidy Crawler" 선택**

3. **"Run workflow" 버튼 클릭** (오른쪽 상단)
   - Branch: `main` 선택
   - Batch number: 비우기 (전체 실행)
   - Retry failed: `false`

4. **"Run workflow" 녹색 버튼 클릭**

### 방법 2: GitHub CLI 사용 (선택사항)

```bash
gh workflow run "Direct URL Subsidy Crawler" \
  --repo mhc-projects/facility-manager \
  --ref main
```

## 실행 결과 확인

### 1. GitHub Actions 로그

```
https://github.com/mhc-projects/facility-manager/actions
```

**Expected**:
- ✅ 워크플로우 상태: 🟢 Success (초록색)
- ✅ 3개 Job 모두 성공: prepare → crawl → summary
- ✅ 22개 배치 모두 완료

### 2. Supabase 데이터 확인

**crawl_runs 테이블 조회**:

```sql
SELECT run_id, status, total_urls_crawled, successful_urls, total_announcements
FROM crawl_runs
ORDER BY started_at DESC
LIMIT 5;
```

**Expected**:
- ✅ 새로운 `run_id` 생성 (예: `run_2025-01-07_12:00`)
- ✅ `status`: `completed`
- ✅ `total_urls_crawled`: 211
- ✅ `successful_urls` > 0

### 3. 모니터링 대시보드 확인

```
https://facility.blueon-iot.com/admin/subsidy/monitoring-dashboard
```

**Expected**:
- ✅ "크롤링 실행" 탭에 새로운 실행 기록 표시
- ✅ 배치 수: 22개 완료
- ✅ URL 성공률 표시

## 스케줄 실행 확인

### 크롤러 스케줄

**Direct URL Crawler**:
- ⏰ **매주 월/수/금 21:00 KST** (자동 실행)
- 📅 **다음 실행**: 다음 월/수/금 21:00

### 스케줄 변경 (선택사항)

스케줄을 변경하려면 워크플로우 파일 수정:

```yaml
# .github/workflows/subsidy-crawler-direct.yml
on:
  schedule:
    - cron: '0 12 * * 1,3,5'   # 매주 월/수/금 12:00 UTC = 21:00 KST
```

**Cron 표현식 예시**:
```
'0 12 * * *'       # 매일 21:00 KST
'0 12 * * 1-5'     # 평일 21:00 KST
'0 3,12 * * *'     # 매일 12:00, 21:00 KST
```

변경 후 커밋하면 자동 반영됩니다.

## 문제 해결

### 에러 1: "Secret not found"

```
Error: Secret CRAWLER_SECRET doesn't exist
```

**해결**: GitHub Secrets에 `CRAWLER_SECRET` 추가

### 에러 2: "401 Unauthorized"

```
Error fetching crawl runs: 401 Unauthorized
```

**해결**: `CRAWLER_SECRET` 값이 `.env.local`과 일치하는지 확인

### 에러 3: "404 Not Found"

```
Error: https://facility.blueon-iot.com/api/subsidy-crawler/runs 404
```

**해결**:
1. API 엔드포인트 확인 (개발 서버 실행 중?)
2. Vercel 배포 확인 (프로덕션 환경)

### 에러 4: "permission denied for schema public"

```
Error: permission denied for schema public (42501)
```

**해결**: Supabase에서 스키마 권한 SQL 실행 (이미 해결됨)

## API 엔드포인트 목록

크롤러가 호출하는 API:

| Endpoint | Method | 용도 |
|----------|--------|------|
| `/api/subsidy-crawler/runs` | POST | 크롤링 실행 기록 생성 |
| `/api/subsidy-crawler/runs/:run_id` | PATCH | 실행 상태 업데이트 |
| `/api/subsidy-crawler/direct` | GET | 크롤링 대상 URL 조회 |
| `/api/subsidy-crawler/direct` | POST | 직접 URL 크롤링 실행 |
| `/api/subsidy-crawler/batches` | POST | 배치 결과 로깅 |
| `/api/subsidy-crawler/stats` | GET | 통계 조회 |

모든 엔드포인트는 `Authorization: Bearer {CRAWLER_SECRET}` 필수

## 워크플로우 비활성화 (필요 시)

특정 워크플로우를 비활성화하려면:

1. **Repository → Actions 탭**
2. **왼쪽에서 워크플로우 선택**
3. **오른쪽 상단 "..." 메뉴 → "Disable workflow"**

## 모니터링 및 알림

### Slack 알림 설정 (선택사항)

Slack에서 Incoming Webhook 생성:
1. https://api.slack.com/apps → "Create New App"
2. "Incoming Webhooks" 활성화
3. Webhook URL 복사 → GitHub Secrets에 `SLACK_WEBHOOK_URL` 추가

**알림 조건**:
- ✅ 관련 공고 발견 시 (relevant_count > 0)
- ⚠️ 문제 URL 10개 이상 발견 시

### 이메일 알림

GitHub Actions는 기본적으로 실패 시 이메일 전송:
- Repository → Settings → Notifications에서 설정 가능

## 완료 체크리스트

- [ ] GitHub Secrets 설정 완료 (`CRAWLER_SECRET` 필수)
- [ ] 수동 실행 테스트 성공
- [ ] Supabase에서 실행 기록 확인
- [ ] 모니터링 대시보드에서 결과 확인
- [ ] 스케줄 실행 확인 (다음 월/수/금 21:00 대기)
- [ ] Slack 알림 설정 (선택사항)

## 요약

**필수 작업**: GitHub Secrets에 `CRAWLER_SECRET` 추가
**검증 방법**: 수동 실행 → 대시보드 확인
**자동 실행**: 매주 월/수/금 21:00 KST

모든 설정 완료 후 크롤러는 자동으로 실행됩니다! 🚀
