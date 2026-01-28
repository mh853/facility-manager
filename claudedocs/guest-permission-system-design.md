# 게스트 권한 시스템 설계 문서

## 📋 요구사항

사용자 요청: "시스템에 권한관리에 대한 기능이 있는데 게스트 권한을 추가해서 게스트 관리를 하고 싶어. 게스트는 '/' 페이지와 admin/subsidy만 볼 수 있고 뷰어기능만 있으면 돼."

### 핵심 요구사항
1. 새로운 게스트 권한 레벨 추가
2. 접근 가능 페이지: `/` (홈페이지), `/admin/subsidy` (보조금 공고 조회)
3. **뷰어 전용** - 읽기만 가능, 수정/삭제/생성 불가

---

## 🔍 현재 시스템 분석

### 1. 현재 권한 레벨 구조

**AuthLevels.ts** (`/lib/auth/AuthLevels.ts`)에 정의된 권한:

```typescript
export enum AuthLevel {
  PUBLIC = 0,           // 누구나 접근 가능 (로그인 불필요)
  AUTHENTICATED = 1,    // 로그인 필요 - 일반 직원
  ADMIN = 2,            // 관리자 권한 필요
  SUPER_ADMIN = 3,      // 슈퍼 관리자 권한
  SYSTEM_ADMIN = 4      // 시스템 관리자 권한
}
```

**문제점**: 현재 시스템에는 "로그인은 필요하지만 읽기만 가능한 권한"이 없음. `PUBLIC`은 로그인 없이 접근 가능, `AUTHENTICATED`는 일반 직원으로 모든 기본 업무 수행 가능.

### 2. 권한 체크 시스템

**AuthGuard.ts** (`/lib/auth/AuthGuard.ts`)
- `checkPageAccess()` - 페이지 접근 권한 확인
- `checkComponentAccess()` - 컴포넌트 레벨 권한 확인
- `checkApiAccess()` - API 엔드포인트 권한 확인

**PagePermissions.ts** (`/lib/auth/PagePermissions.ts`)
- `PAGE_AUTH_LEVELS` - 페이지별 필요 권한 레벨 매핑

**현재 페이지 권한 설정:**
```typescript
'/': AuthLevel.PUBLIC,                    // 홈페이지 (로그인 불필요)
'/admin/business': AuthLevel.AUTHENTICATED,
'/admin/tasks': AuthLevel.AUTHENTICATED,
'/admin/revenue': AuthLevel.ADMIN,
'/admin': AuthLevel.SUPER_ADMIN,
```

**중요 발견**: `/admin/subsidy` 페이지는 `PAGE_AUTH_LEVELS`에 명시되어 있지 않음! 기본값으로 `AuthLevel.AUTHENTICATED` 적용됨.

### 3. 인증 시스템

**AuthContext.tsx** (`/contexts/AuthContext.tsx`)
- `user` 객체에 `permission_level` 필드 포함
- `permissions` 객체에 세분화된 권한 플래그 (canViewAllTasks, canCreateTasks 등)

**권한 계산 로직** (`/app/api/auth/verify/route.ts` 추정)
- JWT 토큰에서 `permission_level` 추출
- `permission_level` 기반으로 `permissions` 객체 생성

### 4. Middleware 보호

**middleware.ts** (`/middleware.ts`)
- httpOnly 쿠키에서 `auth_token` 확인
- JWT 검증 후 AuthGuard로 페이지 권한 확인
- 접근 거부 시 로그인 페이지 또는 메인 대시보드로 리다이렉트

**공개 경로 (`isPublicRoute`):**
```typescript
const publicRoutes = [
  '/', '/login', '/signup', '/forgot-password', ...
];
```

### 5. 보조금 공고 페이지 현황

**페이지 위치**: `/app/admin/subsidy/page.tsx`

**현재 권한 체크 (추정)**:
- 파일을 읽지 않았지만, AuthContext의 `canAccessAdminPages` 권한으로 보호되고 있을 가능성 높음
- CREATE (수동 등록), UPDATE (수정), DELETE (삭제) 기능이 있음
- 현재는 `permission_level >= 2 (ADMIN)` 이상만 접근 가능할 것으로 추정

**필요한 변경사항:**
1. 게스트도 페이지에 접근 가능하도록 권한 완화
2. 게스트는 **읽기 전용** - 생성/수정/삭제 버튼 숨김 처리
3. 상세 모달에서도 편집/삭제 버튼 숨김

---

## 🎯 게스트 권한 설계

