import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    console.log('🔐 [KAKAO-LOGIN] 카카오 로그인 요청 받음');

    // 카카오 로그인 파라미터 설정
    const kakaoAuthURL = 'https://kauth.kakao.com/oauth/authorize';
    const clientId = process.env.NEXT_PUBLIC_KAKAO_CLIENT_ID || 'd429d4772afee7301d3ab0e4f903b94e';
    const redirectUri = `http://localhost:${process.env.PORT || 3003}/api/auth/social/kakao/callback`;
    const state = Math.random().toString(36).substring(2, 15);

    // 카카오 OAuth URL 생성
    const kakaoLoginUrl = new URL(kakaoAuthURL);
    kakaoLoginUrl.searchParams.set('client_id', clientId);
    kakaoLoginUrl.searchParams.set('redirect_uri', redirectUri);
    kakaoLoginUrl.searchParams.set('response_type', 'code');
    kakaoLoginUrl.searchParams.set('state', state);
    kakaoLoginUrl.searchParams.set('scope', 'profile_nickname,account_email');

    console.log('🎯 [KAKAO-LOGIN] 카카오 로그인 URL 생성:', {
      clientId: clientId.substring(0, 10) + '...',
      redirectUri,
      state
    });

    // 카카오 로그인 페이지로 리다이렉트
    return NextResponse.redirect(kakaoLoginUrl.toString());

  } catch (error) {
    console.error('❌ [KAKAO-LOGIN] 카카오 로그인 시작 오류:', error);

    const errorUrl = new URL('/', request.url);
    errorUrl.searchParams.set('error', '카카오 로그인을 시작할 수 없습니다.');
    return NextResponse.redirect(errorUrl);
  }
}