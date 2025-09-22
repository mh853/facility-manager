import { NextRequest, NextResponse } from 'next/server';

// Force dynamic rendering for API routes
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';


export async function POST(request: NextRequest) {
  try {
    console.log('✅ [AUTH] 로그아웃 요청 처리');

    // 응답 생성
    const response = NextResponse.json({
      success: true,
      data: {
        message: '성공적으로 로그아웃되었습니다.'
      },
      timestamp: new Date().toISOString()
    });

    // httpOnly 쿠키 삭제
    response.cookies.set('auth_token', '', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 0, // 즉시 만료
      path: '/'
    });

    console.log('🍪 [AUTH] 인증 쿠키 삭제 완료');

    return response;

  } catch (error) {
    console.error('❌ [AUTH] 로그아웃 오류:', error);
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: '로그아웃 처리 중 오류가 발생했습니다.'
        }
      },
      { status: 500 }
    );
  }
}