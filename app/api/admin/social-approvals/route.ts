import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { verifyTokenString } from '@/utils/auth';

// Force dynamic rendering for API routes
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';


// 소셜 로그인 승인 요청 목록 조회
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

    // 관리자 권한 확인
    const userId = decoded.userId || decoded.id; // JWT 토큰에서 사용자 ID 추출
    console.log('🔍 [ADMIN-APPROVALS] 토큰 검증:', { userId, decoded });

    const { data: admin, error: adminError } = await supabaseAdmin
      .from('employees')
      .select('permission_level, name, email')
      .eq('id', userId)
      .eq('is_active', true)
      .single();

    console.log('👤 [ADMIN-APPROVALS] 관리자 조회:', { admin, adminError });

    if (adminError || !admin || admin.permission_level < 3) {
      console.log('❌ [ADMIN-APPROVALS] 권한 부족:', { admin, adminError });
      return NextResponse.json({
        success: false,
        error: { code: 'FORBIDDEN', message: '관리자 권한이 필요합니다.' }
      }, { status: 403 });
    }

    console.log('✅ [ADMIN-APPROVALS] 관리자 권한 확인 완료:', admin.name);

    // 쿼리 파라미터 처리
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status') || 'pending';
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '10');
    const offset = (page - 1) * limit;

    // 승인 요청 목록 조회 (테이블 존재 여부 확인)
    console.log('📊 [ADMIN-APPROVALS] 승인 요청 목록 조회 시작');

    // 먼저 social_login_approvals 테이블을 시도
    let tableName = 'social_login_approvals';
    let query = supabaseAdmin
      .from(tableName)
      .select('*')
      .order('created_at', { ascending: false });

    if (status !== 'all') {
      query = query.eq('approval_status', status);
    }

    let { data: approvals, error: approvalsError } = await query
      .range(offset, offset + limit - 1);

    // 테이블이 없으면 빈 배열 반환 (자동 가입 시스템이므로 승인 테이블 불필요)
    if (approvalsError && (approvalsError.message?.includes('does not exist') || approvalsError.code === 'PGRST205')) {
      console.log('ℹ️ [ADMIN-APPROVALS] 승인 테이블이 없음 - 자동 가입 시스템 운영 중');
      approvals = [];
      approvalsError = null;
    } else if (approvalsError) {
      console.error('❌ [ADMIN-APPROVALS] 테이블 조회 오류:', approvalsError);
      throw approvalsError;
    }

    // 총 개수 조회
    let countQuery = supabaseAdmin
      .from(tableName)
      .select('*', { count: 'exact', head: true });

    if (status !== 'all') {
      countQuery = countQuery.eq('approval_status', status);
    }

    const { count, error: countError } = await countQuery;

    // 테이블이 없으면 카운트도 0으로 설정
    let totalCount = 0;
    if (countError && (countError.message?.includes('does not exist') || countError.code === 'PGRST205')) {
      console.log('ℹ️ [ADMIN-APPROVALS] 승인 테이블 카운트 스킵 - 자동 가입 시스템');
      totalCount = 0;
    } else if (countError) {
      console.error('❌ [ADMIN-APPROVALS] 카운트 조회 오류:', countError);
      totalCount = 0;
    } else {
      totalCount = count || 0;
    }

    console.log(`📊 [ADMIN-APPROVALS] 조회 완료: ${approvals?.length || 0}개 항목, 총 ${totalCount}개`);

    return NextResponse.json({
      success: true,
      data: {
        approvals,
        pagination: {
          page,
          limit,
          total: totalCount,
          totalPages: Math.ceil(totalCount / limit)
        }
      }
    });

  } catch (error) {
    console.error('❌ [ADMIN-APPROVALS] 목록 조회 실패:', error);
    return NextResponse.json({
      success: false,
      error: {
        code: 'FETCH_ERROR',
        message: '승인 요청 목록 조회에 실패했습니다.'
      }
    }, { status: 500 });
  }
}

// 승인 요청 처리
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

    const body = await request.json();
    const { approvalId, action, reason } = body;

    if (!approvalId || !action || !['approved', 'rejected'].includes(action)) {
      return NextResponse.json({
        success: false,
        error: { code: 'INVALID_INPUT', message: '유효하지 않은 입력입니다.' }
      }, { status: 400 });
    }

    // 승인 요청 조회
    const { data: approval, error: approvalError } = await supabaseAdmin
      .from('social_auth_approvals')
      .select('*')
      .eq('id', approvalId)
      .eq('approval_status', 'pending')
      .single();

    if (approvalError || !approval) {
      return NextResponse.json({
        success: false,
        error: { code: 'NOT_FOUND', message: '승인 요청을 찾을 수 없습니다.' }
      }, { status: 404 });
    }

    if (action === 'approved') {
      // 직원 계정 생성
      const employeeId = crypto.randomUUID();

      const { data: newEmployee, error: employeeError } = await supabaseAdmin
        .from('employees')
        .insert({
          id: employeeId,
          employee_id: `${approval.provider.toUpperCase()}_${Date.now()}`,
          name: approval.requester_name,
          email: approval.requester_email,
          permission_level: approval.requested_permission_level,
          department: approval.requested_department,
          position: '소셜 로그인 사용자',
          is_active: true,
          social_login_enabled: true,
          created_by_social: true
        })
        .select()
        .single();

      if (employeeError) {
        throw employeeError;
      }

      // 소셜 계정 생성 (임시 토큰으로 생성, 실제 로그인시 업데이트됨)
      await supabaseAdmin
        .from('social_accounts')
        .insert({
          employee_id: employeeId,
          provider: approval.provider,
          provider_user_id: approval.provider_user_id,
          provider_email: approval.requester_email,
          provider_name: approval.requester_name,
          is_primary: true,
          connected_at: new Date().toISOString()
        });

      console.log('✅ [ADMIN-APPROVALS] 계정 승인 완료:', {
        email: approval.requester_email,
        provider: approval.provider,
        approvedBy: admin.name
      });
    }

    // 승인 요청 상태 업데이트
    const { error: updateError } = await supabaseAdmin
      .from('social_auth_approvals')
      .update({
        approval_status: action,
        approved_by: admin.name,
        approval_reason: reason,
        processed_at: new Date().toISOString()
      })
      .eq('id', approvalId);

    if (updateError) {
      throw updateError;
    }

    console.log(`✅ [ADMIN-APPROVALS] 승인 요청 ${action}:`, {
      approvalId,
      email: approval.requester_email,
      provider: approval.provider,
      admin: admin.name
    });

    return NextResponse.json({
      success: true,
      data: {
        message: action === 'approved' ? '승인이 완료되었습니다.' : '거부되었습니다.',
        action,
        approval: {
          id: approvalId,
          email: approval.requester_email,
          provider: approval.provider,
          status: action
        }
      }
    });

  } catch (error) {
    console.error('❌ [ADMIN-APPROVALS] 승인 처리 실패:', error);
    return NextResponse.json({
      success: false,
      error: {
        code: 'APPROVAL_ERROR',
        message: '승인 처리에 실패했습니다.'
      }
    }, { status: 500 });
  }
}