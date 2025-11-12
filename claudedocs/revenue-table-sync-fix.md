# 메인 테이블 영업비용 조정 동기화 수정

## 📅 작업 일자
2025-11-10

## 🎯 작업 목표
영업비용 조정 후 모달의 순이익과 메인 테이블의 이익금액이 동일하게 표시되도록 동기화

## 🔍 문제 분석

### 증상
- ✅ **모달**: 영업비용 조정 후 순이익 정확히 반영
- ❌ **메인 테이블**: 영업비용 조정이 반영되지 않고 기본 영업비용으로 계산

### 근본 원인
**위치**: `app/admin/revenue/page.tsx:851-856`

```typescript
// ❌ 문제 코드 (Before)
const netProfit = grossProfit
  - (business.sales_commission || 0)  // 기본 영업비용만 사용
  - (business.survey_costs || 0)
  - (business.installation_costs || 0)
  - ((business as any).installation_extra_cost || 0);
```

**문제점**:
1. `business.sales_commission`만 사용 (조정 전 기본값)
2. 저장된 계산 결과(`revenueCalc`)의 `adjusted_sales_commission`을 무시
3. 모달은 `adjusted_sales_commission`을 사용하므로 불일치 발생

## ✅ 적용된 수정 사항

### 수정 1: 영업비용 우선순위 로직 추가

```typescript
// ✅ 개선 코드 (After)
// 영업비용: 저장된 계산 결과에서 조정된 값 우선 사용
const salesCommission = revenueCalc?.adjusted_sales_commission
  || revenueCalc?.sales_commission
  || business.adjusted_sales_commission
  || business.sales_commission
  || 0;
```

**우선순위**:
1. `revenueCalc.adjusted_sales_commission` (저장된 계산 결과의 조정 값)
2. `revenueCalc.sales_commission` (저장된 계산 결과의 기본 값)
3. `business.adjusted_sales_commission` (사업장 직접 필드)
4. `business.sales_commission` (사업장 기본 필드)
5. `0` (기본값)

### 수정 2: 순이익 계산 시 조정된 영업비용 사용

```typescript
// 순이익 = 총이익 - 조정된 영업비용 - 실사비용 - 기본설치비 - 추가설치비
const netProfit = grossProfit
  - salesCommission  // 조정된 영업비용 사용
  - (business.survey_costs || 0)
  - (business.installation_costs || 0)
  - ((business as any).installation_extra_cost || 0);
```

### 수정 3: Return 객체에 영업비용 필드 추가

```typescript
return {
  ...business,
  // ... 기존 필드들
  net_profit: netProfit, // 순이익 (총이익 - 조정된 영업비용 포함)
  sales_commission: revenueCalc?.sales_commission || business.sales_commission || 0, // 기본 영업비용
  adjusted_sales_commission: salesCommission, // 조정된 영업비용 (실제 사용된 값)
  // ... 기타 필드들
};
```

**추가된 필드**:
- `sales_commission`: 기본 영업비용 (조정 전)
- `adjusted_sales_commission`: 조정된 영업비용 (실제 계산에 사용된 값)

## 🔄 데이터 흐름

### Before (문제 상황)
```
1. loadBusinesses() → business_info 조회
2. calculateBusinessRevenue() → 클라이언트 자동 계산 (조정 X)
3. loadCalculations() → revenue_calculations 조회 (조정 O)
   ↓
4. 순이익 계산 시:
   - business.sales_commission 사용 (조정 X)
   - revenueCalc.adjusted_sales_commission 무시
   ↓
5. ❌ 결과: 조정이 반영되지 않은 순이익
```

### After (수정 후)
```
1. loadBusinesses() → business_info 조회
2. calculateBusinessRevenue() → 클라이언트 자동 계산
3. loadCalculations() → revenue_calculations 조회 (조정 O)
   ↓
4. 순이익 계산 시:
   - revenueCalc.adjusted_sales_commission 우선 사용
   - 없으면 fallback: revenueCalc.sales_commission
   - 그래도 없으면: business.sales_commission
   ↓
5. ✅ 결과: 조정이 반영된 순이익
```

## 📊 계산 예시

### 시나리오: 영업비용 100만원 추가 조정

#### Before (문제)
```
매출: 10,000,000원
매입:  7,000,000원
총이익: 3,000,000원

기본 영업비용: 500,000원
조정 (+):      1,000,000원
────────────────────────────
조정된 영업비용: 1,500,000원

순이익 계산 (메인 테이블):
= 3,000,000 - 500,000 (조정 미반영) - 200,000 - 100,000
= 2,200,000원  ❌ 틀림!

순이익 계산 (모달):
= 3,000,000 - 1,500,000 (조정 반영) - 200,000 - 100,000
= 1,200,000원  ✅ 정확!
```

