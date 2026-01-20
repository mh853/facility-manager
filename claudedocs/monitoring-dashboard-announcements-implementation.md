# 모니터링 대시보드 개선사항 구현 완료

**구현일**: 2026-01-20
**목적**: 크롤링 실행 상세 페이지에서 발견된 공고 목록 표시 및 네비게이션 추가

---

## ✅ 구현 완료 사항

### 1. **데이터베이스 스키마 마이그레이션**

#### 파일: `sql/migrations/001_add_crawl_run_id_to_announcements.sql`

**추가된 컬럼**:
- `crawl_run_id TEXT` - 크롤링 실행 ID 참조 (외래키)

**추가된 인덱스**:
- `idx_announcements_crawl_run` - crawl_run_id로 빠른 조회

**외래키 제약조건**:
```sql
ALTER TABLE subsidy_announcements
ADD CONSTRAINT fk_crawl_run
FOREIGN KEY (crawl_run_id)
REFERENCES crawl_runs(run_id)
ON DELETE SET NULL;
```

**적용 방법**:
```sql
-- Supabase SQL Editor에서 실행
\i sql/migrations/001_add_crawl_run_id_to_announcements.sql
```

---

### 2. **크롤러 코드 수정**

#### 파일: `app/api/subsidy-crawler/route.ts`

**수정 사항**:

1. **Phase 2 함수 시그니처 업데이트** (Line 393-398):
```typescript
async function crawlPhase2SourceWithRetry(
  source: Phase2Source,
  supabase: ReturnType<typeof createClient>,
  force: boolean,
  runId: string,  // 추가
  maxRetries = 3
)
```

2. **Phase 2 insertData에 crawl_run_id 추가** (Line 463):
```typescript
const insertData = {
  // ... 기존 필드들
  crawl_run_id: runId, // 추가
};
```

3. **Phase 1 insertData에 crawl_run_id 추가** (Line 635):
```typescript
const insertData = {
  // ... 기존 필드들
  crawl_run_id: runId, // 추가
};
```

4. **Phase 2 호출부 수정** (Line 696):
```typescript
const crawlResults = await Promise.allSettled(
  batchSources.map(source => crawlPhase2SourceWithRetry(source, supabase, force, runId, 3))
);
```

**효과**:
- 모든 신규 공고가 자동으로 crawl_run_id와 연결됨
- Phase 1, Phase 2 모두 지원
- 기존 크롤링 로직 영향 없음

---

### 3. **API 엔드포인트 구현**

#### 파일: `app/api/subsidy-crawler/runs/[runId]/announcements/route.ts`

**엔드포인트**: `GET /api/subsidy-crawler/runs/:runId/announcements`

**Query Parameters**:
```typescript
- page: number (기본값: 1)
- page_size: number (기본값: 20, 최대: 100)
- relevant_only: boolean (기본값: false)
- ai_verified_only: boolean (기본값: false)
```

**응답 형식**:
```typescript
interface AnnouncementListResponse {
  success: boolean;
  data?: {
    announcements: AnnouncementItem[];  // 공고 목록
    pagination: {
      total: number;
      page: number;
      page_size: number;
      total_pages: number;
    };
    filters: {
      show_relevant_only: boolean;
      show_ai_verified_only: boolean;
    };
  };
  error?: string;
}
```

**쿼리 최적화**:
- `crawl_run_id` 인덱스 사용
- `crawled_at DESC` 정렬 (최신 순)
- Range 쿼리로 페이지네이션 구현

---

### 4. **상세 페이지 레이아웃 개선**

#### 파일: `app/admin/subsidy/monitoring/[runId]/page.tsx`

**변경 사항**:

1. **AdminLayout 추가**:
```typescript
import AdminLayout from '@/components/ui/AdminLayout';

return (
  <AdminLayout
    title="📊 크롤링 실행 상세"
    subtitle={run.run_id}
    actions={<>...</>}
  >
    {/* 기존 콘텐츠 */}
  </AdminLayout>
);
```

2. **로딩/에러 상태도 AdminLayout 적용**:
```typescript
if (loading) {
  return (
    <AdminLayout title="📊 크롤링 실행 상세">
      <div>로딩 중...</div>
    </AdminLayout>
  );
}
```

**효과**:
- 다른 관리자 페이지와 일관된 UI
- 왼쪽 네비게이션 바 표시
- 헤더 중복 제거

---

