import { NextRequest, NextResponse } from 'next/server';
import { verifyToken, createToken, findUserByEmail, AUTH_COOKIE_OPTIONS } from '@/utils/auth';

export async function POST(request: NextRequest) {
  try {
    const token = request.cookies.get('auth-token')?.value;

    if (!token) {
      return NextResponse.json(
        { success: false, error: '인증 토큰이 없습니다.' },
        { status: 401 }
      );
    }

    const payload = await verifyToken(token);

    if (!payload) {
      return NextResponse.json(
        { success: false, error: '유효하지 않은 토큰입니다.' },
        { status: 401 }
      );
    }

    // 사용자 정보 재확인
    const user = findUserByEmail(payload.email);

    if (!user || !user.isActive) {
      return NextResponse.json(
        { success: false, error: '사용자를 찾을 수 없거나 비활성화된 계정입니다.' },
        { status: 401 }
      );
    }

    // 새 토큰 생성
    const newToken = await createToken(user);

    // 응답 생성
    const response = NextResponse.json({
      success: true,
      token: newToken,
    });

    // 새 토큰을 쿠키에 설정
    response.cookies.set('auth-token', newToken, AUTH_COOKIE_OPTIONS);

    return response;

  } catch (error) {
    console.error('Token refresh error:', error);
    return NextResponse.json(
      { success: false, error: '토큰 갱신 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}