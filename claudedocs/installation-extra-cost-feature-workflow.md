# 추가설치비 기능 구현 워크플로우

## 📋 요구사항 분석

### 기능 개요
사업장 관리 시스템에 **추가설치비(installation_extra_cost)** 필드를 추가하여 설치팀이 기본 공사비로 충당할 수 없는 추가 설치 비용을 관리합니다.

### 비즈니스 로직
- **정의**: 설치팀이 기본 공사비로 설치 비용 충당이 안될 때 추가 요청하는 설치비
- **블루온 관점**: 매출에서 차감되는 비용 항목 (영업비용, 실사비용 등과 동일한 레벨)
- **순이익 계산**: `순이익 = 매출 - 매입 - 추가설치비 - 영업비용 - 실사비용 - 설치비용`
- **기본값**: 대부분 0원 (필요시에만 입력)
- **권한**: 권한 레벨 1 이상 입력/수정 가능

### 적용 범위
1. **수정 모달**: 사업장 관리 페이지의 비용 정보 입력 섹션
2. **상세보기 모달**: 사업장 관리 페이지의 기기 상세 정보 모달
3. **순이익 계산**: 매출 계산 API 및 UI 표시 로직

---

## 🎯 구현 단계 (Phase-Based Workflow)

### Phase 1: 데이터베이스 스키마 업데이트

#### Task 1.1: DB 마이그레이션 파일 작성
**파일**: `sql/add_installation_extra_cost.sql`

```sql
-- 추가설치비 컬럼 추가
ALTER TABLE business_info
ADD COLUMN IF NOT EXISTS installation_extra_cost DECIMAL(12,2) DEFAULT 0.00;

-- 설명 추가
COMMENT ON COLUMN business_info.installation_extra_cost IS '설치팀 추가 요청 설치비 (순이익 계산 시 비용 항목)';

-- 인덱스 추가 (순이익 계산 최적화용)
CREATE INDEX IF NOT EXISTS idx_business_info_extra_cost
ON business_info(installation_extra_cost)
WHERE installation_extra_cost > 0;

-- 기존 데이터 기본값 설정
UPDATE business_info
SET installation_extra_cost = 0.00
WHERE installation_extra_cost IS NULL;
```

**검증 방법**:
```bash
# Supabase SQL Editor에서 실행 후 확인
SELECT column_name, data_type, column_default
FROM information_schema.columns
WHERE table_name = 'business_info'
  AND column_name = 'installation_extra_cost';
```

**실행 순서**:
1. Supabase Dashboard → SQL Editor 접속
2. 위 SQL 복사하여 실행
3. 검증 쿼리로 컬럼 생성 확인

---

### Phase 2: TypeScript 타입 정의 업데이트

#### Task 2.1: types/index.ts 업데이트
**파일**: `types/index.ts`

**수정 위치**: `BusinessInfo` 인터페이스 (라인 40-108)

**추가 내용**:
```typescript
export interface BusinessInfo {
  // ... 기존 필드들 ...

  additional_cost?: number | null;  // 기존 필드 (추가공사비)

  // 🆕 추가설치비 (설치팀 요청 추가 비용)
  installation_extra_cost?: number | null;

  // ... 나머지 필드들 ...
}
```

**정확한 삽입 위치**: `additional_cost` 필드 바로 다음 라인 (타입 정의 일관성 유지)

#### Task 2.2: UnifiedBusinessInfo 인터페이스 업데이트
**파일**: `app/admin/business/page.tsx`

**수정 위치**: `UnifiedBusinessInfo` 인터페이스 (라인 56-226)

**추가 내용**:
```typescript
interface UnifiedBusinessInfo {
  // ... 기존 필드들 ...

  additional_cost?: number | null;
  installation_extra_cost?: number | null;  // 🆕 추가

  // ... 나머지 필드들 ...
}
```

---

### Phase 3: 수정 모달 UI/UX 구현

#### Task 3.1: 비용 정보 섹션에 추가설치비 입력 필드 추가
**파일**: `app/admin/business/page.tsx`

**수정 위치**: 수정 모달의 비용 정보 섹션 (검색 패턴: `비용 정보` + `Calculator`)

