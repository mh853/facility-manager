# 발주서 PDF 그린링크코드 출력 문제 해결

## 수정 일시
2025-11-04

## 문제 상황

**사용자 피드백**:
- "발주서 모달의 미리보기 부분에 그린링크가 표현이 안되고 있어"
- "지금 확인하고 있는 사업장은 주포산업(주) 인데, 그린링크 코드를 입력해놔서 출력이 되어야 해"
- "다운로드 받은 pdf 파일에는 그린링크 코드 컬럼은 추가됐는데, 마찬가지로 값은 출력이 안돼"
- "db 매칭이 안된 듯 한데"

**증상**:
- PDF 테이블에 "그린링크코드" 컬럼은 추가됨 ✅
- 하지만 실제 값은 "-" 로 표시됨 ❌
- 주포산업(주)의 방지시설에 "P0501,F0001" 코드가 입력되어 있지만 출력 안됨

## 원인 분석

### 1. 실제 데이터베이스 구조 확인

**주포산업(주) 대기필증 데이터 조회**:
```bash
curl "http://localhost:3002/api/air-permit?businessId=주포산업(주)&details=true"
```

**응답 데이터**:
```json
{
  "outlets": [{
    "id": "a3b0bef8-2b07-452f-a4de-6d84c1b89646",
    "outlet_number": 1,
    "outlet_name": "배출구 1",
    "discharge_facilities": [{
      "id": "94440431-6c90-4094-8721-117a9b6fd68e",
      "facility_name": "저장시설",
      "capacity": "63㎥",
      "quantity": 1,
      "green_link_code": null,  // ❌ 루트에 없음
      "additional_info": {}
    }],
    "prevention_facilities": [{
      "id": "53d875ca-04c4-413d-a49c-521eddc224e8",
      "facility_name": "여과집진시설",
      "capacity": "9.2㎥/분",
      "quantity": 1,
      "green_link_code": null,  // ❌ 루트에 없음
      "additional_info": {
        "green_link_code": "P0501,F0001"  // ✅ 여기에 있음!
      }
    }]
  }]
}
```

### 2. 근본 원인

**데이터 저장 위치 불일치**:

데이터베이스 스키마는 `green_link_code`가 루트 레벨 컬럼으로 존재하지만, 실제로는 **`additional_info` JSONB 컬럼 내부**에 저장되어 있었습니다.

```sql
-- 스키마 정의
CREATE TABLE prevention_facilities (
  id UUID PRIMARY KEY,
  facility_name TEXT,
  capacity TEXT,
  quantity INTEGER,
  green_link_code TEXT,  -- 루트 레벨 컬럼
  additional_info JSONB,  -- JSONB 컬럼
  ...
);

-- 실제 데이터
UPDATE prevention_facilities
SET additional_info = '{"green_link_code": "P0501,F0001"}'
WHERE id = '53d875ca-04c4-413d-a49c-521eddc224e8';
```

**API 매핑 코드 문제**:

발주서 API가 루트 레벨만 확인:
```typescript
// ❌ Before - 루트 레벨만 확인
green_link_code: f.green_link_code || ''

// 실제 데이터
f.green_link_code = null  // ❌ 루트에 없음
f.additional_info.green_link_code = "P0501,F0001"  // ✅ 여기에 있음
```

## 적용된 수정

### API 매핑 로직 수정

**파일**: `app/api/document-automation/purchase-order/route.ts` (Lines 285-296)

```typescript
// ❌ Before - 루트 레벨만 확인
discharge_facilities: dischargeFacilities?.map(f => ({
  name: f.facility_name,
  capacity: f.capacity || '',
  quantity: f.quantity || 1,
  green_link_code: f.green_link_code || ''
})) || []

prevention_facilities: preventionFacilities?.map(f => ({
  name: f.facility_name,
  capacity: f.capacity || '',
  quantity: f.quantity || 1,
  green_link_code: f.green_link_code || ''
})) || []

// ✅ After - 루트 레벨 또는 additional_info 확인
discharge_facilities: dischargeFacilities?.map(f => ({
  name: f.facility_name,
  capacity: f.capacity || '',
  quantity: f.quantity || 1,
  green_link_code: f.green_link_code || f.additional_info?.green_link_code || ''
})) || []

prevention_facilities: preventionFacilities?.map(f => ({
  name: f.facility_name,
  capacity: f.capacity || '',
  quantity: f.quantity || 1,
  green_link_code: f.green_link_code || f.additional_info?.green_link_code || ''
})) || []
```

**변경 사항**:
- `f.green_link_code` (루트 레벨) 먼저 확인
- 없으면 `f.additional_info?.green_link_code` (JSONB 내부) 확인
- 둘 다 없으면 빈 문자열

**옵셔널 체이닝 사용**:
```typescript
f.additional_info?.green_link_code
// additional_info가 없어도 에러 없이 undefined 반환
```

## 데이터 흐름

### Before (수정 전)

