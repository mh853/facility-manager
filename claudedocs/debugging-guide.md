# 영업비용 조정 후 메인 테이블 업데이트 디버깅 가이드

## 📅 작성일
2025-11-10

## 🎯 목적
영업비용 조정 후 메인 테이블의 이익금액이 즉시 업데이트되지 않는 문제를 추적하기 위한 로깅 및 디버깅 가이드

## 🔍 전체 데이터 흐름

```
1. 모달에서 영업비용 조정 입력
   ↓
2. handleSaveAdjustment 실행
   ↓
3. POST /api/revenue/operating-cost-adjustment (조정 데이터 저장)
   ↓
4. POST /api/revenue/calculate (save_result: true) → revenue_calculations에 저장
   ↓
5. 모달 닫기 → onClose 실행
   ↓
6. Promise.all([loadBusinesses(), loadCalculations()])
   ↓
7. filteredBusinesses 계산
   ↓
8. React 재렌더링 → 메인 테이블 업데이트
```

## 📊 로깅 체크포인트

### 1단계: 모달에서 저장 (BusinessRevenueModal.tsx)

**위치**: `handleSaveAdjustment` 함수

**로그 확인사항**:
```javascript
// 1. 조정 데이터 저장 성공
📥 [ADJUSTMENT] 저장 응답: { success: true, ... }

// 2. 재계산 API 응답
📥 [ADJUSTMENT] 재계산 응답: { success: true, data: { ... } }

// 3. 재계산 결과 상세 (중요!)
🔍 [ADJUSTMENT] 재계산 결과 상세: {
  sales_commission: 500000,           // 기본 영업비용
  adjusted_sales_commission: 1500000, // 조정된 영업비용 ✅
  net_profit: 1200000,
  operating_cost_adjustment: { ... }
}

// 4. DB 저장 확인 (중요!)
💾 [ADJUSTMENT] DB 저장 확인: {
  id: "uuid...",
  sales_commission: 500000,
  adjusted_sales_commission: 1500000  // ✅ DB에 저장됨!
}
```

**⚠️ 주의사항**:
- `adjusted_sales_commission`이 **null이면 안 됨!**
- `saved_record`가 없으면 DB 저장 실패

### 2단계: 모달 닫기 (page.tsx - onClose)

**위치**: `BusinessRevenueModal onClose` 핸들러

**로그 확인사항**:
```javascript
// 1. 모달 닫기 시작
🔄 [MODAL-CLOSE] 모달 닫기 시작

// 2. 데이터 재조회 시작
🔄 [MODAL-CLOSE] 데이터 재조회 시작...

// 3. 재조회 완료
✅ [MODAL-CLOSE] 데이터 재조회 완료
```

### 3단계: 계산 결과 로드 (page.tsx - loadCalculations)

**위치**: `loadCalculations` 함수

**로그 확인사항**:
```javascript
// 1. 조회 시작
📊 [LOAD-CALCULATIONS] 계산 결과 로드 시작

// 2. 조회 파라미터
📊 [LOAD-CALCULATIONS] 요청 파라미터: business_id=xxx&limit=100

// 3. 조회 결과
📊 [LOAD-CALCULATIONS] 5개 계산 결과 조회 완료

// 4. 영업비용 조정된 계산 개수 (중요!)
💰 [LOAD-CALCULATIONS] 영업비용 조정된 계산: 1개

// 5. 각 계산 결과 상세 (중요!)
🔍 [LOAD-CALCULATIONS] 일신산업: {
  sales_commission: 500000,
  adjusted_sales_commission: 1500000,  // ✅ 조회됨!
  has_adjustment: true
}

// 6. 상태 업데이트 완료
✅ [LOAD-CALCULATIONS] calculations 상태 업데이트 완료
```

**⚠️ 주의사항**:
- `adjusted_sales_commission`이 **null이면 문제!**
- DB에서 조회한 값이 모달에서 저장한 값과 일치해야 함

### 4단계: 테이블 계산 (page.tsx - filteredBusinesses)

