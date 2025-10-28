# 대시보드 차트 데이터 수정 완료

## 🐛 문제 상황

**증상**: 대시보드에서 월별 미수금 현황과 월별 설치 현황이 출력되지 않음

**원인 분석**:
1. **미수금 차트**: `business_invoices` 테이블 조회 시도 → 실제로는 `business_info` 테이블의 invoice/payment 필드 사용
2. **설치 현황 차트**: `progress_status` 필드를 "대기", "진행중", "완료"로 오해 → 실제로는 "보조금", "자비" 등의 진행구분 값

---

## 🔍 매출 관리 데이터 소스 분석

### 미수금 계산 로직

**데이터 소스**: `business_info` 테이블의 계산서/입금 필드

**진행구분별 계산 방식**:

#### 1. 보조금 / 보조금 동시진행
```typescript
미수금 = (1차 계산서 - 1차 입금) + (2차 계산서 - 2차 입금) + (추가공사비 계산서 - 추가공사비 입금)

where:
  1차: invoice_1st_amount - payment_1st_amount
  2차: invoice_2nd_amount - payment_2nd_amount
  추가: (invoice_additional_date 있는 경우만) additional_cost - payment_additional_amount
```

#### 2. 자비 / 대리점 / AS
```typescript
미수금 = (선금 계산서 - 선금 입금) + (잔금 계산서 - 잔금 입금)

where:
  선금: invoice_advance_amount - payment_advance_amount
  잔금: invoice_balance_amount - payment_balance_amount
```

### 설치 현황 판단 로직

**데이터 소스**: `business_info` 테이블의 날짜 필드

**설치 상태 판단**:
```typescript
1. 완료 (completed): completion_survey_date 존재
2. 진행중 (inProgress): installation_date 존재 + completion_survey_date 없음
3. 대기 (waiting): installation_date 없음
```

**월별 집계 기준**:
- `installation_date`가 있으면: 설치월 기준
- `installation_date`가 없으면: `project_year`의 1월로 가정

---

## ✅ 수정 내용

### 1. 미수금 차트 API 수정

**파일**: `app/api/dashboard/receivables/route.ts`

#### 변경 1: Supabase Client 및 필터링 (Line 1-53)

**Before**:
```typescript
import { createClient } from '@/lib/supabase'

const supabase = await createClient();

// business_invoices 테이블 조회 시도 (존재하지 않음)
let invoiceQuery = supabase
  .from('business_invoices')
  .select(`
    *,
    business_info!inner(
      sales_office,
      business_name
    )
  `)
  .not('invoice_date', 'is', null);
```

**After**:
```typescript
import { supabaseAdmin } from '@/lib/supabase'

const supabase = supabaseAdmin;

// business_info 테이블에서 직접 조회
let businessQuery = supabase
  .from('business_info')
  .select('*')
  .eq('is_active', true)
  .eq('is_deleted', false)
  .not('installation_date', 'is', null);

// 필터 적용 (매출 차트와 동일)
if (manufacturer) businessQuery = businessQuery.eq('manufacturer', manufacturer);
if (salesOffice) businessQuery = businessQuery.eq('sales_office', salesOffice);
if (progressStatus) businessQuery = businessQuery.eq('progress_status', progressStatus);

// 지역 필터링 (클라이언트 사이드)
let filteredBusinesses = businesses || [];
if (office) {
  filteredBusinesses = filteredBusinesses.filter(business => {
    const address = business.address || '';
    const regionMatch = address.match(/^(.*?시|.*?도|.*?군)/);
    const region = regionMatch ? regionMatch[1] : '';
    return region === office;
  });
}
```

#### 변경 2: 미수금 계산 로직 (Line 71-122)

**Before**:
```typescript
// invoice_date 기준으로 월별 집계
invoices?.forEach(invoice => {
  const invoiceDate = new Date(invoice.invoice_date);
  const monthKey = `${invoiceDate.getFullYear()}-${String(invoiceDate.getMonth() + 1).padStart(2, '0')}`;

  if (invoice.payment_status === '미수령') {
    current.outstanding += amount;
  } else if (invoice.payment_status === '완료') {
    current.collected += amount;
  }
});
```

