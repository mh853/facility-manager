# 대리점 업무 타입 단순화 설계

## 📋 개요

**목표**: 대리점 업무를 4단계로 단순화

**변경 사유**: 대리점 업무는 복잡한 워크플로우가 필요 없으며, 단순한 발주-정산 프로세스만 필요함

## 🔄 변경 사항

### 기존 설계 (12단계)
```
1. 대리점 접수 (8%)
2. 현장 실사 (17%)
3. 견적 확정 (25%)
4. 계약 체결 (33%)
5. 계약금 확인 (42%)
6. 제품 발주 (50%)
7. 제품 출고 (58%)
8. 설치 협의 (67%)
9. 제품 설치 (75%)
10. 잔금 입금 (83%)
11. 대리점 정산 (92%)
12. 서류 발송 완료 (100%)
```

### 새로운 설계 (4단계) ✨
```
1. 발주 수신 (25%)     - dealer_order_received
2. 계산서 발행 (50%)   - dealer_invoice_issued
3. 입금 확인 (75%)     - dealer_payment_confirmed
4. 제품 발주 (100%)    - dealer_product_ordered
```

## 📊 새로운 워크플로우 정의

### dealerSteps (단순화)

```typescript
export const dealerSteps: StepInfo[] = [
  { status: 'dealer_order_received', label: '발주 수신', color: 'blue' },
  { status: 'dealer_invoice_issued', label: '계산서 발행', color: 'yellow' },
  { status: 'dealer_payment_confirmed', label: '입금 확인', color: 'green' },
  { status: 'dealer_product_ordered', label: '제품 발주', color: 'emerald' }
]
```

### 단계 설명

| 순서 | 단계 코드 | 한글 명칭 | 진행률 | 설명 |
|------|-----------|-----------|--------|------|
| 1 | dealer_order_received | 발주 수신 | 25% | 대리점으로부터 발주 접수 |
| 2 | dealer_invoice_issued | 계산서 발행 | 50% | 대리점에게 계산서 발행 |
| 3 | dealer_payment_confirmed | 입금 확인 | 75% | 대리점 입금 확인 완료 |
| 4 | dealer_product_ordered | 제품 발주 | 100% | 제조사에 제품 발주 완료 |

### 특징

- **총 4단계**: 최소한의 필수 단계만 유지
- **단순한 프로세스**: 발주 → 계산서 → 입금 → 제품발주
- **빠른 진행률**: 각 단계당 25%씩 진행
- **명확한 목표**: 대리점 업무의 핵심만 추적

## 🗂️ 파일별 수정 사항

### 1. `/lib/task-status-utils.ts`

**수정 내용**: 대리점 단계를 4단계로 변경

```typescript
// 업무 상태 한글 매핑
export const TASK_STATUS_KR: { [key: string]: string } = {
  // ... 기존 항목 유지 ...

  // 대리점 업무 단계 (단순화)
  'dealer_order_received': '발주 수신',
  'dealer_invoice_issued': '계산서 발행',
  'dealer_payment_confirmed': '입금 확인',
  'dealer_product_ordered': '제품 발주',

  // 기존 대리점 단계 제거
  // ❌ 'dealer_contact': '대리점 접수',
  // ❌ 'dealer_site_inspection': '현장 실사',
  // ❌ 'dealer_quotation': '견적 확정',
  // ❌ 'dealer_contract': '계약 체결',
  // ❌ 'dealer_deposit_confirm': '계약금 확인',
  // ❌ 'dealer_balance_payment': '잔금 입금',
  // ❌ 'dealer_settlement': '대리점 정산',

  // ... 기존 항목 유지 ...
};
```

**getStatusColor 함수 업데이트**:

```typescript
export function getStatusColor(status: string): string {
  const colorMap: { [key: string]: string } = {
    // ... 기존 항목 유지 ...

    // 대리점 전용 단계 (단순화)
    'dealer_order_received': 'bg-blue-100 text-blue-800',
    'dealer_invoice_issued': 'bg-yellow-100 text-yellow-800',
    'dealer_payment_confirmed': 'bg-green-100 text-green-800',
    'dealer_product_ordered': 'bg-emerald-100 text-emerald-800',

    // 기존 대리점 단계 제거
    // ❌ 'dealer_contact': 'bg-blue-100 text-blue-800',
    // ❌ 'dealer_site_inspection': 'bg-yellow-100 text-yellow-800',
    // ... (나머지 제거)
  };

  return colorMap[status] || 'bg-gray-100 text-gray-800';
}
```

