# Active Announcements Auto-Popup Control Design

**작성일**: 2026-01-28
**목적**: 신청가능공고 자동 팝업에 "오늘 하루 그만보기" 기능 추가

---

## 📋 요구사항 분석

### 현재 동작
- **페이지 접속 시**: `admin/subsidy` 페이지에 접속할 때마다 신청가능공고 모달이 자동으로 팝업됨
- **수동 버튼**: 별도로 "신청가능 공고" 버튼이 있어서 필요할 때 언제든 모달을 열 수 있음

### 사용자 요구사항
1. **자동 팝업에만 적용**: 페이지 접속 시 자동으로 뜨는 모달에만 "오늘 하루 그만보기" 체크박스 표시
2. **수동 버튼은 무관**: 사용자가 버튼을 클릭해서 여는 모달에는 체크박스가 표시되지 않아야 함
3. **하루 동안 억제**: 체크박스를 선택하면 오늘 하루(자정까지) 동안 자동 팝업이 뜨지 않음
4. **다음 날 초기화**: 다음 날 첫 접속 시 다시 자동 팝업이 정상적으로 표시됨

---

## 🎯 핵심 설계 포인트

### 1. 모달 열림 모드 구분
```typescript
type ModalOpenMode = 'auto' | 'manual';

// 상태 추가
const [modalOpenMode, setModalOpenMode] = useState<ModalOpenMode | null>(null);
```

**구분 기준**:
- `auto`: 페이지 접속 시 자동으로 열림 (useEffect)
- `manual`: 사용자가 "신청가능 공고" 버튼 클릭으로 열림

### 2. LocalStorage 키 설계
```typescript
const STORAGE_KEY = 'subsidy_modal_hide_until';

interface HideUntilData {
  timestamp: number; // Date.now()
  hideUntil: string;  // 'YYYY-MM-DD' 형식
}
```

**저장 데이터**:
- `timestamp`: 설정한 시점 (디버깅용)
- `hideUntil`: 억제할 날짜 (예: '2026-01-28')

---

## 🔧 기술 구현

### 1. LocalStorage 유틸리티 함수

```typescript
// utils/modalHideControl.ts
export const MODAL_HIDE_STORAGE_KEY = 'subsidy_modal_hide_until';

export interface ModalHideData {
  timestamp: number;
  hideUntil: string; // YYYY-MM-DD
}

/**
 * 오늘 하루 모달 숨기기 설정
 */
export function setModalHideForToday(): void {
  const today = new Date();
  const hideUntil = today.toISOString().split('T')[0]; // YYYY-MM-DD

  const data: ModalHideData = {
    timestamp: Date.now(),
    hideUntil,
  };

  localStorage.setItem(MODAL_HIDE_STORAGE_KEY, JSON.stringify(data));
  console.log('[Modal] 오늘 하루 그만보기 설정:', hideUntil);
}

/**
 * 현재 모달을 숨길지 확인
 * @returns true: 숨겨야 함, false: 표시해야 함
 */
export function shouldHideModal(): boolean {
  try {
    const stored = localStorage.getItem(MODAL_HIDE_STORAGE_KEY);
    if (!stored) return false;

    const data: ModalHideData = JSON.parse(stored);
    const today = new Date().toISOString().split('T')[0];

    // 저장된 날짜가 오늘이면 숨김
    const shouldHide = data.hideUntil === today;

    console.log('[Modal] 숨김 확인:', { today, hideUntil: data.hideUntil, shouldHide });

    // 날짜가 지났으면 localStorage 정리
    if (!shouldHide) {
      localStorage.removeItem(MODAL_HIDE_STORAGE_KEY);
    }

    return shouldHide;
  } catch (error) {
    console.error('[Modal] 숨김 확인 오류:', error);
    return false;
  }
}

/**
 * 모달 숨기기 설정 해제
 */
export function clearModalHide(): void {
  localStorage.removeItem(MODAL_HIDE_STORAGE_KEY);
  console.log('[Modal] 오늘 하루 그만보기 해제');
}
```

### 2. 페이지 컴포넌트 수정 (page.tsx)