**구현 내용**:
```tsx
{/* 비용 정보 섹션 */}
<div className="space-y-4">
  <h4 className="font-semibold text-gray-900 flex items-center gap-2">
    <Calculator className="w-5 h-5" />
    비용 정보
  </h4>

  {/* 기존: 추가공사비 */}
  <div>
    <label className="block text-sm font-medium text-gray-700 mb-1">
      추가공사비
    </label>
    <input
      type="number"
      value={editingBusiness?.additional_cost || ''}
      onChange={(e) => setEditingBusiness(prev => prev ? {
        ...prev,
        additional_cost: e.target.value ? Number(e.target.value) : null
      } : null)}
      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
      placeholder="0"
      disabled={userPermission < 1}
    />
  </div>

  {/* 🆕 추가설치비 */}
  <div>
    <label className="block text-sm font-medium text-gray-700 mb-1">
      추가설치비
      <span className="ml-2 text-xs text-gray-500">
        (설치팀 요청 추가 비용)
      </span>
    </label>
    <input
      type="number"
      value={editingBusiness?.installation_extra_cost || ''}
      onChange={(e) => setEditingBusiness(prev => prev ? {
        ...prev,
        installation_extra_cost: e.target.value ? Number(e.target.value) : null
      } : null)}
      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
      placeholder="0"
      disabled={userPermission < 1}
    />
    <p className="mt-1 text-xs text-gray-500">
      💡 기본 공사비로 충당 불가능한 추가 설치 비용 (순이익 계산 시 차감)
    </p>
  </div>

  {/* 기존: 복수굴뚝비용, 협상 등 */}
  <div>
    <label className="block text-sm font-medium text-gray-700 mb-1">
      복수굴뚝비용
    </label>
    <input
      type="number"
      value={editingBusiness?.multiple_stack_cost || ''}
      onChange={(e) => setEditingBusiness(prev => prev ? {
        ...prev,
        multiple_stack_cost: e.target.value ? Number(e.target.value) : null
      } : null)}
      className="w-full px-3 py-2 border border-gray-300 rounded-lg"
      placeholder="0"
      disabled={userPermission < 1}
    />
  </div>

  {/* ... 나머지 필드들 ... */}
</div>
```

#### Task 3.2: 저장 로직에 추가설치비 포함
**파일**: `app/admin/business/page.tsx`

**수정 위치**: `handleUpdateBusiness` 함수 (검색 패턴: `const handleUpdateBusiness`)

**구현 내용**:
```typescript
const handleUpdateBusiness = async () => {
  if (!editingBusiness) return;

  try {
    setIsLoading(true);

    // 업데이트 데이터 구성
    const updateData = {
      // ... 기본 정보 ...
      business_name: editingBusiness.business_name || editingBusiness.사업장명,
      address: editingBusiness.address || editingBusiness.주소,

      // ... 비용 정보 ...
      additional_cost: editingBusiness.additional_cost || null,
      installation_extra_cost: editingBusiness.installation_extra_cost || null,  // 🆕 추가
      multiple_stack_cost: editingBusiness.multiple_stack_cost || null,

      // ... 기타 필드들 ...
    };

    // API 호출
    const response = await fetch('/api/business-management', {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${TokenManager.getToken()}`
      },
      body: JSON.stringify({
        id: editingBusiness.id,
        ...updateData
      })
    });

    const result = await response.json();

    if (result.success) {
      alert('수정되었습니다');
      setEditModalOpen(false);
      await loadBusinesses(); // 목록 새로고침
    } else {
      alert(`수정 실패: ${result.message}`);
    }
  } catch (error) {
    console.error('Error updating business:', error);
    alert('수정 중 오류가 발생했습니다');
  } finally {
    setIsLoading(false);
  }
};
```

---

### Phase 4: 상세보기 모달 표시 로직 구현

#### Task 4.1: BusinessRevenueModal에 추가설치비 표시
**파일**: `components/business/BusinessRevenueModal.tsx`

**수정 위치**: 매출/매입/이익 정보 섹션 (라인 77-110)

**구현 내용**:
```tsx
{/* 매출/매입/이익 정보 */}
<div className="grid grid-cols-2 md:grid-cols-4 gap-4">
  {/* 기존: 매출금액 */}
  <div className="bg-green-50 rounded-lg p-4">
    <p className="text-xs font-medium text-green-600 mb-1">매출금액</p>
    <p className="text-lg font-bold text-green-700">
      {formatCurrency(business.total_revenue || 0)}
    </p>
  </div>

  {/* 기존: 매입금액 */}
  <div className="bg-red-50 rounded-lg p-4">
    <p className="text-xs font-medium text-red-600 mb-1">매입금액</p>
    <p className="text-lg font-bold text-red-700">
      {formatCurrency(business.total_cost || 0)}
    </p>
  </div>

  {/* 🆕 추가설치비 (별도 비용 항목으로 표시) */}
  {(business.installation_extra_cost || 0) > 0 && (
    <div className="bg-orange-50 rounded-lg p-4">
      <p className="text-xs font-medium text-orange-600 mb-1">추가설치비</p>
      <p className="text-lg font-bold text-orange-700">
        {formatCurrency(business.installation_extra_cost || 0)}
      </p>
      <p className="text-xs text-orange-600 mt-1">설치팀 추가 비용</p>
    </div>
  )}

  {/* 기존: 이익금액 */}
  <div className={`rounded-lg p-4 ${(business.net_profit || 0) >= 0 ? 'bg-blue-50' : 'bg-orange-50'}`}>
    <p className={`text-xs font-medium mb-1 ${(business.net_profit || 0) >= 0 ? 'text-blue-600' : 'text-orange-600'}`}>
      이익금액
    </p>
    <p className={`text-lg font-bold ${(business.net_profit || 0) >= 0 ? 'text-blue-700' : 'text-orange-700'}`}>
      {formatCurrency(business.net_profit || 0)}
    </p>
  </div>

  {/* 기존: 이익률 */}
  <div className="bg-purple-50 rounded-lg p-4">
    <p className="text-xs font-medium text-purple-600 mb-1">이익률</p>
    <p className="text-lg font-bold text-purple-700">
      {business.total_revenue > 0
        ? `${((business.net_profit / business.total_revenue) * 100).toFixed(1)}%`
        : '0.0%'
      }
    </p>
  </div>
