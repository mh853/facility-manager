# Active Announcements Final Improvements

**작성일**: 2026-01-28
**목적**: 신청 가능한 공고 UI 최종 개선 - 버튼 위치 이동, 테이블 컬럼 제거, 예산소진시 처리

---

## 📋 개선 요구사항

### 1. 버튼 위치 이동
**현재 문제**:
- Lines 577-595에 전체 폭 그라데이션 카드로 배치
- 공간을 많이 차지하여 비효율적

**해결책**:
- 필터 영역(Lines 617-680 근처)의 검색창 오른쪽으로 이동
- 다른 필터 버튼들과 같은 높이로 정렬
- 컴팩트한 버튼 형태로 변경

### 2. 테이블 컬럼 제거
**현재 상태**:
- Desktop: 상태 | 지역 | 제목 | 신청기간 | D-day | 예산 | **관련도** | **상세**
- 총 8개 컬럼

**변경 후**:
- Desktop: 상태 | 지역 | 제목 | 신청기간 | D-day | 예산
- 총 6개 컬럼
- **제거**: 관련도, 상세 컬럼
- **이유**: 공간 효율성 향상, 핵심 정보에 집중

### 3. 예산소진시 공고 처리
**현재 문제**:
- `application_period_end`가 `null`인 공고가 필터링에서 제외됨
- 예산 소진 시까지 유효한 공고를 볼 수 없음

**해결책**:
- 마감일이 없는 공고도 "신청 가능"으로 표시
- D-day 배지를 "♾️ 예산소진시"로 표시 (보라색)
- 신청기간 컬럼에 "~ 예산소진시" 표시

---

## 🎨 UI 변경 사항

### 1. 버튼 배치 변경

#### AS-IS (Lines 577-595 삭제)
```tsx
{/* ❌ 삭제할 부분 */}
<div className="bg-gradient-to-r from-indigo-500 to-purple-600 rounded-lg shadow-lg p-4 mb-6">
  <div className="flex items-center justify-between">
    <div className="text-white">
      <h3 className="font-bold text-lg mb-1">📋 신청 가능한 공고</h3>
      <p className="text-sm text-indigo-100">
        현재 신청기간이 유효한 공고들을 한눈에 확인하세요
      </p>
    </div>
    <button onClick={() => setShowActiveAnnouncementsModal(true)} ...>
      공고 목록 보기
    </button>
  </div>
</div>
```

#### TO-BE (필터 영역 내부에 추가)
```tsx
{/* 필터 영역 (Line 617-680 근처) */}
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
    <div className="flex-1 min-w-[200px]">
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
- `opacity-0` 라벨로 높이 정렬

---

## 🗂️ 테이블 컬럼 구조 변경

### 컬럼 너비 재조정

#### AS-IS (8개 컬럼)
```tsx
<colgroup>
  <col className="w-[6%]" /> {/* 상태 */}
  <col className="w-[14%]" /> {/* 지역 */}
  <col className="w-[32%]" /> {/* 제목 */}
  <col className="w-[14%]" /> {/* 신청기간 */}
  <col className="w-[10%]" /> {/* D-day */}
  <col className="w-[12%]" /> {/* 예산 */}
  <col className="w-[8%]" /> {/* 관련도 ❌ 제거 */}
  <col className="w-[4%]" /> {/* 상세 ❌ 제거 */}
</colgroup>
```

#### TO-BE (6개 컬럼)
```tsx
<colgroup>
  <col className="w-[8%]" /> {/* 상태 */}
  <col className="w-[18%]" /> {/* 지역 */}
  <col className="w-[40%]" /> {/* 제목 (더 넓게) */}
  <col className="w-[14%]" /> {/* 신청기간 */}
  <col className="w-[10%]" /> {/* D-day */}
  <col className="w-[10%]" /> {/* 예산 */}
