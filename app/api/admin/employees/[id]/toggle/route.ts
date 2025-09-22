import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { verifyTokenString } from '@/utils/auth';

// Force dynamic rendering for API routes
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// 사용자 활성화/비활성화 토글
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
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

    console.log('🔍 [TOGGLE] 토큰 검증:', { userId, permissionLevel, decoded });

    // 관리자 권한 확인 (레벨 3 이상)
    if (!permissionLevel || permissionLevel < 3) {
      console.log('❌ [TOGGLE] 권한 부족:', { permissionLevel });
      return NextResponse.json({
        success: false,
        message: '관리자 권한이 필요합니다.'
      }, { status: 403 });
    }

    // 자기 자신을 비활성화하는 것 방지
    if (userId === params.id) {
      return NextResponse.json({
        success: false,
        message: '자기 자신의 계정은 비활성화할 수 없습니다.'
      }, { status: 400 });
    }

    const body = await request.json();
    const { isActive } = body;

    // 사용자 존재 확인
    const { data: employee, error: findError } = await supabaseAdmin
      .from('employees')
      .select('id, name, email, is_active')
      .eq('id', params.id)
      .single();

    if (findError || !employee) {
      console.error('❌ [TOGGLE] 사용자 찾기 실패:', findError);
      return NextResponse.json({
        success: false,
        message: '사용자를 찾을 수 없습니다.'
      }, { status: 404 });
    }

    // 사용자 상태 업데이트
    const { error: updateError } = await supabaseAdmin
      .from('employees')
      .update({
        is_active: isActive,
        is_deleted: !isActive // 비활성화시 삭제 플래그도 설정
      })
      .eq('id', params.id);

    if (updateError) {
      console.error('❌ [TOGGLE] 사용자 상태 업데이트 오류:', updateError);
      return NextResponse.json({
        success: false,
        message: `사용자 상태 변경에 실패했습니다: ${updateError.message}`
      }, { status: 500 });
    }

    console.log('✅ [TOGGLE] 사용자 상태 변경 완료:', {
      userId: params.id,
      name: employee.name,
      isActive,
      adminUserId: userId
    });

    return NextResponse.json({
      success: true,
      message: `${employee.name}님의 계정이 ${isActive ? '활성화' : '비활성화'}되었습니다.`
    });

  } catch (error) {
    console.error('❌ [TOGGLE] API 오류:', error);
    return NextResponse.json({
      success: false,
      message: '서버 오류가 발생했습니다.'
    }, { status: 500 });
  }
}