</div>
```

#### Task 4.2: 비용 상세 내역 섹션 추가
**파일**: `components/business/BusinessRevenueModal.tsx`

**추가 위치**: 매출/매입/이익 정보 카드 바로 다음

**구현 내용**:
```tsx
{/* 비용 상세 내역 (추가설치비가 있을 경우만 표시) */}
{(business.installation_extra_cost || 0) > 0 && (
  <div className="bg-yellow-50 rounded-lg p-4 space-y-3">
    <h4 className="text-sm font-semibold text-yellow-800 flex items-center gap-2">
      <DollarSign className="w-4 h-4" />
      추가 비용 내역
    </h4>

    <div className="space-y-2">
      {/* 추가공사비 (있는 경우) */}
      {(business.additional_cost || 0) > 0 && (
        <div className="flex justify-between items-center p-2 bg-white rounded">
          <span className="text-sm text-gray-600">추가공사비:</span>
          <span className="text-sm font-medium text-gray-900">
            {formatCurrency(business.additional_cost || 0)}
          </span>
        </div>
      )}

      {/* 추가설치비 */}
      <div className="flex justify-between items-center p-2 bg-white rounded">
        <span className="text-sm text-gray-600">추가설치비:</span>
        <span className="text-sm font-medium text-orange-700">
          {formatCurrency(business.installation_extra_cost || 0)}
        </span>
      </div>

      {/* 복수굴뚝비용 (있는 경우) */}
      {(business.multiple_stack_cost || 0) > 0 && (
        <div className="flex justify-between items-center p-2 bg-white rounded">
          <span className="text-sm text-gray-600">복수굴뚝비용:</span>
          <span className="text-sm font-medium text-gray-900">
            {formatCurrency(business.multiple_stack_cost || 0)}
          </span>
        </div>
      )}
    </div>

    <div className="pt-2 mt-2 border-t border-yellow-200">
      <p className="text-xs text-gray-600">
        💡 추가설치비는 순이익 계산 시 비용으로 차감됩니다
      </p>
    </div>
  </div>
)}
```

---

### Phase 5: 순이익 계산 로직 업데이트

#### Task 5.1: 매출 계산 API 로직 수정
**파일**: `app/api/revenue/calculate/route.ts`

**수정 위치**: POST 함수의 순이익 계산 로직 (검색 패턴: `net_profit`)

**현재 로직 분석**:
```typescript
// 기존 순이익 계산
const net_profit = total_revenue - total_cost - sales_commission - survey_costs - installation_costs;
```

**수정 후 로직**:
```typescript
// 1. 추가설치비 조회
const { data: businessData } = await supabaseAdmin
  .from('business_info')
  .select('installation_extra_cost')
  .eq('id', business_id)
  .single();

