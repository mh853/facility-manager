# 월 마감 집계 Silent Failure 수정 ✅

## 수정 완료 (2025-12-16)

**상태**: ✅ 수정 완료 및 빌드 성공

**수정 사항**:
1. ✅ 집계 실패 시 경고 메시지 반환 (API)
2. ✅ 상세 로깅 추가 (디버깅용)
3. ✅ 에러 체크 강화 (Supabase 쿼리 에러 감지)
4. ✅ 프론트엔드 경고 메시지 표시

**테스트 필요**:
- 개발 서버 재시작 후 자동 계산 실행
- 서버 로그에서 `[집계 시작]`, `[집계 데이터 조회 완료]`, `[집계 계산 완료]`, `[집계 저장 완료]` 메시지 확인
- 집계 실패 시 브라우저에 경고 메시지 표시 확인

---

## 문제 상황

사용자: "매출금액 계산이 안되고 있어. 계산은 성공했다고 나오는데 출력되는 값이 없어."

**브라우저 응답**: 계산 완료 메시지 표시
**실제 결과**: 월 마감 데이터 없음 (0원으로 표시되거나 빈 값)

## 근본 원인

`/app/api/admin/monthly-closing/auto-calculate/route.ts` 파일의 lines 194-248에서 월 마감 집계 로직이 try-catch로 감싸져 있지만, **에러 발생 시 에러를 무시하고 성공 응답을 반환**하는 구조:

```typescript
// 3. 계산 완료 후 월 마감 집계 실행 (직접 집계)
if (results.totalBusinesses > 0) {
  try {
    // ... 집계 계산 및 저장 로직 ...
    await supabase
      .from('monthly_closings')
      .upsert({...}, { onConflict: 'year,month' });

  } catch (error) {
    console.error('월 마감 집계 오류:', error);  // ❌ 에러를 로그만 하고 계속 진행
  }
}

// 항상 성공 응답 반환
return NextResponse.json({
  success: true,  // ❌ 집계 실패해도 success: true
  message: `${results.calculatedBusinesses}개 사업장 계산 완료`,
  data: results
});
```

## 문제 영향

1. **매출 계산 성공** → revenue_calculations 테이블에 데이터 저장됨 ✅
2. **월 마감 집계 실패** → monthly_closings 테이블에 데이터 없음 ❌
3. **API 응답 성공** → 프론트엔드에 "계산 완료" 메시지 표시 ❌
4. **사용자 혼란** → 성공 메시지가 나왔는데 데이터가 없음

## 수정 방안

### Option 1: 집계 실패 시 경고 포함 (권장)

집계가 실패해도 매출 계산은 성공했으므로, 경고와 함께 성공 응답:

```typescript
let aggregationWarning = null;

if (results.totalBusinesses > 0) {
  try {
    // ... 집계 로직 ...
  } catch (error) {
    console.error('월 마감 집계 오류:', error);
    aggregationWarning = '매출 계산은 완료되었으나 월 마감 집계 중 오류가 발생했습니다.';
  }
}

return NextResponse.json({
  success: true,
  message: aggregationWarning || `${results.calculatedBusinesses}개 사업장 계산 완료`,
  warning: aggregationWarning,
  data: results
});
```

### Option 2: 집계 실패 시 전체 실패

집계가 핵심 기능이므로 실패 시 전체를 실패로 처리:

```typescript
if (results.totalBusinesses > 0) {
  try {
    // ... 집계 로직 ...
  } catch (error) {
    console.error('월 마감 집계 오류:', error);
    return NextResponse.json({
      success: false,
      message: '매출 계산은 완료되었으나 월 마감 집계 중 오류가 발생했습니다.',
      data: results
    }, { status: 500 });
  }
}
```

## 권장 수정

**Option 1 채택 이유**:
- 매출 계산은 이미 성공했고 revenue_calculations 테이블에 저장됨
- 집계는 저장된 데이터를 기반으로 나중에 다시 실행 가능
- 사용자에게 명확한 피드백 제공

## 구현

### 1. Backend API 수정

**파일**: `/app/api/admin/monthly-closing/auto-calculate/route.ts`

**변경사항** (Lines 194-274):

1. **Warning 변수 추가**: `aggregationWarning` 변수로 집계 실패 추적
2. **상세 로깅 추가**: 각 단계마다 console.log로 진행 상황 추적
3. **에러 체크 강화**: Supabase 쿼리 에러를 throw하여 catch 블록에서 처리
4. **Warning 응답 추가**: API 응답에 `warning` 필드 추가

