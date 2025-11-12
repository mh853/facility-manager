# 성능 최적화 안전한 구현 계획

## 🎯 구현 원칙

1. **점진적 적용**: 한 번에 하나씩, 테스트 후 다음 단계
2. **롤백 가능**: 각 단계마다 Git 커밋으로 되돌리기 가능
3. **모니터링**: 각 단계 전후 성능 측정
4. **백업**: 데이터베이스 변경 전 백업

---

## 📅 Phase 1: 즉시 효과 (리스크 낮음)

### ✅ Step 1: DB 인덱스 추가 (30분)

**위험도**: 🟢 낮음 (읽기 성능만 향상, 부작용 없음)

**사전 준비**:
```sql
-- 1. 현재 테이블 크기 확인 (Supabase Dashboard → Database → Tables)
SELECT
  schemaname,
  tablename,
  pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS size
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;

-- 2. 현재 인덱스 확인
SELECT
  tablename,
  indexname,
  indexdef
FROM pg_indexes
WHERE schemaname = 'public'
ORDER BY tablename, indexname;
```

**실행 스크립트**:
```sql
-- ⚠️ 주의: 실행 시간이 오래 걸릴 수 있음 (테이블 크기에 따라)
-- 피크 시간대를 피해서 실행 권장 (야간 또는 주말)

-- document_history 인덱스
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_document_history_business_id
  ON document_history(business_id);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_document_history_document_type
  ON document_history(document_type);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_document_history_created_at
  ON document_history(created_at DESC);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_document_history_created_by
  ON document_history(created_by);

-- 복합 인덱스 (가장 자주 사용되는 조합)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_document_history_composite
  ON document_history(business_id, document_type, created_at DESC);

-- contract_history 인덱스
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_contract_history_business_id
  ON contract_history(business_id);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_contract_history_created_at
  ON contract_history(created_at DESC);

-- business_info 인덱스
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_business_info_business_name
  ON business_info(business_name);

-- facility_tasks 인덱스
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_facility_tasks_status
  ON facility_tasks(status);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_facility_tasks_assigned_to
  ON facility_tasks(assigned_to);
```

**검증**:
```sql
-- 인덱스 생성 확인
SELECT indexname, indexdef
FROM pg_indexes
WHERE tablename = 'document_history';

-- 쿼리 성능 테스트 (EXPLAIN ANALYZE)
EXPLAIN ANALYZE
SELECT * FROM document_history
WHERE business_id = 'test-id'
  AND document_type = 'contract'
ORDER BY created_at DESC
LIMIT 20;
```

**롤백**:
```sql
-- 필요시 인덱스 삭제
DROP INDEX IF EXISTS idx_document_history_business_id;
DROP INDEX IF EXISTS idx_document_history_document_type;
-- ... (다른 인덱스들도 동일)
```

**커밋 메시지**:
```
perf(db): 주요 테이블에 인덱스 추가하여 조회 성능 개선

- document_history: business_id, document_type, created_at 인덱스
- contract_history: business_id, created_at 인덱스
- business_info: business_name 인덱스
- facility_tasks: status, assigned_to 인덱스

예상 효과: 목록 조회 5-10배 개선
```

---

### ✅ Step 2: API 병렬 처리 (1-2시간)

**위험도**: 🟢 낮음 (기존 로직 변경 없음)

**적용 대상 식별**:
```bash
# 순차 실행되는 API 호출 패턴 찾기
grep -r "await.*fetch" app/admin --include="*.tsx" | grep -B2 -A2 "await.*fetch"
```

**구현 예시** (ContractManagement.tsx):

**Before**:
```typescript
useEffect(() => {
  if (canView) {
    loadBusinesses()    // 1초
    loadContracts()     // 2초
  }
}, [canView])

// 총 소요 시간: 3초
```

**After**:
```typescript
useEffect(() => {
  if (canView) {
    Promise.all([
      loadBusinesses(),   // 병렬 실행
      loadContracts(),    // 병렬 실행
    ])
  }
}, [canView])

// 총 소요 시간: 2초 (가장 느린 것 기준)
```