const installation_extra_cost = businessData?.installation_extra_cost || 0;

// 2. 순이익 계산 (추가설치비를 별도 비용 항목으로 차감)
// 공식: 순이익 = 매출 - 매입 - 추가설치비 - 영업비용 - 실사비용 - 설치비용
const net_profit = total_revenue
  - total_cost
  - installation_extra_cost  // 🆕 추가 (다른 비용과 동일한 레벨)
  - sales_commission
  - survey_costs
  - installation_costs;

console.log('📊 [순이익 계산]', {
  매출: total_revenue,
  매입: total_cost,
  추가설치비: installation_extra_cost,
  영업비용: sales_commission,
  실사비용: survey_costs,
  설치비용: installation_costs,
  순이익: net_profit
});
```

#### Task 5.2: 응답 데이터 구조 업데이트
**파일**: `app/api/revenue/calculate/route.ts`

**수정 위치**: 응답 데이터 반환 부분

**타입 정의 수정**:
```typescript
interface RevenueCalculationResult {
  business_id: string;
  business_name: string;
  sales_office: string;
  calculation_date: string;
  total_revenue: number;
  total_cost: number;
  installation_extra_cost: number;  // 🆕 추가
  gross_profit: number;
  sales_commission: number;
  survey_costs: number;
  installation_costs: number;
  net_profit: number;
  equipment_breakdown: EquipmentBreakdown[];
  cost_breakdown: CostBreakdown;
}
```

**응답 데이터 구성**:
```typescript
return NextResponse.json({
  success: true,
  data: {
    business_id,
    business_name: businessInfo.business_name,
    sales_office: businessInfo.sales_office || '미배정',
    calculation_date: calcDate,
    total_revenue,
    total_cost,
    installation_extra_cost,  // 🆕 추가
    gross_profit,
    sales_commission,
    survey_costs,
    installation_costs,
    net_profit,
    equipment_breakdown,
    cost_breakdown
  }
});
```

#### Task 5.3: 프론트엔드 순이익 표시 로직 업데이트
**파일**: `app/admin/business/page.tsx`

**수정 위치**: 사업장 목록 테이블의 순이익 계산 (검색 패턴: `순이익` 또는 `net_profit`)

**수정 내용**:
```typescript
// 테이블 렌더링 시 순이익 계산
const calculateNetProfit = (business: UnifiedBusinessInfo) => {
  const revenue = business.total_revenue || 0;
  const cost = business.total_cost || 0;
  const extraCost = business.installation_extra_cost || 0;

  // 순이익 = 매출 - 매입 - 추가설치비
  return revenue - cost - extraCost;
};

