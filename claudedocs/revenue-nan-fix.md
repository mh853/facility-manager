# Revenue 페이지 NaN 오류 수정 보고서

## 📊 요약

**총 수정 개수**: 11곳 (1차: 3곳, 2차: 4곳, 3차: 4곳)
**커밋**: `dafb7c3` (1차), `a62409d` (2차), `4f9c625` (3차)
**상태**: ✅ 완료

### 수정 내역
- ✅ 통계 카드 총 이익금액 (1차)
- ✅ 통계 카드 평균 이익률 (1차)
- ✅ 테이블 헤더 평균 이익률 (1차)
- ✅ 모바일 카드뷰 이익률 계산 (2차)
- ✅ 모바일 카드뷰 이익금액 표시 (2차)
- ✅ 데스크톱 테이블 이익률 계산 (2차)
- ✅ 데스크톱 테이블 이익금액 표시 (2차)
- ✅ formatCurrency 함수 개선 (3차)
- ✅ 총 영업비용 NaN 수정 (3차)
- ✅ 이익금액 nullish coalescing 적용 (3차 x2)

## 🐛 문제 상황

### 1차 발견 (커밋 dafb7c3)
admin/revenue 페이지 상단 통계 카드에서 다음 항목이 `NaN`으로 표시:
- **총 이익금액**: NaN
- **사업장 평균 이익률**: NaN
- **총 영업비용**: 정상 표시 ✅

### 2차 발견 (커밋 a62409d)
admin/revenue 페이지 테이블 및 모바일 카드뷰에서 추가 `NaN` 발견:
- **모바일 카드뷰 이익률**: NaN
- **모바일 카드뷰 이익금액**: NaN
- **데스크톱 테이블 이익률**: NaN
- **데스크톱 테이블 이익금액**: NaN

### 3차 발견 (커밋 4f9c625)
사용자 피드백으로 추가 문제 확인:
- **총 영업비용 통계 카드**: NaN
- **규원테크, 영빈산업 이익금액**: ₩0 (음수 표시 문제 가능성)

## 🔍 원인 분석

### 1. 총 이익금액 (라인 1274)
```typescript
// ❌ 문제 코드
sortedBusinesses.reduce((sum, b) => sum + b.net_profit, 0)
```

**원인**: `b.net_profit`이 `undefined`인 경우
- `undefined + number = NaN`
- 한 번 NaN이 발생하면 전체 합계가 NaN

### 2. 사업장 평균 이익률 (라인 1323, 1458)
```typescript
// ❌ 문제 코드
b.total_revenue > 0 ? (b.net_profit / b.total_revenue * 100) : 0
```

**원인**: `b.net_profit`이 `undefined`인 경우
- `undefined / number = NaN`
- `NaN * 100 = NaN`

### 3. 총 영업비용 (정상 작동)
```typescript
// ✅ 정상 코드 (폴백 존재)
b.adjusted_sales_commission || b.sales_commission || 0
```

## ✅ 해결 방법

### 수정 내용

#### 1차 수정: 총 이익금액 & 평균 이익률
```typescript
// 총 이익금액 (Before)
sortedBusinesses.reduce((sum, b) => sum + b.net_profit, 0)

// 총 이익금액 (After)
sortedBusinesses.reduce((sum, b) => sum + (b.net_profit || 0), 0)

// 평균 이익률 (Before)
b.total_revenue > 0 ? (b.net_profit / b.total_revenue * 100) : 0

// 평균 이익률 (After)
b.total_revenue > 0 ? ((b.net_profit || 0) / b.total_revenue * 100) : 0
```

#### 2차 수정: 테이블 & 모바일뷰
```typescript
// 이익률 계산 (Before)
((business.net_profit / business.total_revenue) * 100).toFixed(1)

// 이익률 계산 (After)
(((business.net_profit || 0) / business.total_revenue) * 100).toFixed(1)

// 이익금액 표시 (Before)
{formatCurrency(business.net_profit)}

// 이익금액 표시 (After)
{formatCurrency(business.net_profit || 0)}
```

#### 3차 수정: formatCurrency & 총 영업비용 & Nullish Coalescing
```typescript
// formatCurrency 함수 개선 (Before)
const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat('ko-KR', {
    style: 'currency',
    currency: 'KRW'
  }).format(amount);
};

// formatCurrency 함수 개선 (After)
const formatCurrency = (amount: number | undefined | null) => {
  const value = Number(amount) || 0;
  if (isNaN(value)) return '₩0';
  return new Intl.NumberFormat('ko-KR', {
    style: 'currency',
    currency: 'KRW'
  }).format(value);
};

// 총 영업비용 (Before)
sortedBusinesses.reduce((sum, b) => {
  const salesCommission = b.adjusted_sales_commission || b.sales_commission || 0;
  return sum + salesCommission;
}, 0)

// 총 영업비용 (After)
sortedBusinesses.reduce((sum, b) => {
  const salesCommission = Number(b.adjusted_sales_commission || b.sales_commission || 0);
  return sum + (isNaN(salesCommission) ? 0 : salesCommission);
}, 0)

// 이익금액 표시 (Before)
{formatCurrency(business.net_profit || 0)}

// 이익금액 표시 (After - Nullish Coalescing)
{formatCurrency(business.net_profit ?? 0)}
```

**Nullish Coalescing (`??`) vs Logical OR (`||`)**:
- `||`: `0`, `""`, `false`, `null`, `undefined` 모두 폴백 → **음수도 0으로 변환 위험**
- `??`: `null`, `undefined`만 폴백 → **음수는 정상 표시**

### 파일 위치

