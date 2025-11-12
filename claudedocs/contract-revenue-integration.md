# 계약서 매출 데이터 연동 구현

## 📋 문제 해결

**문제**: 계약서 생성 시 매출금액(total_amount)과 추가공사비(installation_extra_cost)가 0으로 표시됨

**원인**: `revenue_calculations` 테이블 조회만 하고, 데이터가 없을 때 대안이 없었음

**해결**: 매출 관리 시스템의 `revenue_calculations` 테이블과 통합

---

## 🔍 매출 관리 시스템 분석

### 데이터 소스

**매출 관리 페이지**: `app/admin/revenue/page.tsx`
**매출 계산 API**: `app/api/revenue/calculate/route.ts`
**데이터 테이블**: `revenue_calculations`

### revenue_calculations 테이블 구조

```sql
CREATE TABLE revenue_calculations (
  id UUID PRIMARY KEY,
  business_id UUID REFERENCES business_info(id),
  business_name TEXT,
  sales_office TEXT,
  calculation_date DATE,

  -- 매출 정보
  total_revenue NUMERIC(12, 2),          -- 총 매출금액
  total_cost NUMERIC(12, 2),             -- 총 비용

  -- 비용 상세
  installation_extra_cost NUMERIC(12, 2), -- 추가설치비 (설치팀 요청 추가 비용)
  sales_commission NUMERIC(12, 2),        -- 영업비용
  adjusted_sales_commission NUMERIC(12, 2), -- 조정된 영업비용
  survey_costs NUMERIC(12, 2),            -- 실사비용
  installation_costs NUMERIC(12, 2),      -- 설치비용

  -- 수익 정보
  gross_profit NUMERIC(12, 2),            -- 총 이익
  net_profit NUMERIC(12, 2),              -- 순 이익

  -- 상세 내역
  equipment_breakdown JSONB,              -- 장비별 상세 내역
  cost_breakdown JSONB,                   -- 비용 상세 내역

  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

---

## ✅ 구현된 해결 방안

### 수정 위치: `app/api/document-automation/contract/route.ts`

#### Before (문제 있는 코드)

```typescript
// 단순히 revenue_calculations 조회만
const { data: revenue } = await supabaseAdmin
  .from('revenue_calculations')
  .select('total_revenue')
  .eq('business_id', business_id)
  .maybeSingle();

const totalAmount = revenue?.total_revenue || 0;  // ⚠️ 데이터 없으면 무조건 0
const additionalCost = 0;  // ⚠️ 하드코딩
```

#### After (개선된 코드)

```typescript
// 1. revenue_calculations에서 최신 데이터 조회
const { data: revenue } = await supabaseAdmin
  .from('revenue_calculations')
  .select('total_revenue, installation_extra_cost')  // ✅ 추가공사비도 조회
  .eq('business_id', business_id)
  .order('calculation_date', { ascending: false })   // ✅ 최신 순 정렬
  .limit(1)
  .maybeSingle();

let totalAmount = 0;
let additionalCost = 0;

if (revenue && revenue.total_revenue) {
  // revenue_calculations에 데이터가 있으면 사용
  totalAmount = revenue.total_revenue || 0;
  additionalCost = revenue.installation_extra_cost || 0;
  console.log('💰 [CONTRACT] revenue_calculations에서 매출 데이터 조회 성공');
} else {
  // 데이터가 없으면 경고 로그 + 폴백
  console.warn('⚠️ [CONTRACT] revenue_calculations에 데이터가 없습니다.');
  console.warn('⚠️ [CONTRACT] 해결 방법: 관리자 > 매출 관리에서 해당 사업장의 매출을 먼저 계산해주세요.');

  // 추가공사비는 business_info에서 폴백
  additionalCost = business.additional_construction_cost || 0;
}

// 협의금액은 여전히 business_info에서
const negotiationCost = business.negotiation
  ? parseFloat(String(business.negotiation).replace(/[^0-9.-]/g, '')) || 0
  : 0;
```

---

## 📊 데이터 흐름

```
매출 관리 시스템
│
├─ 사용자가 "매출 관리" 페이지에서 매출 계산 실행
│  └─> POST /api/revenue/calculate
│      └─> revenue_calculations 테이블에 저장
│          ├─ total_revenue (총 매출금액)
│          ├─ installation_extra_cost (추가설치비)
│          └─ 기타 비용 정보
│
└─ 계약서 생성 시 해당 데이터 조회
   └─> GET revenue_calculations (최신 데이터)
       └─> 계약서에 반영
           ├─ total_amount = total_revenue
           ├─ additional_cost = installation_extra_cost
           └─ negotiation_cost = business_info.negotiation
