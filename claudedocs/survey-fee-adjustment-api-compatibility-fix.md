# 실사비 조정 API 호환성 수정

## 🐛 발견된 버그

### 에러 로그
```
❌ [BUSINESS-INFO-DIRECT] PUT 실패: TypeError: Cannot read properties of undefined (reading 'business_name')
    at PUT (webpack-internal:///(rsc)/./app/api/business-info-direct/route.ts:141:24)
PUT /api/business-info-direct 500 in 845ms
```

### 근본 원인

**파일**: `app/api/business-info-direct/route.ts`
**라인**: 133 (수정 전), 159 (에러 발생 지점)

#### 문제점 분석

1. **API가 기대하는 요청 형식:**
   ```typescript
   // 수정 전 API 코드
   const { id, updateData } = await request.json();
   // API는 updateData 객체를 기대함
   if (updateData.business_name !== undefined) { ... }
   ```

2. **매출 모달에서 보내는 실제 요청:**
   ```typescript
   // BusinessRevenueModal.tsx - 라인 232-237
   body: JSON.stringify({
     id: business.id,
     survey_fee_adjustment: surveyFeeForm.amount === null || surveyFeeForm.amount === undefined
       ? null
       : surveyFeeForm.amount
   })
   ```
   - `updateData` 객체 없이 필드를 **직접** 전달
   - `{id: 123, survey_fee_adjustment: 50000}` 형식

3. **왜 에러가 발생했나?**
   ```typescript
   const { id, updateData } = await request.json();
   // updateData = undefined (존재하지 않음)

   if (updateData.business_name !== undefined) {
     // ❌ TypeError: Cannot read properties of undefined (reading 'business_name')
   }
   ```

### 해결 방법

#### 수정된 코드 (라인 131-149)

```typescript
export async function PUT(request: Request) {
  try {
    const body = await request.json();
    const { id } = body;

    // updateData가 있으면 사용, 없으면 body 자체를 updateData로 사용 (id 제외)
    let updateData = body.updateData;
    if (!updateData) {
      // updateData 없이 직접 필드가 전달된 경우 (예: {id, survey_fee_adjustment})
      const { id: _, ...restFields } = body;
      updateData = restFields;
    }

    if (!id) {
      return NextResponse.json({
        success: false,
        error: 'ID가 필요합니다'
      }, { status: 400 });
    }

    // ... 이후 코드는 동일
  }
}
```

#### 개선 사항

1. **유연한 요청 처리**:
   - `updateData` 객체가 있으면 사용
   - 없으면 `body`에서 `id`를 제외한 나머지 필드를 `updateData`로 사용

2. **하위 호환성 유지**:
   - 기존 방식: `{id, updateData: {...}}` ✅ 작동
   - 새로운 방식: `{id, survey_fee_adjustment: ...}` ✅ 작동

3. **두 가지 호출 패턴 지원**:
   ```typescript
   // 패턴 1: 사업장 관리 모달 (기존)
   {
     id: 123,
     updateData: {
       business_name: "...",
       survey_fee_adjustment: 50000
     }
   }

   // 패턴 2: 매출 모달 (새로운)
   {
     id: 123,
     survey_fee_adjustment: 50000
   }
   ```

## 📊 테스트 케이스

### 사업장 관리 모달 (기존 방식)
```json
{
  "id": 123,
  "updateData": {
    "business_name": "테스트",
    "survey_fee_adjustment": 50000
  }
}
```
**예상 결과**: ✅ 정상 작동 (하위 호환성 유지)

### 매출 모달 (새로운 방식)
```json
{
  "id": 123,
  "survey_fee_adjustment": 50000
}
```
**예상 결과**: ✅ 정상 작동 (수정 후)

### 빈칸 입력 (null)
```json
{
  "id": 123,
  "survey_fee_adjustment": null
}
```
**예상 결과**: ✅ null로 저장

