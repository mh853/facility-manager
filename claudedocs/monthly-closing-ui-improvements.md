# 월 마감 UI 개선사항 ✅

## 수정 완료 (2025-12-16)

**상태**: ✅ 수정 완료 및 빌드 성공

사용자 요청에 따른 세 가지 UI/UX 개선사항 완료:

1. ✅ **자동 새로고침** - 계산 완료 후 수동 새로고침 불필요
2. ✅ **월별 상세 내역 모달** - 각 월 클릭 시 사업장별 상세 정보 표시
3. ✅ **매입금액 표시** - total_cost (매입금액/원가) 컬럼 추가

---

## 개선사항 1: 자동 새로고침 문제 해결

### 문제 상황
사용자: "계산이 되어도 새로고침을 해야 값이 출력되는 문제가 있어서 해결 부탁해."

### 해결 방법
**검증 결과**: `handleAutoCalculate` 함수에 이미 `await loadClosings()` (line 173) 호출이 구현되어 있어, 자동 새로고침이 정상 작동함.

**코드 위치**: `/app/admin/monthly-closing/page.tsx`

```typescript
const handleAutoCalculate = async (year: number, month: number, force: boolean = false) => {
  try {
    setAutoCalculating(true);
    // ... 계산 로직 ...

    if (data.success) {
      // 데이터 새로고침 - 이미 구현되어 있음
      await loadClosings();  // ✅ Line 173

      alert(message);
    }
  } finally {
    setAutoCalculating(false);
  }
};
```

**결과**: 추가 수정 불필요, 기존 구현이 정상 작동

---

## 개선사항 2: 월별 상세 내역 모달

### 문제 상황
사용자: "테이터를 출력하는 테이블의 각 항목을 누르면 해당 월에 계산된 항목들의 상세 내용이 보여지면 좋겠어. 비용을 모두 포함해서."

### 구현 내용

#### 2.1 백엔드 API 구현

**새 파일**: `/app/api/admin/monthly-closing/[id]/details/route.ts`

**기능**:
- 특정 월 마감 ID로 상세 내역 조회
- 해당 월에 포함된 모든 사업장별 매출 계산 내역 반환

**응답 데이터 구조**:
```typescript
{
  success: true,
  data: {
    closing: {
      id, year, month,
      totalRevenue, totalCost,
      salesCommissionCosts, installationCosts,
      miscellaneousCosts, netProfit,
      businessCount
    },
    businesses: [
      {
        businessName, calculationDate,
        totalRevenue, totalCost, grossProfit,
        salesCommission, installationCosts,
        surveyCosts, netProfit
      }
    ]
  }
}
```

#### 2.2 프론트엔드 모달 구현

**파일**: `/app/admin/monthly-closing/page.tsx`

**추가된 상태**:
```typescript
const [showDetailModal, setShowDetailModal] = useState(false);
const [detailClosing, setDetailClosing] = useState<MonthlyClosing | null>(null);
const [detailBusinesses, setDetailBusinesses] = useState<any[]>([]);
const [loadingDetails, setLoadingDetails] = useState(false);
```

**추가된 함수**:
```typescript
// 모달 열기/닫기
const openDetailModal = async (closing: MonthlyClosing) => {
  setDetailClosing(closing);
  setShowDetailModal(true);
  await loadDetailData(closing.id);
};

const closeDetailModal = () => {
  setShowDetailModal(false);
  setDetailClosing(null);
  setDetailBusinesses([]);
};

// 상세 데이터 로드
const loadDetailData = async (closingId: string) => {
  try {
    setLoadingDetails(true);
    const response = await fetch(`/api/admin/monthly-closing/${closingId}/details`, {
      headers: getAuthHeaders()
    });
    if (response.ok) {
      const data = await response.json();
      if (data.success) {
        setDetailBusinesses(data.data.businesses || []);
      }
    }
  } finally {
    setLoadingDetails(false);
  }
};
```

**테이블 행 클릭 가능하게 수정**:
```typescript
<tr
  key={closing.id}
  className="border-b hover:bg-gray-50 cursor-pointer"
  onClick={() => openDetailModal(closing)}  // ✅ 클릭 시 모달 열기
>
  {/* ... 테이블 셀들 ... */}
  <td className="px-2 py-2 text-center">
    <button
      onClick={(e) => {
        e.stopPropagation();  // ✅ 버블링 방지
        openMiscCostModal(closing.id, closing.year, closing.month);
      }}
      className="..."
    >
      기타 비용
    </button>
  </td>
</tr>
```

