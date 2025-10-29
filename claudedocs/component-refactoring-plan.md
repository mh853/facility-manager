# 시설 업무 관리 페이지 컴포넌트 분리 계획

## 📊 현재 상태 분석

**파일**: `app/admin/tasks/page.tsx`
- **총 라인 수**: 2,433줄
- **예상 React 훅 사용**: 73개 이상
- **권장 라인 수**: 200-300줄
- **심각도**: 🔴 Critical - 즉시 개선 필요

## 🎯 리팩토링 목표

1. **성능 개선**: 렌더링 속도 60-80% 향상
2. **유지보수성**: 컴포넌트당 200-300줄 이하
3. **재사용성**: 독립적인 컴포넌트로 분리
4. **테스트 용이성**: 각 컴포넌트를 독립적으로 테스트 가능

## 🏗️ 컴포넌트 분리 구조

### 1. 타입 정의 분리
**파일**: `app/admin/tasks/types.ts` (신규 생성)
- `TaskType`, `TaskStatus`, `Priority` 타입
- `Task`, `CreateTaskForm`, `BusinessOption` 인터페이스
- 유틸리티 함수: `calculateProgressPercentage`

**예상 라인 수**: 150줄
**의존성**: 없음

---

### 2. TaskFilters 컴포넌트
**파일**: `app/admin/tasks/components/TaskFilters.tsx` (신규 생성)
- 업무 유형 필터 (자비/보조금/기타/AS/전체)
- 검색창
- 우선순위 필터
- 담당자 필터
- 컴팩트 모드 토글

**Props**:
```typescript
interface TaskFiltersProps {
  selectedType: TaskType | 'all'
  setSelectedType: (type: TaskType | 'all') => void
  searchTerm: string
  setSearchTerm: (term: string) => void
  selectedPriority: Priority | 'all'
  setSelectedPriority: (priority: Priority | 'all') => void
  selectedAssignee: string | 'all'
  setSelectedAssignee: (assignee: string | 'all') => void
  isCompactMode: boolean
  setIsCompactMode: (mode: boolean) => void
  tasks: Task[]
}
```

**예상 라인 수**: 200-250줄
**의존성**: `types.ts`, `lucide-react`

---

### 3. TaskStats 컴포넌트
**파일**: `app/admin/tasks/components/TaskStats.tsx` (신규 생성)
- 전체 업무 수 표시
- 유형별 통계 (자비/보조금/AS/기타)
- 우선순위별 통계
- 진행 상황 요약

**Props**:
```typescript
interface TaskStatsProps {
  tasks: Task[]
  filteredTasks: Task[]
}
```

**예상 라인 수**: 150-200줄
**의존성**: `types.ts`, `lucide-react`

---

### 4. TaskKanban 컴포넌트
**파일**: `app/admin/tasks/components/TaskKanban.tsx` (신규 생성)
- 칸반 보드 레이아웃
- 드래그 앤 드롭 로직
- 열(column) 렌더링
- TaskCard 통합

**Props**:
```typescript
interface TaskKanbanProps {
  tasks: Task[]
  selectedType: TaskType | 'all'
  isCompactMode: boolean
  onTaskClick: (task: Task) => void
  onTaskEdit: (task: Task) => void
  onTaskDelete: (taskId: string) => void
  onStatusChange: (taskId: string, newStatus: TaskStatus) => void
}
```

**예상 라인 수**: 400-500줄
**의존성**: `types.ts`, `TaskCard.tsx`, `react-beautiful-dnd` (선택적)

---

### 5. TaskCreateModal 컴포넌트
**파일**: `app/admin/tasks/components/TaskCreateModal.tsx` (신규 생성)
- 업무 생성 폼
- 사업장 검색 및 선택
- 유효성 검증
- 다중 담당자 선택

**Props**:
```typescript
interface TaskCreateModalProps {
  isOpen: boolean
  onClose: () => void
  onCreate: (task: CreateTaskForm) => Promise<void>
  availableBusinesses: BusinessOption[]
  currentUser: User | null
}
```

**예상 라인 수**: 400-500줄
**의존성**: `types.ts`, `MultiAssigneeSelector.tsx`

---

### 6. TaskEditModal 컴포넌트
**파일**: `app/admin/tasks/components/TaskEditModal.tsx` (신규 생성)
- 업무 수정 폼
- 상태 변경
- 진행률 업데이트
- 보완 관련 필드 관리

**Props**:
```typescript
interface TaskEditModalProps {
  isOpen: boolean
  onClose: () => void
  task: Task | null
  onUpdate: (taskId: string, updates: Partial<Task>) => Promise<void>
  availableBusinesses: BusinessOption[]
}
```

**예상 라인 수**: 500-600줄
**의존성**: `types.ts`, `MultiAssigneeSelector.tsx`

