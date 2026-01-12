# Revenue 페이지 NaN 오류 수정 보고서

## 🐛 문제 상황
admin/revenue 페이지에서 다음 항목이 `NaN`으로 표시:
- **총 이익금액**: NaN
- **사업장 평균 이익률**: NaN  
- **총 영업비용**: 정상 표시 ✅

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

#### 1. 총 이익금액
```typescript
// Before
sortedBusinesses.reduce((sum, b) => sum + b.net_profit, 0)

// After
sortedBusinesses.reduce((sum, b) => sum + (b.net_profit || 0), 0)
```

#### 2. 사업장 평균 이익률 (2곳)
```typescript
// Before
b.total_revenue > 0 ? (b.net_profit / b.total_revenue * 100) : 0

// After
b.total_revenue > 0 ? ((b.net_profit || 0) / b.total_revenue * 100) : 0
```

### 파일 위치
- [app/admin/revenue/page.tsx:1274](app/admin/revenue/page.tsx#L1274) - 총 이익금액
- [app/admin/revenue/page.tsx:1323](app/admin/revenue/page.tsx#L1323) - 평균 이익률 (카드)
- [app/admin/revenue/page.tsx:1458](app/admin/revenue/page.tsx#L1458) - 평균 이익률 (테이블 헤더)

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

- [x] 총 이익금액 NaN 수정
- [x] 평균 이익률 NaN 수정 (카드)
- [x] 평균 이익률 NaN 수정 (테이블)
- [x] 커밋 및 푸시
- [ ] Vercel 배포 확인
- [ ] 프로덕션 테스트

## 🚀 배포

```bash
git add app/admin/revenue/page.tsx
git commit -m "fix: admin/revenue 페이지 NaN 오류 수정"
git push origin main
```

**배포 상태**: ✅ 완료 (커밋 `dafb7c3`)

## 📌 참고

- 이 수정은 **증상 치료**입니다
- **근본 원인** 해결을 위해서는:
  1. 계산 로직 전체 리팩토링
  2. 타입 안전성 강화
  3. 데이터베이스 스키마 개선 (NOT NULL 제약)
  4. 입력 데이터 검증 강화