// 테이블 컬럼 정의
{
  title: '순이익',
  render: (business: UnifiedBusinessInfo) => {
    const netProfit = calculateNetProfit(business);
    return (
      <span className={netProfit >= 0 ? 'text-blue-600' : 'text-red-600'}>
        {formatCurrency(netProfit)}
      </span>
    );
  }
}
```

---

### Phase 6: API 엔드포인트 업데이트

#### Task 6.1: business-management API 수정
**파일**: `app/api/business-management/route.ts`

**수정 내용**:

**1. PUT 요청 처리 (사업장 정보 수정)**:
```typescript
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();

    // 업데이트 가능한 필드 정의
    const updateData: any = {
      business_name: body.business_name,
      address: body.address,
      // ... 기존 필드들 ...

      // 비용 정보
      additional_cost: body.additional_cost || null,
      installation_extra_cost: body.installation_extra_cost || null,  // 🆕 추가
      multiple_stack_cost: body.multiple_stack_cost || null,

      // ... 나머지 필드들 ...
      updated_at: new Date().toISOString()
    };

    // DB 업데이트
    const { data, error } = await supabaseAdmin
      .from('business_info')
      .update(updateData)
      .eq('id', body.id)
      .select()
      .single();

    if (error) {
      console.error('❌ DB 업데이트 오류:', error);
      return NextResponse.json({
        success: false,
        message: 'DB 업데이트 실패'
      }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      data,
      message: '사업장 정보가 수정되었습니다'
    });
  } catch (error) {
    console.error('❌ API 오류:', error);
    return NextResponse.json({
      success: false,
      message: '서버 오류'
    }, { status: 500 });
  }
}
```

**2. GET 요청 응답 (사업장 목록 조회)**:
```typescript
export async function GET(request: NextRequest) {
  try {
    const { data: businesses, error } = await supabaseAdmin
      .from('business_info')
      .select(`
        id,
        business_name,
        address,
        total_revenue,
        total_cost,
        installation_extra_cost,  -- 🆕 추가
        net_profit,
        sales_office,
        -- ... 기타 필드들 ...
      `)
      .order('created_at', { ascending: false });

    if (error) throw error;

    return NextResponse.json({
      success: true,
      data: businesses
    });
  } catch (error) {
    console.error('❌ 조회 오류:', error);
    return NextResponse.json({
      success: false,
      message: '조회 실패'
    }, { status: 500 });
  }
}
```

#### Task 6.2: business-summary API 수정
**파일**: `app/api/revenue/business-summary/route.ts`

**수정 내용**:
```typescript
export async function GET(request: NextRequest) {
  try {
    // 사업장 목록 조회 (추가설치비 포함)
    const { data: businesses, error } = await supabaseAdmin
      .from('business_info')
      .select(`
        id,
        business_name,
        sales_office,
        address,
        total_revenue,
        total_cost,
        installation_extra_cost,  -- 🆕 추가
        net_profit,
        -- ... 기타 필드들 ...
      `)
      .eq('is_active', true)
      .eq('is_deleted', false);

    if (error) throw error;

    // 순이익 재계산 (추가설치비 반영)
    const businessesWithCalculatedProfit = businesses.map(business => ({
      ...business,
      calculated_net_profit: (business.total_revenue || 0)
        - (business.total_cost || 0)
        - (business.installation_extra_cost || 0)
    }));

    return NextResponse.json({
      success: true,
      data: {
        businesses: businessesWithCalculatedProfit,
        summary_stats: {
          total_businesses: businesses.length,
          // ... 기타 통계 ...
        }
      }
    });
  } catch (error) {
    console.error('❌ 요약 조회 오류:', error);
    return NextResponse.json({
      success: false,
      message: '요약 조회 실패'
    }, { status: 500 });
  }
}
```

---

### Phase 7: 테스트 및 검증

#### Task 7.1: 단위 테스트 시나리오

**테스트 케이스 1: 추가설치비 입력 및 저장**
```
1. 사업장 관리 페이지 접속
2. 사업장 선택 → 수정 버튼 클릭
3. 비용 정보 섹션에서 "추가설치비" 입력 (예: 500,000)
4. 저장 버튼 클릭
5. 검증: DB에 값 저장 확인
   SELECT installation_extra_cost FROM business_info WHERE id = '...';
```

**테스트 케이스 2: 순이익 계산 정확성**
```
테스트 데이터:
- 매출: 10,000,000원
- 매입: 7,000,000원
- 추가설치비: 500,000원
- 영업비용: 800,000원
- 실사비용: 200,000원

예상 순이익 계산:
10,000,000 - 7,000,000 - 500,000 - 800,000 - 200,000 = 1,500,000원

검증:
1. API 호출: POST /api/revenue/calculate
2. 응답 데이터의 net_profit 확인
3. UI에서 표시되는 순이익 확인
```

**테스트 케이스 3: 권한 제어**
```
1. 권한 0 사용자로 로그인
2. 사업장 수정 모달 열기
3. 검증: 추가설치비 입력 필드가 비활성화(disabled) 상태인지 확인

4. 권한 1 사용자로 로그인
5. 사업장 수정 모달 열기
6. 검증: 추가설치비 입력 필드가 활성화 상태인지 확인
```

**테스트 케이스 4: 상세보기 모달 표시**
```
시나리오 A: 추가설치비가 0원인 경우
- 상세보기 모달 열기
- 검증: 추가설치비 카드가 표시되지 않음