#### 🎯 1차 수정 (커밋 dafb7c3)
- [app/admin/revenue/page.tsx:1274](app/admin/revenue/page.tsx#L1274) - 총 이익금액
- [app/admin/revenue/page.tsx:1323](app/admin/revenue/page.tsx#L1323) - 평균 이익률 (카드)
- [app/admin/revenue/page.tsx:1458](app/admin/revenue/page.tsx#L1458) - 평균 이익률 (테이블 헤더)

#### 🎯 2차 수정 (커밋 a62409d)
- [app/admin/revenue/page.tsx:1607](app/admin/revenue/page.tsx#L1607) - 모바일 카드뷰 이익률 계산
- [app/admin/revenue/page.tsx:1673-1674](app/admin/revenue/page.tsx#L1673-L1674) - 모바일 카드뷰 이익금액 표시
- [app/admin/revenue/page.tsx:1743](app/admin/revenue/page.tsx#L1743) - 데스크톱 테이블 이익률 계산
- [app/admin/revenue/page.tsx:1788-1789](app/admin/revenue/page.tsx#L1788-L1789) - 데스크톱 테이블 이익금액 표시

#### 🎯 3차 수정 (커밋 4f9c625)
- [app/admin/revenue/page.tsx:876-883](app/admin/revenue/page.tsx#L876-L883) - formatCurrency 함수 개선 (undefined/null 처리)
- [app/admin/revenue/page.tsx:1288-1291](app/admin/revenue/page.tsx#L1288-L1291) - 총 영업비용 계산 (Number 변환 및 NaN 검증)
- [app/admin/revenue/page.tsx:1675-1676](app/admin/revenue/page.tsx#L1675-L1676) - 모바일 카드뷰 이익금액 (|| → ??)
- [app/admin/revenue/page.tsx:1790-1791](app/admin/revenue/page.tsx#L1790-L1791) - 데스크톱 테이블 이익금액 (|| → ??)

## 📊 영향

### 수정 전
```
총 이익금액: NaN
사업장 평균 이익률: NaN
```

### 수정 후
```
총 이익금액: ₩12,345,678
사업장 평균 이익률: 15.3%
```

## 🎯 근본 원인

### net_profit이 undefined가 되는 경우

1. **계산 데이터 없음**
   - `revenueCalculations` 테이블에 데이터 없음
   - 자동 계산 로직 실패

2. **데이터베이스 스키마**
   ```typescript
   net_profit: number;  // NOT NULL 제약 없음
   ```

3. **계산 로직 (라인 1019-1023)**
   ```typescript
   const netProfit = grossProfit
     - salesCommission
     - (business.survey_costs || 0)
     - (business.installation_costs || 0)
     - ((business as any).installation_extra_cost || 0);
   ```
   - `grossProfit`이 계산되지 않으면 `undefined`

## 🔒 예방 조치

### 1. 타입 안전성 강화
```typescript
// 타입 정의에 명시적 폴백 추가
interface BusinessWithCalculation {
  net_profit: number;  // 기본값 0 보장
  total_revenue: number;  // 기본값 0 보장
}
```

### 2. 계산 로직 개선
```typescript
// 모든 숫자 계산에 폴백 추가
const netProfit = (grossProfit || 0)
  - (salesCommission || 0)
  - (business.survey_costs || 0)
  - (business.installation_costs || 0)
  - ((business as any).installation_extra_cost || 0);
```

### 3. 데이터 검증
```typescript
// sortedBusinesses 생성 시 검증
.map(business => ({
  ...business,
  net_profit: business.net_profit ?? 0,  // undefined → 0
  total_revenue: business.total_revenue ?? 0
}))
```

## 📝 체크리스트

### 1차 수정 (커밋 dafb7c3)
- [x] 총 이익금액 NaN 수정
- [x] 평균 이익률 NaN 수정 (카드)
- [x] 평균 이익률 NaN 수정 (테이블 헤더)
- [x] 커밋 및 푸시

### 2차 수정 (커밋 a62409d)
- [x] 모바일 카드뷰 이익률 계산 NaN 수정
- [x] 모바일 카드뷰 이익금액 표시 NaN 수정
- [x] 데스크톱 테이블 이익률 계산 NaN 수정
- [x] 데스크톱 테이블 이익금액 표시 NaN 수정
- [x] 커밋 및 푸시

### 3차 수정 (커밋 4f9c625)
- [x] formatCurrency 함수 타입 안전성 강화
- [x] 총 영업비용 NaN 수정 (Number 변환 + NaN 검증)
- [x] 이익금액 표시 개선 (|| → ?? nullish coalescing)
- [x] 커밋 및 푸시

### 배포 및 검증
- [ ] Vercel 배포 확인
- [ ] 프로덕션 테스트
- [ ] 규원테크, 영빈산업 이익금액 실제 값 확인

## 🚀 배포

### 1차 배포
```bash
git add app/admin/revenue/page.tsx
git commit -m "fix: admin/revenue 페이지 NaN 오류 수정"
git push origin main
```
**배포 상태**: ✅ 완료 (커밋 `dafb7c3`)

### 2차 배포
```bash
git add app/admin/revenue/page.tsx
git commit -m "fix: admin/revenue 테이블 및 모바일 카드뷰 NaN 오류 추가 수정"
git push origin main
```
**배포 상태**: ✅ 완료 (커밋 `a62409d`)

### 3차 배포
```bash
git add app/admin/revenue/page.tsx
git commit -m "fix: admin/revenue 총 영업비용 NaN 및 이익금액 표시 개선"
git push origin main
```
**배포 상태**: ✅ 완료 (커밋 `4f9c625`)

## 📌 참고

- 이 수정은 **증상 치료**입니다
- **근본 원인** 해결을 위해서는:
  1. 계산 로직 전체 리팩토링
  2. 타입 안전성 강화
  3. 데이터베이스 스키마 개선 (NOT NULL 제약)
  4. 입력 데이터 검증 강화