---

### 2. `/app/admin/tasks/types.ts`

**수정 내용**: TaskStatus 업데이트 및 dealerSteps 4단계로 변경

```typescript
export type TaskStatus =
  // ... 기존 상태 유지 ...

  // 대리점 단계 (단순화)
  | 'dealer_order_received' | 'dealer_invoice_issued'
  | 'dealer_payment_confirmed' | 'dealer_product_ordered'

  // 기존 대리점 단계 제거
  // ❌ | 'dealer_contact' | 'dealer_site_inspection' | 'dealer_quotation'
  // ❌ | 'dealer_contract' | 'dealer_deposit_confirm'
  // ❌ | 'dealer_balance_payment' | 'dealer_settlement'

  // ... 기존 상태 유지 ...

// 상태별 단계 정의 (대리점) - 단순화
export const dealerSteps: StepInfo[] = [
  { status: 'dealer_order_received', label: '발주 수신', color: 'blue' },
  { status: 'dealer_invoice_issued', label: '계산서 발행', color: 'yellow' },
  { status: 'dealer_payment_confirmed', label: '입금 확인', color: 'green' },
  { status: 'dealer_product_ordered', label: '제품 발주', color: 'emerald' }
]
```

**변경 없음**:
- calculateProgressPercentage 함수 (자동 계산 로직 유지)
- getStepsByType 함수 (이미 dealer 처리 포함)

---

### 3. `/app/admin/tasks/page.tsx`

**수정 내용**: TaskStatus 인라인 타입 업데이트

```typescript
type TaskStatus =
  // ... 기존 상태 유지 ...

  // 대리점 단계 (단순화)
  | 'dealer_order_received' | 'dealer_invoice_issued'
  | 'dealer_payment_confirmed' | 'dealer_product_ordered'

  // 기존 대리점 단계 제거
  // ❌ | 'dealer_contact' | 'dealer_site_inspection' | 'dealer_quotation'
  // ❌ | 'dealer_contract' | 'dealer_deposit_confirm'
  // ❌ | 'dealer_balance_payment' | 'dealer_settlement'

  // ... 기존 상태 유지 ...
```

**변경 없음**:
- UI 드롭다운 (이미 "대리점" 옵션 존재)
- getTaskTypeBadge (이미 dealer 배지 존재)
- 지연 임계값 (dealer 이미 포함)

---

### 4. `/app/api/admin/tasks/bulk-upload/route.ts`

**변경 없음**: 이미 '대리점': 'dealer' 매핑 존재

---

### 5. 데이터베이스 마이그레이션

**변경 없음**:
- CHECK 제약조건은 task_type만 제한하므로 변경 불필요
- status 필드는 VARCHAR(50)로 모든 값 저장 가능

**기존 대리점 데이터 마이그레이션 (필요시)**:

```sql
-- 기존 12단계 대리점 업무를 4단계로 마이그레이션
-- (만약 기존 데이터가 있다면)

UPDATE facility_tasks
SET status = CASE
  WHEN status IN ('dealer_contact', 'dealer_site_inspection', 'dealer_quotation')
    THEN 'dealer_order_received'
  WHEN status IN ('dealer_contract', 'dealer_deposit_confirm')
    THEN 'dealer_invoice_issued'
  WHEN status IN ('dealer_balance_payment', 'dealer_settlement')
    THEN 'dealer_payment_confirmed'
  WHEN status IN ('product_order', 'product_shipment', 'installation_schedule',
                  'installation', 'document_complete')
    THEN 'dealer_product_ordered'
  ELSE status
END
WHERE task_type = 'dealer';
```

---

## 🧪 테스트 시나리오

### 테스트 1: 대리점 업무 생성

