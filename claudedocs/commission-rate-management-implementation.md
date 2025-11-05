# 영업점별 제조사별 수수료율 관리 시스템 구현 가이드

**작성일**: 2025-11-05
**목적**: 영업점별로 제조사에 따라 다른 수수료율을 적용하는 유연한 관리 시스템

---

## 📊 시스템 개요

### 비즈니스 요구사항
- 원에너지는 제조사마다 다른 수수료율 적용 (에코센스 15%, 가이아씨앤에스 20%)
- 향후 다른 영업점도 제조사별 차등 수수료율 적용 가능성
- 제조사 추가 가능성
- 수수료율 변경은 연 1회 이하로 드묾

### 구현 방식
**매트릭스 구조** (영업점 × 제조사)
- 모든 영업점이 제조사별로 다른 수수료율 설정 가능
- 수수료율 변경 이력 추적
- 확장성 및 유지보수 용이

---

## 🗄️ 데이터베이스 구조

### 테이블: `sales_office_commission_rates`

```sql
CREATE TABLE sales_office_commission_rates (
  id UUID PRIMARY KEY,
  sales_office TEXT NOT NULL,           -- '원에너지', '푸른에너지' 등
  manufacturer TEXT NOT NULL,            -- 'ecosense', 'gaia_cns', 'cleanearth', 'evs'
  commission_rate DECIMAL(5,2) NOT NULL, -- 15.00, 20.00 등
  effective_from DATE NOT NULL,
  effective_to DATE,                     -- NULL이면 현재 유효
  notes TEXT,
  created_by UUID,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ
);
```

### 뷰: `current_commission_rates`
현재 유효한 수수료율만 조회

### 뷰: `commission_rate_history`
생성자 정보를 포함한 전체 이력

---

## 🔌 API 엔드포인트

### 1. 수수료율 조회 (GET)

```
GET /api/revenue/commission-rates?sales_office=원에너지
```

**응답**:
```json
{
  "success": true,
  "data": {
    "sales_office": "원에너지",
    "rates": [
      {
        "id": "uuid",
        "manufacturer": "ecosense",
        "commission_rate": 15.00,
        "effective_from": "2024-01-01",
        "effective_to": null
      },
      {
        "manufacturer": "gaia_cns",
        "commission_rate": 20.00,
        "effective_from": "2024-01-01"
      }
    ]
  }
}
```

### 2. 수수료율 업데이트 (PUT)

```
PUT /api/revenue/commission-rates
```

**요청 body**:
```json
{
  "sales_office": "원에너지",
  "effective_from": "2025-01-01",
  "rates": [
    {
      "manufacturer": "ecosense",
      "commission_rate": 16.00,
      "notes": "2025년 계약 갱신"
    },
    {
      "manufacturer": "gaia_cns",
      "commission_rate": 21.00
    }
  ]
}
```

### 3. 이력 조회 (GET)

```
GET /api/revenue/commission-rates/history?sales_office=원에너지
```

**응답**:
```json
{
  "success": true,
  "data": {
    "sales_office": "원에너지",
    "history": [
      {
        "manufacturer": "gaia_cns",
        "commission_rate": 20.00,
        "effective_from": "2024-01-01",
        "effective_to": null,
        "is_current": true,
        "created_by_name": "관리자",
        "created_at": "2024-01-01T00:00:00Z"
      },
      {
        "manufacturer": "gaia_cns",
        "commission_rate": 18.00,
        "effective_from": "2023-01-01",
        "effective_to": "2023-12-31",
        "is_current": false
      }
    ]
  }
}
```

### 4. 대량 업데이트 (POST)

```
POST /api/revenue/commission-rates/bulk
```

**요청 body**:
```json
{
  "manufacturer": "ecosense",
  "commission_rate": 16.00,
  "effective_from": "2025-01-01",
  "notes": "에코센스 전사 수수료율 인상",
  "sales_offices": ["원에너지", "푸른에너지"]  // 생략 시 모든 영업점
}
```

**응답**:
```json
{
  "success": true,
  "data": {
    "affected_count": 2,
    "updated_offices": ["원에너지", "푸른에너지"],
    "details": [
      {
        "sales_office": "원에너지",
        "previous_rate": 15.00,
        "new_rate": 16.00
      },
      {
        "sales_office": "푸른에너지",
        "previous_rate": 15.00,
        "new_rate": 16.00
      }
    ]
  }
}
```

---

## 💻 UI 구성

### 메인 화면: 수수료율 관리

