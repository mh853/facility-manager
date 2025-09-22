import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { verifyTokenString } from '@/utils/auth';

// Force dynamic rendering for API routes
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';


// 정책 수정
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // 관리자 권한 확인
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({
        success: false,
        error: { code: 'UNAUTHORIZED', message: '인증이 필요합니다.' }
      }, { status: 401 });
    }

    const token = authHeader.substring(7);
    const decoded = verifyTokenString(token);

    if (!decoded) {
      return NextResponse.json({
        success: false,
        error: { code: 'INVALID_TOKEN', message: '유효하지 않은 토큰입니다.' }
      }, { status: 401 });
    }

    // 관리자 권한 확인
    const { data: admin } = await supabaseAdmin
      .from('employees')
      .select('permission_level, name')
      .eq('id', decoded.id)
      .eq('is_active', true)
      .single();

    if (!admin || admin.permission_level < 3) {
      return NextResponse.json({
        success: false,
        error: { code: 'FORBIDDEN', message: '관리자 권한이 필요합니다.' }
      }, { status: 403 });
    }

    const policyId = params.id;
    const body = await request.json();
    const {
      auto_approve,
      default_permission_level,
      default_department,
      description,
      is_active
    } = body;

    // 기존 정책 확인
    const { data: existingPolicy, error: fetchError } = await supabaseAdmin
      .from('social_auth_policies')
      .select('*')
      .eq('id', policyId)
      .single();

    if (fetchError || !existingPolicy) {
      return NextResponse.json({
        success: false,
        error: { code: 'NOT_FOUND', message: '정책을 찾을 수 없습니다.' }
      }, { status: 404 });
    }

    // 업데이트할 필드만 준비
    const updateData: any = {
      updated_at: new Date().toISOString(),
      updated_by: admin.name
    };

    if (typeof auto_approve === 'boolean') {
      updateData.auto_approve = auto_approve;
    }

    if (default_permission_level !== undefined) {
      if (default_permission_level < 1 || default_permission_level > 3) {
        return NextResponse.json({
          success: false,
          error: { code: 'INVALID_PERMISSION', message: '권한 레벨은 1-3 사이여야 합니다.' }
        }, { status: 400 });
      }
      updateData.default_permission_level = default_permission_level;
    }

    if (default_department !== undefined) {
      updateData.default_department = default_department;
    }

    if (description !== undefined) {
      updateData.description = description;
    }

    if (typeof is_active === 'boolean') {
      updateData.is_active = is_active;
    }

    // 정책 업데이트
    const { data: updatedPolicy, error: updateError } = await supabaseAdmin
      .from('social_auth_policies')
      .update(updateData)
      .eq('id', policyId)
      .select()
      .single();

    if (updateError) {
      throw updateError;
    }

    console.log('✅ [ADMIN-POLICIES] 정책 수정 완료:', {
      policyId,
      domain: existingPolicy.email_domain,
      updatedBy: admin.name
    });

    return NextResponse.json({
      success: true,
      data: {
        message: '정책이 성공적으로 수정되었습니다.',
        policy: updatedPolicy
      }
    });

  } catch (error) {
    console.error('❌ [ADMIN-POLICIES] 정책 수정 실패:', error);
    return NextResponse.json({
      success: false,
      error: {
        code: 'UPDATE_ERROR',
        message: '정책 수정에 실패했습니다.'
      }
    }, { status: 500 });
  }
}

// 정책 삭제
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // 관리자 권한 확인
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({
        success: false,
        error: { code: 'UNAUTHORIZED', message: '인증이 필요합니다.' }
      }, { status: 401 });
    }

    const token = authHeader.substring(7);
    const decoded = verifyTokenString(token);

    if (!decoded) {
      return NextResponse.json({
        success: false,
        error: { code: 'INVALID_TOKEN', message: '유효하지 않은 토큰입니다.' }
      }, { status: 401 });
    }

    // 관리자 권한 확인
    const { data: admin } = await supabaseAdmin
      .from('employees')
      .select('permission_level, name')
      .eq('id', decoded.id)
      .eq('is_active', true)
      .single();

    if (!admin || admin.permission_level < 3) {
      return NextResponse.json({
        success: false,
        error: { code: 'FORBIDDEN', message: '관리자 권한이 필요합니다.' }
      }, { status: 403 });
    }

    const policyId = params.id;

    // 기존 정책 확인
    const { data: existingPolicy, error: fetchError } = await supabaseAdmin
      .from('social_auth_policies')
      .select('*')
      .eq('id', policyId)
      .single();

    if (fetchError || !existingPolicy) {
      return NextResponse.json({
        success: false,
        error: { code: 'NOT_FOUND', message: '정책을 찾을 수 없습니다.' }
      }, { status: 404 });
    }

    // 정책 삭제
    const { error: deleteError } = await supabaseAdmin
      .from('social_auth_policies')
      .delete()
      .eq('id', policyId);

    if (deleteError) {
      throw deleteError;
    }

    console.log('✅ [ADMIN-POLICIES] 정책 삭제 완료:', {
      policyId,
      domain: existingPolicy.email_domain,
      deletedBy: admin.name
    });

    return NextResponse.json({
      success: true,
      data: {
        message: '정책이 성공적으로 삭제되었습니다.',
        policy: {
          id: policyId,
          email_domain: existingPolicy.email_domain
        }
      }
    });

  } catch (error) {
    console.error('❌ [ADMIN-POLICIES] 정책 삭제 실패:', error);
    return NextResponse.json({
      success: false,
      error: {
        code: 'DELETE_ERROR',
        message: '정책 삭제에 실패했습니다.'
      }
    }, { status: 500 });
  }
}