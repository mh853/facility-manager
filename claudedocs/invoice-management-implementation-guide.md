# 계산서 및 입금 관리 시스템 - 구현 가이드

## 📋 개요

사업장별 계산서 발행 및 입금 관리, 미수금 추적 시스템 구현 가이드

### 완료된 작업 (이번 세션)
- ✅ 데이터베이스 마이그레이션 SQL 작성
- ✅ TypeScript 인터페이스 정의
- ✅ 구현 가이드 문서 작성

### 다음 세션 작업
- ⏳ API 라우트 구현
- ⏳ InvoiceManagement 컴포넌트 생성
- ⏳ 사업장 상세 모달 UI 통합
- ⏳ 매출 관리 페이지 업데이트

---

## 🗄️ 데이터베이스 구조

### 보조금 사업장 필드

| 필드명 | 타입 | 설명 | 비고 |
|--------|------|------|------|
| `invoice_1st_date` | DATE | 1차 계산서 발행일 | |
| `invoice_1st_amount` | INTEGER | 1차 계산서 발행금액 | |
| `payment_1st_date` | DATE | 1차 입금일 | |
| `payment_1st_amount` | INTEGER | 1차 입금금액 | |
| `invoice_2nd_date` | DATE | 2차 계산서 발행일 | |
| `invoice_2nd_amount` | INTEGER | 2차 계산서 발행금액 | |
| `payment_2nd_date` | DATE | 2차 입금일 | |
| `payment_2nd_amount` | INTEGER | 2차 입금금액 | |
| `invoice_additional_date` | DATE | 추가공사비 계산서 발행일 | |
| `payment_additional_date` | DATE | 추가공사비 입금일 | |
| `payment_additional_amount` | INTEGER | 추가공사비 입금금액 | 발행금액은 `additional_cost` 사용 |

### 자비 사업장 필드

| 필드명 | 타입 | 설명 | 비고 |
|--------|------|------|------|
| `invoice_advance_date` | DATE | 선금 계산서 발행일 | |
| `invoice_advance_amount` | INTEGER | 선금 발행금액 | 기본값: total_revenue * 0.5 |
| `payment_advance_date` | DATE | 선금 입금일 | |
| `payment_advance_amount` | INTEGER | 선금 입금금액 | |
| `invoice_balance_date` | DATE | 잔금 계산서 발행일 | |
| `invoice_balance_amount` | INTEGER | 잔금 발행금액 | 기본값: total_revenue * 0.5 |
| `payment_balance_date` | DATE | 잔금 입금일 | |
| `payment_balance_amount` | INTEGER | 잔금 입금금액 | |

### 미수금 계산 로직

**보조금 사업장:**
```typescript
const receivable_1st = (invoice_1st_amount || 0) - (payment_1st_amount || 0);
const receivable_2nd = (invoice_2nd_amount || 0) - (payment_2nd_amount || 0);
const receivable_additional = (additional_cost || 0) - (payment_additional_amount || 0);
const total_receivables = receivable_1st + receivable_2nd + receivable_additional;
```

**자비 사업장:**
```typescript
const receivable_advance = (invoice_advance_amount || 0) - (payment_advance_amount || 0);
const receivable_balance = (invoice_balance_amount || 0) - (payment_balance_amount || 0);
const total_receivables = receivable_advance + receivable_balance;
```

---

## 🎨 UI 구성 요소

### 1. InvoiceManagement 컴포넌트

**파일 위치:** `components/business/InvoiceManagement.tsx`

**Props:**
```typescript
interface InvoiceManagementProps {
  business: BusinessInfo;
  onUpdate: () => void; // 업데이트 후 콜백
}
```

**기능:**
1. 사업장 카테고리에 따라 UI 분기 (보조금/자비)
2. 계산서 발행 폼 (날짜, 금액)
3. 입금 기록 폼 (날짜, 금액)
4. 미수금 자동 계산 및 표시
5. 권한 체크 (AuthLevel >= 1)

**UI 레이아웃:**