**단계**:
1. `/admin/tasks` 페이지 접속
2. "제품 발주" 버튼 클릭
3. 업무 타입: **"대리점"** 선택
4. 현재 단계: **"발주 수신"** 선택
5. 메모: "대리점 발주 접수" 입력
6. 저장

**기대 결과**:
- ✅ 대리점 업무 생성
- ✅ 진행률: 25%
- ✅ 상태: "발주 수신"

---

### 테스트 2: 워크플로우 진행

**단계**:
1. 생성한 대리점 업무 클릭
2. 순차적으로 단계 변경:
   - 발주 수신 (25%) → 계산서 발행 (50%) → 입금 확인 (75%) → 제품 발주 (100%)

**기대 결과**:
- ✅ 4단계 모두 표시됨
- ✅ 진행률 자동 계산: 25% → 50% → 75% → 100%
- ✅ 색상: 파랑 → 노랑 → 초록 → 에메랄드

---

### 테스트 3: 엑셀 일괄 등록

**엑셀 파일**:

| 사업장명 | 업무타입 | 현재단계 | 담당자 | 메모 |
|----------|----------|----------|--------|------|
| (주)테스트대리점 | 대리점 | 입금 확인 | 홍길동 | 대리점 입금 완료 |

**기대 결과**:
- ✅ "대리점" 타입 인식
- ✅ "입금 확인" 단계 매핑
- ✅ 진행률: 75%

---

## 📊 진행률 계산 예시

| 단계 | 진행률 | 계산식 |
|------|--------|--------|
| 발주 수신 | 25% | (1/4) × 100 = 25% |
| 계산서 발행 | 50% | (2/4) × 100 = 50% |
| 입금 확인 | 75% | (3/4) × 100 = 75% |
| 제품 발주 | 100% | (4/4) × 100 = 100% |

---

## 🎨 UI 색상 체계

### 단계별 색상
- **발주 수신**: `bg-blue-100 text-blue-800` (파랑)
- **계산서 발행**: `bg-yellow-100 text-yellow-800` (노랑)
- **입금 확인**: `bg-green-100 text-green-800` (초록)
- **제품 발주**: `bg-emerald-100 text-emerald-800` (에메랄드)

### 타입 배지
- **대리점**: `bg-orange-100 text-orange-800 border-orange-200` (오렌지) - 변경 없음

---

## ✅ 체크리스트

### 코드 수정
- [ ] `/lib/task-status-utils.ts` - TASK_STATUS_KR 4단계로 변경
- [ ] `/lib/task-status-utils.ts` - getStatusColor 4단계로 변경
- [ ] `/app/admin/tasks/types.ts` - TaskStatus 4단계로 변경
- [ ] `/app/admin/tasks/types.ts` - dealerSteps 4단계로 변경
- [ ] `/app/admin/tasks/page.tsx` - TaskStatus 인라인 타입 4단계로 변경

### 데이터 마이그레이션 (필수)
- [x] 기존 대리점 업무 상태 확인 쿼리 작성
- [ ] `/database/migrate-dealer-status.sql` 실행 (Supabase에서)
- [ ] 마이그레이션 결과 검증

### 테스트
- [ ] 대리점 업무 생성 테스트
- [ ] 4단계 워크플로우 진행 테스트
- [ ] 진행률 계산 검증 (25% → 50% → 75% → 100%)
- [ ] 엑셀 일괄 등록 테스트

---

## 📌 변경 요약

### Before (12단계)
```
대리점 접수 → 현장 실사 → 견적 확정 → 계약 체결 → 계약금 확인
→ 제품 발주 → 제품 출고 → 설치 협의 → 제품 설치
→ 잔금 입금 → 대리점 정산 → 서류 발송 완료
```

### After (4단계) ✨
```
발주 수신 → 계산서 발행 → 입금 확인 → 제품 발주
```

### 장점
- ✅ **단순성**: 복잡한 워크플로우 제거
- ✅ **효율성**: 대리점 업무의 본질에만 집중
- ✅ **빠른 진행**: 4단계만 관리하면 됨
- ✅ **명확성**: 각 단계의 목적이 명확함

---

**작성일**: 2026-01-30
**작성자**: Claude Code
**버전**: 2.0 (단순화)
