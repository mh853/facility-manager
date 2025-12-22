# SQL 마이그레이션 가이드

## Phase 1: Database Schema 생성

### 1단계: crawl_logs 테이블 생성

**파일**: `sql/create_crawl_logs.sql`

**실행 방법**:
1. Supabase Dashboard 접속
2. 좌측 메뉴에서 **SQL Editor** 클릭
3. `create_crawl_logs.sql` 파일 내용 복사
4. SQL Editor에 붙여넣기
5. **Run** 버튼 클릭

**검증**:
```sql
-- 테이블 생성 확인
SELECT * FROM crawl_logs LIMIT 1;

-- 뷰 생성 확인
SELECT * FROM crawl_stats_recent;

-- 함수 생성 확인
SELECT * FROM get_running_crawls();
```

**예상 결과**:
- `crawl_logs` 테이블 생성됨
- `crawl_stats_recent` 뷰 생성됨
- `get_running_crawls()` 함수 실행 가능

---

### 2단계: direct_url_sources 테이블 생성

**파일**: `sql/create_direct_url_sources.sql`

**실행 방법**:
1. Supabase Dashboard → **SQL Editor**
2. `create_direct_url_sources.sql` 파일 내용 복사
3. SQL Editor에 붙여넣기
4. **Run** 버튼 클릭

**검증**:
```sql
-- 테이블 생성 확인
SELECT * FROM direct_url_sources LIMIT 1;

-- 뷰 생성 확인
SELECT * FROM problem_urls;
SELECT * FROM crawl_stats_by_region;

-- 함수 생성 확인
SELECT * FROM get_urls_for_crawling(5);
```

**예상 결과**:
- `direct_url_sources` 테이블 생성됨
- `problem_urls`, `crawl_stats_by_region` 뷰 생성됨
- 모든 함수 실행 가능

---

### 3단계: CSV 데이터 임포트 (선택)

**방법 1: 테스트 데이터 삽입**

```sql
-- 테스트용 URL 3개 삽입
INSERT INTO direct_url_sources (url, region_code, region_name, category, notes)
VALUES
  ('https://www.seoul.go.kr', '11000', '서울특별시', 'IoT지원', '테스트 URL 1'),
  ('https://www.busan.go.kr', '26000', '부산광역시', 'IoT지원', '테스트 URL 2'),
  ('https://www.daegu.go.kr', '27000', '대구광역시', 'IoT지원', '테스트 URL 3');

-- 삽입 확인
SELECT * FROM direct_url_sources;
```

**방법 2: CSV 파일에서 임포트** (추후 구현)

```sql
-- CSV를 JSON으로 변환 후 임포트
SELECT import_urls_from_csv('[
  {"url": "https://...", "region_code": "11000", ...},
  ...
]'::JSONB);
```

---

## 테스트 시나리오

### 시나리오 1: 크롤링 로그 기록

```sql
-- 크롤링 시작 로그
INSERT INTO crawl_logs (crawl_type, started_at, total_urls)
VALUES ('direct', NOW(), 10);

-- 크롤링 완료 로그
UPDATE crawl_logs
SET
  completed_at = NOW(),
  successful_urls = 8,
  failed_urls = 2,
  new_announcements = 5,
  relevant_announcements = 3
WHERE id = '마지막 ID';

-- 통계 확인
SELECT * FROM crawl_stats_recent;
```

### 시나리오 2: URL 크롤링 성공/실패

```sql
-- 성공 기록
SELECT record_crawl_success('https://www.seoul.go.kr');

-- 실패 기록 (3회)
SELECT record_crawl_failure('https://www.busan.go.kr', 'timeout');
SELECT record_crawl_failure('https://www.busan.go.kr', 'timeout');
SELECT record_crawl_failure('https://www.busan.go.kr', 'timeout');

-- 문제 URL 확인
SELECT * FROM problem_urls;
```

### 시나리오 3: Circuit Breaker (5회 실패 시 비활성화)

```sql
-- 5회 실패 시뮬레이션
DO $$
BEGIN
  FOR i IN 1..5 LOOP
    PERFORM record_crawl_failure('https://www.daegu.go.kr', 'connection_error');
  END LOOP;
END $$;

-- 비활성화 확인
SELECT url, is_active, consecutive_failures
FROM direct_url_sources
WHERE url = 'https://www.daegu.go.kr';

-- 재활성화
SELECT reactivate_url('https://www.daegu.go.kr');
```

---

## 트러블슈팅

### 오류 1: "relation already exists"
**원인**: 테이블/뷰/함수가 이미 존재
**해결**: 기존 객체 삭제 후 재실행
```sql
DROP TABLE IF EXISTS crawl_logs CASCADE;
DROP TABLE IF EXISTS direct_url_sources CASCADE;
```

### 오류 2: "permission denied"
**원인**: 권한 부족
**해결**: Service Role Key 사용 확인 또는 권한 재부여
```sql
GRANT ALL ON crawl_logs TO service_role;
GRANT ALL ON direct_url_sources TO service_role;
```

### 오류 3: "function does not exist"
**원인**: 함수 생성 실패
**해결**: SQL 파일 전체 재실행

---

## 롤백 방법

```sql
-- 모든 객체 삭제 (신중하게 사용!)
DROP TABLE IF EXISTS crawl_logs CASCADE;
DROP TABLE IF EXISTS direct_url_sources CASCADE;
DROP VIEW IF EXISTS crawl_stats_recent CASCADE;
DROP VIEW IF EXISTS problem_urls CASCADE;
DROP VIEW IF EXISTS crawl_stats_by_region CASCADE;
DROP FUNCTION IF EXISTS get_running_crawls() CASCADE;
DROP FUNCTION IF EXISTS record_crawl_success(TEXT) CASCADE;
DROP FUNCTION IF EXISTS record_crawl_failure(TEXT, TEXT) CASCADE;
DROP FUNCTION IF EXISTS reactivate_url(TEXT) CASCADE;
DROP FUNCTION IF EXISTS get_urls_for_crawling(INTEGER) CASCADE;
DROP FUNCTION IF EXISTS import_urls_from_csv(JSONB) CASCADE;
DROP FUNCTION IF EXISTS update_direct_url_sources_updated_at() CASCADE;
```

---

## 다음 단계

Phase 1 완료 후:
1. ✅ `docs/crawling-implementation-progress.md` 업데이트
2. → **Phase 2**: Direct URL Crawler API 구현
3. → `app/api/subsidy-crawler/direct/route.ts` 생성

---

## 체크리스트

- [ ] `create_crawl_logs.sql` 실행 완료
- [ ] `create_direct_url_sources.sql` 실행 완료
- [ ] 테스트 데이터 삽입 완료
- [ ] 모든 뷰 조회 가능
- [ ] 모든 함수 실행 가능
- [ ] 진행 문서 업데이트 완료