시나리오 B: 추가설치비가 있는 경우
- 상세보기 모달 열기
- 검증: 추가설치비 카드가 오렌지색으로 표시됨
- 검증: "추가 비용 내역" 섹션에 추가설치비 항목 표시
```

#### Task 7.2: 통합 테스트

**시나리오: 신규 사업장 추가부터 순이익 확인까지**
```
1. 신규 사업장 등록
2. 측정기기 정보 입력
3. 비용 정보 입력 (추가설치비 포함)
4. 매출 계산 API 호출
5. 상세보기 모달에서 순이익 확인
6. 사업장 목록에서 순이익 확인
7. 엑셀 다운로드 시 추가설치비 컬럼 포함 확인
```

#### Task 7.3: 회귀 테스트

**기존 데이터 영향도 확인**
```sql
-- 추가설치비가 NULL 또는 0인 기존 사업장 순이익 확인
SELECT
  id,
  business_name,
  total_revenue,
  total_cost,
  installation_extra_cost,
  net_profit,
  (total_revenue - total_cost - COALESCE(installation_extra_cost, 0)) AS calculated_profit
FROM business_info
WHERE installation_extra_cost IS NULL OR installation_extra_cost = 0
LIMIT 10;

-- 검증: net_profit과 calculated_profit이 동일한지 확인
```

**성능 테스트**
```
1. 1000개 이상의 사업장 목록 로딩 시간 측정
2. 추가설치비 필드 추가 전후 비교
3. 인덱스 효과 확인
```

---

## 📊 영향 범위 분석

### 수정 파일 목록

**1. SQL 스키마**
- `sql/add_installation_extra_cost.sql` (신규 작성)

**2. TypeScript 타입**
- `types/index.ts` (수정)

**3. 프론트엔드 컴포넌트**
- `app/admin/business/page.tsx` (수정)
  - UnifiedBusinessInfo 인터페이스
  - 수정 모달 UI
  - handleUpdateBusiness 함수
  - 순이익 계산 로직
- `components/business/BusinessRevenueModal.tsx` (수정)
  - 매출/매입/이익 카드
  - 비용 상세 내역 섹션

**4. API 엔드포인트**
- `app/api/business-management/route.ts` (수정)
  - PUT 요청 처리
  - GET 응답 데이터
- `app/api/revenue/calculate/route.ts` (수정)
  - 순이익 계산 로직
  - 응답 데이터 구조
- `app/api/revenue/business-summary/route.ts` (수정)
  - 사업장 요약 조회

### 의존성 분석

**데이터베이스**
- ✅ RLS 정책 영향 없음 (기존 컬럼 추가)
- ✅ 인덱스 추가로 성능 최적화
- ✅ 기존 데이터 호환성 유지 (기본값 0)

**타입 안정성**
- ✅ TypeScript 컴파일 오류 없음
- ✅ 선택적 필드로 정의 (`?:`)
- ✅ null 처리 안전성 확보

**기존 기능**
- ✅ 추가설치비가 없는 사업장도 정상 동작
- ✅ 순이익 계산 로직 일관성 유지
- ✅ UI 표시 조건부 렌더링

---

## ✅ 완료 조건 (Definition of Done)

### 기능 완성도
- [ ] DB 스키마 업데이트 완료 (컬럼 추가, 인덱스 생성)
- [ ] TypeScript 타입 정의 업데이트
- [ ] 수정 모달에 추가설치비 입력 필드 추가
- [ ] 상세보기 모달에 추가설치비 표시
- [ ] 순이익 계산 로직에 추가설치비 반영
- [ ] 권한 1 이상만 입력/수정 가능

### 품질 기준
- [ ] `npm run type-check` 통과
- [ ] `npm run lint` 통과 (경고 0개)
- [ ] 순이익 계산 정확성 검증 (테스트 케이스 2)
- [ ] 기존 사업장 데이터 회귀 테스트 통과

### 문서화
- [ ] 구현 워크플로우 문서 작성
- [ ] API 변경 사항 문서화
- [ ] DB 스키마 변경 이력 기록

---

## 🚀 배포 전 체크리스트

### 1. 데이터베이스
- [ ] 마이그레이션 SQL 실행 완료
- [ ] 기존 데이터 백업 완료
- [ ] 인덱스 생성 확인
- [ ] 컬럼 생성 검증 쿼리 실행

### 2. 코드 품질
- [ ] `npm run type-check` 통과
- [ ] `npm run lint` 통과
- [ ] 로컬 개발 서버 정상 구동 확인
- [ ] 브라우저 콘솔 오류 없음

### 3. 기능 검증
- [ ] 추가설치비 입력/저장 정상 동작
- [ ] 순이익 계산 정확성 확인 (3개 이상의 테스트 케이스)
- [ ] 상세보기 모달 표시 정상 (0원 / 금액 있는 경우 모두 확인)
- [ ] 권한 제어 정상 동작 (권한 0, 권한 1 각각 확인)

### 4. 통합 테스트
- [ ] 신규 사업장 등록 → 추가설치비 입력 → 순이익 확인 흐름
- [ ] 기존 사업장 수정 → 추가설치비 추가 → 순이익 재계산 흐름
- [ ] 매출 계산 API 호출 → 응답 데이터 확인

### 5. 문서화
- [ ] 워크플로우 문서 완성
- [ ] 변경 사항 CHANGELOG 업데이트
- [ ] API 문서 업데이트 (해당하는 경우)

---

## 📝 참고 사항

### 관련 파일 및 기능
- **유사 기능**: `additional_cost` (추가공사비) - 계산서 발행 항목
- **매출 계산**: `app/api/revenue/calculate/route.ts` (순이익 계산 핵심 로직)
- **비용 정보 UI**: `app/admin/business/page.tsx` (비용 입력 폼)

### 주의사항

**1. 추가설치비 vs 추가공사비 명확한 구분**
```
추가공사비 (additional_cost):
- 목적: 계산서 발행 항목 (보조금 3차 계산서)
- 용도: 고객에게 청구하는 추가 비용
- 계산: 매출 항목

