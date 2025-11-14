// app/api/auth/me/route.ts - 현재 로그인한 사용자 정보 조회 API
import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@/utils/auth';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * GET /api/auth/me - 현재 로그인한 사용자 정보 반환
 */
export async function GET(request: NextRequest) {
  try {
    // ✅ 쿠키 우선, Authorization 헤더 폴백으로 토큰 가져오기 (모바일 호환성)
    let token = request.cookies.get('auth_token')?.value;

    // 쿠키에 토큰이 없으면 Authorization 헤더 확인 (localStorage 사용 케이스)
    if (!token) {
      const authHeader = request.headers.get('authorization');
      if (authHeader?.startsWith('Bearer ')) {
        token = authHeader.substring(7);
      }
    }

    if (!token) {
      return NextResponse.json(
        { success: false, error: '인증 토큰이 없습니다.' },
        { status: 401 }
      );
    }

    // 토큰 검증
    const tokenPayload = await verifyToken(token);

    if (!tokenPayload) {
      return NextResponse.json(
        { success: false, error: '유효하지 않은 토큰입니다.' },
        { status: 401 }
      );
    }

    // 사용자 정보 반환
    return NextResponse.json({
      success: true,
      user: {
        id: tokenPayload.id,
        name: tokenPayload.name,
        email: tokenPayload.email,
        permission_level: tokenPayload.permission_level || 1
      }
    });

  } catch (error) {
    console.error('[AUTH-ME] Error:', error);
    return NextResponse.json(
      { success: false, error: '서버 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
