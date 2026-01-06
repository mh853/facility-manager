# Supabase Service Role Key 업데이트 필요

## 🚨 문제 상황

로그인 시도 시 다음 오류 발생:
```
❌ [AUTH] 사용자 조회 실패: Invalid API key
POST /api/auth/login 401 in 663ms
```

## 원인

`.env.local` 파일의 `SUPABASE_SERVICE_ROLE_KEY`가 기존(OLD) 프로젝트의 키를 사용하고 있습니다.

**현재 설정 (잘못됨)**:
```env
NEXT_PUBLIC_SUPABASE_URL=https://uvdvfsjekqshxtxthxeq.supabase.co  ✅ 새 프로젝트
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGci...39_V0  ✅ 새 프로젝트 (uvdvfsjekqshxtxthxeq)
SUPABASE_SERVICE_ROLE_KEY=eyJhbGci...CaxQ  ❌ 기존 프로젝트 (qdfqoykhmuiambtrrlnf)
```

Service Role Key의 `ref` 클레임을 확인하면:
- 현재: `qdfqoykhmuiambtrrlnf` (기존 프로젝트)
- 필요: `uvdvfsjekqshxtxthxeq` (새 프로젝트)

## 해결 방법

### Step 1: 새 프로젝트의 Service Role Key 가져오기

1. Supabase Dashboard 접속: https://app.supabase.com/
2. 새 프로젝트 선택 (uvdvfsjekqshxtxthxeq)
3. **Settings** (왼쪽 하단 톱니바퀴 아이콘)
4. **API** 탭 클릭
5. **Project API keys** 섹션에서:
   - `anon` `public` 키 (이미 올바름 ✅)
   - `service_role` `secret` 키 복사 ← **이것 필요**

### Step 2: .env.local 파일 업데이트

```env
# .env.local

# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=https://uvdvfsjekqshxtxthxeq.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InV2ZHZmc2pla3FzaHh0eHRoeGVxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjcxNTQwNzcsImV4cCI6MjA4MjczMDA3N30.m0weGK4S32jIKs4kePafynvkfUVortdJnW7OXX39_V0

# 이 값을 새 프로젝트의 service_role 키로 교체
SUPABASE_SERVICE_ROLE_KEY=여기에_새_프로젝트_service_role_키_붙여넣기
```

### Step 3: 개발 서버 재시작

```bash
# 서버 중지 (Ctrl+C)
# 서버 재시작
npm run dev
```

### Step 4: 로그인 테스트

기존 계정 정보로 로그인 시도:
- 로그인 성공 시: ✅ 마이그레이션 완료
- 로그인 실패 시: 추가 디버깅 필요

## 참고: Service Role Key 확인 방법

Service Role Key는 JWT 토큰이므로 https://jwt.io 에서 디코딩하여 `ref` 클레임을 확인할 수 있습니다:

**올바른 키 예시**:
```json
{
  "iss": "supabase",
  "ref": "uvdvfsjekqshxtxthxeq",  ← 새 프로젝트 ID
  "role": "service_role",
  "iat": 1767154077,
  "exp": 2082730077
}
```

**현재 잘못된 키**:
```json
{
  "iss": "supabase",
  "ref": "qdfqoykhmuiambtrrlnf",  ← 기존 프로젝트 ID
  "role": "service_role",
  "iat": 1756253667,
  "exp": 2071829667
}
```

## 주의사항

⚠️ Service Role Key는 RLS를 우회할 수 있는 강력한 권한이므로:
- 절대 클라이언트 코드나 공개 저장소에 노출하지 마세요
- `.env.local` 파일이 `.gitignore`에 포함되어 있는지 확인하세요
- 프로덕션 환경에서는 별도의 환경 변수 관리 시스템을 사용하세요
