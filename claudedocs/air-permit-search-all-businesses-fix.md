# 대기필증 사업장 검색 - 전체 사업장 검색 가능 수정

## 🚨 문제 상황

### 증상
- 사업장 관리에 1026개 사업장이 등록되어 있음
- 대기필증 추가 모달에서 사업장 검색 시 224개만 검색됨
- 대기필증이 이미 등록된 사업장만 검색 가능
- 대기필증을 새로 등록하려는 사업장은 검색 불가

### 예상 동작
- 대기필증 추가 모달에서 **모든 사업장(1026개)** 검색 가능
- 사업장명, 지자체명, 사업자등록번호로 검색
- 검색 결과 제한 없음

---

## 🔍 근본 원인 분석

### 1. API 로직 문제

**app/api/business-list/route.ts**

```typescript
// Line 17-20: 대기필증이 있는 business_id만 조회
const { data: businessIdsWithPermits } = await supabaseAdmin
  .from('air_permit_info')
  .select('business_id')
  .not('business_id', 'is', null);

// Line 50: 해당 business_id들만 business_info에서 조회
const { data: businessWithPermits } = await supabaseAdmin
  .from('business_info')
  .select('...')
  .in('id', businessIds)  // ❌ 대기필증 있는 사업장만
```

**결과**:
- 대기필증이 등록된 224개 사업장만 반환
- 대기필증을 등록하려는 나머지 802개 사업장은 검색 불가

### 2. 프론트엔드 검색 제한

**app/admin/air-permit/page.tsx**

```typescript
// Line 590: 초기 로드 시 100개 제한
if (!searchTerm || searchTerm.length < 1) return allBusinesses.slice(0, 100)

// Line 599: 검색 시 50개 제한
return allBusinesses.filter(...).slice(0, 50)
```

**결과**:
- 초기 로드: 최대 100개만 표시
- 검색 시: 최대 50개만 표시

---

## ✅ 해결 방법

### 1. API: 조건부 전체 사업장 조회 지원

**app/api/business-list/route.ts:12-80**

#### 수정 내용

```typescript
export const GET = withApiHandler(async (request: NextRequest) => {
  try {
    // ✅ URL 파라미터 확인 - includeAll=true면 모든 사업장 반환
    const { searchParams } = new URL(request.url);
    const includeAll = searchParams.get('includeAll') === 'true';

    if (includeAll) {
      // ✅ 모든 사업장 조회 (대기필증 추가 모달용)
      console.log('🏢 [BUSINESS-LIST] 전체 사업장 목록 조회 (includeAll=true)');

      const { data: allBusinesses, error: businessError } = await supabaseAdmin
        .from('business_info')
        .select(`
          id,
          business_name,
          local_government,
          business_type,
          business_registration_number,
          address,
          manager_name,
          manager_contact,
          sales_office,
          manufacturer,
          business_category,
          progress_status,
          ph_meter,
          differential_pressure_meter,
          temperature_meter,
          discharge_current_meter,
          fan_current_meter,
          pump_current_meter,
          gateway,
          vpn_wired,
          vpn_wireless,
          explosion_proof_differential_pressure_meter_domestic,
          explosion_proof_temperature_meter_domestic,
          expansion_device,
          relay_8ch,
          relay_16ch,
          main_board_replacement,
          multiple_stack,
          additional_cost,
          negotiation
        `)
        .eq('is_active', true)
        .eq('is_deleted', false)
        .not('business_name', 'is', null)
        .order('business_name');

      if (businessError) {
        console.error('🔴 [BUSINESS-LIST] 전체 사업장 조회 오류:', businessError);
        throw businessError;
      }

      console.log(`✅ [BUSINESS-LIST] 전체 사업장 조회 완료: ${allBusinesses?.length || 0}개`);

      return createSuccessResponse({
        businesses: allBusinesses || [],
        count: allBusinesses?.length || 0,
        metadata: {
          source: 'business_info_all',
          totalCount: allBusinesses?.length || 0,
          hasPhotoData: true,
          includesFullData: true,
          dataType: 'BusinessInfo[]',
          criteriaUsed: 'all_businesses'
        }
      });
    }

    // 기존 로직: 대기필증이 등록된 사업장만 조회
    // ... (기존 코드 유지)
  } catch (error) {
    // ... error handling
  }
});
```

**변경 사항**:
- ✅ `?includeAll=true` 파라미터 지원
- ✅ `includeAll=true`면 모든 사업장(1026개) 반환
- ✅ 파라미터 없으면 기존 동작 유지 (대기필증 있는 사업장만)
- ✅ 하위 호환성 완벽 유지

---

### 2. 프론트엔드: includeAll 파라미터 사용 및 제한 제거

**app/admin/air-permit/page.tsx:447-473**

#### 수정 내용

