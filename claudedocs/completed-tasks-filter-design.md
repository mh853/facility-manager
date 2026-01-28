# 완료된 업무 필터링 기능 설계

## 📋 요구사항

1. **칸반보드 기본 동작**: 진행률 100% (완료된) 업무는 칸반보드에서 기본적으로 숨김
2. **완료 업무 필터**: 상단 필터 영역에 "완료된 업무 보기" 토글 버튼/체크박스 추가
3. **선택적 표시**: 사용자가 원할 때만 완료된 업무를 확인 가능

---

## 🎯 현재 상태 분석

### 진행률 100% 판정 기준

**각 업무 타입별 마지막 단계**:

```typescript
// 자비 (self) - 12단계
selfSteps: 'document_complete' (12/12 = 100%)

// 보조금 (subsidy) - 24단계
subsidySteps: 'subsidy_payment' (24/24 = 100%)

// 기타 (etc) - 1단계
etcSteps: 'etc_status' (1/1 = 100%)

// AS - 6단계
asSteps: 'as_completed' (6/6 = 100%)
```

### 완료 판정 함수

```typescript
const isTaskCompleted = (task: Task): boolean => {
  return task.progressPercentage === 100
}
```

또는 더 명확하게:

```typescript
const isTaskCompleted = (task: Task): boolean => {
  const completedStatuses: TaskStatus[] = [
    'document_complete',    // 자비 완료
    'subsidy_payment',      // 보조금 완료
    'as_completed',         // AS 완료
    'etc_status'            // 기타 (항상 100%)
  ]
  return completedStatuses.includes(task.status)
}
```

---

## ✅ 설계 방안

### 1. 상태 관리

**새로운 상태 추가** (Line 200+ 근처):

```typescript
const [showCompletedTasks, setShowCompletedTasks] = useState(false) // 기본값: false (숨김)
```

### 2. 필터링 로직 수정

**filteredTasks useMemo 수정** (Line 669-686):

```typescript
const filteredTasks = useMemo(() => {
  return tasksWithDelayStatus.filter(task => {
    const matchesSearch = searchTerm === '' ||
      task.description?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      task.businessName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      task.assignee?.toLowerCase().includes(searchTerm.toLowerCase())

    const matchesType = selectedType === 'all' || task.type === selectedType
    const matchesPriority = selectedPriority === 'all' || task.priority === selectedPriority
    const matchesAssignee = selectedAssignee === 'all' ||
      task.assignee === selectedAssignee ||
      (task.assignees && Array.isArray(task.assignees) &&
       task.assignees.some((assignee: any) => assignee.name === selectedAssignee))

    // 🆕 완료된 업무 필터링
    const isCompleted = task.progressPercentage === 100
    const matchesCompletionFilter = showCompletedTasks || !isCompleted

    return matchesSearch && matchesType && matchesPriority && matchesAssignee && matchesCompletionFilter
  })
}, [tasksWithDelayStatus, searchTerm, selectedType, selectedPriority, selectedAssignee, showCompletedTasks])
```

### 3. UI 컴포넌트 추가

**옵션 A: 체크박스 형태**

```tsx
{/* 필터 영역 내부 (Line 1350+ 근처) */}
<div className="flex items-center gap-2">
  <input
    type="checkbox"
    id="showCompleted"
    checked={showCompletedTasks}
    onChange={(e) => setShowCompletedTasks(e.target.checked)}
    className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500"
  />
  <label
    htmlFor="showCompleted"
    className="text-sm font-medium text-gray-700 cursor-pointer select-none"
  >
    완료된 업무 보기
  </label>
  {showCompletedTasks && (
    <span className="text-xs text-gray-500">
      ({tasks.filter(t => t.progressPercentage === 100).length}개)
    </span>
  )}
</div>
```

**옵션 B: 토글 버튼 형태** (권장)

