# 게스트 권한 시스템 테스트 계획

## 테스트 개요
게스트 권한(permission_level = 0) 시스템이 정상 작동하는지 확인합니다.

## 사전 준비

### 1. 게스트 계정 생성 (Supabase)

```sql
-- 테스트용 게스트 계정 생성
INSERT INTO employees (
  email,
  name,
  password_hash,
  permission_level,
  is_active,
  department,
  position
) VALUES (
  'guest@facility-manager.com',
  '게스트',
  '$2a$10$YourBcryptHashHere', -- 실제 bcrypt 해시로 변경 필요
  0, -- 게스트 권한
  true,
  '외부',
  '게스트'
);
```

**비밀번호 해시 생성 방법**:
```bash
# Node.js로 bcrypt 해시 생성
node -e "const bcrypt = require('bcrypt'); bcrypt.hash('guest123', 10, (err, hash) => console.log(hash));"
```

## 테스트 시나리오

### ✅ 시나리오 1: 게스트 로그인
**목적**: 게스트 계정으로 정상 로그인되는지 확인

1. http://localhost:3000/login 접속
2. 게스트 계정 정보 입력:
   - 이메일: `guest@facility-manager.com`
   - 비밀번호: `guest123`
3. "로그인" 버튼 클릭

**예상 결과**:
- ✅ 로그인 성공
- ✅ 쿠키 저장: `session_token`, `auth_ready`
- ✅ localStorage 저장: `auth_token`
- ✅ 루트 페이지(`/`)로 리다이렉트

### ✅ 시나리오 2: 게스트 접근 가능 페이지
**목적**: 게스트가 접근할 수 있는 페이지 확인

**접근 가능한 페이지** (permission_level >= 0):
1. ✅ `/` - 홈 페이지
2. ✅ `/admin/subsidy` - 보조금 공고 조회

**테스트 방법**:
1. 게스트로 로그인
2. 각 페이지 URL 직접 접속
3. 정상 렌더링 확인

**예상 결과**:
- ✅ 페이지가 정상적으로 표시됨
- ✅ 로그인 페이지로 리다이렉트되지 않음

### ❌ 시나리오 3: 게스트 접근 불가 페이지
**목적**: 게스트가 접근할 수 없는 페이지 차단 확인

**접근 불가능한 페이지** (permission_level >= 1):
1. ❌ `/admin` - 관리자 대시보드 (레벨 3 필요)
2. ❌ `/admin/business` - 사업장 관리 (레벨 1 필요)
3. ❌ `/admin/tasks` - 업무 관리 (레벨 1 필요)
4. ❌ `/admin/revenue` - 매출 관리 (레벨 2 필요)
5. ❌ `/admin/users` - 사용자 관리 (레벨 2 필요)

**테스트 방법**:
1. 게스트로 로그인
2. 각 페이지 URL 직접 접속 시도

**예상 결과**:
- ❌ "권한 부족" 알림 표시
- ❌ `/admin` 또는 접근 가능한 페이지로 리다이렉트

### ✅ 시나리오 4: 보조금 페이지 읽기 전용
**목적**: 게스트는 보조금 공고를 조회만 할 수 있고, 수정/삭제는 불가능

**테스트 방법**:
1. 게스트로 로그인
2. `/admin/subsidy` 페이지 접속
3. UI 요소 확인

**예상 결과**:
- ✅ 공고 목록 조회 가능
- ✅ 공고 상세 조회 가능
- ❌ "수동 업로드" 버튼 **비활성화** 또는 **숨김**
- ❌ "URL 관리" 버튼 **비활성화** 또는 **숨김**
- ❌ 상태 변경 기능 **비활성화**

### ✅ 시나리오 5: API 권한 확인
**목적**: API 레벨에서도 게스트 권한이 적용되는지 확인

**테스트 방법**:
```bash
# 1. 게스트 토큰으로 API 호출
# (브라우저 콘솔에서 localStorage.getItem('auth_token') 값 복사)

# 2. 조회 API (성공해야 함)
curl -H "Authorization: Bearer <게스트_토큰>" \
  http://localhost:3000/api/subsidy-announcements

# 3. 수정 API (실패해야 함)
curl -X PATCH \
  -H "Authorization: Bearer <게스트_토큰>" \
  -H "Content-Type: application/json" \
  -d '{"status":"applied"}' \
  http://localhost:3000/api/subsidy-announcements/manual
```

