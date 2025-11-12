# 영업비용 조정 수정/삭제 기능 안정화 작업

## 📅 작업 일자
2025-11-10

## 🎯 작업 목표
영업비용 조정(Operating Cost Adjustment) 기능의 수정 및 삭제가 안정적으로 작동하도록 개선

## 🔍 발견된 문제점

### 1. 상태 관리 문제
- **위치**: `components/business/BusinessRevenueModal.tsx`
- **증상**: 수정/삭제 후 UI가 제대로 업데이트되지 않음
- **원인**:
  - API 응답 후 `calculatedData` 상태가 제대로 갱신되지 않음
  - 폼 상태가 조정 데이터 변경 시 일관되게 초기화되지 않음

### 2. 에러 처리 부족
- **위치**: Modal 핸들러 및 API 라우트
- **증상**: 실패 시 상세 원인을 알 수 없음
- **원인**:
  - 에러 메시지가 불명확
  - 디버깅 로그 부족

### 3. API 검증 로직 부재
- **위치**: `app/api/revenue/operating-cost-adjustment/route.ts`
- **증상**: PUT/DELETE 요청 시 데이터 존재 여부 미확인
- **원인**:
  - 수정/삭제 전 기존 데이터 확인 단계 누락
  - 잘못된 HTTP 메서드 사용 시 혼란스러운 에러 메시지

## ✅ 적용된 수정 사항

### 1. Modal 상태 관리 개선 (`BusinessRevenueModal.tsx`)

#### 변경 1: 폼 초기화 로직 추가
```typescript
// 기존: 조정이 있을 때만 폼 업데이트
useEffect(() => {
  if (calculatedData?.operating_cost_adjustment) {
    const adj = calculatedData.operating_cost_adjustment;
    setAdjustmentForm({...});
  }
}, [calculatedData?.operating_cost_adjustment]);

// 개선: 조정이 없을 때도 폼 초기화
useEffect(() => {
  if (calculatedData?.operating_cost_adjustment) {
    const adj = calculatedData.operating_cost_adjustment;
    setAdjustmentForm({...});
  } else {
    // 조정이 없으면 폼 초기화
    setAdjustmentForm({ amount: 0, type: 'add', reason: '' });
  }
}, [calculatedData?.operating_cost_adjustment]);
```

#### 변경 2: 저장 핸들러 개선
**추가된 기능:**
- 금액 유효성 검증 추가 (0보다 큰 값만 허용)
- 상세 로깅 추가 (저장 시작, API 응답, 상태 업데이트)
- 구체적인 에러 메시지
- 재계산 실패 시에도 사용자에게 명확한 안내

```typescript
// 금액 유효성 검증
if (adjustmentForm.amount <= 0) {
  alert('조정 금액은 0보다 커야 합니다.');
  return;
}

// 로깅 추가
console.log('🔄 [ADJUSTMENT] 저장 시작:', { method, hasExisting, business_id, amount });
console.log('📥 [ADJUSTMENT] 저장 응답:', data);
console.log('✅ [ADJUSTMENT] calculatedData 업데이트 완료:', calculatedData);
```

#### 변경 3: 삭제 핸들러 개선
**추가된 기능:**
- 삭제 전 더 명확한 확인 메시지
- 상세 로깅 추가
- 삭제 후 상태 확인
- 구체적인 에러 메시지

```typescript
if (!confirm('영업비용 조정을 삭제하시겠습니까?\n\n삭제 후 영업비용은 기본 계산 방식으로 돌아갑니다.')) return;

console.log('🗑️ [ADJUSTMENT] 삭제 시작:', { business_id });
console.log('📥 [ADJUSTMENT] 삭제 응답:', data);
console.log('✅ [ADJUSTMENT] 삭제 후 calculatedData 업데이트 완료:', calculatedData);
```

### 2. API 검증 로직 강화 (`route.ts`)

#### PUT 엔드포인트 개선
**추가된 기능:**
- 수정 전 기존 조정 값 존재 여부 확인
- 존재하지 않을 경우 404 반환 및 POST 사용 안내
- `updated_at` 타임스탬프 명시적 업데이트
- 에러 메시지에 상세 정보 포함

```typescript
// 기존 조정 값이 있는지 먼저 확인
const { data: existingAdjustment, error: checkError } = await supabaseAdmin
  .from('operating_cost_adjustments')
  .select('id')
  .eq('business_id', business_id)
  .single();

if (!existingAdjustment) {
  console.warn('⚠️ [OPERATING-COST-ADJ] 수정할 조정 값이 없음. POST 사용 필요:', business_id);
  return NextResponse.json({
    success: false,
    message: '수정할 조정 값이 없습니다. 새로 생성해주세요.'
  }, { status: 404 });
}

// 조정 값 수정 시 updated_at 명시적 업데이트
.update({
  adjustment_amount,
  adjustment_reason,
  adjustment_type,
  updated_by: userId,
  updated_at: new Date().toISOString()  // 추가
})
```

#### DELETE 엔드포인트 개선
**추가된 기능:**
- 삭제 전 조정 값 존재 여부 확인
- 존재하지 않을 경우 404 반환
- 삭제된 조정 ID 로깅
- 에러 메시지에 상세 정보 포함

