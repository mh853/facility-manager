# 권한 레벨 4인데 DB 저장 안 되는 문제 디버깅

## 📅 작업 일자
2025-11-10

## 🎯 문제 요약

**증상**:
- 브라우저 로그: `⚠️ [ADJUSTMENT-DELETE] DB에 저장되지 않음 (saved_record 없음)`
- 사용자 권한: **레벨 4** (저장 가능해야 함, 필요: 3 이상)
- `save_result: true` 설정됨

**재계산 결과**:
```javascript
{
  sales_commission: 2100000,
  adjusted_sales_commission: null,  // ✅ 삭제 후 null
  net_profit: 12040000,
  operating_cost_adjustment: null   // ✅ 삭제됨
}
```

## 🔍 가능한 원인

### 1. JWT 토큰에 권한 정보 없음

JWT 토큰이 오래되었거나 권한 정보가 포함되지 않았을 수 있음

**확인 방법**:
```javascript
// 브라우저 콘솔에서 실행
const token = localStorage.getItem('auth_token');
const decoded = JSON.parse(atob(token.split('.')[1]));
console.log('권한 레벨:', decoded.permissionLevel || decoded.permission_level);
```

### 2. API 서버에서 권한 조회 실패

JWT에 권한 정보가 없어서 DB에서 조회해야 하는데 실패했을 수 있음

**서버 로그 확인 필요**:
```
🔍 [REVENUE-CALCULATE] 저장 조건 확인: {
  save_result: true,
  permissionLevel: ???,  // 이 값 확인!
  canSave: ???
}
```

### 3. UPSERT 에러 (UNIQUE 제약 조건 미적용)

DB에 UNIQUE 제약 조건이 없어서 UPSERT가 실패했을 수 있음

**서버 로그 확인 필요**:
```
❌ [REVENUE-CALCULATE] 저장 오류: {
  message: "...",
  code: "...",
  details: "...",
  hint: "..."
}
```

## 🔧 디버깅 단계

### 단계 1: 서버 콘솔 로그 확인

**Next.js 개발 서버 터미널**에서 다음 로그를 찾아보세요:

```bash
# 영업비용 삭제 후 재계산 시 나와야 할 로그들:

🔍 [REVENUE-CALCULATE] 토큰 검증: { userId: '...', permissionLevel: 4 }
💰 [COMMISSION] 퍼센트 방식: ...
ℹ️ [COMMISSION-ADJ] 영업비용 조정 없음, 기본값 사용: 2100000
🔍 [REVENUE-CALCULATE] 저장 조건 확인: {
  save_result: true,
  permissionLevel: 4,  // ✅ 4여야 함!
  canSave: true
}
💾 [REVENUE-CALCULATE] 계산 결과 UPSERT 완료: {
  id: '...',
  business_name: '...',
  calculation_date: '...',
  adjusted_sales_commission: null
}
```

**문제 로그**:
```bash
# Case 1: 권한 부족 (불가능, 권한 4임)
⚠️ [REVENUE-CALCULATE] DB 저장 권한 부족: permissionLevel=2, 필요: 3 이상

# Case 2: UPSERT 에러
❌ [REVENUE-CALCULATE] 저장 오류: {
  message: "...",
  code: "23505" 또는 "42P10" 등
}
```

### 단계 2: JWT 토큰 검증

**브라우저 콘솔**에서 실행:
```javascript
const token = localStorage.getItem('auth_token');
if (token) {
  const parts = token.split('.');
  const payload = JSON.parse(atob(parts[1]));
  console.log('JWT Payload:', payload);
  console.log('권한 레벨:', payload.permissionLevel || payload.permission_level);
  console.log('사용자 ID:', payload.userId || payload.id);
} else {
  console.error('토큰 없음!');
}
```

**예상 결과**:
```javascript
{
  userId: "xxx-xxx-xxx",
  permissionLevel: 4,  // ✅ 이 값이 있어야 함
  iat: ...,
  exp: ...
}
```

### 단계 3: DB UNIQUE 제약 조건 확인

**Supabase SQL Editor**에서 실행:
```sql
-- 제약 조건 확인
SELECT
    constraint_name,
    constraint_type
FROM information_schema.table_constraints
WHERE table_name = 'revenue_calculations'
  AND constraint_type = 'UNIQUE';

-- 예상 결과:
-- revenue_calculations_business_date_unique | UNIQUE
```

