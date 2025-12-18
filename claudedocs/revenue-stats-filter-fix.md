# 매출관리 통계 카드 필터링 문제 해결

## 문제 상황

**증상**: 매출관리 페이지에서 2025년 필터 적용 시
- **통계 카드**: ₩7,514,933,400 (약 75억원)
- **SQL 쿼리**: ₩6,409,253,400 (약 64억원)
- **차이**: ₩1.1억원 (약 17% 차이)

**근본 원인**: 필터링이 **테이블에만** 적용되고 **통계 카드에는 적용되지 않음**

## 원인 분석

### Before (문제 상황)

```typescript
// Line 561 - loadCalculations()
setCalculations(calculations);
calculateStats(calculations); // ❌ 전체 데이터로 통계 계산

// Line 704 - handleCalculate()
setCalculations(prevCalcs => {
  calculateStats(prevCalcs); // ❌ 필터링 없이 통계 계산
  return prevCalcs;
});

// Line 837-867 - filteredBusinesses (테이블 렌더링)
const filteredBusinesses = businesses.filter(business => {
  // ✅ 필터 적용됨 (project_year, searchTerm, office, region 등)
  return searchMatch && officeMatch && regionMatch && categoryMatch && yearMatch && monthMatch;
});
```

**문제점**:
- `calculateStats()`는 항상 **전체 calculations 배열**로 호출됨
- 테이블은 `filteredBusinesses`로 필터링되지만, 통계는 필터링 전 데이터 사용
- 사용자가 필터를 변경해도 통계는 업데이트되지 않음

## 해결 방법

### After (수정 완료)

```typescript
// Line 137-182 - 새로운 useEffect 추가
useEffect(() => {
  if (!businesses.length || !calculations.length) return;

  // 1. 필터링된 사업장 계산 (테이블과 동일한 로직)
  const filtered = businesses.filter(business => {
    const searchMatch = !searchTerm ||
      business.business_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (business.sales_office && business.sales_office.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (business.manager_name && business.manager_name.toLowerCase().includes(searchTerm.toLowerCase()));

    const officeMatch = selectedOffices.length === 0 || selectedOffices.includes(business.sales_office || '');
    const regionMatch = selectedRegions.length === 0 || selectedRegions.some(region =>
      business.address && business.address.toLowerCase().includes(region.toLowerCase())
    );
    const categoryMatch = selectedCategories.length === 0 || selectedCategories.includes(business.progress_status || '');
    const yearMatch = selectedProjectYears.length === 0 || selectedProjectYears.includes(String(business.project_year || ''));

    let monthMatch = true;
    if (selectedMonths.length > 0) {
      const installDate = business.installation_date;
      if (installDate) {
        const date = new Date(installDate);
        const month = String(date.getMonth() + 1);
        monthMatch = selectedMonths.includes(month);
      } else {
        monthMatch = false;
      }
    }

    return searchMatch && officeMatch && regionMatch && categoryMatch && yearMatch && monthMatch;
  });

  // 2. 필터링된 사업장의 매출 계산 데이터만 추출
  const filteredCalculations = filtered
    .map(business => {
      // 해당 사업장의 가장 최신 매출 계산 결과 찾기
      return calculations
        .filter(calc => calc.business_id === business.id)
        .sort((a, b) => new Date(b.calculation_date).getTime() - new Date(a.calculation_date).getTime())[0];
    })
    .filter(calc => calc !== undefined); // undefined 제거

  // 3. 필터링된 데이터로 통계 계산
  calculateStats(filteredCalculations);
}, [businesses, calculations, searchTerm, selectedOffices, selectedRegions, selectedCategories, selectedProjectYears, selectedMonths]);

// Line 608 - calculateStats 호출 제거
setCalculations(calculations);
// calculateStats는 useEffect에서 필터링된 데이터로 자동 계산됨

// Line 749 - 수동 통계 업데이트 제거
// 통계는 useEffect에서 필터링된 데이터로 자동 계산됨
```

## 주요 변경 사항

### 1. 자동 통계 재계산 (Line 137-182)
- 필터 상태가 변경될 때마다 `useEffect`가 자동으로 실행
- **테이블과 동일한 필터링 로직** 적용
- 필터링된 사업장의 **최신 매출 계산 결과만** 사용
- 통계 카드에 정확한 값 표시

### 2. 중복 제거 (Line 608, 749)
- 기존의 수동 `calculateStats()` 호출 제거
- useEffect에서 자동으로 계산하므로 중복 불필요

### 3. 반응형 통계 업데이트
필터 변경 시 자동으로 통계 재계산:
- `searchTerm` (검색어)
- `selectedOffices` (영업점 필터)
- `selectedRegions` (지역 필터)
- `selectedCategories` (진행상태 필터)
- `selectedProjectYears` (사업 전행 연도 필터) ⭐ **핵심**
- `selectedMonths` (월별 필터)

## 예상 결과

### 2025년 project_year 필터 적용 시:
- **Before**: ₩7,514,933,400 (75억원) - 전체 데이터
- **After**: ₩6,409,253,400 (64억원) - 필터링된 데이터
- **SQL 검증**: ₩6,409,253,400 ✅ **일치**

### 필터 없음(전체):
- 모든 사업장의 총 매출 표시
- 통계 카드와 테이블이 동일한 데이터 범위 사용

## 월마감과의 차이 설명

**매출관리 (project_year=2025)**: ₩6,409,253,400 (약 64억원)
**월마감 (calculation_date in 2025)**: ₩6,926,573,400 (약 69억원)

**차이 원인**:
- 매출관리: **설치 연도** 기준 필터링
- 월마감: **회계 날짜** 기준 필터링

**74개 추가 사업장**:
- 2024년 이전에 설치(`project_year < 2025`)
- 2025년에 매출 계산됨(`calculation_date in 2025`)
- 추가 매출: 약 ₩517,320,000 (5억 1,732만원)

## 검증 방법

### 1. 브라우저 콘솔 확인
```javascript
// 필터링된 사업장 수 확인
console.log('Filtered businesses:', businesses.filter(b =>
  selectedProjectYears.includes(String(b.project_year || ''))
).length);
```

### 2. SQL 검증 쿼리
```sql
-- project_year = 2025 기준
SELECT COUNT(DISTINCT business_id), SUM(total_revenue)
FROM business_info b
INNER JOIN revenue_calculations r ON b.id = r.business_id
WHERE b.project_year = 2025;
-- 결과: 1,072개, ₩6,409,253,400
```

## 관련 파일

- `/app/admin/revenue/page.tsx` - 매출관리 프론트엔드 (Line 137-182, 608, 749)
- `/app/api/revenue/calculate/route.ts` - 매출 계산 API (중복 제거 로직)
- `/claudedocs/revenue-filter-discrepancy.md` - 필터 방식 차이 분석
- `/claudedocs/revenue-discrepancy-verification.md` - 수정 내역 문서

## 다음 단계

1. ✅ 통계 카드 필터링 로직 수정 완료
2. ✅ 빌드 검증 완료
3. 🔄 개발 서버 재시작 및 브라우저 테스트 필요
4. 🔄 사용자가 원하는 필터 방식 선택 (project_year vs calculation_date)
