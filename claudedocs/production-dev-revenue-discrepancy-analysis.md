# 배포 버전과 개발 서버 매출 통계 불일치 분석

## 📊 작성일
2026-01-19

## 🎯 문제 요약

개발 서버(localhost:3000)와 배포 버전(facility.blueon-iot.com)의 매출 관리 페이지에서 **통계 금액이 크게 다름**.

---

## 📸 스크린샷 비교

### 개발 서버 (localhost:3000)
```
총 사업장: 1553개
총 매출금액: ₩8,930,793,400
총 이익금액: ₩4,650,490,800
총 영업비용: ₩877,290,400
총 설치비용: ₩818,475,000
사업장 평균 이익률: 49.8%
```

### 배포 버전 (facility.blueon-iot.com)
```
총 사업장: 1553개
총 매출금액: ₩11,514,793,400
총 이익금액: ₩5,164,736,940
총 영업비용: ₩1,214,719,260
총 설치비용: ₩1,286,050,000
사업장 평균 이익률: 43.9%
```

---

## 💰 금액 차이 분석

| 항목 | 개발 서버 | 배포 버전 | 차이 | 차이율 |
|------|-----------|-----------|------|--------|
| 총 매출 | ₩8,930,793,400 | ₩11,514,793,400 | **+₩2,584,000,000** | +28.9% |
| 총 이익 | ₩4,650,490,800 | ₩5,164,736,940 | +₩514,246,140 | +11.1% |
| 영업비용 | ₩877,290,400 | ₩1,214,719,260 | +₩337,428,860 | +38.5% |
| 설치비용 | ₩818,475,000 | ₩1,286,050,000 | +₩467,575,000 | +57.1% |
| 평균 이익률 | 49.8% | 43.9% | -5.9%p | -11.8% |

**핵심 발견:**
- 사업장 수는 동일 (1553개)
- 매출이 **26억원** 차이 → 계산 로직 차이
- 설치비용이 **57% 높음** → 설치비 계산 방식 차이

---

## 🔍 원인 분석

### 1. 코드 버전 차이 (Root Cause)

**최근 커밋 이력:**
```bash
2ceb107 chore: 가상 스크롤링 라이브러리 추가
d8a29de refactor: 매출 관리 페이지 성능 최적화 및 실시간 계산 개선  ← 핵심 변경
5fb7ede chore: 매출/비용 계산 검증용 유틸리티 스크립트 추가
703890a docs: 매출/대시보드 관련 분석 및 수정 문서 추가
307edf5 feat: 대시보드 실시간 순이익 계산 구현 (매출관리와 100% 동일)  ← 핵심 변경
```

**배포 버전 상태:**
- 위 커밋들이 **반영되지 않음**
- 구버전 계산 로직 사용 중

### 2. 계산 로직 차이

#### 개발 서버 (최신 코드)