</colgroup>
```

**변경 이유**:
- 제목 컬럼: 32% → 40% (공간 확보로 가독성 향상)
- 상태 컬럼: 6% → 8% (아이콘 여유 공간)
- 지역 컬럼: 14% → 18% (긴 지역명 대응)
- 예산 컬럼: 12% → 10% (간소화된 포맷)

### 테이블 헤더 변경

```tsx
<thead>
  <tr>
    <th className="px-4 py-3 text-left">상태</th>
    <th onClick={() => handleSort('region')} className="px-4 py-3 text-left cursor-pointer">
      <div className="flex items-center gap-1">
        지역
        {sortField === 'region' && (sortOrder === 'asc' ? <ChevronUp /> : <ChevronDown />)}
      </div>
    </th>
    <th className="px-4 py-3 text-left">공고 제목</th>
    <th className="px-4 py-3 text-left">신청기간</th>
    <th onClick={() => handleSort('dday')} className="px-4 py-3 text-center cursor-pointer">
      <div className="flex items-center justify-center gap-1">
        D-day
        {sortField === 'dday' && (sortOrder === 'asc' ? <ChevronUp /> : <ChevronDown />)}
      </div>
    </th>
    <th onClick={() => handleSort('budget')} className="px-4 py-3 text-right cursor-pointer">
      <div className="flex items-center justify-end gap-1">
        예산
        {sortField === 'budget' && (sortOrder === 'asc' ? <ChevronUp /> : <ChevronDown />)}
      </div>
    </th>
    {/* ❌ 관련도, 상세 컬럼 제거 */}
  </tr>
</thead>
```

### 테이블 바디 변경

```tsx
<tbody>
  {sortedAnnouncements.map((announcement) => {
    const ddayInfo = calculateDday(announcement.application_period_end);

    return (
      <tr
        key={announcement.id}
        onClick={() => onAnnouncementClick(announcement)}
        className="hover:bg-indigo-50/50 cursor-pointer"
      >
        {/* 상태 아이콘 */}
        <td className="px-4 py-4">
          <span className="text-2xl">{ddayInfo.icon}</span>
        </td>

        {/* 지역 */}
        <td className="px-4 py-4">
          <div className="truncate text-sm font-medium text-gray-900" title={...}>
            {extractRegion(announcement.title, announcement.region_name)}
          </div>
        </td>

        {/* 제목 */}
        <td className="px-4 py-4">
          <div className="flex items-start gap-2">
            {!announcement.is_read && <div className="w-2 h-2 bg-blue-600 rounded-full" />}
            <p className="text-sm font-medium line-clamp-2" title={...}>
              {cleanTitle(announcement.title)}
            </p>
          </div>
        </td>

        {/* 신청기간 */}
        <td className="px-4 py-4">
          <div className="text-xs text-gray-600">
            <div className="truncate">{formatDate(announcement.application_period_start)}</div>
            <div className="text-gray-400">~</div>
            {announcement.application_period_end ? (
              <div className="font-medium text-gray-900 truncate">
                {formatDate(announcement.application_period_end)}
              </div>
            ) : (
              <div className="font-medium text-purple-700">
                예산소진시
              </div>
            )}
          </div>
        </td>

        {/* D-day */}
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

        {/* 예산 */}
        <td className="px-4 py-4 text-right">
          <div className="text-sm font-semibold text-gray-900 truncate" title={...}>
            {formatBudget(announcement.budget)}
          </div>
        </td>

        {/* ❌ 관련도, 상세 컬럼 제거 */}
      </tr>
    );
  })}
