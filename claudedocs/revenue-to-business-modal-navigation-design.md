# Revenue 상세 모달에서 Business 수정 모달로 네비게이션 설계

## 📋 요구사항

**목표**: `admin/revenue` 페이지의 상세 모달에서 헤더의 사업장명을 클릭하면 `admin/business` 페이지의 수정 모달로 바로 이동

### 사용자 시나리오
```
1. 사용자가 /admin/revenue 페이지에서 사업장 클릭
2. BusinessRevenueModal 열림 (기기 상세 정보)
3. 헤더에 표시된 "사업장명" 클릭
4. /admin/business 페이지로 이동 + BusinessDetailModal 자동 열림
```

---

## 🏗️ 현재 구조 분석

### 1. Revenue 페이지 구조
```typescript
// app/admin/revenue/page.tsx
<BusinessRevenueModal
  business={selectedBusiness}
  isOpen={isRevenueModalOpen}
  onClose={() => setIsRevenueModalOpen(false)}
  userPermission={user?.permission_level || 0}
/>
```

### 2. BusinessRevenueModal 헤더
```typescript
// components/business/BusinessRevenueModal.tsx:341-344
<h3 className="text-xl font-bold text-gray-900">
  {business.business_name || business.사업장명} - 기기 상세 정보
</h3>
```

### 3. Business 페이지 구조
```typescript
// app/admin/business/page.tsx
const BusinessDetailModal = lazy(() => import('@/components/business/modals/BusinessDetailModal'))

// 수정 모달 열기 로직
const handleEditBusiness = (business: UnifiedBusinessInfo) => {
  setSelectedBusiness(business);
  setIsEditModalOpen(true);
}
```

---

## 🎯 설계 방안

### Option 1: URL 파라미터 + 자동 모달 열기 (✅ 권장)

**장점**
- ✅ 브라우저 뒤로가기 지원
- ✅ URL 공유 가능 (북마크, 링크 전달)
- ✅ 새탭 열기 지원 (Cmd+Click)
- ✅ 페이지 리프레시 시에도 모달 상태 유지

**단점**
- 중간 복잡도 구현 (URL 파싱 필요)

**구현 흐름**
```
BusinessRevenueModal (헤더 클릭)
  ↓
router.push('/admin/business?businessId=xxx&openModal=true')
  ↓
admin/business 페이지 로드
  ↓
useSearchParams로 businessId, openModal 파라미터 감지
  ↓
해당 business 조회 → BusinessDetailModal 자동 열기
```

---

### Option 2: 직접 네비게이션 (❌ 비권장)

**장점**
- 간단한 구현

**단점**
- ❌ URL 상태 없음 (뒤로가기 불가)
- ❌ 새탭 열기 불가
- ❌ 북마크/공유 불가

---

## 📐 최종 권장 설계: Option 1 (URL 파라미터)

### Phase 1: BusinessRevenueModal 헤더 수정

**파일**: `components/business/BusinessRevenueModal.tsx`

**변경 전 (Line 341-344)**
```typescript
<h3 className="text-xl font-bold text-gray-900">
  {business.business_name || business.사업장명} - 기기 상세 정보
</h3>
```

**변경 후**
```typescript
import { useRouter } from 'next/navigation';

// 컴포넌트 내부
const router = useRouter();

const handleBusinessNameClick = () => {
  router.push(`/admin/business?businessId=${business.id}&openModal=true`);
};

// JSX
<h3 className="text-xl font-bold text-gray-900 flex items-center gap-2">
  <button
    onClick={handleBusinessNameClick}
    className="hover:text-blue-600 hover:underline transition-colors cursor-pointer text-left"
    title="사업장 상세 정보로 이동"
  >
    {business.business_name || business.사업장명}
  </button>
  <span className="text-gray-500">- 기기 상세 정보</span>
</h3>
```