---

### 7. useTaskManagement 커스텀 훅
**파일**: `app/admin/tasks/hooks/useTaskManagement.ts` (신규 생성)
- 업무 CRUD 로직
- API 호출 관리
- 상태 관리 로직
- 새로고침 로직

**반환값**:
```typescript
interface UseTaskManagementReturn {
  tasks: Task[]
  isLoading: boolean
  isRefreshing: boolean
  lastRefresh: Date
  loadTasks: () => Promise<void>
  createTask: (form: CreateTaskForm) => Promise<void>
  updateTask: (taskId: string, updates: Partial<Task>) => Promise<void>
  deleteTask: (taskId: string) => Promise<void>
  refreshTasks: () => Promise<void>
}
```

**예상 라인 수**: 200-300줄
**의존성**: `types.ts`, `@/lib/api-client`

---

### 8. 메인 페이지 (리팩토링)
**파일**: `app/admin/tasks/page.tsx` (기존 파일 대폭 축소)
- 컴포넌트 조합 및 레이아웃
- 전역 상태 관리
- 모달 제어
- 페이지네이션

**예상 라인 수**: 250-350줄
**의존성**: 위의 모든 컴포넌트 및 훅

---

## 📁 최종 파일 구조

```
app/admin/tasks/
├── page.tsx (250-350줄) ⬅️ 메인 페이지
├── types.ts (150줄) ⬅️ 타입 정의
├── components/
│   ├── TaskFilters.tsx (200-250줄)
│   ├── TaskStats.tsx (150-200줄)
│   ├── TaskKanban.tsx (400-500줄)
│   ├── TaskCreateModal.tsx (400-500줄)
│   ├── TaskEditModal.tsx (500-600줄)
│   ├── TaskCard.tsx (기존 유지)
│   ├── TaskCardList.tsx (기존 유지)
│   └── TaskMobileModal.tsx (기존 유지)
└── hooks/
    └── useTaskManagement.ts (200-300줄)
```

## ⚡ 기대 효과

### 성능 개선
- **렌더링 최적화**: React.memo() 적용으로 불필요한 리렌더링 방지
- **코드 스플리팅**: 각 컴포넌트 별도 청크로 분리
- **렌더링 속도**: 60-80% 향상 예상

### 개발 경험 향상
- **가독성**: 파일당 200-500줄으로 관리 용이
- **재사용성**: 독립 컴포넌트로 다른 페이지에서도 활용 가능
- **테스트**: 각 컴포넌트 독립적 단위 테스트 가능
- **협업**: 여러 개발자가 동시에 다른 컴포넌트 작업 가능

### 유지보수성
- **버그 추적**: 문제 발생 시 특정 컴포넌트로 범위 축소
- **기능 추가**: 새로운 기능을 독립 컴포넌트로 추가
- **코드 리뷰**: 작은 단위로 리뷰 진행

## 📅 구현 단계 (우선순위)

### Phase 1: 기반 작업 (1일)
1. ✅ `types.ts` 파일 생성 및 타입 정의 이동
2. ✅ `useTaskManagement.ts` 훅 생성 및 로직 이동

### Phase 2: 핵심 컴포넌트 분리 (2일)
3. ✅ `TaskFilters.tsx` 생성
4. ✅ `TaskStats.tsx` 생성
5. ✅ `TaskKanban.tsx` 생성

### Phase 3: 모달 컴포넌트 분리 (2일)
6. ✅ `TaskCreateModal.tsx` 생성
7. ✅ `TaskEditModal.tsx` 생성

### Phase 4: 통합 및 테스트 (1일)
8. ✅ 메인 페이지 리팩토링
9. ✅ 통합 테스트 및 버그 수정
10. ✅ 성능 측정 및 최적화

**총 예상 시간**: 6 작업일 (약 1.5주)

## 🚨 주의사항

1. **점진적 마이그레이션**: 한 번에 모든 것을 바꾸지 않고 단계적으로 진행
2. **타입 안정성**: TypeScript 타입 에러 없이 완벽하게 마이그레이션
3. **기능 보존**: 기존 기능 100% 유지
4. **테스트**: 각 단계마다 기능 테스트 수행
5. **백업**: Git 브랜치 생성하여 롤백 가능하도록 준비

## ✅ 성공 지표

- [ ] 모든 컴포넌트 파일이 500줄 이하
- [ ] React 훅 사용이 컴포넌트당 15개 이하
- [ ] 페이지 렌더링 속도 60% 이상 개선
- [ ] TypeScript 타입 에러 0개
- [ ] 기존 기능 100% 동작
- [ ] ESLint 경고 0개

---

**작성일**: 2025-10-29
**담당**: Claude Code
**상태**: 계획 수립 완료, 구현 준비 중