**핵심 변경**:
```typescript
// Before
if (results.totalBusinesses > 0) {
  try {
    // ... 집계 로직 ...
  } catch (error) {
    console.error('월 마감 집계 오류:', error);  // ❌ 에러 무시
  }
}

return NextResponse.json({
  success: true,  // ❌ 항상 성공
  message: `${results.calculatedBusinesses}개 사업장 계산 완료`,
  data: results
});

// After
let aggregationWarning = null;

if (results.totalBusinesses > 0) {
  try {
    console.log('[집계 시작] year:', year, 'month:', month);

    const { data: revenueData, error: revenueError } = await supabase...
    if (revenueError) {
      throw new Error(`매출 데이터 조회 실패: ${revenueError.message}`);
    }

    console.log('[집계 데이터 조회 완료] count:', revenueData?.length);
    // ... 집계 계산 ...
    console.log('[집계 계산 완료] totalRevenue:', totalRevenue, ...);

    const { error: upsertError } = await supabase...
    if (upsertError) {
      throw new Error(`월 마감 데이터 저장 실패: ${upsertError.message}`);
    }

    console.log('[집계 저장 완료] year:', year, 'month:', month);
  } catch (error) {
    console.error('[집계 실패]', error);  // ✅ 에러 로그
    aggregationWarning = '매출 계산은 완료되었으나 월 마감 집계 중 오류가 발생했습니다. 관리자에게 문의하세요.';  // ✅ 경고 설정
  }
}

return NextResponse.json({
  success: true,  // ✅ 매출 계산 성공
  message: aggregationWarning || `${results.calculatedBusinesses}개 사업장 계산 완료`,  // ✅ 동적 메시지
  warning: aggregationWarning,  // ✅ 경고 필드 추가
  data: results
});
```

### 2. Frontend UI 수정

**파일**: `/app/admin/monthly-closing/page.tsx`

**변경사항** (Lines 164-188):

**핵심 변경**:
```typescript
// Before
alert(
  `✅ 자동 계산 완료\n\n` +
  `총 사업장: ${results.totalBusinesses}개\n` +
  `계산 완료: ${results.calculatedBusinesses}개\n` +
  `실패: ${results.failedBusinesses}개`
);

// After
let message =
  `✅ 자동 계산 완료\n\n` +
  `총 사업장: ${results.totalBusinesses}개\n` +
  `계산 완료: ${results.calculatedBusinesses}개\n` +
  `실패: ${results.failedBusinesses}개`;

if (data.warning) {
  message += `\n\n⚠️ ${data.warning}`;  // ✅ 경고 메시지 표시
}

alert(message);
```

## 프론트엔드 수정

`/app/admin/monthly-closing/page.tsx`의 `handleAutoCalculate` 함수도 경고 메시지 처리 추가:

```typescript
if (data.success) {
  const results = data.data;

  // ... 기존 로직 ...

  let message =
    `✅ 자동 계산 완료\n\n` +
    `총 사업장: ${results.totalBusinesses}개\n` +
    `계산 완료: ${results.calculatedBusinesses}개\n` +
    `실패: ${results.failedBusinesses}개`;

  if (data.warning) {
    message += `\n\n⚠️ ${data.warning}`;
  }

  alert(message);
}
```

## 테스트 계획

1. **정상 케이스**: 매출 계산 + 월 마감 집계 모두 성공
   - 예상: "X개 사업장 계산 완료" 메시지
   - 확인: monthly_closings 테이블에 데이터 저장됨

2. **집계 실패 케이스**: 매출 계산 성공 but 집계 실패 (예: DB 권한 문제)
   - 예상: "매출 계산은 완료되었으나 월 마감 집계 중 오류가 발생했습니다." 메시지
   - 확인: revenue_calculations에는 데이터 있음, monthly_closings에는 없음

3. **매출 계산 실패 케이스**: 일부 사업장 실패
   - 예상: 실패 개수 포함된 상세 메시지
   - 확인: 성공한 사업장만 revenue_calculations에 저장

## 추가 개선사항

### 1. 집계 재실행 기능 추가

월 마감 집계만 별도로 재실행할 수 있는 API 엔드포인트 제공:

```typescript
// POST /api/admin/monthly-closing/reaggregate
// 이미 저장된 revenue_calculations 데이터를 기반으로 집계만 다시 실행
```

### 2. 집계 실패 로그 상세화

어떤 단계에서 실패했는지 명확히 기록:

```typescript
try {
  console.log('[집계 시작] year:', year, 'month:', month);
  const { data: revenueData } = await supabase...
  console.log('[집계 데이터 조회 완료] count:', revenueData?.length);

  // ... 계산 로직 ...
  console.log('[집계 계산 완료] totalRevenue:', totalRevenue);

  await supabase.from('monthly_closings').upsert(...);
  console.log('[집계 저장 완료]');
} catch (error) {
  console.error('[집계 실패]', error);
  // error stack trace 포함
}
```

## 관련 파일

- `/app/api/admin/monthly-closing/auto-calculate/route.ts` - 자동 계산 API
- `/app/admin/monthly-closing/page.tsx` - 프론트엔드 UI
- `/claudedocs/monthly-closing-auth-fix.md` - CSRF 수정 문서
- `/claudedocs/monthly-closing-auto-calculate-fix.md` - 자동 계산 로직 수정 문서