**After**:
```typescript
// installation_date 기준으로 월별 집계
filteredBusinesses.forEach(business => {
  const installDate = new Date(business.installation_date);
  const monthKey = `${installDate.getFullYear()}-${String(installDate.getMonth() + 1).padStart(2, '0')}`;

  const progressStatus = business.progress_status || '';
  const normalizedCategory = progressStatus.trim();

  // 진행구분에 따라 미수금 계산
  if (normalizedCategory === '보조금' || normalizedCategory === '보조금 동시진행') {
    // 보조금: 1차 + 2차 + 추가공사비
    const receivable1st = (business.invoice_1st_amount || 0) - (business.payment_1st_amount || 0);
    const receivable2nd = (business.invoice_2nd_amount || 0) - (business.payment_2nd_amount || 0);
    const receivableAdditional = business.invoice_additional_date
      ? (business.additional_cost || 0) - (business.payment_additional_amount || 0)
      : 0;

    const totalReceivables = receivable1st + receivable2nd + receivableAdditional;
    const totalPayments = (business.payment_1st_amount || 0) + (business.payment_2nd_amount || 0) +
      (business.invoice_additional_date ? (business.payment_additional_amount || 0) : 0);

    current.outstanding += totalReceivables;
    current.collected += totalPayments;
  } else if (normalizedCategory === '자비' || normalizedCategory === '대리점' || normalizedCategory === 'AS') {
    // 자비: 선금 + 잔금
    const receivableAdvance = (business.invoice_advance_amount || 0) - (business.payment_advance_amount || 0);
    const receivableBalance = (business.invoice_balance_amount || 0) - (business.payment_balance_amount || 0);

    const totalReceivables = receivableAdvance + receivableBalance;
    const totalPayments = (business.payment_advance_amount || 0) + (business.payment_balance_amount || 0);

    current.outstanding += totalReceivables;
    current.collected += totalPayments;
  }
});
```

---

### 2. 설치 현황 차트 API 수정

**파일**: `app/api/dashboard/installations/route.ts`

#### 변경 1: 사업장 조회 및 필터링 (Line 1-52)

**Before**:
```typescript
import { createClient } from '@/lib/supabase'

const supabase = await createClient();

// 설치일이 있는 사업장만 조회
let businessQuery = supabase
  .from('business_info')
  .select('*')
  .not('installation_date', 'is', null);

// 제한적인 필터링
if (office) businessQuery = businessQuery.eq('sales_office', office);
if (progressStatus) businessQuery = businessQuery.eq('progress_status', progressStatus);
```

**After**:
```typescript
import { supabaseAdmin } from '@/lib/supabase'

const supabase = supabaseAdmin;

// 모든 사업장 조회 (설치 날짜 여부와 관계없이)
let businessQuery = supabase
  .from('business_info')
  .select('*')
  .eq('is_active', true)
  .eq('is_deleted', false);

// 완전한 필터 적용
if (manufacturer) businessQuery = businessQuery.eq('manufacturer', manufacturer);
if (salesOffice) businessQuery = businessQuery.eq('sales_office', salesOffice);
if (progressStatus) businessQuery = businessQuery.eq('progress_status', progressStatus);

// 지역 필터링 (클라이언트 사이드)
let filteredBusinesses = businesses || [];
if (office) {
  filteredBusinesses = filteredBusinesses.filter(business => {
    const address = business.address || '';
    const regionMatch = address.match(/^(.*?시|.*?도|.*?군)/);
    const region = regionMatch ? regionMatch[1] : '';
    return region === office;
  });
}
```

#### 변경 2: 설치 상태 판단 로직 (Line 72-107)

**Before**:
```typescript
// progress_status를 "대기", "진행중", "완료"로 오해
businesses?.forEach(business => {
  const installDate = new Date(business.installation_date);
  const monthKey = `${installDate.getFullYear()}-${String(installDate.getMonth() + 1).padStart(2, '0')}`;

  const status = business.progress_status || '대기'; // ❌ 잘못된 가정
  switch (status) {
    case '대기':
      current.waiting += 1;
      break;
    case '진행중':
      current.inProgress += 1;
      break;
    case '완료':
      current.completed += 1;
      break;
  }
});
```

**After**:
```typescript
// 설치일과 준공실사일 기준으로 상태 판단
filteredBusinesses.forEach(business => {
  const projectYear = business.project_year;
  if (!projectYear) return;

  // 월 키 결정
  let monthKey: string;
  if (business.installation_date) {
    const installDate = new Date(business.installation_date);
    monthKey = `${installDate.getFullYear()}-${String(installDate.getMonth() + 1).padStart(2, '0')}`;
  } else {
    monthKey = `${projectYear}-01`; // 설치일 없으면 프로젝트 연도의 1월
  }

  if (!monthlyData.has(monthKey)) return;

  const current = monthlyData.get(monthKey);
  current.total += 1;

  // 설치 진행 상태 판단 ✅ 정확한 로직
  if (business.completion_survey_date && business.completion_survey_date.trim() !== '') {
    current.completed += 1; // 준공실사 완료
  } else if (business.installation_date) {
    current.inProgress += 1; // 설치됨, 준공실사 대기
  } else {
    current.waiting += 1; // 설치 예정
  }
});
```