```
┌─────────────────────────────────────────────────────────────┐
│ 수수료율 관리                                                 │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│ 영업점 선택: [원에너지 ▼]                                     │
│                                                               │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ 제조사별 수수료율                                          │ │
│ ├────────────────┬──────────────┬─────────────────────┤ │
│ │ 제조사          │ 수수료율 (%)  │ 적용일               │ │
│ ├────────────────┼──────────────┼─────────────────────┤ │
│ │ 에코센스        │ [15.0]       │ 2024-01-01 ~        │ │
│ │ 가이아씨앤에스  │ [20.0]       │ 2024-01-01 ~        │ │
│ │ 크린어스        │ [15.0]       │ 2024-01-01 ~        │ │
│ │ 이브이에스      │ [15.0]       │ 2024-01-01 ~        │ │
│ └────────────────┴──────────────┴─────────────────────┘ │
│                                                               │
│ [수정] [변경 이력 보기] [대량 업데이트]                        │
│                                                               │
└─────────────────────────────────────────────────────────────┘
```

### 이력 조회 모달

```
┌─────────────────────────────────────────────────────────────┐
│ 수수료율 변경 이력 - 원에너지                                  │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│ 제조사 필터: [전체 ▼]                                         │
│                                                               │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ 제조사   수수료율  적용기간              변경자    메모   │ │
│ ├─────────────────────────────────────────────────────────┤ │
│ │ 가이아씨  20.0%   2024-01-01 ~ 현재   관리자   초기설정  │ │
│ │ 앤에스                          ✓현재                    │ │
│ ├─────────────────────────────────────────────────────────┤ │
│ │ 가이아씨  18.0%   2023-01-01 ~ 2023-12-31   관리자      │ │
│ │ 앤에스                                                   │ │
│ └─────────────────────────────────────────────────────────┘ │
│                                                               │
│                          [닫기]                               │
└─────────────────────────────────────────────────────────────┘
```

### 대량 업데이트 모달

```
┌─────────────────────────────────────────────────────────────┐
│ 대량 수수료율 업데이트                                         │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│ 제조사 선택: [에코센스 ▼]                                     │
│                                                               │
│ 새로운 수수료율 (%): [16.0]                                   │
│                                                               │
│ 적용 시작일: [2025-01-01]                                     │
│                                                               │
│ 메모: [2025년 계약 갱신에 따른 인상              ]            │
│                                                               │
│ 적용 대상 영업점:                                             │
│ ☑ 모든 영업점                                                 │
│ ☐ 선택한 영업점만:                                            │
│   ☐ 원에너지  ☐ 푸른에너지  ☐ 그린에너지                      │
│                                                               │
│ ─────────────────────────────────────────────────────────── │
│ 영향 미리보기:                                                │
│ • 원에너지: 15.0% → 16.0% (+1.0%)                             │
│ • 푸른에너지: 15.0% → 16.0% (+1.0%)                           │
│ • 그린에너지: 15.0% → 16.0% (+1.0%)                           │
│                                                               │
│ 총 3개 영업점이 영향을 받습니다.                               │
│                                                               │
│               [취소]        [업데이트 실행]                    │
└─────────────────────────────────────────────────────────────┘
```

---

## 🔨 구현 파일 목록

### 완료된 파일
1. ✅ `sql/commission_rates_schema.sql` - 데이터베이스 스키마
2. ✅ `types/commission.ts` - TypeScript 타입 정의
3. ✅ `app/api/revenue/commission-rates/route.ts` - 조회/업데이트 API

### 구현 필요 파일

#### API
4. `app/api/revenue/commission-rates/history/route.ts`
   - 이력 조회 API
   - 영업점별/제조사별 필터링

5. `app/api/revenue/commission-rates/bulk/route.ts`
   - 대량 업데이트 API
   - 영향받는 영업점 미리보기

#### UI 컴포넌트
6. `components/revenue/CommissionRateManager.tsx`
   - 메인 수수료율 관리 화면
   - 영업점 선택 및 제조사별 수수료율 표시/수정

7. `components/revenue/CommissionRateHistory.tsx`
   - 이력 조회 모달
   - 제조사별 필터링 및 시간순 표시

8. `components/revenue/BulkCommissionUpdate.tsx`
   - 대량 업데이트 모달
   - 영향 미리보기

#### 유틸리티
9. `lib/commission-calculator.ts`
   - 수수료 계산 함수
   - 특정 날짜의 수수료율 조회

---

## 📝 구현 코드 예시

### 이력 조회 API

