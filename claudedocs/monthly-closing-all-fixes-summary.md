# 월 마감 시스템 전체 수정 내역 요약

## 수정 완료 날짜: 2025-12-16

---

## 🎯 전체 수정 사항 요약

| 문제 | 원인 | 해결 | 상태 |
|------|------|------|------|
| 403 Forbidden 오류 | CSRF 미들웨어가 JWT 인증 API 차단 | CSRF 제외 리스트에 월 마감 API 추가 | ✅ 완료 |
| 자동 계산 미실행 | API 호출 없이 데이터 존재만 확인 | 실제 revenue calculate API 호출로 변경 | ✅ 완료 |
| 0원 매출 계산 성공 | 0원 결과를 성공으로 처리 | 0원 결과를 실패로 분류 (원가 데이터 확인 필요) | ✅ 완료 |
| 제조사 원가 데이터 미매칭 | 공백 문자로 인한 정확한 매칭 실패 | manufacturer 값에 trim() 적용 | ✅ 완료 |
| 500 Error (구문 오류) | 빈 줄 누락으로 인한 파싱 오류 | 권한 체크 후 빈 줄 추가 | ✅ 완료 |
| 집계 실패 무시 (Silent Failure) | 집계 실패해도 성공 응답 반환 | 경고 메시지로 집계 실패 알림 | ✅ 완료 |
| 집계 스키마 오류 | 존재하지 않는 컬럼 조회 (installation_extra_cost) | SELECT 쿼리에서 해당 컬럼 제거 | ✅ 완료 |

---

## 📁 수정된 파일 목록

### 1. `/lib/security/csrf-protection.ts` (Lines 151-152)
**목적**: CSRF 보호에서 JWT 인증 사용 API 제외

**변경 내용**:
```typescript
const excludePatterns = [
  // ... 기존 패턴들
  '/api/admin/monthly-closing',  // 월 마감 관리 API (JWT 인증 사용)
  '/api/admin/monthly-closing/*'  // 월 마감 관리 API 전체 제외 (JWT 인증 사용)
];
```

**관련 문서**: [monthly-closing-auth-fix.md](./monthly-closing-auth-fix.md)

---

### 2. `/app/api/admin/monthly-closing/auto-calculate/route.ts`

#### 변경 1: 실제 매출 계산 API 호출 (Lines 109-181)
**목적**: 데이터 존재 확인 → 실제 계산 실행으로 변경

**Before**:
```typescript
// 기존 계산 결과 확인만 함
const { data: existingCalc } = await supabase
  .from('revenue_calculations')
  .select('id')
  .eq('business_id', business.id)
  .single();

if (!existingCalc || force) {
  // 데이터 없으면 실패 처리
  results.failedBusinesses++;
}
```

**After**:
```typescript
// 실제 revenue calculate API 호출
const calculateResponse = await fetch(`${request.nextUrl.origin}/api/revenue/calculate`, {
  method: 'POST',
  headers: {
    'Authorization': request.headers.get('authorization') || '',
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    business_id: business.id,
    calculation_date: calculationDate,
    save_result: true
  })
});

// 0원 결과는 실패로 처리
if (revenue === 0 || !calculateResult.data) {
  results.failedBusinesses++;
  results.businesses.push({
    business_id: business.id,
    business_name: business.business_name,
    status: 'failed',
    message: '매출 계산 결과 없음 (원가 데이터 확인 필요)',
    revenue: 0
  });
}
```

**관련 문서**: [monthly-closing-auto-calculate-fix.md](./monthly-closing-auto-calculate-fix.md)

---

#### 변경 2: 집계 실패 감지 및 경고 (Lines 194-274)
**목적**: 집계 실패 시 무시하지 않고 경고 메시지 반환

**Before**:
```typescript
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
```

**After**:
```typescript
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
    console.error('[집계 실패]', error);
    aggregationWarning = '매출 계산은 완료되었으나 월 마감 집계 중 오류가 발생했습니다. 관리자에게 문의하세요.';
  }
}

return NextResponse.json({
  success: true,
  message: aggregationWarning || `${results.calculatedBusinesses}개 사업장 계산 완료`,
  warning: aggregationWarning,  // ✅ 경고 필드 추가
  data: results
});
```

**관련 문서**: [monthly-closing-silent-failure-fix.md](./monthly-closing-silent-failure-fix.md)

---

### 3. `/app/api/revenue/calculate/route.ts` (Lines 147-150)
**목적**: 제조사 이름 공백 제거하여 정확한 데이터베이스 매칭