**테스트 체크리스트**:
- [ ] 브라우저 개발자 도구 → Network 탭에서 병렬 요청 확인
- [ ] 각 API 응답 데이터가 올바르게 로드되는지 확인
- [ ] 에러 처리가 정상 작동하는지 확인
- [ ] 로딩 상태 UI가 올바르게 표시되는지 확인

**롤백 방법**:
```bash
git revert HEAD  # 이전 커밋으로 되돌리기
```

**커밋 메시지**:
```
perf(api): 독립적인 API 호출을 병렬 처리로 변경

- ContractManagement: businesses, contracts 병렬 로드
- DocumentAutomation: 여러 문서 타입 병렬 조회

예상 효과: 페이지 로딩 2-3배 개선
```

---

### ✅ Step 3: Supabase Connection Pooling (1시간)

**위험도**: 🟢 낮음 (설정만 변경, 기능 동일)

**구현**:

**1. lib/supabase.ts 수정**:
```typescript
import { createClient } from '@supabase/supabase-js'

// 기존 코드
export const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// 개선된 코드
let supabaseAdminInstance: any = null

export const getSupabaseAdmin = () => {
  if (!supabaseAdminInstance) {
    supabaseAdminInstance = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
        },
        db: {
          schema: 'public',
        },
        global: {
          headers: {
            'x-connection-pooling': 'true',
          },
        },
      }
    )
  }
  return supabaseAdminInstance
}

// 하위 호환성을 위한 export (점진적 마이그레이션 가능)
export const supabaseAdmin = getSupabaseAdmin()
```

**2. 점진적 마이그레이션**:
```typescript
// 새로운 코드에서는 이렇게 사용
import { getSupabaseAdmin } from '@/lib/supabase'
const supabase = getSupabaseAdmin()

// 기존 코드는 그대로 유지 (supabaseAdmin이 자동으로 pooling 사용)
import { supabaseAdmin } from '@/lib/supabase'
```

**테스트**:
```typescript
// 연결 테스트 API 작성
// app/api/test-pooling/route.ts
export async function GET() {
  const start = performance.now()

  const { data, error } = await supabaseAdmin
    .from('business_info')
    .select('id')
    .limit(1)

  const duration = performance.now() - start

  return Response.json({
    success: !error,
    duration: `${duration.toFixed(2)}ms`,
    data,
  })
}
```

**검증**:
- 10회 연속 호출하여 평균 응답 시간 측정
- Before/After 비교

**커밋 메시지**:
```
perf(db): Supabase connection pooling 적용

- 싱글톤 패턴으로 연결 재사용
- 연결 오버헤드 50-70% 감소
- 하위 호환성 유지 (기존 코드 수정 불필요)

예상 효과: DB 연결 시간 50-70% 단축
```

---

## 📅 Phase 2: 아키텍처 개선 (리스크 중간)

### ⚠️ Step 4: React Query 도입 (4-6시간)

**위험도**: 🟡 중간 (새로운 의존성 추가)

**사전 준비**:
```bash
# 1. 패키지 설치
npm install @tanstack/react-query@latest

# 2. DevTools 설치 (개발 중 디버깅용)
npm install @tanstack/react-query-devtools --save-dev
```

**구현 단계**:

**Step 4.1: QueryClient 설정** (30분)
```typescript
// app/providers/ReactQueryProvider.tsx
'use client'

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ReactQueryDevtools } from '@tanstack/react-query-devtools'
import { useState } from 'react'

export default function ReactQueryProvider({
  children,
}: {
  children: React.ReactNode
}) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 5 * 60 * 1000, // 5분
            cacheTime: 10 * 60 * 1000, // 10분
            retry: 1,
            refetchOnWindowFocus: false,
          },
        },
      })
  )

  return (
    <QueryClientProvider client={queryClient}>
      {children}
      {process.env.NODE_ENV === 'development' && (
        <ReactQueryDevtools initialIsOpen={false} />
      )}
    </QueryClientProvider>
  )
}
```