```typescript
// app/admin/subsidy/page.tsx

import { shouldHideModal } from '@/utils/modalHideControl';

export default function SubsidyAnnouncementsPage() {
  // 기존 상태들...
  const [showActiveAnnouncementsModal, setShowActiveAnnouncementsModal] = useState(false);
  const [modalOpenMode, setModalOpenMode] = useState<'auto' | 'manual' | null>(null);

  // 페이지 로드 시 자동 팝업 로직
  useEffect(() => {
    // 로딩 중이거나 데이터가 없으면 팝업 안 띄움
    if (loading || allAnnouncements.length === 0) return;

    // "오늘 하루 그만보기" 설정 확인
    if (shouldHideModal()) {
      console.log('[Subsidy] 오늘 하루 그만보기 설정됨 - 자동 팝업 억제');
      return;
    }

    // 신청 가능한 공고가 있으면 자동으로 모달 띄우기
    const activeCount = allAnnouncements.filter(a => {
      if (!a.application_period_end) return true;
      return new Date(a.application_period_end) >= new Date();
    }).length;

    if (activeCount > 0) {
      setModalOpenMode('auto'); // 자동 모드로 설정
      setShowActiveAnnouncementsModal(true);
    }
  }, [loading, allAnnouncements]);

  // 수동 버튼 클릭 핸들러
  const handleManualOpenModal = () => {
    setModalOpenMode('manual'); // 수동 모드로 설정
    setShowActiveAnnouncementsModal(true);
  };

  return (
    <AdminLayout>
      {/* ... 기존 UI ... */}

      {/* 신청가능 공고 버튼 */}
      <button
        onClick={handleManualOpenModal} // 수동 모드로 열기
        className="px-4 py-1.5 bg-gradient-to-r from-indigo-500 to-purple-600 text-white rounded-lg hover:from-indigo-600 hover:to-purple-700 transition-all text-sm font-medium whitespace-nowrap shadow-md hover:shadow-lg flex items-center gap-2"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
        </svg>
        <span className="hidden sm:inline">신청가능 공고</span>
        <span className="sm:hidden">공고</span>
      </button>

      {/* 신청가능한공고 모달 */}
      {showActiveAnnouncementsModal && (
        <ActiveAnnouncementsModal
          isOpen={showActiveAnnouncementsModal}
          onClose={() => {
            setShowActiveAnnouncementsModal(false);
            setModalOpenMode(null); // 모드 초기화
            setFromActiveModal(false);
          }}
          announcements={allAnnouncements}
          registeredRegions={registeredRegions}
          onAnnouncementClick={(announcement) => {
            setSelectedAnnouncement(announcement);
            markAsRead(announcement);
            setShowActiveAnnouncementsModal(false);
            setFromActiveModal(true);
          }}
          openMode={modalOpenMode} // 모드 전달
        />
      )}
    </AdminLayout>
  );
}
```

### 3. 모달 컴포넌트 수정 (ActiveAnnouncementsModal.tsx)

```typescript
// components/subsidy/ActiveAnnouncementsModal.tsx

import { setModalHideForToday } from '@/utils/modalHideControl';

interface ActiveAnnouncementsModalProps {
  isOpen: boolean;
  onClose: () => void;
  announcements: SubsidyAnnouncement[];
  registeredRegions?: string[];
  onAnnouncementClick: (announcement: SubsidyAnnouncement) => void;
  openMode?: 'auto' | 'manual' | null; // 추가
}

export default function ActiveAnnouncementsModal({
  isOpen,
  onClose,
  announcements,
  registeredRegions,
  onAnnouncementClick,
  openMode, // 추가
}: ActiveAnnouncementsModalProps) {
  // 체크박스 상태 (자동 모드일 때만 사용)
  const [hideForToday, setHideForToday] = useState(false);

  // 모달 닫기 핸들러 (체크박스 상태 확인)
  const handleClose = () => {
    if (openMode === 'auto' && hideForToday) {
      setModalHideForToday();
    }
    onClose();
  };

  // 기존 로직들...

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/30 backdrop-blur-sm"
        onClick={handleClose}
      />

      {/* Modal Content */}
      <div
        ref={modalRef}
        className="relative bg-white rounded-2xl shadow-2xl max-w-7xl w-full max-h-[90vh] overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 py-4 bg-gradient-to-r from-indigo-50 to-purple-50 border-b border-gray-200/60">
          {/* ... 기존 헤더 내용 ... */}
        </div>

        {/* Body */}
        {/* ... 기존 바디 내용 ... */}

        {/* Footer */}
        <div className="px-6 py-4 bg-gray-50 border-t border-gray-200">
          <div className="flex items-center justify-between">
            {/* 좌측: 오늘 하루 그만보기 (자동 모드일 때만 표시) */}
            <div className="flex items-center gap-2">
              {openMode === 'auto' && (
                <label className="flex items-center gap-2 cursor-pointer group">
                  <input
                    type="checkbox"
                    checked={hideForToday}
                    onChange={(e) => setHideForToday(e.target.checked)}
                    className="w-4 h-4 text-indigo-600 bg-gray-100 border-gray-300 rounded focus:ring-indigo-500 focus:ring-2 cursor-pointer"
                  />
                  <span className="text-sm text-gray-600 group-hover:text-gray-800 transition-colors">
                    오늘 하루 그만보기
                  </span>
                </label>
              )}
            </div>

            {/* 우측: 닫기 버튼 */}
            <button
              onClick={handleClose}
              className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg transition-colors text-sm font-medium"
            >
              닫기
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
```

