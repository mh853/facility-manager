# 월 마감 매입금액 표시 문제 해결

## 문제 상황
SQL 마이그레이션 실행 후 개발서버를 재시작하고 브라우저를 강제 새로고침했지만, 테이블에 매입금액이 출력되지 않는 문제

## 원인 분석

1. **데이터베이스 스키마**: ✅ 정상 (total_cost 컬럼 추가됨)
2. **백엔드 API**: ✅ 정상 (total_cost 집계 및 반환 구현됨)
3. **프론트엔드 코드**: ✅ 수정 완료 (fallback 객체에 totalCost 추가)
4. **기존 데이터**: ❌ **문제 원인**

### 근본 원인
기존에 생성된 `monthly_closings` 레코드들은 `total_cost` 컬럼이 추가되기 전에 만들어졌기 때문에 기본값 `0`을 가지고 있습니다.

## 해결 방법

### 방법 1: 자동 계산 재실행 (권장)
각 월에 대해 "자동 계산" 버튼을 다시 클릭하면 total_cost가 재계산되어 저장됩니다.

**절차**:
1. `/admin/monthly-closing` 페이지 접속
2. 각 월의 "자동 계산" 버튼 클릭
3. 계산 완료 후 테이블에서 매입금액 확인

### 방법 2: SQL로 일괄 업데이트
기존 모든 월의 total_cost를 한 번에 재계산하는 SQL 쿼리:

```sql
-- 각 월별 마감의 total_cost를 revenue_calculations에서 재계산
UPDATE monthly_closings mc
SET
  total_cost = (
    SELECT COALESCE(SUM(rc.total_cost), 0)
    FROM revenue_calculations rc
    WHERE
      EXTRACT(YEAR FROM rc.calculation_date) = mc.year
      AND EXTRACT(MONTH FROM rc.calculation_date) = mc.month
  ),
  updated_at = NOW()
WHERE mc.id IS NOT NULL;
```

**주의**: 이 쿼리는 모든 기존 월별 마감의 total_cost를 revenue_calculations 데이터를 기반으로 재계산합니다.

## 수정된 파일

### `/app/admin/monthly-closing/page.tsx` (Line 100-106)
**변경 전**:
```typescript
setSummary(data.data.summary || {
  totalRevenue: 0,
  totalSalesCommission: 0,
  totalInstallationCosts: 0,
  totalMiscCosts: 0,
  totalProfit: 0
});
```

**변경 후**:
```typescript
setSummary(data.data.summary || {
  totalRevenue: 0,
  totalCost: 0,  // ✅ 추가
  totalSalesCommission: 0,
  totalInstallationCosts: 0,
  totalMiscCosts: 0,
  totalProfit: 0
});
```

## 검증 방법

1. **브라우저 개발자 도구** (F12) 열기
2. **Network 탭**에서 `/api/admin/monthly-closing` 요청 확인
3. **Response** 데이터에서 `summary.totalCost` 값 확인:
   ```json
   {
     "success": true,
     "data": {
       "summary": {
         "totalRevenue": 1000000,
         "totalCost": 500000,  // ← 이 값이 0이 아닌지 확인
         "totalSalesCommission": 100000,
         ...
       }
     }
   }
   ```

4. 만약 `totalCost`가 0이라면:
   - 기존 월별 마감 데이터의 total_cost가 0이라는 의미
   - "자동 계산" 재실행 필요

## 향후 새로운 월 마감

새로 생성되는 월별 마감은 자동으로 total_cost가 계산되어 저장되므로 별도 작업이 필요 없습니다.

### 자동 계산 흐름
1. 사용자가 특정 연월의 "자동 계산" 클릭
2. `/api/admin/monthly-closing` POST 요청
3. `revenue_calculations` 테이블에서 해당 월의 모든 사업장 데이터 조회
4. **total_cost 집계** (Line 204):
   ```typescript
   const totalCost = businesses?.reduce((sum, b) =>
     sum + (Number(b.total_cost) || 0), 0) || 0;
   ```
5. `monthly_closings` 테이블에 upsert (Line 250):
   ```typescript
   total_cost: totalCost
   ```

## 관련 파일
- `/app/admin/monthly-closing/page.tsx` - 프론트엔드 UI
- `/app/api/admin/monthly-closing/route.ts` - GET/POST API
- `/app/api/admin/monthly-closing/auto-calculate/route.ts` - 자동 계산 API
- `/sql/monthly_closings_add_total_cost.sql` - 스키마 마이그레이션
- `/types/index.ts` - TypeScript 타입 정의