### 1. 새로운 권한 레벨: GUEST

**제안**: AuthLevel enum에 새로운 레벨 추가

```typescript
export enum AuthLevel {
  PUBLIC = 0,           // 누구나 접근 가능 (로그인 불필요)
  GUEST = 1,            // 🆕 게스트 (로그인 필요, 읽기 전용)
  AUTHENTICATED = 2,    // 일반 직원 (기존 1 → 2로 변경)
  ADMIN = 3,            // 관리자 (기존 2 → 3으로 변경)
  SUPER_ADMIN = 4,      // 슈퍼 관리자 (기존 3 → 4로 변경)
  SYSTEM_ADMIN = 5      // 시스템 관리자 (기존 4 → 5로 변경)
}
```

**⚠️ Breaking Change**: 기존 레벨이 모두 +1씩 증가하므로 **데이터베이스 마이그레이션 필수**

**대안**: GUEST를 0.5로 설정? → ❌ enum은 정수만 가능

### 2. 게스트 접근 가능 페이지

**PagePermissions.ts 수정:**
```typescript
export const PAGE_AUTH_LEVELS = {
  // PUBLIC 페이지 - 로그인 불필요
  '/': AuthLevel.PUBLIC,
  '/login': AuthLevel.PUBLIC,
  '/about': AuthLevel.PUBLIC,

  // GUEST 페이지 - 게스트 접근 가능 (읽기 전용)
  '/admin/subsidy': AuthLevel.GUEST,  // 🆕 보조금 공고 조회

  // AUTHENTICATED 페이지 - 일반 직원 (레벨 2)
  '/admin/business': AuthLevel.AUTHENTICATED,
  '/admin/tasks': AuthLevel.AUTHENTICATED,

  // ... 나머지 페이지들
} as const;
```

### 3. 게스트 권한 플래그

**AuthContext 권한 객체:**
```typescript
interface AuthContextType {
  user: Employee | null;
  socialAccounts: SocialAccount[] | null;
  permissions: {
    canViewAllTasks: boolean;
    canCreateTasks: boolean;
    canEditTasks: boolean;
    canDeleteTasks: boolean;
    canViewReports: boolean;
    canApproveReports: boolean;
    canAccessAdminPages: boolean;
    canViewSensitiveData: boolean;
    canDeleteAutoMemos: boolean;

    // 🆕 게스트 권한
    isGuest: boolean;                    // 게스트 여부 플래그
    canViewSubsidyAnnouncements: boolean; // 보조금 공고 조회
  };
  loading: boolean;
  // ...
}
```

**권한 계산 로직 (API 서버):**
```typescript
// /app/api/auth/verify/route.ts (추정)
function calculatePermissions(permission_level: number) {
  if (permission_level === AuthLevel.GUEST) {
    return {
      // 게스트는 모든 작업 권한 없음
      canViewAllTasks: false,
      canCreateTasks: false,
      canEditTasks: false,
      canDeleteTasks: false,
      canViewReports: false,
      canApproveReports: false,
      canAccessAdminPages: false,  // 일반 관리자 페이지 접근 불가
      canViewSensitiveData: false,
      canDeleteAutoMemos: false,

      // 게스트 전용 권한
      isGuest: true,
      canViewSubsidyAnnouncements: true,  // 보조금 공고 읽기만 가능
    };
  }

  // 기존 권한 계산 로직 (레벨 +1씩 조정 필요)
  // ...
}
```

### 4. UI 수정 - 보조금 공고 페이지

**`/app/admin/subsidy/page.tsx` 수정 필요:**

#### 4.1 수동 등록 버튼 숨김
```typescript
const { user, permissions } = useAuth();

// 게스트는 수동 등록 버튼 보이지 않음
{!permissions?.isGuest && (
  <button onClick={() => setShowManualUpload(true)}>
    ✍️ 수동 등록
  </button>
)}
```

#### 4.2 필터/정렬 UI는 유지
- 게스트도 검색, 필터, 정렬 기능 사용 가능 (읽기 전용이므로)

#### 4.3 상세 모달 수정 (AnnouncementDetailModal.tsx)
```typescript
// 게스트는 수정/삭제 버튼 보이지 않음
const canEdit = announcement.is_manual && (
  announcement.created_by === currentUserId || userPermissionLevel >= 4
) && !isGuest;  // 🆕 게스트는 편집 불가

{canEdit && (
  <div className="mb-6 flex gap-2">
    <button onClick={() => onEdit(announcement)}>수정</button>
    <button onClick={handleDelete}>삭제</button>
  </div>
)}
```

