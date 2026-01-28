# Active Announcements Modal Design
# 신청 가능한 공고 팝업 디자인 명세서

**작성일**: 2026-01-28
**대상 페이지**: admin/subsidy
**목적**: 신청기간이 유효한 공고들을 프리미엄 디자인의 팝업 테이블로 표시

---

## 📋 요구사항

### 기능 요구사항
1. **데이터 필터링**: `application_period_end`가 현재 날짜 이후인 공고만 표시
2. **테이블 표시**: 공고 정보를 구조화된 표 형태로 정리
3. **프리미엄 디자인**: 하이퀄리티 UI/UX with 모던한 비주얼
4. **반응형 디자인**: 데스크톱(테이블) ↔ 모바일(카드) 자동 전환
5. **정렬/검색**: 사용자가 데이터를 쉽게 탐색할 수 있도록

### 비기능 요구사항
- 애니메이션 smooth 60fps
- 100개 이상 데이터도 빠른 렌더링
- 접근성 WCAG 2.1 AA 준수
- 키보드 네비게이션 지원

---

## 🎨 디자인 시스템

### 색상 팔레트 (Premium Palette)

```typescript
const designTokens = {
  // Primary Colors
  primary: {
    50: '#EEF2FF',   // Indigo-50 (light background)
    100: '#E0E7FF',  // Indigo-100
    500: '#6366F1',  // Indigo-500 (accent)
    600: '#4F46E5',  // Indigo-600 (primary)
    700: '#4338CA',  // Indigo-700 (hover)
  },

  // Status Colors
  urgent: {
    bg: '#FEE2E2',    // Red-100
    text: '#991B1B',  // Red-800
    border: '#FCA5A5', // Red-300
    icon: '🔥',
    condition: 'D-7 이내'
  },
  warning: {
    bg: '#FEF3C7',    // Amber-100
    text: '#92400E',  // Amber-800
    border: '#FCD34D', // Amber-300
    icon: '⚠️',
    condition: 'D-14 이내'
  },
  safe: {
    bg: '#D1FAE5',    // Emerald-100
    text: '#065F46',  // Emerald-800
    border: '#6EE7B7', // Emerald-300
    icon: '✅',
    condition: '여유 있음'
  },

  // Neutral Colors
  gray: {
    50: '#F9FAFB',
    100: '#F3F4F6',
    200: '#E5E7EB',
    300: '#D1D5DB',
    500: '#6B7280',
    600: '#4B5563',
    700: '#374151',
    800: '#1F2937',
    900: '#111827',
  },
}
```

### 타이포그래피

```css
/* 제목 (Modal Header) */
.modal-title {
  font-size: 1.5rem;      /* 24px */
  font-weight: 700;       /* bold */
  letter-spacing: -0.025em; /* tight */
  color: theme('colors.gray.900');
}

/* 부제목 (Stats, Labels) */
.modal-subtitle {
  font-size: 0.875rem;    /* 14px */
  font-weight: 500;       /* medium */
  color: theme('colors.gray.600');
}

/* 테이블 헤더 */
.table-header {
  font-size: 0.75rem;     /* 12px */
  font-weight: 600;       /* semibold */
  text-transform: uppercase;
  letter-spacing: 0.05em; /* wide */
  color: theme('colors.gray.700');
}

/* 테이블 데이터 */
.table-data {
  font-size: 0.875rem;    /* 14px */
  font-weight: 400;       /* normal */
  color: theme('colors.gray.900');
}

/* 숫자 데이터 (예산, D-day) */
.table-number {
  font-variant-numeric: tabular-nums; /* 숫자 정렬 */
  font-weight: 600;
}
```

### 그림자 및 깊이

```css
/* Modal Backdrop */
backdrop-filter: blur(8px);
background-color: rgba(17, 24, 39, 0.5); /* gray-900 with 50% opacity */

/* Modal Container */
box-shadow:
  0 20px 25px -5px rgba(0, 0, 0, 0.1),
  0 10px 10px -5px rgba(0, 0, 0, 0.04);

/* Table Row Hover */
box-shadow:
  0 4px 6px -1px rgba(0, 0, 0, 0.1),
  0 2px 4px -1px rgba(0, 0, 0, 0.06);
transform: translateY(-2px);
```

---

## 🏗️ 컴포넌트 구조