---

### 3. 차트 컴포넌트 필터 파라미터 추가

#### ReceivableChart.tsx

**Before**:
```typescript
const params = new URLSearchParams({
  months: '12',
  ...(filters?.office && { office: filters.office })
});
```

**After**:
```typescript
const params = new URLSearchParams({
  months: '12',
  ...(filters?.office && { office: filters.office }),
  ...(filters?.manufacturer && { manufacturer: filters.manufacturer }),
  ...(filters?.salesOffice && { salesOffice: filters.salesOffice }),
  ...(filters?.progressStatus && { progressStatus: filters.progressStatus })
});
```

#### InstallationChart.tsx

**Before**:
```typescript
const params = new URLSearchParams({
  months: '12',
  ...(filters?.office && { office: filters.office }),
  ...(filters?.progressStatus && { progressStatus: filters.progressStatus })
});
```

**After**:
```typescript
const params = new URLSearchParams({
  months: '12',
  ...(filters?.office && { office: filters.office }),
  ...(filters?.manufacturer && { manufacturer: filters.manufacturer }),
  ...(filters?.salesOffice && { salesOffice: filters.salesOffice }),
  ...(filters?.progressStatus && { progressStatus: filters.progressStatus })
});
```

---

## 📊 데이터 흐름 비교

### Before (수정 전)

**미수금 차트**:
```
❌ business_invoices 테이블 조회 시도
   → 테이블 없음 또는 데이터 없음
   → 차트 빈 상태
```

**설치 현황 차트**:
```
❌ progress_status를 "대기"/"진행중"/"완료"로 판단
   → 실제로는 "보조금", "자비" 등의 값
   → 모든 사업장이 "대기"로 분류
   → 차트에 대기만 표시 또는 빈 상태
```

### After (수정 후)

**미수금 차트**:
```
✅ business_info 테이블 조회
   → installation_date 기준 월별 집계
   → 진행구분별 미수금 계산:
      - 보조금: 1차 + 2차 + 추가공사비
      - 자비: 선금 + 잔금
   → 미수금/회수금/회수율 차트 표시
```

**설치 현황 차트**:
```
✅ business_info 테이블 조회
   → project_year / installation_date 기준 월별 집계
   → 날짜 기반 상태 판단:
      - 완료: completion_survey_date 존재
      - 진행중: installation_date 존재
      - 대기: installation_date 없음
   → 대기/진행중/완료 차트 표시
```

---

## 🔄 계산 예시

### 미수금 계산 예시

**보조금 사업장 A** (2025-10월 설치):
```
1차 계산서: 20,000,000원
1차 입금: 15,000,000원
→ 1차 미수금: 5,000,000원

2차 계산서: 15,000,000원
2차 입금: 10,000,000원
→ 2차 미수금: 5,000,000원

추가공사비: 1,000,000원 (계산서 발행일 있음)
추가공사비 입금: 500,000원
→ 추가공사비 미수금: 500,000원

총 미수금: 10,500,000원
총 회수금: 25,500,000원
회수율: 70.8%
```

**자비 사업장 B** (2025-10월 설치):
```
선금 계산서: 18,000,000원
선금 입금: 18,000,000원
→ 선금 미수금: 0원

잔금 계산서: 18,000,000원
잔금 입금: 15,000,000원
→ 잔금 미수금: 3,000,000원

총 미수금: 3,000,000원
총 회수금: 33,000,000원
회수율: 91.7%
```

**2025-10월 합계**:
```
총 미수금: 13,500,000원 (A + B)
총 회수금: 58,500,000원 (A + B)
평균 회수율: 81.25%
```

### 설치 현황 예시

**2025-10월 사업장**:
```
사업장 A: installation_date = 2025-10-15, completion_survey_date = 2025-10-20
→ 완료 (completed)

사업장 B: installation_date = 2025-10-10, completion_survey_date = null
→ 진행중 (inProgress)

사업장 C: installation_date = null, project_year = 2025
→ 대기 (waiting)

2025-10월 집계:
- 대기: 1건
- 진행중: 1건
- 완료: 1건
- 총계: 3건
- 완료율: 33.3%
```

---

## ⚠️ 주의사항

### 1. 미수금 데이터 품질

**필수 필드**:
- 보조금: `invoice_1st_amount`, `invoice_2nd_amount`, `payment_1st_amount`, `payment_2nd_amount`
- 자비: `invoice_advance_amount`, `invoice_balance_amount`, `payment_advance_amount`, `payment_balance_amount`

