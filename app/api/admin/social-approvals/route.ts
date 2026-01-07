import { NextRequest, NextResponse } from 'next/server';
import { queryOne, queryAll, query as pgQuery } from '@/lib/supabase-direct';
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

    const admin = await queryOne(
      'SELECT permission_level, name, email FROM employees WHERE id = $1 AND is_active = true',
      [userId]
    );

    console.log('👤 [ADMIN-APPROVALS] 관리자 조회:', { admin });

    if (!admin || admin.permission_level < 3) {
      console.log('❌ [ADMIN-APPROVALS] 권한 부족:', { admin });
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

    let approvals: any[] = [];
    let totalCount = 0;

    try {
      // Direct PostgreSQL 쿼리
      const whereClause = status !== 'all' ? 'WHERE approval_status = $3' : '';
      const params = status !== 'all' ? [limit, offset, status] : [limit, offset];

      approvals = await queryAll(
        `SELECT * FROM social_login_approvals
         ${whereClause}
         ORDER BY created_at DESC
         LIMIT $1 OFFSET $2`,
        params
      );

      // 총 개수 조회
      const countResult = await queryOne(
        `SELECT COUNT(*) as count FROM social_login_approvals ${whereClause}`,
        status !== 'all' ? [status] : []
      );
      totalCount = parseInt(countResult?.count || '0');
    } catch (error: any) {
      // 테이블이 없으면 빈 배열 반환 (자동 가입 시스템이므로 승인 테이블 불필요)
      if (error.code === '42P01' || error.message?.includes('does not exist')) {
        console.log('ℹ️ [ADMIN-APPROVALS] 승인 테이블이 없음 - 자동 가입 시스템 운영 중');
        approvals = [];
        totalCount = 0;
      } else {
        console.error('❌ [ADMIN-APPROVALS] 테이블 조회 오류:', error);
        throw error;
      }
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
    const userId = decoded.userId || decoded.id;
    const admin = await queryOne(
      'SELECT permission_level, name FROM employees WHERE id = $1 AND is_active = true',
      [userId]
    );

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
    const approval = await queryOne(
      'SELECT * FROM social_auth_approvals WHERE id = $1 AND approval_status = $2',
      [approvalId, 'pending']
    );

    if (!approval) {
      return NextResponse.json({
        success: false,
        error: { code: 'NOT_FOUND', message: '승인 요청을 찾을 수 없습니다.' }
      }, { status: 404 });
    }

    if (action === 'approved') {
      // 직원 계정 생성
      const employeeId = crypto.randomUUID();

      const newEmployee = await queryOne(
        `INSERT INTO employees (
          id, employee_id, name, email, permission_level, department,
          position, is_active, social_login_enabled, created_by_social
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        RETURNING *`,
        [
          employeeId,
          `${approval.provider.toUpperCase()}_${Date.now()}`,
          approval.requester_name,
          approval.requester_email,
          approval.requested_permission_level,
          approval.requested_department,
          '소셜 로그인 사용자',
          true,
          true,
          true
        ]
      );

      if (!newEmployee) {
        throw new Error('직원 계정 생성 실패');
      }

      // 소셜 계정 생성 (임시 토큰으로 생성, 실제 로그인시 업데이트됨)
      await pgQuery(
        `INSERT INTO social_accounts (
          employee_id, provider, provider_user_id, provider_email,
          provider_name, is_primary, connected_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [
          employeeId,
          approval.provider,
          approval.provider_user_id,
          approval.requester_email,
          approval.requester_name,
          true,
          new Date().toISOString()
        ]
      );

      console.log('✅ [ADMIN-APPROVALS] 계정 승인 완료:', {
        email: approval.requester_email,
        provider: approval.provider,
        approvedBy: admin.name
      });
    }

    // 승인 요청 상태 업데이트
    await pgQuery(
      `UPDATE social_auth_approvals
       SET approval_status = $1, approved_by = $2, approval_reason = $3, processed_at = $4
       WHERE id = $5`,
      [action, admin.name, reason, new Date().toISOString(), approvalId]
    );

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