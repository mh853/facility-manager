# 로그인 무한 리다이렉트 문제 해결 (v2)

## 🔍 문제 재분석

### 증상
- 시크릿 모드에서 로그인 후 무한 리다이렉트 발생
- API 토큰 검증은 성공하지만 middleware에서 쿠키 없음

### 로그 분석
```
✅ [AUTH] 토큰 검증 성공 (API)
❌ hasCookie: false (Middleware)
❌ cookieNames: [ 'auth_ready' ] (auth_token 없음)
→ 로그인 페이지로 리다이렉트
→ 무한 반복
```

### 근본 원인

**첫 번째 수정 시도 (실패)**:
- `/app/login/page.tsx`에 500ms 지연 추가
- **결과**: 문제 해결 안 됨
- **이유**: 쿠키가 아예 설정되지 않거나 전송되지 않는 것이 문제, 타이밍 문제가 아님

**실제 문제**:
1. `auth_ready` 쿠키는 전송됨 (httpOnly=false)
2. `auth_token` httpOnly 쿠키는 전송되지 않음
3. 로그인 API는 정상적으로 `Set-Cookie` 헤더 반환
4. **하지만 브라우저가 시크릿 모드에서 httpOnly 쿠키를 차단하거나 전송하지 않음**

## 💡 해결 방법

### 시도 1: sameSite 'none' + secure true (실패)
**문제**: 개발 환경에서 HTTPS 없이 `secure: true`는 쿠키가 작동하지 않음

### 시도 2: 환경별 쿠키 설정 (현재 적용)

**app/api/auth/login/route.ts (Line 191-218)**:
```typescript
// 개발 환경: secure=false, sameSite=lax (HTTP 허용)
// 프로덕션: secure=true, sameSite=lax (HTTPS 필수)
const isProduction = process.env.NODE_ENV === 'production';

const cookieOptions = {
  httpOnly: true,
  secure: isProduction, // 프로덕션에서만 HTTPS 필수
  sameSite: 'lax' as const, // 일반적인 브라우저 호환성
  maxAge: 24 * 60 * 60, // 24시간
  path: '/'
};

response.cookies.set('auth_token', token, cookieOptions);

// 🔧 확인용 플래그 쿠키
response.cookies.set('auth_ready', 'true', {
  httpOnly: false,
  secure: isProduction,
  sameSite: 'lax' as const,
  maxAge: 24 * 60 * 60,
  path: '/'
});

// 🔍 디버깅: Set-Cookie 헤더 로그 출력
const setCookieHeaders = response.headers.getSetCookie();
console.log('🍪 [AUTH] 쿠키 설정 완료:', {
  auth_token: 'httpOnly',
  auth_ready: 'readable',
  setCookieCount: setCookieHeaders.length,
  environment: isProduction ? 'production' : 'development',
  secure: isProduction,
  sameSite: 'lax'
});
```

### 변경 사항 정리

1. **로그인 API** (`/app/api/auth/login/route.ts`):
   - 쿠키 설정을 환경별로 분리
   - 개발: `secure: false`, 프로덕션: `secure: true`
   - `sameSite: 'lax'` (일반적인 브라우저 호환성)
   - Set-Cookie 헤더 로그 추가 (디버깅용)

2. **로그인 페이지** (`/app/login/page.tsx`):
   - 불필요한 500ms 지연 제거 (원래대로 복구)

## 🧪 테스트 방법

### 1. 서버 로그 확인
```bash
npm run dev
```

로그인 시도 시 다음 로그 확인:
```
🍪 [AUTH] 쿠키 설정 완료: {
  auth_token: 'httpOnly',
  auth_ready: 'readable',
  setCookieCount: 2,
  environment: 'development',
  secure: false,
  sameSite: 'lax'
}
🍪 [AUTH] Set-Cookie[0]: auth_token=...
🍪 [AUTH] Set-Cookie[1]: auth_ready=...
```

### 2. 브라우저 개발자 도구 확인
1. 네트워크 탭 열기
2. 로그인 API 요청 찾기 (`/api/auth/login`)
3. 응답 헤더에서 `Set-Cookie` 확인:
   ```
   Set-Cookie: auth_token=...; Path=/; HttpOnly; SameSite=Lax
   Set-Cookie: auth_ready=true; Path=/; SameSite=Lax
   ```

4. Application 탭 → Cookies 확인:
   - `auth_token` (httpOnly, secure 여부)
   - `auth_ready` (readable)

### 3. 시크릿 모드 테스트
1. 시크릿 모드 창 열기
2. 로그인 시도
3. 쿠키가 설정되는지 Application 탭에서 확인
4. `/admin/subsidy` 접근 시 middleware 로그 확인:
   ```
   🔍 [MIDDLEWARE] 페이지 인증 체크 {
     hasCookie: true,  // ← 이제 true여야 함
     cookieNames: ['auth_ready', 'auth_token']  // ← 두 개 모두 있어야 함
   }
   ```

## 🔍 추가 조사 필요

만약 여전히 문제가 발생하면:

1. **브라우저가 쿠키를 차단하는지 확인**:
   - Chrome 설정 → 개인정보 및 보안 → 쿠키 및 기타 사이트 데이터
   - "시크릿 모드에서 타사 쿠키 차단" 설정 확인

2. **localhost vs 127.0.0.1**:
   - 브라우저가 localhost와 127.0.0.1을 다르게 처리할 수 있음
   - 일관되게 `http://localhost:3000` 사용

3. **CORS 이슈**:
   - fetch 호출 시 `credentials: 'same-origin'` 확인 (line 69)
   - 동일 origin인지 확인 (http://localhost:3000)

4. **대안: localStorage 기반 인증**:
   - httpOnly 쿠키 대신 localStorage + Authorization 헤더 사용
   - 보안은 떨어지지만 시크릿 모드 호환성 향상

## 📋 다음 단계

1. ✅ 쿠키 설정 환경별 분리 완료
2. ✅ 디버깅 로그 추가 완료
3. ⏳ 사용자 테스트 대기
4. ⏳ 브라우저 개발자 도구로 Set-Cookie 헤더 확인
5. ⏳ 필요시 대안 방식 적용 (localStorage 기반)

## 🚨 만약 여전히 실패한다면

**최후의 수단: httpOnly 쿠키 포기하고 localStorage 사용**

장점:
- 시크릿 모드 호환성 100%
- 크로스 도메인 문제 없음

단점:
- XSS 공격에 취약 (JavaScript로 접근 가능)
- 보안 수준 낮음

구현 방법:
1. `/app/api/auth/login/route.ts`: httpOnly 쿠키 제거
2. `/middleware.ts`: Authorization 헤더에서 토큰 확인
3. 클라이언트: localStorage에 토큰 저장, 모든 API 요청 시 Authorization 헤더 추가
