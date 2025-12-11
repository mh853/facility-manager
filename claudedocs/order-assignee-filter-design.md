# 발주 관리 담당자별 필터 기능 설계

## 1. 기능 개요

### 요구사항
- **위치**: `/admin/order-management` → 발주 필요 탭
- **기능**: 업무 관리(facility_tasks)에 등록된 담당자별로 발주 대상 사업장 필터링
- **목적**: 담당자별 발주 업무 현황을 빠르게 파악

### 실현 가능성: ✅ **가능**

## 2. 데이터 구조 분석

### 2.1 관련 테이블

**facility_tasks 테이블**
```sql
CREATE TABLE facility_tasks (
    id UUID PRIMARY KEY,
    business_id UUID REFERENCES business_info(id),
    business_name VARCHAR(255) NOT NULL,
    assignee VARCHAR(100),              -- 담당자 이름 (단일)
    assignees VARCHAR(100)[],           -- 담당자 목록 (다중, 2단계)
    status VARCHAR(50) NOT NULL,        -- product_order = 발주 필요 단계
    is_deleted BOOLEAN DEFAULT false,
    ...
);
```

**발주 필요 조건**:
- `facility_tasks.status = 'product_order'`
- `is_deleted = false`

### 2.2 현재 API 구조

**API Endpoint**: `GET /api/order-management?status=in_progress`

**현재 로직** (`app/api/order-management/route.ts:98-113`):
```typescript
// 발주 필요: facility_tasks에서 status='product_order'인 사업장
const { data: tasks } = await supabaseAdmin
  .from('facility_tasks')
  .select('id, business_id, business_name, task_type, status, updated_at')
  .eq('status', 'product_order')
  .eq('is_deleted', false)
```

**문제점**:
- 현재는 `assignee` 필드를 조회하지 않음
- 담당자 정보가 API 응답에 포함되지 않음

## 3. 설계 방안

### 방안 A: API 수정 + 프론트엔드 필터 (권장)

#### 장점
- 데이터베이스 쿼리 최소화
- 프론트엔드에서 담당자 목록 동적 추출 가능
- 기존 필터 UI 패턴 재사용

#### 구현 단계

**Step 1: API 수정 - assignee 필드 추가**

파일: `/app/api/order-management/route.ts`

```typescript
// Line 99-103: SELECT 쿼리 수정
const { data: tasks, error: taskErr } = await supabaseAdmin
  .from('facility_tasks')
  .select('id, business_id, business_name, task_type, status, updated_at, assignee, assignees')  // 추가
  .eq('status', 'product_order')
  .eq('is_deleted', false)
```

```typescript
// Line 176-225: business_info와 결합 시 assignee 전달
const orderItem: OrderListItem = {
  id: order.id,
  business_id: business.id,
  business_name: business.business_name,
  address: business.address,
  manufacturer: manufacturerKey,
  status: 'in_progress',
  progress_percentage: progressPercentage,
  last_updated: order.updated_at,
  steps_completed: completedSteps,
  steps_total: workflow.total_steps,
  latest_step: latestStep,
  latest_step_date: order[latestStepField],
  assignee: task.assignee,           // 추가
  assignees: task.assignees || []    // 추가
}
```

**Step 2: TypeScript 타입 업데이트**

파일: `/types/order-management.ts`

```typescript
// Line 114-131: OrderListItem 인터페이스 수정
export interface OrderListItem {
  id: string
  business_id: string
  business_name: string
  address: string | null
  manufacturer: Manufacturer
  status: OrderStatus
  progress_percentage: number
  last_updated: string

  steps_completed: number
  steps_total: number
  latest_step: string | null
  latest_step_date: string | null

  // 담당자 정보 추가
  assignee?: string | null          // 단일 담당자
  assignees?: string[]               // 다중 담당자 (2단계 확장)
}
```

```typescript
// Line 136-143: OrderListFilter 인터페이스 수정
export interface OrderListFilter {
  search?: string
  manufacturer?: Manufacturer | 'all'
  status?: OrderStatus | 'all'
  sort?: 'latest' | 'name' | 'updated'
  page?: number
  limit?: number
  assignee?: string | 'all'          // 담당자 필터 추가
}
```

**Step 3: UI 컴포넌트 수정**

파일: `/app/admin/order-management/page.tsx`

