# 담당자 필터 디버깅 가이드

## 문제 현상
담당자 필터 드롭다운이 표시되지만, 선택 가능한 담당자 목록이 비어있음

## 디버깅 단계

### 1. 브라우저 콘솔 확인
브라우저 개발자 도구(F12)를 열고 Console 탭에서 다음 로그 확인:

```javascript
// API 응답 확인
[ORDER-MANAGEMENT-PAGE] API 응답: {
  ordersCount: X,
  orders: [
    {
      business_name: "...",
      assignee: "담당자명",  // ← 이 값이 있는지 확인
      assignees: []
    }
  ]
}

// 담당자 추출 확인
[ASSIGNEE-FILTER] 담당자 추출 시작: {
  totalOrders: X,
  ordersWithAssignee: Y,  // ← assignee가 있는 항목 개수
  assigneeValues: [...]
}

// 최종 담당자 목록
[ASSIGNEE-FILTER] 추출된 담당자 목록: ["담당자1", "담당자2", ...]
```

### 2. 데이터베이스 직접 확인
Supabase 대시보드에서 SQL 실행:

```sql
-- facility_tasks에서 product_order 상태의 담당자 확인
SELECT
  id,
  business_name,
  assignee,
  assignees,
  status,
  created_at
FROM facility_tasks
WHERE status = 'product_order'
  AND is_deleted = false
ORDER BY created_at DESC;
```

**확인 사항:**
- `assignee` 컬럼에 값이 있는지 (NULL이면 드롭다운에 안 나타남)
- `assignees` 배열에 값이 있는지
- `status`가 정확히 'product_order'인지

### 3. API 응답 직접 확인
브라우저 Network 탭에서:

1. `/api/order-management?status=in_progress` 요청 찾기
2. Response 탭에서 `assignee` 필드 확인
3. 각 order 객체에 `assignee: "담당자명"` 또는 `assignee: null`인지 확인

### 4. 가능한 원인과 해결 방법

#### Case 1: assignee 데이터가 DB에 없음
**증상**: 콘솔에서 `ordersWithAssignee: 0`
**원인**: facility_tasks 테이블에 담당자가 할당되지 않음
**해결**: 업무 관리 페이지에서 담당자를 할당해야 함

```sql
-- 담당자 수동 할당 (테스트용)
UPDATE facility_tasks
SET assignee = '김담당'
WHERE status = 'product_order' AND assignee IS NULL
LIMIT 1;
```

#### Case 2: API가 assignee를 반환하지 않음
**증상**: Network 탭에서 assignee 필드가 없음
**원인**: API 쿼리에서 assignee를 SELECT하지 않음
**확인**: `/app/api/order-management/route.ts:101` 확인
```typescript
.select('id, business_id, business_name, task_type, status, updated_at, assignee, assignees')
```

#### Case 3: 타입 정의 불일치
**증상**: TypeScript 에러 또는 undefined
**원인**: OrderListItem 인터페이스에 assignee 필드가 없음
**확인**: `/types/order-management.ts:133-134` 확인

#### Case 4: 프론트엔드 필터링 로직 오류
**증상**: API에는 데이터가 있지만 목록 추출 안 됨
**원인**: useEffect 의존성 또는 필터 로직 오류
**확인**:
- `orders.length > 0` 체크
- `activeTab === 'in_progress'` 체크
- `.filter(order => order.assignee)` 로직

### 5. 즉시 확인 가능한 테스트

브라우저 콘솔에서 직접 실행:

```javascript
// 1. 현재 orders 상태 확인
// (React DevTools 필요 또는 window에 임시로 노출)

// 2. 담당자 추출 로직 테스트
const orders = [
  { business_name: "테스트1", assignee: "김담당" },
  { business_name: "테스트2", assignee: "박담당" },
  { business_name: "테스트3", assignee: null },
  { business_name: "테스트4", assignee: "김담당" }
];

const uniqueAssignees = Array.from(
  new Set(
    orders
      .filter(order => order.assignee)
      .map(order => order.assignee)
  )
).sort();

console.log(uniqueAssignees); // ["김담당", "박담당"]
```

### 6. 임시 해결책 (테스트용)

만약 급하게 테스트해야 한다면:

```typescript
// page.tsx의 useEffect에 하드코딩
useEffect(() => {
  if (activeTab === 'in_progress') {
    // 임시 테스트 데이터
    setAssigneeList(['김담당', '박담당', '이담당'])
  } else {
    setAssigneeList([])
  }
}, [activeTab])
```

## 예상 시나리오

### 시나리오 A: DB에 담당자 데이터가 없음
**가장 가능성 높음**

facility_tasks 테이블의 assignee 컬럼이 모두 NULL인 경우:
- 콘솔: `ordersWithAssignee: 0`
- 콘솔: `추출된 담당자 목록: []`
- 해결: 업무 관리에서 담당자 할당 필요

### 시나리오 B: 다중 담당자 필드(assignees)만 있음
facility_tasks에서 assignees 배열만 사용하고 assignee는 비어있는 경우:
- API는 assignees: ["담당자1", "담당자2"]를 반환
- 하지만 프론트엔드는 assignee(단일)만 체크
- 해결: assignees 배열도 추출하도록 로직 수정

```typescript
// 수정된 추출 로직
const uniqueAssignees = Array.from(
  new Set(
    orders.flatMap(order => {
      const list = [];
      if (order.assignee) list.push(order.assignee);
      if (order.assignees?.length) list.push(...order.assignees);
      return list;
    })
  )
).sort();
```

### 시나리오 C: 탭 전환 타이밍 이슈
activeTab이 변경되기 전에 orders가 로드되는 경우:
- useEffect 실행 순서 문제
- 해결: useEffect 의존성 배열 확인

## 다음 단계

1. **즉시**: 브라우저 콘솔 로그 확인
2. **DB 확인**: Supabase에서 실제 assignee 데이터 존재 여부
3. **원인 파악**: 위 시나리오 중 어디에 해당하는지 확인
4. **해결 적용**: 원인에 맞는 해결책 적용
5. **로그 제거**: 디버깅 완료 후 console.log 제거

## 체크리스트

- [ ] 브라우저 콘솔에서 `[ORDER-MANAGEMENT-PAGE] API 응답` 로그 확인
- [ ] 각 order에 `assignee` 필드가 있는지 확인
- [ ] `assignee` 값이 `null`이 아닌지 확인
- [ ] `[ASSIGNEE-FILTER] 담당자 추출 시작` 로그 확인
- [ ] `ordersWithAssignee` 개수 확인
- [ ] `추출된 담당자 목록` 배열에 값이 있는지 확인
- [ ] Supabase에서 facility_tasks.assignee 데이터 존재 확인
- [ ] "발주 필요" 탭에서 확인하고 있는지 재확인
