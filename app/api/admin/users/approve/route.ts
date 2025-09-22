// app/api/admin/users/approve/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { verifyAuth } from '@/lib/auth/middleware';

// Force dynamic rendering for API routes
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';


export async function POST(request: NextRequest) {
  try {
    const { user, error: authError } = await verifyAuth(request);
    if (authError || !user) {
      return NextResponse.json({ success: false, error: authError || '인증이 필요합니다.' }, { status: 401 });
    }

    // 관리자 권한 확인
    if (user.permissionLevel < 3) {
      return NextResponse.json(
        { success: false, error: '사용자 승인 권한이 없습니다.' },
        { status: 403 }
      );
    }

    const { user_id, department_id, permission_level, role } = await request.json();

    // 입력 검증
    if (!user_id) {
      return NextResponse.json(
        { success: false, error: '사용자 ID가 필요합니다.' },
        { status: 400 }
      );
    }

    // 승인 대상 사용자 조회
    const { data: targetUser, error: userError } = await supabaseAdmin
      .from('employees')
      .select('*')
      .eq('id', user_id)
      .eq('is_active', false) // 승인 대기 상태
      .single();

    if (userError || !targetUser) {
      return NextResponse.json(
        { success: false, error: '승인 대기 중인 사용자를 찾을 수 없습니다.' },
        { status: 404 }
      );
    }

    // 부서 존재 확인 (department_id가 제공된 경우)
    if (department_id) {
      const { data: department } = await supabaseAdmin
        .from('departments')
        .select('id, name')
        .eq('id', department_id)
        .eq('is_active', true)
        .single();

      if (!department) {
        return NextResponse.json(
          { success: false, error: '존재하지 않는 부서입니다.' },
          { status: 400 }
        );
      }
    }

    // 사용자 승인 처리
    const { data: approvedUser, error: approveError } = await supabaseAdmin
      .from('employees')
      .update({
        is_active: true,
        department_id: department_id || null,
        permission_level: permission_level || 1,
        role: role || 'staff',
        updated_at: new Date().toISOString()
      })
      .eq('id', user_id)
      .select(`
        *,
        department:departments(id, name)
      `)
      .single();

    if (approveError) throw approveError;

    console.log('✅ [USER_APPROVAL] 사용자 승인 완료:', {
      approvedUser: {
        id: approvedUser.id,
        name: approvedUser.name,
        email: approvedUser.email,
        department: approvedUser.department?.name
      },
      approvedBy: user.name
    });

    return NextResponse.json({
      success: true,
      data: {
        user: approvedUser,
        approved_by: user.name,
        approved_at: new Date().toISOString()
      },
      message: `${approvedUser.name}님이 승인되었습니다.`
    });

  } catch (error) {
    console.error('❌ [USER_APPROVAL] 승인 처리 실패:', error);
    return NextResponse.json(
      { success: false, error: '사용자 승인 처리에 실패했습니다.' },
      { status: 500 }
    );
  }
}

// 승인 대기 목록 조회
export async function GET(request: NextRequest) {
  try {
    const { user, error: authError } = await verifyAuth(request);
    if (authError || !user) {
      return NextResponse.json({ success: false, error: authError || '인증이 필요합니다.' }, { status: 401 });
    }

    // 관리자 권한 확인
    if (user.permissionLevel < 3) {
      return NextResponse.json(
        { success: false, error: '승인 대기 목록 조회 권한이 없습니다.' },
        { status: 403 }
      );
    }

    // 승인 대기 중인 사용자 목록 조회
    const { data: pendingUsers, error } = await supabaseAdmin
      .from('employees')
      .select(`
        id, name, email, social_provider, social_email, profile_image_url,
        created_at
      `)
      .eq('is_active', false)
      .eq('is_deleted', false)
      .order('created_at', { ascending: false });

    if (error) throw error;

    return NextResponse.json({
      success: true,
      data: pendingUsers || [],
      count: pendingUsers?.length || 0
    });

  } catch (error) {
    console.error('❌ [USER_APPROVAL] 승인 대기 목록 조회 실패:', error);
    return NextResponse.json(
      { success: false, error: '승인 대기 목록을 불러올 수 없습니다.' },
      { status: 500 }
    );
  }
}