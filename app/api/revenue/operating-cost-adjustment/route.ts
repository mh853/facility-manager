import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { verifyTokenString } from '@/utils/auth';
import { z } from 'zod';

// Force dynamic rendering for API routes
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// Zod 스키마 정의
const AdjustmentSchema = z.object({
  business_id: z.string().uuid('유효한 UUID가 필요합니다'),
  adjustment_amount: z.number().min(0, '조정 금액은 0 이상이어야 합니다'),
  adjustment_reason: z.string().optional(),
  adjustment_type: z.enum(['add', 'subtract'], {
    errorMap: () => ({ message: "조정 타입은 'add' 또는 'subtract'만 가능합니다" })
  })
});

/**
 * GET - 영업비용 조정 값 조회
 * 쿼리 파라미터: business_id (필수)
 */
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

    const userId = decoded.userId || decoded.id;
    if (!userId) {
      return NextResponse.json({
        success: false,
        message: '토큰에 사용자 정보가 없습니다.'
      }, { status: 401 });
    }

    // 사용자 권한 확인
    const { data: user, error: userError } = await supabaseAdmin
      .from('employees')
      .select('id, permission_level')
      .eq('id', userId)
      .eq('is_active', true)
      .single();

    if (userError || !user) {
      return NextResponse.json({
        success: false,
        message: '사용자를 찾을 수 없습니다.'
      }, { status: 401 });
    }

    // 권한 2 이상 필요 (조회)
    if (user.permission_level < 2) {
      return NextResponse.json({
        success: false,
        message: '매출 조회 권한이 필요합니다.'
      }, { status: 403 });
    }

    // business_id 파라미터 확인
    const url = new URL(request.url);
    const businessId = url.searchParams.get('business_id');

    if (!businessId) {
      return NextResponse.json({
        success: false,
        message: 'business_id 파라미터가 필요합니다.'
      }, { status: 400 });
    }

    // 조정 값 조회
    const { data: adjustment, error } = await supabaseAdmin
      .from('operating_cost_adjustments')
      .select('*')
      .eq('business_id', businessId)
      .single();

    if (error && error.code !== 'PGRST116') {
      console.error('영업비용 조정 조회 오류:', error);
      return NextResponse.json({
        success: false,
        message: '조정 값 조회에 실패했습니다.'
      }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      data: adjustment || null
    });

  } catch (error) {
    console.error('영업비용 조정 GET 오류:', error);
    return NextResponse.json({
      success: false,
      message: '서버 오류가 발생했습니다.'
    }, { status: 500 });
  }
}

/**
 * POST - 영업비용 조정 값 생성
 */
export async function POST(request: NextRequest) {
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

    const userId = decoded.userId || decoded.id;
    if (!userId) {
      return NextResponse.json({
        success: false,
        message: '토큰에 사용자 정보가 없습니다.'
      }, { status: 401 });
    }

    // 사용자 권한 확인
    const { data: user, error: userError } = await supabaseAdmin
      .from('employees')
      .select('id, permission_level')
      .eq('id', userId)
      .eq('is_active', true)
      .single();

    if (userError || !user) {
      return NextResponse.json({
        success: false,
        message: '사용자를 찾을 수 없습니다.'
      }, { status: 401 });
    }

    // 권한 3 이상 필요 (생성/수정)
    if (user.permission_level < 3) {
      return NextResponse.json({
        success: false,
        message: '영업비용 조정 권한이 필요합니다.'
      }, { status: 403 });
    }

    // 요청 바디 검증
    const body = await request.json();
    const validationResult = AdjustmentSchema.safeParse(body);

    if (!validationResult.success) {
      return NextResponse.json({
        success: false,
        message: '입력 데이터 검증 실패',
        errors: validationResult.error.errors
      }, { status: 400 });
    }

    const { business_id, adjustment_amount, adjustment_reason, adjustment_type } = validationResult.data;

    // 조정 값 생성
    const { data: adjustment, error } = await supabaseAdmin
      .from('operating_cost_adjustments')
      .insert({
        business_id,
        adjustment_amount,
        adjustment_reason,
        adjustment_type,
        created_by: userId,
        updated_by: userId
      })
      .select()
      .single();

    if (error) {
      console.error('영업비용 조정 생성 오류:', error);

      if (error.code === '23505') {
        return NextResponse.json({
          success: false,
          message: '해당 사업장에 이미 조정 값이 존재합니다. PUT 메서드를 사용하여 수정하세요.'
        }, { status: 409 });
      }

      return NextResponse.json({
        success: false,
        message: '조정 값 생성에 실패했습니다.'
      }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      data: adjustment,
      message: '영업비용 조정이 생성되었습니다.'
    }, { status: 201 });

  } catch (error) {
    console.error('영업비용 조정 POST 오류:', error);
    return NextResponse.json({
      success: false,
      message: '서버 오류가 발생했습니다.'
    }, { status: 500 });
  }
}

/**
 * PUT - 영업비용 조정 값 수정
 */