추가설치비 (installation_extra_cost):
- 목적: 내부 비용 관리 (설치팀 요청)
- 용도: 블루온이 부담하는 추가 비용
- 계산: 비용 항목 (순이익에서 차감)
```

**2. 권한 레벨 체계**
```
권한 0: 조회만 가능
권한 1: 조회 + 입력/수정 가능 ← 추가설치비 입력 가능
권한 2: 전체 관리 가능
```

**3. 기본값 및 NULL 처리**
```typescript
// DB 기본값: 0.00
// TypeScript: number | null (선택적)
// 계산 시: null/undefined → 0으로 처리

const installation_extra_cost = business.installation_extra_cost || 0;
```

**4. 순이익 계산 공식 (최종 확정)**
```
순이익 = 매출 - 매입 - 추가설치비 - 영업비용 - 실사비용 - 설치비용

[일관성 원칙]
- 모든 비용 항목은 동일한 레벨에서 차감
- 괄호로 그룹화하지 않음
- 영업비용, 실사비용, 설치비용과 동일한 위치
```

**5. UI 표시 조건**
```tsx
// 상세보기 모달: 0원일 경우 숨김
{(business.installation_extra_cost || 0) > 0 && (
  <div>추가설치비 카드</div>
)}

// 수정 모달: 항상 표시 (입력 가능하도록)
<input
  type="number"
  value={editingBusiness?.installation_extra_cost || ''}
  placeholder="0"
/>
```

---

## 🎯 구현 우선순위

### 🔴 Phase 1 (필수 - 기반 작업)
1. DB 스키마 업데이트 (`sql/add_installation_extra_cost.sql`)
2. TypeScript 타입 정의 (`types/index.ts`)
3. API 엔드포인트 업데이트 (`business-management/route.ts`)

### 🟡 Phase 2 (중요 - 핵심 기능)
4. 순이익 계산 로직 수정 (`revenue/calculate/route.ts`)
5. 수정 모달 UI 구현 (`admin/business/page.tsx`)
6. 상세보기 모달 표시 (`BusinessRevenueModal.tsx`)

### 🟢 Phase 3 (부가 - 개선 사항)
7. 엑셀 다운로드 컬럼 추가
8. 통계 차트 반영
9. 필터링/검색 기능 추가

---

## 📞 추가 확인 필요 사항

현재 모든 요구사항이 명확하게 정의되었습니다.
구현 진행 중 추가 질문이나 확인이 필요한 사항이 발생하면 즉시 문의 바랍니다.

---

## 🔄 버전 이력

**v1.0 (2025-10-28)**
- 초기 워크플로우 작성
- 요구사항 분석 완료
- Phase별 구현 계획 수립

**v1.1 (2025-10-28)**
- 순이익 계산 공식 수정
  - 변경 전: `순이익 = 매출 - (매입 + 추가설치비) - ...`
  - 변경 후: `순이익 = 매출 - 매입 - 추가설치비 - ...`
- 일관성 개선: 모든 비용 항목을 동일한 레벨에서 차감

---

**작성일**: 2025-10-28
**작성자**: Claude Code
**버전**: v1.1
**최종 검토**: ✅ 완료
