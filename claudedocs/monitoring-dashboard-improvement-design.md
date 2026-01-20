# 모니터링 대시보드 개선 설계

**작성일**: 2026-01-20
**대상**: 크롤링 모니터링 대시보드 UX 개선

---

## 📋 개선 요구사항

### 1. 크롤링 실행 이력 클릭 시 결과물 표시
**현재 문제**:
- `monitoring-dashboard` 페이지에서 크롤링 실행 이력을 클릭하면 상세 페이지(`/admin/subsidy/monitoring/[runId]`)로 이동
- 상세 페이지에는 **배치 정보**만 표시되고, **실제 크롤링 결과물(공고 리스트)**이 표시되지 않음

**개선 목표**:
- 상세 페이지에 해당 크롤링에서 수집한 **공고 리스트**를 표시
- 공고별 상세 정보 (제목, URL, 관련도, AI 검증 결과 등) 제공

### 2. 상세 페이지 레이아웃 개선
**현재 문제**:
- `/admin/subsidy/monitoring/[runId]` 페이지에 **네비게이션 바가 없음**
- 다른 admin 페이지들과 달리 전체 화면 레이아웃으로 표시

**개선 목표**:
- `AdminLayout` 컴포넌트를 사용하여 **왼쪽 네비게이션 바 추가**
- 다른 관리 페이지들과 일관된 UI/UX 제공

---

## 🎯 설계 목표

1. **일관된 UX**: 모든 admin 페이지에서 동일한 레이아웃 사용
2. **정보 접근성**: 크롤링 결과물을 직접 확인 가능
3. **성능 최적화**: 대량 공고 데이터 페이지네이션
4. **유용한 필터링**: 관련도, AI 검증 여부로 필터링 가능

---

## 🏗️ 아키텍처 설계

### 1. 페이지 구조

```
/admin/subsidy/monitoring-dashboard (목록)
└─ [RunRow 클릭]
   └─ /admin/subsidy/monitoring/[runId] (상세)
      ├─ AdminLayout (네비게이션 추가)
      ├─ 실행 요약
      ├─ AI 검증 요약
      ├─ 배치별 상세 결과
      └─ 📋 크롤링 결과물 리스트 (NEW)
          ├─ 필터 (관련도, AI 검증)
          ├─ 공고 테이블
          └─ 페이지네이션
```

### 2. 데이터 흐름

```mermaid
graph LR
    A[모니터링 대시보드] -->|run_id 클릭| B[상세 페이지]
    B -->|API 호출| C[/api/subsidy-crawler/runs/:runId]
    B -->|NEW API 호출| D[/api/subsidy-crawler/runs/:runId/announcements]
    C -->|반환| E[run + batches + ai_summary]
    D -->|반환| F[announcements 리스트]
    E --> G[기존 UI 렌더링]
    F --> H[NEW 공고 리스트 렌더링]
```

---

## 📊 데이터 모델

### 새로운 API 응답: `/api/subsidy-crawler/runs/:runId/announcements`

```typescript
interface AnnouncementListResponse {
  success: boolean;
  data: {
    announcements: AnnouncementItem[];
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
}

interface AnnouncementItem {
  id: string;
  title: string;
  source_url: string;
  region_name: string;
  region_code: string;
  published_at: string;
  created_at: string;

  // 관련성 정보
  is_relevant: boolean;
  relevance_score: number;
  keywords_matched: string[];

  // 상세 정보 (optional)
  content?: string;
  application_period_start?: string;
  application_period_end?: string;
  budget?: string;
  support_amount?: string;
  target_description?: string;
}
```

### 필터 파라미터

```typescript
interface AnnouncementFilters {
  run_id: string;              // 필수
  page?: number;               // 기본값 1
  page_size?: number;          // 기본값 20
  relevant_only?: boolean;     // 관련 공고만
  ai_verified_only?: boolean;  // AI 검증 공고만
  order_by?: 'created_at' | 'relevance_score' | 'published_at';
  order_dir?: 'asc' | 'desc';
}
```

---

## 🔧 API 엔드포인트 설계

### GET `/api/subsidy-crawler/runs/:runId/announcements`

**목적**: 특정 크롤링 실행에서 수집한 공고 리스트 조회

**Query Parameters**:
```
?page=1
&page_size=20
&relevant_only=false
&ai_verified_only=false
&order_by=created_at
&order_dir=desc
```

