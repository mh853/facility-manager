# 대기필증 저장 및 UI 즉시 반영 수정

## 변경 일시
2025-11-04

## 개요
대기필증 정보를 저장할 때 **실제로는 저장이 안되고 있던 문제**와 **저장 후 화면에 즉시 반영되지 않는 문제**를 수정했습니다.

## 문제 상황

### 문제 1: 저장이 실제로 안되고 있었음

**사용자 증상**:
- 그린링크코드, 시설번호를 입력하고 저장
- 저장은 성공했다고 나오지만 (200 OK)
- 새로고침하면 입력한 데이터가 사라짐

**서버 로그 분석**:
```javascript
💾 Supabase에 전송할 데이터: {
  business_type: '일반',
  first_report_date: null,
  operation_start_date: null,
  additional_info: { ... }
}
// ❌ green_link_code 없음!
// ❌ facility_number 없음!
```

**실제 원인**:
저장 API가 성공을 반환하지만, **실제로 필드가 데이터베이스에 전송조차 되지 않음**.

### 문제 2: UI 즉시 업데이트 안됨

**사용자 증상**:
- 저장 버튼을 눌러도 화면에 바로 반영되지 않음
- 페이지를 새로고침해야 변경사항을 확인 가능
- 저장이 안된 것처럼 보여서 혼란스러움

**실제 원인**:
- 프론트엔드에서 API로 보낼 때 필드가 누락됨
- 낙관적 업데이트가 배출구/시설에만 적용되고 기본 정보는 제외됨

## 해결 방법

### 1. API 핸들러 수정 - 누락된 필드 추가

**파일**: `app/api/air-permit/route.ts` (lines 233-247)

**Before (수정 전)**:
```typescript
updateData = {
  business_type: rawUpdateData.business_type || null,
  first_report_date: validatedFirstReportDate,
  operation_start_date: validatedOperationStartDate,
  additional_info: { ... }
}
// ❌ green_link_code 없음
// ❌ facility_number 없음
```

**After (수정 후)**:
```typescript
updateData = {
  business_type: rawUpdateData.business_type || null,
  facility_number: rawUpdateData.facility_number || null,  // ✅ 추가
  green_link_code: rawUpdateData.green_link_code || null,  // ✅ 추가
  first_report_date: validatedFirstReportDate,
  operation_start_date: validatedOperationStartDate,
  additional_info: { ... }
}
```

**효과**:
- 이제 그린링크코드와 시설번호가 데이터베이스에 실제로 저장됨
- 최초신고일, 가동개시일도 함께 처리됨

### 2. 프론트엔드 수정 - 저장 시 모든 필드 전송

**파일**: `app/admin/air-permit-detail/page.tsx` (lines 608-622)

**Before (수정 전)**:
```typescript
const basicInfoUpdate = {
  id: permitDetail.id,
  business_type: updatedPermitDetail.business_type,
  additional_info: { ... }
}
// ❌ facility_number 없음
// ❌ green_link_code 없음
// ❌ first_report_date 없음
// ❌ operation_start_date 없음
```

**After (수정 후)**:
```typescript
const basicInfoUpdate = {
  id: permitDetail.id,
  business_type: updatedPermitDetail.business_type,
  facility_number: updatedPermitDetail.facility_number,  // ✅ 추가
  green_link_code: updatedPermitDetail.green_link_code,  // ✅ 추가
  first_report_date: updatedPermitDetail.first_report_date,  // ✅ 추가
  operation_start_date: updatedPermitDetail.operation_start_date,  // ✅ 추가
  additional_info: { ... }
}
```

**효과**:
- 프론트엔드에서 모든 기본 정보 필드를 API로 전송
- 서버가 올바른 데이터를 받을 수 있음

### 3. UI 즉시 업데이트 확인

**파일**: `app/admin/air-permit-detail/page.tsx` (lines 673-679)

기존 코드에 이미 **저장 후 데이터 재로드 로직**이 있음:

```typescript
// 성공 시 최신 데이터 다시 로드 (details=true로 시설 정보도 포함)
const response = await fetch(`/api/air-permit?id=${urlParams.permitId}&details=true`);
if (response.ok) {
  const data = await response.json();
  setPermitDetail(data.data);  // ✅ 상태 업데이트
  setOriginalPermitDetail(data.data);  // ✅ 원본도 업데이트
}
```

**동작 원리**:
1. 저장 완료 후 API를 다시 호출하여 최신 데이터 가져옴
2. `setPermitDetail()`로 화면 상태 업데이트
3. 화면이 즉시 새 데이터로 렌더링됨

## 변경된 파일 목록

### 1. app/api/air-permit/route.ts
**위치**: lines 236-237
**변경 내용**: API 핸들러에 `facility_number`와 `green_link_code` 필드 추가

```typescript
facility_number: rawUpdateData.facility_number || null,
green_link_code: rawUpdateData.green_link_code || null,
```

