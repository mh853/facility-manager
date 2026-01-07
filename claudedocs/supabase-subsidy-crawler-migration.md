# Supabase 마이그레이션 - 보조금 크롤러 테이블 생성

## 문제 상황

**Error Code**: `42501` - permission denied for schema public
**Endpoint**: `/api/subsidy-crawler/runs`
**Root Cause**: 새로운 Supabase 프로젝트에 보조금 크롤러 관련 테이블이 생성되지 않음

## 영향받는 페이지

- `/admin/subsidy/monitoring-dashboard` - 크롤링 모니터링 대시보드
- 크롤링 실행, 지자체별 통계, URL 건강도 모든 탭 비활성화

## 필요한 SQL 마이그레이션 (실행 순서)

### 1단계: 기본 테이블 생성 (direct_url_sources)

**파일**: `sql/create_direct_url_sources.sql`

이 테이블이 **먼저** 생성되어야 합니다. 다른 테이블들이 이 테이블을 참조(REFERENCES)하기 때문입니다.

```bash
# Supabase SQL Editor에서 실행
cat sql/create_direct_url_sources.sql
```

**포함 내용**:
- ✅ `direct_url_sources` 테이블 (211개 직접 URL 관리)
- ✅ 인덱스 (url, region_code, category, last_crawled_at)
- ✅ 트리거 (updated_at 자동 갱신)
- ✅ 뷰 (`problem_urls`, `crawl_stats_by_region`)
- ✅ 함수 (record_crawl_success, record_crawl_failure, reactivate_url, get_urls_for_crawling)
- ✅ RLS 정책 (Service role full access, public read access)

### 2단계: 공고 테이블 생성 (subsidy_announcements)

**파일**: `sql/subsidy_announcements.sql`

```bash
# Supabase SQL Editor에서 실행
cat sql/subsidy_announcements.sql
```

**포함 내용**:
- ✅ `subsidy_announcements` 테이블 (크롤링된 보조금 공고)
- ✅ `local_governments` 테이블 (크롤링 대상 지자체 목록)
- ✅ `crawl_logs` 테이블 (크롤링 실행 로그)
- ✅ 인덱스 및 UNIQUE 제약조건
- ✅ RLS 정책 (authenticated 읽기, service_role 쓰기)
- ✅ 트리거 (updated_at 자동 갱신)

### 3단계: 모니터링 시스템 생성 (crawl_runs 및 뷰)

**파일**: `sql/subsidy_crawler_monitoring.sql`

```bash
# Supabase SQL Editor에서 실행
cat sql/subsidy_crawler_monitoring.sql
```

**포함 내용**:
- ✅ `crawl_runs` 테이블 (각 크롤링 실행 추적)
- ✅ `crawl_batch_results` 테이블 (배치별 성능 추적)
- ✅ `ai_verification_log` 테이블 (Gemini AI 검증 로그)
- ✅ `url_health_metrics` 테이블 (URL별 건강도 메트릭)
- ✅ **뷰** (vw_recent_crawl_runs, vw_url_health_summary, vw_ai_disagreements)
- ✅ 트리거 (updated_at 자동 갱신)
- ✅ RLS 정책 (Service role full access, authenticated read-only)

**중요**: 이 파일이 `direct_url_sources` 테이블을 참조(REFERENCES)하므로 반드시 1단계 이후에 실행해야 합니다.

## Supabase SQL Editor 실행 방법

1. **Supabase Dashboard 접속**
   - URL: https://app.supabase.com
   - Project: `uvdvfsjekqshxtxthxeq` (새 프로젝트)

2. **SQL Editor 열기**
   - 왼쪽 메뉴: "SQL Editor" 클릭
   - "New query" 버튼 클릭

3. **SQL 파일 실행 (순서대로)**

   **Step 1**: direct_url_sources 테이블 생성
   ```sql
   -- sql/create_direct_url_sources.sql 파일 내용 전체 복사
   -- SQL Editor에 붙여넣기
   -- "Run" 버튼 클릭
   ```

   **Step 2**: subsidy_announcements 테이블 생성
   ```sql
   -- sql/subsidy_announcements.sql 파일 내용 전체 복사
   -- SQL Editor에 붙여넣기
   -- "Run" 버튼 클릭
   ```

   **Step 3**: 모니터링 시스템 생성
   ```sql
   -- sql/subsidy_crawler_monitoring.sql 파일 내용 전체 복사
   -- SQL Editor에 붙여넣기
   -- "Run" 버튼 클릭
   ```

4. **실행 결과 확인**
   - ✅ "Success. No rows returned" → 정상 실행
   - ❌ "Error: ..." → 에러 메시지 확인 후 순서 재확인

## 마이그레이션 후 검증

### 1. 테이블 생성 확인

Supabase SQL Editor에서 실행:

```sql
-- 모든 테이블 확인
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name IN (
    'direct_url_sources',
    'subsidy_announcements',
    'local_governments',
    'crawl_logs',
    'crawl_runs',
    'crawl_batch_results',
    'ai_verification_log',
    'url_health_metrics'
  )
ORDER BY table_name;
```

**Expected Output** (8개 테이블):
```
ai_verification_log
crawl_batch_results
crawl_logs
crawl_runs
direct_url_sources
local_governments
subsidy_announcements
url_health_metrics
```

### 2. 뷰 생성 확인

```sql
-- 모든 뷰 확인
SELECT table_name
FROM information_schema.views
WHERE table_schema = 'public'
  AND table_name IN (
    'vw_recent_crawl_runs',
    'vw_url_health_summary',
    'vw_ai_disagreements',
    'problem_urls',
    'crawl_stats_by_region'
  )
ORDER BY table_name;
```

**Expected Output** (5개 뷰):
```
crawl_stats_by_region
problem_urls
vw_ai_disagreements
vw_recent_crawl_runs
vw_url_health_summary
```

### 3. API 엔드포인트 테스트

브라우저 또는 curl로 테스트:

```bash
# 크롤링 실행 조회
curl "https://facility.blueon-iot.com/api/subsidy-crawler/runs?limit=20&offset=0"

# Expected: { "success": true, "data": { "runs": [], ... } }
```

### 4. 모니터링 대시보드 접속

```
URL: https://facility.blueon-iot.com/admin/subsidy/monitoring-dashboard
```

**Expected Behavior**:
- ✅ 페이지 로드 성공
- ✅ 3개 탭 모두 정상 작동 (크롤링 실행, 지자체별 통계, URL 건강도)
- ✅ 초기 데이터 없음 (빈 테이블 표시) → 정상

## 에러 해결

### Error: "relation does not exist"

```
ERROR: relation "direct_url_sources" does not exist
```

**해결**: 1단계(direct_url_sources.sql)를 먼저 실행하세요.

### Error: "permission denied"

```
ERROR: permission denied for schema public (42501)
```

**해결**: SQL Editor에서 실행 시 자동으로 service_role 권한으로 실행됩니다. Dashboard에서 실행하고 있는지 확인하세요.

### Error: "already exists"

```
ERROR: relation "crawl_runs" already exists
```

**해결**: 이미 실행되었습니다. 무시하고 다음 단계로 진행하세요.

## 기존 데이터 마이그레이션 (선택사항)

**주의**: 현재는 스키마만 생성합니다. 기존 Supabase 프로젝트에서 데이터를 가져오려면:

1. **Old Supabase Export**:
   ```bash
   # Old Supabase SQL Editor에서 실행
   COPY (SELECT * FROM crawl_runs) TO '/tmp/crawl_runs.csv' CSV HEADER;
   ```

2. **New Supabase Import**:
   ```sql
   -- New Supabase SQL Editor에서 실행
   COPY crawl_runs FROM '/tmp/crawl_runs.csv' CSV HEADER;
   ```

**또는** Supabase Dashboard → Table Editor → Import CSV 사용

## 관련 파일

| 파일 | 설명 |
|------|------|
| [sql/create_direct_url_sources.sql](../sql/create_direct_url_sources.sql) | 직접 URL 소스 관리 (211개 URL) |
| [sql/subsidy_announcements.sql](../sql/subsidy_announcements.sql) | 보조금 공고, 지자체, 크롤링 로그 |
| [sql/subsidy_crawler_monitoring.sql](../sql/subsidy_crawler_monitoring.sql) | 크롤링 실행, 배치 결과, AI 검증, URL 건강도 |
| [app/api/subsidy-crawler/runs/route.ts](../app/api/subsidy-crawler/runs/route.ts) | 크롤링 실행 API (GET /api/subsidy-crawler/runs) |
| [app/admin/subsidy/monitoring-dashboard/page.tsx](../app/admin/subsidy/monitoring-dashboard/page.tsx) | 모니터링 대시보드 UI |

## 완료 체크리스트

- [ ] 1단계: `create_direct_url_sources.sql` 실행 완료
- [ ] 2단계: `subsidy_announcements.sql` 실행 완료
- [ ] 3단계: `subsidy_crawler_monitoring.sql` 실행 완료
- [ ] 테이블 8개 생성 확인
- [ ] 뷰 5개 생성 확인
- [ ] API 엔드포인트 정상 응답 확인
- [ ] 모니터링 대시보드 페이지 로드 성공
- [ ] 3개 탭 모두 정상 작동 확인

## 요약

**Root Cause**: 새 Supabase 프로젝트에 보조금 크롤러 테이블 미생성
**Solution**: 3개 SQL 파일을 순서대로 Supabase SQL Editor에서 실행
**Execution Time**: ~2분 (각 파일당 30-40초)
**Impact**: 모니터링 대시보드 완전 복구, 크롤러 시스템 정상 작동