### 파일 위치
```
/components/subsidy/ActiveAnnouncementsModal.tsx
```

### Props Interface

```typescript
import type { SubsidyAnnouncement } from '@/types/subsidy';

interface ActiveAnnouncementsModalProps {
  /** 모달 표시 여부 */
  isOpen: boolean;

  /** 모달 닫기 핸들러 */
  onClose: () => void;

  /** 전체 공고 목록 (필터링은 컴포넌트 내부에서 수행) */
  announcements: SubsidyAnnouncement[];

  /** 공고 클릭 시 실행 (상세 모달 열기) */
  onAnnouncementClick: (announcement: SubsidyAnnouncement) => void;
}
```

### 컴포넌트 계층 구조

```
ActiveAnnouncementsModal
├─ Modal Backdrop (fixed full-screen with blur)
├─ Modal Container (centered, max-w-7xl)
│  ├─ Modal Header
│  │  ├─ Title + Close Button
│  │  └─ Stats Summary (긴급 N건 | 주의 M건 | 여유 K건)
│  │
│  ├─ Filter Bar
│  │  ├─ Search Input (실시간 검색)
│  │  ├─ Region Filter (드롭다운)
│  │  └─ Sort Options (마감일순/예산순/관련도순)
│  │
│  ├─ Table Component
│  │  ├─ Table Header (sticky)
│  │  │  ├─ Status Column (정렬 가능)
│  │  │  ├─ Region Column
│  │  │  ├─ Title Column
│  │  │  ├─ Period Column
│  │  │  ├─ D-day Column (정렬 가능)
│  │  │  ├─ Budget Column (정렬 가능)
│  │  │  ├─ Relevance Column
│  │  │  └─ Action Column
│  │  │
│  │  └─ Table Body (scrollable)
│  │     └─ Table Rows (hover effects, click handlers)
│  │
│  └─ Modal Footer
│     ├─ Total Count Display
│     └─ Action Buttons (전체 선택, 일괄 처리 등)
```

---

## 📊 테이블 컬럼 명세

### Desktop View (≥768px)

| 컬럼명 | Width | 정렬 가능 | 내용 |
|--------|-------|----------|------|
| 🔥 상태 | 60px | ✅ | 긴급도 아이콘 (🔥⚠️✅) |
| 지역 | 120px | ✅ | 시/도명 (경기도, 서울특별시 등) |
| 공고 제목 | flex-1 | ❌ | 제목 (2줄 ellipsis, hover tooltip) |
| 신청기간 | 200px | ❌ | YYYY.MM.DD ~ YYYY.MM.DD |
| D-day | 90px | ✅ | 배지 형태 (D-7, D-14 등) |
| 예산 | 130px | ✅ | 억원 단위 (천단위 콤마) |
| 관련도 | 100px | ✅ | 퍼센트 or 수동등록 표시 |
| 상세 | 100px | ❌ | 상세보기 버튼 |

**총 너비**: ~1000px (max-w-7xl 컨테이너 내)

### Mobile View (<768px)

카드 레이아웃으로 변환:

```html
<div class="card">
  <div class="card-header">
    <span class="region-badge">경기도</span>
    <span class="dday-badge urgent">D-5</span>
  </div>

  <h3 class="card-title">
    [성남시] IoT 기반 스마트팩토리 구축 지원사업
  </h3>

  <div class="card-meta">
    <span>💰 5억원</span>
    <span>📅 ~2024.12.31</span>
  </div>

  <div class="card-footer">
    <span class="relevance">관련도 95%</span>
    <button class="detail-btn">상세보기</button>
  </div>
</div>
```

---

## 🎭 애니메이션 명세

### Modal Entrance Animation

```typescript
const modalVariants = {
  hidden: {
    opacity: 0,
    scale: 0.95,
    y: 20,
  },
  visible: {
    opacity: 1,
    scale: 1,
    y: 0,
    transition: {
      type: 'spring',
      stiffness: 300,
      damping: 30,
      duration: 0.3,
    }
  },
  exit: {
    opacity: 0,
    scale: 0.95,
    y: 20,
    transition: {
      duration: 0.2,
    }
  }
}

// Backdrop Animation
const backdropVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { duration: 0.2 }
  },
  exit: {
    opacity: 0,
    transition: { duration: 0.15 }
  }
}
```