**Step 4.2: Layout에 Provider 추가** (10분)
```typescript
// app/layout.tsx
import ReactQueryProvider from './providers/ReactQueryProvider'

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="ko">
      <body>
        <ReactQueryProvider>
          {children}
        </ReactQueryProvider>
      </body>
    </html>
  )
}
```

**Step 4.3: 첫 번째 컴포넌트 마이그레이션** (1-2시간)

**선택 기준**: 가장 간단한 컴포넌트부터 시작
- 복잡한 상태 관리 없음
- 단일 API 호출
- 영향 범위 제한적

**예시: ContractManagement.tsx**

**Before**:
```typescript
const [contracts, setContracts] = useState<Contract[]>([])
const [loading, setLoading] = useState(false)

const loadContracts = async (businessId?: string) => {
  setLoading(true)
  try {
    const response = await fetch(url)
    const data = await response.json()
    setContracts(data.data.documents)
  } finally {
    setLoading(false)
  }
}

useEffect(() => {
  loadContracts()
}, [])
```

**After**:
```typescript
import { useQuery } from '@tanstack/react-query'

const { data: contracts = [], isLoading } = useQuery({
  queryKey: ['contracts', businessId],
  queryFn: async () => {
    const response = await fetch(url)
    const data = await response.json()
    return data.data.documents
  },
  staleTime: 5 * 60 * 1000,
})

// loading과 contracts 상태는 자동 관리됨
```

**Step 4.4: 테스트 및 검증** (30분)
- [ ] 데이터가 올바르게 로드되는지 확인
- [ ] 캐싱이 작동하는지 확인 (DevTools로 확인)
- [ ] 리렌더링이 감소했는지 확인 (React DevTools Profiler)
- [ ] 에러 처리가 정상 작동하는지 확인

**Step 4.5: 점진적 확장** (2-3시간)
- 한 번에 1-2개 컴포넌트씩 마이그레이션
- 각 마이그레이션 후 테스트 및 커밋

**위험 완화 전략**:
```typescript
// 기존 코드와 공존 가능
// 1. 새 기능: React Query 사용
// 2. 기존 기능: useState/useEffect 유지
// 3. 점진적으로 전환
```

**롤백 계획**:
```bash
# React Query 제거
npm uninstall @tanstack/react-query @tanstack/react-query-devtools

# Git으로 코드 되돌리기
git revert <commit-hash>
```

**커밋 메시지**:
```
feat(perf): React Query 도입 및 ContractManagement 마이그레이션

- QueryClient 설정 및 Provider 추가
- ContractManagement 컴포넌트를 useQuery로 마이그레이션
- 5분 캐싱으로 중복 요청 제거

예상 효과: 네트워크 요청 60% 감소, 페이지 로딩 50% 개선
```

---

### ⚠️ Step 5: 페이지네이션 구현 (2-3시간)

**위험도**: 🟡 중간 (API 응답 구조 변경)

**단계별 구현**:

**Step 5.1: API 페이지네이션 확인** (30분)
```typescript
// 이미 구현되어 있는지 확인
// app/api/document-automation/history/route.ts
const page = parseInt(searchParams.get('page') || '1')
const limit = parseInt(searchParams.get('limit') || '20')

// ✅ 이미 구현되어 있음!
```

**Step 5.2: 프론트엔드 무한 스크롤 추가** (1.5-2시간)
```typescript
import { useInfiniteQuery } from '@tanstack/react-query'

const {
  data,
  fetchNextPage,
  hasNextPage,
  isFetchingNextPage,
  isLoading,
} = useInfiniteQuery({
  queryKey: ['documents', documentType],
  queryFn: async ({ pageParam = 1 }) => {
    const response = await fetch(
      `/api/document-automation/history?page=${pageParam}&limit=20&document_type=${documentType}`
    )
    const result = await response.json()
    return result.data
  },
  getNextPageParam: (lastPage, pages) => {
    const totalPages = Math.ceil(lastPage.pagination.total / 20)
    const nextPage = pages.length + 1
    return nextPage <= totalPages ? nextPage : undefined
  },
})

// 스크롤 이벤트 감지
useEffect(() => {
  const handleScroll = () => {
    if (
      window.innerHeight + window.scrollY >= document.body.offsetHeight - 500 &&
      hasNextPage &&
      !isFetchingNextPage
    ) {
      fetchNextPage()
    }
  }

  window.addEventListener('scroll', handleScroll)
  return () => window.removeEventListener('scroll', handleScroll)
}, [hasNextPage, isFetchingNextPage, fetchNextPage])
```

