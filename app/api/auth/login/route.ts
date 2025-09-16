import { NextRequest, NextResponse } from 'next/server';
import { LoginRequest, AuthResponse } from '@/types';
import { createToken, findUserByEmail, AUTH_COOKIE_OPTIONS } from '@/utils/auth';

export async function POST(request: NextRequest) {
  try {
    const body: LoginRequest = await request.json();
    const { provider, code } = body;

    if (!provider || !code) {
      return NextResponse.json(
        { success: false, error: '필수 정보가 누락되었습니다.' },
        { status: 400 }
      );
    }

    // 실제 환경에서는 각 소셜 제공자의 API를 호출하여 사용자 정보를 가져옴
    // 여기서는 데모용으로 간단한 로직 사용
    let userEmail: string;

    switch (provider) {
      case 'kakao':
        // 실제로는 카카오 API로 토큰 교환 후 사용자 정보 가져오기
        userEmail = 'admin@facility.blueon-iot.com'; // 데모용
        break;
      case 'naver':
        // 실제로는 네이버 API로 토큰 교환 후 사용자 정보 가져오기
        userEmail = 'inspector1@facility.blueon-iot.com'; // 데모용
        break;
      case 'google':
        // 실제로는 구글 API로 토큰 교환 후 사용자 정보 가져오기
        userEmail = 'inspector2@facility.blueon-iot.com'; // 데모용
        break;
      default:
        return NextResponse.json(
          { success: false, error: '지원하지 않는 로그인 제공자입니다.' },
          { status: 400 }
        );
    }

    // 사용자 조회
    const user = findUserByEmail(userEmail);

    if (!user) {
      return NextResponse.json(
        { success: false, error: '등록되지 않은 사용자입니다. 관리자에게 문의하세요.' },
        { status: 401 }
      );
    }

    if (!user.isActive) {
      return NextResponse.json(
        { success: false, error: '비활성화된 계정입니다. 관리자에게 문의하세요.' },
        { status: 401 }
      );
    }

    // 토큰 생성
    const token = await createToken(user);

    // 사용자 정보에서 민감한 정보 제거
    const { isActive, ...safeUser } = user;

    // 쿠키에 토큰 설정
    const response = NextResponse.json({
      success: true,
      token,
      user: safeUser,
    } as AuthResponse);

    response.cookies.set('auth-token', token, AUTH_COOKIE_OPTIONS);

    return response;

  } catch (error) {
    console.error('Login error:', error);
    return NextResponse.json(
      { success: false, error: '로그인 처리 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}