# 실사관리 페이지 UI 개선 설계 (페이지네이션 적용)

## 현재 문제점

### 1. 공간 낭비
- "등록된 사업장: 228개" 영역이 상단에 독립적으로 존재
- 검색 결과에 동일한 정보("검색 결과: 228개")가 중복 표시
- 불필요한 카드 래퍼로 인한 여백 과다

### 2. 스크롤 불일치
- 사업장 리스트가 고정 높이(`max-h-[600px]`) 영역 내에서만 스크롤
- 페이지 전체 스크롤과 분리되어 UI 통일성 부족
- 다른 페이지들은 테이블 + 페이지네이션 패턴 사용

### 3. 일관성 부족
- Admin 페이지들: 테이블 + 페이지네이션
- 실사관리 페이지: 카드 + 내부 스크롤
- 디자인 패턴 불일치

## 개선 방안

### 1. 레이아웃 간소화
```
BEFORE:
┌─────────────────────────────────────────┐
│ [Header: 실사관리]          [새로고침]  │
├─────────────────────────────────────────┤
│ ┌─────────────────────────────────────┐ │
│ │ 등록된 사업장: 228개  ● 실시간 연결│ │  ← 제거
│ └─────────────────────────────────────┘ │
│                                          │
│ ┌─────────────────────────────────────┐ │
│ │ [검색 & 필터]                        │ │
│ │ 검색 결과: 228개 / 전체 228개        │ │
│ └─────────────────────────────────────┘ │
│                                          │
│ ┌─────────────────────────────────────┐ │
│ │ [사업장 리스트 - 스크롤 영역]        │ │  ← 카드 제거
│ │ max-h-[600px] overflow-y-auto        │ │
│ │ ...                                  │ │
│ └─────────────────────────────────────┘ │
└─────────────────────────────────────────┘

AFTER:
┌─────────────────────────────────────────┐
│ [Header: 실사관리]          [새로고침]  │
├─────────────────────────────────────────┤
│ ┌─────────────────────────────────────┐ │
│ │ [검색 & 필터]                        │ │
│ │ 228개 결과                           │ │  ← 간결하게 통합
│ └─────────────────────────────────────┘ │
│                                          │
│ [사업장 리스트 - 페이지 전체 스크롤]    │  ← 직접 렌더링
│ (유)태현환경                             │
│ (유)프라티스킨인터내셔널                 │
│ ...                                      │
│                                          │
│ [페이지네이션]                           │  ← 새로 추가
│ ◀ 1 2 3 4 5 ... 23 ▶                    │
└─────────────────────────────────────────┘
```

### 2. 페이지네이션 도입
- **페이지당 항목 수**: 20개 (조정 가능)
- **표시 페이지 번호**: 현재 ±2 페이지 + 처음/마지막
- **빠른 이동**: 처음/이전/다음/마지막 버튼

## 컴포넌트 구조

### Pagination 컴포넌트 설계

```typescript
interface PaginationProps {
  currentPage: number;
  totalItems: number;
  itemsPerPage: number;
  onPageChange: (page: number) => void;
  maxPageButtons?: number; // 기본값: 5
}

// 계산 로직
const totalPages = Math.ceil(totalItems / itemsPerPage);
const startPage = Math.max(1, currentPage - 2);
const endPage = Math.min(totalPages, currentPage + 2);
```

### UI 구조

```tsx
<div className="flex items-center justify-between px-6 py-4 border-t">
  {/* 왼쪽: 항목 범위 표시 */}
  <div className="text-sm text-gray-600">
    {startItem}-{endItem} / 전체 {totalItems}개
  </div>

  {/* 가운데: 페이지 번호 */}
  <div className="flex items-center gap-2">
    <button disabled={currentPage === 1}>◀ 이전</button>

    {startPage > 1 && (
      <>
        <button onClick={() => onPageChange(1)}>1</button>
        {startPage > 2 && <span>...</span>}
      </>
    )}

    {Array.from({ length: endPage - startPage + 1 }).map((_, i) => (
      <button
        key={startPage + i}
        onClick={() => onPageChange(startPage + i)}
        className={currentPage === startPage + i ? 'active' : ''}
      >
        {startPage + i}
      </button>
    ))}

    {endPage < totalPages && (
      <>
        {endPage < totalPages - 1 && <span>...</span>}
        <button onClick={() => onPageChange(totalPages)}>{totalPages}</button>
      </>
    )}

    <button disabled={currentPage === totalPages}>다음 ▶</button>
  </div>

  {/* 오른쪽: 페이지당 항목 수 선택 */}
  <select value={itemsPerPage} onChange={handleItemsPerPageChange}>
    <option value={10}>10개씩</option>
    <option value={20}>20개씩</option>
    <option value={50}>50개씩</option>
    <option value={100}>100개씩</option>
  </select>
</div>
```

## 상태 관리

### 페이지네이션 State

```typescript
const [currentPage, setCurrentPage] = useState(1);
const [itemsPerPage, setItemsPerPage] = useState(20);

// 현재 페이지 항목 계산
const paginatedList = useMemo(() => {
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  return filteredList.slice(startIndex, endIndex);
}, [filteredList, currentPage, itemsPerPage]);

// 필터 변경 시 첫 페이지로 리셋
useEffect(() => {
  setCurrentPage(1);
}, [searchTerm, inspectorName, dateFrom, dateTo, photoStatus, phases]);
```

## 레이아웃 변경

### facility/page.tsx 구조 변경

