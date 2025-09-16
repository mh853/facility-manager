import { NextRequest, NextResponse } from 'next/server';
import { createToken, findUserByEmail, AUTH_COOKIE_OPTIONS } from '@/utils/auth';

export async function GET(
  request: NextRequest,
  { params }: { params: { provider: string } }
) {
  try {
    const { provider } = params;
    const searchParams = request.nextUrl.searchParams;
    const code = searchParams.get('code');
    const state = searchParams.get('state');
    const error = searchParams.get('error');

    // 오류 처리
    if (error) {
      const errorUrl = new URL('/', request.url);
      errorUrl.searchParams.set('error', '소셜 로그인이 취소되었습니다.');
      return NextResponse.redirect(errorUrl);
    }

    if (!code) {
      const errorUrl = new URL('/', request.url);
      errorUrl.searchParams.set('error', '인증 코드가 없습니다.');
      return NextResponse.redirect(errorUrl);
    }

    // 실제 환경에서는 각 소셜 제공자의 API를 사용하여 토큰 교환
    // 여기서는 데모용으로 간단한 로직 사용
    let userEmail: string;

    switch (provider) {
      case 'kakao':
        // 실제로는 카카오 토큰 API 호출
        userEmail = 'admin@facility.blueon-iot.com';
        break;
      case 'naver':
        // 실제로는 네이버 토큰 API 호출
        userEmail = 'inspector1@facility.blueon-iot.com';
        break;
      case 'google':
        // 실제로는 구글 토큰 API 호출
        userEmail = 'inspector2@facility.blueon-iot.com';
        break;
      default:
        const errorUrl = new URL('/', request.url);
        errorUrl.searchParams.set('error', '지원하지 않는 로그인 제공자입니다.');
        return NextResponse.redirect(errorUrl);
    }

    // 사용자 조회
    const user = findUserByEmail(userEmail);

    if (!user) {
      const errorUrl = new URL('/', request.url);
      errorUrl.searchParams.set('error', '등록되지 않은 사용자입니다. 관리자에게 문의하세요.');
      return NextResponse.redirect(errorUrl);
    }

    if (!user.isActive) {
      const errorUrl = new URL('/', request.url);
      errorUrl.searchParams.set('error', '비활성화된 계정입니다. 관리자에게 문의하세요.');
      return NextResponse.redirect(errorUrl);
    }

    // 토큰 생성
    const token = await createToken(user);

    // 로그인 성공 후 리다이렉트
    const successUrl = new URL('/', request.url);
    successUrl.searchParams.set('login', 'success');

    const response = NextResponse.redirect(successUrl);
    response.cookies.set('auth-token', token, AUTH_COOKIE_OPTIONS);

    return response;

  } catch (error) {
    console.error('Social login callback error:', error);
    const errorUrl = new URL('/', request.url);
    errorUrl.searchParams.set('error', '로그인 처리 중 오류가 발생했습니다.');
    return NextResponse.redirect(errorUrl);
  }
}