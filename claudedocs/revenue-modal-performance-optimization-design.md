# Revenue 모달 복귀 성능 최적화 설계

## 📋 문제 정의

### 현재 상황
```
Business 수정 모달 (돌아가기 클릭)
    ↓
Revenue 페이지 전환 (businesses 배열 재로딩 필요)
    ↓
useEffect 트리거 (businesses.length 변경 감지)
    ↓
targetBusiness 검색
    ↓
Revenue 모달 열기
    ↓
BusinessRevenueModal useEffect 트리거
    ↓
/api/revenue/calculate POST 요청 (매출 계산)
    ↓
⏳ 느린 로딩 (2-5초 소요)
```

### 성능 병목 지점

**1. 페이지 전환 시 데이터 재로딩**
- `/admin/revenue` 페이지로 이동 시 `businesses` 배열이 비어있음
- `businesses.length === 0` 조건으로 인해 useEffect가 실행 안됨
- 페이지의 초기 데이터 로딩 완료를 기다려야 함

**2. Revenue 계산 API 호출**
- BusinessRevenueModal이 열릴 때마다 `/api/revenue/calculate` POST 요청
- 매번 전체 매출 계산 수행 (무거운 연산)
- 캐싱 없이 매번 새로 계산

**3. 불필요한 페이지 전환**
- Business → Revenue 전체 페이지 이동
- Revenue 페이지 마운트 → 언마운트 → 재마운트
- 모든 상태 초기화 및 재로딩

---

## 🎯 최적화 목표

### 핵심 목표
1. ✅ **즉시 모달 표시**: 2-5초 → 0.5초 이하
2. ✅ **데이터 재사용**: 이미 로드된 데이터 활용
3. ✅ **불필요한 계산 제거**: 캐싱으로 중복 계산 방지
4. ✅ **부드러운 UX**: 로딩 인디케이터로 사용자 경험 개선

---

## 🏗️ 최적화 전략

### Strategy 1: 상태 유지 방식 (✅ 권장)

**개념**: 페이지 이동 없이 모달 상태만 전환

```
Business 모달 (돌아가기 클릭)
    ↓
router.push('/admin/revenue?...')
    ↓ (페이지 전환)
Revenue 페이지 재마운트
    ↓
데이터 재로딩 필요
    ↓
⏳ 느림
```

↓ **개선**

```
Business 모달 (돌아가기 클릭)
    ↓
setShowBusinessModal(false)
setShowRevenueModal(true)
    ↓ (상태만 변경)
Revenue 모달 즉시 표시
    ↓
✅ 빠름 (기존 데이터 재사용)
```

**장점**
- ✅ 페이지 전환 없음 (가장 빠름)
- ✅ 기존 데이터 유지
- ✅ 계산 결과 캐싱 활용
- ✅ 매우 부드러운 전환

**단점**
- ❌ URL 상태 유지 불가 (브라우저 뒤로가기 미지원)
- ❌ 북마크 불가
- ❌ 새 탭 열기 불가
- ⚠️ 복잡한 전역 상태 관리 필요

---

### Strategy 2: 계산 결과 캐싱 (✅ 권장)

**개념**: Revenue 계산 결과를 캐싱하여 재사용

**구현 방법**:

```typescript
// 1. SessionStorage에 계산 결과 캐싱
const cacheKey = `revenue_calc_${businessId}`;
const cachedData = sessionStorage.getItem(cacheKey);

if (cachedData) {
  const { data, timestamp } = JSON.parse(cachedData);
  const age = Date.now() - timestamp;

  // 5분 이내 캐시는 재사용
  if (age < 5 * 60 * 1000) {
    setCalculatedData(data);
    return;
  }
}

// 2. 새로 계산한 결과 저장
sessionStorage.setItem(cacheKey, JSON.stringify({
  data: calculatedData,
  timestamp: Date.now()
}));
```

**장점**
- ✅ URL 기반 네비게이션 유지 (브라우저 뒤로가기, 북마크 지원)
- ✅ 캐싱으로 반복 계산 방지
- ✅ 구현 난이도 낮음
- ✅ 기존 아키텍처 유지

**단점**
- ⚠️ 여전히 페이지 전환 발생 (Strategy 1보다 느림)
- ⚠️ 캐시 무효화 전략 필요