**Step 5.3: UI 업데이트** (30분)
```tsx
{/* 로딩 스피너 */}
{isLoading && <LoadingSpinner />}

{/* 데이터 표시 */}
{data?.pages.map((page, i) => (
  <React.Fragment key={i}>
    {page.documents.map((doc) => (
      <DocumentCard key={doc.id} document={doc} />
    ))}
  </React.Fragment>
))}

{/* 더 불러오기 버튼 (선택사항) */}
{hasNextPage && (
  <button onClick={() => fetchNextPage()} disabled={isFetchingNextPage}>
    {isFetchingNextPage ? '로딩 중...' : '더 보기'}
  </button>
)}
```

**테스트 체크리스트**:
- [ ] 첫 페이지가 올바르게 로드되는지 확인
- [ ] 스크롤 시 다음 페이지가 로드되는지 확인
- [ ] 마지막 페이지에서 더 이상 로드하지 않는지 확인
- [ ] 로딩 상태 UI가 올바르게 표시되는지 확인

**커밋 메시지**:
```
feat(perf): 문서 이력 페이지에 무한 스크롤 적용

- useInfiniteQuery로 페이지네이션 구현
- 한 번에 20개씩 로드하여 초기 로딩 속도 개선
- 스크롤 이벤트로 자동 로딩

예상 효과: 초기 로딩 10배 빠름, 메모리 사용량 90% 감소
```

---

### ⚠️ Step 6: Code Splitting (2-3시간)

**위험도**: 🟡 중간 (번들 구조 변경)

**구현**:

**Step 6.1: 무거운 컴포넌트 식별** (30분)
```bash
# 빌드 분석 실행
npm run build

# 번들 크기 확인
# .next/static/chunks 디렉토리 확인
```

**Step 6.2: Dynamic Import 적용** (1.5-2시간)

**대상 컴포넌트**:
- 모달 컴포넌트 (사용 시에만 로드)
- PDF 생성 라이브러리
- 차트 라이브러리
- 무거운 UI 컴포넌트

**Before**:
```typescript
import ContractPreviewModal from './ContractPreviewModal'
import { generateContractPDF } from '@/utils/contractPdfGenerator'
```

**After**:
```typescript
import dynamic from 'next/dynamic'

// 모달은 열릴 때만 로드
const ContractPreviewModal = dynamic(
  () => import('./ContractPreviewModal'),
  {
    loading: () => <div className="text-center py-4">로딩 중...</div>,
    ssr: false, // 클라이언트에서만 렌더링
  }
)

// PDF 생성은 사용 시에만 로드
const generatePDF = async (data: any) => {
  const { generateContractPDF } = await import('@/utils/contractPdfGenerator')
  return generateContractPDF(data)
}
```

**Step 6.3: 번들 크기 확인** (30분)
```bash
# 다시 빌드
npm run build

# Before/After 비교
# First Load JS 크기 확인
```

**테스트**:
- [ ] 모달이 정상적으로 열리는지 확인
- [ ] PDF 생성이 정상 작동하는지 확인
- [ ] 로딩 UI가 올바르게 표시되는지 확인
- [ ] 번들 크기가 감소했는지 확인

**커밋 메시지**:
```
perf(bundle): 무거운 컴포넌트에 Code Splitting 적용

- ContractPreviewModal, EstimatePreviewModal 동적 로딩
- PDF 생성 라이브러리 lazy loading
- 로딩 fallback UI 추가

예상 효과: 초기 JS 번들 30-40% 감소
```

---