---

## 📊 동작 흐름

### 시나리오 1: 첫 접속 (자동 팝업)
```
1. 사용자가 /admin/subsidy 페이지 접속
2. useEffect 실행 → shouldHideModal() 확인
3. localStorage에 데이터 없음 → false 반환
4. 신청가능 공고 있음 → modalOpenMode='auto' + 모달 오픈
5. 모달 하단에 "오늘 하루 그만보기" 체크박스 표시 ✅
6. 사용자가 체크박스 선택 후 닫기
7. setModalHideForToday() 실행 → localStorage 저장
   - 저장 데이터: { timestamp: 1738052400000, hideUntil: '2026-01-28' }
```

### 시나리오 2: 같은 날 재접속 (자동 팝업 억제)
```
1. 사용자가 다시 /admin/subsidy 페이지 접속
2. useEffect 실행 → shouldHideModal() 확인
3. localStorage에서 데이터 로드
   - hideUntil: '2026-01-28'
   - today: '2026-01-28'
   - hideUntil === today → true 반환
4. 자동 팝업 억제 (모달이 열리지 않음) ❌
5. 로그 출력: "[Subsidy] 오늘 하루 그만보기 설정됨 - 자동 팝업 억제"
```

### 시나리오 3: 같은 날 수동 버튼 클릭
```
1. 사용자가 "신청가능 공고" 버튼 클릭
2. handleManualOpenModal() 실행
3. modalOpenMode='manual' + 모달 오픈
4. 모달 하단에 체크박스 표시 안 됨 ❌
   - openMode === 'manual'이므로 조건부 렌더링에서 제외
5. 일반적인 모달로 동작 (닫기 버튼만 표시)
```

### 시나리오 4: 다음 날 접속 (자동 팝업 재개)
```
1. 다음 날(2026-01-29) 사용자가 /admin/subsidy 페이지 접속
2. useEffect 실행 → shouldHideModal() 확인
3. localStorage에서 데이터 로드
   - hideUntil: '2026-01-28'
   - today: '2026-01-29'
   - hideUntil !== today → false 반환
4. localStorage 자동 정리 (removeItem)
5. 신청가능 공고 있음 → modalOpenMode='auto' + 모달 오픈 ✅
6. 다시 "오늘 하루 그만보기" 체크박스 표시
```

---

## 🎨 UI 디자인

### Footer 레이아웃 (자동 모드)
```
┌──────────────────────────────────────────────────────────┐
│ Footer (bg-gray-50, border-t)                            │
├──────────────────────────────────────────────────────────┤
│ [✓] 오늘 하루 그만보기                        [닫기]    │
│  └─ 체크박스 (좌측)                            └─ 버튼   │
└──────────────────────────────────────────────────────────┘
```

### Footer 레이아웃 (수동 모드)
```
┌──────────────────────────────────────────────────────────┐
│ Footer (bg-gray-50, border-t)                            │
├──────────────────────────────────────────────────────────┤
│                                                   [닫기]  │
│  └─ 빈 공간                                      └─ 버튼  │
└──────────────────────────────────────────────────────────┘
```

### 체크박스 스타일
```tsx
<label className="flex items-center gap-2 cursor-pointer group">
  <input
    type="checkbox"
    checked={hideForToday}
    onChange={(e) => setHideForToday(e.target.checked)}
    className="w-4 h-4 text-indigo-600 bg-gray-100 border-gray-300 rounded focus:ring-indigo-500 focus:ring-2 cursor-pointer"
  />
  <span className="text-sm text-gray-600 group-hover:text-gray-800 transition-colors">
    오늘 하루 그만보기
  </span>
</label>
```