```tsx
{/* 필터 영역 내부 */}
<button
  onClick={() => setShowCompletedTasks(!showCompletedTasks)}
  className={`
    px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200
    ${showCompletedTasks
      ? 'bg-green-100 text-green-700 border-2 border-green-300 shadow-sm'
      : 'bg-gray-100 text-gray-600 border-2 border-gray-200 hover:bg-gray-200'
    }
  `}
>
  <div className="flex items-center gap-2">
    {showCompletedTasks ? (
      <CheckCircle className="w-4 h-4" />
    ) : (
      <Eye className="w-4 h-4" />
    )}
    <span>완료된 업무 {showCompletedTasks ? '숨기기' : '보기'}</span>
    {showCompletedTasks && (
      <span className="ml-1 px-2 py-0.5 bg-green-200 text-green-800 rounded-full text-xs font-semibold">
        {tasks.filter(t => t.progressPercentage === 100).length}
      </span>
    )}
  </div>
</button>
```

### 4. 배치 위치

**필터 영역 구조** (Line 1300-1450 근처):

```tsx
<div className="mb-6 space-y-4">
  {/* 상단 필터 행 */}
  <div className="flex flex-wrap items-center gap-3">
    {/* 검색 */}
    <div className="relative flex-1 min-w-[200px]">...</div>

    {/* 업무 타입 필터 */}
    <select ...>...</select>

    {/* 우선순위 필터 */}
    <select ...>...</select>

    {/* 담당자 필터 */}
    <select ...>...</select>

    {/* 🆕 완료 업무 필터 토글 */}
    <button onClick={...}>
      완료된 업무 {showCompletedTasks ? '숨기기' : '보기'}
    </button>
  </div>

  {/* 통계 정보 */}
  <div className="flex items-center justify-between">
    <span>총 {filteredTasks.length}개 업무</span>
    ...
  </div>
</div>
```

---

## 🎨 UI/UX 고려사항

### 1. 기본 동작

- **기본값**: `showCompletedTasks = false` (완료된 업무 숨김)
- **이유**: 진행 중인 업무에 집중, 칸반보드 가독성 향상

### 2. 시각적 피드백

**토글 활성화 시**:
- 버튼 색상: 회색 → 초록색
- 아이콘: Eye → CheckCircle
- 완료 업무 개수 뱃지 표시

**토글 비활성화 시**:
- 버튼 색상: 초록색 → 회색
- 아이콘: CheckCircle → Eye
- 완료 업무가 사라지는 애니메이션 (CSS transition)

### 3. 반응형 디자인

**모바일 (< 768px)**:
```tsx
<button className="w-full sm:w-auto px-4 py-2 ...">
  {/* 아이콘만 표시 또는 짧은 텍스트 */}
</button>
```

**데스크톱 (>= 768px)**:
```tsx
<button className="px-4 py-2 ...">
  {/* 아이콘 + 전체 텍스트 표시 */}
</button>
```

---

## 📊 완료 업무 판정 로직

### 방법 1: 진행률 기반 (권장)

```typescript
const isCompleted = task.progressPercentage === 100
```

**장점**:
- 간단하고 명확
- `calculateProgressPercentage()` 함수 재사용
- 타입별로 자동 대응

**단점**:
- 진행률 계산에 의존

### 방법 2: Status 기반 (명시적)

```typescript
const completedStatuses: Record<TaskType, TaskStatus[]> = {
  self: ['document_complete'],
  subsidy: ['subsidy_payment'],
  as: ['as_completed'],
  etc: ['etc_status']
}

const isCompleted = (task: Task): boolean => {
  return completedStatuses[task.type]?.includes(task.status) || false
}
```

**장점**:
- 명시적이고 유지보수 용이
- 진행률 계산 오류에 영향받지 않음

**단점**:
- 새로운 완료 상태 추가 시 수동 업데이트 필요

**권장**: **방법 1 (진행률 기반)** - 간단하고 자동 대응

---

## 🔧 구현 단계

### Step 1: 상태 추가
```typescript
// Line 200+ 근처
const [showCompletedTasks, setShowCompletedTasks] = useState(false)
```

### Step 2: 필터링 로직 수정
```typescript
// Line 669-686 수정
const matchesCompletionFilter = showCompletedTasks || !isCompleted
```

### Step 3: UI 컴포넌트 추가
```tsx
// Line 1350+ 근처 필터 영역에 토글 버튼 추가
<button onClick={() => setShowCompletedTasks(!showCompletedTasks)}>
  ...
</button>
```