**성능 개선**:
- 초기 로딩: 2-5초 (변화 없음)
- 복귀 시 로딩: 0.5-1초 (80-90% 개선)

---

### Strategy 3: 데이터 Pre-fetch (추가 최적화)

**개념**: Business 모달에서 돌아가기 전 Revenue 데이터 미리 준비

```typescript
// Business 모달에서 돌아가기 클릭 시
const handleReturnToSource = useCallback(async () => {
  if (returnPath === 'revenue' && selectedBusiness) {
    // 1. Revenue 계산 시작 (백그라운드)
    const calcPromise = fetch('/api/revenue/calculate', {
      method: 'POST',
      body: JSON.stringify({ business_id: selectedBusiness.id })
    });

    // 2. 페이지 이동
    router.push(`/admin/revenue?businessId=${selectedBusiness.id}&openRevenueModal=true`);

    // 3. 계산 결과 캐싱 (백그라운드 완료 시)
    calcPromise.then(res => res.json()).then(data => {
      sessionStorage.setItem(`revenue_calc_${selectedBusiness.id}`, JSON.stringify({
        data: data.data.calculation,
        timestamp: Date.now()
      }));
    });
  }
}, [returnPath, selectedBusiness, router]);
```

**장점**
- ✅ 페이지 로드와 계산을 병렬 처리
- ✅ 사용자가 느끼는 로딩 시간 단축
- ✅ Strategy 2와 결합 가능

**단점**
- ⚠️ 복잡도 증가
- ⚠️ 네트워크 대역폭 소비

**성능 개선**:
- 복귀 시 로딩: 0.3-0.5초 (90-95% 개선)

---

### Strategy 4: 로딩 인디케이터 개선 (UX 최적화)

**개념**: 느린 것을 빠르게 보이도록

```typescript
// 1. 즉시 모달 표시 (스켈레톤 UI)
if (targetBusiness) {
  setSelectedEquipmentBusiness(targetBusiness);
  setShowEquipmentModal(true); // 즉시 표시
  // 데이터는 모달 내부 useEffect에서 로딩
}

// 2. BusinessRevenueModal 내부
export default function BusinessRevenueModal({ ... }) {
  const [calculatedData, setCalculatedData] = useState<CalculatedData | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(true); // 초기값 true

  // Skeleton UI 표시
  if (isRefreshing && !calculatedData) {
    return (
      <Modal>
        <SkeletonLoader />
      </Modal>
    );
  }

  // 실제 데이터 표시
  return <Modal>...</Modal>;
}
```

**장점**
- ✅ 즉시 피드백 제공
- ✅ 사용자 체감 성능 향상
- ✅ 기존 로직 유지

**단점**
- ⚠️ 실제 성능은 개선 안됨 (UX만 개선)

---

## 📐 최종 권장 설계: Hybrid Approach

### 종합 전략

**Phase 1: 즉시 적용 가능 (Low-hanging Fruit)**
1. ✅ **Strategy 2**: 계산 결과 캐싱 (SessionStorage)
2. ✅ **Strategy 4**: 스켈레톤 UI 로딩 인디케이터

**Phase 2: 추가 최적화 (Optional)**
3. ✅ **Strategy 3**: Pre-fetch로 병렬 처리

**Phase 3: 장기 개선 (Future)**
4. ⚠️ **Strategy 1**: 상태 기반 모달 전환 (아키텍처 재설계 필요)

---

## 🔧 구현 상세 (Phase 1)

### 1. BusinessRevenueModal - 캐싱 추가

**파일**: `components/business/BusinessRevenueModal.tsx`