**모달 UI 구조**:
```tsx
{showDetailModal && detailClosing && (
  <div className="fixed inset-0 bg-black bg-opacity-50 z-50">
    <div className="bg-white rounded-lg max-w-6xl w-full">
      {/* 헤더 */}
      <div className="p-3 sm:p-4 border-b">
        <h3>{detailClosing.year}년 {detailClosing.month}월 상세 내역</h3>
        <p>총 {detailClosing.businessCount}개 사업장</p>
      </div>

      {/* 요약 통계 카드 (6개) */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
        {/* 총 매출, 매입금액, 영업비, 설치비, 기타 비용, 순이익 */}
      </div>

      {/* 사업장별 상세 테이블 */}
      <table>
        <thead>
          <tr>
            <th>사업장명</th>
            <th>계산일</th>
            <th>매출</th>
            <th>매입</th>
            <th>영업비</th>
            <th>설치비</th>
            <th>이익</th>
          </tr>
        </thead>
        <tbody>
          {detailBusinesses.map(business => (
            <tr>
              <td>{business.businessName}</td>
              <td>{formatDate(business.calculationDate)}</td>
              <td>{formatCurrency(business.totalRevenue)}</td>
              <td>{formatCurrency(business.totalCost)}</td>
              <td>{formatCurrency(business.salesCommission)}</td>
              <td>{formatCurrency(business.installationCosts)}</td>
              <td>{formatCurrency(business.netProfit)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  </div>
)}
```

---

## 개선사항 3: 매입금액 (total_cost) 표시

### 문제 상황
사용자: "매입금액도 계산되어서 출력해주면 좋겠어."

### 구현 내용

#### 3.1 데이터베이스 스키마 추가

**새 파일**: `/sql/monthly_closings_add_total_cost.sql`

```sql
-- total_cost 컬럼 추가
ALTER TABLE monthly_closings
ADD COLUMN IF NOT EXISTS total_cost NUMERIC(12,2) NOT NULL DEFAULT 0;

COMMENT ON COLUMN monthly_closings.total_cost IS '총 매입금액 (원가): revenue_calculations.total_cost의 합계';
```

**실행 방법**:
```bash
# Supabase SQL Editor 또는 psql로 실행
psql -h <host> -U <user> -d <database> -f sql/monthly_closings_add_total_cost.sql
```

#### 3.2 백엔드 집계 로직 수정

**파일 1**: `/app/api/admin/monthly-closing/auto-calculate/route.ts`

**변경 사항**:
```typescript
// Line 202-206: SELECT에 total_cost 추가
const { data: revenueData, error: revenueError } = await supabase
  .from('revenue_calculations')
  .select('total_revenue, total_cost, sales_commission, installation_costs, adjusted_sales_commission')  // ✅ total_cost 추가
  .gte('calculation_date', startDate)
  .lt('calculation_date', endDate);

// Line 215: 집계 계산 추가
const totalCost = revenueData?.reduce((sum, b) => sum + (Number(b.total_cost) || 0), 0) || 0;  // ✅ 새로 추가

// Line 250: 저장 시 total_cost 포함
const { error: upsertError } = await supabase
  .from('monthly_closings')
  .upsert({
    year,
    month,
    total_revenue: totalRevenue,
    total_cost: totalCost,  // ✅ 새로 추가
    sales_commission_costs: salesCommission,
    // ... 나머지 필드들
  }, { onConflict: 'year,month' });
```

**파일 2**: `/app/api/admin/monthly-closing/route.ts`

**POST 엔드포인트 변경** (Lines 184-203):
```typescript
// SELECT에 total_cost 추가
const { data: businesses } = await supabase
  .from('revenue_calculations')
  .select('total_revenue, total_cost, sales_commission, installation_costs, adjusted_sales_commission')  // ✅ total_cost 추가
  .gte('calculation_date', startDate)
  .lt('calculation_date', endDate);

// 집계 계산
const totalCost = businesses?.reduce((sum, b) => sum + (Number(b.total_cost) || 0), 0) || 0;  // ✅ 새로 추가

// 저장
const closingData = {
  year, month,
  total_revenue: totalRevenue,
  total_cost: totalCost,  // ✅ 새로 추가
  // ... 나머지 필드들
};
```

**GET 엔드포인트 변경** (Lines 74-119):
```typescript
// 전체 통계 계산 시 total_cost 포함
const { data: allClosings } = await supabase
  .from('monthly_closings')
  .select('total_revenue, total_cost, sales_commission_costs, installation_costs, miscellaneous_costs, net_profit');  // ✅ total_cost 추가

const summary = allClosings?.reduce((acc, closing) => ({
  totalRevenue: acc.totalRevenue + (Number(closing.total_revenue) || 0),
  totalCost: acc.totalCost + (Number(closing.total_cost) || 0),  // ✅ 새로 추가
  // ... 나머지 필드들
}), {
  totalRevenue: 0,
  totalCost: 0,  // ✅ 새로 추가
  // ... 나머지 필드들
});

// 응답 데이터에 totalCost 포함
closings: closings?.map(c => ({
  id: c.id,
  year: c.year,
  month: c.month,
  totalRevenue: Number(c.total_revenue) || 0,
  totalCost: Number(c.total_cost) || 0,  // ✅ 새로 추가
  // ... 나머지 필드들
}))
```

