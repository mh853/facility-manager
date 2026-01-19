# 하이브리드 순이익 계산 구현

## 📊 작성일
2026-01-19

## 🎯 구현 개요

대시보드 API에 **하이브리드 순이익 계산** 방식을 적용했습니다.

**옵션 1 (하이브리드)**: 매출관리에서 계산된 값 우선 사용, 없으면 실시간 계산

---

## 💡 구현 동작 방식

### 단계별 프로세스

```
1. 사업장 목록 조회 (installation_date IS NOT NULL)
   ↓
2. revenue_calculations 테이블에서 저장된 계산 결과 조회
   ↓
3. 사업장별 순환:
   ├─ 저장된 계산 있음? → ✅ 저장된 순이익 사용 (정밀값)
   └─ 저장된 계산 없음? → ⚡ 실시간 계산 (근사값)
   ↓
4. 월별 집계 및 통계 생성
```

---

## 🔧 핵심 코드 구현

### 1. 저장된 계산 조회 ([route.ts:167-206](app/api/dashboard/revenue/route.ts#L167-L206))

```typescript
// 2-4. 매출관리에서 계산된 순이익 조회 (옵션 1: 하이브리드 방식)
const savedCalculationsMap: Record<string, any> = {};

if (businessIds.length > 0) {
  // 사업장별 최신 계산 결과 조회 (DISTINCT ON 사용)
  const savedCalculations = await queryAll(
    `SELECT DISTINCT ON (business_id)
      business_id,
      calculation_date,
      total_revenue,
      total_cost,
      gross_profit,
      sales_commission,
      adjusted_sales_commission,
      survey_costs,
      installation_costs,
      net_profit,
      created_at
    FROM revenue_calculations
    WHERE business_id = ANY($1)
    ORDER BY business_id, calculation_date DESC, created_at DESC`,
    [businessIds]
  );

  // 사업장별 계산 결과 맵 생성
  savedCalculations?.forEach(calc => {
    savedCalculationsMap[calc.business_id] = {
      total_revenue: Number(calc.total_revenue) || 0,
      total_cost: Number(calc.total_cost) || 0,
      net_profit: Number(calc.net_profit) || 0,
      calculation_date: calc.calculation_date,
      source: 'saved'
    };
  });
}
```

### 2. 하이브리드 순이익 계산 ([route.ts:442-481](app/api/dashboard/revenue/route.ts#L442-L481))

```typescript
// 🎯 옵션 1: 하이브리드 순이익 계산
const savedCalc = savedCalculationsMap[business.id];

let finalRevenue: number;
let finalCost: number;
let finalNetProfit: number;
let calculationSource: string;

if (savedCalc) {
  // ✅ 매출관리에서 계산된 정밀한 값 사용
  finalRevenue = savedCalc.total_revenue;
  finalCost = savedCalc.total_cost;
  finalNetProfit = savedCalc.net_profit;
  calculationSource = 'saved';

  console.log(`[DEBUG] ✅ ${business.business_name}: 저장된 계산 사용`);
  console.log(`[DEBUG]   - 순이익: ${finalNetProfit.toLocaleString()}원 (저장값)`);
} else {
  // ⚡ 실시간 계산 (매출관리에서 계산 안 된 사업장)
  const totalCost = Number(manufacturerCost) || 0;
  const grossProfit = (Number(businessRevenue) || 0) - totalCost;

  finalRevenue = businessRevenue;
  finalCost = totalCost;
  finalNetProfit = grossProfit -
                    (Number(salesCommission) || 0) -
                    (Number(totalSurveyCosts) || 0) -
                    (Number(totalInstallationCosts) || 0) -
                    (Number(installationExtraCost) || 0);
  calculationSource = 'realtime';

  console.log(`[DEBUG] ⚡ ${business.business_name}: 실시간 계산`);
  console.log(`[DEBUG]   - 순이익: ${finalNetProfit.toLocaleString()}원 (실시간)`);
}
```

### 3. 계산 통계 추적 ([route.ts:494-502](app/api/dashboard/revenue/route.ts#L494-L502))

```typescript
// 계산 소스 추적 (통계용)
if (!current.calculationStats) {
  current.calculationStats = { saved: 0, realtime: 0 };
}
if (calculationSource === 'saved') {
  current.calculationStats.saved += 1;
} else {
  current.calculationStats.realtime += 1;
}
```

---

## 📊 현재 상태

### 테스트 결과 (2026-01-19)

```
📊 전체 사업장: 1,224개
💾 계산 저장된 사업장: 0개
⚡ 실시간 계산 필요: 1,224개

📈 저장 비율: 0.0%
```

→ 현재는 `revenue_calculations` 테이블에 저장된 데이터가 없어서 모두 **실시간 계산** 사용 중

### API 응답 (2025-07월)