```typescript
// Line 47: useEffect 수정
useEffect(() => {
  if (!isOpen || !business || !business.id) {
    return;
  }

  const fetchLatestCalculation = async () => {
    setIsRefreshing(true);
    setError(null);

    try {
      // 1️⃣ 캐시 확인
      const cacheKey = `revenue_calc_${business.id}`;
      const cached = sessionStorage.getItem(cacheKey);

      if (cached) {
        try {
          const { data, timestamp } = JSON.parse(cached);
          const age = Date.now() - timestamp;
          const TTL = 5 * 60 * 1000; // 5분

          if (age < TTL) {
            console.log('✅ [CACHE-HIT] Revenue 계산 캐시 사용:', business.business_name || business.사업장명);
            setCalculatedData(data);
            setIsRefreshing(false);
            return; // 캐시 사용, API 호출 생략
          } else {
            console.log('⏰ [CACHE-EXPIRED] 캐시 만료, 재계산:', business.business_name || business.사업장명);
          }
        } catch (e) {
          console.warn('⚠️ [CACHE-ERROR] 캐시 파싱 실패:', e);
        }
      }

      // 2️⃣ API 호출 (캐시 없거나 만료된 경우)
      console.log('🔄 [API-CALL] Revenue 계산 API 호출:', business.business_name || business.사업장명);
      const token = TokenManager.getToken();
      const response = await fetch('/api/revenue/calculate', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          business_id: business.id,
          save_result: false
        })
      });

      const data = await response.json();

      if (data.success && data.data && data.data.calculation) {
        setCalculatedData(data.data.calculation);

        // 3️⃣ 캐시 저장
        sessionStorage.setItem(cacheKey, JSON.stringify({
          data: data.data.calculation,
          timestamp: Date.now()
        }));
        console.log('💾 [CACHE-SET] Revenue 계산 결과 캐시 저장:', business.business_name || business.사업장명);
      } else {
        setError(data.message || '계산 결과를 가져올 수 없습니다.');
      }
    } catch (err) {
      console.error('❌ [API-ERROR] 매출 계산 오류:', err);
      setError('계산 중 오류가 발생했습니다.');
    } finally {
      setIsRefreshing(false);
    }
  };

  fetchLatestCalculation();
}, [isOpen, business?.id]);
```

**변경 사항**:
- ✅ SessionStorage에 계산 결과 캐싱 (5분 TTL)
- ✅ 캐시 히트 시 API 호출 생략
- ✅ 콘솔 로그로 캐싱 동작 추적

---

### 2. BusinessRevenueModal - 스켈레톤 UI

**파일**: `components/business/BusinessRevenueModal.tsx`

```typescript
// Line 340: 모달 렌더링 부분 수정
export default function BusinessRevenueModal({ ... }) {
  // ... 기존 코드 ...

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-gray-600 bg-opacity-50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-7xl w-full max-h-[90vh] overflow-hidden">
        {/* 헤더 - 항상 표시 */}
        <div className="px-6 py-4 bg-gradient-to-r from-blue-600 to-indigo-600 text-white">
          <h3 className="text-xl font-bold flex items-center gap-2">
            <button
              onClick={handleBusinessNameClick}
              className="hover:text-blue-600 hover:underline transition-colors cursor-pointer text-left focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 rounded px-1"
              title="사업장 상세 정보로 이동 (수정 가능)"
            >
              {business.business_name || business.사업장명}
            </button>
            <span className="text-gray-500">- 기기 상세 정보</span>
          </h3>
        </div>

        {/* 컨텐츠 - 로딩 중이면 스켈레톤 표시 */}
        <div className="p-6 overflow-y-auto max-h-[calc(90vh-80px)]">
          {isRefreshing && !calculatedData ? (
            // 스켈레톤 로딩 UI
            <div className="space-y-6 animate-pulse">
              {/* 매출 정보 스켈레톤 */}
              <div className="bg-gray-50 rounded-lg p-6">
                <div className="h-6 bg-gray-300 rounded w-1/4 mb-4"></div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="h-20 bg-gray-200 rounded"></div>
                  <div className="h-20 bg-gray-200 rounded"></div>
                  <div className="h-20 bg-gray-200 rounded"></div>
                  <div className="h-20 bg-gray-200 rounded"></div>
                </div>
              </div>

              {/* 기기 목록 스켈레톤 */}
              <div>
                <div className="h-6 bg-gray-300 rounded w-1/4 mb-4"></div>
                <div className="space-y-3">
                  <div className="h-16 bg-gray-100 rounded"></div>
                  <div className="h-16 bg-gray-100 rounded"></div>
                  <div className="h-16 bg-gray-100 rounded"></div>
                </div>
              </div>

              {/* 로딩 메시지 */}
              <div className="text-center text-gray-500 py-8">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
                <p className="text-lg">매출 정보를 불러오는 중...</p>
                <p className="text-sm text-gray-400 mt-2">잠시만 기다려주세요</p>
              </div>
            </div>
          ) : error ? (
            // 에러 UI
            <div className="text-center text-red-500 py-8">
              <p className="text-lg font-semibold">⚠️ 오류 발생</p>
              <p className="text-sm mt-2">{error}</p>
            </div>
          ) : (
            // 실제 데이터 표시 (기존 UI)
            <>
              {/* InvoiceDisplay, MemoSection 등 기존 컴포넌트 */}
              <InvoiceDisplay data={calculatedData} business={business} ... />
              <MemoSection ... />
            </>
          )}
        </div>

        {/* 푸터 - 항상 표시 */}
        <div className="px-6 py-4 bg-gray-50 border-t flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300"
          >
            닫기
          </button>
        </div>
      </div>
    </div>
  );
}
```

