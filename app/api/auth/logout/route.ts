import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    console.log('✅ [AUTH] 로그아웃 요청 처리');

    // JWT는 stateless이므로 서버에서 별도 처리 없음
    // 클라이언트에서 토큰을 localStorage/sessionStorage에서 제거

    return NextResponse.json({
      success: true,
      data: {
        message: '성공적으로 로그아웃되었습니다.'
      },
      timestamp: new Date().toISOString()
    });

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