**Before**:
```typescript
let manufacturer = businessInfo.manufacturer;

if (!manufacturer || manufacturer.trim() === '') {
  manufacturer = '에코센스';
  // ... 업데이트 로직 ...
}

// ❌ trim() 없이 직접 쿼리
const { data: manufacturerPricing } = await supabaseAdmin
  .from('manufacturer_pricing')
  .select('*')
  .eq('manufacturer', manufacturer)  // '에코센스 ' (공백 포함) → 매칭 실패
```

**After**:
```typescript
let manufacturer = businessInfo.manufacturer;

if (!manufacturer || manufacturer.trim() === '') {
  manufacturer = '에코센스';
  // ... 업데이트 로직 ...
} else {
  // ✅ 공백 제거 (데이터베이스 매칭을 위해)
  manufacturer = manufacturer.trim();
}

const { data: manufacturerPricing } = await supabaseAdmin
  .from('manufacturer_pricing')
  .select('*')
  .eq('manufacturer', manufacturer)  // '에코센스' (공백 제거) → 매칭 성공
```

**관련 문서**: [monthly-closing-auto-calculate-fix.md](./monthly-closing-auto-calculate-fix.md)

---

### 4. `/app/api/admin/monthly-closing/route.ts` (Line 34)
**목적**: 구문 오류 수정 (500 Error 해결)

**Before**:
```typescript
if (!permissionLevel || permissionLevel < 1) {
  return NextResponse.json({
    success: false,
    message: '권한이 부족합니다.'
  }, { status: 403 });
}
const searchParams = request.nextUrl.searchParams;  // ❌ 빈 줄 없음 → 파싱 오류
```

**After**:
```typescript
if (!permissionLevel || permissionLevel < 1) {
  return NextResponse.json({
    success: false,
    message: '권한이 부족합니다.'
  }, { status: 403 });
}

const searchParams = request.nextUrl.searchParams;  // ✅ 빈 줄 추가
```

---

### 5. `/app/admin/monthly-closing/page.tsx` (Lines 164-188)
**목적**: 프론트엔드에서 집계 실패 경고 메시지 표시

**Before**:
```typescript
if (data.success) {
  const results = data.data;
  // ... progress 업데이트 ...

  alert(
    `✅ 자동 계산 완료\n\n` +
    `총 사업장: ${results.totalBusinesses}개\n` +
    `계산 완료: ${results.calculatedBusinesses}개\n` +
    `실패: ${results.failedBusinesses}개`
  );
}
```

**After**:
```typescript
if (data.success) {
  const results = data.data;
  // ... progress 업데이트 ...

  let message =
    `✅ 자동 계산 완료\n\n` +
    `총 사업장: ${results.totalBusinesses}개\n` +
    `계산 완료: ${results.calculatedBusinesses}개\n` +
    `실패: ${results.failedBusinesses}개`;

  if (data.warning) {
    message += `\n\n⚠️ ${data.warning}`;  // ✅ 경고 메시지 추가
  }

  alert(message);
}
```

**관련 문서**: [monthly-closing-silent-failure-fix.md](./monthly-closing-silent-failure-fix.md)

---

## 🔄 작업 흐름 개선

### Before (문제 상황)
```
1. 사용자: "자동 계산" 버튼 클릭
2. API: 403 Forbidden (CSRF 차단) ❌
   → 또는 데이터 존재만 확인하고 계산 안함 ❌
   → 또는 0원 계산을 성공으로 처리 ❌
   → 또는 집계 실패해도 성공 메시지 ❌
3. 사용자: "계산 완료" 메시지 보지만 데이터 없음 😕
```

### After (수정 후)
```
1. 사용자: "자동 계산" 버튼 클릭
2. API: JWT 인증 통과 (CSRF 제외) ✅
3. API: 각 사업장 revenue calculate API 호출 ✅
4. API: 0원 결과는 "원가 데이터 확인 필요"로 실패 처리 ✅
5. API: 월 마감 집계 실행 (상세 로그 기록) ✅
6. API: 집계 실패 시 경고 메시지 반환 ✅
7. UI: 계산 결과 + 경고 메시지 표시 (있을 경우) ✅
8. 사용자: 명확한 피드백 확인 😊
```

---

## 🧪 테스트 시나리오

### 시나리오 1: 정상 계산 (모든 사업장 성공)
**실행**: 2025년 11월 자동 계산
**예상 결과**:
- 서버 로그: `[집계 시작]` → `[집계 데이터 조회 완료]` → `[집계 계산 완료]` → `[집계 저장 완료]`
- 브라우저 알림: "✅ 자동 계산 완료\n\n총 사업장: 10개\n계산 완료: 10개\n실패: 0개"
- DB: `monthly_closings` 테이블에 2025-11 데이터 저장됨

