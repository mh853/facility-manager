# 대기필증 변경 감지 디버깅 가이드

## 🔍 현재 상황

**증상**: 방지시설에 그린링크 코드 "P0501"을 입력했지만, 저장 시 빈 칸으로 저장됨

**서버 로그 분석**:
```
✅ [DB] getPreventionFacilities 결과: 1개
   - 여과집진시설: green_link_code = ""
```

→ 데이터베이스에 빈 문자열(`""`)로 저장되어 있음

## 🎯 의심 지점

### 1. 입력 필드 → permitDetail 업데이트가 안 되는 경우
- `handleFacilityEdit`가 호출되지 않음
- 또는 `handleFacilityEdit` 내부 로직 오류

### 2. permitDetail 업데이트는 되지만 변경 감지 실패
- `originalPermitDetail`이 `null`
- 또는 `originalPermitDetail`이 이미 업데이트된 값을 가지고 있음

### 3. 변경 감지는 되지만 API 호출 실패
- `changedFacilities` 배열은 생성되지만 API 호출 안 됨

## 📊 추가된 디버깅 로그

### Lines 341-347: findChangedFacilities 진입 로그
```typescript
console.log('🔍 [변경 감지] findChangedFacilities 시작')
console.log('🔍 [변경 감지] original:', original ? '존재' : 'null')
console.log('🔍 [변경 감지] current outlets:', current.outlets?.length)
```

**확인 사항**:
- `original`이 `null`인가?
- `current.outlets` 개수가 맞는가?

### Lines 369-377: 배출시설 상세 비교 로그
```typescript
console.log(`🔍 [배출시설] ${facility.facility_name}:`, {
  nameChanged,
  capacityChanged,
  quantityChanged,
  additionalInfoChanged,
  hasChanged,
  current_additional_info: facility.additional_info,
  original_additional_info: originalFacility.additional_info
})
```

**확인 사항**:
- 각 필드별 변경 여부
- `current_additional_info`와 `original_additional_info` 비교

### Lines 409-417: 방지시설 상세 비교 로그
```typescript
console.log(`🔍 [방지시설] ${facility.facility_name}:`, {
  nameChanged,
  capacityChanged,
  quantityChanged,
  additionalInfoChanged,
  hasChanged,
  current_additional_info: facility.additional_info,
  original_additional_info: originalFacility.additional_info
})
```

## 🧪 테스트 시나리오

### 테스트 1: 입력 필드 동작 확인
```
1. 브라우저 개발자 도구 열기 (F12)
2. Console 탭 선택
3. 방지시설의 그린링크 코드 입력 필드 클릭
4. "P0501" 입력
5. 콘솔 확인:
   - handleFacilityEdit 호출 확인
   - permitDetail 업데이트 확인
```

**예상 로그** (없으면 문제):
```
🔧 [DEBUG] handleFacilityEdit 호출
```

### 테스트 2: 변경 감지 로직 확인
```
1. 그린링크 코드 "P0501" 입력 완료
2. 저장 버튼 클릭
3. 콘솔 확인
```

**예상 로그**:
```
🔍 [변경 감지] findChangedFacilities 시작
🔍 [변경 감지] original: 존재 (또는 null)
🔍 [변경 감지] current outlets: 1
🔍 [방지시설] 여과집진시설: {
  nameChanged: false,
  capacityChanged: false,
  quantityChanged: false,
  additionalInfoChanged: true,  // ← 이것이 true여야 함!
  hasChanged: true,
  current_additional_info: { green_link_code: "P0501", ... },
  original_additional_info: { green_link_code: "", ... }
}
🔄 변경 감지 - 방지시설 여과집진시설 (ID)
📊 총 1개 시설 변경 감지됨
📝 1개 시설 업데이트 진행
```

### 테스트 3: API 호출 확인
```
예상 로그:
✅ 방지시설 업데이트: [facility_id]
```

**네트워크 탭에서 확인**:
- `/api/outlet-facility` PUT 요청
- Request Payload에 `green_link_code: "P0501"` 포함 여부

## 🔧 문제별 해결 방법

