# 게스트 권한 시스템 설계 문서 (v2 - 수정안)

## 📋 요구사항

사용자 요청: "시스템에 권한관리에 대한 기능이 있는데 게스트 권한을 추가해서 게스트 관리를 하고 싶어. 게스트는 '/' 페이지와 admin/subsidy만 볼 수 있고 뷰어기능만 있으면 돼."

### 핵심 요구사항
1. 새로운 게스트 권한 레벨 추가
2. 접근 가능 페이지: `/` (홈페이지), `/admin/subsidy` (보조금 공고 조회)
3. **뷰어 전용** - 읽기만 가능, 수정/삭제/생성 불가
4. **시스템 접근은 로그인 필수** - PUBLIC 개념 제거

### 사용자 피드백 반영
> "기존레벨을 1씩 증가하는건 너무 많이 건드리는거같아. 현재 시스템에는 레벨 0은 없는걸로 알고 있는데 0을 게스트의 권한으로 사용하는건 어때? 그리고 시스템에 가입해서 로그인하지 않으면 시스템에 접근도 불가능하게 되어야해. 그래서 public은 불필요해."

✅ **수정 방향**:
- 레벨 0 = GUEST (새로 추가)
- 기존 레벨 그대로 유지 (1=일반, 2=관리자, 3=슈퍼, 4=시스템)
- PUBLIC 개념 제거 → 모든 페이지 로그인 필수
- **Breaking Change 최소화**

---

## 🔍 현재 시스템 분석

### 1. 현재 권한 레벨 구조

**AuthLevels.ts** (`/lib/auth/AuthLevels.ts`)에 정의된 권한:

```typescript
export enum AuthLevel {
  PUBLIC = 0,           // ❌ 제거 예정 - 누구나 접근 가능
  AUTHENTICATED = 1,    // 일반
  MANAGER = 2,          // 매니저
  ADMIN = 3,            // 관리자
  SYSTEM_ADMIN = 4      // 시스템
}
```

**문제점**:
1. `PUBLIC = 0`이 있어서 로그인 없이 접근 가능한 페이지가 있음
2. "로그인 필요 + 읽기 전용" 권한이 없음

### 2. PUBLIC 사용 현황

**PagePermissions.ts** (`/lib/auth/PagePermissions.ts`):
```typescript
export const PAGE_AUTH_LEVELS = {
  '/': AuthLevel.PUBLIC,           // 홈페이지
  '/login': AuthLevel.PUBLIC,      // 로그인 페이지
  '/about': AuthLevel.PUBLIC,      // 소개 페이지
  // ...
}
```

**middleware.ts** (`/middleware.ts`):
```typescript
function isPublicRoute(pathname: string): boolean {
  const publicRoutes = [
    '/',
    '/login',
    '/signup',
    '/forgot-password',
    '/set-password',
    '/change-password',
    '/terms',
    '/privacy',
    '/api/health',
    // ...
  ];

  // business/[businessName] 패턴도 공개
  if (pathname.startsWith('/business/')) {
    return true;
  }

  return publicRoutes.some(route => pathname.startsWith(route));
}
```

**변경 필요사항**:
- `/`, `/about` → 게스트(레벨 0) 필요로 변경
- `/login`, `/signup` 등 **인증 관련 페이지만** PUBLIC 유지 (예외 처리)
- `/business/[businessName]` → 게스트 필요로 변경

---

## 🎯 게스트 권한 설계 (수정안)

### 1. 새로운 권한 레벨: GUEST = 0

**✅ 권장 설계 (Breaking Change 최소화):**

```typescript
export enum AuthLevel {
  GUEST = 0,            // 🆕 게스트 (로그인 필요, 읽기 전용)
  AUTHENTICATED = 1,    // ✅ 그대로 유지 - 일반
  MANAGER = 2,          // ✅ 그대로 유지 - 매니저
  ADMIN = 3,            // ✅ 그대로 유지 - 관리자
  SYSTEM_ADMIN = 4      // ✅ 그대로 유지 - 시스템
}
```

