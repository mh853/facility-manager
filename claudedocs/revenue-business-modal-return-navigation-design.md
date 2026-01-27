# Revenue ↔ Business 모달 양방향 네비게이션 설계

## 📋 문제 정의

### 현재 상황
```
Revenue 모달 → Business 수정 모달 (✅ 작동)
Business 수정 모달 (취소) → ❌ Revenue 모달로 돌아가지 않음
```

### 사용자 기대 동작
```
1. Revenue 모달에서 사업장명 클릭
2. Business 수정 모달 열림
3. "취소" 또는 "뒤로가기" 클릭
4. Revenue 모달로 복귀 ✨
```

---

## 🎯 설계 목표

### 핵심 요구사항
1. ✅ **Revenue → Business 네비게이션** (이미 구현됨)
2. ✅ **Business → Revenue 복귀** (신규 구현 필요)
3. ✅ **사용자 컨텍스트 유지** (어디서 왔는지 기억)
4. ✅ **브라우저 뒤로가기 지원** (표준 동작)

---

## 🏗️ 설계 방안 비교

### Option 1: URL 파라미터 + 복귀 경로 추적 (✅ 권장)

**장점**
- ✅ 브라우저 뒤로가기 지원
- ✅ URL 상태 유지 (북마크 가능)
- ✅ 새 탭 열기 지원
- ✅ 복귀 경로 명확

**단점**
- 중간 복잡도 구현

**구현 방법**
```typescript
// Revenue → Business
router.push('/admin/business?businessId=abc&openModal=true&returnTo=revenue')

// Business → Revenue
router.push('/admin/revenue?businessId=abc&openRevenueModal=true')
```

---

### Option 2: Browser History API 활용 (⚠️ 복잡)

**장점**
- 표준 브라우저 API 사용
- 상태 스택 관리

**단점**
- ❌ 복잡한 상태 관리
- ❌ 새 탭에서 문제 발생 가능
- ❌ 디버깅 어려움

---

### Option 3: 모달 상태 관리 (❌ 비권장)

**장점**
- 페이지 전환 없음

**단점**
- ❌ URL 상태 없음
- ❌ 브라우저 뒤로가기 불가
- ❌ 복잡한 전역 상태 관리

---

## 📐 최종 권장 설계: Option 1 (URL 파라미터 복귀 경로)

### 설계 개요

```
┌─────────────────────────────────────────────────────────────┐
│ 1. Revenue 모달                                             │
│    - 사업장명 클릭                                          │
│    - returnTo=revenue 파라미터 추가                         │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│ 2. Business 페이지                                          │
│    - URL: /admin/business?businessId=abc&openModal=true&returnTo=revenue
│    - 수정 모달 자동 열기                                    │
│    - returnTo 파라미터 감지 → "뒤로가기" 버튼 표시         │
└────────────────────┬────────────────────────────────────────┘
                     │ 취소 또는 뒤로가기 클릭
                     ▼
┌─────────────────────────────────────────────────────────────┐
│ 3. Revenue 페이지                                           │
│    - URL: /admin/revenue?businessId=abc&openRevenueModal=true
│    - 해당 사업장의 Revenue 모달 자동 열기                  │
└─────────────────────────────────────────────────────────────┘
```

---

## 🔧 구현 세부사항

### Phase 1: BusinessRevenueModal 수정 (returnTo 파라미터 추가)

**파일**: `components/business/BusinessRevenueModal.tsx`

**변경 전**
```typescript
const handleBusinessNameClick = () => {
  router.push(`/admin/business?businessId=${business.id}&openModal=true`);
};
```

**변경 후**
```typescript
const handleBusinessNameClick = () => {
  router.push(`/admin/business?businessId=${business.id}&openModal=true&returnTo=revenue`);
};
```

**변경사항**:
- `&returnTo=revenue` 파라미터 추가
- Business 페이지에서 복귀 경로 인식

---

### Phase 2: admin/business 페이지 수정

**파일**: `app/admin/business/page.tsx`

#### 2-1. returnTo 파라미터 감지 및 상태 관리

```typescript
// 컴포넌트 상단에 상태 추가
const [returnPath, setReturnPath] = useState<string | null>(null);

// URL 파라미터 감지 useEffect 수정
useEffect(() => {
  const businessId = searchParams?.get('businessId');
  const openModal = searchParams?.get('openModal');
  const returnTo = searchParams?.get('returnTo'); // ✅ 복귀 경로 감지

  if (!businessId || openModal !== 'true' || allBusinesses.length === 0) {
    return;
  }

  const targetBusiness = allBusinesses.find(b => b.id === businessId);

  if (targetBusiness) {
    console.log('🔗 [URL Navigation] 자동 모달 열기:', targetBusiness.사업장명);

    setSelectedBusiness(targetBusiness);
    setIsModalOpen(true);
    setEditingBusiness(targetBusiness);
    setFormData(targetBusiness);

    // ✅ 복귀 경로 저장
    if (returnTo) {
      setReturnPath(returnTo);
      console.log('🔙 [Return Path] 저장:', returnTo);
    }

    // URL 정리 (returnTo 파라미터는 유지하지 않음)
    window.history.replaceState({}, '', '/admin/business');
  } else {
    console.warn('⚠️ [URL Navigation] 사업장을 찾을 수 없음:', businessId);
    window.history.replaceState({}, '', '/admin/business');
  }
}, [searchParams, allBusinesses]);
```