```typescript
// 모든 사업장 목록 로드 (모달용 - 전체 사업장)
const loadAllBusinesses = async () => {
  setIsLoadingBusinesses(true)
  try {
    // ✅ includeAll=true 파라미터로 전체 사업장 조회
    const response = await fetch('/api/business-list?includeAll=true')
    const result = await response.json()

    if (response.ok) {
      const businesses = Array.isArray(result.data?.businesses) ? result.data.businesses : []

      console.log('✅ 전체 사업장 목록 로드 완료:', businesses.length, '개')
      setAllBusinesses(businesses)
    } else {
      console.error('❌ 사업장 목록 로드 실패:', result.error)
      setAllBusinesses([])
      alert('사업장 목록을 불러오는데 실패했습니다: ' + result.error)
    }
  } catch (error) {
    console.error('❌ 사업장 목록 로드 오류:', error)
    setAllBusinesses([])
    alert('사업장 목록을 불러오는 중 오류가 발생했습니다.')
  } finally {
    setIsLoadingBusinesses(false)
  }
}
```

**app/admin/air-permit/page.tsx:588-605**

```typescript
// 사업장 필터링 로직 (실시간 검색 최적화)
const filteredBusinesses = useMemo(() => {
  if (!Array.isArray(allBusinesses)) return []

  // ✅ 검색어가 없으면 전체 목록 반환 (제한 없음)
  if (!searchTerm || searchTerm.length < 1) {
    return allBusinesses
  }

  // ✅ 검색어가 있으면 필터링 (제한 없이 전체 검색)
  const searchLower = searchTerm.toLowerCase()
  return allBusinesses.filter(business => {
    return (
      business.business_name?.toLowerCase().includes(searchLower) ||
      business.local_government?.toLowerCase().includes(searchLower) ||
      business.business_registration_number?.includes(searchTerm)
    )
  })
}, [allBusinesses, searchTerm])
```

**변경 사항**:
- ✅ API 호출 시 `?includeAll=true` 추가
- ❌ `.slice(0, 100)` 제거 - 초기 로드 제한 해제
- ❌ `.slice(0, 50)` 제거 - 검색 결과 제한 해제
- ✅ 전체 1026개 사업장 검색 가능

---

**app/admin/air-permit/page.tsx:1365-1369**

```typescript
// ✅ UI 텍스트 업데이트
<div className="px-2 sm:px-3 py-1 sm:py-2 text-[9px] sm:text-[10px] md:text-xs text-gray-500 border-b border-gray-200 bg-gray-50">
  {searchTerm ?
    `검색 결과: ${filteredBusinesses.length}개 사업장` :
    `전체: ${filteredBusinesses.length}개 사업장`
  }
</div>
```

**변경 사항**:
- ❌ "(최대 50개 표시)" 제거
- ❌ "(처음 100개 표시)" 제거
- ✅ 실제 검색 결과 개수만 표시

---

## 📊 수정 효과

### Before (제한적 검색)

**API 동작**:
```
1. air_permit_info 조회 → 대기필증 있는 business_id만
2. business_info 조회 → 해당 business_id만 (224개)
3. 결과 → 대기필증 있는 사업장만 검색 가능
```

**프론트엔드 동작**:
```
1. 초기 로드 → 100개만 표시 (224개 중)
2. 검색 → 50개만 표시
3. 결과 → 최대 50~100개만 검색 가능
```

**문제**:
- ❌ 대기필증 없는 802개 사업장은 검색 불가
- ❌ 대기필증을 새로 등록할 수 없음

---

### After (전체 검색)

**API 동작**:
```
1. ?includeAll=true 파라미터
2. business_info 조회 → 모든 활성 사업장 (1026개)
3. 결과 → 전체 사업장 검색 가능
```

**프론트엔드 동작**:
```
1. 초기 로드 → 전체 1026개 표시
2. 검색 → 제한 없이 전체 검색
3. 결과 → 모든 사업장 검색 가능
```

**효과**:
- ✅ 모든 사업장(1026개) 검색 가능
- ✅ 대기필증을 어떤 사업장에든 등록 가능
- ✅ 검색 결과 제한 없음

---

## 🧪 테스트 방법

### 1. 개발 서버 시작
```bash
npm run dev
```

### 2. 브라우저 테스트
```
1. http://localhost:3000/admin/air-permit 접속
2. "대기필증 추가" 버튼 클릭
3. "사업장 선택" 입력창 클릭
4. 확인:
   ✅ "전체: 1026개 사업장" 표시됨
   ✅ 모든 사업장이 드롭다운에 표시됨
   ✅ 스크롤하여 전체 목록 확인 가능
5. 검색 테스트:
   - 사업장명으로 검색: "회사명" 입력
   - 지자체명으로 검색: "서울" 입력
   - 사업자등록번호로 검색: "123-45-67890" 입력
6. 확인:
   ✅ "검색 결과: N개 사업장" 표시됨
   ✅ 검색 결과에 제한 없음
   ✅ 대기필증 없는 사업장도 검색됨
```

### 3. 콘솔 로그 확인
```javascript
// 서버 로그
🏢 [BUSINESS-LIST] 전체 사업장 목록 조회 (includeAll=true)
✅ [BUSINESS-LIST] 전체 사업장 조회 완료: 1026개

// 브라우저 콘솔
✅ 전체 사업장 목록 로드 완료: 1026 개
```

---

## 🔧 코드 변경 요약