### Table Row Hover Effect

```css
.table-row {
  transition: all 0.15s cubic-bezier(0.4, 0, 0.2, 1);
}

.table-row:hover {
  background-color: rgba(99, 102, 241, 0.05); /* indigo-500/5 */
  transform: translateY(-2px);
  box-shadow:
    0 4px 6px -1px rgba(0, 0, 0, 0.1),
    0 2px 4px -1px rgba(0, 0, 0, 0.06);
}

.table-row:active {
  transform: translateY(0);
  box-shadow:
    0 1px 2px 0 rgba(0, 0, 0, 0.05);
}
```

### Sort Icon Rotation

```css
.sort-icon {
  transition: transform 0.2s ease-in-out;
}

.sort-icon.asc {
  transform: rotate(0deg);
}

.sort-icon.desc {
  transform: rotate(180deg);
}
```

---

## 💻 데이터 처리 로직

### 필터링 함수

```typescript
const getActiveAnnouncements = (
  announcements: SubsidyAnnouncement[]
): SubsidyAnnouncement[] => {
  const now = new Date();

  return announcements.filter(announcement => {
    // 신청 종료일이 없으면 제외
    if (!announcement.application_period_end) return false;

    // 신청 종료일이 현재보다 미래인 경우만 포함
    const endDate = new Date(announcement.application_period_end);
    return endDate >= now;
  });
};
```

### D-day 계산 및 긴급도 판정

```typescript
type UrgencyLevel = 'urgent' | 'warning' | 'safe';

interface DayInfo {
  daysRemaining: number;
  urgency: UrgencyLevel;
  label: string;
  icon: string;
}

const calculateDday = (endDate: string): DayInfo => {
  const end = new Date(endDate);
  const today = new Date();
  today.setHours(0, 0, 0, 0); // 시간 제거
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

### 정렬 함수

```typescript
type SortField = 'dday' | 'budget' | 'relevance' | 'region';
type SortOrder = 'asc' | 'desc';

const sortAnnouncements = (
  announcements: SubsidyAnnouncement[],
  field: SortField,
  order: SortOrder
): SubsidyAnnouncement[] => {
  const sorted = [...announcements].sort((a, b) => {
    let comparison = 0;

    switch (field) {
      case 'dday': {
        const daysA = calculateDday(a.application_period_end!).daysRemaining;
        const daysB = calculateDday(b.application_period_end!).daysRemaining;
        comparison = daysA - daysB;
        break;
      }
      case 'budget': {
        const budgetA = parseBudget(a.budget || '0');
        const budgetB = parseBudget(b.budget || '0');
        comparison = budgetA - budgetB;
        break;
      }
      case 'relevance': {
        const scoreA = a.is_manual ? 1 : (a.relevance_score || 0);
        const scoreB = b.is_manual ? 1 : (b.relevance_score || 0);
        comparison = scoreA - scoreB;
        break;
      }
      case 'region': {
        comparison = (a.region_name || '').localeCompare(b.region_name || '', 'ko');
        break;
      }
    }

    return order === 'asc' ? comparison : -comparison;
  });

  return sorted;
};

// 예산 문자열 파싱 (억원 단위로 변환)
const parseBudget = (budgetStr: string): number => {
  const numbers = budgetStr.replace(/[^\d]/g, '');
  if (!numbers) return 0;

  // "5억원" → 500000000
  // "50억원" → 5000000000
  if (budgetStr.includes('억')) {
    return parseInt(numbers) * 100000000;
  }
  return parseInt(numbers);
};
```

### 검색 필터링

```typescript
const searchAnnouncements = (
  announcements: SubsidyAnnouncement[],
  query: string
): SubsidyAnnouncement[] => {
  if (!query.trim()) return announcements;

  const lowercaseQuery = query.toLowerCase();

  return announcements.filter(announcement => {
    const searchableText = [
      announcement.title,
      announcement.region_name,
      announcement.target_description,
      announcement.budget,
      ...(announcement.keywords_matched || [])
    ].join(' ').toLowerCase();

    return searchableText.includes(lowercaseQuery);
  });
};
```

---

## 🎨 UI 컴포넌트 상세 디자인

### 1. Modal Container

```tsx
<div
  className="fixed inset-0 z-50 flex items-center justify-center p-4"
  onClick={onClose}