```typescript
// BEFORE: 카드 래퍼 + 스크롤 영역
<div className="max-w-4xl mx-auto space-y-6">
  <div className="bg-white rounded-lg shadow-sm border px-6 py-4">
    등록된 사업장: 228개
  </div>

  <FilterPanel ... />

  <div className="bg-white rounded-lg shadow-lg border">
    <div className="max-h-[600px] overflow-y-auto">
      {filteredList.map(...)}
    </div>
  </div>
</div>

// AFTER: 플랫 구조 + 페이지네이션
<div className="max-w-6xl mx-auto space-y-6">
  <FilterPanel ... />

  <div className="bg-white rounded-lg shadow-sm border">
    {/* 사업장 리스트 (페이지네이션) */}
    <div className="divide-y">
      {paginatedList.map(...)}
    </div>

    {/* 페이지네이션 */}
    <Pagination
      currentPage={currentPage}
      totalItems={filteredList.length}
      itemsPerPage={itemsPerPage}
      onPageChange={setCurrentPage}
    />
  </div>
</div>
```

### FilterPanel 검색 결과 표시 개선

```typescript
// BEFORE
<div className="px-6 py-3 bg-white">
  <p className="text-sm text-gray-600">
    검색 결과: <strong>228개</strong>
    <span className="text-gray-400"> / 전체 228개</span>
  </p>
</div>

// AFTER (더 간결하게)
<div className="px-6 py-3 bg-gray-50 border-t">
  <p className="text-sm text-gray-600">
    <strong className="text-blue-600">{filteredCount}개</strong> 결과
    {filteredCount !== totalCount && (
      <span className="text-gray-400 ml-1">(전체 {totalCount}개)</span>
    )}
  </p>
</div>
```

## 스타일 가이드

### 페이지네이션 버튼

```css
/* 기본 버튼 */
.pagination-button {
  @apply px-3 py-2 text-sm border border-gray-300 rounded hover:bg-gray-50;
}

/* 활성 버튼 */
.pagination-button-active {
  @apply bg-blue-600 text-white border-blue-600 hover:bg-blue-700;
}

/* 비활성 버튼 */
.pagination-button-disabled {
  @apply opacity-50 cursor-not-allowed;
}
```

## 성능 최적화

### 1. 메모이제이션
```typescript
// 페이지네이션 계산 캐싱
const paginatedList = useMemo(() => {
  const start = (currentPage - 1) * itemsPerPage;
  return filteredList.slice(start, start + itemsPerPage);
}, [filteredList, currentPage, itemsPerPage]);
```

### 2. 가상화 (선택 사항)
- 항목이 1000개 이상일 경우 react-window 고려
- 현재는 228개로 페이지네이션만으로 충분

## 접근성 (A11y)

### 페이지네이션 접근성

```tsx
<nav aria-label="페이지네이션">
  <ul className="flex items-center gap-2">
    <li>
      <button
        aria-label="이전 페이지"
        disabled={currentPage === 1}
        aria-disabled={currentPage === 1}
      >
        ◀ 이전
      </button>
    </li>

    <li>
      <button
        aria-label={`페이지 ${pageNum}`}
        aria-current={currentPage === pageNum ? 'page' : undefined}
      >
        {pageNum}
      </button>
    </li>

    <li>
      <button
        aria-label="다음 페이지"
        disabled={currentPage === totalPages}
        aria-disabled={currentPage === totalPages}
      >
        다음 ▶
      </button>
    </li>
  </ul>
</nav>
```

## 구현 단계

### Phase 1: Pagination 컴포넌트 생성
1. `components/Pagination.tsx` 생성
2. Props 인터페이스 정의
3. 페이지 번호 계산 로직 구현
4. 스타일 적용

### Phase 2: facility/page.tsx 리팩토링
1. 페이지네이션 상태 추가
2. `paginatedList` useMemo 구현
3. 레이아웃 구조 변경 (카드 제거, 플랫 구조)
4. Pagination 컴포넌트 통합

### Phase 3: 불필요한 요소 제거
1. "등록된 사업장" 통계 카드 제거
2. 사업장 리스트 래퍼 카드 제거
3. 스크롤 영역 제한 제거 (`max-h-[600px]` 삭제)

### Phase 4: FilterPanel 간소화
1. 검색 결과 표시 간결화
2. 통계 정보 통합

## 예상 효과

### 공간 효율
- ✅ 불필요한 여백 제거로 컨텐츠 밀도 증가
- ✅ 중복 정보 제거로 깔끔한 UI
- ✅ 카드 래퍼 제거로 시각적 간결성 향상

### 사용성
- 🚀 페이지 전체 스크롤로 자연스러운 네비게이션
- 🚀 페이지네이션으로 대량 데이터 빠른 탐색
- 🚀 일관된 UI 패턴으로 학습 곡선 감소

### 일관성
- 🎯 Admin 페이지들과 동일한 패턴
- 🎯 테이블 + 페이지네이션 표준화
- 🎯 통일된 사용자 경험

### 성능
- ⚡ 렌더링 항목 수 제한 (20개씩)
- ⚡ 메모이제이션으로 불필요한 재계산 방지
- ⚡ 대량 데이터 처리 최적화

## 마이그레이션 가이드

### 기존 사용자 영향
- **변경 없음**: 필터링 로직 동일
- **개선**: 페이지네이션으로 더 빠른 탐색
- **익숙함**: 다른 Admin 페이지와 동일한 패턴

### 브라우저 호환성
- 모든 현대 브라우저 지원
- IE11 미지원 (프로젝트 요구사항 확인 필요)