**디자인 특징**:
- **체크박스 크기**: 16px × 16px (w-4 h-4)
- **텍스트 크기**: 14px (text-sm)
- **색상**:
  - 체크박스: Indigo 600 (브랜드 컬러)
  - 텍스트: Gray 600 (기본), Gray 800 (호버)
- **인터랙션**:
  - 전체 라벨 영역 클릭 가능 (cursor-pointer)
  - 호버 시 텍스트 색상 변경 (transition-colors)

---

## 🔍 엣지 케이스 처리

### 1. localStorage 접근 불가
```typescript
export function shouldHideModal(): boolean {
  try {
    const stored = localStorage.getItem(MODAL_HIDE_STORAGE_KEY);
    // ... 로직
  } catch (error) {
    console.error('[Modal] 숨김 확인 오류:', error);
    return false; // 안전하게 팝업 표시
  }
}
```

**대응**:
- 에러 발생 시 `false` 반환 → 모달을 보수적으로 표시
- 사용자가 팝업을 못 보는 것보다는 보는 게 안전함

### 2. 잘못된 데이터 형식
```typescript
try {
  const data: ModalHideData = JSON.parse(stored);

  // 데이터 형식 검증
  if (!data.hideUntil || typeof data.hideUntil !== 'string') {
    console.warn('[Modal] 잘못된 데이터 형식, 초기화');
    localStorage.removeItem(MODAL_HIDE_STORAGE_KEY);
    return false;
  }

  // ... 이후 로직
} catch (error) {
  console.error('[Modal] JSON 파싱 오류:', error);
  localStorage.removeItem(MODAL_HIDE_STORAGE_KEY);
  return false;
}
```

### 3. 자정 전후 경계 케이스
```typescript
// 자정 직전에 체크한 경우
// 저장: 2026-01-28 23:59:50 → hideUntil: '2026-01-28'
// 확인: 2026-01-29 00:00:10 → today: '2026-01-29'
// 결과: hideUntil !== today → 팝업 표시 ✅

// 의도한 대로 동작 (날짜 비교 기반이므로 정확)
```

### 4. 시스템 날짜 변경
```typescript
// 사용자가 시스템 날짜를 과거로 변경하면?
// 저장: 2026-01-28 → hideUntil: '2026-01-28'
// 변경: 시스템 날짜를 2026-01-27로 변경
// 확인: today: '2026-01-27'
// 결과: hideUntil !== today → 팝업 표시 ✅

// 보수적 동작 (날짜가 다르면 팝업 표시)
```

### 5. 모달이 열려 있는 상태에서 자정 넘김
```typescript
// 1/28 23:50에 모달 오픈
// 1/29 00:05에 체크박스 선택 후 닫기
// 저장: hideUntil: '2026-01-29' (닫는 시점의 날짜)
// 결과: 1/29 하루 동안 팝업 억제 ✅

// 의도한 대로 동작 (닫는 시점 기준)
```

---

## ✅ 구현 체크리스트

### Phase 1: 유틸리티 함수 생성
- [ ] `utils/modalHideControl.ts` 파일 생성
- [ ] `setModalHideForToday()` 함수 구현
- [ ] `shouldHideModal()` 함수 구현
- [ ] `clearModalHide()` 함수 구현 (디버깅용)
- [ ] 에러 처리 및 로깅 추가

### Phase 2: 페이지 컴포넌트 수정
- [ ] `modalOpenMode` state 추가
- [ ] 자동 팝업 로직에 `shouldHideModal()` 체크 추가
- [ ] 수동 버튼 클릭 시 `modalOpenMode='manual'` 설정
- [ ] 모달에 `openMode` prop 전달

### Phase 3: 모달 컴포넌트 수정
- [ ] `openMode` prop 타입 추가
- [ ] `hideForToday` state 추가
- [ ] Footer에 조건부 체크박스 추가
- [ ] `handleClose` 함수에서 체크박스 상태 확인 및 저장

### Phase 4: 테스트
- [ ] 첫 접속 시 자동 팝업 확인
- [ ] "오늘 하루 그만보기" 체크 후 재접속 시 팝업 억제 확인
- [ ] 수동 버튼 클릭 시 체크박스 미표시 확인
- [ ] 다음 날 첫 접속 시 자동 팝업 재개 확인
- [ ] localStorage 데이터 형식 검증
- [ ] 에러 케이스 테스트 (localStorage 접근 불가 등)