**장점**:
- ✅ **기존 권한 레벨 변경 불필요** (1, 2, 3, 4 그대로)
- ✅ **데이터베이스 마이그레이션 불필요** (기존 사용자 영향 없음)
- ✅ **기존 하드코딩된 권한 체크 코드 그대로 작동**
- ✅ **JWT 토큰 재발급 불필요** (기존 사용자 재로그인 불필요)

**변경사항**:
- `PUBLIC = 0` 제거 → `GUEST = 0`으로 대체
- 로그인 페이지 등 **특수 페이지만 예외 처리**

### 2. AUTH_LEVEL_DESCRIPTIONS 업데이트

```typescript
export const AUTH_LEVEL_DESCRIPTIONS = {
  [AuthLevel.GUEST]: '게스트 (읽기 전용)',         // 🆕
  [AuthLevel.AUTHENTICATED]: '일반',
  [AuthLevel.MANAGER]: '매니저',
  [AuthLevel.ADMIN]: '관리자',
  [AuthLevel.SYSTEM_ADMIN]: '시스템'
} as const;
```

### 3. 페이지 권한 매핑 변경

**PagePermissions.ts 수정:**

```typescript
export const PAGE_AUTH_LEVELS = {
  // ❌ PUBLIC 제거 - 모든 페이지 로그인 필수
  // '/': AuthLevel.PUBLIC,  (삭제)
  // '/login': AuthLevel.PUBLIC,  (삭제 - 특수 처리)
  // '/about': AuthLevel.PUBLIC,  (삭제)

  // 🆕 GUEST 접근 가능 페이지
  '/': AuthLevel.GUEST,                      // 홈페이지
  '/admin/subsidy': AuthLevel.GUEST,         // 보조금 공고 조회

  // ✅ 기존 권한 레벨 그대로 유지
  '/admin/business': AuthLevel.AUTHENTICATED,  // 레벨 1
  '/admin/tasks': AuthLevel.AUTHENTICATED,     // 레벨 1
  '/admin/revenue': AuthLevel.ADMIN,           // 레벨 2
  '/admin': AuthLevel.SUPER_ADMIN,             // 레벨 3
  '/admin/settings': AuthLevel.SUPER_ADMIN,    // 레벨 3
} as const;
```

### 4. 특수 페이지 처리 (로그인 페이지 등)

**AuthGuard.ts 수정 필요:**

```typescript
export class AuthGuard {
  /**
   * 인증 자체가 필요 없는 특수 페이지들
   */
  private static readonly AUTH_EXEMPT_PAGES = [
    '/login',
    '/signup',
    '/forgot-password',
    '/set-password',
    '/change-password',
    '/reset-password',
    '/terms',
    '/privacy',
  ];

  /**
   * 페이지 접근 권한 확인
   */
  static async checkPageAccess(pathname: string, user?: AuthUser | null): Promise<AuthResult> {
    // 1. 인증 면제 페이지 (로그인 페이지 등)
    if (this.isAuthExemptPage(pathname)) {
      return {
        allowed: true,
        userLevel: user?.permission_level ?? AuthLevel.GUEST,
        requiredLevel: AuthLevel.GUEST,  // 최소 레벨
        bypassed: false
      };
    }

    // 2. 일반 페이지 권한 확인
    const requiredLevel = PagePermissions.getRequiredLevel(pathname);
    const config = this.configManager.getConfig();

    // 3. 개발 환경 우회 (기존)
    if (config.bypassAuth && !this.configManager.isProduction()) {
      const devUserLevel = config.defaultUserLevel;
      return {
        allowed: true,
        userLevel: devUserLevel,
        requiredLevel,
        bypassed: true
      };
    }

    // 4. 로그인 상태 확인 (모든 일반 페이지는 로그인 필수)
    if (!user) {
      return {
        allowed: false,
        redirectTo: `/login?redirect=${encodeURIComponent(pathname)}`,
        userLevel: AuthLevel.GUEST,  // 로그인 안 한 상태
        requiredLevel,
        bypassed: false,
        error: '로그인이 필요합니다.'
      };
    }

    // 5. 권한 레벨 확인
    const userLevel = user.permission_level;
    const hasPermission = AuthLevelUtils.hasPermission(userLevel, requiredLevel);

    if (!hasPermission) {
      return {
        allowed: false,
        redirectTo: '/admin',  // 권한 부족 시 메인 대시보드로
        userLevel,
        requiredLevel,
        bypassed: false,
        error: `이 페이지는 ${AuthLevelUtils.getLevelName(requiredLevel)} 이상의 권한이 필요합니다.`
      };
    }

    return {
      allowed: true,
      userLevel,
      requiredLevel,
      bypassed: false
    };
  }

  /**
   * 인증 면제 페이지인지 확인
   */
  private static isAuthExemptPage(pathname: string): boolean {
    return this.AUTH_EXEMPT_PAGES.some(page => pathname.startsWith(page));
  }
}
```