```tsx
// State 추가 (Line 30 근처)
const [assigneeFilter, setAssigneeFilter] = useState<string>('all')

// 담당자 목록 자동 추출 (Line 40 근처)
const [assigneeList, setAssigneeList] = useState<string[]>([])

// useEffect에서 담당자 목록 추출
useEffect(() => {
  if (orders.length > 0) {
    const uniqueAssignees = Array.from(
      new Set(
        orders
          .filter(order => order.assignee)
          .map(order => order.assignee as string)
      )
    ).sort()
    setAssigneeList(uniqueAssignees)
  }
}, [orders])

// 필터 적용 로직 (Line 340-401: 필터 섹션)
const filteredOrders = orders.filter(order => {
  // 담당자 필터
  if (assigneeFilter !== 'all' && order.assignee !== assigneeFilter) {
    return false
  }
  return true
})

// UI: 담당자 필터 드롭다운 추가 (Line 359-376 제조사 필터 다음)
<div>
  <select
    value={assigneeFilter}
    onChange={(e) => {
      setAssigneeFilter(e.target.value)
      setCurrentPage(1)
    }}
    className="w-full px-2 sm:px-3 py-1.5 sm:py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent text-xs sm:text-sm"
  >
    <option value="all">전체 담당자</option>
    {assigneeList.map((assignee) => (
      <option key={assignee} value={assignee}>
        {assignee}
      </option>
    ))}
  </select>
</div>

// 필터 초기화 (Line 150-155)
const handleResetFilters = () => {
  setSearchTerm('')
  setManufacturerFilter('all')
  setAssigneeFilter('all')  // 추가
  setSortBy('latest')
  setCurrentPage(1)
}
```

### 방안 B: API 레벨 필터링

#### 장점
- 서버 측에서 필터링하여 데이터 전송량 감소
- 대량 데이터 처리 시 성능 유리

#### 단점
- API 호출 증가
- 프론트엔드 복잡도 증가
- 담당자 목록 별도 API 필요

#### 구현 (간략)

```typescript
// API 쿼리에 assignee 필터 조건 추가
let query = supabaseAdmin
  .from('facility_tasks')
  .select('...')
  .eq('status', 'product_order')
  .eq('is_deleted', false)

if (assigneeParam && assigneeParam !== 'all') {
  query = query.eq('assignee', assigneeParam)
}
```

## 4. 권장 구현 방안

### 선택: 방안 A (프론트엔드 필터)

**이유:**
1. **단순성**: 기존 필터 패턴 재사용
2. **성능**: 발주 필요 탭은 대부분 50건 이하로 프론트엔드 필터링 충분
3. **UX**: 담당자 목록 실시간 업데이트 자동 반영
4. **확장성**: 다중 담당자(assignees) 지원 용이

### 구현 순서
1. ✅ API 수정: `facility_tasks` SELECT에 `assignee`, `assignees` 추가
2. ✅ 타입 수정: `OrderListItem`, `OrderListFilter` 인터페이스 업데이트
3. ✅ UI 수정: 담당자 필터 드롭다운 추가
4. ✅ 로직 수정: 필터 적용 및 초기화 로직 구현
5. ✅ 테스트: 담당자별 필터링 동작 검증

## 5. UI/UX 고려사항

### 필터 배치

**옵션 1: 제조사 필터 옆 (권장)**
```
┌─────────────────────────────────────────────────────┐
│ [사업장명 검색............]                          │
├─────────────────────────────────────────────────────┤
│ [전체 제조사 ▼]  [전체 담당자 ▼]  [최신순 ▼] [🔄] │
└─────────────────────────────────────────────────────┘
```

**옵션 2: 별도 행**
```
┌─────────────────────────────────────────────────────┐
│ [사업장명 검색............]                          │
├─────────────────────────────────────────────────────┤
│ [전체 제조사 ▼]                [최신순 ▼] [🔄]     │
│ [전체 담당자 ▼]                                     │
└─────────────────────────────────────────────────────┘
```

**권장: 옵션 1** - 공간 효율적, 일관된 필터 그룹

### 드롭다운 스타일

- **라벨**: "전체 담당자" (기본값)
- **옵션**: 담당자 이름 (가나다순 정렬)
- **색상**: 제조사 필터와 동일한 스타일
- **반응형**: 모바일에서 전체 너비

### 담당자 정보 표시

