import { NextRequest, NextResponse } from 'next/server';
import { RateLimiter } from '@/lib/security/rate-limiter';
import { protectCSRF } from '@/lib/security/csrf-protection';
import { validateRequestSize } from '@/lib/security/input-validation';

// 보안 헤더 설정
function setSecurityHeaders(response: NextResponse): void {
  // XSS 보호
  response.headers.set('X-XSS-Protection', '1; mode=block');

  // 클릭재킹 방지 (SAMEORIGIN으로 변경 - 캘린더 파일 미리보기 iframe 허용)
  response.headers.set('X-Frame-Options', 'SAMEORIGIN');

  // MIME 타입 스니핑 방지
  response.headers.set('X-Content-Type-Options', 'nosniff');

  // 리퍼러 정책
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');

  // DNS 프리페치 제어
  response.headers.set('X-DNS-Prefetch-Control', 'on');

  // 권한 정책 (카메라, 마이크 등 제한)
  response.headers.set(
    'Permissions-Policy',
    'geolocation=(), microphone=(), camera=(), payment=(), usb=(), magnetometer=()'
  );

  // Content Security Policy (CSP)
  const cspDirectives = [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline' 'unsafe-eval'", // Next.js 요구사항
    "style-src 'self' 'unsafe-inline'", // TailwindCSS 지원
    "img-src 'self' data: blob: https:", // 이미지 업로드 지원
    "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://dapi.kakao.com", // Supabase 연결 + 카카오 지오코딩 API
    "font-src 'self' data:",
    "frame-src 'self' https://*.supabase.co", // Supabase Storage iframe 허용 (캘린더 파일 미리보기)
    "object-src 'self' https://*.supabase.co", // PDF embed 태그 허용 (캘린더 파일 미리보기)
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    "upgrade-insecure-requests"
  ];

  response.headers.set('Content-Security-Policy', cspDirectives.join('; '));

  // HTTPS 강제 (프로덕션 환경)
  if (process.env.NODE_ENV === 'production') {
    response.headers.set(
      'Strict-Transport-Security',
      'max-age=31536000; includeSubDomains; preload'
    );
  }
}

// 공개 경로 확인 (로그인 없이 접근 가능한 페이지)
function isPublicRoute(pathname: string): boolean {
  const publicRoutes = [
    '/', // 루트 페이지 공개 (로그인 불필요)
    '/login',
    '/signup',
    '/forgot-password',
    '/set-password',
    '/change-password',
    '/terms',
    '/privacy',
    '/api/health',
    '/api/supabase-test',
    '/_next',
    '/favicon.ico'
  ];

  // 실사관리 상세 페이지는 공개 (business/[businessName] 패턴)
  if (pathname.startsWith('/business/')) {
    return true;
  }

  return publicRoutes.some(route => pathname.startsWith(route));
}

// 정적 파일 확인
function isStaticFile(pathname: string): boolean {
  return pathname.startsWith('/_next/static/') ||
         pathname.startsWith('/img/') ||
         pathname.includes('.');
}

// CSRF 검증 제외 API 경로 (외부 호출용 - Bearer 토큰 인증)
function isCSRFExemptAPI(pathname: string): boolean {
  const exemptPaths = [
    '/api/auth/login',       // 로그인 API (CSRF 토큰 없이 호출 가능)
    '/api/subsidy-crawler',  // GitHub Actions 크롤러
    '/api/webhooks/',        // 외부 웹훅
  ];
  return exemptPaths.some(path => pathname.startsWith(path));
}

// API 경로 보호
async function protectAPIRoute(request: NextRequest): Promise<NextResponse | null> {
  // Rate Limiting 체크
  const rateLimitResult = await RateLimiter.check(request);

  if (!rateLimitResult.success) {
    console.warn(`[SECURITY] Rate limit exceeded for ${request.ip} on ${request.nextUrl.pathname}`);

    const response = new NextResponse(
      JSON.stringify({
        success: false,
        error: {
          code: 'RATE_LIMIT_EXCEEDED',
          message: '요청 한도를 초과했습니다. 잠시 후 다시 시도해주세요.'
        }
      }),
      {
        status: 429,
        headers: {
          'Content-Type': 'application/json',
          'Retry-After': '900' // 15분 후 재시도
        }
      }
    );

    // Rate Limit 헤더 추가
    if (rateLimitResult.limit) {
      response.headers.set('X-RateLimit-Limit', rateLimitResult.limit.toString());
    }
    if (rateLimitResult.remaining !== undefined) {
      response.headers.set('X-RateLimit-Remaining', rateLimitResult.remaining.toString());
    }
    if (rateLimitResult.resetTime) {
      response.headers.set('X-RateLimit-Reset', Math.ceil(rateLimitResult.resetTime / 1000).toString());
    }

    return response;
  }

  // 요청 크기 검증
  const contentLength = request.headers.get('content-length');
  if (!validateRequestSize(contentLength)) {
    console.warn(`[SECURITY] Request size too large for ${request.ip} on ${request.nextUrl.pathname}`);

    return new NextResponse(
      JSON.stringify({
        success: false,
        error: {
          code: 'REQUEST_TOO_LARGE',
          message: '요청 크기가 너무 큽니다.'
        }
      }),
      {
        status: 413,
        headers: { 'Content-Type': 'application/json' }
      }
    );
  }

  // CSRF 보호 (외부 API 호출은 제외 - Bearer 토큰으로 인증)
  if (!isCSRFExemptAPI(request.nextUrl.pathname)) {
    const csrfResult = protectCSRF(request);
    if (!csrfResult.valid) {
      console.warn(`[SECURITY] CSRF validation failed for ${request.ip} on ${request.nextUrl.pathname}`);

      return new NextResponse(
        JSON.stringify({
          success: false,
          error: {
            code: 'CSRF_TOKEN_INVALID',
            message: 'CSRF 토큰이 유효하지 않습니다.'
          }
        }),
        {
          status: 403,
          headers: { 'Content-Type': 'application/json' }
        }
      );
    }
  }

  return null; // 모든 보안 검사 통과
}