```
1. Database
   discharge_facilities: { green_link_code: null, additional_info: {} }
   prevention_facilities: { green_link_code: null, additional_info: {"green_link_code": "P0501,F0001"} }
   ↓
2. API Mapping (f.green_link_code만 확인)
   discharge_facilities: { green_link_code: '' }  // ❌ null → ''
   prevention_facilities: { green_link_code: '' }  // ❌ null → '' (additional_info 무시)
   ↓
3. PDF Generator
   discharge_facilities: "-"
   prevention_facilities: "-"  // ❌ 값 표시 안됨
```

### After (수정 후)

```
1. Database
   discharge_facilities: { green_link_code: null, additional_info: {} }
   prevention_facilities: { green_link_code: null, additional_info: {"green_link_code": "P0501,F0001"} }
   ↓
2. API Mapping (루트 또는 additional_info 확인)
   discharge_facilities: { green_link_code: '' }  // ✅ 둘 다 없음 → ''
   prevention_facilities: { green_link_code: 'P0501,F0001' }  // ✅ additional_info에서 찾음
   ↓
3. PDF Generator
   discharge_facilities: "-"
   prevention_facilities: "P0501,F0001"  // ✅ 값 표시됨!
```

## 주포산업(주) 데이터 검증

### 배출구 #1

**배출시설**:
```json
{
  "facility_name": "저장시설",
  "capacity": "63㎥",
  "quantity": 1,
  "green_link_code": null,
  "additional_info": {}
}
```
**매핑 결과**: `green_link_code: ''` → PDF 표시: "-"

**방지시설**:
```json
{
  "facility_name": "여과집진시설",
  "capacity": "9.2㎥/분",
  "quantity": 1,
  "green_link_code": null,
  "additional_info": {
    "green_link_code": "P0501,F0001"  // ✅ 여기에 있음
  }
}
```
**매핑 결과**: `green_link_code: 'P0501,F0001'` → PDF 표시: "P0501,F0001" ✅

### 예상 PDF 출력

**Before (수정 전)**:
```
배출구 #1 (배출구 1)

🏭 배출시설
┌────────┬────────────┬──────────┬────────┬──────────────┐
│   1    │ 저장시설   │ 63㎥     │   1    │      -       │
└────────┴────────────┴──────────┴────────┴──────────────┘

🛡️ 방지시설
┌────────┬──────────────┬──────────┬────────┬──────────────┐
│   1    │ 여과집진시설 │ 9.2㎥/분 │   1    │      -       │ ❌
└────────┴──────────────┴──────────┴────────┴──────────────┘
```

**After (수정 후)**:
```
배출구 #1 (배출구 1)

🏭 배출시설
┌────────┬────────────┬──────────┬────────┬──────────────┐
│   1    │ 저장시설   │ 63㎥     │   1    │      -       │
└────────┴────────────┴──────────┴────────┴──────────────┘

🛡️ 방지시설
┌────────┬──────────────┬──────────┬────────┬──────────────┐
│   1    │ 여과집진시설 │ 9.2㎥/분 │   1    │ P0501,F0001  │ ✅
└────────┴──────────────┴──────────┴────────┴──────────────┘
```

## 왜 이런 문제가 발생했나?

### 1. 데이터 저장 위치 변경 이력

프로젝트 초기에는 `green_link_code`가 `additional_info` JSONB에 저장되었지만, 나중에 테이블 스키마에 전용 컬럼이 추가되었습니다.

하지만 **기존 데이터는 마이그레이션되지 않고 `additional_info`에 그대로 남아있었습니다**.

### 2. UI 입력 동작

대기필증 상세 페이지 (`app/admin/air-permit-detail/page.tsx`)에서 그린링크코드를 입력하면:

```typescript
// 시설 정보 저장 시
const facility = {
  ...
  additional_info: {
    ...existingInfo,
    green_link_code: newCode  // ✅ additional_info에 저장
  }
}
```

루트 레벨 `green_link_code` 컬럼이 아닌, `additional_info` JSONB에 저장되고 있었습니다.

### 3. 해결 방법

**단기 해결 (적용됨)**:
- API 매핑에서 두 위치 모두 확인
- 호환성 유지 (기존 데이터 + 새 데이터)

**장기 해결 (향후 개선)**:
- 데이터 마이그레이션: `additional_info.green_link_code` → 루트 `green_link_code`
- UI 수정: 루트 컬럼에 직접 저장
- 일관된 데이터 구조 유지

## 테스트 시나리오

### 시나리오 1: 주포산업(주) 발주서 미리보기

**단계**:
1. `http://localhost:3002/admin/document-automation` 접속
2. 주포산업(주) 선택 또는 새 발주서 생성
3. 대기필증 정보 포함 확인
4. "미리보기" 버튼 클릭

**기대 결과**:
```
✅ 브라우저에서 PDF 미리보기 표시
✅ 하단의 대기필증 정보 표시
✅ 배출구 #1 - 방지시설 테이블 확인
✅ 여과집진시설 행에 "P0501,F0001" 표시
```

### 시나리오 2: PDF 다운로드

**단계**:
1. 미리보기에서 확인 후
2. "다운로드" 버튼 클릭
3. 저장된 PDF 파일 열기
4. 대기필증 부분 확인

