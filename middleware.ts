import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@/utils/auth';

// 인증이 필요한 경로 패턴
const PROTECTED_PATHS = [
  '/admin',
  '/business',
  '/test-upload',
  '/api/business-list',
  '/api/uploaded-files-supabase',
  '/api/send-email',
  '/api/admin'
];

// 관리자만 접근 가능한 경로
const ADMIN_ONLY_PATHS = [
  '/admin',
  '/api/admin'
];

// 인증이 불필요한 경로
const PUBLIC_PATHS = [
  '/',
  '/api/auth',
  '/api/health',
  '/access-denied',
  '/login'
];

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // 정적 파일과 Next.js 내부 경로는 건너뛰기
  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/favicon') ||
    pathname.includes('.') ||
    pathname === '/manifest.json' ||
    pathname === '/sw.js'
  ) {
    return NextResponse.next();
  }

  // 공개 경로는 인증 없이 통과
  if (PUBLIC_PATHS.some(path => pathname.startsWith(path))) {
    return NextResponse.next();
  }

  // 보호된 경로인지 확인
  const isProtectedPath = PROTECTED_PATHS.some(path => pathname.startsWith(path));

  if (!isProtectedPath) {
    return NextResponse.next();
  }

  // 토큰 확인
  const token = request.cookies.get('auth-token')?.value;

  if (!token) {
    return redirectToLogin(request);
  }

  try {
    const payload = await verifyToken(token);

    if (!payload) {
      return redirectToLogin(request);
    }

    // 관리자 권한 확인
    const isAdminPath = ADMIN_ONLY_PATHS.some(path => pathname.startsWith(path));

    if (isAdminPath && payload.role !== 3) {
      return NextResponse.redirect(new URL('/access-denied', request.url));
    }

    // 요청 헤더에 사용자 정보 추가
    const requestHeaders = new Headers(request.headers);
    requestHeaders.set('x-user-id', payload.userId);
    requestHeaders.set('x-user-email', payload.email);
    requestHeaders.set('x-user-role', payload.role.toString());

    return NextResponse.next({
      request: {
        headers: requestHeaders,
      },
    });

  } catch (error) {
    console.error('Token verification failed:', error);
    return redirectToLogin(request);
  }
}

function redirectToLogin(request: NextRequest) {
  const loginUrl = new URL('/', request.url);
  loginUrl.searchParams.set('redirect', request.nextUrl.pathname);
  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
};