### 5. Middleware 수정

**middleware.ts 변경:**

```typescript
// 인증이 필요 없는 특수 경로 (로그인 페이지 등)
function isAuthExemptRoute(pathname: string): boolean {
  const exemptRoutes = [
    '/login',
    '/signup',
    '/forgot-password',
    '/set-password',
    '/change-password',
    '/reset-password',
    '/terms',
    '/privacy',
    '/api/health',
    '/api/supabase-test',
    '/_next',
    '/favicon.ico'
  ];

  return exemptRoutes.some(route => pathname.startsWith(route));
}

// ❌ 삭제: isPublicRoute 함수 (더 이상 PUBLIC 개념 없음)

// 페이지 인증 및 권한 확인
async function checkPageAuthentication(request: NextRequest): Promise<NextResponse | null> {
  const { pathname } = request.nextUrl;

  // 1. 인증 면제 경로는 바로 통과
  if (isAuthExemptRoute(pathname)) {
    return null;  // 통과
  }

  // 2. 모든 일반 페이지는 로그인 필수
  const token = request.cookies.get('auth_token')?.value;

  if (!token) {
    // 로그인 페이지로 리다이렉트
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('redirect', pathname);
    return NextResponse.redirect(loginUrl);
  }

  // 3. JWT 검증 및 권한 확인
  try {
    const jwt = require('jsonwebtoken');
    const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';
    const decodedToken = jwt.verify(token, JWT_SECRET);

    // AuthGuard로 페이지 권한 확인
    const { AuthGuard } = require('@/lib/auth/AuthGuard');
    const authResult = await AuthGuard.checkPageAccess(pathname, {
      id: decodedToken.id,
      name: decodedToken.name,
      email: decodedToken.email,
      permission_level: decodedToken.permission_level || 1
    });

    if (!authResult.allowed) {
      const redirectUrl = new URL(authResult.redirectTo || '/login', request.url);
      return NextResponse.redirect(redirectUrl);
    }

    return null;  // 통과
  } catch (error) {
    // 토큰 무효 → 로그인 페이지로
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('redirect', pathname);
    const response = NextResponse.redirect(loginUrl);
    response.cookies.delete('auth_token');
    return response;
  }
}

// 메인 미들웨어
export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // API 경로 처리
  if (pathname.startsWith('/api/')) {
    // ... (기존 API 보호 로직)
  }

  // 일반 페이지 처리 - 모두 인증 확인
  const authResult = await checkPageAuthentication(request);
  if (authResult) {
    setSecurityHeaders(authResult);
    return authResult;
  }

  const response = NextResponse.next();
  setSecurityHeaders(response);
  return response;
}
```

### 6. 게스트 권한 플래그