```typescript
// app/api/revenue/commission-rates/history/route.ts
export const GET = withApiHandler(async (request: NextRequest) => {
  const { authorized } = await checkUserPermission(request)
  if (!authorized) {
    return createErrorResponse('권한이 없습니다', 403)
  }

  const { searchParams } = new URL(request.url)
  const salesOffice = searchParams.get('sales_office')
  const manufacturer = searchParams.get('manufacturer')

  try {
    let query = supabaseAdmin
      .from('commission_rate_history')
      .select('*')

    if (salesOffice) {
      query = query.eq('sales_office', salesOffice)
    }

    if (manufacturer) {
      query = query.eq('manufacturer', manufacturer)
    }

    const { data, error } = await query.order('effective_from', { ascending: false })

    if (error) throw error

    return createSuccessResponse({
      sales_office: salesOffice,
      manufacturer,
      history: data || [],
      total: data?.length || 0
    })
  } catch (error) {
    return createErrorResponse('이력 조회 중 오류가 발생했습니다', 500)
  }
})
```

### 대량 업데이트 API

```typescript
// app/api/revenue/commission-rates/bulk/route.ts
export const POST = withApiHandler(async (request: NextRequest) => {
  const { authorized, user } = await checkUserPermission(request)
  if (!authorized || !user) {
    return createErrorResponse('권한이 없습니다', 403)
  }

  const body: BulkCommissionRateUpdate = await request.json()
  const { manufacturer, commission_rate, effective_from, notes, sales_offices } = body

  try {
    // 1. 대상 영업점 결정
    let targetOffices = sales_offices
    if (!targetOffices || targetOffices.length === 0) {
      // 모든 영업점
      const { data: allOffices } = await supabaseAdmin
        .from('current_commission_rates')
        .select('sales_office')
        .eq('manufacturer', manufacturer)

      targetOffices = [...new Set(allOffices?.map(o => o.sales_office))]
    }

    // 2. 현재 수수료율 조회 (변경 전후 비교)
    const { data: currentRates } = await supabaseAdmin
      .from('current_commission_rates')
      .select('*')
      .eq('manufacturer', manufacturer)
      .in('sales_office', targetOffices)

    // 3. 각 영업점별로 업데이트
    const previousDay = new Date(effective_from)
    previousDay.setDate(previousDay.getDate() - 1)

    // 기존 수수료율 종료
    await supabaseAdmin
      .from('sales_office_commission_rates')
      .update({ effective_to: previousDay.toISOString().split('T')[0] })
      .eq('manufacturer', manufacturer)
      .in('sales_office', targetOffices)
      .is('effective_to', null)

    // 새로운 수수료율 추가
    const newRates = targetOffices.map(office => ({
      sales_office: office,
      manufacturer,
      commission_rate,
      effective_from,
      notes,
      created_by: user.id
    }))

    const { data: inserted } = await supabaseAdmin
      .from('sales_office_commission_rates')
      .insert(newRates)
      .select()

    // 4. 변경 상세 정보 생성
    const details = targetOffices.map(office => {
      const prevRate = currentRates?.find(r => r.sales_office === office)
      return {
        sales_office: office,
        previous_rate: prevRate?.commission_rate || null,
        new_rate: commission_rate
      }
    })

    return createSuccessResponse({
      affected_count: inserted?.length || 0,
      updated_offices: targetOffices,
      details
    })
  } catch (error) {
    return createErrorResponse('대량 업데이트 중 오류가 발생했습니다', 500)
  }
})
```

### 수수료 계산 유틸리티

```typescript
// lib/commission-calculator.ts
export async function calculateCommission(
  salesOffice: string,
  manufacturer: Manufacturer,
  revenue: number,
  calculationDate: Date = new Date()
): Promise<CommissionCalculationResult> {
  const dateStr = calculationDate.toISOString().split('T')[0]

  const { data: rate, error } = await supabaseAdmin
    .from('sales_office_commission_rates')
    .select('commission_rate')
    .eq('sales_office', salesOffice)
    .eq('manufacturer', manufacturer)
    .lte('effective_from', dateStr)
    .or(`effective_to.is.null,effective_to.gte.${dateStr}`)
    .single()

  if (error || !rate) {
    throw new Error(`수수료율을 찾을 수 없습니다: ${salesOffice} - ${manufacturer}`)
  }

  const commissionAmount = revenue * (rate.commission_rate / 100)

  return {
    revenue,
    commission_rate: rate.commission_rate,
    commission_amount: commissionAmount,
    sales_office: salesOffice,
    manufacturer,
    calculation_date: dateStr
  }
}

// 사용 예시
const result = await calculateCommission('원에너지', 'gaia_cns', 1000000)
console.log(`매출: ${result.revenue}원`)
console.log(`수수료율: ${result.commission_rate}%`)
console.log(`수수료: ${result.commission_amount}원`)
// 원에너지 × 가이아씨앤에스 = 20% → 200,000원
```

---