### Case 1: originalPermitDetail이 null
**증상**:
```
🔍 [변경 감지] original: null
⚠️ [변경 감지] original이 null이므로 변경 감지 스킵
```

**원인**: 페이지 로드 시 `originalPermitDetail` 초기화 안 됨

**해결**: 데이터 로딩 후 `originalPermitDetail` 설정 확인
```typescript
// useEffect에서 확인
useEffect(() => {
  if (data) {
    setPermitDetail(data)
    setOriginalPermitDetail(data)  // ← 이 줄이 있는지 확인
  }
}, [data])
```

### Case 2: handleFacilityEdit가 호출되지 않음
**증상**: 입력해도 콘솔에 아무 로그도 없음

**원인**: 입력 필드의 `onChange` 핸들러 연결 안 됨

**해결**: 입력 필드 확인
```typescript
<input
  value={facility.additional_info?.green_link_code ?? ''}
  onChange={(e) => handleFacilityEdit(
    outlet.id,
    'prevention',  // ← 타입 확인
    facility.id,
    'green_link_code',  // ← 필드명 확인
    e.target.value
  )}
/>
```

### Case 3: additional_info가 업데이트 안 됨
**증상**:
```
🔍 [방지시설] 여과집진시설: {
  additionalInfoChanged: false,  // ← false!
  current_additional_info: { green_link_code: "" },  // ← 빈 문자열
  original_additional_info: { green_link_code: "" }
}
```

**원인**: `handleFacilityEdit`에서 `additional_info` 업데이트 로직 오류

**해결**: `handleFacilityEdit` 코드 확인 (Line 268-274)

### Case 4: 변경 감지는 되지만 API 호출 안 됨
**증상**:
```
🔄 변경 감지 - 방지시설 여과집진시설
📊 총 1개 시설 변경 감지됨
📝 1개 시설 업데이트 진행
✅ 모든 API 호출 완료  // ← 하지만 실제로는 호출 안 됨
```

**원인**: `apiCalls` 배열에 추가는 되지만 실행 안 됨

**해결**: `Promise.all(apiCalls)` 확인

## 📝 다음 단계

1. ✅ **디버깅 로그 추가 완료**
2. ⏭️ **사용자가 실제 테스트 수행**
3. ⏭️ **콘솔 로그 공유**
4. ⏭️ **로그 분석하여 정확한 원인 파악**
5. ⏭️ **해당 문제 수정**

## 💡 로그 해석 팁

### 정상 케이스
```
🔍 [변경 감지] findChangedFacilities 시작
🔍 [변경 감지] original: 존재
🔍 [변경 감지] current outlets: 1
🔍 [방지시설] 여과집진시설: {
  additionalInfoChanged: true,
  hasChanged: true,
  current_additional_info: { green_link_code: "P0501" },
  original_additional_info: { green_link_code: "" }
}
🔄 변경 감지 - 방지시설 여과집진시설
📊 총 1개 시설 변경 감지됨
📝 1개 시설 업데이트 진행
```

### 비정상 케이스 1: original이 null
```
🔍 [변경 감지] findChangedFacilities 시작
🔍 [변경 감지] original: null  // ← 문제!
⚠️ [변경 감지] original이 null이므로 변경 감지 스킵
📊 총 0개 시설 변경 감지됨
```

### 비정상 케이스 2: 변경이 감지되지 않음
```
🔍 [변경 감지] findChangedFacilities 시작
🔍 [변경 감지] original: 존재
🔍 [방지시설] 여과집진시설: {
  additionalInfoChanged: false,  // ← 문제!
  hasChanged: false,
  current_additional_info: { green_link_code: "" },  // ← 여전히 빈 문자열
  original_additional_info: { green_link_code: "" }
}
📊 총 0개 시설 변경 감지됨
```

## 🎯 결론

디버깅 로그를 추가했으므로:
1. 다시 테스트 수행
2. 브라우저 콘솔 로그 전체 복사
3. 로그를 공유하면 정확한 원인 파악 가능

특히 다음 로그들을 확인:
- `🔍 [변경 감지] original:` → null인지 확인
- `🔍 [방지시설] 여과집진시설:` → current vs original 비교
- `additionalInfoChanged` → true인지 확인
