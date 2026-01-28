# 로그인 무한 리다이렉트 문제 해결

## 🔍 문제 분석

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

**app/login/page.tsx (Line 23-30)**:
```typescript
// 이미 로그인된 사용자는 리다이렉트
useEffect(() => {
  if (user && !authLoading) {
    const redirectTo = searchParams?.get('redirect') || '/admin'
    console.log('✅ 이미 로그인됨, 리다이렉트:', redirectTo)
    // ❌ 문제: 쿠키 확인 없이 즉시 리다이렉트
    window.location.href = redirectTo
  }
}, [user, authLoading, searchParams])
```

**문제점**:
1. `user` 상태만 확인하고 **쿠키 설정 여부를 확인하지 않음**
2. 시크릿 모드에서는 쿠키 설정에 지연 발생
3. 쿠키 없이 페이지 이동 → middleware 차단 → 다시 로그인 페이지 → 무한 반복

## 💡 해결 방법

### 옵션 1: 쿠키 확인 추가 (권장)

```typescript
// 이미 로그인된 사용자는 쿠키 확인 후 리다이렉트
useEffect(() => {
  if (user && !authLoading) {
    const redirectTo = searchParams?.get('redirect') || '/admin'

    // ✅ 쿠키 확인
    const authReady = document.cookie.split('; ').find(row => row.startsWith('auth_ready='))

    if (authReady) {
      console.log('✅ 이미 로그인됨 + 쿠키 확인, 리다이렉트:', redirectTo)
      window.location.href = redirectTo
    } else {
      console.log('⏳ 로그인됨, 쿠키 대기중...')
      // 쿠키 설정 대기 (최대 3초)
      let attempts = 0
      const checkInterval = setInterval(() => {
        const cookie = document.cookie.split('; ').find(row => row.startsWith('auth_ready='))
        attempts++

        if (cookie || attempts >= 6) {
          clearInterval(checkInterval)
          if (cookie) {
            console.log('✅ 쿠키 확인 완료, 리다이렉트')
            window.location.href = redirectTo
          } else {
            console.warn('⚠️ 쿠키 확인 실패, 강제 리다이렉트')
            window.location.href = redirectTo
          }
        }
      }, 500)
    }
  }
}, [user, authLoading, searchParams])
```

### 옵션 2: 단순화 - 항상 쿠키 대기

```typescript
// 이미 로그인된 사용자는 쿠키 확인 후 리다이렉트
useEffect(() => {
  if (user && !authLoading) {
    const redirectTo = searchParams?.get('redirect') || '/admin'

    // ✅ 항상 500ms 대기 후 리다이렉트 (쿠키 설정 시간 보장)
    console.log('⏳ 로그인 확인됨, 쿠키 설정 대기 후 리다이렉트...')
    setTimeout(() => {
      console.log('✅ 리다이렉트:', redirectTo)
      window.location.href = redirectTo
    }, 500)
  }
}, [user, authLoading, searchParams])
```

## 🎯 권장 해결책

**옵션 2 (단순화)**를 권장합니다:
- 간단하고 명확
- 시크릿 모드 포함 모든 환경에서 작동
- 500ms 지연은 사용자 경험에 큰 영향 없음

## 📝 구현 계획

1. `/app/login/page.tsx` 수정
2. Line 23-30의 useEffect 로직 변경
3. 500ms 지연 추가
4. 테스트:
   - 일반 모드 로그인 → 리다이렉트
   - 시크릿 모드 로그인 → 리다이렉트
   - 이미 로그인된 상태에서 /login 접근 → 리다이렉트
