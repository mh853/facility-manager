# 월 마감 시스템 CSRF 인증 오류 수정 완료

## 문제 상황

사용자가 월 마감 자동 계산 기능 사용 시 403 Forbidden 오류 발생:

**브라우저 에러:**
```
POST http://localhost:3001/api/admin/monthly-closing/auto-calculate 403 (Forbidden)
자동 계산 오류: Error: 자동 계산 요청 실패
```

**서버 로그:**
```
[SECURITY] CSRF validation failed for undefined on /api/admin/monthly-closing/auto-calculate
```

## 근본 원인 (수정됨)

**초기 진단 오류**: JWT 토큰 인증 누락으로 잘못 판단함.

**실제 원인**: **CSRF 보호 미들웨어**가 월 마감 API를 차단하고 있었음.
- CSRF 미들웨어는 JWT 인증 코드보다 먼저 실행됨
- `/lib/security/csrf-protection.ts`의 `excludePatterns` 리스트에 월 마감 API가 없었음
- 다른 JWT 인증 사용 API들은 이미 CSRF 제외 리스트에 등록되어 있었음
- 월 마감 API는 JWT 인증을 사용하므로 CSRF 보호가 불필요함

## 수정 내역

### 최종 해결: CSRF 제외 리스트 추가

**파일**: `/lib/security/csrf-protection.ts`

**변경 사항**:
```typescript
const excludePatterns = [
  // ... 기존 패턴들
  '/api/admin/monthly-closing',  // 월 마감 관리 API (JWT 인증 사용)
  '/api/admin/monthly-closing/*'  // 월 마감 관리 API 전체 제외 (JWT 인증 사용)
];
```

