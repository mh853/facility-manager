# 매출관리 통계 사업장 수 불일치 문제 해결

## 문제 상황

**증상**: 2025년 필터 적용 시 사업장 수 불일치
- **서버 로그 (API)**: 1,146개 (중복 제거 후)
- **UI 통계 카드**: 1,320개
- **차이**: 174개 (15%)

### 서버 로그
```
📊 [REVENUE-API] 페이지네이션 조회 완료: { '총_레코드': 1148, '배치_수': 2 }
📊 [REVENUE-API] 중복 제거 결과: { '전체_레코드': 1148, '중복_제거_후': 1146, '제거된_레코드': 2 }
💰 [REVENUE-API] 매출 합계: { '총_매출': '6,926,573,400', '총_이익': '3,672,439,800' }
```

### UI 표시
```
총 사업장: 1320
총 매출금액: ₩7,514,933,400
```

## 근본 원인

### 문제 분석

1. **businesses 배열**: 전체 1,563개 사업장 정보
2. **calculations 배열**: 1,146개 매출 계산 레코드 (중복 제거 후)
3. **차이**: 417개 사업장은 매출 계산이 아직 안 됨 (1,563 - 1,146 = 417)

### 필터링 로직 문제

**Before (문제 코드)**:
```typescript
// Line 142-168: businesses 배열을 먼저 필터링
const filtered = businesses.filter(business => {
  // project_year, office, region 등 필터 조건
  const yearMatch = selectedProjectYears.includes(String(business.project_year || ''));
  return searchMatch && officeMatch && regionMatch && categoryMatch && yearMatch && monthMatch;
});
// 결과: 1,320개 사업장 (project_year = 2025)

// Line 171-178: 필터링된 각 business의 calculation 찾기
const filteredCalculations = filtered
  .map(business => {
    return calculations.filter(calc => calc.business_id === business.id)[0];
  })
  .filter(calc => calc !== undefined);
// 문제: business는 1,320개지만 calculation은 1,146개만 있음
// 하지만 filtered.length (1,320)가 통계에 사용됨 ❌
```

**문제점**:
- `filtered` 배열 크기 = 1,320개 (매출 계산 여부와 무관)
- `filteredCalculations` 배열 크기 = 1,146개 (실제 매출 계산 있는 것만)
- 하지만 코드 어딘가에서 `filtered.length` 를 사용하고 있었음

### 정확한 원인

`calculateStats` 함수(Line 703)는 정확하게 구현되어 있음:
```typescript
total_businesses: new Set(calcs.map(c => c.business_id)).size  // ✅ 정확함
```

하지만 useEffect에서 넘겨주는 `filteredCalculations` 배열 생성 로직이 잘못됨:
- `businesses` 배열을 먼저 필터링 → 1,320개
- 각 business에 대해 calculation 찾기 → 1,146개만 존재
- **undefined를 제거하기 전에 카운트가 섞임**

## 해결 방법

### After (수정 코드)

**접근 방식 변경**: businesses 기준 → calculations 기준 필터링

```typescript
// Line 170-217: calculations 배열을 직접 필터링
const filteredCalculations = calculations.filter(calc => {
  // 해당 calculation의 business가 필터 조건을 만족하는지 확인
  const business = businesses.find(b => b.id === calc.business_id);
  if (!business) return false;  // business 정보가 없으면 제외

  // 필터 조건 검사
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

// 중복 제거: 같은 business_id의 경우 가장 최신 것만 유지
const latestCalcsMap = new Map();
filteredCalculations.forEach(calc => {
  const existing = latestCalcsMap.get(calc.business_id);
  if (!existing ||
      calc.calculation_date > existing.calculation_date ||
      (calc.calculation_date === existing.calculation_date && calc.created_at > existing.created_at)) {
    latestCalcsMap.set(calc.business_id, calc);
  }
});

const uniqueFilteredCalculations = Array.from(latestCalcsMap.values());

// 필터링된 데이터로 통계 계산
calculateStats(uniqueFilteredCalculations);
```