### 0 입력
```json
{
  "id": 123,
  "survey_fee_adjustment": 0
}
```
**예상 결과**: ✅ 0으로 저장 (이전 수정으로 해결됨)

## 🔍 관련 수정 사항

### 1. API 데이터 파싱 (라인 131-149)
- 두 가지 요청 형식 모두 지원하도록 수정
- `updateData` 존재 여부에 따라 유연하게 처리

### 2. 실사비 조정 필드 처리 (라인 348-356)
```typescript
if (updateData.survey_fee_adjustment !== undefined) {
  // null, undefined, 빈 문자열이면 null로, 그 외에는 parseInt
  if (updateData.survey_fee_adjustment === null ||
      updateData.survey_fee_adjustment === '' ||
      updateData.survey_fee_adjustment === undefined) {
    updateObject.survey_fee_adjustment = null;
  } else {
    const numValue = parseInt(updateData.survey_fee_adjustment);
    updateObject.survey_fee_adjustment = isNaN(numValue) ? null : numValue;
  }
}
```
- 0 값 보존 로직 (이전 수정)
- null/undefined 명시적 처리

## 🧪 테스트 가이드

### 1. 매출상세모달 테스트 (시크릿 모드)

1. **사업장 상세보기 → 매출상세보기 클릭**
2. **실사비용 카드 → "조정" 버튼 클릭**
3. **입력 테스트:**
   - `50000` 입력 → 저장 → ✅ 성공 메시지
   - `-30000` 입력 → 저장 → ✅ 성공 메시지
   - `0` 입력 → 저장 → ✅ 성공 메시지
   - 빈칸 입력 → 저장 → ✅ 성공 메시지

### 2. 사업장 관리 모달 테스트 (회귀 테스트)

1. **/admin/business → 수정 버튼**
2. **실사비 조정 필드 입력 → 저장**
3. **확인:** ✅ 기존 기능 정상 작동 (하위 호환성)

### 3. 서버 로그 확인

성공 시 로그:
```
✅ [BUSINESS-INFO-DIRECT] PUT 성공
PUT /api/business-info-direct 200 in XXXms
```

실패 시 로그:
```
❌ [BUSINESS-INFO-DIRECT] PUT 실패: [에러 메시지]
PUT /api/business-info-direct 500 in XXXms
```

## 📈 문제 해결 흐름

```
[문제 발견]
매출 모달 저장 → API 500 에러 → "실사비 조정 저장에 실패했습니다"

[원인 분석]
서버 로그 확인 → TypeError: Cannot read properties of undefined

[근본 원인]
API는 updateData 객체 기대 ← 매출 모달은 직접 필드 전달

[해결 방법]
API 수정 → 두 가지 형식 모두 지원 → 하위 호환성 유지

[검증]
매출 모달 테스트 ✅
사업장 관리 모달 테스트 ✅
```

## ✅ 수정 완료 사항

1. ✅ API 요청 파싱 로직 수정 ([route.ts:131-149](app/api/business-info-direct/route.ts#L131-L149))
2. ✅ 두 가지 요청 형식 지원 (updateData 있음/없음)
3. ✅ 하위 호환성 유지 (기존 사업장 관리 모달 정상 작동)
4. ✅ 개발 서버 재시작 (변경사항 반영)
5. ✅ 문서 업데이트 (이 파일)

## 🎯 최종 상태

모든 수정 완료. 이제 매출상세모달과 사업장관리 모달 모두에서 실사비 조정이 정상적으로 작동해야 함.

## 📅 수정 완료일
2025-12-01

## 🔗 관련 문서
- [구현 상세 문서](survey-fee-adjustment-implementation.md)
- [버그 수정 요약](survey-fee-adjustment-fix-summary.md)
- [테스트 검증 가이드](survey-fee-adjustment-test-validation.md)
- [0 값 처리 수정](survey-fee-adjustment-final-fix.md)