**예상 결과**:
- ✅ 조회 API: 200 OK, 데이터 반환
- ❌ 수정 API: 403 Forbidden, "권한 부족" 메시지

### ✅ 시나리오 6: 토큰 검증
**목적**: 게스트 토큰의 유효성 확인

**테스트 방법**:
```bash
# 게스트 토큰으로 검증 API 호출
curl -X POST \
  -H "Authorization: Bearer <게스트_토큰>" \
  http://localhost:3000/api/auth/verify
```

**예상 결과**:
```json
{
  "success": true,
  "data": {
    "user": {
      "email": "guest@facility-manager.com",
      "name": "게스트",
      "permission_level": 0
    },
    "permissions": {
      "isGuest": true,
      "canViewSubsidyAnnouncements": true,
      "canViewAllTasks": false,
      "canCreateTasks": false,
      "canEditTasks": false,
      "canDeleteTasks": false,
      "canViewReports": false,
      "canApproveReports": false,
      "canAccessAdminPages": false,
      "canViewSensitiveData": false
    }
  }
}
```

## 브라우저 테스트 체크리스트

### 개발자 도구로 확인할 항목

1. **Application > Cookies** (http://localhost:3000)
   - ✅ `session_token` 존재 (HttpOnly)
   - ✅ `auth_ready=true` 존재

2. **Application > Local Storage** (http://localhost:3000)
   - ✅ `auth_token` 존재 (JWT 토큰)

3. **Console 로그**
   - ✅ `🔍 [Subsidy] User Info:` 에서 `role: 0` 확인
   - ✅ `isGuest: true` 확인

4. **Network 탭**
   - ✅ `/api/auth/verify` 응답에서 `isGuest: true` 확인
   - ✅ `/api/subsidy-announcements` 호출 성공 (200)

## 권한 매트릭스

| 기능 | 게스트(0) | 일반(1) | 매니저(2) | 관리자(3) | 시스템(4) |
|------|-----------|---------|-----------|-----------|-----------|
| 로그인 | ✅ | ✅ | ✅ | ✅ | ✅ |
| 보조금 조회 | ✅ | ✅ | ✅ | ✅ | ✅ |
| 보조금 수정 | ❌ | ✅ | ✅ | ✅ | ✅ |
| 업무 조회 | ❌ | ✅ | ✅ | ✅ | ✅ |
| 업무 생성 | ❌ | ✅ | ✅ | ✅ | ✅ |
| 매출 관리 | ❌ | ❌ | ✅ | ✅ | ✅ |
| 사용자 관리 | ❌ | ❌ | ✅ | ✅ | ✅ |
| 관리자 대시보드 | ❌ | ❌ | ❌ | ✅ | ✅ |
| 시스템 설정 | ❌ | ❌ | ❌ | ✅ | ✅ |

## 문제 해결

### 게스트 계정 로그인 실패
- `employees` 테이블의 `permission_level` 제약 조건 확인
- `is_active = true` 확인
- 비밀번호 해시 정확성 확인

### 권한 체크 동작 안 함
- `AuthContext.tsx`의 `permissions` 상태 확인
- `/api/auth/verify` 응답의 `permissions` 객체 확인
- 브라우저 콘솔 로그 확인

### UI 버튼이 여전히 보임
- `permissions?.isGuest` 체크 로직 확인
- `user?.role >= 1` 조건문 확인
- React 컴포넌트 리렌더링 확인

## 테스트 완료 기준

- [x] 게스트 계정 생성 완료
- [ ] 게스트 로그인 성공
- [ ] 보조금 페이지 접근 가능
- [ ] 보조금 페이지 읽기 전용 확인
- [ ] 일반 관리 페이지 접근 차단 확인
- [ ] API 권한 체크 동작 확인
- [ ] 토큰 검증 정상 응답 확인

## 참고 파일

- **권한 레벨 정의**: `/lib/auth/AuthLevels.ts`
- **페이지 권한 매핑**: `/lib/auth/PagePermissions.ts`
- **권한 가드**: `/lib/auth/AuthGuard.ts`
- **인증 컨텍스트**: `/contexts/AuthContext.tsx`
- **보조금 페이지**: `/app/admin/subsidy/page.tsx`
- **API 검증**: `/app/api/auth/verify/route.ts`
- **DB 마이그레이션**: `/claudedocs/guest-permission-migration.sql`
