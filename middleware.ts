import { NextRequest, NextResponse } from 'next/server';

// 간단한 미들웨어로 임시 수정 (디버깅용)
export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // 정적 파일은 그대로 통과
  if (pathname.startsWith('/_next/') || pathname.includes('.')) {
    return NextResponse.next();
  }

  console.log(`[MIDDLEWARE] ${request.method} ${pathname}`);

  // 일반 응답
  const response = NextResponse.next();

  // 기본 보안 헤더만 설정
  response.headers.set('X-Frame-Options', 'DENY');
  response.headers.set('X-Content-Type-Options', 'nosniff');

  return response;
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
};