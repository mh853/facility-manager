# 대기필증 생성 오류 수정 및 1000개 제한 해결

## 🚨 문제 상황

### 1. 대기필증 생성 실패

**브라우저 오류**:
```javascript
page.tsx:744 ❌ 대기필증 생성 실패: {error: '존재하지 않는 사업장입니다'}
```

**서버 로그**:
```
[MIDDLEWARE] POST /api/air-permit - unknown
POST /api/air-permit 404 in 109ms
```

### 2. Supabase 1000개 제한 문제

**증상**:
- 전체 사업장: 1026개
- 드롭다운 표시: 1000개만 표시
- 나머지 26개 사업장은 검색 불가

**기존 해결 방법**:
- 2번 연속 검색으로 1000개 이상 출력 시도
- 비효율적이고 불완전한 방법

---

## 🔍 근본 원인 분석

### 1. 대기필증 생성 실패 원인

#### API 코드 문제

**app/api/air-permit/route.ts:104**

```typescript
// ❌ 사업장 이름으로 조회 시도
const business = await DatabaseService.getBusinessByName(body.business_id)
```

#### 프론트엔드 전달 데이터

**app/admin/air-permit/page.tsx:1381**

```typescript
// ✅ UUID를 전달
setNewPermitData(prev => ({
  ...prev,
  business_id: business.id,  // UUID: "550e8400-e29b-41d4-a716..."
  business_type: business.business_type || ''
}))
```

#### 문제 분석

```
프론트엔드 → business_id: "550e8400-e29b-41d4-a716..." (UUID)
      ↓
API → getBusinessByName("550e8400-e29b-41d4-a716...")  // ❌ UUID로 이름 검색
      ↓
결과 → 사업장을 찾을 수 없음 → 404 오류
```

---

### 2. Supabase 1000개 제한 문제

#### Supabase 기본 제한

Supabase는 기본적으로 **단일 쿼리에서 최대 1000개 행**만 반환합니다.

**기존 코드**:
```typescript
const { data: allBusinesses } = await supabaseAdmin
  .from('business_info')
  .select('...')
  .eq('is_active', true)
  .order('business_name');

// 결과: 최대 1000개만 반환
```

**문제**:
- 총 1026개 사업장 중 1000개만 조회됨
- 나머지 26개는 검색 불가
- 알파벳 순 정렬 시 끝부분 사업장 누락

---

## ✅ 해결 방법

### 1. 대기필증 생성 오류 수정

**app/api/air-permit/route.ts:103-110**

#### Before (잘못된 코드)
```typescript
// 사업장 존재 확인 (사업장명으로 조회)
const business = await DatabaseService.getBusinessByName(body.business_id)
if (!business) {
  return NextResponse.json(
    { error: '존재하지 않는 사업장입니다' },
    { status: 404 }
  )
}
```

#### After (수정된 코드)
```typescript
// 사업장 존재 확인 (UUID로 조회)
const business = await DatabaseService.getBusinessById(body.business_id)
if (!business) {
  return NextResponse.json(
    { error: '존재하지 않는 사업장입니다' },
    { status: 404 }
  )
}
```

**변경 사항**:
- ❌ `getBusinessByName()` → ✅ `getBusinessById()`
- UUID로 직접 조회하여 정확한 사업장 확인

---

### 2. Supabase 1000개 제한 해결

**app/api/business-list/route.ts:22-84**

#### 페이지네이션 방식 적용

```typescript
// Supabase 기본 제한(1000개)을 우회하기 위해 페이지네이션 사용
let allBusinesses: any[] = [];
let page = 0;
const pageSize = 1000;
let hasMore = true;

while (hasMore) {
  const { data: businessPage, error: businessError } = await supabaseAdmin
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
    .order('business_name')
    .range(page * pageSize, (page + 1) * pageSize - 1);  // ✅ 페이지 범위 지정

  if (businessError) {
    console.error('🔴 [BUSINESS-LIST] 전체 사업장 조회 오류:', businessError);
    throw businessError;
  }

  if (businessPage && businessPage.length > 0) {
    allBusinesses = [...allBusinesses, ...businessPage];
    hasMore = businessPage.length === pageSize; // 1000개 미만이면 마지막 페이지
    page++;
    console.log(`📄 [BUSINESS-LIST] 페이지 ${page} 조회 완료: ${businessPage.length}개 (누적: ${allBusinesses.length}개)`);
  } else {
    hasMore = false;
  }
}

console.log(`✅ [BUSINESS-LIST] 전체 사업장 조회 완료: ${allBusinesses.length}개 (${page}페이지)`);
```

