# Modal Fixes Design Specification

**작성일**: 2026-01-28
**목적**: ManualUploadModal 수정 버그 및 ActiveAnnouncementsModal 표 레이아웃 개선

---

## 📋 문제 정의

### Issue 1: 수정 모드 폼 값 미입력 문제
**현상**: 등록된 공고 수정 버튼 클릭 시 폼 필드가 빈 상태로 표시됨
**영향**: 사용자가 기존 값을 수동으로 다시 입력해야 함
**원인 추정**: `existingData` prop이 폼 state 초기화에 반영되지 않음

### Issue 2: 지역 컬럼 텍스트 오버플로우
**현상**: 긴 지역명이 표 레이아웃을 깨뜨림
**예시**: "서울특별시 강남구, 서초구, 송파구, 강동구" 등
**영향**: 표 가독성 저하, 모바일 레이아웃 붕괴

### Issue 3: 전체 컬럼 너비 제어 부재
**현상**: 모든 컬럼이 콘텐츠 길이에 따라 자동 확장
**영향**: 수평 스크롤 발생, 일관성 없는 레이아웃

---

## 🔧 Issue 1: ManualUploadModal 수정 모드 버그

### 현재 코드 분석 필요 사항

**파일**: `components/subsidy/ManualUploadModal.tsx`

#### 1. Props 인터페이스 확인
```typescript
interface ManualUploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  existingData?: SubsidyAnnouncement | null;
  editMode: boolean;
}
```

#### 2. 폼 State 초기화 확인
```typescript
// ❓ 현재 구현 확인 필요
const [formData, setFormData] = useState({
  title: '',
  region: '',
  // ...
});

// ✅ 필요한 구현
useEffect(() => {
  if (editMode && existingData) {
    setFormData({
      title: existingData.title || '',
      region: existingData.region || '',
      application_period_start: existingData.application_period_start || '',
      application_period_end: existingData.application_period_end || '',
      budget: existingData.budget?.toString() || '',
      support_content: existingData.support_content || '',
      contact: existingData.contact || '',
      url: existingData.url || '',
      relevance: existingData.relevance || 'unrelated',
      source: existingData.source || 'manual',
    });
  }
}, [editMode, existingData]);
```

### 해결 방안

#### A. useEffect를 통한 초기화 (권장)
```typescript
useEffect(() => {
  if (editMode && existingData) {
    // 모든 필드 초기화
    setFormData({
      title: existingData.title || '',
      region: existingData.region || '',
      application_period_start: existingData.application_period_start || '',
      application_period_end: existingData.application_period_end || '',
      budget: existingData.budget?.toString() || '',
      support_content: existingData.support_content || '',
      contact: existingData.contact || '',
      url: existingData.url || '',
      relevance: existingData.relevance || 'unrelated',
      source: existingData.source || 'manual',
    });
  } else if (!isOpen) {
    // 모달 닫힐 때 폼 초기화
    setFormData({
      title: '',
      region: '',
      application_period_start: '',
      application_period_end: '',
      budget: '',
      support_content: '',
      contact: '',
      url: '',
      relevance: 'unrelated',
      source: 'manual',
    });
  }
}, [editMode, existingData, isOpen]);
```

**장점**:
- 명확한 의도 표현
- 모달 열릴 때 자동 초기화
- 디버깅 용이

#### B. Controlled Components 패턴
```typescript
<input
  type="text"
  value={editMode && existingData ? existingData.title : formData.title}
  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
/>
```

**단점**: 코드 중복, 유지보수 어려움

### 검증 체크리스트
- [ ] `existingData` prop이 올바르게 전달되는지 확인
- [ ] `editMode` 플래그가 올바르게 설정되는지 확인
- [ ] 모든 폼 필드가 초기화되는지 확인
- [ ] 모달 닫을 때 폼이 초기화되는지 확인
- [ ] 날짜 필드 포맷 호환성 확인

---

## 🎨 Issue 2 & 3: ActiveAnnouncementsModal 표 레이아웃

### 컬럼별 너비 전략