### Step 4: 완료 업무 개수 표시
```tsx
{showCompletedTasks && (
  <span className="...">
    {tasks.filter(t => t.progressPercentage === 100).length}개
  </span>
)}
```

---

## 🧪 테스트 시나리오

### 1. 기본 동작 테스트
- [ ] 페이지 로드 시 완료된 업무가 숨겨져 있는지 확인
- [ ] 진행 중인 업무만 칸반보드에 표시되는지 확인

### 2. 토글 기능 테스트
- [ ] "완료된 업무 보기" 버튼 클릭 시 완료된 업무가 표시되는지 확인
- [ ] 버튼 색상과 아이콘이 올바르게 변경되는지 확인
- [ ] 완료 업무 개수가 정확하게 표시되는지 확인

### 3. 필터 조합 테스트
- [ ] 완료 업무 보기 + 업무 타입 필터 조합
- [ ] 완료 업무 보기 + 담당자 필터 조합
- [ ] 완료 업무 보기 + 검색 조합

### 4. 진행률 100% 판정 테스트
- [ ] 자비 업무: `document_complete` 상태 → 100%
- [ ] 보조금 업무: `subsidy_payment` 상태 → 100%
- [ ] AS 업무: `as_completed` 상태 → 100%
- [ ] 기타 업무: `etc_status` 상태 → 100%

### 5. 반응형 테스트
- [ ] 모바일 뷰에서 버튼이 올바르게 표시되는지 확인
- [ ] 데스크톱 뷰에서 레이아웃이 깨지지 않는지 확인

---

## 📊 기대 효과

### 1. 업무 집중도 향상
- 진행 중인 업무에만 집중 가능
- 칸반보드 가독성 대폭 개선

### 2. 유연한 업무 관리
- 필요 시 완료된 업무 확인 가능
- 과거 업무 이력 추적 용이

### 3. 성능 최적화
- 렌더링되는 업무 카드 수 감소
- 칸반보드 로딩 속도 향상

---

## 🎯 향후 개선 방안

### 1. LocalStorage 저장
```typescript
useEffect(() => {
  const saved = localStorage.getItem('showCompletedTasks')
  if (saved !== null) {
    setShowCompletedTasks(JSON.parse(saved))
  }
}, [])

useEffect(() => {
  localStorage.setItem('showCompletedTasks', JSON.stringify(showCompletedTasks))
}, [showCompletedTasks])
```

### 2. 완료 일자 기준 필터
- 최근 1주일/1개월 내 완료된 업무만 표시
- 완료 일자가 오래된 업무는 자동 아카이브

### 3. 완료 업무 통계
- 완료율 차트 (월별/팀별)
- 평균 완료 소요 시간

---

## 📝 구현 체크리스트

### Frontend (app/admin/tasks/page.tsx)

- [ ] Line 200+: `showCompletedTasks` 상태 추가
- [ ] Line 669-686: `filteredTasks` 필터링 로직에 완료 업무 필터 추가
- [ ] Line 1350+: 필터 영역에 토글 버튼 UI 추가
- [ ] 완료 업무 개수 표시 로직 추가

### Testing

- [ ] 기본 동작 테스트 (완료 업무 숨김)
- [ ] 토글 기능 테스트 (보기/숨기기)
- [ ] 필터 조합 테스트
- [ ] 진행률 100% 판정 테스트
- [ ] 반응형 테스트

### Documentation

- [ ] 이 설계 문서 작성 완료
- [ ] 사용자 가이드 업데이트 (선택)

---

## 🎨 최종 UI 레이아웃

```
┌─────────────────────────────────────────────────────────────┐
│ 업무 관리 칸반보드                                              │
├─────────────────────────────────────────────────────────────┤
│ [검색] [타입▼] [우선순위▼] [담당자▼] [✓ 완료된 업무 보기 (5)] │
│ 총 25개 업무 | 긴급: 3 | 지연: 2 | 위험: 1                    │
├─────────────────────────────────────────────────────────────┤
│ 칸반보드 컬럼들...                                             │
│ (완료 업무 제외 또는 포함)                                      │
└─────────────────────────────────────────────────────────────┘
```

---

**작성일**: 2026-01-27
**작성자**: Claude Sonnet 4.5
**상태**: 설계 완료, 구현 준비