>
  {/* Backdrop */}
  <div
    className="absolute inset-0 bg-gray-900/50 backdrop-blur-sm"
    aria-hidden="true"
  />

  {/* Modal */}
  <div
    className="relative bg-white rounded-2xl shadow-2xl max-w-7xl w-full max-h-[90vh] overflow-hidden"
    onClick={(e) => e.stopPropagation()}
  >
    {/* Content */}
  </div>
</div>
```

### 2. Modal Header

```tsx
<div className="sticky top-0 z-10 bg-gradient-to-br from-indigo-50 to-slate-50 border-b border-gray-200/60 px-6 py-5">
  <div className="flex items-center justify-between mb-4">
    <div>
      <h2 className="text-2xl font-bold text-gray-900 tracking-tight">
        📋 신청 가능한 공고
      </h2>
      <p className="text-sm text-gray-600 mt-1">
        현재 신청기간이 유효한 공고 목록입니다
      </p>
    </div>

    <button
      onClick={onClose}
      className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
      aria-label="닫기"
    >
      <svg className="w-6 h-6 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
      </svg>
    </button>
  </div>

  {/* Stats Summary */}
  <div className="flex gap-3">
    <div className="flex items-center gap-2 px-3 py-2 bg-red-50 border border-red-200 rounded-lg">
      <span className="text-lg">🔥</span>
      <span className="text-sm font-medium text-red-800">긴급 {urgentCount}건</span>
    </div>
    <div className="flex items-center gap-2 px-3 py-2 bg-amber-50 border border-amber-200 rounded-lg">
      <span className="text-lg">⚠️</span>
      <span className="text-sm font-medium text-amber-800">주의 {warningCount}건</span>
    </div>
    <div className="flex items-center gap-2 px-3 py-2 bg-emerald-50 border border-emerald-200 rounded-lg">
      <span className="text-lg">✅</span>
      <span className="text-sm font-medium text-emerald-800">여유 {safeCount}건</span>
    </div>
  </div>
</div>
```

### 3. Filter Bar

```tsx
<div className="px-6 py-4 bg-white border-b border-gray-200/60">
  <div className="flex flex-wrap gap-3 items-center">
    {/* Search Input */}
    <div className="flex-1 min-w-[240px]">
      <div className="relative">
        <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="제목, 지역, 키워드 검색..."
          className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all text-sm"
        />
      </div>
    </div>

    {/* Region Filter */}
    <select
      value={selectedRegion}
      onChange={(e) => setSelectedRegion(e.target.value)}
      className="px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all text-sm font-medium"
    >
      <option value="all">전체 지역</option>
      <option value="서울특별시">서울특별시</option>
      <option value="경기도">경기도</option>
      {/* ... 기타 지역 */}
    </select>

    {/* Sort Dropdown */}
    <select
      value={`${sortField}-${sortOrder}`}
      onChange={(e) => {
        const [field, order] = e.target.value.split('-');
        setSortField(field as SortField);
        setSortOrder(order as SortOrder);
      }}
      className="px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all text-sm font-medium"
    >
      <option value="dday-asc">마감일 임박순</option>
      <option value="dday-desc">마감일 여유순</option>
      <option value="budget-desc">예산 높은순</option>
      <option value="budget-asc">예산 낮은순</option>
      <option value="relevance-desc">관련도 높은순</option>
    </select>
  </div>