#### 2-2. 복귀 핸들러 구현

```typescript
// 뒤로가기/취소 핸들러
const handleReturnToSource = () => {
  if (returnPath === 'revenue' && selectedBusiness) {
    console.log('🔙 [Return] Revenue 페이지로 복귀:', selectedBusiness.사업장명);

    // Revenue 페이지로 이동하면서 해당 사업장의 Revenue 모달 자동 열기
    router.push(`/admin/revenue?businessId=${selectedBusiness.id}&openRevenueModal=true`);
  } else {
    // 일반 모달 닫기
    setIsModalOpen(false);
    setEditingBusiness(null);
    setReturnPath(null);
  }
};
```

#### 2-3. BusinessDetailModal에 뒤로가기 버튼 전달

```typescript
<Suspense fallback={<div className="text-center py-4">로딩 중...</div>}>
  <BusinessDetailModal
    isOpen={isModalOpen}
    onClose={handleReturnToSource} // ✅ 복귀 핸들러 전달
    business={editingBusiness}
    onSave={handleSaveBusinessEdit}
    userPermission={userPermission}
    hasReturnPath={!!returnPath} // ✅ 복귀 경로 존재 여부 전달
    returnPath={returnPath} // ✅ 복귀 경로 전달
  />
</Suspense>
```

---

### Phase 3: BusinessDetailModal 수정

**파일**: `components/business/modals/BusinessDetailModal.tsx`

#### 3-1. Props 인터페이스 확장

```typescript
interface BusinessDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  business: UnifiedBusinessInfo | null;
  onSave: (data: any) => Promise<void>;
  userPermission: number;
  hasReturnPath?: boolean; // ✅ 복귀 경로 존재 여부
  returnPath?: string | null; // ✅ 복귀 경로
}
```

#### 3-2. 헤더에 뒤로가기 버튼 추가

```typescript
// 모달 헤더 부분
<div className="flex items-center justify-between p-6 border-b">
  <div className="flex items-center gap-3">
    {/* ✅ 뒤로가기 버튼 (returnPath가 있을 때만 표시) */}
    {hasReturnPath && returnPath === 'revenue' && (
      <button
        onClick={onClose}
        className="flex items-center gap-2 px-3 py-2 text-sm text-gray-600 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
        title="매출 관리로 돌아가기"
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
        <span>매출 관리로 돌아가기</span>
      </button>
    )}

    <h2 className="text-2xl font-bold text-gray-900">
      {business ? '사업장 정보 수정' : '새 사업장 등록'}
    </h2>
  </div>

  {/* 기존 닫기 버튼 */}
  <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
    <X className="w-6 h-6" />
  </button>
</div>
```

#### 3-3. 하단 버튼 그룹 수정

```typescript
// 모달 하단 버튼 부분
<div className="flex justify-between items-center p-6 border-t bg-gray-50">
  {/* 왼쪽: 뒤로가기 버튼 (returnPath가 있을 때만) */}
  <div>
    {hasReturnPath && returnPath === 'revenue' && (
      <button
        onClick={onClose}
        type="button"
        className="flex items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
        매출 관리로
      </button>
    )}
  </div>

  {/* 오른쪽: 저장/취소 버튼 */}
  <div className="flex gap-3">
    <button
      onClick={onClose}
      type="button"
      className="px-6 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
    >
      취소
    </button>
    <button
      onClick={handleSubmit}
      disabled={isSaving}
      className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
    >
      {isSaving ? '저장 중...' : '저장'}
    </button>
  </div>
</div>
```

---

### Phase 4: admin/revenue 페이지 수정

**파일**: `app/admin/revenue/page.tsx`

#### 4-1. URL 파라미터 감지 로직 추가