**작동 원리**:
1. **페이지 1**: 0-999번 (1000개)
2. **페이지 2**: 1000-1025번 (26개)
3. 총 1026개 모두 조회 완료

---

## 📊 수정 효과

### 1. 대기필증 생성 오류 수정

#### Before (오류 발생)
```
1. 사업장 선택: business.id = "550e8400-..." (UUID)
2. API 호출: POST /api/air-permit
   body.business_id = "550e8400-..."
3. API 처리:
   getBusinessByName("550e8400-...")  // ❌ UUID로 이름 검색
4. 결과: 404 오류 - "존재하지 않는 사업장입니다"
```

#### After (정상 작동)
```
1. 사업장 선택: business.id = "550e8400-..." (UUID)
2. API 호출: POST /api/air-permit
   body.business_id = "550e8400-..."
3. API 처리:
   getBusinessById("550e8400-...")  // ✅ UUID로 ID 검색
4. 결과: 200 OK - 대기필증 생성 성공
```

---

### 2. Supabase 1000개 제한 해결

#### Before (1000개 제한)
```
단일 쿼리 실행
  ↓
Supabase 기본 제한 적용
  ↓
최대 1000개만 반환
  ↓
나머지 26개 누락
```

#### After (전체 조회)
```
페이지 1 (0-999): 1000개
  ↓
누적: 1000개
  ↓
페이지 2 (1000-1025): 26개
  ↓
누적: 1026개
  ↓
전체 조회 완료
```

---

## 🧪 테스트 방법

### 1. 대기필증 생성 테스트

```
1. http://localhost:3000/admin/air-permit 접속
2. "대기필증 추가" 버튼 클릭
3. 사업장 선택
4. 배출구, 배출시설, 방지시설 정보 입력
5. "저장" 버튼 클릭
6. 결과 확인:
   ✅ "대기필증이 성공적으로 생성되었습니다" 메시지
   ✅ 대기필증 목록에 새 항목 추가됨
   ❌ "존재하지 않는 사업장입니다" 오류 발생 안 함
```

### 2. 1000개 이상 사업장 검색 테스트

```
1. "대기필증 추가" 버튼 클릭
2. "사업장 선택" 입력창 클릭
3. 서버 로그 확인:
   🏢 [BUSINESS-LIST] 전체 사업장 목록 조회 (includeAll=true)
   📄 [BUSINESS-LIST] 페이지 1 조회 완료: 1000개 (누적: 1000개)
   📄 [BUSINESS-LIST] 페이지 2 조회 완료: 26개 (누적: 1026개)
   ✅ [BUSINESS-LIST] 전체 사업장 조회 완료: 1026개 (2페이지)
4. 브라우저 확인:
   ✅ "전체: 1026개 사업장" 표시
   ✅ 모든 사업장 검색 가능
5. 알파벳 끝 사업장 검색:
   - "ㅎ"로 시작하는 사업장 검색
   - "Z"로 시작하는 사업장 검색
   ✅ 끝 부분 사업장도 검색됨
```

---

## 📝 코드 변경 요약

### 1. app/api/air-permit/route.ts

**Line 104**: 사업장 조회 메서드 변경
```typescript
// Before
const business = await DatabaseService.getBusinessByName(body.business_id)

// After
const business = await DatabaseService.getBusinessById(body.business_id)
```

### 2. app/api/business-list/route.ts

