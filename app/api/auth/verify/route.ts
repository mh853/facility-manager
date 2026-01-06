import { NextRequest, NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';
import { supabaseAdmin } from '@/lib/supabase';
import { queryOne, queryAll } from '@/lib/supabase-direct';

// Force dynamic rendering for API routes
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';


const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-this-in-production';

export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    let token: string | null = null;

    // 1. Authorization 헤더에서 토큰 확인
    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.substring(7); // "Bearer " 제거
      console.log('🔑 [AUTH] 헤더에서 토큰 발견');
    }
    // 2. 쿠키에서 토큰 확인 (헤더에 없는 경우)
    else {
      const cookieToken = request.cookies.get('auth_token')?.value;
      if (cookieToken) {
        token = cookieToken;
        console.log('🍪 [AUTH] 쿠키에서 토큰 발견');
      }
    }

    if (!token) {
      return NextResponse.json(
        { success: false, error: { code: 'NO_TOKEN', message: '인증 토큰이 없습니다.' } },
        { status: 401 }
      );
    }

    // JWT 토큰 검증
    let decoded: any;
    try {
      decoded = jwt.verify(token, JWT_SECRET);
    } catch (jwtError) {
      return NextResponse.json(
        { success: false, error: { code: 'INVALID_TOKEN', message: '유효하지 않은 토큰입니다.' } },
        { status: 401 }
      );
    }

    // 사용자 존재 여부 재확인 (토큰은 유효하지만 사용자가 비활성화된 경우) - 직접 PostgreSQL 연결 사용
    const userId = decoded.id || decoded.userId;

    const employee = await queryOne(
      'SELECT * FROM employees WHERE id = $1 AND is_active = true LIMIT 1',
      [userId]
    );

    console.log('📊 [AUTH] PostgreSQL 조회 결과:', {
      found: !!employee,
      permission_level: employee?.permission_level
    });

    if (!employee) {
      console.log('❌ [AUTH] 사용자 재조회 실패: 존재하지 않거나 비활성 사용자');
      return NextResponse.json(
        { success: false, error: { code: 'USER_NOT_FOUND', message: '사용자를 찾을 수 없습니다.' } },
        { status: 401 }
      );
    }

    // 소셜 계정 정보 조회 - 직접 PostgreSQL 연결 사용
    const socialAccounts = await queryAll(
      'SELECT * FROM social_accounts WHERE employee_id = $1 AND is_active = true ORDER BY connected_at DESC',
      [employee.id]
    );

    console.log('✅ [AUTH] 토큰 검증 성공:', {
      email: employee.email,
      name: employee.name,
      permission_level: employee.permission_level, // 🔍 권한 레벨 로깅 추가
      socialAccounts: socialAccounts?.length || 0
    });

    return NextResponse.json({
      success: true,
      data: {
        user: employee,
        permissions: {
          canViewAllTasks: employee.permission_level >= 1,
          canCreateTasks: true,
          canEditTasks: true,
          canDeleteTasks: employee.permission_level >= 1,
          canViewReports: true,
          canApproveReports: employee.permission_level >= 1,
          canAccessAdminPages: employee.permission_level >= 3,
          canViewSensitiveData: employee.permission_level >= 3,
          canDeleteAutoMemos: employee.permission_level === 4 // 슈퍼 관리자만
        },
        socialAccounts: socialAccounts || []
      },
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('❌ [AUTH] 토큰 검증 오류:', error);
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: '서버 오류가 발생했습니다.'
        }
      },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  // GET 요청도 같은 로직으로 처리
  return POST(request);
}