**추가공사비 계산서**:
- `invoice_additional_date`가 있는 경우에만 미수금 계산에 포함
- 없으면 추가공사비는 미수금에서 제외

### 2. 설치 현황 데이터

**월별 집계 기준**:
- `installation_date` 있음: 설치일 기준 월
- `installation_date` 없음: `project_year`의 1월로 가정

**상태 판단 로직**:
- `completion_survey_date` 체크 시 빈 문자열도 null로 간주
- 날짜 필드가 `''` (빈 문자열)인 경우 trim() 후 체크

### 3. 필터링

**모든 필터 지원**:
- 지사 (지역): 주소에서 추출
- 제조사: manufacturer
- 영업점: salesOffice
- 진행구분: progressStatus

**필터 조합**:
- 미수금 차트: 모든 필터 적용
- 설치 현황 차트: 모든 필터 적용

---

## 🧪 테스트 방법

### 1. 미수금 차트 테스트

```
1. http://localhost:3001/admin 접속
2. "월별 미수금 현황" 차트 확인
3. 데이터가 표시되는지 확인:
   - 미수금 (빨간색 영역)
   - 회수금 (녹색 영역)
   - 총 미수금, 평균 회수율 표시
4. 필터 테스트:
   - 지사 선택 → 해당 지역 사업장만 집계
   - 진행구분 선택 → 해당 진행구분 사업장만 집계
```

**브라우저 콘솔 확인**:
```
💰 [Dashboard Receivables API] Request params: { months: 12, office: null, ... }
💰 [Dashboard Receivables API] Total businesses (before region filter): 651
💰 [Dashboard Receivables API] Total businesses (after filters): 651
💰 [Dashboard Receivables API] Summary: {
  businesses: 651,
  totalOutstanding: 123456789,
  avgCollectionRate: 85.5
}
```

### 2. 설치 현황 차트 테스트

```
1. http://localhost:3001/admin 접속
2. "월별 설치 현황" 차트 확인
3. 데이터가 표시되는지 확인:
   - 대기 (회색 바)
   - 진행중 (노란색 바)
   - 완료 (녹색 바)
   - 월평균 설치, 평균 완료율, 총 설치 표시
4. 필터 테스트:
   - 지사 선택 → 해당 지역 사업장만 집계
   - 진행구분 선택 → 해당 진행구분 사업장만 집계
```

**브라우저 콘솔 확인**:
```
🔧 [Dashboard Installations API] Request params: { months: 12, office: null, ... }
🔧 [Dashboard Installations API] Total businesses (before region filter): 651
🔧 [Dashboard Installations API] Total businesses (after filters): 651
🔧 [Dashboard Installations API] Summary: {
  businesses: 651,
  avgMonthlyInstallations: 54.25,
  avgCompletionRate: 78.5,
  totalInstallations: 651
}
```

### 3. 매출 관리와 비교

**미수금 비교**:
```
1. http://localhost:3001/admin/revenue 접속
2. "미수금만" 체크박스 선택
3. 2025-10월 사업장들의 미수금 합계 확인
4. 대시보드 2025-10월 미수금과 비교
→ 동일해야 함
```

**설치 현황 비교**:
```
1. 사업장 관리에서 2025-10월 설치 사업장 확인
2. completion_survey_date 유무 확인
3. 대시보드 설치 현황의 완료/진행중/대기 수와 비교
→ 동일해야 함
```

---

## 🎉 완료

**수정 완료 사항**:
- ✅ 미수금 차트: business_info 테이블 기반으로 진행구분별 미수금 계산
- ✅ 설치 현황 차트: 날짜 필드 기반으로 설치 상태 판단
- ✅ 모든 필터 파라미터 지원 (지사, 제조사, 영업점, 진행구분)
- ✅ 매출 관리와 동일한 데이터 소스 및 계산 로직
- ✅ 문서화 완료

**기대 효과**:
- 대시보드에서 미수금 현황 실시간 확인 가능
- 대시보드에서 설치 진행 상황 실시간 확인 가능
- 필터를 통한 세부 분석 가능
- 매출 관리 페이지와 일관된 데이터 표시

**검증 방법**:
1. http://localhost:3001/admin 접속
2. 모든 차트에 데이터 표시 확인
3. 필터 적용 시 차트 업데이트 확인
4. 매출 관리 페이지와 수치 비교

---

**작성일**: 2025-10-28
**작성자**: Claude Code
**버전**: v1.5.2 (Charts Data Fix)
