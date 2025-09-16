import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { verifyTokenString } from '@/utils/auth';

// 첫 관리자 생성 API - 시스템에 관리자가 없을 때만 작동
export async function POST(request: NextRequest) {
  try {
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

    // 현재 사용자 정보 조회
    const { data: currentUser, error: userError } = await supabaseAdmin
      .from('employees')
      .select('*')
      .eq('id', decoded.userId)
      .eq('is_active', true)
      .single();

    if (userError || !currentUser) {
      return NextResponse.json({
        success: false,
        error: { code: 'USER_NOT_FOUND', message: '사용자를 찾을 수 없습니다.' }
      }, { status: 404 });
    }

    // 시스템에 이미 관리자(권한 레벨 3)가 있는지 확인
    const { data: existingAdmins, error: adminCheckError } = await supabaseAdmin
      .from('employees')
      .select('id, name, email')
      .eq('permission_level', 3)
      .eq('is_active', true);

    if (adminCheckError) {
      throw adminCheckError;
    }

    if (existingAdmins && existingAdmins.length > 0) {
      return NextResponse.json({
        success: false,
        error: {
          code: 'ADMIN_EXISTS',
          message: '이미 관리자가 존재합니다. 기존 관리자에게 권한 승격을 요청하세요.',
          data: {
            existingAdmins: existingAdmins.map(admin => ({
              name: admin.name,
              email: admin.email
            }))
          }
        }
      }, { status: 409 });
    }

    // 현재 사용자를 최고 관리자로 승격
    const { error: upgradeError } = await supabaseAdmin
      .from('employees')
      .update({
        permission_level: 3,
        updated_at: new Date().toISOString()
      })
      .eq('id', currentUser.id);

    if (upgradeError) {
      throw upgradeError;
    }

    // 기본 도메인 정책 생성 (모든 도메인 수동 승인)
    const { error: policyError } = await supabaseAdmin
      .from('social_auth_policies')
      .insert({
        email_domain: '*', // 와일드카드로 모든 도메인
        auto_approve: false, // 모든 사용자 수동 승인
        default_permission_level: 1, // 기본 권한 레벨 1
        default_department: null,
        description: '기본 정책: 모든 소셜 로그인 사용자는 수동 승인 필요',
        created_by: currentUser.name,
        is_active: true
      });

    if (policyError) {
      console.warn('⚠️ [INIT-ADMIN] 기본 정책 생성 실패 (이미 존재할 수 있음):', policyError);
    }

    // 관리자 승격 로그 기록
    await supabaseAdmin
      .from('login_attempts')
      .insert({
        email: currentUser.email,
        ip_address: request.ip || 'unknown',
        user_agent: request.headers.get('user-agent') || 'unknown',
        login_method: 'admin_init',
        success: true,
        employee_id: currentUser.id
      });

    console.log('✅ [INIT-ADMIN] 첫 관리자 생성 완료:', {
      userId: currentUser.id,
      name: currentUser.name,
      email: currentUser.email
    });

    return NextResponse.json({
      success: true,
      data: {
        message: '첫 관리자 계정이 성공적으로 생성되었습니다.',
        admin: {
          id: currentUser.id,
          name: currentUser.name,
          email: currentUser.email,
          permission_level: 3
        }
      }
    });

  } catch (error) {
    console.error('❌ [INIT-ADMIN] 첫 관리자 생성 실패:', error);
    return NextResponse.json({
      success: false,
      error: {
        code: 'INIT_ERROR',
        message: '관리자 생성 중 오류가 발생했습니다.'
      }
    }, { status: 500 });
  }
}

// 시스템 상태 확인 API
export async function GET(request: NextRequest) {
  try {
    // 현재 관리자 수 확인
    const { data: admins, error: adminError } = await supabaseAdmin
      .from('employees')
      .select('id, name, email, created_at')
      .eq('permission_level', 3)
      .eq('is_active', true)
      .order('created_at', { ascending: true });

    if (adminError) {
      throw adminError;
    }

    // 전체 사용자 수 확인
    const { count: totalUsers, error: countError } = await supabaseAdmin
      .from('employees')
      .select('*', { count: 'exact', head: true })
      .eq('is_active', true);

    if (countError) {
      throw countError;
    }

    // 대기중인 승인 요청 수 확인
    const { count: pendingApprovals, error: pendingError } = await supabaseAdmin
      .from('social_auth_approvals')
      .select('*', { count: 'exact', head: true })
      .eq('approval_status', 'pending');

    if (pendingError) {
      throw pendingError;
    }

    return NextResponse.json({
      success: true,
      data: {
        hasAdmins: (admins?.length || 0) > 0,
        adminCount: admins?.length || 0,
        totalUsers: totalUsers || 0,
        pendingApprovals: pendingApprovals || 0,
        admins: admins?.map(admin => ({
          name: admin.name,
          email: admin.email,
          createdAt: admin.created_at
        })) || []
      }
    });

  } catch (error) {
    console.error('❌ [INIT-ADMIN] 시스템 상태 확인 실패:', error);
    return NextResponse.json({
      success: false,
      error: {
        code: 'STATUS_ERROR',
        message: '시스템 상태 확인 중 오류가 발생했습니다.'
      }
    }, { status: 500 });
  }
}