#### After (수정)
```
매출: 10,000,000원
매입:  7,000,000원
총이익: 3,000,000원

기본 영업비용: 500,000원
조정 (+):      1,000,000원
────────────────────────────
조정된 영업비용: 1,500,000원

순이익 계산 (메인 테이블):
= 3,000,000 - 1,500,000 (조정 반영) - 200,000 - 100,000
= 1,200,000원  ✅ 정확!

순이익 계산 (모달):
= 3,000,000 - 1,500,000 (조정 반영) - 200,000 - 100,000
= 1,200,000원  ✅ 정확!

🎉 메인 테이블과 모달이 동일!
```

## 🧪 테스트 가이드

### 테스트 시나리오 1: 영업비용 조정 추가
1. 매출 관리 페이지 접속
2. 사업장 선택 → 모달 열기
3. 영업비용 조정 추가 (예: +1,000,000원)
4. **모달 순이익 확인** (예: 1,200,000원)
5. 모달 닫기
6. **메인 테이블 이익금액 확인** → 모달과 동일해야 함 (1,200,000원)

### 테스트 시나리오 2: 영업비용 조정 수정
1. 기존 조정이 있는 사업장 선택
2. 조정 금액 변경 (예: +1,000,000원 → +500,000원)
3. 저장 후 모달 순이익 확인
4. 모달 닫기 → 메인 테이블 동기화 확인

### 테스트 시나리오 3: 영업비용 조정 삭제
1. 조정이 있는 사업장 선택
2. 조정 삭제
3. 모달에서 기본 영업비용으로 계산된 순이익 확인
4. 메인 테이블도 동일한 금액 표시 확인

### 테스트 시나리오 4: 페이지 새로고침
1. 영업비용 조정이 있는 사업장 확인
2. 페이지 새로고침 (F5)
3. 메인 테이블 로드 후 이익금액 확인
4. 모달 열어서 순이익과 비교 → 동일해야 함

## 🎯 기대 효과

### 1. 데이터 일관성
- ✅ 모달과 메인 테이블의 순이익 금액 동기화
- ✅ 영업비용 조정이 모든 화면에 즉시 반영
- ✅ 사용자 혼란 제거

### 2. 정확한 재무 데이터
- ✅ 실제 조정된 영업비용 기반 순이익 계산
- ✅ 경영진 의사결정에 필요한 정확한 데이터 제공
- ✅ 재무 보고서 신뢰성 향상

### 3. 사용자 경험 개선
- ✅ 모달과 테이블 간 불일치 해소
- ✅ 데이터 검증 시간 단축
- ✅ 시스템 신뢰도 증가

## 📝 향후 개선 사항

1. **실시간 동기화**: WebSocket 기반 실시간 업데이트
2. **낙관적 업데이트**: API 응답 전 UI 미리 갱신
3. **영업비용 이력**: 조정 변경 이력 추적 및 감사 로그
4. **일괄 조정**: 여러 사업장 동시 조정 기능

## 🔗 관련 파일

- **`app/admin/revenue/page.tsx`**
  - 라인 851-856: 영업비용 우선순위 로직 추가
  - 라인 858-863: 순이익 계산 시 조정된 영업비용 사용
  - 라인 887-903: Return 객체에 영업비용 필드 추가

- **관련 API**
  - `/api/revenue/calculate`: 매출 계산 및 조정 적용
  - `/api/revenue/operating-cost-adjustment`: 조정 CRUD

- **관련 작업**
  - `operating-cost-adjustment-fix.md`: 영업비용 조정 기능 안정화
  - `modal-layout-reorder.md`: 모달 레이아웃 재구성

## ✅ 작업 완료 체크리스트

- [x] 문제 원인 분석
- [x] 영업비용 우선순위 로직 구현
- [x] 순이익 계산 수정
- [x] Return 객체 필드 추가
- [x] 코드 문서화
- [ ] 사용자 테스트 (4가지 시나리오)
- [ ] 프로덕션 배포

## 🎉 결과

영업비용 조정이 메인 테이블과 모달 모두에서 정확하게 반영됩니다!

**Before**: 모달 순이익 ≠ 테이블 이익금액 ❌
**After**: 모달 순이익 = 테이블 이익금액 ✅