// 페이지 인증 및 권한 확인
async function checkPageAuthentication(request: NextRequest): Promise<NextResponse | null> {
  // httpOnly 쿠키에서 토큰 확인
  const token = request.cookies.get('auth_token')?.value;

  // 🔍 디버깅: 쿠키 정보 로깅
  console.log(`🔍 [MIDDLEWARE] 페이지 인증 체크 - Path: ${request.nextUrl.pathname}`, {
    hasCookie: !!token,
    cookieNames: Array.from(request.cookies.getAll().map(c => c.name)),
    userAgent: request.headers.get('user-agent')?.substring(0, 50)
  });

  if (!token) {
    // 로그인 페이지로 리다이렉트
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('redirect', request.nextUrl.pathname);

    console.warn(`[SECURITY] Unauthenticated access attempt to ${request.nextUrl.pathname} from ${request.ip}`);

    return NextResponse.redirect(loginUrl);
  }

  // JWT 토큰 검증 및 권한 확인
  try {
    const jwt = require('jsonwebtoken');
    const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-this-in-production';

    const decodedToken = jwt.verify(token, JWT_SECRET);

    // ✅ 권한 레벨 확인 추가
    const { pathname } = request.nextUrl;

    // AuthGuard를 사용하여 페이지 권한 확인
    const { AuthGuard } = require('@/lib/auth/AuthGuard');
    const authResult = await AuthGuard.checkPageAccess(pathname, {
      id: decodedToken.id,
      name: decodedToken.name,
      email: decodedToken.email,
      permission_level: decodedToken.permission_level || 1
    });

    if (!authResult.allowed) {
      // 권한 부족 시 접근 거부 페이지 또는 메인으로 리다이렉트
      const redirectUrl = new URL(authResult.redirectTo || '/login', request.url);

      console.warn(`[SECURITY] Permission denied for ${pathname} - User level: ${authResult.userLevel}, Required: ${authResult.requiredLevel}`);

      return NextResponse.redirect(redirectUrl);
    }

    // 토큰이 유효하고 권한이 충분하면 계속 진행
    return null;
  } catch (error) {
    // 토큰이 유효하지 않으면 로그인 페이지로 리다이렉트
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('redirect', request.nextUrl.pathname);

    console.warn(`[SECURITY] Invalid token for ${request.nextUrl.pathname} from ${request.ip}`);

    // 유효하지 않은 쿠키 제거
    const response = NextResponse.redirect(loginUrl);
    response.cookies.delete('auth_token');

    return response;
  }
}

// 메인 미들웨어 함수
export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // 정적 파일은 보안 헤더만 설정하고 통과
  if (isStaticFile(pathname)) {
    const response = NextResponse.next();
    setSecurityHeaders(response);
    return response;
  }

  // API 경로 보호
  if (pathname.startsWith('/api/')) {
    // 파일 프록시 API는 자체 CSP 헤더 사용 (iframe 허용)
    if (pathname.startsWith('/api/calendar/file-proxy')) {
      return NextResponse.next(); // 헤더를 추가하지 않고 그대로 통과
    }

    const protectionResult = await protectAPIRoute(request);
    if (protectionResult) {
      setSecurityHeaders(protectionResult);
      return protectionResult;
    }

    // ✅ API 보호 통과 시 여기서 종료 (페이지 인증 체크 건너뛰기)
    const response = NextResponse.next();
    setSecurityHeaders(response);
    return response;
  }

  // 일반 페이지 처리 - 인증이 필요한 페이지 확인
  if (!isPublicRoute(pathname)) {
    const authResult = await checkPageAuthentication(request);
    if (authResult) {
      setSecurityHeaders(authResult);
      return authResult;
    }
  }

  const response = NextResponse.next();

  // 보안 헤더 설정
  setSecurityHeaders(response);

  // 개발 환경에서만 보안 로그 출력
  if (process.env.NODE_ENV === 'development') {
    console.log(`[MIDDLEWARE] ${request.method} ${pathname} - ${request.ip || 'unknown'}`);
  }

  return response;
}

// 미들웨어 적용 경로 설정
export const config = {
  matcher: [
    /*
     * 다음 경로들을 제외한 모든 경로에 미들웨어 적용:
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
};