```typescript
// 컴포넌트 내부에 useEffect 추가
useEffect(() => {
  const businessId = searchParams?.get('businessId');
  const openRevenueModal = searchParams?.get('openRevenueModal');

  if (businessId && openRevenueModal === 'true' && calculations.length > 0) {
    console.log('🔙 [Return Navigation] Revenue 모달 자동 열기:', businessId);

    // 해당 business 찾기
    const targetCalculation = calculations.find(c => c.business_id === businessId);

    if (targetCalculation) {
      // Revenue 모달 열기
      setSelectedBusiness(targetCalculation);
      setShowRevenueModal(true);

      console.log('✅ [Return Navigation] Revenue 모달 열림:', targetCalculation.business_name);
    } else {
      console.warn('⚠️ [Return Navigation] 사업장을 찾을 수 없음:', businessId);
    }

    // URL 정리
    window.history.replaceState({}, '', '/admin/revenue');
  }
}, [searchParams, calculations]);
```

---

## 🔄 전체 데이터 흐름

### 정방향 (Revenue → Business)

```
1. /admin/revenue
   └─ BusinessRevenueModal 열림
      └─ 사업장명 클릭
         ↓
2. handleBusinessNameClick()
   └─ router.push('/admin/business?businessId=abc&openModal=true&returnTo=revenue')
      ↓
3. /admin/business 페이지 로드
   └─ useEffect: businessId, openModal, returnTo 감지
      └─ setReturnPath('revenue') ✅
      └─ BusinessDetailModal 자동 열기
         └─ 헤더에 "매출 관리로 돌아가기" 버튼 표시 ✅
```

### 역방향 (Business → Revenue)

```
1. BusinessDetailModal
   └─ "취소" 또는 "매출 관리로 돌아가기" 클릭
      ↓
2. handleReturnToSource()
   └─ returnPath === 'revenue' 확인 ✅
      └─ router.push('/admin/revenue?businessId=abc&openRevenueModal=true')
         ↓
3. /admin/revenue 페이지 로드
   └─ useEffect: businessId, openRevenueModal 감지
      └─ calculations에서 businessId로 검색
         └─ BusinessRevenueModal 자동 열기 ✅
```

---

## 🎨 UI/UX 개선

### 1. 뒤로가기 버튼 디자인

**위치**: 모달 헤더 왼쪽

```
┌──────────────────────────────────────────────────┐
│ [← 매출 관리로 돌아가기]  사업장 정보 수정    [X] │
│──────────────────────────────────────────────────│
│                                                  │
│  (사업장 정보 폼)                                │
│                                                  │
└──────────────────────────────────────────────────┘
```

**스타일**:
```css
/* 부드러운 파란색 강조 */
hover:text-blue-600
hover:bg-blue-50
transition-colors

/* 아이콘 + 텍스트 */
<svg> + "매출 관리로 돌아가기"
```

### 2. 하단 버튼 레이아웃

```
┌──────────────────────────────────────────────────┐
│                                                  │
│  (사업장 정보 폼)                                │
│                                                  │
│──────────────────────────────────────────────────│
│ [← 매출 관리로]              [취소]  [저장]      │
└──────────────────────────────────────────────────┘
```

**정렬**:
- 왼쪽: 뒤로가기 버튼 (returnPath 있을 때만)
- 오른쪽: 취소/저장 버튼 (항상 표시)

### 3. 시각적 피드백

**뒤로가기 버튼**:
```css
/* 기본 */
text-gray-700
border: none

/* 호버 */
text-blue-600
bg-blue-50

/* 포커스 */
ring-2 ring-blue-500
```

**일관성**:
- Revenue 모달의 사업장명 버튼과 동일한 파란색 사용
- 양방향 네비게이션의 시각적 연결성

---

## 🧪 테스트 시나리오

### Test 1: 정방향 → 역방향 (전체 흐름)
```
1. /admin/revenue 접속
2. 사업장 클릭 → Revenue 모달 열림
3. 사업장명 클릭 → Business 페이지로 이동
4. Business 수정 모달 열림 확인
5. 헤더에 "매출 관리로 돌아가기" 버튼 확인 ✅
6. "매출 관리로 돌아가기" 클릭
7. /admin/revenue 페이지로 복귀 확인
8. 동일 사업장의 Revenue 모달 자동 열림 확인 ✅
```

**예상 결과**:
- ✅ 부드러운 네비게이션
- ✅ 모달 상태 유지
- ✅ 사용자 컨텍스트 유지

---

### Test 2: 취소 버튼으로 복귀
```
1. Revenue → Business 네비게이션
2. Business 수정 모달에서 하단 "취소" 버튼 클릭
3. Revenue 페이지로 복귀 확인
4. Revenue 모달 자동 열림 확인
```

**예상 결과**:
- ✅ "취소"와 "뒤로가기" 동작 동일
- ✅ Revenue 모달 복원

---

### Test 3: 브라우저 뒤로가기
```
1. Revenue → Business 네비게이션
2. 브라우저 뒤로가기 버튼 클릭
3. Revenue 페이지로 복귀 확인
```

**예상 결과**:
- ✅ 표준 브라우저 동작 지원
- ✅ Revenue 모달 닫힘 (자동 열림 없음)