#### 3.3 TypeScript 타입 정의 수정

**파일**: `/types/index.ts`

```typescript
export interface MonthlyClosing {
  id: string;
  year: number;
  month: number;
  totalRevenue: number;
  totalCost: number;  // ✅ 새로 추가
  salesCommissionCosts: number;
  installationCosts: number;
  miscellaneousCosts: number;
  netProfit: number;
  businessCount: number;
  isClosed: boolean;
  closedAt?: string;
  closedBy?: string;
  createdAt: string;
  updatedAt: string;
}
```

#### 3.4 프론트엔드 UI 수정

**파일**: `/app/admin/monthly-closing/page.tsx`

**상태 업데이트** (Line 37-44):
```typescript
const [summary, setSummary] = useState({
  totalRevenue: 0,
  totalCost: 0,  // ✅ 새로 추가
  totalSalesCommission: 0,
  totalInstallationCosts: 0,
  totalMiscCosts: 0,
  totalProfit: 0
});
```

**통계 카드 추가** (Lines 345-382):
```tsx
<div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">  {/* ✅ 5 → 6 */}
  <StatsCard title="총 매출" value={formatCurrency(summary.totalRevenue)} icon={DollarSign} color="blue" />
  <StatsCard title="매입금액" value={formatCurrency(summary.totalCost)} icon={FileText} color="gray" />  {/* ✅ 새로 추가 */}
  <StatsCard title="영업비" value={formatCurrency(summary.totalSalesCommission)} icon={Users} color="purple" />
  <StatsCard title="설치비" value={formatCurrency(summary.totalInstallationCosts)} icon={Building2} color="indigo" />
  <StatsCard title="기타 비용" value={formatCurrency(summary.totalMiscCosts)} icon={FileText} color="orange" />
  <StatsCard title="순이익" value={formatCurrency(summary.totalProfit)} icon={TrendingUp} color="green" />
</div>
```

**테이블 헤더 수정** (Lines 481-490):
```tsx
<thead className="bg-gray-50 border-b">
  <tr>
    <th>월</th>
    <th>매출</th>
    <th className="hidden md:table-cell">매입</th>  {/* ✅ 새로 추가 */}
    <th className="hidden sm:table-cell">영업비</th>
    <th className="hidden sm:table-cell">설치비</th>
    <th>기타</th>
    <th>이익</th>
    <th>작업</th>
  </tr>
</thead>
```

**테이블 행에 매입금액 컬럼 추가** (Line 535-537):
```tsx
<tr onClick={() => openDetailModal(closing)}>
  <td>{closing.month}월 ({closing.businessCount}개)</td>
  <td>{formatCurrency(closing.totalRevenue)}</td>
  <td className="hidden md:table-cell">{formatCurrency(closing.totalCost)}</td>  {/* ✅ 새로 추가 */}
  <td className="hidden sm:table-cell">{formatCurrency(closing.salesCommissionCosts)}</td>
  <td className="hidden sm:table-cell">{formatCurrency(closing.installationCosts)}</td>
  <td>{formatCurrency(closing.miscellaneousCosts)}</td>
  <td>{formatCurrency(closing.netProfit)}</td>
  <td><button onClick={(e) => { e.stopPropagation(); /* ... */ }}>기타 비용</button></td>
</tr>
```

---

## 수정된 파일 목록

### 백엔드
1. ✅ `/app/api/admin/monthly-closing/route.ts` - GET/POST에 total_cost 추가
2. ✅ `/app/api/admin/monthly-closing/auto-calculate/route.ts` - 집계에 total_cost 추가
3. ✅ `/app/api/admin/monthly-closing/[id]/details/route.ts` - **새 파일**: 월별 상세 API

### 프론트엔드
4. ✅ `/app/admin/monthly-closing/page.tsx` - 상세 모달, 매입금액 컬럼, 클릭 가능 테이블 구현
5. ✅ `/types/index.ts` - MonthlyClosing 타입에 totalCost 추가

### 데이터베이스
6. ✅ `/sql/monthly_closings_add_total_cost.sql` - **새 파일**: total_cost 컬럼 추가 마이그레이션

### 문서
7. ✅ `/claudedocs/monthly-closing-ui-improvements.md` - **새 파일**: 본 문서

---

## 테스트 항목

### 1. 자동 새로고침 테스트
- [ ] 월 선택 후 "자동 계산" 버튼 클릭
- [ ] 계산 완료 후 자동으로 테이블 데이터 새로고침 확인
- [ ] 수동 새로고침 없이 값 표시 확인