**AuthContext 권한 객체 (기존 유지 + 추가):**

```typescript
interface AuthContextType {
  user: Employee | null;
  socialAccounts: SocialAccount[] | null;
  permissions: {
    // 기존 권한 (그대로 유지)
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
// /app/api/auth/verify/route.ts 수정
function calculatePermissions(permission_level: number) {
  // 🆕 게스트 권한 (레벨 0)
  if (permission_level === 0) {  // AuthLevel.GUEST
    return {
      canViewAllTasks: false,
      canCreateTasks: false,
      canEditTasks: false,
      canDeleteTasks: false,
      canViewReports: false,
      canApproveReports: false,
      canAccessAdminPages: false,
      canViewSensitiveData: false,
      canDeleteAutoMemos: false,

      isGuest: true,
      canViewSubsidyAnnouncements: true,  // 보조금 공고 읽기만 가능
    };
  }

  // ✅ 기존 권한 계산 로직 그대로 유지 (레벨 1, 2, 3, 4)
  if (permission_level >= 1) {
    return {
      canViewAllTasks: true,
      canCreateTasks: permission_level >= 2,
      canEditTasks: permission_level >= 2,
      canDeleteTasks: permission_level >= 3,
      canViewReports: permission_level >= 2,
      canApproveReports: permission_level >= 3,
      canAccessAdminPages: permission_level >= 2,
      canViewSensitiveData: permission_level >= 3,
      canDeleteAutoMemos: permission_level >= 3,

      isGuest: false,
      canViewSubsidyAnnouncements: true,
    };
  }

  // 기본값 (도달하지 않음)
  return defaultPermissions;
}
```

---

## 🔧 UI 수정 - 보조금 공고 페이지

### 1. 수동 등록 버튼 숨김

**`/app/admin/subsidy/page.tsx` 수정:**

```typescript
const { user, permissions } = useAuth();

// 게스트는 수동 등록 버튼 보이지 않음
{!permissions?.isGuest && (
  <button
    onClick={() => setShowManualUpload(true)}
    className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg"
  >
    <PlusCircle className="w-5 h-5" />
    ✍️ 수동 등록
  </button>
)}
```

### 2. 상세 모달 수정

**`AnnouncementDetailModal.tsx` 수정:**

```typescript
interface AnnouncementDetailModalProps {
  announcement: SubsidyAnnouncement;
  currentUserId?: string;
  userPermissionLevel?: number;
  isGuest?: boolean;  // 🆕 게스트 플래그 추가
  onClose: () => void;
  onDelete: (id: string) => Promise<{ success: boolean; message?: string; error?: string }>;
  onEdit: (announcement: SubsidyAnnouncement) => void;
}

export default function AnnouncementDetailModal({
  announcement,
  currentUserId,
  userPermissionLevel = 1,
  isGuest = false,  // 🆕
  onClose,
  onDelete,
  onEdit
}: AnnouncementDetailModalProps) {
  // 수정/삭제 권한 체크
  const canEdit = announcement.is_manual && (
    announcement.created_by === currentUserId || userPermissionLevel >= 4
  ) && !isGuest;  // 🆕 게스트는 편집 불가

  return (
    <div>
      {/* 수정/삭제 버튼 - 게스트는 보이지 않음 */}
      {canEdit && (
        <div className="mb-6 flex gap-2">
          <button onClick={() => onEdit(announcement)}>
            <Edit className="w-4 h-4" />
            수정
          </button>
          <button onClick={handleDelete}>
            <Trash2 className="w-4 h-4" />
            삭제
          </button>
        </div>
      )}

      {/* 나머지 내용 (조회는 게스트도 가능) */}
    </div>
  );
}
```

### 3. API 보호

**`/app/api/subsidy-announcements/manual/route.ts` 수정:**

