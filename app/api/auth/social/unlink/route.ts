import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { verifyToken } from '@/utils/auth';

// Force dynamic rendering for API routes
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';


export async function DELETE(request: NextRequest) {
  try {
    // JWT 토큰 검증
    const token = request.cookies.get('auth-token')?.value;
    if (!token) {
      return NextResponse.json({
        success: false,
        error: { code: 'UNAUTHORIZED', message: '로그인이 필요합니다.' }
      }, { status: 401 });
    }

    const decoded = verifyToken(token);
    if (!decoded) {
      return NextResponse.json({
        success: false,
        error: { code: 'INVALID_TOKEN', message: '유효하지 않은 토큰입니다.' }
      }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const provider = searchParams.get('provider');

    if (!provider) {
      return NextResponse.json({
        success: false,
        error: { code: 'MISSING_PROVIDER', message: '소셜 로그인 제공자를 지정해주세요.' }
      }, { status: 400 });
    }

    const userId = decoded.id;

    console.log(`🔗 [SOCIAL-UNLINK] ${provider} 연동 해제 시작:`, userId);

    // 해당 제공자의 소셜 계정 연동 해제
    const { error: unlinkError } = await supabaseAdmin
      .from('social_accounts')
      .delete()
      .eq('employee_id', userId)
      .eq('provider', provider);

    if (unlinkError) {
      console.error(`❌ [SOCIAL-UNLINK] ${provider} 연동 해제 실패:`, unlinkError);
      return NextResponse.json({
        success: false,
        error: {
          code: 'UNLINK_ERROR',
          message: `${provider} 연동 해제 중 오류가 발생했습니다.`
        }
      }, { status: 500 });
    }

    console.log(`✅ [SOCIAL-UNLINK] ${provider} 연동 해제 완료:`, userId);

    return NextResponse.json({
      success: true,
      data: {
        message: `${provider} 계정 연동이 해제되었습니다.`,
        provider: provider
      }
    });

  } catch (error) {
    console.error('❌ [SOCIAL-UNLINK] 처리 실패:', error);

    return NextResponse.json({
      success: false,
      error: {
        code: 'UNLINK_ERROR',
        message: '소셜 계정 연동 해제 중 오류가 발생했습니다.'
      }
    }, { status: 500 });
  }
}