### 2. app/admin/air-permit-detail/page.tsx
**위치**: lines 614-617
**변경 내용**: 기본 정보 업데이트 시 모든 필드 포함

```typescript
facility_number: updatedPermitDetail.facility_number,
green_link_code: updatedPermitDetail.green_link_code,
first_report_date: updatedPermitDetail.first_report_date,
operation_start_date: updatedPermitDetail.operation_start_date,
```

## 데이터 흐름

### Before (수정 전)

```
사용자 입력:
  업종: 일반
  시설번호: FAC-001
  그린링크코드: GL-123
    ↓
프론트엔드 저장:
  {
    business_type: '일반'
    // ❌ facility_number 누락
    // ❌ green_link_code 누락
  }
    ↓
백엔드 API:
  {
    business_type: '일반'
    // ❌ facility_number 누락
    // ❌ green_link_code 누락
  }
    ↓
데이터베이스:
  업종만 저장됨
  시설번호, 그린링크코드 저장 안됨
    ↓
UI:
  저장 성공 메시지
  하지만 입력값이 화면에 그대로 남아있음 (실제로는 저장 안됨)
```

### After (수정 후)

```
사용자 입력:
  업종: 일반
  시설번호: FAC-001
  그린링크코드: GL-123
    ↓
프론트엔드 저장:
  {
    business_type: '일반'
    facility_number: 'FAC-001'  // ✅ 포함
    green_link_code: 'GL-123'   // ✅ 포함
  }
    ↓
백엔드 API:
  {
    business_type: '일반'
    facility_number: 'FAC-001'  // ✅ 포함
    green_link_code: 'GL-123'   // ✅ 포함
  }
    ↓
데이터베이스:
  모든 필드 정상 저장 ✅
    ↓
데이터 재로드:
  최신 데이터를 API에서 가져옴
    ↓
UI 업데이트:
  저장된 데이터가 즉시 화면에 반영됨 ✅
```

## 사용자 경험 개선

### Before (수정 전)

```
1. 시설번호 "FAC-001" 입력
2. 그린링크코드 "GL-123" 입력
3. 저장 버튼 클릭
4. "저장되었습니다" 알림
5. 입력값이 화면에 그대로 보임 (하지만 실제로는 저장 안됨)
6. 페이지 새로고침
7. ❌ 입력값이 사라짐 (저장이 안되어 있었음!)
8. 사용자: "왜 저장이 안돼?" (혼란)
```

### After (수정 후)

```
1. 시설번호 "FAC-001" 입력
2. 그린링크코드 "GL-123" 입력
3. 저장 버튼 클릭
4. "저장되었습니다" 알림
5. ✅ 입력값이 화면에 즉시 반영됨
6. 페이지 새로고침
7. ✅ 입력값이 그대로 유지됨 (제대로 저장되었음!)
8. 사용자: "저장이 잘 되네!" (만족)
```

## 테스트 시나리오

### 시나리오 1: 기본 정보 저장 및 즉시 반영

**테스트 단계**:
1. 대기필증 상세 페이지 열기
2. 편집모드 활성화
3. 다음 정보 입력:
   - 업종: 일반
   - 시설번호: FAC-2024-001
   - 그린링크코드: GL-12345678
   - 최초신고일: 2024-01-15
   - 가동개시일: 2024-02-01
4. 저장 버튼 클릭

**기대 결과**:
```
✅ "저장되었습니다" 알림 표시
✅ 편집모드 자동 종료 (읽기모드로 전환)
✅ 입력한 모든 값이 화면에 즉시 표시됨
✅ 페이지 새로고침 후에도 값이 유지됨
```

**검증 방법**:
```
# 브라우저 개발자 도구 - 네트워크 탭
PUT /api/air-permit 200 OK

# Request Payload 확인:
{
  "id": "...",
  "business_type": "일반",
  "facility_number": "FAC-2024-001",     // ✅ 있음
  "green_link_code": "GL-12345678",      // ✅ 있음
  "first_report_date": "2024-01-15",     // ✅ 있음
  "operation_start_date": "2024-02-01"   // ✅ 있음
}

# Response 확인:
{
  "message": "대기필증 정보가 성공적으로 업데이트되었습니다",
  "data": {
    "facility_number": "FAC-2024-001",     // ✅ 저장됨
    "green_link_code": "GL-12345678",      // ✅ 저장됨
    ...
  }
}
```

### 시나리오 2: 메모 기능 테스트

**테스트 단계**:
1. 편집모드에서 배출시설 메모 입력: "교체 필요"
2. 방지시설 메모 입력: "정기 점검 완료"
3. 저장 버튼 클릭

**기대 결과**:
```
✅ 메모가 additional_info에 저장됨
✅ 저장 후 메모가 화면에 즉시 표시됨
✅ 편집모드 종료 후에도 메모가 보임
```

