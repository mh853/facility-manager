import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { verifyTokenString } from '@/utils/auth';

// Force dynamic rendering for API routes
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';


// 사용자 권한 승격 API (관리자만 사용 가능)
export async function POST(request: NextRequest) {
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

    // 현재 사용자가 관리자인지 확인
    const { data: currentAdmin, error: adminError } = await supabaseAdmin
      .from('employees')
      .select('permission_level, name')
      .eq('id', decoded.userId)
      .eq('is_active', true)
      .single();

    if (adminError || !currentAdmin || currentAdmin.permission_level < 3) {
      return NextResponse.json({
        success: false,
        error: { code: 'FORBIDDEN', message: '관리자 권한이 필요합니다.' }
      }, { status: 403 });
    }

    const body = await request.json();
    const { targetUserId, newPermissionLevel, reason } = body;

    // 입력 검증
    if (!targetUserId || typeof newPermissionLevel !== 'number') {
      return NextResponse.json({
        success: false,
        error: { code: 'INVALID_INPUT', message: '필수 정보가 누락되었습니다.' }
      }, { status: 400 });
    }

    if (newPermissionLevel < 1 || newPermissionLevel > 3) {
      return NextResponse.json({
        success: false,
        error: { code: 'INVALID_PERMISSION', message: '권한 레벨은 1-3 사이여야 합니다.' }
      }, { status: 400 });
    }

    // 대상 사용자 확인
    const { data: targetUser, error: userError } = await supabaseAdmin
      .from('employees')
      .select('*')
      .eq('id', targetUserId)
      .eq('is_active', true)
      .single();

    if (userError || !targetUser) {
      return NextResponse.json({
        success: false,
        error: { code: 'USER_NOT_FOUND', message: '대상 사용자를 찾을 수 없습니다.' }
      }, { status: 404 });
    }

    // 자기 자신의 권한은 변경할 수 없음
    if (targetUserId === decoded.userId) {
      return NextResponse.json({
        success: false,
        error: { code: 'SELF_PROMOTION_DENIED', message: '자신의 권한은 변경할 수 없습니다.' }
      }, { status: 400 });
    }

    // 현재 권한과 동일한 경우
    if (targetUser.permission_level === newPermissionLevel) {
      return NextResponse.json({
        success: false,
        error: {
          code: 'SAME_PERMISSION',
          message: `사용자가 이미 권한 레벨 ${newPermissionLevel}을 가지고 있습니다.`
        }
      }, { status: 400 });
    }

    // 권한 변경 실행
    const { error: updateError } = await supabaseAdmin
      .from('employees')
      .update({
        permission_level: newPermissionLevel,
        updated_at: new Date().toISOString()
      })
      .eq('id', targetUserId);

    if (updateError) {
      throw updateError;
    }

    // 권한 변경 로그 기록
    await supabaseAdmin
      .from('login_attempts')
      .insert({
        email: targetUser.email,
        ip_address: request.ip || 'unknown',
        user_agent: request.headers.get('user-agent') || 'unknown',
        login_method: 'permission_change',
        success: true,
        employee_id: targetUser.id,
        failure_reason: `권한 변경: ${targetUser.permission_level} -> ${newPermissionLevel} by ${currentAdmin.name}`
      });

    const actionType = newPermissionLevel > targetUser.permission_level ? '승격' : '강등';
    const permissionName = getPermissionName(newPermissionLevel);

    console.log('✅ [PROMOTE-USER] 권한 변경 완료:', {
      targetUser: targetUser.email,
      oldLevel: targetUser.permission_level,
      newLevel: newPermissionLevel,
      changedBy: currentAdmin.name,
      reason
    });

    return NextResponse.json({
      success: true,
      data: {
        message: `${targetUser.name}님이 ${permissionName}(레벨 ${newPermissionLevel})로 ${actionType}되었습니다.`,
        user: {
          id: targetUser.id,
          name: targetUser.name,
          email: targetUser.email,
          oldPermissionLevel: targetUser.permission_level,
          newPermissionLevel: newPermissionLevel
        },
        changedBy: currentAdmin.name,
        reason: reason || null
      }
    });

  } catch (error) {
    console.error('❌ [PROMOTE-USER] 권한 변경 실패:', error);
    return NextResponse.json({
      success: false,
      error: {
        code: 'PROMOTION_ERROR',
        message: '권한 변경 중 오류가 발생했습니다.'
      }
    }, { status: 500 });
  }
}

// 승격 가능한 사용자 목록 조회
export async function GET(request: NextRequest) {
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

    // 현재 사용자가 관리자인지 확인
    const { data: currentAdmin, error: adminError } = await supabaseAdmin
      .from('employees')
      .select('permission_level')
      .eq('id', decoded.userId)
      .eq('is_active', true)
      .single();

    if (adminError || !currentAdmin || currentAdmin.permission_level < 3) {
      return NextResponse.json({
        success: false,
        error: { code: 'FORBIDDEN', message: '관리자 권한이 필요합니다.' }
      }, { status: 403 });
    }

    // 활성 사용자 목록 조회 (자신 제외)
    const { data: users, error: usersError } = await supabaseAdmin
      .from('employees')
      .select('id, employee_id, name, email, permission_level, department, position, created_at, last_login_at')
      .eq('is_active', true)
      .neq('id', decoded.userId)
      .order('permission_level', { ascending: false })
      .order('name', { ascending: true });

    if (usersError) {
      throw usersError;
    }

    const usersWithPermissionNames = users?.map(user => ({
      ...user,
      permissionName: getPermissionName(user.permission_level),
      canPromoteToAdmin: user.permission_level < 3
    })) || [];

    return NextResponse.json({
      success: true,
      data: {
        users: usersWithPermissionNames,
        totalCount: usersWithPermissionNames.length
      }
    });

  } catch (error) {
    console.error('❌ [PROMOTE-USER] 사용자 목록 조회 실패:', error);
    return NextResponse.json({
      success: false,
      error: {
        code: 'FETCH_ERROR',
        message: '사용자 목록 조회 중 오류가 발생했습니다.'
      }
    }, { status: 500 });
  }
}

function getPermissionName(level: number): string {
  switch (level) {
    case 1: return '일반 사용자';
    case 2: return '중간 관리자';
    case 3: return '최고 관리자';
    default: return '알 수 없음';
  }
}