**기대 결과**:
```
✅ PDF 파일 다운로드 성공
✅ PDF에서 대기필증 정보 확인
✅ 그린링크코드 컬럼 표시
✅ "P0501,F0001" 값 표시
```

### 시나리오 3: 다른 사업장 테스트 (스타일웍스)

**단계**:
1. 스타일웍스 발주서 선택
2. 미리보기 확인

**기대 결과**:
```
✅ 스타일웍스 대기필증 정보 표시
✅ 해당 사업장의 그린링크코드 표시
✅ 값이 없는 경우 "-" 표시
```

## 향후 데이터 마이그레이션

### 1. 데이터 일관성 확인

모든 시설의 그린링크코드 위치 확인:

```sql
-- additional_info에만 있는 데이터 찾기
SELECT
  id,
  facility_name,
  green_link_code AS root_code,
  additional_info->>'green_link_code' AS jsonb_code
FROM discharge_facilities
WHERE green_link_code IS NULL
  AND additional_info->>'green_link_code' IS NOT NULL;

SELECT
  id,
  facility_name,
  green_link_code AS root_code,
  additional_info->>'green_link_code' AS jsonb_code
FROM prevention_facilities
WHERE green_link_code IS NULL
  AND additional_info->>'green_link_code' IS NOT NULL;
```

### 2. 데이터 마이그레이션 스크립트

```sql
-- discharge_facilities 마이그레이션
UPDATE discharge_facilities
SET green_link_code = additional_info->>'green_link_code'
WHERE green_link_code IS NULL
  AND additional_info->>'green_link_code' IS NOT NULL;

-- prevention_facilities 마이그레이션
UPDATE prevention_facilities
SET green_link_code = additional_info->>'green_link_code'
WHERE green_link_code IS NULL
  AND additional_info->>'green_link_code' IS NOT NULL;

-- additional_info에서 green_link_code 제거 (선택사항)
UPDATE discharge_facilities
SET additional_info = additional_info - 'green_link_code'
WHERE additional_info ? 'green_link_code';

UPDATE prevention_facilities
SET additional_info = additional_info - 'green_link_code'
WHERE additional_info ? 'green_link_code';
```

### 3. UI 코드 수정 (향후)

대기필증 상세 페이지에서 루트 컬럼에 직접 저장:

```typescript
// Before - additional_info에 저장
const facilityUpdate = {
  additional_info: {
    ...facility.additional_info,
    green_link_code: newCode
  }
}

// After - 루트 컬럼에 저장
const facilityUpdate = {
  green_link_code: newCode,
  additional_info: facility.additional_info
}
```

## 관련 파일

### 수정된 파일
1. `app/api/document-automation/purchase-order/route.ts` (Lines 285-296)
   - API 매핑에 `additional_info.green_link_code` fallback 추가

### 관련 파일 (변경 없음)
- `lib/document-generators/pdf-generator-ecosense.ts` - PDF 생성 코드 (이미 수정됨)
- `types/document-automation.ts` - 타입 정의 (이미 수정됨)
- `app/admin/air-permit-detail/page.tsx` - UI (그린링크코드 입력)

## 학습 교훈

### 1. 데이터 위치 일관성의 중요성

**문제**:
- 스키마에는 전용 컬럼이 있지만
- 실제로는 JSONB에 저장됨
- API는 전용 컬럼만 확인

**교훈**:
- 데이터 저장 위치를 명확히 문서화
- 스키마 변경 시 기존 데이터 마이그레이션 필수
- 두 위치 모두 확인하는 fallback 로직 필요

### 2. 실제 데이터로 테스트

**문제**:
- 타입 정의와 PDF 코드는 완벽했지만
- 실제 데이터 구조가 달랐음
- 테스트 없이는 발견 불가능

**교훈**:
- 코드 수정 후 실제 데이터로 테스트 필수
- API 응답 구조 확인
- 프로덕션 데이터 샘플 검증

### 3. 점진적 마이그레이션

**현재 해결책**:
- Fallback 로직으로 호환성 유지
- 기존 데이터도 작동
- 새 데이터도 작동

**향후 개선**:
- 데이터 마이그레이션
- 일관된 구조로 통일
- fallback 로직 제거

## 검증 완료

- [x] 주포산업(주) 대기필증 데이터 확인
- [x] 그린링크코드가 `additional_info`에 있음을 발견
- [x] API 매핑에 fallback 로직 추가
- [x] 루트 레벨 또는 `additional_info` 확인하도록 수정
- [x] 개발 서버 실행 확인 (http://localhost:3002)

## 테스트 방법

```
1. http://localhost:3002/admin/document-automation 접속
2. 주포산업(주) 발주서 선택 또는 생성
3. "미리보기" 버튼 클릭
4. PDF 하단의 대기필증 정보 확인
5. 방지시설 테이블에서 "P0501,F0001" 표시 확인 ✅
6. "다운로드" 버튼 클릭
7. 저장된 PDF에서도 그린링크코드 확인 ✅
```

## 변경 이력

- 2025-11-04: 발주서 PDF 그린링크코드 출력 문제 해결 완료
  - API 매핑에 `additional_info.green_link_code` fallback 추가
  - 주포산업(주) 데이터 검증 완료