**SQL 쿼리** (`app/api/subsidy-crawler/runs/[runId]/announcements/route.ts`):
```sql
SELECT
  sa.id,
  sa.title,
  sa.source_url,
  sa.region_name,
  sa.region_code,
  sa.published_at,
  sa.created_at,
  sa.is_relevant,
  sa.relevance_score,
  sa.keywords_matched,
  sa.content,
  sa.application_period_start,
  sa.application_period_end,
  sa.budget,
  sa.support_amount,
  sa.target_description
FROM subsidy_announcements sa
WHERE sa.crawl_run_id = $1  -- runId
  AND ($2 = false OR sa.is_relevant = true)  -- relevant_only
  AND ($3 = false OR sa.relevance_score > 0.7)  -- ai_verified_only
ORDER BY sa.created_at DESC
LIMIT $4 OFFSET $5;  -- page_size, offset
```

**응답 예시**:
```json
{
  "success": true,
  "data": {
    "announcements": [
      {
        "id": "uuid-1",
        "title": "2026년 친환경 시설 설치 지원사업 공고",
        "source_url": "https://...",
        "region_name": "경기환경에너지진흥원",
        "region_code": "41",
        "published_at": "2026-01-19T00:00:00Z",
        "created_at": "2026-01-19T04:59:00Z",
        "is_relevant": true,
        "relevance_score": 0.92,
        "keywords_matched": ["IoT", "시설관리", "에너지"]
      }
    ],
    "pagination": {
      "total": 156,
      "page": 1,
      "page_size": 20,
      "total_pages": 8
    },
    "filters": {
      "show_relevant_only": false,
      "show_ai_verified_only": false
    }
  }
}
```

---

## 🎨 UI 컴포넌트 설계

### 1. 상세 페이지 레이아웃 개선

**Before** (현재):
```tsx
export default function RunDetailPage() {
  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* 네비게이션 없음, 전체 화면 */}
      <div className="flex items-center justify-between">
        <h1>📊 크롤링 실행 상세</h1>
        <button onClick={() => router.push('/admin/subsidy/monitoring')}>
          ← 목록으로
        </button>
      </div>
      {/* ... */}
    </div>
  );
}
```

**After** (개선):
```tsx
import AdminLayout from '@/components/ui/AdminLayout';

export default function RunDetailPage() {
  return (
    <AdminLayout
      title="📊 크롤링 실행 상세"
      subtitle={runId}
      actions={
        <>
          <button onClick={loadRunDetail}>🔄 새로고침</button>
          <button onClick={() => router.push('/admin/subsidy/monitoring-dashboard')}>
            ← 목록으로
          </button>
        </>
      }
    >
      <div className="p-6 space-y-6">
        {/* 기존 콘텐츠 */}
        {/* NEW: 공고 리스트 */}
      </div>
    </AdminLayout>
  );
}
```

### 2. 공고 리스트 컴포넌트