```

---

## 🎯 사용자 워크플로우

### 정상 플로우 (권장)

1. **매출 관리 페이지** 접속
   - 경로: 관리자 > 매출 관리

2. **사업장 선택** 후 **매출 계산** 실행
   - 버튼: "매출 계산" 또는 "재계산"
   - API: POST `/api/revenue/calculate`

3. **계산 결과 확인**
   - 매출금액, 추가설치비, 협의금액 등 표시

4. **계약서 생성**
   - 문서 자동화 > 계약서 관리
   - 계약서 생성 시 자동으로 매출 데이터 연동

### 데이터 없는 경우

1. **계약서 생성 시도**
   - ⚠️ 매출금액 0원으로 표시
   - 서버 로그에 경고 메시지:
     ```
     ⚠️ [CONTRACT] revenue_calculations에 데이터가 없습니다.
     ⚠️ [CONTRACT] 해결 방법: 관리자 > 매출 관리에서 해당 사업장의 매출을 먼저 계산해주세요.
     ```

2. **매출 관리로 이동**
   - 해당 사업장 매출 계산 실행

3. **계약서 재생성**
   - 이제 정상적으로 매출금액 표시

---

## 🧪 테스트 시나리오

### 시나리오 1: revenue_calculations에 데이터가 있는 경우

**준비**:
1. 매출 관리에서 "(주)동화라이징" 매출 계산 실행
2. 계산 결과 확인:
   - 총 매출: 15,000,000원
   - 추가설치비: 500,000원

**실행**:
1. 계약서 생성

**예상 결과**:
```
✅ 매출금액: ₩15,000,000
✅ 추가공사비: ₩500,000
✅ 협의사항: (business_info.negotiation 값)
```

**로그 확인**:
```
💰 [CONTRACT] revenue_calculations에서 매출 데이터 조회 성공: {
  total_revenue: 15000000,
  installation_extra_cost: 500000
}
```

---

### 시나리오 2: revenue_calculations에 데이터가 없는 경우

**준비**:
1. 매출 계산을 하지 않은 사업장 선택

**실행**:
1. 계약서 생성 시도

**예상 결과**:
```
⚠️ 매출금액: ₩0
⚠️ 추가공사비: ₩0 (또는 business_info.additional_construction_cost 값)
✅ 협의사항: (business_info.negotiation 값)
```

**로그 확인**:
```
⚠️ [CONTRACT] revenue_calculations에 데이터가 없습니다.
⚠️ [CONTRACT] 해결 방법: 관리자 > 매출 관리에서 해당 사업장의 매출을 먼저 계산해주세요.
```

**해결 방법**:
1. 매출 관리 페이지로 이동
2. 해당 사업장 매출 계산 실행
3. 계약서 재생성

---

## 📝 필드 매핑

| 계약서 필드 | 데이터 소스 | revenue_calculations 컬럼 | 폴백 소스 |
|------------|-----------|-------------------------|----------|
| 매출금액 (total_amount) | revenue_calculations | total_revenue | 0 (경고) |
| 추가공사비 (additional_cost) | revenue_calculations | installation_extra_cost | business_info.additional_construction_cost |
| 협의사항 (negotiation_cost) | business_info | - | business_info.negotiation (파싱) |

---

## 🚨 주의사항

### 1. 매출 계산 필수
- 계약서 생성 **전에** 반드시 매출 관리에서 매출 계산을 먼저 실행해야 합니다.
- 매출 계산 없이 계약서를 생성하면 매출금액이 0원으로 표시됩니다.

### 2. 최신 데이터 사용
- `revenue_calculations` 테이블에서 `calculation_date` 기준 **최신 데이터**를 가져옵니다.
- 여러 번 매출을 재계산한 경우, 가장 최근 계산 결과가 사용됩니다.

### 3. 협의금액은 별도 관리
- 협의금액(negotiation_cost)은 `revenue_calculations`가 아닌 `business_info.negotiation`에서 가져옵니다.
- VARCHAR 타입이므로 숫자 파싱 처리가 필요합니다.

---

## 📚 관련 파일

- **계약서 API**: `app/api/document-automation/contract/route.ts`
- **매출 관리 페이지**: `app/admin/revenue/page.tsx`
- **매출 계산 API**: `app/api/revenue/calculate/route.ts`
- **문서**:
  - `claudedocs/contract-equipment-fix.md` (장비 수량 수정)
  - `claudedocs/contract-cost-fields-fix.md` (비용 필드 수정)

---

**작성일**: 2025-11-11
**작성자**: Claude Code
**적용 상태**: ✅ 완료