```json
{
  "month": "2025-07",
  "revenue": 1290720000,
  "cost": 338379000,
  "profit": 688936000,
  "profitRate": 53.38,
  "count": 224
}
```

---

## 🎯 장점

### 1. 유연성
- 매출관리에서 계산된 사업장 → 정밀한 순이익 (조정값 모두 반영)
- 아직 계산 안 된 사업장 → 실시간 계산으로 폴백
- **모든 사업장이 빠짐없이 표시됨**

### 2. 정확성
- 매출관리에서 계산 시:
  - ✅ 영업비용 조정 (`operating_cost_adjustments`)
  - ✅ 사업장별 추가 설치비 (`business_additional_installation_cost`)
  - ✅ 실사비 조정 (`survey_fee_adjustment`)

- 실시간 계산 시:
  - ⚡ 기본 설치비만 반영
  - ⚡ 영업비용 조정 미반영

### 3. 성능
- 한 번의 쿼리로 모든 저장된 계산 조회 (DISTINCT ON 최적화)
- N+1 쿼리 문제 없음

### 4. 추적 가능성
- 각 월별 집계에 `calculationStats` 포함
- 저장값 vs 실시간 계산 비율 확인 가능

---

## 📈 향후 개선 방안

### 1. 매출관리 페이지 사용 활성화

매출관리 페이지에서 사업장별 계산을 수행하면:

```
현재: 저장 0% → 모두 실시간 계산
↓
목표: 저장 80%+ → 대부분 정밀값 사용
```

**기대 효과**:
- 더 정확한 순이익 표시 (조정값 모두 반영)
- 대시보드 로딩 속도 향상 (복잡한 계산 생략)

### 2. 배치 계산 스케줄러

매일 자동으로 모든 사업장 계산:

```typescript
// 예: 매일 새벽 2시 자동 계산
cron.schedule('0 2 * * *', async () => {
  const businesses = await getAllActiveBusinesses();

  for (const business of businesses) {
    await calculateRevenue(business.id);
  }
});
```

### 3. 계산 만료 정책

저장된 계산이 오래되면 재계산:

```typescript
const CALCULATION_EXPIRY_DAYS = 30;

if (savedCalc) {
  const daysSinceCalc = daysBetween(savedCalc.calculation_date, today);

  if (daysSinceCalc > CALCULATION_EXPIRY_DAYS) {
    // 재계산 필요
    calculationSource = 'realtime';
  }
}
```

---

## 🧪 테스트 방법

### 1. 현재 상태 확인

```bash
curl -s "http://localhost:3000/api/dashboard/revenue?months=2025-07" | jq '.data[] | select(.month == "2025-07")'
```

### 2. 매출관리에서 계산 후 재확인

```bash
# 1. admin/revenue 페이지에서 사업장 선택 → 계산 버튼 클릭
# 2. 대시보드 API 다시 호출
curl -s "http://localhost:3000/api/dashboard/revenue?months=2025-07" | jq '.data[] | select(.month == "2025-07")'

# 3. 서버 로그 확인
# → "[DEBUG] ✅ {사업장명}: 저장된 계산 사용" 로그가 나타나야 함
```

### 3. 저장 비율 확인

```javascript
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function checkSavedRatio() {
  const { data: businesses } = await supabase
    .from('business_info')
    .select('id')
    .eq('is_active', true)
    .not('installation_date', 'is', null);

  const { data: saved } = await supabase
    .from('revenue_calculations')
    .select('business_id')
    .in('business_id', businesses.map(b => b.id));

  const unique = new Set(saved?.map(s => s.business_id) || []);

  console.log('저장 비율:', (unique.size / businesses.length * 100).toFixed(1) + '%');
}
```

---

## 📝 주요 변경 파일

- **[app/api/dashboard/revenue/route.ts](app/api/dashboard/revenue/route.ts)**: 하이브리드 계산 로직 추가

---

## 🎓 학습 내용

### PostgreSQL DISTINCT ON

사업장별 최신 계산 결과만 조회:

```sql
SELECT DISTINCT ON (business_id)
  business_id,
  calculation_date,
  net_profit
FROM revenue_calculations
WHERE business_id = ANY($1)
ORDER BY business_id, calculation_date DESC, created_at DESC
```

- `DISTINCT ON (business_id)`: 각 사업장별 첫 번째 row만 선택
- `ORDER BY business_id, calculation_date DESC`: 최신 계산일 우선
- `created_at DESC`: 같은 날짜면 최신 생성 시간 우선

### 타입 안정성

```typescript
let finalRevenue: number;
let finalCost: number;
let finalNetProfit: number;
let calculationSource: string;

// 명시적 타입 선언으로 실수 방지
```

---

**작성자**: Claude Code
**최종 수정**: 2026-01-19
**상태**: ✅ 구현 완료 - 하이브리드 순이익 계산 활성화