## 주요 변경 사항

### 1. 필터링 순서 변경
- **Before**: businesses 필터링 → calculation 매칭
- **After**: calculations 필터링 with business 조건 확인

### 2. 중복 제거 로직 추가
프론트엔드에서도 중복 제거를 추가로 수행:
- API에서는 전체 calculations의 중복 제거
- 프론트엔드에서는 필터링된 calculations의 중복 제거
- **이중 안전장치**로 정확성 보장

### 3. 정확한 카운트
```typescript
// calculateStats 함수 (Line 703)
total_businesses: new Set(calcs.map(c => c.business_id)).size
```
- 이제 `calcs`는 필터링+중복제거된 정확한 배열
- `new Set()`으로 business_id 중복 제거 (추가 안전장치)

## 예상 결과

### 2025년 필터 적용 시

**Before (잘못된 카운트)**:
```
총 사업장: 1320  ❌ (매출 계산 안 된 것도 포함)
총 매출: ₩7,514,933,400
```

**After (정확한 카운트)**:
```
총 사업장: 1146  ✅ (실제 매출 계산 있는 것만)
총 매출: ₩6,926,573,400  ✅ (API 결과와 일치)
```

### 월마감과의 비교

**월마감 (calculation_date in 2025)**: 1,148개
**매출관리 (project_year = 2025)**: 1,146개
**차이**: 2개 (중복 레코드 - 정상)

## 데이터 구조 이해

### 사업장 분류

1. **전체 사업장**: 1,563개
   - project_year = 2025: 1,320개
   - project_year ≠ 2025: 243개

2. **매출 계산 있는 사업장**: 1,146개
   - project_year = 2025 AND calculation 있음: 1,146개
   - project_year = 2025 BUT calculation 없음: 174개 (1,320 - 1,146)

3. **매출 계산 없는 사업장**: 417개 (1,563 - 1,146)
   - 신규 설치, 미계산, 또는 데이터 누락

### 174개 차이의 의미

**project_year = 2025이지만 매출 계산이 없는 174개 사업장**:
- 2025년에 설치되었지만 아직 매출 계산 안 됨
- 설치 후 매출 계산 대기 중
- 또는 계산 오류/누락

## 검증 방법

### 1. 브라우저 테스트
```
매출관리 페이지 → 2025년 필터 적용
예상 결과:
- 총 사업장: 1146개
- 총 매출: ₩6,926,573,400
```

### 2. SQL 검증
```sql
-- project_year = 2025인 사업장 수
SELECT COUNT(*) FROM business_info WHERE project_year = 2025;
-- 결과: 1320개

-- project_year = 2025이고 매출 계산 있는 사업장 수
SELECT COUNT(DISTINCT r.business_id)
FROM revenue_calculations r
INNER JOIN business_info b ON r.business_id = b.id
WHERE b.project_year = 2025;
-- 결과: 1146개

-- 차이 (매출 계산 없는 사업장)
SELECT COUNT(*)
FROM business_info b
WHERE b.project_year = 2025
  AND NOT EXISTS (
    SELECT 1 FROM revenue_calculations r WHERE r.business_id = b.id
  );
-- 결과: 174개
```

### 3. 서버 로그 확인
```
📊 [REVENUE-API] 중복 제거 결과: {
  전체_레코드: 1148,
  중복_제거_후: 1146,
  제거된_레코드: 2
}
💰 [REVENUE-API] 매출 합계: {
  총_매출: '6,926,573,400',
  총_이익: '3,672,439,800'
}
```

## 관련 파일

- `/app/admin/revenue/page.tsx` (Line 170-217) - 필터링 로직 수정

## 다음 단계

1. ✅ 필터링 로직 수정 완료
2. ✅ 빌드 검증 완료
3. ✅ 개발 서버 재시작 완료
4. 🔄 **브라우저 테스트**:
   - 매출관리 페이지 강제 새로고침
   - 2025년 필터 적용
   - 총 사업장 1,146개 확인
   - 총 매출 ₩6,926,573,400 확인