**변경 사항**:
- ✅ 스켈레톤 UI로 즉시 피드백 제공
- ✅ 로딩 스피너로 진행 상태 표시
- ✅ 에러 상태 명확한 표시

---

### 3. Revenue 페이지 - 조기 모달 열기

**파일**: `app/admin/revenue/page.tsx`

```typescript
// Line 150: useEffect 수정
useEffect(() => {
  const businessId = searchParams?.get('businessId');
  const openRevenueModal = searchParams?.get('openRevenueModal');

  // ✅ 조건 완화: businesses 로딩 완료를 기다리지 않음
  if (!businessId || openRevenueModal !== 'true') {
    return;
  }

  // ✅ businesses 배열이 비어있어도 일단 모달 열기 시도
  if (businesses.length === 0) {
    console.log('⏳ [EARLY-OPEN] businesses 로딩 전 모달 열기 대기...');
    // 상태는 저장해두고, businesses 로드 후 다시 시도
    return;
  }

  // 해당 business 찾기
  const targetBusiness = businesses.find(b => b.id === businessId);

  if (targetBusiness) {
    console.log('🔗 [URL Navigation] Revenue 모달 자동 열기:', targetBusiness.business_name);

    // ✅ 즉시 모달 열기 (데이터 로딩은 모달 내부에서)
    setSelectedEquipmentBusiness(targetBusiness);
    setShowEquipmentModal(true);

    // URL 정리 (파라미터 제거)
    window.history.replaceState({}, '', '/admin/revenue');
  } else {
    console.warn('⚠️ [URL Navigation] 사업장을 찾을 수 없음:', businessId);
    window.history.replaceState({}, '', '/admin/revenue');
  }
}, [searchParams, businesses]);
```

**변경 사항**:
- ✅ businesses 배열이 로드되면 즉시 모달 열기
- ✅ 데이터 로딩은 모달 내부에서 처리 (캐싱 활용)

---

## 📊 예상 성능 개선

### Before (현재)
```
Business 모달 "돌아가기" 클릭
    ↓
페이지 전환: 500ms
    ↓
businesses 로딩: 1000ms
    ↓
모달 열기: 100ms
    ↓
/api/revenue/calculate: 2000-4000ms
    ↓
총 시간: 3.6-5.6초 ⏳
```

### After Phase 1 (캐싱 + 스켈레톤)
```
Business 모달 "돌아가기" 클릭
    ↓
페이지 전환: 500ms
    ↓
businesses 로딩: 1000ms
    ↓
모달 열기 (스켈레톤 표시): 100ms ✅ 즉시 피드백
    ↓
캐시 확인: 10ms
    ↓
캐시 히트: 0ms (API 호출 생략) ✅
    ↓
총 시간: 1.6초 (71% 개선) 🚀
```

### After Phase 2 (Pre-fetch 추가)
```
Business 모달 "돌아가기" 클릭
    ↓ (동시 실행)
    ├─ 페이지 전환: 500ms
    └─ Pre-fetch 시작: 0ms
    ↓
businesses 로딩: 1000ms
    ↓
모달 열기 (스켈레톤): 100ms ✅
    ↓
Pre-fetch 완료 & 캐시 저장: ~200ms
    ↓
캐시 사용: 10ms ✅
    ↓
총 시간: 0.8초 (86% 개선) 🚀🚀
```

---

## 🧪 테스트 시나리오

### Test 1: 캐시 히트 (정상 동작)
```
1. Revenue 모달 열기 (첫 로딩 - 2-5초)
2. Business 모달로 이동
3. 5분 이내 "돌아가기" 클릭
4. 예상: 1-2초 이내 모달 표시 ✅
5. 콘솔 확인: "✅ [CACHE-HIT] Revenue 계산 캐시 사용"
```