### 5. **공고 목록 컴포넌트 구현**

#### 파일: `app/admin/subsidy/monitoring/[runId]/AnnouncementsSection.tsx`

**주요 기능**:

1. **필터링**:
   - "관련 공고만" 버튼: `is_relevant = true` 필터
   - "AI 검증만" 버튼: `relevance_score >= 0.7` 필터
   - 필터 활성화 시 파란색/보라색 강조

2. **페이지네이션**:
   - 페이지당 20개 항목
   - 이전/다음 버튼
   - 전체 페이지 수 표시

3. **공고 표시**:
   - 제목, 지역명, 신청기간, 지원금액 표시
   - 키워드 태그 (최대 3개 + 추가 개수)
   - AI 검증 배지 (🤖 AI 점수 또는 ✅ 키워드)
   - 원문 링크 (새 탭에서 열림)

4. **상태 처리**:
   - 로딩 스피너
   - 에러 메시지 + 재시도 버튼
   - 빈 결과 안내 (필터 해제 안내 포함)

**UI 디자인**:
```
┌─────────────────────────────────────────────────────┐
│ 📋 발견된 공고 목록     [🔲 관련 공고만] [🔲 AI 검증만] │
│                                     전체 XX건        │
├─────────────────────────────────────────────────────┤
│ 공고 제목 | 지역 | 신청기간 | 지원금액 | 관련도 | 링크 │
│ ...                                                 │
├─────────────────────────────────────────────────────┤
│ 페이지 1 / 5 (전체 100건)          [← 이전] [다음 →] │
└─────────────────────────────────────────────────────┘
```

---

## 📊 기술 스택 및 패턴

### API 패턴
- **Next.js App Router API Routes**: `/app/api/subsidy-crawler/runs/[runId]/announcements/route.ts`
- **Dynamic Route Parameters**: `{ params: { runId: string } }`
- **Search Params**: URLSearchParams로 쿼리 파라미터 처리

### 데이터 페칭
- **Client-side Fetching**: `useEffect` + `fetch` API
- **Error Handling**: try-catch + error state
- **Loading States**: loading, error, empty states

### UI 컴포넌트 패턴
- **Compound Components**: `AnnouncementsSection` + `AnnouncementRow`
- **Controlled Components**: filters, pagination state
- **Conditional Rendering**: loading, error, empty, success states

### 스타일링
- **Tailwind CSS**: 유틸리티 클래스 기반
- **Responsive Design**: `md:` breakpoints
- **Interactive States**: hover, disabled, active

---

## 🚀 배포 및 테스트 계획

### 1. **데이터베이스 마이그레이션 실행**
```bash
# Supabase SQL Editor에서 실행
cd sql/migrations
# 001_add_crawl_run_id_to_announcements.sql 파일 내용 복사하여 실행
```

### 2. **Git Commit & Push**
```bash
git add .
git commit -m "feat: 모니터링 대시보드 공고 목록 기능 추가

- DB: crawl_run_id 컬럼 추가 (subsidy_announcements)
- 크롤러: runId 자동 연결 (Phase 1, Phase 2)
- API: /api/subsidy-crawler/runs/[runId]/announcements 구현
- UI: AdminLayout 적용 + AnnouncementsSection 컴포넌트
- 기능: 필터링 (관련/AI검증), 페이지네이션, 상세 정보 표시

주요 개선사항:
- 크롤링 실행 → 공고 목록 연결 완료
- 왼쪽 네비게이션 바 추가 (AdminLayout)
- 공고 필터링 및 페이지네이션 지원
"
git push origin main
```

### 3. **Vercel 자동 배포**
- Push 후 1-2분 내 자동 배포
- URL: https://facility.blueon-iot.com/admin/subsidy/monitoring/[runId]

### 4. **수동 테스트**

#### 4.1. 데이터베이스 마이그레이션 확인
```sql
-- Supabase SQL Editor
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'subsidy_announcements'
  AND column_name = 'crawl_run_id';

-- 인덱스 확인
SELECT indexname, indexdef
FROM pg_indexes
WHERE tablename = 'subsidy_announcements'
  AND indexname = 'idx_announcements_crawl_run';
```

#### 4.2. 크롤러 실행 및 연결 확인
```bash
# GitHub Actions 수동 실행 또는 다음날 자동 실행 대기
# 실행 후 Supabase에서 확인:
SELECT crawl_run_id, COUNT(*) as count
FROM subsidy_announcements
WHERE crawl_run_id IS NOT NULL
GROUP BY crawl_run_id
ORDER BY MIN(crawled_at) DESC
LIMIT 10;
```