```typescript
// 삭제할 조정 값이 있는지 먼저 확인
const { data: existingAdjustment, error: checkError } = await supabaseAdmin
  .from('operating_cost_adjustments')
  .select('id')
  .eq('business_id', businessId)
  .single();

if (!existingAdjustment) {
  console.warn('⚠️ [OPERATING-COST-ADJ] 삭제할 조정 값이 없음:', businessId);
  return NextResponse.json({
    success: false,
    message: '삭제할 조정 값이 없습니다.'
  }, { status: 404 });
}

console.log('✅ [OPERATING-COST-ADJ] 삭제 완료:', {
  business_id: businessId,
  adjustment_id: existingAdjustment.id
});
```

## 🔧 수정된 파일 목록

1. **`components/business/BusinessRevenueModal.tsx`**
   - 라인 82-94: 폼 초기화 로직 개선
   - 라인 96-171: 저장 핸들러 강화 (검증, 로깅, 에러 처리)
   - 라인 173-236: 삭제 핸들러 강화 (확인, 로깅, 에러 처리)

2. **`app/api/revenue/operating-cost-adjustment/route.ts`**
   - 라인 302-361: PUT 엔드포인트 검증 로직 추가
   - 라인 438-481: DELETE 엔드포인트 검증 로직 추가

## 🧪 테스트 가이드

### 테스트 시나리오 1: 새 조정 생성 (POST)
1. 매출 관리 페이지에서 사업장 선택
2. 모달에서 "영업비용 조정" 카드의 "추가" 버튼 클릭
3. 금액, 타입(추가/차감), 사유 입력
4. "저장" 버튼 클릭
5. **예상 결과**: 성공 메시지 표시, 조정된 영업비용 즉시 반영

### 테스트 시나리오 2: 기존 조정 수정 (PUT)
1. 조정이 있는 사업장의 모달 열기
2. "영업비용 조정" 카드의 "수정" 버튼 클릭
3. 금액이나 타입, 사유 변경
4. "저장" 버튼 클릭
5. **예상 결과**: 성공 메시지 표시, 변경된 값 즉시 반영

### 테스트 시나리오 3: 조정 삭제 (DELETE)
1. 조정이 있는 사업장의 모달 열기
2. "영업비용 조정" 카드의 "삭제" 버튼 클릭
3. 확인 다이얼로그에서 "확인" 클릭
4. **예상 결과**: 성공 메시지 표시, 조정이 제거되고 기본 영업비용으로 복구

### 테스트 시나리오 4: 에러 케이스
1. **금액 0 입력**: "조정 금액은 0보다 커야 합니다" 메시지
2. **수정 시 조정이 없는 경우**: "수정할 조정 값이 없습니다" 404 에러
3. **삭제 시 조정이 없는 경우**: "삭제할 조정 값이 없습니다" 404 에러
4. **권한 부족**: "영업비용 조정 권한이 필요합니다" 403 에러

## 📊 디버깅 로그 체계

### 프론트엔드 로그 (Browser Console)
```
🔄 [ADJUSTMENT] 저장 시작: { method, hasExisting, business_id, amount }
📥 [ADJUSTMENT] 저장 응답: { success, data, message }
📥 [ADJUSTMENT] 재계산 응답: { success, data }
✅ [ADJUSTMENT] calculatedData 업데이트 완료: { operating_cost_adjustment }
🗑️ [ADJUSTMENT] 삭제 시작: { business_id }
📥 [ADJUSTMENT] 삭제 응답: { success, message }
📥 [ADJUSTMENT] 삭제 후 재계산 응답: { success, data }
✅ [ADJUSTMENT] 삭제 후 calculatedData 업데이트 완료: { operating_cost_adjustment }
❌ [ADJUSTMENT] 저장/삭제 실패: { message }
```

### 백엔드 로그 (Server Console)
```
✅ [OPERATING-COST-ADJ] 생성 완료: adjustment_id
✅ [OPERATING-COST-ADJ] 수정 완료: { id, business_id, amount }
✅ [OPERATING-COST-ADJ] 삭제 완료: { business_id, adjustment_id }
⚠️ [OPERATING-COST-ADJ] 수정할 조정 값이 없음. POST 사용 필요: business_id
⚠️ [OPERATING-COST-ADJ] 삭제할 조정 값이 없음: business_id
❌ [OPERATING-COST-ADJ] 생성/수정/삭제 오류: error
```

## 🎉 기대 효과

1. **안정성 향상**: 모든 CRUD 작업이 예측 가능하게 작동
2. **디버깅 용이성**: 상세한 로그로 문제 원인 빠른 파악
3. **사용자 경험 개선**: 명확한 피드백과 에러 메시지
4. **데이터 무결성**: API 레벨 검증으로 잘못된 작업 방지

## 📝 향후 개선 사항

1. **낙관적 업데이트**: API 응답 전 UI 미리 업데이트 (UX 향상)
2. **에러 복구**: 실패 시 자동 재시도 메커니즘
3. **이력 관리**: 조정 변경 이력 추적 및 감사 로그
4. **권한 세분화**: 조정 생성/수정/삭제 권한 분리

## ✅ 작업 완료 체크리스트

- [x] 문제 원인 분석 완료
- [x] Modal 상태 관리 개선
- [x] API 검증 로직 추가
- [x] 에러 처리 강화
- [x] 로깅 시스템 구축
- [x] 코드 문서화
- [ ] 통합 테스트 실행 (사용자 수동 테스트 필요)
- [ ] 프로덕션 배포 전 QA

## 🔗 관련 파일
- `components/business/BusinessRevenueModal.tsx`
- `app/api/revenue/operating-cost-adjustment/route.ts`
- `app/api/revenue/calculate/route.ts` (조정 값 조회 로직)
- `types/index.ts` (OperatingCostAdjustment 타입 정의)