**위치**: `filteredBusinesses` useMemo

**로그 확인사항**:
```javascript
// 1. revenueCalc 상태 확인 (중요!)
🔍 [TABLE-CALC] 일신산업 - revenueCalc: {
  has_revenueCalc: true,                      // ✅ 있어야 함
  adjusted_sales_commission: 1500000,         // ✅ 조정된 값
  sales_commission: 500000,
  business_adjusted: undefined,
  business_sales: 500000
}

// 2. 최종 계산 결과
📊 [TABLE-CALC] 일신산업 - 최종 계산: {
  grossProfit: 3000000,
  salesCommission: 1500000,                   // ✅ 조정된 값 사용
  netProfit: 1200000,
  source: '조정된 영업비용'                   // ✅ 소스 확인
}
```

**⚠️ 주의사항**:
- `has_revenueCalc: false`이면 매칭 실패
- `source`가 '조정된 영업비용'이 아니면 문제

## 🚨 문제 진단

### Case 1: DB 저장 실패

**증상**:
```javascript
⚠️ [ADJUSTMENT] DB에 저장되지 않음 (saved_record 없음)
```

**원인**:
- `permissionLevel < 3`
- `save_result: false`
- DB 스키마에 `adjusted_sales_commission` 컬럼 없음

**해결**:
1. 권한 확인: `permissionLevel >= 3`인지 확인
2. `save_result: true` 확인
3. DB 마이그레이션 실행 확인

### Case 2: DB 조회 실패

**증상**:
```javascript
🔍 [LOAD-CALCULATIONS] 일신산업: {
  sales_commission: 1500000,
  adjusted_sales_commission: null,  // ❌ null!
  has_adjustment: false
}
```

**원인**:
- DB에 `adjusted_sales_commission` 컬럼 없음
- API가 컬럼을 저장하지 않음

**해결**:
1. DB 스키마 확인:
```sql
SELECT column_name
FROM information_schema.columns
WHERE table_name = 'revenue_calculations'
  AND column_name = 'adjusted_sales_commission';
```

2. 최근 저장된 데이터 확인:
```sql
SELECT
  id,
  business_name,
  sales_commission,
  adjusted_sales_commission,
  created_at
FROM revenue_calculations
ORDER BY created_at DESC
LIMIT 5;
```

### Case 3: revenueCalc 매칭 실패

**증상**:
```javascript
🔍 [TABLE-CALC] 일신산업 - revenueCalc: {
  has_revenueCalc: false,  // ❌ 없음!
  ...
}
```

**원인**:
- `calculations` 배열에 해당 사업장 데이터 없음
- `business_id` 매칭 실패

**해결**:
1. `loadCalculations()`의 필터 조건 확인
2. `selectedBusiness`, `selectedOffice` 필터가 너무 제한적인지 확인

### Case 4: React 재렌더링 안 됨

**증상**:
- 모든 로그는 정상이지만 화면 업데이트 안 됨

**원인**:
- `calculations` 상태 변경 감지 실패
- `filteredBusinesses` useMemo 재계산 안 됨

**해결**:
1. `calculations` 상태가 새 배열 참조인지 확인
2. 의존성 배열 확인: `[businesses, calculations, ...]`

## 🧪 테스트 시나리오

### 시나리오 1: 정상 동작 확인

1. 브라우저 콘솔 열기 (F12)
2. 매출 관리 페이지 접속
3. 사업장 선택 → 모달 열기
4. 영업비용 조정 (+1,000,000원)
5. 저장 버튼 클릭
6. 콘솔에서 다음 순서대로 로그 확인:
   ```
   📥 [ADJUSTMENT] 저장 응답
   📥 [ADJUSTMENT] 재계산 응답
   🔍 [ADJUSTMENT] 재계산 결과 상세  ← adjusted_sales_commission 확인
   💾 [ADJUSTMENT] DB 저장 확인        ← adjusted_sales_commission 확인
   ✅ [ADJUSTMENT] calculatedData 업데이트 완료
   ```