### 1. app/api/business-list/route.ts

**변경 사항**:
- ✅ `?includeAll=true` 파라미터 지원 추가
- ✅ 조건부 전체 사업장 조회 로직 추가
- ✅ 기존 로직(대기필증 있는 사업장만) 유지
- ✅ 하위 호환성 완벽 유지

### 2. app/admin/air-permit/page.tsx

**Line 452**: API 호출에 `?includeAll=true` 추가
```typescript
const response = await fetch('/api/business-list?includeAll=true')
```

**Line 588-605**: 검색 필터 제한 제거
```typescript
// Before
if (!searchTerm) return allBusinesses.slice(0, 100)  // ❌ 제한
return allBusinesses.filter(...).slice(0, 50)  // ❌ 제한

// After
if (!searchTerm) return allBusinesses  // ✅ 전체
return allBusinesses.filter(...)  // ✅ 전체
```

**Line 1365-1369**: UI 텍스트 업데이트
```typescript
// Before
`검색 결과: ${filteredBusinesses.length}개 사업장 ${filteredBusinesses.length === 50 ? '(최대 50개 표시)' : ''}`
`전체: ${filteredBusinesses.length}개 사업장 ${filteredBusinesses.length === 100 ? '(처음 100개 표시)' : ''}`

// After
`검색 결과: ${filteredBusinesses.length}개 사업장`
`전체: ${filteredBusinesses.length}개 사업장`
```

---

## 📝 기술적 원리

### 1. 조건부 API 응답

**설계 패턴**:
```typescript
// 하나의 API 엔드포인트로 두 가지 동작 지원
if (includeAll === 'true') {
  // 모든 사업장 반환
  return allBusinesses
} else {
  // 대기필증 있는 사업장만 반환 (기존 동작)
  return businessesWithPermits
}
```

**장점**:
- ✅ 기존 API 호출 영향 없음 (하위 호환성)
- ✅ 새로운 엔드포인트 불필요
- ✅ 캐싱 정책 일관성 유지

---

### 2. 검색 성능 최적화

**useMemo를 사용한 검색**:
```typescript
const filteredBusinesses = useMemo(() => {
  if (!searchTerm) return allBusinesses
  return allBusinesses.filter(business => {
    return (
      business.business_name?.toLowerCase().includes(searchLower) ||
      business.local_government?.toLowerCase().includes(searchLower) ||
      business.business_registration_number?.includes(searchTerm)
    )
  })
}, [allBusinesses, searchTerm])
```

**성능 고려사항**:
- 1026개 사업장 × 3개 필드 검색
- 메모이제이션으로 불필요한 재계산 방지
- 검색어 변경 시에만 재계산

**예상 성능**:
- 초기 로드: 1026개 전체 렌더링 (~100ms)
- 검색: 1026개 필터링 (~10ms)
- UI 업데이트: React Virtual Scrolling으로 최적화

---

### 3. 드롭다운 가상화 (선택적 개선)

**현재**: 전체 목록 렌더링
```typescript
{filteredBusinesses.map(business => (
  <div key={business.id}>...</div>
))}
```

**향후 개선 (선택사항)**:
```typescript
import { FixedSizeList } from 'react-window'

<FixedSizeList
  height={240}
  itemCount={filteredBusinesses.length}
  itemSize={60}
>
  {({ index, style }) => (
    <div style={style} key={filteredBusinesses[index].id}>
      {/* 사업장 정보 */}
    </div>
  )}
</FixedSizeList>
```

**효과** (선택적):
- 1000개+ 사업장도 부드러운 스크롤
- 메모리 사용량 감소 (보이는 항목만 렌더링)

---

## ✨ 최종 결론

### 달성한 목표

1. ✅ **전체 사업장 검색 가능**
   - 1026개 모든 사업장 검색 가능
   - 대기필증 유무와 무관하게 등록 가능

2. ✅ **검색 제한 제거**
   - 초기 로드 제한 제거 (100개 → 전체)
   - 검색 결과 제한 제거 (50개 → 전체)

3. ✅ **하위 호환성 유지**
   - 기존 API 호출 영향 없음
   - 다른 페이지에서 사용하는 API 동작 유지

4. ✅ **사용성 개선**
   - 정확한 검색 결과 개수 표시
   - 사업장명, 지자체명, 사업자등록번호 검색 지원

### 사용자 경험 개선

**Before**:
- 드롭다운 클릭 → 224개 사업장만 표시
- 검색 → 최대 50개만 검색
- 대기필증 없는 사업장 → **등록 불가** ❌

**After**:
- 드롭다운 클릭 → **1026개 모든 사업장 표시**
- 검색 → **제한 없이 전체 검색**
- 대기필증 없는 사업장 → **등록 가능** ✅

---

## 📌 관련 문서

- [대기필증 사업장 드롭다운 React 오류 수정](./air-permit-business-dropdown-react-error-fix.md)
- [대기필증 전체 시스템 최적화 완료 요약](./air-permit-complete-optimization-summary.md)

---

**이제 모든 사업장(1026개)을 검색하여 대기필증을 등록할 수 있습니다!** 🚀