```typescript
export async function POST(request: Request) {
  const authHeader = request.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return NextResponse.json({
      success: false,
      error: { code: 'UNAUTHORIZED', message: '인증이 필요합니다.' }
    }, { status: 401 });
  }

  const token = authHeader.substring(7);
  const decodedToken = await verifyJWT(token);

  if (!decodedToken) {
    return NextResponse.json({
      success: false,
      error: { code: 'INVALID_TOKEN', message: '유효하지 않은 토큰입니다.' }
    }, { status: 401 });
  }

  // 🆕 게스트는 생성 불가 (레벨 1 이상 필요)
  if (decodedToken.permission_level < 1) {  // GUEST = 0
    return NextResponse.json({
      success: false,
      error: {
        code: 'PERMISSION_DENIED',
        message: '게스트는 공고를 등록할 수 없습니다. 일반 사용자 권한이 필요합니다.'
      }
    }, { status: 403 });
  }

  // ... 기존 생성 로직
}

// PATCH, DELETE도 동일하게 게스트 차단
export async function PATCH(request: Request) {
  // ... 토큰 검증

  if (decodedToken.permission_level < 1) {
    return NextResponse.json({
      success: false,
      error: { code: 'PERMISSION_DENIED', message: '게스트는 공고를 수정할 수 없습니다.' }
    }, { status: 403 });
  }

  // ... 기존 수정 로직
}

export async function DELETE(request: Request) {
  // ... 토큰 검증

  if (decodedToken.permission_level < 1) {
    return NextResponse.json({
      success: false,
      error: { code: 'PERMISSION_DENIED', message: '게스트는 공고를 삭제할 수 없습니다.' }
    }, { status: 403 });
  }

  // ... 기존 삭제 로직
}
```

---

## 📊 데이터베이스 변경

### ✅ 마이그레이션 불필요!

**이유**:
- 기존 사용자는 모두 `permission_level >= 1`
- 게스트 계정만 새로 생성하면 됨 (`permission_level = 0`)
- **기존 데이터 변경 불필요**

### 게스트 계정 생성

```sql
-- 게스트 계정 생성 (예시)
INSERT INTO employees (
  id,
  name,
  email,
  password_hash,
  permission_level,
  is_active,
  created_at
) VALUES (
  gen_random_uuid(),
  '게스트1',
  'guest1@company.com',
  '$2b$10$...',  -- bcrypt 해시
  0,  -- 🆕 GUEST 레벨
  true,
  NOW()
);
```

### 제약 조건 업데이트 (선택 사항)

```sql
-- permission_level 제약 조건 업데이트 (0 포함)
ALTER TABLE employees DROP CONSTRAINT IF EXISTS employees_permission_level_check;
ALTER TABLE employees ADD CONSTRAINT employees_permission_level_check
  CHECK (permission_level >= 0 AND permission_level <= 4);
```

---

## 📝 구현 체크리스트

### Phase 1: 권한 레벨 정의
- [ ] `AuthLevels.ts` - `PUBLIC` 제거, `GUEST = 0` 추가
- [ ] `AUTH_LEVEL_DESCRIPTIONS` 업데이트
- [ ] `AuthLevelUtils` 테스트 (기존 로직 동작 확인)

### Phase 2: 페이지 권한 매핑
- [ ] `PagePermissions.ts` - `/`, `/admin/subsidy`를 `AuthLevel.GUEST`로 설정
- [ ] `PagePermissions.ts` - PUBLIC 사용 제거
- [ ] `AuthGuard.ts` - `isAuthExemptPage` 메서드 추가
- [ ] `AuthGuard.ts` - `checkPageAccess` 로직 수정

### Phase 3: Middleware 수정
- [ ] `middleware.ts` - `isPublicRoute` → `isAuthExemptRoute`로 변경
- [ ] `middleware.ts` - 모든 일반 페이지 로그인 필수로 변경
- [ ] `/business/[businessName]` 경로 권한 설정 (게스트 or 일반?)