</div>
```

### 4. Table Component (Desktop)

```tsx
<div className="overflow-auto max-h-[calc(90vh-280px)]">
  <table className="w-full">
    <thead className="sticky top-0 bg-gradient-to-br from-gray-50 to-slate-50 border-b border-gray-200">
      <tr>
        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
          상태
        </th>
        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
          지역
        </th>
        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
          공고 제목
        </th>
        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
          신청기간
        </th>
        <th className="px-4 py-3 text-center text-xs font-semibold text-gray-700 uppercase tracking-wider cursor-pointer hover:bg-gray-100/50 transition-colors">
          <div className="flex items-center justify-center gap-1">
            D-day
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </div>
        </th>
        <th className="px-4 py-3 text-right text-xs font-semibold text-gray-700 uppercase tracking-wider cursor-pointer hover:bg-gray-100/50 transition-colors">
          <div className="flex items-center justify-end gap-1">
            예산
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </div>
        </th>
        <th className="px-4 py-3 text-center text-xs font-semibold text-gray-700 uppercase tracking-wider">
          관련도
        </th>
        <th className="px-4 py-3 text-center text-xs font-semibold text-gray-700 uppercase tracking-wider">
          상세
        </th>
      </tr>
    </thead>

    <tbody className="divide-y divide-gray-200">
      {filteredAnnouncements.map((announcement) => {
        const ddayInfo = calculateDday(announcement.application_period_end!);

        return (
          <tr
            key={announcement.id}
            onClick={() => onAnnouncementClick(announcement)}
            className="hover:bg-indigo-50/50 cursor-pointer transition-all duration-150 hover:-translate-y-0.5 hover:shadow-md"
          >
            {/* Status Icon */}
            <td className="px-4 py-4">
              <span className="text-2xl">{ddayInfo.icon}</span>
            </td>

            {/* Region */}
            <td className="px-4 py-4">
              <span className="text-sm font-medium text-gray-900">
                {extractRegion(announcement.title, announcement.region_name)}
              </span>
            </td>

            {/* Title */}
            <td className="px-4 py-4 max-w-md">
              <div className="flex items-start gap-2">
                {!announcement.is_read && (
                  <div className="w-2 h-2 bg-blue-600 rounded-full mt-1.5 flex-shrink-0"></div>
                )}
                <p className="text-sm font-medium text-gray-900 line-clamp-2 hover:text-indigo-600 transition-colors">
                  {cleanTitle(announcement.title)}
                </p>
              </div>
            </td>

            {/* Period */}
            <td className="px-4 py-4 whitespace-nowrap">
              <div className="text-sm text-gray-600">
                <div>{formatDate(announcement.application_period_start)}</div>
                <div className="text-gray-400">~</div>
                <div className="font-medium text-gray-900">{formatDate(announcement.application_period_end)}</div>
              </div>
            </td>

            {/* D-day Badge */}
            <td className="px-4 py-4 text-center">
              <span className={`
                inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-bold
                ${ddayInfo.urgency === 'urgent' ? 'bg-red-100 text-red-800 border border-red-300' : ''}
                ${ddayInfo.urgency === 'warning' ? 'bg-amber-100 text-amber-800 border border-amber-300' : ''}
                ${ddayInfo.urgency === 'safe' ? 'bg-emerald-100 text-emerald-800 border border-emerald-300' : ''}
              `}>
                {ddayInfo.label}
              </span>
            </td>

            {/* Budget */}
            <td className="px-4 py-4 text-right">
              <span className="text-sm font-semibold text-gray-900 tabular-nums">
                {formatBudget(announcement.budget)}
              </span>
            </td>

            {/* Relevance */}
            <td className="px-4 py-4 text-center">
              {announcement.is_manual ? (
                <span className="text-xs font-medium text-purple-700 bg-purple-100 px-2 py-1 rounded">
                  수동등록
                </span>
              ) : (
                <span className="text-sm font-semibold text-gray-900 tabular-nums">
                  {Math.round((announcement.relevance_score || 0) * 100)}%
                </span>
              )}
            </td>

            {/* Action Button */}
            <td className="px-4 py-4 text-center">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onAnnouncementClick(announcement);
                }}
                className="px-3 py-1.5 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors text-xs font-medium"
              >
                상세보기
              </button>
            </td>
          </tr>
        );
      })}
    </tbody>
  </table>