#### 4.4 API 보호 (서버 사이드)
```typescript
// /app/api/subsidy-announcements/manual/route.ts
export async function POST(request: Request) {
  // JWT 검증
  const decodedToken = verifyToken(token);

  // 게스트는 생성 불가
  if (decodedToken.permission_level === AuthLevel.GUEST) {
    return NextResponse.json({
      success: false,
      error: { code: 'PERMISSION_DENIED', message: '게스트는 공고를 등록할 수 없습니다.' }
    }, { status: 403 });
  }

  // ... 기존 로직
}

// PATCH, DELETE도 동일하게 게스트 차단
```

---

## 📊 데이터베이스 스키마 변경

### 1. employees 테이블

**현재 스키마 (추정):**
```sql
CREATE TABLE employees (
  id UUID PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255),
  permission_level INTEGER DEFAULT 1,  -- 현재: 1(일반) ~ 4(시스템관리자)
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

### 2. 마이그레이션 SQL

```sql
-- 마이그레이션: 기존 permission_level +1씩 증가
BEGIN;

-- Step 1: 기존 레벨을 임시로 +10 증가 (충돌 방지)
UPDATE employees SET permission_level = permission_level + 10;

-- Step 2: 새로운 레벨로 재매핑
UPDATE employees SET permission_level =
  CASE
    WHEN permission_level = 11 THEN 2  -- 일반 직원 (기존 1 → 2)
    WHEN permission_level = 12 THEN 3  -- 관리자 (기존 2 → 3)
    WHEN permission_level = 13 THEN 4  -- 슈퍼 관리자 (기존 3 → 4)
    WHEN permission_level = 14 THEN 5  -- 시스템 관리자 (기존 4 → 5)
    ELSE permission_level
  END;

-- Step 3: permission_level 제약 조건 업데이트
ALTER TABLE employees DROP CONSTRAINT IF EXISTS employees_permission_level_check;
ALTER TABLE employees ADD CONSTRAINT employees_permission_level_check
  CHECK (permission_level >= 1 AND permission_level <= 5);

-- Step 4: 게스트 계정 생성 (선택 사항 - 수동으로 추가 가능)
-- INSERT INTO employees (name, email, permission_level, is_active)
-- VALUES ('게스트1', 'guest1@example.com', 1, true);

COMMIT;
```

### 3. 롤백 SQL (만약 문제 발생 시)

```sql
BEGIN;

-- 레벨을 다시 -1씩 감소
UPDATE employees SET permission_level =
  CASE
    WHEN permission_level = 2 THEN 1  -- 일반 직원 (2 → 1)
    WHEN permission_level = 3 THEN 2  -- 관리자 (3 → 2)
    WHEN permission_level = 4 THEN 3  -- 슈퍼 관리자 (4 → 3)
    WHEN permission_level = 5 THEN 4  -- 시스템 관리자 (5 → 4)
    ELSE permission_level
  END;

-- 제약 조건 복원
ALTER TABLE employees DROP CONSTRAINT IF EXISTS employees_permission_level_check;
ALTER TABLE employees ADD CONSTRAINT employees_permission_level_check
  CHECK (permission_level >= 1 AND permission_level <= 4);

COMMIT;
```

---

## 🛡️ 라우트 가드 설계

### 1. Middleware 수정

**`middleware.ts` 변경 불필요** - 이미 AuthGuard를 사용하여 권한 체크하고 있음. PagePermissions만 업데이트하면 자동으로 적용됨.

### 2. 페이지 레벨 보호

**ProtectedPage 컴포넌트** (`/components/auth/ProtectedPage.tsx`) - 이미 구현되어 있음, 변경 불필요

**보조금 공고 페이지에 적용 (선택 사항):**
```typescript
// /app/admin/subsidy/page.tsx
import { ProtectedPage } from '@/components/auth/ProtectedPage';
import { AuthLevel } from '@/lib/auth/AuthLevels';

export default function SubsidyPage() {
  return (
    <ProtectedPage requiredLevel={AuthLevel.GUEST}>
      {/* 기존 페이지 내용 */}
    </ProtectedPage>
  );
}
```

### 3. API 레벨 보호

**각 API 라우트에서 권한 체크:**

```typescript
// 공통 권한 체크 유틸리티 (예시)
// /lib/auth/api-auth.ts (새로 생성)

