# 업무 관리 모바일 UI 디자인 제안

## 📱 디자인 컨셉

### 1. 반응형 뷰 전환
- **데스크톱 (≥768px)**: 테이블 뷰 유지
- **모바일 (<768px)**: 카드 뷰 자동 전환

### 2. 모바일 카드 컴포넌트 구조

```tsx
<div className="space-y-3 md:hidden">
  {tasks.map(task => (
    <TaskCard key={task.id} task={task} />
  ))}
</div>

<div className="hidden md:block">
  <TableView tasks={tasks} />
</div>
```

## 🎨 카드 디자인 상세

### A. 컴팩트 카드 (기본)
```tsx
<div className="bg-white rounded-lg border-l-4 border-red-500 shadow-sm p-4">
  {/* 헤더: 우선순위 + 업무 타입 */}
  <div className="flex items-center justify-between mb-2">
    <span className="inline-flex items-center gap-1 text-xs font-medium">
      <Flag className="w-3 h-3 text-red-500" />
      <span className="text-red-600">높음</span>
    </span>
    <span className="px-2 py-1 bg-blue-50 text-blue-700 text-xs rounded-md">
      자비 설치
    </span>
  </div>

  {/* 업무명 */}
  <h3 className="font-semibold text-gray-900 mb-2">
    청주 ABC 사업장 설치
  </h3>

  {/* 정보 그리드 */}
  <div className="space-y-2 text-sm">
    <div className="flex items-center gap-2 text-gray-600">
      <Users className="w-4 h-4" />
      <span>김철수, 이영희</span>
    </div>
    <div className="flex items-center gap-2 text-gray-600">
      <MapPin className="w-4 h-4" />
      <span className="truncate">충북 청주시 상당구...</span>
    </div>
    <div className="flex items-center gap-2 text-gray-600">
      <Calendar className="w-4 h-4" />
      <span>01/15 ~ 01/30</span>
    </div>
  </div>

  {/* 진행률 바 */}
  <div className="mt-3">
    <div className="flex items-center justify-between mb-1">
      <span className="text-xs text-gray-600">현장실사</span>
      <span className="text-xs font-medium text-blue-600">45%</span>
    </div>
    <div className="w-full bg-gray-200 rounded-full h-2">
      <div className="bg-blue-600 h-2 rounded-full" style={{width: '45%'}}></div>
    </div>
  </div>

  {/* 지연 상태 */}
  <div className="mt-3 flex items-center gap-2 text-xs text-red-600 bg-red-50 px-2 py-1 rounded">
    <AlertCircle className="w-3 h-3" />
    <span>3일 지연</span>
  </div>

  {/* 액션 버튼 */}
  <div className="mt-3 flex gap-2">
    <button className="flex-1 px-3 py-2 bg-blue-600 text-white text-sm rounded-lg">
      상세보기
    </button>
    <button className="px-3 py-2 border border-gray-300 text-gray-700 text-sm rounded-lg">
      <Edit className="w-4 h-4" />
    </button>
  </div>
</div>
```

### B. 간결한 리스트 아이템
```tsx
<div className="bg-white border-b border-gray-200 p-3 active:bg-gray-50">
  <div className="flex items-start justify-between">
    <div className="flex-1 min-w-0">
      <div className="flex items-center gap-2 mb-1">
        <span className="w-2 h-2 rounded-full bg-red-500"></span>
        <h4 className="font-medium text-gray-900 truncate">청주 ABC 사업장</h4>
      </div>
      <div className="flex items-center gap-3 text-xs text-gray-500">
        <span>김철수</span>
        <span>•</span>
        <span>현장실사</span>
        <span>•</span>
        <span className="text-red-600">3일 지연</span>
      </div>
    </div>
    <ChevronRight className="w-5 h-5 text-gray-400 flex-shrink-0" />
  </div>
</div>
```

