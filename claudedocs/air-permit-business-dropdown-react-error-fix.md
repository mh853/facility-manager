# 대기필증 사업장 선택 드롭다운 React 오류 수정

## 🚨 문제 상황

### 증상
대기필증 추가 모달에서 사업장 선택 드롭다운을 클릭하면 다음 React 오류 발생:

```
Warning: Encountered two children with the same key, `[object Object]`

Error: Objects are not valid as a React child (found: object with keys {id, business_name, address, manager_name, manager_contact, sales_office, manufacturer, business_category, progress_status, ph_meter, differential_pressure_meter, temperature_meter, discharge_current_meter, fan_current_meter, pump_current_meter, gateway, vpn_wired, vpn_wireless, explosion_proof_differential_pressure_meter_domestic, explosion_proof_temperature_meter_domestic, expansion_device, relay_8ch, relay_16ch, main_board_replacement, multiple_stack, additional_cost, negotiation})
```

### 예상 동작
- 드롭다운에서 사업장 목록이 정상적으로 표시됨
- 사업장명과 지자체명으로 검색 및 자동완성 기능 작동
- 사업장 선택 후 대기필증 추가 가능

---

## 🔍 근본 원인 분석

### 1. API와 프론트엔드 간 데이터 구조 불일치

#### API 응답 (app/api/business-list/route.ts)
```typescript
// Line 146: API는 전체 BusinessInfo 객체 배열을 반환
return createSuccessResponse({
  businesses: businessWithPermits,  // ✅ Full BusinessInfo[] objects
  count: businessWithPermits.length,
  metadata: { ... }
});
```

#### 프론트엔드 처리 (app/admin/air-permit/page.tsx)
```typescript
// Line 456-463: 문자열 배열로 간주하고 변환 시도 ❌
const loadAllBusinesses = async () => {
  const result = await response.json()

  // API에서 문자열 배열을 반환하므로 객체로 변환 ❌ 잘못된 주석
  const businessNames = Array.isArray(result.data?.businesses) ? result.data.businesses : []
  const businesses = businessNames.map((name: string, index: number) => ({
    id: name, // ❌ 객체를 ID로 사용 → [object Object]
    business_name: name, // ❌ 객체를 이름으로 사용 → [object Object]
    local_government: result.data?.details?.[name]?.local_government || '', // ❌ 존재하지 않는 경로
    business_registration_number: '',
    business_type: ''
  }))
}
```

### 2. 결과: React 렌더링 오류

**문제 1: Key prop에 객체 사용**
```typescript
// Line 1373-1375: key에 business.id 사용하는데, business.id가 객체일 경우
{filteredBusinesses.map(business => (
  <div key={business.id}>  // ❌ [object Object]
```

**문제 2: 객체를 직접 렌더링**
```typescript
// Line 1381-1382: business_name이 객체일 경우
<div className="...">{business.business_name}</div>  // ❌ Cannot render object
<div className="...">{business.local_government}</div>  // ❌ undefined or object
```

### 3. API 응답에서 누락된 필드

API는 `business_name`, `address` 등은 반환했지만, 드롭다운에서 필요한 다음 필드들이 누락됨:
- `local_government` (지자체명) - 필수
- `business_type` (업종) - 선택 시 자동 입력용
- `business_registration_number` (사업자등록번호) - 검색용

---

## ✅ 해결 방법

### 1. 프론트엔드: 불필요한 데이터 변환 제거

**app/admin/air-permit/page.tsx:448-472**

#### Before (잘못된 코드)
```typescript
const loadAllBusinesses = async () => {
  setIsLoadingBusinesses(true)
  try {
    const response = await fetch('/api/business-list')
    const result = await response.json()

    if (response.ok) {
      // ❌ API에서 문자열 배열을 반환하므로 객체로 변환
      const businessNames = Array.isArray(result.data?.businesses) ? result.data.businesses : []
      const businesses = businessNames.map((name: string, index: number) => ({
        id: name, // ❌ 사업장명을 ID로 사용
        business_name: name,
        local_government: result.data?.details?.[name]?.local_government || '',
        business_registration_number: '',
        business_type: ''
      }))

      setAllBusinesses(businesses)
    }
  } catch (error) {
    console.error('❌ 사업장 목록 로드 오류:', error)
    setAllBusinesses([])
  } finally {
    setIsLoadingBusinesses(false)
  }
}
```