```tsx
<div className="bg-white rounded-lg p-4 shadow-sm">
  <h3>📊 계산서 및 입금 현황</h3>

  {/* 보조금 사업장 */}
  {business.business_category === '보조금' && (
    <>
      {/* 1차 계산서 */}
      <InvoiceCard
        title="1차 계산서"
        invoiceDate={invoice_1st_date}
        invoiceAmount={invoice_1st_amount}
        paymentDate={payment_1st_date}
        paymentAmount={payment_1st_amount}
        onSave={(data) => handleSave('1st', data)}
      />

      {/* 2차 계산서 */}
      <InvoiceCard
        title="2차 계산서"
        invoiceDate={invoice_2nd_date}
        invoiceAmount={invoice_2nd_amount}
        paymentDate={payment_2nd_date}
        paymentAmount={payment_2nd_amount}
        onSave={(data) => handleSave('2nd', data)}
      />

      {/* 추가공사비 */}
      <InvoiceCard
        title="추가공사비"
        invoiceDate={invoice_additional_date}
        invoiceAmount={business.additional_cost} // 자동 채움
        paymentDate={payment_additional_date}
        paymentAmount={payment_additional_amount}
        onSave={(data) => handleSave('additional', data)}
        readOnlyAmount={true} // 발행금액 수정 불가
      />
    </>
  )}

  {/* 자비 사업장 */}
  {business.business_category === '자비' && (
    <>
      {/* 선금 */}
      <InvoiceCard
        title="선금 (기본 50%)"
        invoiceDate={invoice_advance_date}
        invoiceAmount={invoice_advance_amount}
        paymentDate={payment_advance_date}
        paymentAmount={payment_advance_amount}
        onSave={(data) => handleSave('advance', data)}
        defaultAmount={business.total_revenue * 0.5} // 기본값 50%
      />

      {/* 잔금 */}
      <InvoiceCard
        title="잔금 (기본 50%)"
        invoiceDate={invoice_balance_date}
        invoiceAmount={invoice_balance_amount}
        paymentDate={payment_balance_date}
        paymentAmount={payment_balance_amount}
        onSave={(data) => handleSave('balance', data)}
        defaultAmount={business.total_revenue * 0.5} // 기본값 50%
      />
    </>
  )}
</div>
```

### 2. InvoiceCard 서브컴포넌트

**기능:**
- 계산서 정보 표시 (발행일/발행금액)
- 입금 정보 표시 (입금일/입금금액)
- 미수금 자동 계산 및 경고 표시
- 편집 모드 전환
- 저장 기능

**상태별 UI:**

```tsx
// 미발행 상태
미발행 - [발행하기 버튼]

// 발행됨, 미입금 상태
발행: 2025-01-15 | 10,000,000원
입금: 미입금
미수금: 10,000,000원 ⚠️ [입금 등록 버튼]

// 발행됨, 부분 입금 상태
발행: 2025-01-15 | 10,000,000원
입금: 2025-01-20 | 5,000,000원
미수금: 5,000,000원 ⚠️ [수정 버튼]

// 완납 상태
발행: 2025-01-15 | 10,000,000원
입금: 2025-01-20 | 10,000,000원
미수금: 0원 ✅ [수정 버튼]
```

---

## 🔌 API 구조

### API 엔드포인트

**파일 위치:** `app/api/business-invoices/route.ts`

#### GET - 사업장별 계산서 조회

```typescript
GET /api/business-invoices?business_id={id}

Response:
{
  success: true,
  data: {
    business_id: "uuid",
    business_name: "(주)가경스틸쇼트도장",
    business_category: "보조금",

    // 보조금용
    invoices_subsidy: {
      first: { invoice_date, invoice_amount, payment_date, payment_amount, receivable },
      second: { ... },
      additional: { ... }
    },

    // 자비용
    invoices_self: {
      advance: { invoice_date, invoice_amount, payment_date, payment_amount, receivable },
      balance: { ... }
    },

    total_receivables: 15000000
  }
}
```

#### PUT - 계산서/입금 정보 업데이트

```typescript
PUT /api/business-invoices

Request Body:
{
  business_id: "uuid",
  invoice_type: "1st" | "2nd" | "additional" | "advance" | "balance",

  // 계산서 발행 정보
  invoice_date?: "2025-01-15",
  invoice_amount?: 10000000,

  // 입금 정보
  payment_date?: "2025-01-20",
  payment_amount?: 10000000
}

Response:
{
  success: true,
  data: { /* 업데이트된 사업장 정보 */ },
  message: "계산서 정보가 업데이트되었습니다"
}
```

### 권한 체크

```typescript
// 수정 권한: AuthLevel >= 1
const { user } = useAuth();
if (!user || user.permission_level < 1) {
  return { success: false, message: '권한이 없습니다' };
}
```

---

## 📊 매출 관리 페이지 통합

### 1. 통계 카드 추가

```tsx
<StatsCard
  title="총 미수금"
  value={`${totalReceivables.toLocaleString()}원`}
  subtitle={`미수금 있는 사업장: ${businessesWithReceivables}개`}
  icon={<AlertCircle className="w-6 h-6" />}
  color="red"
/>
```

### 2. 필터 추가

```typescript
const [receivablesFilter, setReceivablesFilter] = useState<'all' | 'has' | 'none'>('all');

const filteredByReceivables = businesses.filter(business => {
  const totalReceivables = calculateTotalReceivables(business);

  if (receivablesFilter === 'has') return totalReceivables > 0;
  if (receivablesFilter === 'none') return totalReceivables === 0;
  return true; // 'all'
});
```