**메모 저장 위치**:
```javascript
// discharge_facilities 테이블
{
  id: "...",
  facility_name: "도장시설",
  additional_info: {
    memo: "교체 필요"  // ✅ 여기에 저장
  }
}

// prevention_facilities 테이블
{
  id: "...",
  facility_name: "활성탄 흡착시설",
  additional_info: {
    memo: "정기 점검 완료"  // ✅ 여기에 저장
  }
}
```

### 시나리오 3: 저장 후 UI 즉시 업데이트

**테스트 단계**:
1. 그린링크코드를 "OLD-123"에서 "NEW-456"으로 변경
2. 저장 버튼 클릭
3. **페이지 새로고침 하지 않고** 확인

**기대 결과**:
```
✅ 저장 즉시 화면에 "NEW-456"이 표시됨
✅ 편집모드가 자동으로 종료됨
✅ 읽기모드에서 "NEW-456"이 보임
✅ 페이지 새로고침 후에도 "NEW-456"이 유지됨
```

**검증 로직**:
```javascript
// 1. 저장 API 호출
await fetch('/api/air-permit', { method: 'PUT', ... })

// 2. 최신 데이터 재로드
const response = await fetch(`/api/air-permit?id=${id}&details=true`)
const data = await response.json()

// 3. 상태 업데이트 (즉시 화면 반영)
setPermitDetail(data.data)  // ✅ 이 순간 UI가 업데이트됨
```

## 기술적 세부사항

### 낙관적 업데이트 vs 데이터 재로드

현재 구현에서는 **하이브리드 방식** 사용:

1. **낙관적 업데이트** (배출구/시설):
```typescript
// 즉시 UI 업데이트 (API 응답 대기 안함)
const updatedPermitDetail = { ...permitDetail }
updatedPermitDetail.outlets = updatedPermitDetail.outlets.map(...)
setPermitDetail(updatedPermitDetail)
```

2. **데이터 재로드** (기본 정보):
```typescript
// API 저장 완료 후 최신 데이터 가져오기
await Promise.all(apiCalls)
const response = await fetch(`/api/air-permit?id=${id}&details=true`)
const data = await response.json()
setPermitDetail(data.data)  // 서버 데이터로 덮어쓰기
```

**장점**:
- 낙관적 업데이트: 빠른 사용자 경험
- 데이터 재로드: 서버 데이터와 동기화 보장

### API 응답 데이터 활용

저장 API가 업데이트된 전체 데이터를 반환하므로, 이를 활용할 수도 있음:

```typescript
// 현재: 별도로 GET 요청
const response = await fetch(`/api/air-permit?id=${id}&details=true`)

// 대안: PUT 응답 활용
const putResponse = await fetch('/api/air-permit', { method: 'PUT', ... })
const { data: updatedData } = await putResponse.json()
setPermitDetail(updatedData)  // PUT 응답에서 바로 사용
```

하지만 현재 구현이 더 안전:
- GET은 항상 최신 상태 보장
- PUT 응답이 부분적일 수 있음

## 메모 기능 상세

### 메모 필드 위치
```javascript
// additional_info 안에 저장
{
  facility_name: "도장시설",
  capacity: "100kg/h",
  quantity: 2,
  additional_info: {
    memo: "사용자가 입력한 메모",
    green_link_code: "...",  // 다른 정보들
    facility_number: "..."
  }
}
```

### 메모 입력 UI
```tsx
{isEditing ? (
  <input
    type="text"
    value={editedFacilities[key]?.memo ?? facility.additional_info?.memo || ''}
    onChange={(e) => handleFacilityEdit(outletId, 'discharge', facilityId, 'memo', e.target.value)}
    placeholder="메모"
    className="..."
  />
) : (
  <span>{facility?.additional_info?.memo || '-'}</span>
)}
```

### 메모 저장 로직
```typescript
// handleFacilityEdit 함수에서 처리
const handleFacilityEdit = (outletId, facilityType, facilityId, field, value) => {
  const key = `${outletId}_${facilityType}_${facilityId}`
  setEditedFacilities(prev => ({
    ...prev,
    [key]: {
      ...prev[key],
      [field]: value  // memo 필드 포함
    }
  }))
}

// 저장 시 additional_info로 변환
const additionalInfoFields = ['green_link_code', 'facility_number', 'memo']
const additionalInfo: any = {}

for (const field of additionalInfoFields) {
  if (changes[field] !== undefined) {
    additionalInfo[field] = changes[field]  // memo도 여기 포함됨
  }
}

updateData.additional_info = additionalInfo
```

## 관련 문서

- `claudedocs/air-permit-edit-mode-and-csrf-fix.md` - 편집모드 자동 활성화 및 CSRF 수정
- `app/api/air-permit/route.ts` - 대기필증 API 핸들러
- `app/admin/air-permit-detail/page.tsx` - 대기필증 상세 페이지

## 변경 이력

- 2025-11-04: 저장 필드 누락 문제 수정 및 UI 즉시 반영 확인