```tsx
// ============================================================
// 크롤링 결과물 리스트 (NEW)
// ============================================================
function AnnouncementsSection({ runId }: { runId: string }) {
  const [announcements, setAnnouncements] = useState<AnnouncementItem[]>([]);
  const [pagination, setPagination] = useState({
    page: 1,
    page_size: 20,
    total: 0,
    total_pages: 0,
  });
  const [filters, setFilters] = useState({
    relevant_only: false,
    ai_verified_only: false,
  });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadAnnouncements();
  }, [runId, pagination.page, filters]);

  const loadAnnouncements = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: pagination.page.toString(),
        page_size: pagination.page_size.toString(),
        relevant_only: filters.relevant_only.toString(),
        ai_verified_only: filters.ai_verified_only.toString(),
        order_by: 'created_at',
        order_dir: 'desc',
      });

      const response = await fetch(
        `/api/subsidy-crawler/runs/${runId}/announcements?${params}`
      );
      const result = await response.json();

      if (result.success) {
        setAnnouncements(result.data.announcements);
        setPagination(result.data.pagination);
      }
    } catch (error) {
      console.error('Failed to load announcements:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-white rounded-lg shadow overflow-hidden">
      <div className="px-6 py-4 border-b border-gray-200 bg-gray-50">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900">
            📋 크롤링 결과물 ({pagination.total}개 공고)
          </h2>

          {/* 필터 버튼 */}
          <div className="flex gap-2">
            <button
              onClick={() => setFilters({ ...filters, relevant_only: !filters.relevant_only })}
              className={`px-3 py-1 rounded text-sm ${
                filters.relevant_only
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              {filters.relevant_only ? '✅ 관련 공고만' : '전체 공고'}
            </button>
            <button
              onClick={() => setFilters({ ...filters, ai_verified_only: !filters.ai_verified_only })}
              className={`px-3 py-1 rounded text-sm ${
                filters.ai_verified_only
                  ? 'bg-purple-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              {filters.ai_verified_only ? '🤖 AI 검증만' : '전체 표시'}
            </button>
          </div>
        </div>
      </div>

      {/* 로딩 상태 */}
      {loading && (
        <div className="flex justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      )}

      {/* 공고 테이블 */}
      {!loading && (
        <>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    제목 / 지역
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    게시일
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    관련도
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    키워드
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    링크
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {announcements.map(announcement => (
                  <AnnouncementRow key={announcement.id} announcement={announcement} />
                ))}
              </tbody>
            </table>
          </div>

          {/* 페이지네이션 */}
          {pagination.total_pages > 1 && (
            <div className="px-6 py-4 bg-gray-50 border-t border-gray-200">
              <div className="flex items-center justify-between">
                <div className="text-sm text-gray-700">
                  총 <span className="font-medium">{pagination.total}</span>개 공고 중{' '}
                  <span className="font-medium">
                    {(pagination.page - 1) * pagination.page_size + 1}
                  </span>
                  -
                  <span className="font-medium">
                    {Math.min(pagination.page * pagination.page_size, pagination.total)}
                  </span>{' '}
                  표시
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => setPagination({ ...pagination, page: pagination.page - 1 })}
                    disabled={pagination.page === 1}
                    className="px-3 py-1 rounded border disabled:opacity-50"
                  >
                    이전
                  </button>
                  <span className="px-3 py-1">
                    {pagination.page} / {pagination.total_pages}
                  </span>
                  <button
                    onClick={() => setPagination({ ...pagination, page: pagination.page + 1 })}
                    disabled={pagination.page === pagination.total_pages}
                    className="px-3 py-1 rounded border disabled:opacity-50"
                  >
                    다음
                  </button>
                </div>
              </div>
            </div>
          )}
        </>
      )}

      {/* 빈 상태 */}
      {!loading && announcements.length === 0 && (
        <div className="text-center py-12 text-gray-500">
          <p>해당 조건의 공고가 없습니다.</p>
        </div>
      )}
    </div>
  );
}

// 공고 행 컴포넌트
function AnnouncementRow({ announcement }: { announcement: AnnouncementItem }) {
  return (
    <tr className="hover:bg-gray-50 transition-colors">
      <td className="px-6 py-4">
        <div className="text-sm font-medium text-gray-900 max-w-md truncate">
          {announcement.title}
        </div>
        <div className="text-xs text-gray-500 mt-1">
          {announcement.region_name}
        </div>
      </td>
      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
        {new Date(announcement.published_at).toLocaleDateString('ko-KR')}
      </td>
      <td className="px-6 py-4 whitespace-nowrap">
        {announcement.is_relevant ? (
          <div className="flex items-center">
            <span className="text-sm font-semibold text-green-600 mr-2">
              {(announcement.relevance_score * 100).toFixed(0)}%
            </span>
            <div className="w-16 bg-gray-200 rounded-full h-2">
              <div
                className="bg-green-500 h-2 rounded-full"
                style={{ width: `${announcement.relevance_score * 100}%` }}
              />
            </div>
          </div>
        ) : (
          <span className="text-sm text-gray-400">관련 없음</span>
        )}
      </td>
      <td className="px-6 py-4">
        <div className="flex flex-wrap gap-1 max-w-xs">
          {announcement.keywords_matched.slice(0, 3).map((keyword, idx) => (
            <span
              key={idx}
              className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800"
            >
              {keyword}
            </span>
          ))}
          {announcement.keywords_matched.length > 3 && (
            <span className="text-xs text-gray-500">
              +{announcement.keywords_matched.length - 3}
            </span>
          )}
        </div>
      </td>
      <td className="px-6 py-4 whitespace-nowrap text-sm">
        <a
          href={announcement.source_url}
          target="_blank"
          rel="noopener noreferrer"
          className="text-blue-600 hover:text-blue-800 hover:underline"
        >
          🔗 원문 보기
        </a>
      </td>
    </tr>
  );
}
```

---

## 📂 파일 구조

### 새로 생성할 파일

```
app/
└── api/
    └── subsidy-crawler/
        └── runs/
            └── [runId]/
                └── announcements/
                    └── route.ts  # NEW API
```

### 수정할 파일

```
app/
└── admin/
    └── subsidy/
        └── monitoring/
            └── [runId]/
                └── page.tsx  # AdminLayout 추가 + 공고 리스트 추가
```

---

## 🔄 구현 순서

### Phase 1: API 구현 (30분)
1. ✅ `app/api/subsidy-crawler/runs/[runId]/announcements/route.ts` 생성
2. ✅ GET 엔드포인트 구현
3. ✅ Supabase 쿼리 작성
4. ✅ 페이지네이션 로직 구현
5. ✅ 필터 로직 구현

### Phase 2: 상세 페이지 레이아웃 개선 (15분)
1. ✅ `AdminLayout` import 추가
2. ✅ 레이아웃 구조 변경
3. ✅ 액션 버튼 이동

### Phase 3: 공고 리스트 UI 구현 (45분)
1. ✅ `AnnouncementsSection` 컴포넌트 추가
2. ✅ `AnnouncementRow` 컴포넌트 추가
3. ✅ 필터 UI 구현
4. ✅ 페이지네이션 UI 구현
5. ✅ 로딩/빈 상태 처리

### Phase 4: 테스트 및 검증 (20분)
1. ✅ API 응답 확인
2. ✅ 필터 동작 확인
3. ✅ 페이지네이션 동작 확인
4. ✅ 레이아웃 일관성 확인

**총 예상 시간**: 1.5-2시간

---

## 📊 데이터베이스 스키마 확인

### `subsidy_announcements` 테이블

현재 스키마에 `crawl_run_id` 컬럼 존재 여부 확인 필요

**확인 방법**:
```sql
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'subsidy_announcements'
  AND column_name = 'crawl_run_id';
```

**만약 없다면 추가 필요**:
```sql
ALTER TABLE subsidy_announcements
ADD COLUMN crawl_run_id TEXT REFERENCES crawl_runs(run_id);

CREATE INDEX idx_subsidy_announcements_crawl_run_id
ON subsidy_announcements(crawl_run_id);
```

**현재 크롤러 코드 확인 필요**:
- `app/api/subsidy-crawler/route.ts`에서 공고 INSERT 시 `crawl_run_id` 포함 여부 확인
- 포함되지 않았다면 추가 필요

---

## 🎯 성공 기준

### ✅ 필수 (완료 조건)
- [ ] `/api/subsidy-crawler/runs/:runId/announcements` API 정상 동작
- [ ] 상세 페이지에 `AdminLayout` 적용 (네비게이션 표시)
- [ ] 크롤링 결과물 리스트 표시
- [ ] 페이지네이션 동작
- [ ] 필터 (관련 공고만, AI 검증만) 동작

### ✅ 목표 (사용성 개선)
- [ ] 공고 제목 클릭 시 원문 새 탭 열기
- [ ] 키워드 강조 표시
- [ ] 관련도 점수 시각화 (진행 바)
- [ ] 모바일 반응형 테이블

### ✅ 최적 (추가 기능)
- [ ] 공고 상세 모달 (확장 정보 표시)
- [ ] CSV 다운로드 기능
- [ ] 정렬 옵션 (게시일, 관련도)
- [ ] 검색 기능 (제목, 키워드)

---

## 🔧 기술 스택

- **Frontend**: Next.js 14, React, TypeScript, Tailwind CSS
- **Backend**: Next.js API Routes, Supabase (PostgreSQL)
- **Layout**: `AdminLayout` 컴포넌트 (기존)
- **상태 관리**: React useState, useEffect
- **스타일링**: Tailwind CSS utility classes

---

## 📝 참고 사항

### `crawl_run_id` 추적 필요

현재 `subsidy_announcements` 테이블에 `crawl_run_id`가 없을 수 있으므로:

1. **스키마 확인** 후 컬럼 추가
2. **크롤러 코드 수정**하여 INSERT 시 `run_id` 포함
3. **기존 데이터 마이그레이션** 불가 (생성 시각으로 추정 가능하지만 부정확)

### 대안: 생성 시각 기반 조회

`crawl_run_id`가 없다면 임시로 생성 시각 범위로 조회:

```sql
SELECT * FROM subsidy_announcements
WHERE created_at >= (SELECT started_at FROM crawl_runs WHERE run_id = $1)
  AND created_at <= (SELECT COALESCE(completed_at, NOW()) FROM crawl_runs WHERE run_id = $1)
ORDER BY created_at DESC;
```

**단점**: 동시 실행 크롤링 시 부정확

---

**설계자**: Claude Sonnet 4.5
**설계일**: 2026-01-20
**예상 구현 시간**: 1.5-2시간
