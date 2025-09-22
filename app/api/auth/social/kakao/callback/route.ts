import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';

// Force dynamic rendering for API routes
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';


export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const code = searchParams.get('code');
    const error = searchParams.get('error');
    const state = searchParams.get('state');

    console.log('🔄 [KAKAO-CALLBACK] 콜백 처리 시작:', { code: code?.substring(0, 10), error, state });

    // 오류 처리
    if (error) {
      console.error('🔴 [KAKAO-CALLBACK] 카카오 로그인 오류:', error);
      return NextResponse.redirect(new URL('/login?error=kakao_login_failed', request.url));
    }

    if (!code) {
      console.error('🔴 [KAKAO-CALLBACK] 인증 코드가 없음');
      return NextResponse.redirect(new URL('/login?error=no_code', request.url));
    }

    // 카카오 API를 통해 토큰 및 사용자 정보 처리
    const response = await fetch(new URL('/api/auth/social/kakao', request.url), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ code })
    });

    const data = await response.json();

    if (data.success) {
      console.log('✅ [KAKAO-CALLBACK] 로그인 성공:', data.data.user?.name);

      // 토큰을 쿠키에 저장
      if (data.data.token) {
        const cookieStore = cookies();
        cookieStore.set('facility_manager_token', data.data.token, {
          httpOnly: true,
          secure: process.env.NODE_ENV === 'production',
          sameSite: 'lax',
          maxAge: 365 * 24 * 60 * 60, // 1년
          path: '/'
        });
      }

      // 로그인 성공 후 어드민 페이지로 리다이렉트하면서 토큰을 URL에 포함
      const redirectUrl = new URL('/admin', request.url);
      redirectUrl.searchParams.set('token', data.data.token);
      return NextResponse.redirect(redirectUrl);
    } else {
      console.error('🔴 [KAKAO-CALLBACK] 로그인 처리 실패:', data.error);
      const errorParam = encodeURIComponent(data.error?.message || '카카오 로그인 중 오류가 발생했습니다.');
      return NextResponse.redirect(new URL(`/login?error=${errorParam}`, request.url));
    }

  } catch (error: any) {
    console.error('🔴 [KAKAO-CALLBACK] 콜백 처리 오류:', error);
    return NextResponse.redirect(new URL('/login?error=callback_error', request.url));
  }
}