### Phase 4: 권한 계산 로직
- [ ] `/app/api/auth/verify/route.ts` 찾아서 권한 계산 로직 수정
- [ ] 게스트 권한 플래그 추가 (`isGuest`, `canViewSubsidyAnnouncements`)
- [ ] 기존 권한 계산 로직 동작 확인 (레벨 1, 2, 3, 4)

### Phase 5: UI 수정
- [ ] `/app/admin/subsidy/page.tsx` - 수동 등록 버튼 게스트에게 숨김
- [ ] `AnnouncementDetailModal.tsx` - `isGuest` prop 추가
- [ ] `AnnouncementDetailModal.tsx` - 수정/삭제 버튼 게스트에게 숨김
- [ ] 부모 컴포넌트에서 `isGuest` 전달

### Phase 6: API 보호
- [ ] `/app/api/subsidy-announcements/manual/route.ts` - POST 게스트 차단
- [ ] `/app/api/subsidy-announcements/manual/route.ts` - PATCH 게스트 차단
- [ ] `/app/api/subsidy-announcements/manual/route.ts` - DELETE 게스트 차단
- [ ] GET 요청은 게스트 허용 (읽기 전용)

### Phase 7: 테스트
- [ ] 데이터베이스 제약 조건 업데이트 (permission_level >= 0)
- [ ] 게스트 계정 생성 (permission_level = 0)
- [ ] 게스트 로그인 테스트
- [ ] `/` 페이지 접근 확인 (게스트 가능)
- [ ] `/admin/subsidy` 페이지 접근 확인 (게스트 가능)
- [ ] 다른 `/admin/*` 페이지 접근 차단 확인 (401 or 403)
- [ ] 보조금 공고 조회 가능 확인
- [ ] 수동 등록 버튼 숨김 확인
- [ ] 수정/삭제 버튼 숨김 확인
- [ ] API 생성/수정/삭제 차단 확인 (403 Forbidden)
- [ ] 로그인 페이지는 게스트도 접근 가능 확인 (리다이렉트 없음)

### Phase 8: 기존 기능 검증
- [ ] 일반(레벨 1) 로그인 및 권한 확인
- [ ] 매니저(레벨 2) 로그인 및 권한 확인
- [ ] 관리자(레벨 3) 로그인 및 권한 확인
- [ ] 시스템(레벨 4) 로그인 및 권한 확인
- [ ] 기존 하드코딩된 권한 체크 동작 확인

### Phase 9: 문서화 및 배포
- [ ] 관리자 가이드 작성 (게스트 계정 생성 방법)
- [ ] PUBLIC 제거 영향 문서화
- [ ] 배포 전 스테이징 환경 테스트
- [ ] 프로덕션 배포 및 모니터링

---

## ⚠️ 주의사항

### 1. Breaking Change 최소화 ✅
- ✅ **기존 사용자 권한 레벨 변경 없음** (1, 2, 3, 4 그대로)
- ✅ **데이터베이스 마이그레이션 불필요**
- ✅ **JWT 토큰 재발급 불필요** (기존 사용자 재로그인 불필요)

### 2. PUBLIC 제거 영향
- ⚠️ **모든 페이지 로그인 필수**로 변경됨
- ⚠️ `/`, `/about` 등 기존 공개 페이지도 게스트 로그인 필요
- ⚠️ `/business/[businessName]` 경로 권한 설정 필요 (게스트? 일반?)

### 3. 인증 면제 페이지 확인
- `/login`, `/signup` 등은 반드시 인증 없이 접근 가능해야 함
- `isAuthExemptRoute` 함수에 빠진 페이지 없는지 확인

### 4. 하드코딩된 권한 체크 검색
```bash
grep -r "permission_level === 0" .    # PUBLIC 사용 확인
grep -r "permission_level >= 1" .     # 일반 사용자 체크 (영향 없음)
grep -r "AuthLevel.PUBLIC" .          # PUBLIC enum 사용 확인
```