**없으면**:
```sql
-- 즉시 추가
ALTER TABLE revenue_calculations
ADD CONSTRAINT revenue_calculations_business_date_unique
UNIQUE (business_id, calculation_date);
```

### 단계 4: 직접 API 호출 테스트

**브라우저 콘솔**에서 직접 테스트:
```javascript
const token = localStorage.getItem('auth_token');

fetch('/api/revenue/calculate', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    business_id: 'd2f9cea0-d6f2-4277-807e-484d913dfef2',
    save_result: true
  })
})
.then(r => r.json())
.then(data => {
  console.log('API 응답:', data);
  console.log('saved_record:', data.data?.saved_record);

  if (data.data?.saved_record) {
    console.log('✅ DB 저장 성공!');
  } else {
    console.error('❌ DB 저장 실패! saved_record 없음');
  }
});
```

## 🎯 해결 방법 (원인별)

### 원인 1: JWT에 권한 정보 없음

**해결**: 다시 로그인
```javascript
// 토큰 삭제 후 재로그인
localStorage.removeItem('auth_token');
// 로그인 페이지로 이동하여 다시 로그인
```

### 원인 2: DB에서 권한 조회 실패

**확인**: 서버 로그에서 DB 조회 에러 확인
```bash
❌ [REVENUE-CALCULATE-GET] 사용자 조회 실패: ...
```

**해결**: employees 테이블에서 사용자 권한 확인
```sql
SELECT id, permission_level, is_active
FROM employees
WHERE id = 'YOUR_USER_ID';
```

### 원인 3: UNIQUE 제약 조건 없음

**해결**: 위 "단계 3" 참고하여 제약 조건 추가

### 원인 4: UPSERT 에러

**서버 로그 예시**:
```bash
❌ [REVENUE-CALCULATE] 저장 오류: {
  message: "null value in column \"xxx\" violates not-null constraint",
  code: "23502"
}
```

**해결**: 필수 컬럼 확인 및 기본값 설정

## 📋 체크리스트

다음 순서대로 확인:

- [ ] **서버 터미널 로그 확인**
  - `🔍 [REVENUE-CALCULATE] 저장 조건 확인` 로그 찾기
  - `permissionLevel` 값 확인
  - 에러 로그 있는지 확인

- [ ] **JWT 토큰 검증**
  - `permissionLevel: 4` 확인
  - 토큰 만료 여부 확인

- [ ] **DB UNIQUE 제약 조건 확인**
  - `revenue_calculations_business_date_unique` 존재 여부
  - 없으면 추가

- [ ] **직접 API 테스트**
  - `saved_record` 있는지 확인
  - 에러 메시지 확인

## 🚨 긴급 해결 방법

서버 로그를 확인할 수 없다면:

1. **UNIQUE 제약 조건 추가** (가장 가능성 높음):
   ```sql
   ALTER TABLE revenue_calculations
   ADD CONSTRAINT revenue_calculations_business_date_unique
   UNIQUE (business_id, calculation_date);
   ```

2. **다시 로그인**: JWT 토큰 갱신

3. **서버 재시작**: Next.js 개발 서버 재시작

## 📊 예상 결과

**정상 동작 시 로그**:
```javascript
// 브라우저
🔍 [ADJUSTMENT-DELETE] 재계산 결과 상세: {
  adjusted_sales_commission: null
}
💾 [ADJUSTMENT-DELETE] DB 저장 확인: {  // ✅ 이 로그가 나와야 함!
  id: "...",
  adjusted_sales_commission: null
}

// 서버
🔍 [REVENUE-CALCULATE] 저장 조건 확인: {
  save_result: true,
  permissionLevel: 4,
  canSave: true
}
💾 [REVENUE-CALCULATE] 계산 결과 UPSERT 완료: {
  id: "...",
  adjusted_sales_commission: null
}
```

## 🔍 추가 정보 필요

다음 정보를 확인해주세요:

1. **서버 터미널 로그** (영업비용 삭제 → 재계산 시점)
2. **JWT 토큰 내용** (브라우저 콘솔에서 확인)
3. **DB 제약 조건** (Supabase SQL Editor에서 확인)

이 정보가 있으면 정확한 원인을 찾을 수 있습니다!