### Test 2: 캐시 만료 (재계산)
```
1. Revenue 모달 열기
2. 5분 이상 대기
3. Business 모달로 이동 후 복귀
4. 예상: 2-5초 소요 (재계산)
5. 콘솔 확인: "⏰ [CACHE-EXPIRED] 캐시 만료, 재계산"
```

### Test 3: 스켈레톤 UI
```
1. Business 모달에서 "돌아가기" 클릭
2. 예상: 즉시 모달 표시 (스켈레톤 UI)
3. 1-2초 후 실제 데이터 표시
4. 부드러운 전환 확인
```

### Test 4: 에러 처리
```
1. 네트워크 연결 끊기
2. Business 모달에서 "돌아가기"
3. 예상: 스켈레톤 → 에러 메시지 표시
4. 명확한 에러 안내 확인
```

---

## 🔒 캐시 무효화 전략

### 자동 무효화 시점
1. **시간 기반**: 5분 TTL (설정 가능)
2. **데이터 변경**: 매출 정보 수정 시
3. **세션 종료**: 브라우저 탭 닫기 시

### 수동 무효화
```typescript
// 매출 정보 수정 후
const invalidateRevenueCache = (businessId: string) => {
  const cacheKey = `revenue_calc_${businessId}`;
  sessionStorage.removeItem(cacheKey);
  console.log('🗑️ [CACHE-INVALIDATE] Revenue 캐시 삭제:', businessId);
};

// 사용 예시
const handleSaveSalesCommission = async () => {
  // ... 저장 로직 ...
  invalidateRevenueCache(business.id); // 캐시 무효화
};
```

---

## 💡 추가 최적화 아이디어

### 단기 (Phase 1-2)
- ✅ **API 응답 캐싱**: SessionStorage 활용
- ✅ **스켈레톤 UI**: 즉시 피드백 제공
- ✅ **Pre-fetch**: 백그라운드 병렬 처리

### 중기 (Phase 3)
- [ ] **IndexedDB 캐싱**: 더 큰 용량, 영구 저장
- [ ] **Service Worker**: 오프라인 지원, 백그라운드 동기화
- [ ] **Progressive Loading**: 중요 데이터 먼저 로딩

### 장기 (Future)
- [ ] **상태 기반 모달**: 페이지 전환 없이 모달만 전환
- [ ] **GraphQL**: 필요한 데이터만 요청
- [ ] **Server-Side Caching**: Redis로 서버 캐싱

---

## 📚 관련 파일

### 수정 필요 파일
1. **components/business/BusinessRevenueModal.tsx**
   - Line 47-87: useEffect 캐싱 로직 추가
   - Line 340+: 스켈레톤 UI 추가

2. **app/admin/revenue/page.tsx**
   - Line 150-177: 조기 모달 열기 로직 개선

### 새로 생성할 파일
- `utils/revenue-cache.ts` (Optional): 캐싱 유틸리티 함수

---

## ✅ 구현 체크리스트

### Phase 1: 기본 최적화
- [ ] BusinessRevenueModal에 SessionStorage 캐싱 추가
- [ ] 스켈레톤 UI 구현
- [ ] 캐시 무효화 로직 추가
- [ ] 콘솔 로그로 디버깅 지원

### Phase 2: 추가 최적화
- [ ] Pre-fetch 로직 구현
- [ ] 백그라운드 캐시 워밍업

### 테스트
- [ ] 캐시 히트 시나리오 테스트
- [ ] 캐시 만료 시나리오 테스트
- [ ] 스켈레톤 UI 전환 테스트
- [ ] 에러 처리 테스트

---

## 🎉 결론

**최종 권장 방안**: Phase 1 (캐싱 + 스켈레톤)

**예상 성능 개선**:
- 초기 로딩: 2-5초 (변화 없음)
- 복귀 시 로딩: 1-2초 (60-80% 개선) 🚀
- 체감 성능: 즉시 피드백으로 더 빠르게 느껴짐 ✅

**구현 난이도**: 낮음 (1-2시간)
**효과**: 높음 (사용자 경험 크게 개선)

**다음 단계**: Phase 1 구현 후 사용자 피드백에 따라 Phase 2 고려

---

**문서 버전**: 1.0
**작성 일자**: 2026-01-27
**상태**: 설계 완료 → 구현 대기