7. 모달 닫기
8. 콘솔에서 다음 순서대로 로그 확인:
   ```
   🔄 [MODAL-CLOSE] 모달 닫기 시작
   🔄 [MODAL-CLOSE] 데이터 재조회 시작...
   📊 [LOAD-CALCULATIONS] 계산 결과 로드 시작
   🔍 [LOAD-CALCULATIONS] 일신산업    ← adjusted_sales_commission 확인
   ✅ [LOAD-CALCULATIONS] calculations 상태 업데이트 완료
   🔍 [TABLE-CALC] 일신산업 - revenueCalc  ← adjusted_sales_commission 확인
   📊 [TABLE-CALC] 일신산업 - 최종 계산    ← source: '조정된 영업비용'
   ✅ [MODAL-CLOSE] 데이터 재조회 완료
   ```
9. 메인 테이블 이익금액 즉시 업데이트 확인

### 시나리오 2: 문제 발생 시

위 로그 중 하나라도 누락되거나 값이 이상하면:
1. 해당 로그의 위치 파악
2. "문제 진단" 섹션 참고
3. 로그 내용을 개발자에게 공유

## 📋 로그 수집 방법

### 1. 브라우저 콘솔 로그 복사
1. F12 → Console 탭
2. 우클릭 → "Save as..."
3. 파일로 저장

### 2. 특정 사업장만 필터링
```javascript
// 콘솔에서 실행
console.log = (function(oldLog) {
  return function(...args) {
    if (args[0]?.includes('일신산업')) {
      oldLog.apply(console, args);
    }
  };
})(console.log);
```

## 🎯 성공 기준

다음 모든 로그가 나오면 정상:
1. ✅ `💾 [ADJUSTMENT] DB 저장 확인` - `adjusted_sales_commission` 값 있음
2. ✅ `🔍 [LOAD-CALCULATIONS]` - `adjusted_sales_commission` 값 있음
3. ✅ `🔍 [TABLE-CALC] - revenueCalc` - `has_revenueCalc: true`, `adjusted_sales_commission` 값 있음
4. ✅ `📊 [TABLE-CALC] - 최종 계산` - `source: '조정된 영업비용'`
5. ✅ 메인 테이블 이익금액이 모달 순이익과 동일

## 🔧 추가 디버깅 도구

### API 응답 직접 확인
```javascript
// 브라우저 콘솔에서 실행
const token = localStorage.getItem('auth_token');

// 계산 결과 조회
fetch('/api/revenue/calculate?business_id=YOUR_BUSINESS_ID', {
  headers: { 'Authorization': `Bearer ${token}` }
})
.then(r => r.json())
.then(data => {
  console.log('API 응답:', data);
  console.log('adjusted_sales_commission:', data.data.calculations[0]?.adjusted_sales_commission);
});
```

### DB 직접 확인 (Supabase SQL Editor)
```sql
-- 특정 사업장의 최근 계산 결과
SELECT
  business_name,
  calculation_date,
  sales_commission,
  adjusted_sales_commission,
  net_profit,
  created_at
FROM revenue_calculations
WHERE business_name = '일신산업'
ORDER BY created_at DESC
LIMIT 1;

-- 영업비용 조정 데이터
SELECT *
FROM operating_cost_adjustments
WHERE business_id = (
  SELECT id FROM business_info WHERE business_name = '일신산업'
);
```

## 📝 문제 보고 템플릿

문제 발생 시 다음 정보를 공유:

```
### 환경
- 브라우저: Chrome / Edge / ...
- 사업장명: 일신산업
- 조정 금액: +1,000,000원
- 권한 레벨: 3

### 로그 (콘솔 복사)
[여기에 콘솔 로그 붙여넣기]

### 증상
- [ ] 모달에서 순이익 변경됨
- [ ] 저장 성공 메시지
- [ ] DB 저장 확인 로그 있음
- [ ] loadCalculations에서 adjusted_sales_commission 조회됨
- [ ] 메인 테이블 업데이트 안 됨

### 기타
[추가 정보]
```