</div>
```

### 5. Mobile Card View (<768px)

```tsx
<div className="md:hidden divide-y divide-gray-200">
  {filteredAnnouncements.map((announcement) => {
    const ddayInfo = calculateDday(announcement.application_period_end!);

    return (
      <div
        key={announcement.id}
        onClick={() => onAnnouncementClick(announcement)}
        className="p-4 hover:bg-indigo-50/50 cursor-pointer transition-colors"
      >
        {/* Card Header */}
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <span className="text-xl">{ddayInfo.icon}</span>
            <span className="text-sm font-medium text-gray-900">
              {extractRegion(announcement.title, announcement.region_name)}
            </span>
          </div>

          <span className={`
            px-2.5 py-1 rounded-full text-xs font-bold
            ${ddayInfo.urgency === 'urgent' ? 'bg-red-100 text-red-800' : ''}
            ${ddayInfo.urgency === 'warning' ? 'bg-amber-100 text-amber-800' : ''}
            ${ddayInfo.urgency === 'safe' ? 'bg-emerald-100 text-emerald-800' : ''}
          `}>
            {ddayInfo.label}
          </span>
        </div>

        {/* Card Title */}
        <h3 className="text-sm font-semibold text-gray-900 line-clamp-2 mb-3">
          {cleanTitle(announcement.title)}
        </h3>

        {/* Card Meta */}
        <div className="flex items-center justify-between text-xs text-gray-600 mb-3">
          <span className="flex items-center gap-1">
            💰 {formatBudget(announcement.budget)}
          </span>
          <span className="flex items-center gap-1">
            📅 ~{formatDate(announcement.application_period_end)}
          </span>
        </div>

        {/* Card Footer */}
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
      </div>
    );
  })}
</div>
```

### 6. Modal Footer

```tsx
<div className="sticky bottom-0 bg-white border-t border-gray-200 px-6 py-4">
  <div className="flex items-center justify-between">
    <div className="text-sm text-gray-600">
      총 <span className="font-bold text-gray-900">{filteredAnnouncements.length}</span>건의 신청 가능한 공고
    </div>

    <button
      onClick={onClose}
      className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg transition-colors text-sm font-medium"
    >
      닫기
    </button>
  </div>
</div>
```

---

## 🔧 통합 가이드 (admin/subsidy/page.tsx)

### 1. 상태 추가

```typescript
// Line ~30 근처에 추가
const [showActiveAnnouncementsModal, setShowActiveAnnouncementsModal] = useState(false);
```

### 2. 버튼 추가 (통계 카드 근처)

```tsx
{/* Line ~574 근처, 통계 카드 바로 아래에 추가 */}
<div className="bg-gradient-to-r from-indigo-500 to-purple-600 rounded-lg shadow-lg p-4 mb-6">
  <div className="flex items-center justify-between">
    <div className="text-white">
      <h3 className="font-bold text-lg mb-1">📋 신청 가능한 공고</h3>
      <p className="text-sm text-indigo-100">
        현재 신청기간이 유효한 공고들을 한눈에 확인하세요
      </p>
    </div>
    <button
      onClick={() => setShowActiveAnnouncementsModal(true)}
      className="px-6 py-3 bg-white text-indigo-600 rounded-lg hover:bg-indigo-50 transition-colors font-semibold shadow-md hover:shadow-lg flex items-center gap-2"
    >
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
      </svg>
      공고 목록 보기
    </button>
  </div>
</div>
```

### 3. 모달 컴포넌트 추가

```tsx
{/* Line ~850 근처, 다른 모달들 아래에 추가 */}
{showActiveAnnouncementsModal && (
  <ActiveAnnouncementsModal
    isOpen={showActiveAnnouncementsModal}
    onClose={() => setShowActiveAnnouncementsModal(false)}
    announcements={allAnnouncements}
    onAnnouncementClick={(announcement) => {
      setSelectedAnnouncement(announcement);
      markAsRead(announcement);
      setShowActiveAnnouncementsModal(false);
    }}
  />
)}
```

### 4. Import 추가

```typescript
// Line ~6 근처에 추가
import ActiveAnnouncementsModal from '@/components/subsidy/ActiveAnnouncementsModal';
```

---

## ♿ 접근성 (Accessibility)

### Keyboard Navigation

```typescript
useEffect(() => {
  if (!isOpen) return;

  const handleKeyDown = (e: KeyboardEvent) => {
    // ESC 키로 모달 닫기
    if (e.key === 'Escape') {
      onClose();
    }

    // Tab 트랩 구현
    if (e.key === 'Tab') {
      const focusableElements = modalRef.current?.querySelectorAll(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      );

      if (!focusableElements || focusableElements.length === 0) return;

      const firstElement = focusableElements[0] as HTMLElement;
      const lastElement = focusableElements[focusableElements.length - 1] as HTMLElement;

      if (e.shiftKey) {
        if (document.activeElement === firstElement) {
          lastElement.focus();
          e.preventDefault();
        }
      } else {
        if (document.activeElement === lastElement) {
          firstElement.focus();
          e.preventDefault();
        }
      }
    }
  };

  document.addEventListener('keydown', handleKeyDown);
  return () => document.removeEventListener('keydown', handleKeyDown);
}, [isOpen, onClose]);
```

### ARIA Attributes

```tsx
<div
  role="dialog"
  aria-modal="true"
  aria-labelledby="modal-title"
  aria-describedby="modal-description"