**UI:**
```tsx
<select value={receivablesFilter} onChange={(e) => setReceivablesFilter(e.target.value)}>
  <option value="all">전체</option>
  <option value="has">미수금 있음</option>
  <option value="none">미수금 없음</option>
</select>
```

### 3. 테이블 컬럼 추가

```tsx
<td className="border border-gray-300 px-4 py-2 text-right">
  <span className={totalReceivables > 0 ? 'text-red-600 font-bold' : 'text-gray-600'}>
    {totalReceivables.toLocaleString()}원
    {totalReceivables > 0 && ' ⚠️'}
  </span>
</td>
```

---

## 🔧 유틸리티 함수

### calculateTotalReceivables

```typescript
export function calculateTotalReceivables(business: BusinessInfo): number {
  if (business.business_category === '보조금') {
    const receivable_1st = (business.invoice_1st_amount || 0) - (business.payment_1st_amount || 0);
    const receivable_2nd = (business.invoice_2nd_amount || 0) - (business.payment_2nd_amount || 0);
    const receivable_additional = (business.additional_cost || 0) - (business.payment_additional_amount || 0);
    return receivable_1st + receivable_2nd + receivable_additional;
  } else if (business.business_category === '자비') {
    const receivable_advance = (business.invoice_advance_amount || 0) - (business.payment_advance_amount || 0);
    const receivable_balance = (business.invoice_balance_amount || 0) - (business.payment_balance_amount || 0);
    return receivable_advance + receivable_balance;
  }
  return 0;
}
```

### getInvoiceStatus

```typescript
export function getInvoiceStatus(invoiceAmount: number, paymentAmount: number): 'none' | 'partial' | 'full' {
  if (!invoiceAmount || invoiceAmount === 0) return 'none';
  if (paymentAmount === 0) return 'partial';
  if (paymentAmount >= invoiceAmount) return 'full';
  return 'partial';
}
```

---

## 🚀 구현 순서 (다음 세션)

### Step 1: 데이터베이스 마이그레이션 실행
```sql
-- Supabase SQL Editor에서 실행
-- sql/business_invoice_system.sql 전체 실행
```

### Step 2: API 라우트 구현
```bash
# 파일 생성
app/api/business-invoices/route.ts

# GET, PUT 엔드포인트 구현
# 권한 체크 추가
# 에러 핸들링
```

### Step 3: InvoiceManagement 컴포넌트 생성
```bash
# 파일 생성
components/business/InvoiceManagement.tsx
components/business/InvoiceCard.tsx (서브컴포넌트)

# 보조금/자비 분기 로직
# 폼 구현 (발행, 입금)
# 미수금 계산 및 표시
```

### Step 4: 사업장 상세 모달 통합
```bash
# 파일 수정
app/admin/business/page.tsx

# InvoiceManagement 컴포넌트 import
# 모달 내부에 섹션 추가
# 업데이트 콜백 연결
```

### Step 5: 매출 관리 페이지 업데이트
```bash
# 파일 수정
app/admin/revenue/page.tsx

# 미수금 통계 카드 추가
# 필터 추가
# 테이블 컬럼 추가
```

### Step 6: 테스트
```
1. 보조금 사업장에서 1차/2차/추가공사비 발행 및 입금 테스트
2. 자비 사업장에서 선금/잔금 발행 및 입금 테스트
3. 미수금 계산 정확도 확인
4. 매출 관리 페이지에서 필터 및 통계 확인
5. 권한 체크 테스트 (AuthLevel < 1 사용자)
```

---

## 📝 주의사항

### 추가공사비 필드 처리
- **보조금 사업장**: `additional_cost` 필드 값을 자동으로 "추가공사비 발행금액"에 표시
- 발행금액은 읽기 전용, 입금 정보만 입력 가능
- `additional_cost`가 0이면 추가공사비 섹션 숨김 (선택)

### 자비 사업장 비율 처리
- 기본값: 선금 50%, 잔금 50%
- `total_revenue`가 있으면 자동 계산하여 기본값 제공
- 사용자가 수동으로 금액 조정 가능

### 권한 제어
- **조회**: 모든 로그인 사용자
- **수정/발행/입금**: AuthLevel >= 1

### 날짜 형식
- 데이터베이스: DATE 타입
- UI 입력: `<input type="date">`
- 표시: "YYYY-MM-DD" 형식

---

## 🎯 완성 시 기대 효과

1. ✅ 계산서 발행 및 입금 현황 실시간 확인
2. ✅ 미수금 자동 계산 및 경고 표시
3. ✅ 매출 관리에서 미수금 필터링 및 통계
4. ✅ 보조금/자비 사업장 구분 관리
5. ✅ 권한 기반 접근 제어
6. ✅ 데이터 정합성 보장 (추가공사비 자동 연동)