**UX 개선**
- ✅ Hover 시 파란색 + 밑줄 (클릭 가능함을 명시)
- ✅ Tooltip 표시 ("사업장 상세 정보로 이동")
- ✅ 커서 포인터 표시

---

### Phase 2: admin/business 페이지 URL 파라미터 감지

**파일**: `app/admin/business/page.tsx`

**추가 로직 (useEffect)**
```typescript
import { useSearchParams } from 'next/navigation';

// 컴포넌트 내부
const searchParams = useSearchParams();

// URL 파라미터로 자동 모달 열기
useEffect(() => {
  const businessId = searchParams.get('businessId');
  const openModal = searchParams.get('openModal');

  if (businessId && openModal === 'true' && allBusinesses.length > 0) {
    // 해당 business 찾기
    const targetBusiness = allBusinesses.find(b => b.id === businessId);

    if (targetBusiness) {
      console.log('🔗 [URL Navigation] 자동 모달 열기:', targetBusiness.사업장명);
      setSelectedBusiness(targetBusiness);
      setIsEditModalOpen(true);

      // URL에서 파라미터 제거 (깔끔한 URL 유지)
      window.history.replaceState({}, '', '/admin/business');
    } else {
      console.warn('⚠️ [URL Navigation] 사업장을 찾을 수 없음:', businessId);
    }
  }
}, [searchParams, allBusinesses]);
```

**동작 흐름**
```
1. URL에 ?businessId=xxx&openModal=true 감지
2. allBusinesses에서 해당 ID 검색
3. 찾으면: 모달 자동 열기
4. URL 파라미터 제거 (history.replaceState)
5. 사용자는 깔끔한 /admin/business URL만 보게 됨
```

---

## 🔄 데이터 흐름도

```
┌─────────────────────────────────────────────────────────────┐
│ 1. /admin/revenue (Revenue Dashboard)                      │
│    - BusinessRevenueModal 열림                             │
│    - 헤더: "테스트사업장 - 기기 상세 정보"                │
└────────────────────┬────────────────────────────────────────┘
                     │ 사용자가 "테스트사업장" 클릭
                     ▼
┌─────────────────────────────────────────────────────────────┐
│ 2. handleBusinessNameClick()                                │
│    router.push('/admin/business?businessId=abc&openModal=true') │
└────────────────────┬────────────────────────────────────────┘
                     │ 페이지 이동
                     ▼
┌─────────────────────────────────────────────────────────────┐
│ 3. /admin/business?businessId=abc&openModal=true            │
│    - useSearchParams로 파라미터 감지                        │
│    - allBusinesses에서 businessId='abc' 검색               │
└────────────────────┬────────────────────────────────────────┘
                     │ 사업장 찾음
                     ▼
┌─────────────────────────────────────────────────────────────┐
│ 4. 자동 모달 열기                                           │
│    setSelectedBusiness(targetBusiness)                      │
│    setIsEditModalOpen(true)                                 │
│    window.history.replaceState({}, '', '/admin/business')  │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│ 5. BusinessDetailModal 표시                                 │
│    - 사업장 정보 수정 가능                                  │
│    - URL: /admin/business (파라미터 제거됨)                 │
└─────────────────────────────────────────────────────────────┘
```

---

## 🧪 테스트 시나리오

### Test Case 1: 정상 네비게이션
```typescript
// Given
사용자가 /admin/revenue에서 특정 사업장의 BusinessRevenueModal 열기

// When
헤더의 사업장명 클릭

// Then
1. /admin/business 페이지로 이동 ✅
2. BusinessDetailModal 자동 열림 ✅
3. 해당 사업장 정보 표시 ✅
4. URL이 깔끔하게 /admin/business로 정리됨 ✅
```