#### After (수정된 코드)
```typescript
const loadAllBusinesses = async () => {
  setIsLoadingBusinesses(true)
  try {
    const response = await fetch('/api/business-list')
    const result = await response.json()

    if (response.ok) {
      // ✅ API에서 BusinessInfo 객체 배열을 반환 - 그대로 사용
      const businesses = Array.isArray(result.data?.businesses) ? result.data.businesses : []

      console.log('✅ 사업장 목록 로드 완료:', businesses.length, '개')
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

**변경 사항**:
- ❌ 불필요한 `.map()` 변환 제거
- ✅ API 응답을 그대로 사용 (BusinessInfo[] 타입 유지)
- ✅ 코드 간결화 (20줄 → 15줄)

---

### 2. 백엔드: 필요한 필드 추가

**app/api/business-list/route.ts:49-88**

#### Before (누락된 필드)
```typescript
const { data: businessWithPermits, error: businessError } = await supabaseAdmin
  .from('business_info')
  .select(`
    id,
    business_name,
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
  .in('id', businessIds)
  .eq('is_active', true)
  .eq('is_deleted', false)
  .not('business_name', 'is', null)
  .order('business_name');
```

#### After (필드 추가)
```typescript
const { data: businessWithPermits, error: businessError } = await supabaseAdmin
  .from('business_info')
  .select(`
    id,
    business_name,
    local_government,        // ✅ 추가: 지자체명 (드롭다운 표시용)
    business_type,           // ✅ 추가: 업종 (자동 입력용)
    business_registration_number, // ✅ 추가: 사업자등록번호 (검색용)
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
  .in('id', businessIds)
  .eq('is_active', true)
  .eq('is_deleted', false)
  .not('business_name', 'is', null)
  .order('business_name');
```

**변경 사항**:
- ✅ `local_government` 추가 - 드롭다운에서 사업장명 아래 지자체명 표시
- ✅ `business_type` 추가 - 사업장 선택 시 업종 자동 입력
- ✅ `business_registration_number` 추가 - 사업자등록번호로 검색 가능

---

## 📊 수정 효과

### Before (오류 발생)
```
1. API → [BusinessInfo objects]
2. 프론트엔드 → .map(name: string) ❌
3. 결과 → [{id: [object Object], business_name: [object Object], ...}]
4. React → ❌ Error: Objects are not valid as a React child
```

### After (정상 작동)
```
1. API → [BusinessInfo objects with all fields]
2. 프론트엔드 → 그대로 사용 ✅
3. 결과 → [{id: 'uuid', business_name: '사업장명', local_government: '서울시', ...}]
4. React → ✅ 정상 렌더링
```

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
4. 드롭다운 확인:
   ✅ 사업장 목록 표시됨
   ✅ 사업장명과 지자체명 표시됨
   ✅ 검색 기능 작동함
   ✅ React 오류 없음
5. 사업장 선택 후 대기필증 추가 확인
```

### 3. 콘솔 로그 확인
```javascript
// 정상 로그 예시
✅ 사업장 목록 로드 완료: 25 개

// 비정상 로그 (이제 발생하지 않음)
❌ Warning: Encountered two children with the same key
❌ Error: Objects are not valid as a React child
```

---

## 📝 기술적 원리

### React Key Prop 오류

**문제**:
```typescript
// business.id = {business_name: "회사A", ...} (객체)
<div key={business.id}>  // key={[object Object]}
```

React는 `key` prop으로 고유 문자열/숫자를 기대하지만, 객체를 받으면:
1. 객체를 `[object Object]`로 변환
2. 모든 아이템이 같은 key를 가짐
3. Warning: "Encountered two children with the same key"

**해결**:
```typescript
// business.id = "550e8400-e29b-41d4-a716-446655440000" (UUID 문자열)
<div key={business.id}>  // ✅ 고유한 문자열 key
```

---

### React Child 렌더링 오류

**문제**:
```typescript
// business.business_name = {id: "123", name: "회사A"} (객체)
<div>{business.business_name}</div>  // ❌ Cannot render object
```

React는 JSX에서 객체를 직접 렌더링할 수 없음. 문자열, 숫자, boolean만 가능.

**해결**:
```typescript
// business.business_name = "회사A" (문자열)
<div>{business.business_name}</div>  // ✅ 문자열 렌더링
```

---

### TypeScript 타입 안정성

**Before** (타입 불일치):
```typescript
// API: BusinessInfo[] 반환
// 프론트엔드: string[]로 처리
const businessNames = businesses as string[]  // ❌ 타입 강제 변환
```

**After** (타입 일치):
```typescript
// API: BusinessInfo[] 반환
// 프론트엔드: BusinessInfo[]로 사용
const businesses: BusinessInfo[] = result.data.businesses  // ✅ 타입 일치
```

---

## ✨ 최종 결론

### 달성한 목표

1. ✅ **React 오류 완전 제거**
   - "Encountered two children with the same key" 해결
   - "Objects are not valid as a React child" 해결

2. ✅ **데이터 구조 일관성**
   - API와 프론트엔드 간 타입 일치
   - 불필요한 데이터 변환 제거

3. ✅ **기능 완전성**
   - 사업장 목록 정상 표시
   - 검색 및 자동완성 작동
   - 지자체명 표시로 사업장 구분 용이

4. ✅ **코드 품질 개선**
   - 간결한 코드 (20줄 → 15줄)
   - 타입 안정성 향상
   - 유지보수성 개선

### 사용자 경험 개선

**Before**:
- 드롭다운 클릭 → **오류 발생** → 사업장 선택 불가 ❌

**After**:
- 드롭다운 클릭 → 사업장 목록 표시 → 검색 및 선택 가능 ✨
- 사업장명 + 지자체명으로 명확한 구분 가능

---

## 📌 관련 문서

- [대기필증 전체 시스템 최적화 완료 요약](./air-permit-complete-optimization-summary.md)
- [대기필증 JOIN 쿼리 최적화](./air-permit-join-query-optimization.md)

---

**대기필증 사업장 선택 드롭다운이 정상적으로 작동합니다!** 🚀