>
  <h2 id="modal-title">📋 신청 가능한 공고</h2>
  <p id="modal-description">현재 신청기간이 유효한 공고 목록입니다</p>

  {/* ... */}
</div>
```

### Focus Management

```typescript
useEffect(() => {
  if (isOpen) {
    // 모달 열릴 때 첫 번째 포커스 가능 요소에 포커스
    const firstFocusable = modalRef.current?.querySelector(
      'button, [href], input, select, textarea'
    ) as HTMLElement;

    firstFocusable?.focus();
  }
}, [isOpen]);
```

---

## 📈 성능 최적화

### 1. React.memo 최적화

```typescript
const TableRow = React.memo<{ announcement: SubsidyAnnouncement }>(({ announcement }) => {
  // Row rendering logic
}, (prevProps, nextProps) => {
  return prevProps.announcement.id === nextProps.announcement.id &&
         prevProps.announcement.is_read === nextProps.announcement.is_read;
});
```

### 2. useMemo로 필터링 캐싱

```typescript
const filteredAnnouncements = useMemo(() => {
  let result = getActiveAnnouncements(announcements);
  result = searchAnnouncements(result, searchQuery);
  result = filterByRegion(result, selectedRegion);
  result = sortAnnouncements(result, sortField, sortOrder);
  return result;
}, [announcements, searchQuery, selectedRegion, sortField, sortOrder]);
```

### 3. Virtual Scrolling (100개 이상 데이터)

```typescript
import { useVirtualizer } from '@tanstack/react-virtual';

const rowVirtualizer = useVirtualizer({
  count: filteredAnnouncements.length,
  getScrollElement: () => tableContainerRef.current,
  estimateSize: () => 60, // 예상 행 높이
  overscan: 10, // 화면 밖 렌더링 개수
});
```

---

## 🧪 테스트 시나리오

### 기능 테스트
- [ ] 모달 열기/닫기 정상 작동
- [ ] ESC 키로 모달 닫기
- [ ] 백드롭 클릭 시 모달 닫기
- [ ] 신청기간 필터링 정확성 확인
- [ ] D-day 계산 정확성 (긴급/주의/여유)
- [ ] 검색 기능 실시간 작동
- [ ] 정렬 기능 (오름차순/내림차순)
- [ ] 공고 클릭 시 상세 모달 열기
- [ ] 모바일 카드 뷰 전환 확인

### 성능 테스트
- [ ] 100개 데이터 렌더링 속도 (< 100ms)
- [ ] 검색 입력 지연 없음 (디바운싱 확인)
- [ ] 스크롤 부드러움 (60fps 유지)
- [ ] 애니메이션 끊김 없음

### 접근성 테스트
- [ ] 키보드만으로 모든 기능 사용 가능
- [ ] 스크린 리더 호환성
- [ ] Focus visible 상태 명확
- [ ] ARIA 속성 올바름

---

## 📦 파일 체크리스트

### 생성할 파일
- [ ] `/components/subsidy/ActiveAnnouncementsModal.tsx` - 메인 모달 컴포넌트

### 수정할 파일
- [ ] `/app/admin/subsidy/page.tsx` - 모달 통합 (상태, 버튼, import)

### 의존성 (필요시)
```json
{
  "dependencies": {
    "@tanstack/react-virtual": "^3.0.0" // Virtual scrolling (선택사항)
  }
}
```

---

## 🎯 기대 효과

### 사용자 경험
- ✅ 신청 가능한 공고를 한눈에 파악
- ✅ 긴급도 기반 우선순위 확인
- ✅ 빠른 검색 및 정렬로 원하는 공고 찾기
- ✅ 프리미엄 디자인으로 전문성 향상

### 운영 효율
- ✅ 마감 임박 공고 놓치지 않음
- ✅ 지역별/예산별 공고 관리 용이
- ✅ 모바일에서도 편리한 확인

---

**작성자**: Claude Sonnet 4.5
**버전**: 1.0
**최종 수정**: 2026-01-28