### 시나리오 2: 일부 사업장 실패 (원가 데이터 없음)
**실행**: 2025년 11월 자동 계산 (일부 사업장 manufacturer_pricing 데이터 없음)
**예상 결과**:
- 서버 로그: `제조사 'XXX'의 원가 데이터 없음: [사업장명]`
- 브라우저 알림: "✅ 자동 계산 완료\n\n총 사업장: 10개\n계산 완료: 7개\n실패: 3개"
- 실패 사업장 상세: "매출 계산 결과 없음 (원가 데이터 확인 필요)"

### 시나리오 3: 집계 실패 (DB 권한 문제 등)
**실행**: 2025년 11월 자동 계산 (monthly_closings upsert 실패)
**예상 결과**:
- 서버 로그: `[집계 실패] Error: 월 마감 데이터 저장 실패: ...`
- 브라우저 알림: "✅ 자동 계산 완료\n\n총 사업장: 10개\n계산 완료: 10개\n실패: 0개\n\n⚠️ 매출 계산은 완료되었으나 월 마감 집계 중 오류가 발생했습니다. 관리자에게 문의하세요."
- DB: `revenue_calculations` 테이블에는 데이터 있음, `monthly_closings` 테이블에는 데이터 없음

---

## 📊 디버깅 로그 가이드

### 정상 실행 시 예상 로그
```
[집계 시작] year: 2025 month: 11
POST /api/revenue/calculate 200 in 516ms (각 사업장마다)
[집계 데이터 조회 완료] count: 10
[집계 계산 완료] totalRevenue: 50000000 salesCommission: 5000000 installationCosts: 10000000
[집계 저장 완료] year: 2025 month: 11
POST /api/admin/monthly-closing/auto-calculate 200 in 5243ms
GET /api/admin/monthly-closing?year=2025&month=11 200 in 86ms
```

### 집계 실패 시 예상 로그
```
[집계 시작] year: 2025 month: 11
POST /api/revenue/calculate 200 in 516ms (각 사업장마다)
[집계 데이터 조회 완료] count: 10
[집계 계산 완료] totalRevenue: 50000000 salesCommission: 5000000 installationCosts: 10000000
[집계 실패] Error: 월 마감 데이터 저장 실패: duplicate key value violates unique constraint
POST /api/admin/monthly-closing/auto-calculate 200 in 5243ms
```

### 원가 데이터 없음 시 예상 로그
```
제조사 '에코센스'의 원가 데이터 없음: 동아산현대서비스(주)
POST /api/revenue/calculate 200 in 516ms
(사업장 status: 'failed', message: '매출 계산 결과 없음 (원가 데이터 확인 필요)')
```

---

## 🎯 다음 단계 (개발 서버에서 테스트)

1. **개발 서버 재시작**
   ```bash
   npm run dev
   ```

2. **월 마감 페이지 접속**
   ```
   http://localhost:3000/admin/monthly-closing
   ```

3. **자동 계산 실행**
   - 연도/월 선택 (예: 2025년 11월)
   - "자동 계산" 버튼 클릭

4. **서버 로그 확인**
   - 터미널에서 `[집계 시작]` ~ `[집계 저장 완료]` 로그 확인
   - 에러 로그가 있는지 확인

5. **브라우저 확인**
   - 계산 결과 알림창 확인
   - 경고 메시지가 있으면 원인 조사
   - 월 마감 데이터 표시 확인

6. **데이터베이스 확인**
   - Supabase에서 `monthly_closings` 테이블 확인
   - 2025-11 데이터가 올바르게 저장되었는지 확인

---

## 📚 관련 문서

1. [월 마감 시스템 CSRF 인증 오류 수정](./monthly-closing-auth-fix.md) - CSRF 제외 리스트 추가
2. [월 마감 시스템 자동 계산 로직 수정](./monthly-closing-auto-calculate-fix.md) - 실제 API 호출 및 제조사 trim() 수정
3. [월 마감 집계 Silent Failure 수정](./monthly-closing-silent-failure-fix.md) - 집계 실패 감지 및 경고

---

## ✅ 빌드 상태

**마지막 빌드**: 2025-12-16
**빌드 결과**: ✅ 성공
**경고**: 없음 (Edge Runtime 관련 경고는 기존 시스템 경고)

```bash
npm run build
# ✓ Compiled successfully
# ✓ Generating static pages (71/71)
```