import { NextRequest, NextResponse } from 'next/server';
import { verifyJWT } from '@/lib/secure-jwt';
import { AuthLevel } from '@/lib/auth/AuthLevels';

export async function checkApiPermission(
  request: NextRequest,
  requiredLevel: AuthLevel
): Promise<{ authorized: boolean; user?: any; error?: string }> {
  const authHeader = request.headers.get('authorization');

  if (!authHeader?.startsWith('Bearer ')) {
    return { authorized: false, error: '인증 토큰이 없습니다.' };
  }

  const token = authHeader.substring(7);
  const decodedToken = await verifyJWT(token);

  if (!decodedToken) {
    return { authorized: false, error: '유효하지 않은 토큰입니다.' };
  }

  const userLevel = decodedToken.permission_level;

  if (userLevel < requiredLevel) {
    return {
      authorized: false,
      error: `이 작업은 레벨 ${requiredLevel} 이상의 권한이 필요합니다.`
    };
  }

  return { authorized: true, user: decodedToken };
}
```

**API 라우트에서 사용:**
```typescript
// /app/api/subsidy-announcements/manual/route.ts

export async function POST(request: Request) {
  // 게스트는 생성 불가 (레벨 2 이상 필요)
  const authCheck = await checkApiPermission(request, AuthLevel.AUTHENTICATED);

  if (!authCheck.authorized) {
    return NextResponse.json({
      success: false,
      error: { code: 'PERMISSION_DENIED', message: authCheck.error }
    }, { status: 403 });
  }

  // ... 기존 로직
}
```

---

## 📝 구현 체크리스트

### Phase 1: 권한 레벨 정의 및 데이터베이스 마이그레이션
- [ ] `AuthLevels.ts` - GUEST 레벨 추가 (기존 레벨 +1 조정)
- [ ] `AUTH_LEVEL_DESCRIPTIONS` 업데이트
- [ ] 데이터베이스 마이그레이션 SQL 작성 및 실행
- [ ] 마이그레이션 검증 (기존 사용자 권한 레벨 확인)

### Phase 2: 페이지 권한 매핑
- [ ] `PagePermissions.ts` - `/admin/subsidy` 페이지를 `AuthLevel.GUEST`로 설정
- [ ] `PagePermissions.ts` - `/` 페이지 권한 확인 (PUBLIC 유지)
- [ ] 다른 페이지들 권한 레벨 조정 (AUTHENTICATED → 2로 변경 등)

### Phase 3: 권한 계산 로직
- [ ] `/app/api/auth/verify/route.ts` 찾아서 권한 계산 로직 수정
- [ ] 게스트 권한 플래그 추가 (`isGuest`, `canViewSubsidyAnnouncements`)
- [ ] 기존 권한 레벨 조정 (1→2, 2→3, 3→4, 4→5)

### Phase 4: UI 수정
- [ ] `/app/admin/subsidy/page.tsx` - 수동 등록 버튼 게스트에게 숨김
- [ ] `AnnouncementDetailModal.tsx` - 수정/삭제 버튼 게스트에게 숨김
- [ ] 권한 없음 UI 테스트 (버튼이 보이지 않는지 확인)

### Phase 5: API 보호
- [ ] `/app/api/subsidy-announcements/manual/route.ts` - POST (생성) 게스트 차단
- [ ] `/app/api/subsidy-announcements/manual/route.ts` - PATCH (수정) 게스트 차단
- [ ] `/app/api/subsidy-announcements/manual/route.ts` - DELETE (삭제) 게스트 차단
- [ ] GET 요청은 게스트 허용 (읽기 전용)

### Phase 6: 테스트
- [ ] 게스트 계정 생성 (permission_level = 1)
- [ ] 게스트 로그인 테스트
- [ ] `/` 페이지 접근 확인
- [ ] `/admin/subsidy` 페이지 접근 확인
- [ ] 다른 `/admin/*` 페이지 접근 차단 확인
- [ ] 보조금 공고 조회 가능 확인
- [ ] 수동 등록 버튼 숨김 확인
- [ ] 수정/삭제 버튼 숨김 확인
- [ ] API 생성/수정/삭제 차단 확인 (403 Forbidden)

### Phase 7: 문서화 및 배포
- [ ] 관리자 가이드 작성 (게스트 계정 생성 방법)
- [ ] 권한 레벨 변경 사항 문서화
- [ ] 배포 전 스테이징 환경 테스트
- [ ] 프로덕션 배포 및 모니터링

---

## ⚠️ 주의사항

### 1. Breaking Change
- 모든 기존 사용자의 `permission_level`이 +1씩 증가합니다.
- 하드코딩된 권한 레벨 체크가 있는지 전체 코드베이스 검색 필요:
  ```bash
  grep -r "permission_level === 1" .
  grep -r "permission_level >= 2" .
  grep -r "role < 3" .
  ```

### 2. JWT 토큰 갱신
- 기존 로그인 세션의 JWT 토큰에는 **옛날 권한 레벨**이 저장되어 있습니다.
- 마이그레이션 후 모든 사용자는 **재로그인 필요** (또는 토큰 자동 갱신 로직 추가)

### 3. 권한 체크 일관성
- 클라이언트 사이드 UI 숨김 + 서버 사이드 API 차단 모두 필요
- UI만 숨기면 API 직접 호출로 우회 가능

### 4. 게스트 계정 관리
- 게스트 계정은 별도 이메일 도메인 사용 권장 (`guest@company.com` 형식)
- 게스트 계정 비밀번호 관리 정책 필요 (주기적 변경 등)

---

## 📖 대안 설계 (권장하지 않음)

### 대안 1: GUEST를 0.5로 설정
❌ **불가능** - TypeScript enum은 정수만 지원

### 대안 2: permission_level을 변경하지 않고 별도 플래그 추가
```sql
ALTER TABLE employees ADD COLUMN is_guest BOOLEAN DEFAULT false;
```

**장점**: 기존 레벨 변경 불필요
**단점**:
- 권한 체크 로직이 복잡해짐 (`permission_level` + `is_guest` 둘 다 확인)
- AuthLevel enum과 일관성 없음

### 대안 3: 게스트 전용 테이블 분리
```sql
CREATE TABLE guest_accounts (
  id UUID PRIMARY KEY,
  name VARCHAR(100),
  email VARCHAR(255) UNIQUE,
  allowed_pages TEXT[],
  created_at TIMESTAMP
);
```

**장점**: 일반 직원과 완전히 분리
**단점**:
- 인증 시스템 이중화 필요
- JWT 토큰 구조 변경 필요
- 복잡도 증가

---

## 🎯 권장 구현 순서

1. **테스트 환경에서 먼저 검증**
   - 로컬 개발 환경에서 전체 플로우 테스트
   - 스테이징 환경에서 마이그레이션 시뮬레이션

2. **단계적 배포**
   - Phase 1~3: 권한 시스템 기초 작업 (Breaking Change 포함)
   - Phase 4~5: UI 및 API 수정
   - Phase 6: 충분한 테스트
   - Phase 7: 프로덕션 배포

3. **모니터링 및 롤백 준비**
   - 배포 후 1시간 동안 에러 로그 모니터링
   - 문제 발생 시 즉시 롤백할 수 있도록 롤백 SQL 준비

---

## 📚 참고 파일 목록

### 권한 시스템
- `/lib/auth/AuthLevels.ts` - 권한 레벨 정의
- `/lib/auth/AuthGuard.ts` - 권한 가드 로직
- `/lib/auth/PagePermissions.ts` - 페이지별 권한 매핑
- `/contexts/AuthContext.tsx` - 인증 컨텍스트
- `/components/auth/ProtectedPage.tsx` - 페이지 보호 컴포넌트
- `/middleware.ts` - 미들웨어 (라우트 가드)

### 보조금 공고 시스템
- `/app/admin/subsidy/page.tsx` - 보조금 공고 메인 페이지
- `/components/subsidy/AnnouncementDetailModal.tsx` - 상세 모달
- `/components/subsidy/ManualUploadModal.tsx` - 수동 등록 모달
- `/app/api/subsidy-announcements/manual/route.ts` - API (생성/수정/삭제)

### 인증 API
- `/app/api/auth/verify/route.ts` - 토큰 검증 및 권한 계산 (추정)
- `/lib/secure-jwt.ts` - JWT 유틸리티

---

## ✅ 최종 결론

**게스트 권한 시스템 구현을 위해서는 Breaking Change가 불가피합니다.**

1. **AuthLevel enum에 GUEST = 1 추가**
2. **기존 레벨 +1씩 증가** (AUTHENTICATED=2, ADMIN=3, SUPER_ADMIN=4, SYSTEM_ADMIN=5)
3. **데이터베이스 마이그레이션 필수**
4. **모든 사용자 재로그인 필요**

하지만 이 방법이 **가장 깔끔하고 유지보수가 용이**합니다. 장기적으로 권한 시스템을 확장하기에도 적합합니다.
