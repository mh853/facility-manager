# 측정기기 저장 후 미표시 버그 수정

## 버그 증상

**문제**: 견적서 미리보기에서 측정기기를 입력하고 저장했는데, 저장은 성공하지만 미리보기에 측정기기가 표시되지 않음

**사용자 보고**: "허가증에 측정기기를 입력했는데, 견적서 미리보기에는 그 내용이 표현이 안되고 있어. 저장성공했는데 db에 저장 안된건지 출력이 안되고 있어."

## 근본 원인 분석

### 문제의 핵심

Preview API와 Generate API에서 `facility_number`를 잘못 설정하여 저장 API와 매칭이 안 되는 문제였습니다.

### 데이터 흐름

1. **프론트엔드**: 사용자가 측정기기 추가/수정
2. **저장 API** (`/api/air-permit/update`):
   - 프론트엔드에서 받은 `facility_number`로 데이터베이스의 시설을 찾음
   - `discharge_facilities.additional_info.measuring_devices` 업데이트
3. **미리보기 API** (`/api/estimates/preview`):
   - 데이터베이스에서 시설 정보 조회
   - `additional_info.measuring_devices` 읽어서 반환

### 버그의 정확한 위치

**Preview API** (`app/api/estimates/preview/route.ts`):
```typescript
// ❌ 잘못된 코드 (BEFORE)
dischargeFacilities.forEach((f, idx) => {
  emission_facilities.push({
    facility_number: idx + 1,  // 배열 인덱스로 덮어씀!
    ...
  })
})
```

**문제점**:
- 데이터베이스의 실제 `facility_number` (예: 1, 3, 5)를 무시
- 배열 인덱스 기반으로 새로 생성 (0→1, 1→2, 2→3)
- 저장 API가 실제 `facility_number`로 찾으려 해도 매칭 안 됨

**예시**:
```
데이터베이스 실제 값:
- 배출시설 1번: facility_number = 1
- 배출시설 2번: facility_number = 3
- 배출시설 3번: facility_number = 5

Preview API가 반환한 값 (잘못됨):
- 배출시설 1번: facility_number = 1 (idx 0 + 1)
- 배출시설 2번: facility_number = 2 (idx 1 + 1)  ❌
- 배출시설 3번: facility_number = 3 (idx 2 + 1)  ❌

저장 API가 찾으려는 값:
- facility_number = 2 → 데이터베이스에 없음! (실제는 3)
- facility_number = 3 → 데이터베이스에 없음! (실제는 5)
```

## 수정 내용

### 1. Preview API 수정

**파일**: `app/api/estimates/preview/route.ts`

**변경 사항**:
```typescript
// ✅ 수정된 코드 (AFTER)
dischargeFacilities.forEach((f) => {
  emission_facilities.push({
    facility_number: f.facility_number || 0,  // 실제 DB 값 사용!
    name: f.facility_name || '',
    capacity: f.capacity || '',
    quantity: f.quantity || 1,
    green_link_code: f.green_link_code || '',
    measuring_devices: f.additional_info?.measuring_devices || []
  })
})

preventionFacilities.forEach((f) => {
  prevention_facilities.push({
    facility_number: f.facility_number || 0,  // 실제 DB 값 사용!
    name: f.facility_name || '',
    capacity: f.capacity || '',
    quantity: f.quantity || 1,
    green_link_code: f.green_link_code || '',
    measuring_devices: f.additional_info?.measuring_devices || []
  })
})
```

**수정 라인**:
- Lines 225-233: 배출시설
- Lines 239-247: 방지시설

### 2. Generate API 수정

**파일**: `app/api/estimates/generate/route.ts`

**변경 사항**: Preview API와 동일한 수정 적용

**수정 라인**:
- Lines 177-185: 배출시설
- Lines 191-199: 방지시설

## 수정 효과

### Before (버그 상태)
```
1. 사용자가 시설 2번에 측정기기 추가
2. 저장 API: facility_number=2 찾기
3. DB에 facility_number=3이 실제 값 → 찾지 못함
4. 저장 실패 (조용히)
5. 미리보기에 측정기기 안 보임
```

### After (수정 후)
```
1. 사용자가 시설 3번에 측정기기 추가
2. 저장 API: facility_number=3 찾기
3. DB에 facility_number=3 → 정확히 매칭!
4. additional_info.measuring_devices 업데이트 성공
5. 미리보기 재로드 시 측정기기 정상 표시
```

## 테스트 시나리오

### 테스트 1: 측정기기 추가
1. 견적서 미리보기 열기
2. "측정기기 편집" 클릭
3. 배출시설에 "전류계 2개" 추가
4. "저장" 클릭
5. ✅ 성공 메시지 확인
6. ✅ 페이지에 "전류계(2개)" 표시 확인

### 테스트 2: 측정기기 수정
1. 편집 모드 진입
2. 기존 측정기기 수량 변경 (2 → 3)
3. "저장" 클릭
4. ✅ 수량이 3개로 업데이트됨 확인

### 테스트 3: 측정기기 삭제
1. 편집 모드 진입
2. 측정기기 "×" 버튼 클릭
3. "저장" 클릭
4. ✅ 측정기기가 사라짐 확인

### 테스트 4: 여러 측정기기 추가
1. 방지시설에 "PH계(1개)", "차압계(2개)" 추가
2. "저장" 클릭
3. ✅ "PH계(1개), 차압계(2개)" 형식으로 표시 확인

## 관련 파일

### 수정된 파일
- `app/api/estimates/preview/route.ts` - Lines 225-233, 239-247
- `app/api/estimates/generate/route.ts` - Lines 177-185, 191-199

### 관련 파일 (수정 없음)
- `app/api/air-permit/update/route.ts` - 저장 로직은 정상
- `app/admin/document-automation/components/EstimatePreviewModal.tsx` - UI는 정상

## 추가 개선 사항

이번 버그 수정 과정에서 발견한 개선 가능한 사항:

1. **API 응답 로깅 강화**:
   - 저장 API에서 매칭되지 않는 facility_number를 로그로 출력
   - 디버깅이 쉬워짐

2. **프론트엔드 에러 핸들링**:
   - 저장 실패 시 구체적인 오류 메시지 표시
   - "일부 시설 업데이트 실패" 등의 상세 정보 제공

3. **데이터 검증**:
   - facility_number가 실제로 존재하는지 사전 검증
   - 존재하지 않는 경우 사용자에게 알림

## 결론

**버그 원인**: Preview/Generate API에서 `facility_number`를 배열 인덱스로 덮어써서 실제 DB 값과 불일치

**해결 방법**: 데이터베이스의 실제 `facility_number` 값을 그대로 사용

**결과**: 측정기기 저장 및 표시가 정상적으로 작동

**영향 범위**:
- 견적서 미리보기 ✅
- 견적서 생성 ✅
- PDF 다운로드 ✅