## 🚀 구현 순서 및 예상 시간

### Phase 1: 기본 기능 (3-4시간)
1. ✅ **데이터베이스 스키마** (완료)
2. ✅ **타입 정의** (완료)
3. ✅ **조회/업데이트 API** (완료)
4. **메인 UI 컴포넌트** (2시간)
   - 영업점 선택
   - 제조사별 수수료율 표시/수정

### Phase 2: 이력 기능 (1-2시간)
5. **이력 조회 API** (30분)
6. **이력 UI** (1시간)
   - 모달 형태
   - 제조사별 필터
   - 시간순 정렬

### Phase 3: 대량 업데이트 (2-3시간)
7. **대량 업데이트 API** (1시간)
   - 영향 미리보기
   - 트랜잭션 처리
8. **대량 업데이트 UI** (1.5시간)
   - 제조사 선택
   - 영향 미리보기
   - 확인 단계

### Phase 4: 통합 및 테스트 (1-2시간)
9. **수수료 계산 통합** (30분)
   - 매출 관리 시스템에 적용
10. **테스트** (1시간)
    - 원에너지 특수 케이스 검증
    - 대량 업데이트 검증

**총 예상 시간**: 7-11시간

---

## 🧪 테스트 시나리오

### 1. 기본 수수료율 조회
```typescript
// 원에너지 수수료율 확인
const response = await fetch('/api/revenue/commission-rates?sales_office=원에너지')
const data = await response.json()

// 검증
expect(data.data.rates).toHaveLength(4)
expect(data.data.rates.find(r => r.manufacturer === 'gaia_cns').commission_rate).toBe(20.00)
expect(data.data.rates.find(r => r.manufacturer === 'ecosense').commission_rate).toBe(15.00)
```

### 2. 수수료율 업데이트
```typescript
// 2025년 수수료율 변경
await fetch('/api/revenue/commission-rates', {
  method: 'PUT',
  body: JSON.stringify({
    sales_office: '원에너지',
    effective_from: '2025-01-01',
    rates: [
      { manufacturer: 'gaia_cns', commission_rate: 21.00, notes: '계약 갱신' }
    ]
  })
})

// 검증: 2024년 데이터는 effective_to가 설정됨
// 검증: 2025년 데이터가 새로 생성됨
```

### 3. 이력 조회
```typescript
// 가이아씨앤에스 수수료율 변경 이력
const history = await fetch('/api/revenue/commission-rates/history?sales_office=원에너지&manufacturer=gaia_cns')
const data = await history.json()

// 검증: 최신 이력이 먼저 나옴
// 검증: is_current 플래그가 정확함
```

### 4. 대량 업데이트
```typescript
// 모든 영업점의 에코센스 수수료율 인상
await fetch('/api/revenue/commission-rates/bulk', {
  method: 'POST',
  body: JSON.stringify({
    manufacturer: 'ecosense',
    commission_rate: 16.00,
    effective_from: '2025-01-01',
    notes: '전사 인상'
  })
})

// 검증: 모든 영업점의 에코센스 수수료율이 16%로 변경됨
```

### 5. 수수료 계산
```typescript
// 원에너지 × 가이아씨앤에스 × 1,000,000원
const result = await calculateCommission('원에너지', 'gaia_cns', 1000000)

// 검증
expect(result.commission_rate).toBe(20.00)
expect(result.commission_amount).toBe(200000)
```

---

## 📌 주의사항

### 데이터 무결성
- 동일한 영업점/제조사/적용일 조합은 unique
- 수수료율은 0~100% 범위
- effective_to는 effective_from 이후여야 함

### 성능 최적화
- 인덱스 활용: sales_office + manufacturer
- 뷰 활용: current_commission_rates (현재 유효한 것만)
- 페이지네이션: 이력 조회 시 필요

### 보안
- 권한 레벨 3 이상만 조회/수정 가능
- 변경 이력에 created_by 기록
- API 토큰 검증 필수

---

## 🎯 향후 확장 가능성

1. **예정된 변경**: 미래 날짜 수수료율 미리 설정
2. **알림 시스템**: 수수료율 변경 시 이메일 알림
3. **승인 워크플로우**: 대량 업데이트는 승인 필요
4. **통계 대시보드**: 제조사별/영업점별 평균 수수료율
5. **자동 계산**: 매출 데이터 입력 시 자동 수수료 계산

---

## 📚 참고 자료

- 데이터베이스 스키마: `sql/commission_rates_schema.sql`
- 타입 정의: `types/commission.ts`
- API 구현: `app/api/revenue/commission-rates/route.ts`

---

작성자: Claude Code
최종 수정: 2025-11-05