#### Desktop 테이블 (≥768px)
```tsx
<table className="w-full">
  <thead>
    <tr>
      {/* 제목 - 가장 넓게 */}
      <th className="w-[35%] px-4 py-3">제목</th>

      {/* 지역 - 고정 너비 + 말줄임 */}
      <th className="w-[15%] px-4 py-3">지역</th>

      {/* 신청기간 */}
      <th className="w-[12%] px-4 py-3">신청기간</th>

      {/* 예산 */}
      <th className="w-[12%] px-4 py-3">예산</th>

      {/* 관련성 */}
      <th className="w-[10%] px-4 py-3">관련성</th>

      {/* D-day */}
      <th className="w-[10%] px-4 py-3">D-day</th>

      {/* 출처 */}
      <th className="w-[6%] px-4 py-3">출처</th>
    </tr>
  </thead>
</table>
```

### 컬럼별 Truncation 전략

#### 1. 제목 (Title) - 2줄 제한
```tsx
<td className="px-4 py-4">
  <div className="line-clamp-2 text-sm font-medium text-gray-900 cursor-pointer hover:text-indigo-600 transition-colors">
    {announcement.title}
  </div>
</td>
```

#### 2. 지역 (Region) - 1줄 말줄임 + Tooltip
```tsx
<td className="px-4 py-4">
  <div
    className="max-w-[150px] truncate text-xs text-gray-600"
    title={announcement.region} // ✅ 전체 텍스트 툴팁
  >
    {announcement.region}
  </div>
</td>
```

#### 3. 신청기간 (Period) - 날짜 포맷 간소화
```tsx
<td className="px-4 py-4 whitespace-nowrap">
  <div className="text-xs text-gray-600">
    {announcement.application_period_start && (
      <div>{formatDate(announcement.application_period_start)}</div>
    )}
    <div className="text-gray-400">~</div>
    {announcement.application_period_end ? (
      <div className="font-medium text-gray-900">
        {formatDate(announcement.application_period_end)}
      </div>
    ) : (
      <div className="font-medium text-purple-700">
        ~ 예산소진시
      </div>
    )}
  </div>
</td>

// 날짜 포맷 함수
const formatDate = (dateString: string) => {
  const date = new Date(dateString);
  return `${date.getMonth() + 1}.${date.getDate()}`; // "1.15" 형식
};
```

#### 4. 예산 (Budget) - 숫자 포맷 간소화
```tsx
<td className="px-4 py-4 whitespace-nowrap">
  <div className="max-w-[130px] truncate text-xs font-semibold text-indigo-600">
    {formatBudget(announcement.budget)}
  </div>
</td>

// 예산 포맷 함수
const formatBudget = (budget: number | null) => {
  if (!budget) return '-';
  if (budget >= 100000000) return `${(budget / 100000000).toFixed(1)}억`;
  if (budget >= 10000) return `${(budget / 10000).toFixed(0)}만`;
  return `${budget.toLocaleString()}원`;
};
```

#### 5. 관련성 (Relevance) - 뱃지 간소화
```tsx
<td className="px-4 py-4 text-center">
  <span className={`
    inline-flex px-2 py-1 rounded-full text-xs font-medium
    ${announcement.relevance === 'related'
      ? 'bg-green-100 text-green-800'
      : 'bg-gray-100 text-gray-600'}
  `}>
    {announcement.relevance === 'related' ? '관련' : '무관'}
  </span>
</td>
```

#### 6. D-day - 기존 유지
```tsx
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

#### 7. 출처 (Source) - 아이콘만
```tsx
<td className="px-4 py-4 text-center">
  <span className="text-lg" title={announcement.source === 'crawler' ? '크롤러' : '수동등록'}>
    {announcement.source === 'crawler' ? '🤖' : '✍️'}
  </span>
