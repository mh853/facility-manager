# Active Announcements Modal - Stats Filter Design

**작성일**: 2026-01-28
**목적**: 통계 배지 클릭으로 긴급도별 필터링 기능 추가

---

## 📋 요구사항

### 사용자 요청
1. **예산소진시 공고만 따로 보기**: 예산소진시(ongoing) 공고만 필터링하여 볼 수 있어야 함
2. **통계 배지 클릭 필터링**: 상단 통계 배지(긴급/주의/여유/예산소진시)를 클릭하면 해당 긴급도로 필터링

### 현재 상태
- 통계 배지는 표시만 되고 클릭 기능 없음
- 검색, 지역, 정렬 기능은 있지만 긴급도 필터링은 없음

---

## 🎨 UI/UX 디자인

### 1. 통계 배지 인터랙션

**현재**:
```tsx
<div className="flex items-center gap-2 px-3 py-2 bg-red-50 border border-red-200 rounded-lg">
  <span className="text-lg">🔥</span>
  <span className="text-sm font-medium text-red-800">긴급 {stats.urgent}건</span>
</div>
```

**변경 후**:
```tsx
<button
  onClick={() => handleUrgencyFilter('urgent')}
  className={`
    flex items-center gap-2 px-3 py-2 rounded-lg transition-all
    ${selectedUrgency === 'urgent'
      ? 'bg-red-100 border-2 border-red-400 shadow-md'
      : 'bg-red-50 border border-red-200 hover:bg-red-100 hover:border-red-300'}
  `}
>
  <span className="text-lg">🔥</span>
  <span className="text-sm font-medium text-red-800">긴급 {stats.urgent}건</span>
</button>
```

### 2. 선택 상태 표시

**활성화된 필터 (선택됨)**:
- 더 진한 배경색
- 2px 테두리
- shadow-md 효과
- 시각적으로 "눌린" 상태 표현

**비활성화된 필터 (선택 안됨)**:
- 기본 배경색
- 1px 테두리
- hover 효과만

### 3. 필터 초기화 버튼

전체 공고를 보려면 선택된 배지를 다시 클릭하거나, "전체" 옵션 추가:

```tsx
<button
  onClick={() => handleUrgencyFilter('all')}
  className={`
    flex items-center gap-2 px-3 py-2 rounded-lg transition-all
    ${selectedUrgency === 'all'
      ? 'bg-gray-100 border-2 border-gray-400 shadow-md'
      : 'bg-gray-50 border border-gray-200 hover:bg-gray-100'}
  `}
>
  <span className="text-lg">📋</span>
  <span className="text-sm font-medium text-gray-800">전체 {sortedAnnouncements.length}건</span>
</button>
```

---

## 🔧 기술 구현

### 1. State 추가

```tsx
const [selectedUrgency, setSelectedUrgency] = useState<UrgencyLevel | 'all'>('all');
```

### 2. 필터링 로직

```tsx
// 긴급도 필터링 추가
const urgencyFilteredAnnouncements = useMemo(() => {
  if (selectedUrgency === 'all') {
    return filteredAnnouncements;
  }

  return filteredAnnouncements.filter(announcement => {
    const dday = calculateDday(announcement.application_period_end);
    return dday.urgency === selectedUrgency;
  });
}, [filteredAnnouncements, selectedUrgency]);

// 정렬에 urgencyFilteredAnnouncements 사용
const sortedAnnouncements = useMemo(() => {
  const sorted = [...urgencyFilteredAnnouncements].sort((a, b) => {
    // ... 기존 정렬 로직
  });
  return sorted;
}, [urgencyFilteredAnnouncements, sortField, sortOrder]);
```

### 3. 핸들러 함수

```tsx
const handleUrgencyFilter = (urgency: UrgencyLevel | 'all') => {
  // 같은 필터를 다시 클릭하면 전체로 초기화 (토글)
  if (selectedUrgency === urgency) {
    setSelectedUrgency('all');
  } else {
    setSelectedUrgency(urgency);
  }
};
```

