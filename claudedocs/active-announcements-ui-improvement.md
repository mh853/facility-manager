# Active Announcements UI 개선 설계

**작성일**: 2026-01-28
**목적**: 신청 가능한 공고 버튼 UI 개선 및 마감일 미정 공고 처리

---

## 📋 개선 요구사항

### 1. 버튼 위치 변경
**AS-IS**:
- 전체 폭을 차지하는 그라데이션 카드 형태
- 통계 카드 아래 독립적으로 배치
- 높이가 높아서 공간을 많이 차지

**TO-BE**:
- 필터 영역의 검색창 오른쪽에 배치
- 다른 필터 버튼들과 같은 높이로 정렬
- 컴팩트한 버튼 형태로 변경

### 2. 마감일 미정 공고 처리
**문제**:
- `application_period_end`가 `null`인 공고는 예산 소진 시까지 유효
- 현재는 마감일이 없으면 필터링에서 제외됨

**해결책**:
- 마감일이 없는 공고도 "신청 가능"으로 표시
- D-day 배지를 "예산소진시까지" 또는 "상시모집"으로 표시
- 테이블에서 특별한 스타일로 구분 (보라색 배지)

---

## 🎨 UI 개선 디자인

### 1. 버튼 배치 (필터 영역 내)

**위치**: 검색창 오른쪽, 다른 필터 옆

```tsx
<div className="px-6 py-4 bg-white border-b border-gray-200/60">
  <div className="flex flex-wrap gap-3 items-center">
    {/* 상태 필터 */}
    <div>
      <label className="block text-[10px] sm:text-xs text-gray-500 mb-1">상태</label>
      <select ...>...</select>
    </div>

    {/* 관련성 필터 */}
    <div>
      <label className="block text-[10px] sm:text-xs text-gray-500 mb-1">관련성</label>
      <select ...>...</select>
    </div>

    {/* 출처 필터 */}
    <div>
      <label className="block text-[10px] sm:text-xs text-gray-500 mb-1">출처</label>
      <select ...>...</select>
    </div>

    {/* 검색창 */}
    <div className="flex-1">
      <label className="block text-[10px] sm:text-xs text-gray-500 mb-1">검색 (실시간 필터링)</label>
      <input type="text" ...>
    </div>

    {/* 🆕 신청 가능한 공고 버튼 */}
    <div>
      <label className="block text-[10px] sm:text-xs text-gray-500 mb-1 opacity-0">버튼</label>
      <button
        onClick={() => setShowActiveAnnouncementsModal(true)}
        className="px-4 py-1.5 bg-gradient-to-r from-indigo-500 to-purple-600 text-white rounded-lg hover:from-indigo-600 hover:to-purple-700 transition-all text-sm font-medium whitespace-nowrap shadow-md hover:shadow-lg flex items-center gap-2"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
        </svg>
        <span className="hidden sm:inline">신청가능 공고</span>
        <span className="sm:hidden">공고</span>
      </button>
    </div>
  </div>
</div>
```

**디자인 특징**:
- 높이: 다른 필터와 동일 (`py-1.5`)
- 그라데이션 유지: Indigo → Purple (브랜드 일관성)
- 아이콘 + 텍스트
- 모바일: 짧은 텍스트 ("공고")
- 데스크톱: 전체 텍스트 ("신청가능 공고")

---

## 🔧 마감일 미정 공고 처리

### 1. 데이터 필터링 로직 변경

**AS-IS**:
```typescript
const activeAnnouncements = useMemo(() => {
  const now = new Date();
  return announcements.filter(announcement => {
    if (!announcement.application_period_end) return false; // ❌ 제외됨
    const endDate = new Date(announcement.application_period_end);
    return endDate >= now;
  });
}, [announcements]);
```

**TO-BE**:
```typescript
const activeAnnouncements = useMemo(() => {
  const now = new Date();
  return announcements.filter(announcement => {
    // 마감일이 없으면 "상시 모집" = 항상 신청 가능
    if (!announcement.application_period_end) return true; // ✅ 포함됨

    const endDate = new Date(announcement.application_period_end);
    return endDate >= now;
  });
}, [announcements]);
```

### 2. D-day 계산 로직 변경

**AS-IS**:
```typescript
const calculateDday = (endDate: string): DdayInfo => {
  const end = new Date(endDate);
  // ... 날짜 계산
};
```