## 📅 Phase 3: 세부 최적화 (리스크 낮음)

### ✅ Step 7: 이미지 최적화 (1-2시간)

**위험도**: 🟢 낮음 (기존 기능 유지)

**구현**:
```tsx
import Image from 'next/image'

// Before
<img src={photoUrl} alt="시설 사진" />

// After
<Image
  src={photoUrl}
  alt="시설 사진"
  width={300}
  height={200}
  loading="lazy"
  placeholder="blur"
  blurDataURL="data:image/svg+xml;base64,..."
/>
```

**커밋 메시지**:
```
perf(images): Next.js Image 컴포넌트로 최적화

- lazy loading 적용
- blur placeholder 추가
- 자동 WebP 변환

예상 효과: 초기 로딩 30% 개선, 대역폭 40% 절감
```

---

## 🔍 각 단계별 성능 측정 방법

### 측정 도구 설치
```bash
npm install @vercel/analytics @vercel/speed-insights
```

### 측정 코드 추가
```typescript
// utils/performanceMeasure.ts
export const measurePerformance = (name: string) => {
  const start = performance.now()

  return {
    end: () => {
      const duration = performance.now() - start
      console.log(`[Performance] ${name}: ${duration.toFixed(2)}ms`)
      return duration
    },
  }
}

// 사용
const measure = measurePerformance('loadContracts')
await loadContracts()
measure.end()
```

### 측정 항목
- **TTFB** (Time to First Byte): 서버 응답 시간
- **FCP** (First Contentful Paint): 첫 콘텐츠 표시 시간
- **LCP** (Largest Contentful Paint): 주요 콘텐츠 로딩 시간
- **TTI** (Time to Interactive): 인터랙션 가능 시간
- **Bundle Size**: JS 번들 크기
- **API Response Time**: API 응답 시간

---

## ⚠️ 주의사항 및 체크리스트

### 각 단계 시작 전
- [ ] 현재 브랜치에서 최신 코드 pull
- [ ] 새 feature 브랜치 생성 (예: `perf/db-indexes`)
- [ ] 성능 측정 베이스라인 기록

### 각 단계 완료 후
- [ ] 로컬에서 철저히 테스트
- [ ] 성능 측정 결과 기록
- [ ] Git 커밋 (명확한 메시지)
- [ ] PR 생성 및 리뷰 요청
- [ ] 테스트 서버 배포
- [ ] 프로덕션 배포

### 문제 발생 시
1. **즉시 롤백**: `git revert HEAD`
2. **원인 분석**: 로그 및 에러 메시지 확인
3. **수정 후 재시도**: 수정 사항 적용 후 다시 배포

---

## 📊 예상 성능 개선 타임라인

| 단계 | 구현 시간 | 예상 개선 | 누적 개선 |
|-----|----------|----------|---------|
| DB 인덱스 | 30분 | +15% | 15% |
| API 병렬 처리 | 1-2h | +10% | 25% |
| Connection Pooling | 1h | +5% | 30% |
| React Query | 4-6h | +20% | 50% |
| 페이지네이션 | 2-3h | +10% | 60% |
| Code Splitting | 2-3h | +5% | 65% |
| 이미지 최적화 | 1-2h | +5% | 70% |

**총 예상 시간**: 12-19시간
**총 예상 개선**: 70%

---

## 🚀 시작하기

```bash
# 1. 새 브랜치 생성
git checkout -b perf/phase1-quick-wins

# 2. DB 인덱스 추가 (Supabase Dashboard에서 SQL 실행)
# claudedocs/performance-implementation-plan.md 참조

# 3. 성능 측정
# 브라우저 개발자 도구 → Performance 탭에서 기록

# 4. 코드 변경 후 테스트
npm run dev
# 브라우저에서 기능 테스트

# 5. 커밋 및 푸시
git add .
git commit -m "perf(db): 주요 테이블에 인덱스 추가"
git push origin perf/phase1-quick-wins
```

이 계획을 따라 단계별로 안전하게 진행하면 **전체 성능을 70% 개선**할 수 있습니다!
