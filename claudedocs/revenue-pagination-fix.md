# 매출관리 API 페이지네이션 문제 해결

## 문제 상황

**증상**: 서버 로그에서 발견
```
✅ [BUSINESS-INFO-DIRECT] 조회 완료 - 1563개 사업장
📊 [REVENUE-API] 중복 제거 결과: { '전체_레코드': 1000, '중복_제거_후': 998, '제거된_레코드': 2 }
```

- **전체 사업장**: 1,563개
- **API 조회**: 1,000개만 조회됨
- **누락**: 563개 사업장 (36%)

## 근본 원인

### Supabase 쿼리 제한
Supabase는 한 번의 쿼리로 **최대 1,000개**의 레코드만 반환합니다.

```typescript
// Before (문제 코드)
let query = supabaseAdmin
  .from('revenue_calculations')
  .select('*')
  .order('calculation_date', { ascending: false })
  .range(offset, offset + limit - 1); // ❌ limit=10000이어도 1000개만 반환됨

const { data: allCalculations, error } = await query;
```

**문제점**:
- `limit` 파라미터를 10,000으로 설정해도 Supabase는 1,000개까지만 반환
- 1,563개 사업장 중 1,000개만 조회되어 563개 누락
- 누락된 사업장의 매출이 통계에서 제외됨

## 해결 방법

### 페이지네이션 루프 구현

```typescript
// After (수정 코드)
const BATCH_SIZE = 1000;
let allCalculations: any[] = [];
let currentOffset = 0;
let hasMore = true;

while (hasMore) {
  let query = supabaseAdmin
    .from('revenue_calculations')
    .select('*')
    .order('calculation_date', { ascending: false })
    .range(currentOffset, currentOffset + BATCH_SIZE - 1);

  // 필터 조건 적용
  if (businessId) query = query.eq('business_id', businessId);
  if (salesOffice) query = query.eq('sales_office', salesOffice);
  if (startDate) query = query.gte('calculation_date', startDate);
  if (endDate) query = query.lte('calculation_date', endDate);

  const { data, error } = await query;

  if (error) {
    console.error('매출 계산 조회 오류:', error);
    return NextResponse.json({
      success: false,
      message: '계산 결과 조회에 실패했습니다.'
    }, { status: 500 });
  }

  if (data && data.length > 0) {
    allCalculations = allCalculations.concat(data);
    currentOffset += BATCH_SIZE;
    hasMore = data.length === BATCH_SIZE; // 1000개 미만이면 마지막 배치
  } else {
    hasMore = false;
  }
}

console.log('📊 [REVENUE-API] 페이지네이션 조회 완료:', {
  총_레코드: allCalculations.length,
  배치_수: Math.ceil(allCalculations.length / BATCH_SIZE)
});
```

## 동작 원리

### 배치 처리 프로세스

1. **첫 번째 배치 (offset: 0-999)**
   - 1,000개 레코드 조회
   - `allCalculations`에 추가
   - `hasMore = true` (1000개 = BATCH_SIZE)

2. **두 번째 배치 (offset: 1000-1999)**
   - 563개 레코드 조회 (남은 전체)
   - `allCalculations`에 추가
   - `hasMore = false` (563개 < BATCH_SIZE)

3. **루프 종료**
   - 총 1,563개 레코드 조회 완료
   - 중복 제거 로직 적용

### 로그 출력 예시

```
📊 [REVENUE-API] 페이지네이션 조회 완료: {
  총_레코드: 1563,
  배치_수: 2
}
📊 [REVENUE-API] 중복 제거 결과: {
  전체_레코드: 1563,
  중복_제거_후: 1561,
  제거된_레코드: 2
}
```

## 예상 효과

### Before (1000개 제한)
- 조회 레코드: 1,000개
- 중복 제거 후: 998개
- 누락: 563개 사업장

### After (전체 조회)
- 조회 레코드: 1,563개
- 중복 제거 후: 1,561개 (예상)
- 누락: 0개 ✅

### 매출 통계 영향

**2025년 필터 적용 시**:
- Before: 일부 사업장만 집계 (부정확)
- After: 전체 사업장 집계 (정확) ✅

**전체 매출**:
- Before: 약 57억원 (1000개 기준)
- After: 전체 매출 정확히 반영 (1563개 기준)

## 성능 고려사항

### 쿼리 성능
- **배치 수**: 1,563개 ÷ 1,000 = 2회 쿼리
- **응답 시간**: 약 2-3초 (배치 2회 × 1-1.5초)
- **메모리**: 1,563개 레코드 메모리 적재 (약 1-2MB)

### 최적화 가능성
현재 구현으로도 충분하지만, 향후 레코드가 10,000개 이상으로 증가하면:
1. **캐싱**: Redis 등으로 결과 캐싱
2. **백그라운드 작업**: 정기적으로 미리 집계
3. **데이터베이스 뷰**: `monthly_closings`처럼 집계 테이블 활용

## 관련 파일

- `/app/api/revenue/calculate/route.ts` (Line 685-736) - 페이지네이션 로직 추가

## 검증 방법

### 1. 서버 로그 확인
```bash
# 개발 서버 재시작 후 매출관리 페이지 접속
npm run dev

# 로그에서 확인
📊 [REVENUE-API] 페이지네이션 조회 완료: { 총_레코드: 1563, 배치_수: 2 }
📊 [REVENUE-API] 중복 제거 결과: { 전체_레코드: 1563, 중복_제거_후: 1561, 제거된_레코드: 2 }
```

### 2. SQL 검증
```sql
-- 전체 매출 계산 레코드 수 확인
SELECT COUNT(*) FROM revenue_calculations;
-- 결과: 1563개 (또는 그 이상)

-- 사업장별 최신 레코드 수 확인
SELECT COUNT(DISTINCT business_id) FROM revenue_calculations;
-- 결과: 약 1561개 (중복 제거 후)
```

### 3. 브라우저 콘솔
```javascript
// 매출관리 페이지에서
fetch('/api/revenue/calculate')
  .then(r => r.json())
  .then(data => {
    console.log('조회된 사업장 수:', data.data.calculations.length);
    console.log('총 매출:', data.data.summary.total_revenue);
  });
```

## 다음 단계

1. ✅ 페이지네이션 로직 구현 완료
2. ✅ 빌드 검증 완료
3. ✅ 개발 서버 재시작 완료
4. 🔄 브라우저에서 테스트:
   - 매출관리 페이지 접속
   - 필터 없음(전체) 확인 → 1,561개 사업장 표시 예상
   - 2025년 필터 적용 → 정확한 매출 표시 예상
   - 서버 로그에서 1,563개 조회 확인