**TO-BE**:
```typescript
const calculateDday = (endDate: string | null | undefined): DdayInfo => {
  // 마감일이 없는 경우 = 예산 소진 시까지 = 상시 모집
  if (!endDate) {
    return {
      daysRemaining: Infinity,
      urgency: 'ongoing' as UrgencyLevel, // 새로운 타입
      label: '예산소진시',
      icon: '♾️',
    };
  }

  const end = new Date(endDate);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  end.setHours(0, 0, 0, 0);

  const diffTime = end.getTime() - today.getTime();
  const daysRemaining = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

  let urgency: UrgencyLevel;
  let icon: string;

  if (daysRemaining <= 7) {
    urgency = 'urgent';
    icon = '🔥';
  } else if (daysRemaining <= 14) {
    urgency = 'warning';
    icon = '⚠️';
  } else {
    urgency = 'safe';
    icon = '✅';
  }

  return {
    daysRemaining,
    urgency,
    label: `D-${daysRemaining}`,
    icon,
  };
};
```

### 3. UrgencyLevel 타입 확장

```typescript
type UrgencyLevel = 'urgent' | 'warning' | 'safe' | 'ongoing';
```

### 4. 상시 모집 배지 스타일

```tsx
{/* D-day Badge */}
<td className="px-4 py-4 text-center">
  <span className={`
    inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-bold
    ${ddayInfo.urgency === 'urgent' ? 'bg-red-100 text-red-800 border border-red-300' : ''}
    ${ddayInfo.urgency === 'warning' ? 'bg-amber-100 text-amber-800 border border-amber-300' : ''}
    ${ddayInfo.urgency === 'safe' ? 'bg-emerald-100 text-emerald-800 border border-emerald-300' : ''}
    ${ddayInfo.urgency === 'ongoing' ? 'bg-purple-100 text-purple-800 border border-purple-300' : ''}
  `}>
    {ddayInfo.icon} {ddayInfo.label}
  </span>
</td>
```

### 5. 신청기간 표시 변경

**Desktop 테이블**:
```tsx
{/* Period */}
<td className="px-4 py-4 whitespace-nowrap">
  <div className="text-xs text-gray-600">
    {announcement.application_period_start && (
      <div>{formatDate(announcement.application_period_start)}</div>
    )}
    {announcement.application_period_end ? (
      <>
        <div className="text-gray-400">~</div>
        <div className="font-medium text-gray-900">
          {formatDate(announcement.application_period_end)}
        </div>
      </>
    ) : (
      <div className="font-medium text-purple-700">
        ~ 예산소진시
      </div>
    )}
  </div>
</td>
```

**Mobile 카드**:
```tsx
{/* Card Meta */}
<div className="flex items-center justify-between text-xs text-gray-600 mb-3">
  <span className="flex items-center gap-1">
    💰 {formatBudget(announcement.budget)}
  </span>
  <span className="flex items-center gap-1">
    {announcement.application_period_end ? (
      <>📅 ~{formatDate(announcement.application_period_end)}</>
    ) : (
      <span className="text-purple-700 font-medium">📅 ~예산소진시</span>
    )}
  </span>
</div>
```

---

## 📊 통계 배지 업데이트

### 모달 헤더 통계에 "상시모집" 추가

```tsx
{/* Stats Summary */}
<div className="flex gap-3 flex-wrap">
  <div className="flex items-center gap-2 px-3 py-2 bg-red-50 border border-red-200 rounded-lg">
    <span className="text-lg">🔥</span>
    <span className="text-sm font-medium text-red-800">긴급 {stats.urgent}건</span>
  </div>
  <div className="flex items-center gap-2 px-3 py-2 bg-amber-50 border border-amber-200 rounded-lg">
    <span className="text-lg">⚠️</span>
    <span className="text-sm font-medium text-amber-800">주의 {stats.warning}건</span>
  </div>
  <div className="flex items-center gap-2 px-3 py-2 bg-emerald-50 border border-emerald-200 rounded-lg">
    <span className="text-lg">✅</span>
    <span className="text-sm font-medium text-emerald-800">여유 {stats.safe}건</span>
  </div>
  {/* 🆕 상시모집 통계 */}
  <div className="flex items-center gap-2 px-3 py-2 bg-purple-50 border border-purple-200 rounded-lg">
    <span className="text-lg">♾️</span>
    <span className="text-sm font-medium text-purple-800">상시모집 {stats.ongoing}건</span>
  </div>
</div>
```

### 통계 계산 로직