---

## 🧪 테스트 시나리오

### 1. 기본 동작 테스트
```
1. /admin/subsidy 접속 → 자동 팝업 확인
2. 체크박스 표시 확인 (좌측 하단)
3. 체크박스 선택 후 닫기
4. 페이지 새로고침 → 팝업 안 뜸 확인
5. "신청가능 공고" 버튼 클릭 → 모달 오픈 확인
6. 체크박스 미표시 확인
```

### 2. LocalStorage 검증
```
1. Chrome DevTools 열기
2. Application → Local Storage 확인
3. 키: 'subsidy_modal_hide_until'
4. 값: {"timestamp":1738052400000,"hideUntil":"2026-01-28"}
5. 형식 검증
```

### 3. 날짜 변경 테스트
```
1. 오늘 하루 그만보기 설정
2. Chrome DevTools → Console
3. localStorage.setItem('subsidy_modal_hide_until', '{"timestamp":1738052400000,"hideUntil":"2026-01-27"}')
4. 페이지 새로고침
5. 팝업 표시 확인 (날짜가 지났으므로)
6. localStorage 자동 정리 확인
```

### 4. 에러 핸들링 테스트
```
1. Chrome DevTools → Console
2. localStorage.setItem('subsidy_modal_hide_until', 'invalid json')
3. 페이지 새로고침
4. 콘솔 에러 로그 확인
5. 팝업 정상 표시 확인 (안전한 fallback)
```

---

## 📝 구현 노트

### 왜 날짜 문자열 비교인가?
```typescript
// 날짜 문자열 비교 (YYYY-MM-DD)
hideUntil === today  // ✅ 간단하고 명확

// vs. 타임스탬프 비교
const hideUntilTimestamp = new Date(hideUntil).getTime();
const todayTimestamp = new Date().setHours(0, 0, 0, 0);
hideUntilTimestamp === todayTimestamp  // ❌ 복잡하고 시간대 이슈
```

**선택 이유**:
- 날짜만 비교하면 되므로 시간 정보 불필요
- `YYYY-MM-DD` 형식은 ISO 8601 표준 (명확한 파싱)
- 시간대 이슈 없음 (로컬 날짜 기준)

### 왜 자동/수동 모드 구분인가?
```typescript
// 모드 구분 없이 항상 체크박스 표시
{/* ❌ 버튼으로 열 때도 체크박스 표시됨 - 사용자 혼란 */}

// 모드 구분으로 조건부 표시
{openMode === 'auto' && (
  <checkbox /> // ✅ 자동 팝업일 때만 표시 - 명확한 의도
)}
```

**선택 이유**:
- 사용자가 직접 열었을 때는 "오늘 하루 그만보기"가 의미 없음
- 자동 팝업에만 적용되어야 사용자 의도와 일치
- UI 혼란 방지 (필요할 때만 체크박스 표시)

### 왜 체크박스인가? (vs. 버튼)
```typescript
// 체크박스 (선택)
<input type="checkbox" /> // ✅ 명확한 on/off 상태

// vs. 버튼 (선택)
<button>오늘 하루 그만보기</button> // ❌ 클릭했는지 안 했는지 불명확
```

**선택 이유**:
- 체크박스는 상태를 시각적으로 명확히 표현
- 사용자가 선택을 변경할 수 있음 (체크 → 해제)
- 표준 UI 패턴 (많은 웹사이트에서 사용)

---

## 🎯 예상 효과

### 사용자 경험 개선
1. **피로도 감소**: 반복적인 팝업으로 인한 사용자 피로 감소
2. **선택권 제공**: 사용자가 팝업 표시 여부를 직접 제어
3. **유연성 유지**: 필요할 때는 버튼으로 언제든 접근 가능

### 기술적 이점
1. **간단한 구현**: LocalStorage만으로 구현 가능 (백엔드 불필요)
2. **빠른 응답**: 로컬 데이터이므로 네트워크 지연 없음
3. **자동 정리**: 날짜가 지나면 자동으로 localStorage 정리

### 유지보수성
1. **명확한 분리**: 자동/수동 모드 구분으로 로직이 명확
2. **에러 안전성**: 에러 발생 시 보수적으로 팝업 표시 (기능 보존)
3. **확장 가능**: 향후 "일주일 그만보기" 등으로 확장 용이

---

**작성자**: Claude Sonnet 4.5
**버전**: 1.0
**최종 수정**: 2026-01-28
