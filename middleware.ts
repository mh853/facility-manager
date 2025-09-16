import { NextRequest, NextResponse } from 'next/server';
import { RateLimiter } from '@/lib/security/rate-limiter';
import { protectCSRF } from '@/lib/security/csrf-protection';
import { validateRequestSize } from '@/lib/security/input-validation';

// 보안 헤더 설정
function setSecurityHeaders(response: NextResponse): void {
  // XSS 보호
  response.headers.set('X-XSS-Protection', '1; mode=block');

  // 클릭재킹 방지
  response.headers.set('X-Frame-Options', 'DENY');

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
    "connect-src 'self' https://*.supabase.co wss://*.supabase.co", // Supabase 연결
    "font-src 'self' data:",
    "object-src 'none'",
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

// 공개 경로 확인
function isPublicRoute(pathname: string): boolean {
  const publicRoutes = [
    '/login',
    '/api/health',
    '/api/supabase-test',
    '/_next',
    '/favicon.ico'
  ];

  return publicRoutes.some(route => pathname.startsWith(route));
}

// 정적 파일 확인
function isStaticFile(pathname: string): boolean {
  return pathname.startsWith('/_next/static/') ||
         pathname.startsWith('/img/') ||
         pathname.includes('.');
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

  // CSRF 보호
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

  return null; // 모든 보안 검사 통과
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
    const protectionResult = await protectAPIRoute(request);
    if (protectionResult) {
      setSecurityHeaders(protectionResult);
      return protectionResult;
    }
  }

  // 일반 페이지 처리
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