```typescript
const stats = useMemo(() => {
  const urgent = sortedAnnouncements.filter(a => {
    const dday = calculateDday(a.application_period_end);
    return dday.urgency === 'urgent';
  }).length;

  const warning = sortedAnnouncements.filter(a => {
    const dday = calculateDday(a.application_period_end);
    return dday.urgency === 'warning';
  }).length;

  const safe = sortedAnnouncements.filter(a => {
    const dday = calculateDday(a.application_period_end);
    return dday.urgency === 'safe';
  }).length;

  // 🆕 상시모집 (마감일 없음)
  const ongoing = sortedAnnouncements.filter(a => {
    const dday = calculateDday(a.application_period_end);
    return dday.urgency === 'ongoing';
  }).length;

  return { urgent, warning, safe, ongoing };
}, [sortedAnnouncements]);
```

---

## 🎯 정렬 로직 개선

마감일이 없는 공고는 정렬 시 **맨 뒤**에 배치:

```typescript
case 'dday': {
  const daysA = calculateDday(a.application_period_end).daysRemaining;
  const daysB = calculateDday(b.application_period_end).daysRemaining;

  // Infinity (상시모집)는 항상 뒤로
  if (daysA === Infinity && daysB !== Infinity) return 1;
  if (daysA !== Infinity && daysB === Infinity) return -1;

  comparison = daysA - daysB;
  break;
}
```

---

## 📱 반응형 디자인

### Desktop (≥768px)
```
[상태▼] [관련성▼] [출처▼] [━━━━━━ 검색창 ━━━━━━] [📋 신청가능 공고]
```

### Tablet (≥640px, <768px)
```
[상태▼] [관련성▼] [출처▼]
[━━━━━━ 검색창 ━━━━━━] [📋 공고]
```

### Mobile (<640px)
```
[상태▼] [관련성▼]
[출처▼] [━ 검색 ━]
[📋 공고]
```

---

## 🔄 기존 그라데이션 카드 제거

**admin/subsidy/page.tsx Line 577-595 삭제**:
```tsx
{/* ❌ 삭제할 부분 */}
<div className="bg-gradient-to-r from-indigo-500 to-purple-600 rounded-lg shadow-lg p-4 mb-6">
  <div className="flex items-center justify-between">
    ...
  </div>
</div>
```

**대체 위치**: 필터 영역 내부 (Line 617-680 근처)

---

## ✅ 구현 체크리스트

### UI 변경
- [ ] 그라데이션 카드 제거 (Line 577-595)
- [ ] 필터 영역에 버튼 추가 (검색창 오른쪽)
- [ ] 버튼 반응형 디자인 (모바일: "공고", 데스크톱: "신청가능 공고")

### 로직 변경
- [ ] `UrgencyLevel` 타입에 `'ongoing'` 추가
- [ ] `calculateDday` 함수: `null` 처리 추가
- [ ] `activeAnnouncements` 필터: 마감일 없는 공고 포함
- [ ] 정렬 로직: `Infinity` 처리 추가
- [ ] 통계 계산: `ongoing` 카운트 추가

### UI 표시
- [ ] D-day 배지: 보라색 "♾️ 예산소진시" 스타일 추가
- [ ] 신청기간 컬럼: "~ 예산소진시" 표시
- [ ] 모달 헤더: 상시모집 통계 배지 추가
- [ ] 모바일 카드: 마감일 없는 경우 특별 표시

---

## 🎨 최종 UI 프리뷰

### 필터 영역 (Desktop)
```
┌─────────────────────────────────────────────────────────────────┐
│ 상태        관련성            출처          검색 (실시간)      버튼 │
│ [전체 ▼]  [관련공고만 ▼]  [전체 ▼]  [제목,지역 검색...] [📋 공고] │
└─────────────────────────────────────────────────────────────────┘
```

### 모달 통계 배지
```
┌────────────────────────────────────────────────────┐
│ [🔥 긴급 2건] [⚠️ 주의 3건] [✅ 여유 5건] [♾️ 상시모집 1건] │
└────────────────────────────────────────────────────┘
```

### 테이블 마감일 표시
```
┌──────────────┬─────────────┐
│ 신청기간     │ D-day       │
├──────────────┼─────────────┤
│ 2024.01.15   │ 🔥 D-5      │
│ ~ 2024.02.01 │             │
├──────────────┼─────────────┤
│ 2024.01.01   │ ♾️ 예산소진시│
│ ~ 예산소진시  │             │
└──────────────┴─────────────┘
```

---

**작성자**: Claude Sonnet 4.5
**버전**: 2.0
**최종 수정**: 2026-01-28