**Line 22-84**: 페이지네이션 로직 추가
```typescript
// Before
const { data: allBusinesses } = await supabaseAdmin
  .from('business_info')
  .select('...')
  .order('business_name');

// After
let allBusinesses: any[] = [];
let page = 0;
const pageSize = 1000;
let hasMore = true;

while (hasMore) {
  const { data: businessPage } = await supabaseAdmin
    .from('business_info')
    .select('...')
    .order('business_name')
    .range(page * pageSize, (page + 1) * pageSize - 1);  // ✅ 페이지네이션

  if (businessPage && businessPage.length > 0) {
    allBusinesses = [...allBusinesses, ...businessPage];
    hasMore = businessPage.length === pageSize;
    page++;
  } else {
    hasMore = false;
  }
}
```

---

## 🔧 기술적 원리

### 1. UUID vs 사업장명 조회

**UUID 조회 (정확)**:
```typescript
// business_id = "550e8400-e29b-41d4-a716-446655440000"
const business = await DatabaseService.getBusinessById(business_id)

// SQL 실행:
// SELECT * FROM business_info WHERE id = '550e8400-...'
// 결과: 정확히 하나의 사업장
```

**사업장명 조회 (부정확)**:
```typescript
// business_id = "550e8400-..." (실제로는 UUID)
const business = await DatabaseService.getBusinessByName(business_id)

// SQL 실행:
// SELECT * FROM business_info WHERE business_name = '550e8400-...'
// 결과: 없음 (UUID는 사업장명이 아님)
```

---

### 2. Supabase 페이지네이션

**range() 메서드**:
```typescript
.range(start, end)  // start부터 end까지 (inclusive)

// 예시:
.range(0, 999)     // 1페이지: 0-999번 (1000개)
.range(1000, 1999) // 2페이지: 1000-1999번 (1000개)
.range(2000, 2999) // 3페이지: 2000-2999번 (1000개)
```

**페이지네이션 로직**:
```typescript
while (hasMore) {
  // 현재 페이지 조회
  .range(page * pageSize, (page + 1) * pageSize - 1)

  // 1000개 받았으면 다음 페이지 존재
  hasMore = businessPage.length === pageSize

  // 1000개 미만이면 마지막 페이지
  if (businessPage.length < pageSize) hasMore = false
}
```

---

### 3. 성능 최적화

**단일 쿼리 (1000개 제한)**:
```
쿼리 1번 실행
  ↓
1000개 반환
  ↓
Total: 1 DB call
```

**페이지네이션 (전체 조회)**:
```
쿼리 1번: 1000개
  ↓
쿼리 2번: 26개
  ↓
Total: 2 DB calls (1026개)
```

**트레이드오프**:
- DB 호출: 1번 → 2번 (증가)
- 완전성: 97% → 100% (향상)
- 사용자 경험: 누락 있음 → 완전 검색 (매우 향상)

---

## ✨ 최종 결론

### 달성한 목표

1. ✅ **대기필증 생성 오류 수정**
   - UUID vs 사업장명 조회 문제 해결
   - 모든 사업장에 대기필증 생성 가능

2. ✅ **Supabase 1000개 제한 해결**
   - 페이지네이션으로 전체 사업장 조회
   - 1026개 모든 사업장 검색 가능

3. ✅ **완전한 검색 기능**
   - 알파벳 끝 부분 사업장도 검색 가능
   - 누락 없는 완전한 사업장 목록

### 사용자 경험 개선

**Before**:
- 대기필증 생성 → **404 오류 발생** ❌
- 사업장 검색 → 1000개만 표시 (26개 누락)
- 끝 부분 사업장 → **검색 불가** ❌

**After**:
- 대기필증 생성 → **정상 작동** ✅
- 사업장 검색 → **1026개 전체 표시** ✅
- 끝 부분 사업장 → **검색 가능** ✅

---

## 📌 관련 문서

- [대기필증 사업장 검색 - 전체 사업장 검색 가능 수정](./air-permit-search-all-businesses-fix.md)
- [대기필증 사업장 드롭다운 React 오류 수정](./air-permit-business-dropdown-react-error-fix.md)
- [대기필증 전체 시스템 최적화 완료 요약](./air-permit-complete-optimization-summary.md)

---

**대기필증 생성이 정상적으로 작동하고, 모든 사업장(1026개)을 검색할 수 있습니다!** 🚀