---

### Test 4: 직접 URL 접근 (returnTo 없음)
```
1. 브라우저 주소창에 직접 입력:
   /admin/business?businessId=abc&openModal=true
   (returnTo 파라미터 없음)
2. Business 수정 모달 열림 확인
3. "매출 관리로 돌아가기" 버튼 표시 안됨 확인 ✅
4. "취소" 클릭 → 일반 모달 닫기 동작
```

**예상 결과**:
- ✅ returnTo 없으면 뒤로가기 버튼 숨김
- ✅ 일반 취소 동작

---

### Test 5: 저장 후 동작
```
1. Revenue → Business 네비게이션
2. 사업장 정보 수정
3. "저장" 클릭
4. 저장 성공 후 동작 확인
```

**옵션 A**: Revenue로 자동 복귀
**옵션 B**: Business 페이지 유지

**권장**: 옵션 B (현재 페이지 유지)
- 저장 후 추가 수정 가능
- 명시적인 뒤로가기 필요

---

### Test 6: 새 탭에서 열기
```
1. Revenue 모달에서 사업장명 Cmd+Click
2. 새 탭에서 Business 페이지 열림
3. "매출 관리로 돌아가기" 클릭
4. 새 탭에서 Revenue 페이지 로드 확인
```

**예상 결과**:
- ✅ 독립적으로 동작
- ✅ 원본 탭 영향 없음

---

## 📊 구현 우선순위

### Phase 1: 핵심 기능 (필수) ✅
1. BusinessRevenueModal: returnTo 파라미터 추가
2. admin/business: returnPath 상태 관리
3. admin/business: handleReturnToSource 구현
4. admin/revenue: URL 파라미터 감지 로직

### Phase 2: UI 개선 (필수) ✅
1. BusinessDetailModal: Props 확장
2. BusinessDetailModal: 헤더 뒤로가기 버튼
3. BusinessDetailModal: 하단 버튼 레이아웃

### Phase 3: 테스트 및 검증 (필수) ✅
1. 정방향 네비게이션 테스트
2. 역방향 복귀 테스트
3. 브라우저 뒤로가기 테스트
4. 엣지 케이스 테스트

---

## 🔒 보안 및 안정성

### 1. businessId 검증
```typescript
// Revenue 페이지
const targetCalculation = calculations.find(c => c.business_id === businessId);

if (!targetCalculation) {
  console.warn('⚠️ 사업장을 찾을 수 없음');
  return; // 모달 열지 않음
}
```

### 2. returnPath 검증
```typescript
// 허용된 경로만 복귀
if (returnPath === 'revenue') {
  // Revenue로 복귀
} else {
  // 일반 닫기
}
```

### 3. 무한 루프 방지
```typescript
// URL 정리로 재실행 방지
window.history.replaceState({}, '', '/admin/revenue');
```

---

## 💡 향후 개선 사항

### 단기 (Optional)
- [ ] 복귀 애니메이션 추가
- [ ] 모달 전환 효과 개선
- [ ] 로딩 인디케이터 추가

### 중기 (Future)
- [ ] 다단계 네비게이션 지원 (Revenue → Business → Detail)
- [ ] 네비게이션 히스토리 스택 관리
- [ ] 뒤로가기 깊이 추적

### 장기 (Nice to Have)
- [ ] 모달 라우팅 시스템 구축
- [ ] 전역 네비게이션 상태 관리
- [ ] 딥 링크 확장

---

## 📝 체크리스트

### 구현 전
- [ ] 현재 네비게이션 동작 확인
- [ ] Revenue 페이지 구조 파악
- [ ] BusinessDetailModal Props 확인

### 구현 중
- [ ] BusinessRevenueModal 수정
- [ ] admin/business 페이지 수정
- [ ] BusinessDetailModal 수정
- [ ] admin/revenue 페이지 수정

### 구현 후
- [ ] 정방향 테스트
- [ ] 역방향 테스트
- [ ] 브라우저 뒤로가기 테스트
- [ ] 엣지 케이스 테스트

---

## 🎉 결론

**권장 방안**: URL 파라미터 기반 양방향 네비게이션

**핵심 개선사항**:
- ✅ `returnTo=revenue` 파라미터로 복귀 경로 추적
- ✅ Business 모달에 "매출 관리로 돌아가기" 버튼 추가
- ✅ Revenue 페이지에서 자동 모달 열기 지원
- ✅ 브라우저 표준 동작 유지

**사용자 경험**:
- 직관적인 네비게이션
- 명확한 복귀 경로
- 컨텍스트 유지
- 자연스러운 흐름

**Next Step**: 구현 진행

---

**문서 버전**: 1.0
**작성일**: 2025-01-27
**상태**: ✅ 설계 완료 → 구현 준비