### 4. 통계 배지 컴포넌트화

```tsx
interface StatsBadgeProps {
  urgency: UrgencyLevel | 'all';
  icon: string;
  label: string;
  count: number;
  bgColor: string;
  textColor: string;
  borderColor: string;
  activeBorderColor: string;
  isSelected: boolean;
  onClick: () => void;
}

const StatsBadge: React.FC<StatsBadgeProps> = ({
  urgency,
  icon,
  label,
  count,
  bgColor,
  textColor,
  borderColor,
  activeBorderColor,
  isSelected,
  onClick
}) => (
  <button
    onClick={onClick}
    className={`
      flex items-center gap-2 px-3 py-2 rounded-lg transition-all
      ${isSelected
        ? `${bgColor} border-2 ${activeBorderColor} shadow-md scale-105`
        : `${bgColor} border ${borderColor} hover:shadow-sm hover:scale-102`}
    `}
  >
    <span className="text-lg">{icon}</span>
    <span className={`text-sm font-medium ${textColor}`}>
      {label} {count}건
    </span>
  </button>
);
```

---

## 📊 통계 배지 구성

### 배지별 스타일 정의

```tsx
const statsBadgeConfig = [
  {
    urgency: 'all' as const,
    icon: '📋',
    label: '전체',
    count: sortedAnnouncements.length,
    bgColor: 'bg-gray-50',
    textColor: 'text-gray-800',
    borderColor: 'border-gray-200',
    activeBorderColor: 'border-gray-400',
  },
  {
    urgency: 'urgent' as const,
    icon: '🔥',
    label: '긴급',
    count: stats.urgent,
    bgColor: 'bg-red-50',
    textColor: 'text-red-800',
    borderColor: 'border-red-200',
    activeBorderColor: 'border-red-400',
  },
  {
    urgency: 'warning' as const,
    icon: '⚠️',
    label: '주의',
    count: stats.warning,
    bgColor: 'bg-amber-50',
    textColor: 'text-amber-800',
    borderColor: 'border-amber-200',
    activeBorderColor: 'border-amber-400',
  },
  {
    urgency: 'safe' as const,
    icon: '✅',
    label: '여유',
    count: stats.safe,
    bgColor: 'bg-emerald-50',
    textColor: 'text-emerald-800',
    borderColor: 'border-emerald-200',
    activeBorderColor: 'border-emerald-400',
  },
  {
    urgency: 'ongoing' as const,
    icon: '♾️',
    label: '예산소진시',
    count: stats.ongoing,
    bgColor: 'bg-purple-50',
    textColor: 'text-purple-800',
    borderColor: 'border-purple-200',
    activeBorderColor: 'border-purple-400',
  },
];
```

### 배지 렌더링

```tsx
<div className="flex gap-3 flex-wrap">
  {statsBadgeConfig.map(config => (
    <StatsBadge
      key={config.urgency}
      urgency={config.urgency}
      icon={config.icon}
      label={config.label}
      count={config.count}
      bgColor={config.bgColor}
      textColor={config.textColor}
      borderColor={config.borderColor}
      activeBorderColor={config.activeBorderColor}
      isSelected={selectedUrgency === config.urgency}
      onClick={() => handleUrgencyFilter(config.urgency)}
    />
  ))}
</div>
```

---

## 🎯 사용자 시나리오

### 시나리오 1: 예산소진시 공고만 보기
1. 사용자가 모달 오픈
2. 상단 통계에서 "♾️ 예산소진시 2건" 배지 클릭
3. 테이블에 예산소진시 공고 2건만 필터링되어 표시
4. 배지는 선택 상태로 강조 표시 (진한 보라색 배경, 두꺼운 테두리)

### 시나리오 2: 긴급 공고 확인
1. "🔥 긴급 3건" 배지 클릭
2. D-7 이하 긴급 공고 3건만 표시
3. 다른 공고들은 숨겨짐

### 시나리오 3: 필터 초기화
1. 선택된 배지를 다시 클릭 → 전체 공고로 복귀
2. 또는 "📋 전체 N건" 배지 클릭 → 전체 공고로 복귀