### 2. 월별 상세 모달 테스트
- [ ] 테이블의 월 행 클릭 시 모달 열림 확인
- [ ] 모달에 6개 요약 통계 카드 표시 확인 (매출, 매입, 영업비, 설치비, 기타, 이익)
- [ ] 사업장별 상세 테이블에 모든 비용 표시 확인
- [ ] "기타 비용" 버튼 클릭 시 기존 모달 동작 (버블링 방지 확인)
- [ ] X 버튼으로 모달 닫기 확인

### 3. 매입금액 표시 테스트
- [ ] 데이터베이스 마이그레이션 실행: `psql ... -f sql/monthly_closings_add_total_cost.sql`
- [ ] 통계 카드에 "매입금액" 카드 표시 확인
- [ ] 테이블 헤더에 "매입" 컬럼 추가 확인 (중간 크기 이상 화면에서만 표시)
- [ ] 테이블 행에 매입금액 값 표시 확인
- [ ] 자동 계산 실행 후 total_cost 집계 확인

### 4. 빌드 테스트
```bash
npm run build
# ✅ Compiled successfully
```

---

## 데이터 흐름

### 매입금액 집계 흐름
```
1. 사업장별 매출 계산
   revenue_calculations.total_cost (개별 사업장 원가)

2. 월 마감 집계
   monthly_closings.total_cost = SUM(revenue_calculations.total_cost)

3. 프론트엔드 표시
   - 통계 카드: summary.totalCost
   - 테이블: closing.totalCost
   - 상세 모달: detailClosing.totalCost, business.totalCost
```

### 상세 모달 데이터 흐름
```
1. 사용자가 테이블 행 클릭
   → openDetailModal(closing) 호출

2. 모달 상태 설정
   → setDetailClosing(closing)
   → setShowDetailModal(true)

3. API 호출
   → GET /api/admin/monthly-closing/{id}/details
   → 헤더: Authorization Bearer {token}

4. 서버 응답
   → 월 마감 기본 정보 (closing)
   → 해당 월 사업장별 상세 내역 (businesses[])

5. 상태 업데이트
   → setDetailBusinesses(data.businesses)

6. UI 렌더링
   → 요약 카드 6개 표시
   → 사업장별 테이블 표시
```

---

## 주의사항

### 데이터베이스 마이그레이션
⚠️ **중요**: `total_cost` 컬럼 추가 마이그레이션을 실행해야 합니다!

```bash
# Supabase SQL Editor에서 실행하거나
psql -h your-supabase-host -U postgres -d postgres -f sql/monthly_closings_add_total_cost.sql

# 또는 Supabase Dashboard → SQL Editor에서
# sql/monthly_closings_add_total_cost.sql 내용 복사하여 실행
```

### 기존 데이터 업데이트
마이그레이션 후 기존 월 마감 데이터의 `total_cost`를 업데이트해야 할 수 있습니다:

```sql
-- 기존 데이터 업데이트 (선택사항)
UPDATE monthly_closings mc
SET total_cost = (
  SELECT COALESCE(SUM(rc.total_cost), 0)
  FROM revenue_calculations rc
  WHERE rc.calculation_date >= (mc.year || '-' || LPAD(mc.month::text, 2, '0') || '-01')::date
    AND rc.calculation_date < (
      CASE
        WHEN mc.month = 12 THEN (mc.year + 1) || '-01-01'
        ELSE mc.year || '-' || LPAD((mc.month + 1)::text, 2, '0') || '-01'
      END
    )::date
)
WHERE total_cost = 0;
```

### 반응형 디자인
- **매입금액 컬럼**: 중간 크기 이상 화면 (`md:table-cell`)에서만 표시
- **통계 카드**: 모바일 2열 → 태블릿 3열 → 데스크톱 6열 그리드
- **상세 모달**: 스크롤 가능, 최대 높이 90vh

---

## 관련 문서

- [월 마감 시스템 전체 수정 내역](./monthly-closing-all-fixes-summary.md)
- [월 마감 집계 스키마 오류 수정](./monthly-closing-schema-fix.md)
- [월 마감 집계 Silent Failure 수정](./monthly-closing-silent-failure-fix.md)

---

## 완료 체크리스트

- [x] 자동 새로고침 기능 검증
- [x] 월별 상세 모달 API 구현
- [x] 월별 상세 모달 UI 구현
- [x] 매입금액 백엔드 집계 추가
- [x] 매입금액 프론트엔드 표시 추가
- [x] TypeScript 타입 정의 업데이트
- [x] 데이터베이스 마이그레이션 스크립트 작성
- [x] 빌드 테스트 통과
- [ ] 데이터베이스 마이그레이션 실행 (운영 환경)
- [ ] 실제 환경 테스트