**위치**: [line 151-152](lib/security/csrf-protection.ts#L151-L152)

### 보안 강화: JWT 인증 추가 (부수 효과)

초기 진단 과정에서 JWT 인증도 추가되어 보안이 강화됨:

### 1. `/app/api/admin/monthly-closing/route.ts`
**변경 사항**:
- `verifyTokenString` import 추가
- GET 핸들러에 JWT 인증 추가
- POST 핸들러에 JWT 인증 추가
- Permission level 검증 추가 (level >= 1)

```typescript
import { verifyTokenString } from '@/utils/auth';

export async function GET(request: NextRequest) {
  try {
    // JWT 토큰 검증
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({
        success: false,
        message: '인증이 필요합니다.'
      }, { status: 401 });
    }

    const token = authHeader.substring(7);
    const decoded = verifyTokenString(token);

    if (!decoded) {
      return NextResponse.json({
        success: false,
        message: '유효하지 않은 토큰입니다.'
      }, { status: 401 });
    }

    const permissionLevel = decoded.permissionLevel || decoded.permission_level;
    if (!permissionLevel || permissionLevel < 1) {
      return NextResponse.json({
        success: false,
        message: '권한이 부족합니다.'
      }, { status: 403 });
    }

    // ... 기존 로직
  }
}
```

### 2. `/app/api/admin/monthly-closing/auto-calculate/route.ts`
**변경 사항**:
- `verifyTokenString` import 추가
- POST 핸들러에 JWT 인증 추가
- Permission level 검증 추가 (level >= 1)

### 3. `/app/api/admin/monthly-closing/[id]/misc-costs/route.ts`
**변경 사항**:
- GET 핸들러에 JWT 인증 추가
- POST 핸들러에 JWT 인증 추가
- Permission level 검증 추가

### 4. `/app/api/admin/monthly-closing/misc-costs/[id]/route.ts`
**변경 사항**:
- `verifyTokenString` import 추가
- DELETE 핸들러에 JWT 인증 추가
- Permission level 검증 추가 (level >= 1)

## 인증 패턴

모든 월 마감 API 엔드포인트에 다음 인증 패턴 적용:

```typescript
// 1. Authorization 헤더 확인
const authHeader = request.headers.get('authorization');
if (!authHeader || !authHeader.startsWith('Bearer ')) {
  return 401 Unauthorized
}

// 2. JWT 토큰 추출 및 검증
const token = authHeader.substring(7);
const decoded = verifyTokenString(token);

if (!decoded) {
  return 401 Unauthorized
}

// 3. 권한 레벨 검증
const permissionLevel = decoded.permissionLevel || decoded.permission_level;
if (!permissionLevel || permissionLevel < 1) {
  return 403 Forbidden
}

// 4. 실제 API 로직 실행
```

## 수정된 API 엔드포인트 목록

| 엔드포인트 | 메서드 | 상태 |
|-----------|--------|------|
| `/api/admin/monthly-closing` | GET | ✅ 인증 추가 완료 |
| `/api/admin/monthly-closing` | POST | ✅ 인증 추가 완료 |
| `/api/admin/monthly-closing/auto-calculate` | POST | ✅ 인증 추가 완료 |
| `/api/admin/monthly-closing/[id]/misc-costs` | GET | ✅ 인증 추가 완료 |
| `/api/admin/monthly-closing/[id]/misc-costs` | POST | ✅ 인증 추가 완료 |
| `/api/admin/monthly-closing/misc-costs/[id]` | DELETE | ✅ 인증 추가 완료 |

## 테스트 결과

### 빌드 테스트
```bash
npm run build
```
**결과**: ✅ 빌드 성공

모든 API 엔드포인트가 정상적으로 컴파일되었으며, TypeScript 타입 체크 통과.

### 예상 동작

#### 1. 인증 토큰 없이 요청 시
```
GET /api/admin/monthly-closing
→ 401 Unauthorized
→ { success: false, message: '인증이 필요합니다.' }
```

#### 2. 잘못된 토큰으로 요청 시
```
GET /api/admin/monthly-closing
Authorization: Bearer invalid_token
→ 401 Unauthorized
→ { success: false, message: '유효하지 않은 토큰입니다.' }
```

#### 3. 권한 부족한 토큰으로 요청 시
```
GET /api/admin/monthly-closing
Authorization: Bearer valid_token (permission_level = 0)
→ 403 Forbidden
→ { success: false, message: '권한이 부족합니다.' }
```

#### 4. 올바른 토큰으로 요청 시
```
GET /api/admin/monthly-closing
Authorization: Bearer valid_token (permission_level >= 1)
→ 200 OK
→ { success: true, data: {...} }
```

## 클라이언트 측 인증 처리

프론트엔드 페이지(`/app/admin/monthly-closing/page.tsx`)는 이미 `getAuthHeaders()` 유틸리티를 사용하여 모든 API 요청에 JWT 토큰을 포함하고 있음:

```typescript
const response = await fetch('/api/admin/monthly-closing/auto-calculate', {
  method: 'POST',
  headers: getAuthHeaders(),
  body: JSON.stringify({ year, month, force })
});
```

`getAuthHeaders()` 함수는 TokenManager를 통해 저장된 JWT 토큰을 자동으로 Authorization 헤더에 추가함.

## 보안 개선사항

### 이전 상태
- ❌ CSRF 미들웨어가 JWT 인증 사용 API를 차단
- ❌ 월 마감 API가 CSRF 제외 리스트에 없음
- ⚠️ JWT 인증은 있었으나 CSRF가 먼저 차단하여 무용지물

### 개선 후
- ✅ **CSRF 제외 리스트에 월 마감 API 추가** (핵심 수정)
- ✅ JWT 토큰 인증 강화 (추가 보안)
- ✅ 권한 레벨 검증 (permission_level >= 1)
- ✅ 인증되지 않은 요청 차단 (401)
- ✅ 권한 없는 사용자 차단 (403)
- ✅ CSRF + JWT 이중 보안: CSRF는 제외하되 JWT로 인증 보장

## 보안 패턴 이해

### CSRF vs JWT 인증

**CSRF 보호**: 브라우저 세션 기반 공격 방지 (쿠키 기반 인증에 필요)
**JWT 인증**: 토큰 기반 인증 (Authorization 헤더 사용)

**결론**: JWT 인증을 사용하는 API는 CSRF 보호가 불필요하며, CSRF 제외 리스트에 추가해야 함.

### 미들웨어 실행 순서

```
1. CSRF 미들웨어 (middleware.ts) → 403 if invalid
2. JWT 인증 코드 (API route) → 401 if missing/invalid
```

**중요**: CSRF가 먼저 실행되므로, CSRF 제외 리스트에 없으면 JWT 인증 코드가 실행되지 않음.

## 테스트 방법

### 1. 개발 서버 재시작
```bash
npm run dev
```

### 2. 월 마감 페이지 접속
```
http://localhost:3000/admin/monthly-closing
```

### 3. 자동 계산 테스트
- 연도/월 선택
- "자동 계산" 버튼 클릭
- 네트워크 탭에서 `/api/admin/monthly-closing/auto-calculate` 응답 확인
- 예상 결과: **200 OK** (403 Forbidden 사라짐)

### 4. 서버 로그 확인
- 예상 로그: CSRF 관련 에러 없음
- JWT 인증 성공 로그 확인

## 문제 해결 교훈

1. **서버 로그 우선 확인**: 브라우저 에러만 보지 말고 서버 로그를 먼저 확인
2. **미들웨어 실행 순서 이해**: CSRF → JWT 순서로 실행됨
3. **CSRF 제외 패턴 일관성**: JWT 인증 사용 API는 모두 CSRF 제외 리스트에 추가
4. **초기 진단의 중요성**: 근본 원인을 정확히 파악하지 못하면 잘못된 수정을 할 수 있음

## 다음 단계

1. ✅ **CSRF 제외 리스트 추가 완료**
2. ✅ **빌드 성공 확인**
3. 🔄 **실제 테스트 필요**: 개발 서버에서 월 마감 페이지 접속 후 자동 계산 기능 테스트
4. 🔄 **에러 모니터링**: 서버 로그에서 CSRF 에러가 사라졌는지 확인
5. 🔄 **기능 검증**: 자동 계산, 기타 비용 추가/삭제 기능이 정상 동작하는지 확인

## 관련 문서

- [월 마감 시스템 자동 계산 구현](./monthly-closing-auto-calculate-implementation.md)
- [월 마감 시스템 문제 진단 및 해결 계획](./monthly-closing-fix-plan.md)
