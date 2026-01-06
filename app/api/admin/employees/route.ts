import { NextRequest, NextResponse } from 'next/server';
import { queryAll } from '@/lib/supabase-direct';
import { verifyTokenString } from '@/utils/auth';

// Force dynamic rendering for API routes
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  try {
    // JWT 토큰 검증
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({
        success: false,
        message: '인증이 필요합니다.'
      }, { status: 401 });
    }

    const token = authHeader.substring(7);
    const decoded = verifyTokenString(token);

    if (!decoded) {
      return NextResponse.json({
        success: false,
        message: '유효하지 않은 토큰입니다.'
      }, { status: 401 });
    }

    // 토큰에서 사용자 정보 추출 (userId, id 둘 다 지원)
    const userId = decoded.userId || decoded.id;
    const permissionLevel = decoded.permissionLevel || decoded.permission_level;

    console.log('🔍 [EMPLOYEES] 토큰 검증:', { userId, permissionLevel });

    // 관리자 권한 확인 (레벨 3 이상)
    if (!permissionLevel || permissionLevel < 3) {
      console.log('❌ [EMPLOYEES] 권한 부족:', { permissionLevel });
      return NextResponse.json({
        success: false,
        message: '관리자 권한이 필요합니다.'
      }, { status: 403 });
    }

    console.log('✅ [EMPLOYEES] 관리자 권한 확인 완료');

    // 직원 목록 조회 - Direct PostgreSQL
    const employees = await queryAll(
      `SELECT * FROM employees
       ORDER BY created_at DESC`
    )

    if (!employees) {
      console.error('❌ [EMPLOYEES] 직원 목록 조회 오류');
      return NextResponse.json({
        success: false,
        message: '직원 목록 조회에 실패했습니다.'
      }, { status: 500 });
    }

    console.log(`📊 [EMPLOYEES] 조회 완료: ${employees?.length || 0}명`);

    return NextResponse.json({
      success: true,
      data: {
        employees: employees || []
      }
    });

  } catch (error) {
    console.error('❌ [EMPLOYEES] API 오류:', error);
    return NextResponse.json({
      success: false,
      message: '서버 오류가 발생했습니다.'
    }, { status: 500 });
  }
}