### 5. API 보호 일관성
- 클라이언트 사이드 UI 숨김 + 서버 사이드 API 차단 모두 필요
- UI만 숨기면 API 직접 호출로 우회 가능

---

## 📖 v1 vs v2 비교

| 항목 | v1 (기존 레벨 +1) | v2 (GUEST = 0) |
|------|------------------|----------------|
| 게스트 | 1 | 0 |
| 일반 | 2 | 1 (변경 없음) |
| 매니저 | 3 | 2 (변경 없음) |
| 관리자 | 4 | 3 (변경 없음) |
| 시스템 | 5 | 4 (변경 없음) |
| **DB 마이그레이션** | **필수** ❌ | **불필요** ✅ |
| **JWT 재발급** | **필수** ❌ | **불필요** ✅ |
| **하드코딩 수정** | **필수** ❌ | **최소** ✅ |
| **PUBLIC 제거** | 선택 | **필수** ⚠️ |

---

## 🎯 권장 구현 순서

1. **테스트 환경에서 먼저 검증**
   - 로컬 개발 환경에서 전체 플로우 테스트
   - 스테이징 환경에서 PUBLIC 제거 영향 확인

2. **단계적 배포**
   - Phase 1~3: 권한 시스템 기초 작업
   - Phase 4~6: UI 및 API 수정
   - Phase 7~8: 충분한 테스트 및 기존 기능 검증
   - Phase 9: 프로덕션 배포

3. **모니터링 및 롤백 준비**
   - PUBLIC 제거 후 로그인 페이지 접근 확인
   - 게스트 계정 정상 작동 확인
   - 기존 사용자 영향 없는지 모니터링

---

## 📚 참고 파일 목록

### 권한 시스템
- `/lib/auth/AuthLevels.ts` - 권한 레벨 정의 (PUBLIC → GUEST 변경)
- `/lib/auth/AuthGuard.ts` - 권한 가드 로직 (isAuthExemptPage 추가)
- `/lib/auth/PagePermissions.ts` - 페이지별 권한 매핑 (PUBLIC 제거)
- `/contexts/AuthContext.tsx` - 인증 컨텍스트
- `/components/auth/ProtectedPage.tsx` - 페이지 보호 컴포넌트
- `/middleware.ts` - 미들웨어 (isPublicRoute → isAuthExemptRoute)

### 보조금 공고 시스템
- `/app/admin/subsidy/page.tsx` - 보조금 공고 메인 페이지
- `/components/subsidy/AnnouncementDetailModal.tsx` - 상세 모달 (isGuest prop 추가)
- `/components/subsidy/ManualUploadModal.tsx` - 수동 등록 모달
- `/app/api/subsidy-announcements/manual/route.ts` - API (게스트 차단)

### 인증 API
- `/app/api/auth/verify/route.ts` - 토큰 검증 및 권한 계산 (게스트 권한 추가)
- `/lib/secure-jwt.ts` - JWT 유틸리티

---

## ✅ 최종 결론

**v2 설계는 Breaking Change를 최소화하면서 게스트 권한을 추가하는 최선의 방법입니다.**

### ✅ 장점
1. **기존 사용자 영향 없음** - 권한 레벨 변경 없음
2. **DB 마이그레이션 불필요** - 게스트만 새로 생성
3. **JWT 재발급 불필요** - 기존 토큰 그대로 작동
4. **하드코딩 수정 최소** - 레벨 1, 2, 3, 4 그대로

### ⚠️ 주의사항
1. **PUBLIC 제거** - 모든 페이지 로그인 필수
2. **인증 면제 페이지** - 로그인 페이지 등 예외 처리 필요
3. **기존 공개 페이지** - 게스트 로그인 필요로 변경

**권장**: v2 설계로 진행하되, PUBLIC 제거 영향을 충분히 검토하고 테스트 필요.