### 시나리오 4: 필터 조합
1. 지역 필터: "서울특별시" 선택
2. 긴급도 필터: "긴급" 클릭
3. → 서울특별시 + 긴급 공고만 표시 (AND 조건)

---

## 📱 반응형 디자인

### Desktop (≥768px)
```
┌─────────────────────────────────────────────────────────┐
│ [📋 전체 10건] [🔥 긴급 3건] [⚠️ 주의 2건] [✅ 여유 4건] [♾️ 예산소진시 1건] │
└─────────────────────────────────────────────────────────┘
```

### Mobile (<768px)
```
┌────────────────────────┐
│ [📋 전체 10건]          │
│ [🔥 긴급 3건]           │
│ [⚠️ 주의 2건]           │
│ [✅ 여유 4건]           │
│ [♾️ 예산소진시 1건]     │
└────────────────────────┘
```

---

## ✅ 구현 체크리스트

### State 및 로직
- [ ] `selectedUrgency` state 추가
- [ ] `handleUrgencyFilter` 핸들러 구현
- [ ] `urgencyFilteredAnnouncements` 필터링 로직 추가
- [ ] 정렬 로직에 긴급도 필터 적용

### UI 컴포넌트
- [ ] 통계 배지를 버튼으로 변경
- [ ] 선택/비선택 상태 스타일 적용
- [ ] hover 효과 추가
- [ ] transition 애니메이션 추가

### 사용성
- [ ] 같은 배지 재클릭 시 필터 해제 (토글)
- [ ] "전체" 배지 추가 (옵션)
- [ ] 필터링 결과 0건일 때 안내 메시지
- [ ] 모바일 레이아웃 최적화

---

## 🧪 테스트 시나리오

1. **각 통계 배지 클릭 테스트**
   - 긴급, 주의, 여유, 예산소진시 각각 클릭
   - 해당 긴급도 공고만 표시되는지 확인

2. **필터 토글 테스트**
   - 선택된 배지 재클릭 → 전체로 복귀

3. **필터 조합 테스트**
   - 지역 + 긴급도 필터 조합
   - 검색 + 긴급도 필터 조합

4. **빈 결과 테스트**
   - 특정 지역 + 특정 긴급도 조합으로 결과 0건
   - 적절한 안내 메시지 표시

5. **정렬 유지 테스트**
   - 긴급도 필터 적용 후에도 정렬 순서 유지

---

## 🎨 최종 UI 프리뷰

### 선택 전 (기본 상태)
```
┌──────────────────────────────────────────────────────────┐
│ 📊 현재 신청가능한 공고 목록입니다                        │
│                                                          │
│ [📋 전체 10건] [🔥 긴급 3건] [⚠️ 주의 2건] [✅ 여유 4건] [♾️ 예산소진시 1건] │
│   (연한색)      (연한색)      (연한색)      (연한색)       (연한색)   │
└──────────────────────────────────────────────────────────┘
```

### 예산소진시 선택 후
```
┌──────────────────────────────────────────────────────────┐
│ 📊 현재 신청가능한 공고 목록입니다                        │
│                                                          │
│ [📋 전체 10건] [🔥 긴급 3건] [⚠️ 주의 2건] [✅ 여유 4건] ┏━━━━━━━━━━━━━┓ │
│   (연한색)      (연한색)      (연한색)      (연한색)     ┃♾️ 예산소진시 1건┃ │
│                                                        ┗━━━━━━━━━━━━━┛ │
│                                                          (진한 보라색, 두꺼운 테두리, shadow) │
└──────────────────────────────────────────────────────────┘

테이블:
┌────────────────────────────────────────────────┐
│ [♾️] 동두천시 | 2025년 사물인터넷(IoT) ... │ ♾️ 예산소진시 │
└────────────────────────────────────────────────┘
(예산소진시 공고 1건만 표시)
```

---

**작성자**: Claude Sonnet 4.5
**버전**: 1.0
**최종 수정**: 2026-01-28