#### 4.3. 모니터링 대시보드 UI 테스트
1. https://facility.blueon-iot.com/admin/subsidy/monitoring 접속
2. 최근 크롤링 실행 항목 클릭
3. 상세 페이지에서 확인:
   - ✅ 왼쪽 네비게이션 바 표시됨
   - ✅ "발견된 공고 목록" 섹션 표시됨
   - ✅ 필터 버튼 동작 확인 (관련 공고만, AI 검증만)
   - ✅ 페이지네이션 동작 확인
   - ✅ 공고 상세 정보 표시 (제목, 지역, 신청기간, 지원금액)
   - ✅ 원문 링크 클릭 시 새 탭에서 열림

#### 4.4. API 엔드포인트 테스트
```bash
# 최근 run_id 조회
curl https://facility.blueon-iot.com/api/subsidy-crawler/runs | jq '.data.runs[0].run_id'

# 공고 목록 조회 (예: run_phase2_2026-01-20T10-00-00)
curl "https://facility.blueon-iot.com/api/subsidy-crawler/runs/run_phase2_2026-01-20T10-00-00/announcements?page=1&page_size=20" | jq

# 필터 적용 테스트
curl "https://facility.blueon-iot.com/api/subsidy-crawler/runs/run_phase2_2026-01-20T10-00-00/announcements?relevant_only=true&ai_verified_only=true" | jq
```

---

## 📈 예상 효과

### 사용자 경험 개선
1. **정보 접근성**: 크롤링 실행 → 발견된 공고 직접 확인 가능
2. **필터링**: 관련 공고만 빠르게 확인 (노이즈 제거)
3. **UI 일관성**: AdminLayout으로 네비게이션 통일

### 운영 효율성
1. **모니터링**: 크롤링 결과 실시간 확인
2. **품질 관리**: AI 검증 여부 한눈에 확인
3. **추적 가능성**: crawl_run_id로 공고 출처 추적

### 시스템 확장성
1. **외래키 관계**: crawl_runs ↔ subsidy_announcements 연결
2. **인덱스 최적화**: 빠른 쿼리 성능 (crawl_run_id 인덱스)
3. **페이지네이션**: 대량 데이터 처리 준비 완료

---

## 🔧 변경된 파일 목록

### 신규 생성 (4개)
1. `sql/migrations/001_add_crawl_run_id_to_announcements.sql` - DB 마이그레이션
2. `app/api/subsidy-crawler/runs/[runId]/announcements/route.ts` - API 엔드포인트
3. `app/admin/subsidy/monitoring/[runId]/AnnouncementsSection.tsx` - 공고 목록 컴포넌트
4. `claudedocs/monitoring-dashboard-announcements-implementation.md` - 구현 문서

### 수정 (2개)
1. `app/api/subsidy-crawler/route.ts` - 크롤러에 runId 연결 로직 추가
   - Line 393-398: 함수 시그니처 수정
   - Line 463: Phase 2 insertData에 crawl_run_id 추가
   - Line 635: Phase 1 insertData에 crawl_run_id 추가
   - Line 696: 함수 호출부 수정
2. `app/admin/subsidy/monitoring/[runId]/page.tsx` - AdminLayout 적용 + AnnouncementsSection 추가
   - Line 5: AdminLayout import
   - Line 6: AnnouncementsSection import
   - Line 92-118: 로딩/에러 상태에 AdminLayout 적용
   - Line 127-146: 메인 return에 AdminLayout 적용
   - Line 224: AnnouncementsSection 추가

---

## ⚠️ 주의사항

### 1. **마이그레이션 필수**
- 배포 전 반드시 Supabase에서 마이그레이션 SQL 실행
- 실행하지 않으면 공고 목록이 표시되지 않음

### 2. **기존 데이터**
- 마이그레이션 전 크롤링된 공고는 `crawl_run_id = NULL`
- 새로운 크롤링부터만 연결됨

### 3. **성능 모니터링**
- 공고 수가 많을 경우 페이지네이션 성능 확인
- 필요시 `page_size` 조정 또는 추가 인덱스 생성

---

**구현자**: Claude Sonnet 4.5
**구현일**: 2026-01-20
**상태**: ✅ 구현 완료, 배포 대기 중