**테이블 뷰 (데스크톱)**:
- 담당자 컬럼 추가하지 않음 (공간 부족)
- 상세 모달에서만 표시

**카드 뷰 (모바일)**:
- 사업장명 아래 작은 배지로 표시
- 예: `[김담당]` (회색 배지)

## 6. 데이터 고려사항

### 담당자 없는 케이스 처리

```typescript
// 담당자 미지정 업무 처리
if (assigneeFilter === 'all' || !order.assignee) {
  // 전체 보기 또는 담당자 없음
  return true
}
```

**옵션**:
1. 담당자 없는 업무는 항상 표시
2. "담당자 미지정" 옵션 추가

**권장**: 옵션 1 (담당자 없는 업무는 항상 표시)

### 다중 담당자 (2단계 확장)

현재 스키마는 `assignees` 배열 지원:
```typescript
// 다중 담당자 필터링
if (assigneeFilter !== 'all') {
  const hasAssignee =
    order.assignee === assigneeFilter ||
    order.assignees?.includes(assigneeFilter)
  if (!hasAssignee) return false
}
```

## 7. 성능 고려사항

### 데이터 규모 예상
- 발주 필요 탭: 평균 20-50건
- 담당자 수: 5-10명
- 응답 크기: ~50KB (담당자 필드 추가 시)

### 최적화 전략
- 프론트엔드 필터링으로 API 호출 최소화
- 담당자 목록은 `useMemo`로 메모이제이션
- 필터 변경 시 `setCurrentPage(1)` 로 페이지 초기화

## 8. 테스트 시나리오

### 기능 테스트

1. **담당자 필터 선택**
   - "전체 담당자" 선택 → 모든 업무 표시
   - 특정 담당자 선택 → 해당 담당자 업무만 표시

2. **필터 조합**
   - 제조사 + 담당자 필터 동시 적용
   - 검색 + 담당자 필터 조합

3. **담당자 없는 업무**
   - assignee = null인 업무 표시 여부 확인

4. **필터 초기화**
   - 초기화 버튼 클릭 시 담당자 필터도 "전체 담당자"로 리셋

### Edge Cases

- 담당자가 0명인 경우: 드롭다운 "담당자 없음" 표시
- 담당자가 1명인 경우: 드롭다운에 1개 옵션만 표시
- 페이지 이동 후 필터 유지 여부 확인

## 9. 확장 가능성

### 향후 개선 사항

1. **다중 담당자 필터**
   - 여러 담당자 동시 선택 (체크박스)

2. **담당자 통계**
   - 담당자별 발주 업무 건수 표시
   - 예: "김담당 (5건)"

3. **담당자 자동완성**
   - 검색 가능한 담당자 드롭다운

4. **담당자별 배지**
   - 테이블 또는 카드에 담당자 배지 표시

## 10. 구현 파일 목록

### 수정 파일
1. `/app/api/order-management/route.ts` - API 로직 (assignee 필드 추가)
2. `/types/order-management.ts` - 타입 정의 (assignee, assigneeFilter 추가)
3. `/app/admin/order-management/page.tsx` - UI 컴포넌트 (필터 UI 추가)

### 변경 라인 수 예상
- API: ~5 lines (SELECT 쿼리 1줄, assignee 전달 2줄)
- Type: ~3 lines (OrderListItem 2줄, OrderListFilter 1줄)
- UI: ~40 lines (state 추가, 드롭다운 UI, 필터 로직)
- **총 예상**: ~50 lines

## 11. 다음 단계

1. ✅ 설계 검토 및 승인
2. ⏳ API 수정 (assignee 필드 추가)
3. ⏳ 타입 정의 업데이트
4. ⏳ UI 컴포넌트 구현
5. ⏳ 테스트 및 검증
6. ⏳ 코드 리뷰 및 배포

## 12. 참고: 현재 시스템 구조

### 발주 필요 탭 로직
```
facility_tasks (status='product_order')
  ↓ JOIN
business_info (manufacturer, address 등)
  ↓ JOIN
order_management (진행률, 단계 정보)
  ↓ 결합
OrderListItem[] (프론트엔드 표시)
```

### 담당자 데이터 흐름
```
facility_tasks.assignee (DB)
  ↓ API SELECT
tasks[].assignee
  ↓ 결합
OrderListItem.assignee
  ↓ 필터링
filteredOrders (UI 표시)
```
