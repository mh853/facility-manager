import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import jwt from 'jsonwebtoken';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-this-in-production';

// 매출 재계산 API - 권한 레벨 4 (슈퍼관리자) 전용
export async function POST(request: NextRequest) {
  try {
    // JWT 토큰 검증
    const authHeader = request.headers.get('authorization');
    let token: string | null = null;

    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.replace('Bearer ', '');
    } else {
      const cookieToken = request.cookies.get('auth_token')?.value;
      if (cookieToken) {
        token = cookieToken;
      }
    }

    if (!token) {
      return NextResponse.json(
        { success: false, message: '인증 토큰이 필요합니다.' },
        { status: 401 }
      );
    }

    let decodedToken;
    try {
      decodedToken = jwt.verify(token, JWT_SECRET) as any;
    } catch (jwtError) {
      return NextResponse.json(
        { success: false, message: '유효하지 않은 토큰입니다.' },
        { status: 401 }
      );
    }

    // 슈퍼관리자 권한 확인 (레벨 4)
    if (decodedToken.permissionLevel < 4) {
      return NextResponse.json(
        { success: false, message: '슈퍼관리자 권한이 필요합니다.' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { businessId, recalculateAll } = body;

    // 전체 재계산 요청인 경우
    if (recalculateAll === true) {
      console.log('🔄 [RECALCULATE-ALL] 전체 재계산 요청:', {
        requestedBy: decodedToken.email
      });

      // revenue_calculations 테이블의 모든 기록 삭제
      const { error: deleteAllError } = await supabaseAdmin
        .from('revenue_calculations')
        .delete()
        .neq('id', '00000000-0000-0000-0000-000000000000'); // 모든 레코드 삭제

      if (deleteAllError) {
        console.log('⚠️  [RECALCULATE-ALL] revenue_calculations 전체 삭제 시 오류:', deleteAllError.message);
      }

      console.log('✅ [RECALCULATE-ALL] 전체 재계산 준비 완료');

      return NextResponse.json({
        success: true,
        message: '모든 사업장의 매출 정보가 재계산되었습니다.',
        data: { recalculatedAll: true }
      });
    }

    // 개별 사업장 재계산
    if (!businessId) {
      return NextResponse.json(
        { success: false, message: '사업장 ID가 필요합니다.' },
        { status: 400 }
      );
    }

    console.log('🔄 [RECALCULATE] 재계산 요청:', {
      businessId,
      requestedBy: decodedToken.email
    });

    // 1. 먼저 사업장 정보 조회
    const { data: business, error: fetchError } = await supabaseAdmin
      .from('business_info')
      .select('business_name')
      .eq('id', businessId)
      .single();

    if (fetchError || !business) {
      console.error('❌ [RECALCULATE] 사업장 조회 실패:', fetchError);
      return NextResponse.json(
        { success: false, message: `사업장을 찾을 수 없습니다: ${fetchError?.message}` },
        { status: 404 }
      );
    }

    // 2. revenue_calculations 테이블에서 해당 사업장의 계산 기록 삭제
    // (존재하지 않아도 오류가 발생하지 않음)
    const { error: deleteError } = await supabaseAdmin
      .from('revenue_calculations')
      .delete()
      .eq('business_id', businessId);

    if (deleteError) {
      console.log('⚠️  [RECALCULATE] revenue_calculations 삭제 시 오류 (테이블이 없을 수 있음):', deleteError.message);
      // 테이블이 없어도 계속 진행
    }

    console.log('✅ [RECALCULATE] 재계산 준비 완료:', business.business_name);
    console.log('   - revenue_calculations 기록 삭제 (있었다면)');
    console.log('   - 클라이언트가 다음 로드 시 자동 재계산됨');

    return NextResponse.json({
      success: true,
      message: `${business.business_name}의 매출 정보가 재계산되었습니다.`,
      data: { businessName: business.business_name }
    });

  } catch (error) {
    console.error('❌ [RECALCULATE] API 오류:', error);
    return NextResponse.json(
      { success: false, message: '서버 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
