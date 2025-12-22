# SQL 마이그레이션 트러블슈팅 가이드

## 🚨 오류: "column crawl_type does not exist"

### 증상
```
ERROR: 42703: column "crawl_type" does not exist
```

### 원인
1. **테이블 생성 실패**: `CREATE TABLE crawl_logs` 문이 실행되지 않음
2. **GENERATED COLUMN 문법 오류**: Supabase PostgreSQL 버전 호환성 문제
3. **트랜잭션 롤백**: 일부 구문 오류로 전체 실패

---

## ✅ 해결 방법

### 방법 1: 수정된 SQL 파일 사용 (권장)

**파일**: `sql/create_crawl_logs_fixed.sql`

1. Supabase Dashboard → SQL Editor
2. `sql/create_crawl_logs_fixed.sql` 파일 내용 복사
3. SQL Editor에 붙여넣기
4. **Run** 클릭

**차이점**:
- `GENERATED ALWAYS` 컬럼 제거
- `duration_seconds`를 뷰에서 계산
- `DROP` 문 추가로 재실행 가능

**검증**:
```sql
-- 테이블 확인
SELECT * FROM crawl_logs LIMIT 1;

-- 뷰 확인
SELECT * FROM crawl_stats_recent;
SELECT * FROM crawl_logs_detailed;

-- 함수 확인
SELECT * FROM get_running_crawls();
```

---

### 방법 2: 단계별 실행 (문제 격리)

#### Step 1: 테이블만 생성

**파일**: `sql/step1_table_only.sql`

```sql
DROP TABLE IF EXISTS crawl_logs CASCADE;

CREATE TABLE crawl_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  crawl_type VARCHAR(20) NOT NULL CHECK (crawl_type IN ('auto', 'direct')),
  started_at TIMESTAMP NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMP,
  total_urls INTEGER DEFAULT 0,
  successful_urls INTEGER DEFAULT 0,
  failed_urls INTEGER DEFAULT 0,
  new_announcements INTEGER DEFAULT 0,
  relevant_announcements INTEGER DEFAULT 0,
  errors JSONB DEFAULT '[]'::JSONB,
  workflow_run_id VARCHAR(100),
  workflow_job_id VARCHAR(100),
  created_at TIMESTAMP DEFAULT NOW()
);

-- 검증
SELECT * FROM crawl_logs LIMIT 1;
```

**성공 시**: "✅ 테이블 생성 완료" → Step 2로 진행
**실패 시**: 오류 메시지 복사 → 권한 문제 또는 문법 오류

---

#### Step 2: 뷰와 함수 생성

**파일**: `sql/step2_views_functions.sql`

```sql
-- 뷰 생성
CREATE OR REPLACE VIEW crawl_stats_recent AS
SELECT
  crawl_type,
  COUNT(*) as total_runs,
  ...
FROM crawl_logs
WHERE started_at >= NOW() - INTERVAL '7 days'
GROUP BY crawl_type;

-- 함수 생성
CREATE OR REPLACE FUNCTION get_running_crawls() ...

-- 검증
SELECT * FROM crawl_stats_recent;
```

---

### 방법 3: 기존 객체 완전 삭제 후 재시작

```sql
-- 모든 관련 객체 삭제
DROP VIEW IF EXISTS crawl_stats_recent CASCADE;
DROP VIEW IF EXISTS crawl_logs_detailed CASCADE;
DROP FUNCTION IF EXISTS get_running_crawls() CASCADE;
DROP TABLE IF EXISTS crawl_logs CASCADE;

-- 이후 create_crawl_logs_fixed.sql 실행
```

---

## 🔍 문제 진단 쿼리

### 1. 테이블 존재 확인
```sql
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name = 'crawl_logs';
```

**결과**:
- 1 row: 테이블 존재 → 뷰/함수 문제
- 0 rows: 테이블 없음 → 테이블 생성 실패

---

### 2. 컬럼 확인
```sql
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'crawl_logs';
```

**확인 사항**:
- `crawl_type` 컬럼 존재하는지
- `duration_seconds` 컬럼 타입 (INTEGER or 없음)

---

### 3. 뷰 확인
```sql
SELECT table_name
FROM information_schema.views
WHERE table_schema = 'public'
  AND table_name LIKE 'crawl%';
```

---

### 4. 함수 확인
```sql
SELECT routine_name
FROM information_schema.routines
WHERE routine_schema = 'public'
  AND routine_name LIKE '%crawl%';
```

---

## 🛠️ 일반적인 오류 해결

### 오류: "permission denied"
```sql
-- 권한 재부여
GRANT ALL ON crawl_logs TO service_role;
GRANT SELECT ON crawl_logs TO anon, authenticated;
```

### 오류: "relation already exists"
```sql
-- 기존 객체 삭제
DROP TABLE IF EXISTS crawl_logs CASCADE;
```

### 오류: "syntax error"
- SQL 파일 전체를 한 번에 복사했는지 확인
- 주석(`--`)이 포함되어 있어도 괜찮음
- PostgreSQL 버전 확인: Supabase는 PostgreSQL 15+ 사용

---

## 📋 체크리스트

**테이블 생성 성공 확인**:
- [ ] `SELECT * FROM crawl_logs LIMIT 1;` 실행 가능
- [ ] 컬럼 `crawl_type` 존재
- [ ] 인덱스 생성됨 (`idx_crawl_logs_type`, `idx_crawl_logs_started_at`)

**뷰 생성 성공 확인**:
- [ ] `SELECT * FROM crawl_stats_recent;` 실행 가능
- [ ] `SELECT * FROM crawl_logs_detailed;` 실행 가능 (fixed 버전만)

**함수 생성 성공 확인**:
- [ ] `SELECT * FROM get_running_crawls();` 실행 가능

**권한 설정 성공 확인**:
- [ ] RLS 정책 활성화됨
- [ ] Service Role 권한 부여됨

---

## 🚀 다음 단계

모든 체크리스트 통과 후:
1. ✅ Phase 1.6 완료 표시
2. → `sql/create_direct_url_sources.sql` 실행
3. → Phase 2 진행

---

## 💬 추가 지원

오류가 계속되면 다음 정보를 제공해주세요:
1. 정확한 오류 메시지 (전체)
2. Supabase PostgreSQL 버전
3. 실행한 SQL 파일명
4. 진단 쿼리 결과

---

## 📝 변경 사항 요약

**원본 파일**: `sql/create_crawl_logs.sql`
- GENERATED ALWAYS 컬럼 사용 (호환성 문제)

**수정 파일**: `sql/create_crawl_logs_fixed.sql`
- GENERATED 제거
- duration_seconds를 뷰에서 계산
- DROP 문 추가 (재실행 안전)
- crawl_logs_detailed 뷰 추가

**단계별 파일**:
- `step1_table_only.sql`: 테이블만 생성
- `step2_views_functions.sql`: 뷰/함수 생성