### Test Case 2: 새 탭 열기 (Cmd+Click)
```typescript
// Given
사용자가 BusinessRevenueModal 헤더의 사업장명에 Cmd+Click

// When
새 탭 열림

// Then
1. 새 탭에서 /admin/business?businessId=xxx&openModal=true 로드 ✅
2. 자동으로 BusinessDetailModal 열림 ✅
3. 원본 탭의 revenue 페이지는 그대로 유지 ✅
```

### Test Case 3: 뒤로가기
```typescript
// Given
revenue → business 네비게이션 완료

// When
브라우저 뒤로가기 버튼 클릭

// Then
1. /admin/revenue 페이지로 복귀 ✅
2. 이전 상태 복원 (Revenue 대시보드) ✅
```

### Test Case 4: 존재하지 않는 사업장 ID
```typescript
// Given
URL: /admin/business?businessId=nonexistent&openModal=true

// When
페이지 로드

// Then
1. 콘솔에 경고 메시지 출력 ✅
2. 모달 열리지 않음 ✅
3. Business 목록 정상 표시 ✅
```

### Test Case 5: 북마크/URL 공유
```typescript
// Given
사용자가 /admin/business?businessId=abc&openModal=true URL 북마크

// When
나중에 북마크로 접속

// Then
1. 페이지 로드 후 자동으로 해당 사업장 모달 열림 ✅
2. 다른 사용자와 URL 공유 가능 ✅
```

---

## 📊 구현 세부사항

### 1. BusinessRevenueModal.tsx 변경사항

**Import 추가**
```typescript
import { useRouter } from 'next/navigation';
```

**Router 인스턴스 생성**
```typescript
export default function BusinessRevenueModal({ business, isOpen, onClose, userPermission }: BusinessRevenueModalProps) {
  const router = useRouter();
  // ... 기존 코드
```

**네비게이션 핸들러**
```typescript
const handleBusinessNameClick = () => {
  if (!business?.id) {
    console.error('❌ [Navigation] Business ID가 없습니다.');
    return;
  }

  console.log('🔗 [Navigation] Business 페이지로 이동:', business.business_name || business.사업장명);
  router.push(`/admin/business?businessId=${business.id}&openModal=true`);
};
```

**헤더 JSX 수정 (Line 340-345)**
```typescript
<div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex justify-between items-center">
  <div className="flex items-center gap-3">
    <h3 className="text-xl font-bold text-gray-900 flex items-center gap-2">
      <button
        onClick={handleBusinessNameClick}
        className="hover:text-blue-600 hover:underline transition-colors cursor-pointer text-left focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 rounded px-1"
        title="사업장 상세 정보로 이동 (수정 가능)"
      >
        {business.business_name || business.사업장명}
      </button>
      <span className="text-gray-500">- 기기 상세 정보</span>
    </h3>
    {isRefreshing && (
      <div className="flex items-center gap-2 text-sm text-blue-600">
        {/* 기존 로딩 스피너 */}
      </div>
    )}
  </div>
  {/* 기존 닫기 버튼 */}
</div>
```

**접근성 개선**
- `focus:ring`: 키보드 네비게이션 지원
- `title`: Tooltip으로 기능 설명
- `text-left`: 텍스트 좌측 정렬
- `px-1`: 약간의 패딩으로 포커스 링 공간 확보

---

### 2. admin/business/page.tsx 변경사항

**useEffect 추가 (기존 useEffect 블록 근처)**
```typescript
// 📍 위치: useBusinessData 훅 호출 후, 다른 useEffect들과 함께 배치

// URL 파라미터로 자동 모달 열기 (from Revenue page)
useEffect(() => {
  const businessId = searchParams.get('businessId');
  const openModal = searchParams.get('openModal');

  // 조건 체크
  if (!businessId || openModal !== 'true' || allBusinesses.length === 0) {
    return;
  }

  // 해당 business 찾기
  const targetBusiness = allBusinesses.find(b => b.id === businessId);

  if (targetBusiness) {
    console.log('🔗 [URL Navigation] 자동 모달 열기:', targetBusiness.사업장명 || targetBusiness.business_name);

    // 모달 열기
    setSelectedBusiness(targetBusiness);
    setIsEditModalOpen(true);

    // URL 정리 (파라미터 제거)
    window.history.replaceState({}, '', '/admin/business');
  } else {
    console.warn('⚠️ [URL Navigation] 사업장을 찾을 수 없음:', businessId);
    // 파라미터만 제거
    window.history.replaceState({}, '', '/admin/business');
  }
}, [searchParams, allBusinesses, setIsEditModalOpen]);
```