export async function PUT(request: NextRequest) {
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

    const userId = decoded.userId || decoded.id;
    if (!userId) {
      return NextResponse.json({
        success: false,
        message: '토큰에 사용자 정보가 없습니다.'
      }, { status: 401 });
    }

    // 사용자 권한 확인
    const { data: user, error: userError } = await supabaseAdmin
      .from('employees')
      .select('id, permission_level')
      .eq('id', userId)
      .eq('is_active', true)
      .single();

    if (userError || !user) {
      return NextResponse.json({
        success: false,
        message: '사용자를 찾을 수 없습니다.'
      }, { status: 401 });
    }

    // 권한 3 이상 필요 (생성/수정)
    if (user.permission_level < 3) {
      return NextResponse.json({
        success: false,
        message: '영업비용 조정 권한이 필요합니다.'
      }, { status: 403 });
    }

    // 요청 바디 검증
    const body = await request.json();
    const validationResult = AdjustmentSchema.safeParse(body);

    if (!validationResult.success) {
      return NextResponse.json({
        success: false,
        message: '입력 데이터 검증 실패',
        errors: validationResult.error.errors
      }, { status: 400 });
    }

    const { business_id, adjustment_amount, adjustment_reason, adjustment_type } = validationResult.data;

    // 기존 조정 값이 있는지 먼저 확인
    const { data: existingAdjustment, error: checkError } = await supabaseAdmin
      .from('operating_cost_adjustments')
      .select('id')
      .eq('business_id', business_id)
      .single();

    if (checkError && checkError.code !== 'PGRST116') {
      console.error('영업비용 조정 조회 오류:', checkError);
      return NextResponse.json({
        success: false,
        message: '기존 조정 값 확인에 실패했습니다.'
      }, { status: 500 });
    }

    if (!existingAdjustment) {
      return NextResponse.json({
        success: false,
        message: '수정할 조정 값이 없습니다. 새로 생성해주세요.'
      }, { status: 404 });
    }

    // 조정 값 수정
    const { data: adjustment, error } = await supabaseAdmin
      .from('operating_cost_adjustments')
      .update({
        adjustment_amount,
        adjustment_reason,
        adjustment_type,
        updated_by: userId,
        updated_at: new Date().toISOString()
      })
      .eq('business_id', business_id)
      .select()
      .single();

    if (error) {
      console.error('영업비용 조정 수정 오류:', error);
      return NextResponse.json({
        success: false,
        message: '조정 값 수정에 실패했습니다.',
        error: error.message
      }, { status: 500 });
    }

    if (!adjustment) {
      return NextResponse.json({
        success: false,
        message: '조정 값 수정 후 데이터를 찾을 수 없습니다.'
      }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      data: adjustment,
      message: '영업비용 조정이 수정되었습니다.'
    });

  } catch (error) {
    console.error('영업비용 조정 PUT 오류:', error);
    return NextResponse.json({
      success: false,
      message: '서버 오류가 발생했습니다.'
    }, { status: 500 });
  }
}

/**
 * DELETE - 영업비용 조정 값 삭제
 */
export async function DELETE(request: NextRequest) {
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

    const userId = decoded.userId || decoded.id;
    if (!userId) {
      return NextResponse.json({
        success: false,
        message: '토큰에 사용자 정보가 없습니다.'
      }, { status: 401 });
    }

    // 사용자 권한 확인
    const { data: user, error: userError } = await supabaseAdmin
      .from('employees')
      .select('id, permission_level')
      .eq('id', userId)
      .eq('is_active', true)
      .single();

    if (userError || !user) {
      return NextResponse.json({
        success: false,
        message: '사용자를 찾을 수 없습니다.'
      }, { status: 401 });
    }

    // 권한 3 이상 필요 (삭제)
    if (user.permission_level < 3) {
      return NextResponse.json({
        success: false,
        message: '영업비용 조정 삭제 권한이 필요합니다.'
      }, { status: 403 });
    }

    // business_id 파라미터 확인
    const url = new URL(request.url);
    const businessId = url.searchParams.get('business_id');

    if (!businessId) {
      return NextResponse.json({
        success: false,
        message: 'business_id 파라미터가 필요합니다.'
      }, { status: 400 });
    }

    // 삭제할 조정 값이 있는지 먼저 확인
    const { data: existingAdjustment, error: checkError } = await supabaseAdmin
      .from('operating_cost_adjustments')
      .select('id')
      .eq('business_id', businessId)
      .single();

    if (checkError && checkError.code !== 'PGRST116') {
      console.error('영업비용 조정 조회 오류:', checkError);
      return NextResponse.json({
        success: false,
        message: '조정 값 확인에 실패했습니다.'
      }, { status: 500 });
    }

    if (!existingAdjustment) {
      return NextResponse.json({
        success: false,
        message: '삭제할 조정 값이 없습니다.'
      }, { status: 404 });
    }

    // 조정 값 삭제
    const { error } = await supabaseAdmin
      .from('operating_cost_adjustments')
      .delete()
      .eq('business_id', businessId);

    if (error) {
      console.error('영업비용 조정 삭제 오류:', error);
      return NextResponse.json({
        success: false,
        message: '조정 값 삭제에 실패했습니다.',
        error: error.message
      }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      message: '영업비용 조정이 삭제되었습니다.'
    });

  } catch (error) {
    console.error('영업비용 조정 DELETE 오류:', error);
    return NextResponse.json({
      success: false,
      message: '서버 오류가 발생했습니다.'
    }, { status: 500 });
  }
}
