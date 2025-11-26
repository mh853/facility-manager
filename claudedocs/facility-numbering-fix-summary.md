# 시설 번호 표시 오류 수정 완료

## 문제 상황

사용자 보고:
- 스크린샷 1: "배5-1, 배5-2, 배5-3" 이렇게 표시되어야 하는데, 올바른 표시는 "배2, 배3, 배4"여야 함
- 스크린샷 2: "배26-1, 배26-2" 이렇게 표시되어야 하는데, 올바른 표시는 "배5, 배6"이어야 함

### 근본 원인

시설의 `quantity > 1`인 경우, 각 개별 시설마다 고유한 연속 번호가 할당되어야 하지만, 프론트엔드 렌더링 로직이 하나의 시설 번호에 인스턴스 인덱스를 suffix로 추가하는 방식("배5-1", "배5-2")으로 동작하고 있었음.

## 수정 내용

### 1. `facilityNumberMap` 구조 변경 (lines 141-180)

**변경 전:**
```typescript
const map = new Map<string, number>(); // 시설당 하나의 번호만 저장
```

**변경 후:**
```typescript
const map = new Map<string, number[]>(); // 시설당 quantity별 번호 배열로 저장
```

**로직 개선:**
- `dischargeFacilities`와 `preventionFacilities`를 순회하면서 같은 시설(key)에 대한 모든 번호를 배열로 수집
- 예: `quantity: 4`인 "선별시설"의 경우 → `[5, 6, 7, 8]` 형태로 저장

### 2. `getCorrectFacilityNumber` 함수 수정 (lines 182-202)

**변경 전:**
```typescript
const getCorrectFacilityNumber = useCallback((
  facilityType: 'discharge' | 'prevention',
  facility: Facility
): number => {
  // ... 하나의 번호만 반환
}
```

**변경 후:**
```typescript
const getCorrectFacilityNumber = useCallback((
  facilityType: 'discharge' | 'prevention',
  facility: Facility,
  quantityIndex: number = 0 // 🔧 quantityIndex 파라미터 추가
): number => {
  const numbers = facilityNumberMap.get(key)!;
  // 🔧 quantityIndex에 해당하는 번호 반환
  if (quantityIndex >= 0 && quantityIndex < numbers.length) {
    return numbers[quantityIndex];
  }
}
```

### 3. 렌더링 로직 업데이트

**방지시설 (line 1684):**
```typescript
const correctNumber = getCorrectFacilityNumber('prevention', facility, quantityIndex);
```

**배출시설 (line 1741):**
```typescript
const correctNumber = getCorrectFacilityNumber('discharge', facility, quantityIndex);
```

## 동작 원리

### 예시: 건조시설 (quantity: 4, capacity: 30 m³)

**utils/facility-numbering.ts의 생성 로직:**
```typescript
for (let i = 0; i < facility.quantity; i++) {
  facilityNumbers.set(`${facility.id}_${i}`, currentNumber++)
}
// quantity: 4 → 배2, 배3, 배4, 배5 생성
```

**변경 전 프론트엔드 (잘못된 동작):**
```typescript
getCorrectFacilityNumber('discharge', facility) // → 항상 배5 반환
// Array.from로 4번 반복
// 결과: 배5-1, 배5-2, 배5-3, 배5-4 (❌ 잘못됨)
```

**변경 후 프론트엔드 (올바른 동작):**
```typescript
// facilityNumberMap에 저장된 값: [2, 3, 4, 5]
getCorrectFacilityNumber('discharge', facility, 0) // → 배2
getCorrectFacilityNumber('discharge', facility, 1) // → 배3
getCorrectFacilityNumber('discharge', facility, 2) // → 배4
getCorrectFacilityNumber('discharge', facility, 3) // → 배5
// 결과: 배2, 배3, 배4, 배5 (✅ 올바름)
```

## 영향 범위

### 수정된 파일
- [components/ImprovedFacilityPhotoSection.tsx](../components/ImprovedFacilityPhotoSection.tsx)
  - Lines 141-180: `facilityNumberMap` 생성 로직
  - Lines 182-202: `getCorrectFacilityNumber` 함수
  - Line 1684: 방지시설 렌더링
  - Line 1741: 배출시설 렌더링

### 영향받지 않는 부분
- [utils/facility-numbering.ts](../utils/facility-numbering.ts): 이미 올바르게 동작 중
- [app/api/facilities-supabase/[businessName]/route.ts](../app/api/facilities-supabase/[businessName]/route.ts): null 보정 로직은 별도 문제

## 검증 방법

1. `http://localhost:3000/business/안계농협 미곡종합처리장(비안면)` 접속
2. 배출구 2의 "건조시설 30 m³" (quantity: 4) 확인
   - **기대 결과**: 배2, 배3, 배4, 배5 표시
   - **이전 오류**: 배5-1, 배5-2, 배5-3, 배5-4 표시
3. 배출구 3의 "선별시설 2.2kW" (quantity: 4) 확인
   - **기대 결과**: 배6, 배7, 배8, 배9 표시
   - **이전 오류**: 배26-1, 배26-2, 배26-3, 배26-4 표시

## 참고 사항

- 이 수정은 **프론트엔드 렌더링 로직**만 수정한 것
- API에서 반환하는 `facility.number`가 여전히 `null`인 문제는 별도로 해결되어야 함
- `generateFacilityNumbering` 유틸리티는 이미 올바르게 동작하고 있었음

## 작업 일시

- 수정 완료: 2025-11-26
- 파일: components/ImprovedFacilityPhotoSection.tsx
- 커밋 전 테스트 필요
