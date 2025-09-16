import { NextRequest, NextResponse } from 'next/server';
import { verifyToken, findUserByEmail } from '@/utils/auth';

export async function GET(request: NextRequest) {
  try {
    const token = request.cookies.get('auth-token')?.value;

    if (!token) {
      return NextResponse.json(
        { error: '인증 토큰이 없습니다.' },
        { status: 401 }
      );
    }

    const payload = await verifyToken(token);

    if (!payload) {
      return NextResponse.json(
        { error: '유효하지 않은 토큰입니다.' },
        { status: 401 }
      );
    }

    // 최신 사용자 정보 조회
    const user = findUserByEmail(payload.email);

    if (!user || !user.isActive) {
      return NextResponse.json(
        { error: '사용자를 찾을 수 없거나 비활성화된 계정입니다.' },
        { status: 401 }
      );
    }

    // 민감한 정보 제거
    const { isActive, ...safeUser } = user;

    return NextResponse.json({ user: safeUser });

  } catch (error) {
    console.error('Get user error:', error);
    return NextResponse.json(
      { error: '사용자 정보 조회 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}