**의존성 배열 설명**
- `searchParams`: URL 파라미터 변경 감지
- `allBusinesses`: 사업장 데이터 로딩 완료 시 실행
- `setIsEditModalOpen`: 모달 열기 함수 (안정적인 참조)

**타이밍 고려**
```typescript
// ❌ 문제: allBusinesses가 빈 배열이면 사업장을 찾을 수 없음
if (allBusinesses.length === 0) return; // Early return

// ✅ 해결: allBusinesses 로딩 완료 후 실행되도록 의존성 배열에 포함
```

---

## 🎨 UI/UX 개선사항

### 1. 호버 효과
```css
/* Tailwind Classes */
hover:text-blue-600      /* 파란색 텍스트 */
hover:underline          /* 밑줄 표시 */
transition-colors        /* 부드러운 색상 전환 */
cursor-pointer           /* 포인터 커서 */
```

**시각적 피드백**
- 기본 상태: 검은색 텍스트 (font-bold)
- 호버 상태: 파란색 + 밑줄
- 전환: 0.15초 부드러운 애니메이션

### 2. 접근성 (Accessibility)
```css
/* 키보드 포커스 */
focus:outline-none               /* 기본 아웃라인 제거 */
focus:ring-2                     /* 2px 링 */
focus:ring-blue-500              /* 파란색 링 */
focus:ring-offset-2              /* 2px 오프셋 */
rounded px-1                     /* 둥근 모서리 + 패딩 */
```

**키보드 네비게이션**
- Tab 키로 포커스 이동
- Enter/Space 키로 클릭
- 시각적 포커스 표시 (파란색 링)

### 3. Tooltip
```html
title="사업장 상세 정보로 이동 (수정 가능)"
```

**정보 제공**
- 호버 시 기능 설명 표시
- 사용자 행동 유도

### 4. 로딩 상태 유지
```typescript
{isRefreshing && (
  <div className="flex items-center gap-2 text-sm text-blue-600">
    <svg className="animate-spin h-4 w-4" ...>
    <span>계산 중...</span>
  </div>
)}
```

**사용자 피드백**
- 매출 계산 중에도 네비게이션 가능
- 로딩 스피너 유지로 상태 인지

---

## 🚀 배포 전략

### Phase 1: BusinessRevenueModal 수정
1. ✅ `useRouter` import 추가
2. ✅ `handleBusinessNameClick` 핸들러 구현
3. ✅ 헤더 JSX 수정 (button 래퍼)
4. ✅ 로컬 테스트

### Phase 2: admin/business 페이지 수정
1. ✅ URL 파라미터 감지 useEffect 추가
2. ✅ 자동 모달 열기 로직 구현
3. ✅ URL 정리 로직 (history.replaceState)
4. ✅ 로컬 테스트

### Phase 3: 통합 테스트
1. ✅ Revenue → Business 네비게이션 테스트
2. ✅ 모달 자동 열림 확인
3. ✅ 뒤로가기 동작 확인
4. ✅ 새 탭 열기 (Cmd+Click) 테스트
5. ✅ 존재하지 않는 ID 처리 확인

### Phase 4: 프로덕션 배포
1. Git commit with clear message
2. PR 생성 및 리뷰
3. Staging 환경 테스트
4. Production 배포

---

## 📝 체크리스트