</tbody>
```

---

## 🔄 예산소진시 공고 처리

### 1. UrgencyLevel 타입 확장

```typescript
type UrgencyLevel = 'urgent' | 'warning' | 'safe' | 'ongoing';
```

### 2. calculateDday 함수 수정

```typescript
const calculateDday = (endDate: string | null | undefined): DdayInfo => {
  // 마감일이 없는 경우 = 예산 소진 시까지 = 상시 모집
  if (!endDate) {
    return {
      daysRemaining: Infinity,
      urgency: 'ongoing',
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

### 3. activeAnnouncements 필터링 로직 수정

#### AS-IS
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

#### TO-BE
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

### 4. 정렬 로직 수정

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

### 5. 통계 계산 업데이트

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

### 6. 모달 헤더 통계 배지 추가

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

---

## 📱 Mobile 카드 레이아웃 변경

### 관련도 제거

#### AS-IS
```tsx
<div className="flex items-center justify-between">
  {announcement.is_manual ? (
    <span className="text-xs font-medium text-purple-700 bg-purple-100 px-2 py-1 rounded">
      ✍️ 수동등록
    </span>
  ) : (
    <span className="text-xs font-medium text-gray-700">
      관련도 {Math.round((announcement.relevance_score || 0) * 100)}%
    </span>
  )}
  <button ...>상세보기</button>
</div>
```

#### TO-BE
```tsx
<div className="flex items-center justify-end">
  {/* 관련도 제거, 버튼만 유지 */}
  <button
    onClick={(e) => {
      e.stopPropagation();
      onAnnouncementClick(announcement);
    }}
    className="px-3 py-1.5 bg-indigo-600 text-white rounded-lg text-xs font-medium"
  >
    상세보기
  </button>
</div>
```

### 예산소진시 표시

```tsx
{/* Card Meta */}
<div className="flex items-center justify-between text-xs text-gray-600 mb-3">
  <span className="flex items-center gap-1 truncate flex-1 min-w-0 mr-2" title={formatBudget(announcement.budget)}>
    💰 <span className="truncate">{formatBudget(announcement.budget)}</span>
  </span>
  <span className="flex items-center gap-1 flex-shrink-0 whitespace-nowrap">
    {announcement.application_period_end ? (
      <>📅 ~{formatDate(announcement.application_period_end)}</>
    ) : (
      <span className="text-purple-700 font-medium">📅 ~예산소진시</span>
    )}
  </span>
</div>
```

---

## ✅ 구현 체크리스트

### app/admin/subsidy/page.tsx
- [ ] Lines 577-595: 그라데이션 카드 삭제
- [ ] Lines 617-680: 필터 영역에 신청가능 공고 버튼 추가

### components/subsidy/ActiveAnnouncementsModal.tsx
- [ ] `UrgencyLevel` 타입에 `'ongoing'` 추가
- [ ] `calculateDday` 함수: `null` 처리 추가
- [ ] `activeAnnouncements` 필터: 마감일 없는 공고 포함
- [ ] 정렬 로직: `Infinity` 처리 추가
- [ ] 통계 계산: `ongoing` 카운트 추가
- [ ] 모달 헤더: 상시모집 통계 배지 추가
- [ ] 테이블 컬럼: 관련도, 상세 제거
- [ ] 테이블 너비: 6개 컬럼 재조정
- [ ] 신청기간 컬럼: "예산소진시" 표시
- [ ] D-day 배지: 보라색 "♾️ 예산소진시" 스타일
- [ ] Mobile 카드: 관련도 제거
- [ ] Mobile 카드: 예산소진시 표시

---

## 🎨 최종 UI 프리뷰

### 필터 영역 (Desktop)
```
┌────────────────────────────────────────────────────────────────────┐
│ 상태     관련성          출처          검색 (실시간)         버튼   │
│ [전체▼] [관련공고만▼] [전체▼] [제목,지역 검색...]  [📋 신청가능 공고]│
└────────────────────────────────────────────────────────────────────┘
```

### 모달 통계 배지
```
┌───────────────────────────────────────────────────────────┐
│ [🔥 긴급 2건] [⚠️ 주의 3건] [✅ 여유 5건] [♾️ 상시모집 1건] │
└───────────────────────────────────────────────────────────┘
```

### 테이블 (6개 컬럼)
```
┌────────┬──────────┬────────────────┬──────────┬─────────┬──────────┐
│ 상태   │ 지역     │ 공고 제목       │ 신청기간  │ D-day   │ 예산     │
├────────┼──────────┼────────────────┼──────────┼─────────┼──────────┤
│ 🔥     │ 서울시   │ 환경시설 보조금 │ 01.15    │ 🔥 D-5  │ 5억원    │
│        │          │                │ ~02.01   │         │          │
├────────┼──────────┼────────────────┼──────────┼─────────┼──────────┤
│ ♾️     │ 경기도   │ 상시 지원사업   │ 01.01    │ ♾️      │ 10억원   │
│        │          │                │ ~예산소진시│ 예산소진시│         │
└────────┴──────────┴────────────────┴──────────┴─────────┴──────────┘
```

---

**작성자**: Claude Sonnet 4.5
**버전**: 3.0
**최종 수정**: 2026-01-28