### C. 확장 가능한 아코디언
```tsx
<div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
  {/* 헤더 (항상 보임) */}
  <button
    onClick={() => setExpanded(!expanded)}
    className="w-full p-4 flex items-center justify-between"
  >
    <div className="flex items-center gap-3">
      <div className="w-10 h-10 bg-red-100 rounded-lg flex items-center justify-center">
        <Flag className="w-5 h-5 text-red-600" />
      </div>
      <div className="text-left">
        <h3 className="font-semibold text-gray-900">청주 ABC 사업장</h3>
        <p className="text-sm text-gray-500">현장실사 • 45%</p>
      </div>
    </div>
    <ChevronDown className={`w-5 h-5 transition-transform ${expanded ? 'rotate-180' : ''}`} />
  </button>

  {/* 확장 내용 */}
  {expanded && (
    <div className="px-4 pb-4 border-t border-gray-100">
      <dl className="space-y-2 mt-3">
        <div className="flex justify-between text-sm">
          <dt className="text-gray-600">담당자</dt>
          <dd className="font-medium">김철수, 이영희</dd>
        </div>
        <div className="flex justify-between text-sm">
          <dt className="text-gray-600">주소</dt>
          <dd className="font-medium text-right">충북 청주시...</dd>
        </div>
        <div className="flex justify-between text-sm">
          <dt className="text-gray-600">기간</dt>
          <dd className="font-medium">01/15 ~ 01/30</dd>
        </div>
      </dl>

      <div className="mt-4 flex gap-2">
        <button className="flex-1 py-2 bg-blue-600 text-white text-sm rounded-lg">
          상세보기
        </button>
        <button className="px-4 py-2 border border-gray-300 text-gray-700 text-sm rounded-lg">
          수정
        </button>
      </div>
    </div>
  )}
</div>
```

## 🎯 추천 구현 방식

### 하이브리드 접근법
1. **기본 뷰**: 컴팩트 카드 (방식 A)
2. **탭으로 상세**: 카드 탭 시 상세 모달
3. **빠른 액션**: 좌우 스와이프

```tsx
// 카드 터치 → 상세 모달
<TaskCard
  onClick={() => openDetailModal(task)}
  onSwipeLeft={() => openEditModal(task)}
  onSwipeRight={() => markAsComplete(task)}
/>
```

## 📊 정보 우선순위 (모바일)

### 필수 표시 (항상)
1. 업무명 / 사업장명
2. 우선순위 표시 (색상/아이콘)
3. 담당자
4. 현재 단계
5. 지연 상태

### 선택적 표시 (확장 시)
1. 상세 주소
2. 연락처
3. 상세 기간
4. 메모/설명

## 🎨 색상 코딩 시스템

### 우선순위
- **높음**: 빨강 (border-red-500, bg-red-50)
- **중간**: 노랑 (border-yellow-500, bg-yellow-50)
- **낮음**: 회색 (border-gray-300, bg-gray-50)

### 지연 상태
- **정상**: 초록 (text-green-600)
- **위험**: 노랑 (text-yellow-600)
- **지연**: 빨강 (text-red-600)

### 업무 타입
- **자비**: 파랑 (bg-blue-50, text-blue-700)
- **보조금**: 초록 (bg-green-50, text-green-700)
- **AS**: 주황 (bg-orange-50, text-orange-700)
- **기타**: 회색 (bg-gray-50, text-gray-700)

## 🚀 구현 단계

### Phase 1: 기본 카드 뷰
- [ ] TaskCard 컴포넌트 생성
- [ ] 반응형 전환 로직 (md: 브레이크포인트)
- [ ] 기본 정보 표시

### Phase 2: 인터랙션
- [ ] 카드 탭 → 상세 모달
- [ ] 액션 버튼 (수정, 삭제)
- [ ] 필터 UI 모바일 최적화

### Phase 3: 고급 기능
- [ ] 스와이프 제스처
- [ ] 풀 투 리프레시
- [ ] 무한 스크롤 / 페이지네이션

## 💡 성능 최적화

### 가상화 (Virtual Scrolling)
업무가 100개 이상일 때:
```tsx
import { useVirtualizer } from '@tanstack/react-virtual'

const virtualizer = useVirtualizer({
  count: tasks.length,
  getScrollElement: () => parentRef.current,
  estimateSize: () => 180, // 카드 높이
})
```

### 레이지 로딩
이미지나 무거운 컴포넌트는 지연 로드:
```tsx
import { lazy, Suspense } from 'react'

const TaskDetailModal = lazy(() => import('./TaskDetailModal'))
```

## 🔄 애니메이션

### 카드 등장 효과
```tsx
className="animate-in slide-in-from-bottom-4 fade-in duration-300"
```

### 상태 전환
```tsx
className="transition-all duration-200 ease-in-out"
```

## 📱 터치 최적화

### 최소 터치 영역
- 버튼: 최소 44x44px (iOS 가이드라인)
- 카드: 최소 높이 120px

### 액티브 상태 피드백
```tsx
className="active:scale-[0.98] active:bg-gray-50 transition-transform"
```