### 구현 전
- [ ] 현재 Revenue 모달 동작 확인
- [ ] Business 페이지 모달 동작 확인
- [ ] 사용자 권한 확인 (권한에 따른 제한 없음?)

### 구현 중
- [ ] BusinessRevenueModal.tsx 수정
- [ ] admin/business/page.tsx 수정
- [ ] TypeScript 타입 에러 없음
- [ ] ESLint 경고 없음

### 구현 후
- [ ] 로컬 테스트 (기본 네비게이션)
- [ ] 새 탭 열기 테스트
- [ ] 뒤로가기 테스트
- [ ] 잘못된 ID 처리 테스트
- [ ] 모바일 반응형 확인

---

## 🔒 보안 고려사항

### 1. Business ID 검증
```typescript
// URL 파라미터로 전달된 ID가 실제로 존재하는지 확인
const targetBusiness = allBusinesses.find(b => b.id === businessId);

if (!targetBusiness) {
  console.warn('⚠️ [URL Navigation] 사업장을 찾을 수 없음:', businessId);
  return; // 모달 열지 않음
}
```

**방어**
- ✅ 존재하지 않는 ID 접근 방지
- ✅ 조작된 URL 파라미터 차단
- ✅ 권한 없는 사업장 접근 불가 (allBusinesses는 권한 필터링된 데이터)

### 2. XSS 방지
```typescript
// businessId는 URL 파라미터로 직접 JSX에 렌더링되지 않음
// find() 메서드로만 사용되므로 XSS 위험 없음
```

### 3. 권한 체크
```typescript
// admin/business 페이지는 이미 ProtectedPage로 감싸져 있음
// 권한 없는 사용자는 페이지 자체 접근 불가
```

---

## 💡 향후 개선 사항

### 단기 (Optional)
- [ ] 네비게이션 애니메이션 추가
- [ ] 모달 전환 시 부드러운 효과
- [ ] 외부 링크 아이콘 추가 (명시적 네비게이션 표시)

### 중기 (Future Enhancement)
- [ ] 모달 간 직접 전환 (페이지 이동 없이)
- [ ] 네비게이션 히스토리 스택 관리
- [ ] 딥 링크 지원 확대 (다른 모달들도)

### 장기 (Nice to Have)
- [ ] 모달 라우팅 시스템 구축 (전역 상태 관리)
- [ ] URL 기반 모달 관리 라이브러리 도입
- [ ] 모달 전환 애니메이션 최적화

---

## 📚 참고 코드 위치

### 수정 대상 파일
1. **BusinessRevenueModal.tsx**
   - 경로: `components/business/BusinessRevenueModal.tsx`
   - 수정 위치: Line 340-345 (헤더 부분)

2. **admin/business/page.tsx**
   - 경로: `app/admin/business/page.tsx`
   - 추가 위치: useEffect 블록 (Line ~300 예상)

### 관련 파일
- `app/admin/revenue/page.tsx` (Revenue 대시보드)
- `components/business/modals/BusinessDetailModal.tsx` (수정 모달)
- `app/admin/business/hooks/useBusinessData.ts` (사업장 데이터 훅)

---

## 🎉 결론

**권장 방안**: URL 파라미터 기반 자동 모달 열기
- ✅ 브라우저 표준 네비게이션 활용
- ✅ 사용자 경험 우수 (뒤로가기, 새 탭, 북마크)
- ✅ 구현 난이도 적절
- ✅ 유지보수 용이

**예상 작업 시간**: 30-45분
- Phase 1 (Modal): 15분
- Phase 2 (Page): 15분
- Testing: 15분

**Next Step**:
1. BusinessRevenueModal.tsx 헤더 수정
2. admin/business/page.tsx URL 파라미터 감지 로직 추가
3. 테스트 및 검증

---

**문서 버전**: 1.0
**작성일**: 2025-01-27
**상태**: ✅ 설계 완료 → 구현 준비