</td>
```

### Mobile 카드 레이아웃 개선

```tsx
{/* Mobile Cards */}
<div className="md:hidden space-y-3">
  {sortedAnnouncements.map((announcement) => {
    const ddayInfo = calculateDday(announcement.application_period_end);

    return (
      <div key={announcement.id} className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
        {/* Title - 2줄 제한 */}
        <h3 className="font-semibold text-gray-900 mb-2 line-clamp-2">
          {announcement.title}
        </h3>

        {/* Meta Row */}
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

        {/* Region - 1줄 말줄임 */}
        <div className="text-xs text-gray-600 mb-3 truncate" title={announcement.region}>
          📍 {announcement.region}
        </div>

        {/* D-day Badge */}
        <div className="flex items-center justify-between">
          <span className={`
            inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold
            ${ddayInfo.urgency === 'urgent' ? 'bg-red-100 text-red-800' : ''}
            ${ddayInfo.urgency === 'warning' ? 'bg-amber-100 text-amber-800' : ''}
            ${ddayInfo.urgency === 'safe' ? 'bg-emerald-100 text-emerald-800' : ''}
            ${ddayInfo.urgency === 'ongoing' ? 'bg-purple-100 text-purple-800' : ''}
          `}>
            {ddayInfo.icon} {ddayInfo.label}
          </span>

          {/* Relevance Badge */}
          <span className={`
            inline-flex px-2 py-1 rounded-full text-xs font-medium
            ${announcement.relevance === 'related'
              ? 'bg-green-100 text-green-800'
              : 'bg-gray-100 text-gray-600'}
          `}>
            {announcement.relevance === 'related' ? '관련' : '무관'}
          </span>
        </div>
      </div>
    );
  })}
</div>
```

---

## 📊 CSS 유틸리티 클래스 정리

### Tailwind Truncation Classes
```css
/* 1줄 말줄임 */
.truncate {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* 2줄 말줄임 */
.line-clamp-2 {
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

/* 3줄 말줄임 */
.line-clamp-3 {
  display: -webkit-box;
  -webkit-line-clamp: 3;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
```

### 너비 제어 클래스
```css
max-w-[150px]  /* 지역 컬럼 */
max-w-[130px]  /* 예산 컬럼 */
w-[35%]        /* 제목 컬럼 */
w-[15%]        /* 지역 컬럼 */
```

---

## ✅ 구현 체크리스트

### Issue 1: ManualUploadModal
- [ ] `existingData` prop 전달 확인 (부모 컴포넌트)
- [ ] `editMode` 플래그 전달 확인
- [ ] useEffect 초기화 로직 추가
- [ ] 모든 폼 필드 초기화 확인
- [ ] 날짜 필드 포맷 호환성 테스트
- [ ] 모달 닫을 때 폼 초기화 확인

### Issue 2 & 3: ActiveAnnouncementsModal
- [ ] 컬럼별 고정 너비 설정 (`w-[%]`)
- [ ] 제목: `line-clamp-2` 적용
- [ ] 지역: `max-w-[150px] truncate` + `title` 속성
- [ ] 신청기간: `whitespace-nowrap` + 간소화된 날짜 포맷
- [ ] 예산: `max-w-[130px] truncate` + 간소화된 숫자 포맷
- [ ] 관련성: 뱃지 간소화
- [ ] D-day: 기존 스타일 유지
- [ ] 출처: 아이콘만 표시 + `title` 툴팁
- [ ] Mobile 카드: 모든 텍스트에 말줄임 적용
- [ ] 전체 테이블 `overflow-x: hidden` 확인

---

## 🧪 테스트 시나리오

### ManualUploadModal 테스트
1. **수정 버튼 클릭**: 기존 공고 선택 → 수정 버튼 클릭 → 모든 필드 값 확인
2. **신규 등록**: 등록 버튼 클릭 → 빈 폼 확인
3. **모달 닫기**: 수정 모드 → 모달 닫기 → 재오픈 시 빈 폼 확인

### ActiveAnnouncementsModal 테스트
1. **긴 지역명**: "서울특별시 강남구, 서초구, 송파구, 강동구" 입력 → 말줄임 확인
2. **긴 제목**: 50자 이상 제목 → 2줄 제한 확인
3. **반응형**: 모바일/태블릿/데스크톱 레이아웃 확인
4. **툴팁**: 말줄임된 텍스트에 마우스 오버 → 전체 텍스트 표시 확인

---

**작성자**: Claude Sonnet 4.5
**버전**: 1.0
**최종 수정**: 2026-01-28