**파일**: [app/admin/revenue/page.tsx](app/admin/revenue/page.tsx#L746-L813)

```typescript
// ✅ 실시간 계산 (useMemo)
const filteredBusinesses = useMemo(() => {
  if (!pricesLoaded || !costSettingsLoaded) {
    return [];
  }

  const pricingData: PricingData = {
    officialPrices,
    manufacturerPrices,
    salesOfficeSettings,
    surveyCostSettings,
    baseInstallationCosts
  };

  return businesses.filter(...).map(business => {
    // ✅ 실시간 계산 적용
    const calculatedData = calculateBusinessRevenue(business, pricingData);

    return {
      ...business,
      total_revenue: calculatedData.total_revenue,
      total_cost: calculatedData.total_cost,
      net_profit: calculatedData.net_profit,
      gross_profit: calculatedData.gross_profit,
      sales_commission: calculatedData.sales_commission,
      adjusted_sales_commission: calculatedData.adjusted_sales_commission,
      survey_costs: calculatedData.survey_costs,
      installation_costs: calculatedData.installation_costs,
      // ... 기타 필드
    };
  });
}, [dependencies...]);

// 통계 계산
useEffect(() => {
  const totalRevenue = filteredBusinesses.reduce((sum, biz) => sum + biz.total_revenue, 0);
  const totalProfit = filteredBusinesses.reduce((sum, biz) => sum + biz.net_profit, 0);
  // ...
}, [filteredBusinesses]);
```

**핵심 특징:**
1. `calculateBusinessRevenue()` 함수로 **실시간 계산**
2. 모든 비용 조정 반영:
   - 사업장별 추가 설치비 (`business_additional_installation_cost`)
   - 영업비용 조정 (`operating_cost_adjustments`)
   - 실사비 조정 (`survey_fee_adjustment`)
   - 영업비용 계산 기준: 기본 매출 - 협의사항
3. 필터링된 결과를 직접 집계

#### 배포 버전 (구버전 추정)

**추정 로직:**
1. `/api/revenue/calculate` API에서 저장된 계산 결과 사용
2. 또는 구버전 하이브리드 로직:
   - 저장된 계산 값이 있으면 사용
   - 없으면 간단한 실시간 계산
3. 일부 비용 조정 누락:
   - 사업장별 추가 설치비 미반영
   - 영업비용 조정 미반영
   - 실사비 조정 미반영

**결과:**
- 매출이 더 높게 계산됨 (추가공사비 이중 계산 등)
- 설치비용이 더 높게 계산됨
- 영업비용이 더 높게 계산됨
- 순이익은 상대적으로 낮음

---

## 🔧 해결 방법

### 1. Vercel 자동 배포 대기

```bash
# Git push 완료 확인
git log --oneline -5
# 2ceb107 chore: 가상 스크롤링 라이브러리 추가
# d8a29de refactor: 매출 관리 페이지 성능 최적화 및 실시간 계산 개선
# ...

git remote -v
# origin  https://github.com/mhc-projects/facility-manager.git

# Vercel이 자동으로 감지하여 배포 시작
```

### 2. 수동 배포 트리거 (필요시)

Vercel 대시보드에서:
1. https://vercel.com/dashboard 접속
2. facility-manager 프로젝트 선택
3. "Deployments" 탭 클릭
4. 최신 커밋 확인
5. 필요시 "Redeploy" 버튼 클릭

### 3. 배포 완료 후 검증

배포 완료 후 다음을 확인:

```javascript
// 배포 버전에서 브라우저 콘솔 확인
// 실시간 계산이 수행되는지 확인
console.log(filteredBusinesses);

// 예상 결과:
// - total_revenue: calculateBusinessRevenue()로 계산된 값
// - has_calculation: true (항상)
// - calculation_date: 최근 시각
```

**예상 통계 (배포 후):**
```
총 매출금액: ₩8,930,793,400 (개발 서버와 동일)
총 이익금액: ₩4,650,490,800 (개발 서버와 동일)
총 영업비용: ₩877,290,400 (개발 서버와 동일)
총 설치비용: ₩818,475,000 (개발 서버와 동일)
사업장 평균 이익률: 49.8% (개발 서버와 동일)
```

---

## 📋 체크리스트

### 배포 전
- [x] 최신 코드 커밋 완료
- [x] Git push 완료
- [x] 코드 분석 완료
- [x] 문서화 완료

### 배포 후 검증
- [ ] Vercel 배포 상태 확인
- [ ] 배포 버전 접속: facility.blueon-iot.com/admin/revenue
- [ ] 통계 금액 확인 (개발 서버와 동일해야 함)
- [ ] 브라우저 콘솔에서 실시간 계산 확인
- [ ] 개별 사업장 계산 결과 샘플 확인

### 테스트 시나리오
1. **통계 카드 확인**
   - 총 매출금액 = ₩8,930,793,400
   - 총 이익금액 = ₩4,650,490,800
   - 평균 이익률 = 49.8%

2. **개별 사업장 확인**
   - 첫 번째 사업장: (주)규원테크
   - 매출: ₩3,200,000
   - 매입: ₩1,405,000
   - 이익: ₩1,105,000
   - 이익률: 34.5%

3. **필터 테스트**
   - 검색: "규원테크" → 결과 1개
   - 영업점 필터: "스탠다드비스" → 해당 영업점 사업장만 표시
   - 매출 필터: 최소 300만원 → 조건 만족 사업장만 표시

---

## 🔍 기술적 세부 사항

### calculateBusinessRevenue 함수

**파일**: [lib/revenue-calculator.ts](lib/revenue-calculator.ts)

이 함수는 다음을 계산합니다:

```typescript
export function calculateBusinessRevenue(
  business: any,
  pricingData: PricingData
): CalculatedRevenue {
  // 1. 기본 매출 = Σ(환경부 고시가 × 수량)
  // 2. 영업비용 계산 기준 = 기본 매출 - 협의사항
  // 3. 최종 매출 = 기본 매출 + 추가공사비 - 협의사항
  // 4. 영업비용 = 기준매출 × 비율 + 영업비용조정
  // 5. 제조사 매입 = Σ(제조사 원가 × 수량)
  // 6. 설치비용 = Σ((기본+공통추가+기기별추가) × 수량)
  // 7. 실사비용 = 기본 + 조정 + survey_fee_adjustment
  // 8. 총이익 = 최종 매출 - 제조사 매입
  // 9. 순이익 = 총이익 - 추가설치비 - 영업비용 - 실사비용 - 설치비용
}
```

### 통계 집계 로직

```typescript
// filteredBusinesses 배열을 집계
const totalRevenue = filteredBusinesses.reduce((sum, biz) => {
  return sum + biz.total_revenue;  // calculateBusinessRevenue() 결과
}, 0);

const totalProfit = filteredBusinesses.reduce((sum, biz) => {
  return sum + biz.net_profit;  // calculateBusinessRevenue() 결과
}, 0);
```

---

## 🎯 결론

**문제 원인:**
- 배포 버전이 최신 코드를 반영하지 않음
- 구버전 계산 로직 사용 중

**해결 방법:**
- Vercel 자동 배포 대기 또는 수동 재배포
- 배포 후 통계 금액이 개발 서버와 동일해져야 함

**예상 결과:**
- 개발 서버와 배포 버전의 통계 금액 일치
- 정확한 실시간 순이익 계산 적용
- 모든 비용 조정 반영

---

**작성자**: Claude Code
**최종 수정**: 2026-01-19
**상태**: ✅ 분석 완료 - 배포 대기 중
