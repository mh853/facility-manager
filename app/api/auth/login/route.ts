import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-this-in-production';

export async function POST(request: NextRequest) {
  // 소셜 로그인 전용 시스템 - 이메일/비밀번호 로그인 비활성화
  return NextResponse.json(
    {
      success: false,
      error: {
        code: 'METHOD_NOT_SUPPORTED',
        message: '이메일/비밀번호 로그인은 지원하지 않습니다. 소셜 로그인을 이용해주세요.'
      }
    },
    { status: 405 }
  );

  /* 기존 이메일/비밀번호 로그인 코드 비활성화
  try {
    const { email, password } = await request.json();

    // 입력 검증
    if (!email || !password) {
      return NextResponse.json(
        { success: false, error: { code: 'INVALID_INPUT', message: '이메일과 비밀번호를 입력해주세요.' } },
        { status: 400 }
      );
    }

    // 사용자 조회
    const { data: employee, error: fetchError } = await supabaseAdmin
      .from('employees')
      .select('*')
      .eq('email', email)
      .eq('is_active', true)
      .eq('is_deleted', false)
      .single();

    if (fetchError || !employee) {
      console.log('❌ [AUTH] 사용자 조회 실패:', fetchError?.message);
      return NextResponse.json(
        { success: false, error: { code: 'USER_NOT_FOUND', message: '존재하지 않는 사용자입니다.' } },
        { status: 401 }
      );
    }

    // 비밀번호 검증
    const isValidPassword = await bcrypt.compare(password, employee.password_hash);
    if (!isValidPassword) {
      console.log('❌ [AUTH] 비밀번호 불일치');
      return NextResponse.json(
        { success: false, error: { code: 'INVALID_PASSWORD', message: '비밀번호가 틀렸습니다.' } },
        { status: 401 }
      );
    }

    // 마지막 로그인 시간 업데이트
    await supabaseAdmin
      .from('employees')
      .update({ last_login_at: new Date().toISOString() })
      .eq('id', employee.id);

    // JWT 토큰 생성
    const token = jwt.sign(
      {
        userId: employee.id,
        email: employee.email,
        permissionLevel: employee.permission_level,
        name: employee.name
      },
      JWT_SECRET,
      { expiresIn: '24h' }
    );

    console.log('✅ [AUTH] 로그인 성공:', { email: employee.email, name: employee.name });

    // 응답 데이터 (password_hash 제외)
    const { password_hash, ...safeEmployee } = employee;

    return NextResponse.json({
      success: true,
      data: {
        token,
        user: safeEmployee,
        permissions: {
          canViewAllTasks: employee.permission_level >= 2,
          canCreateTasks: true,
          canEditTasks: true,
          canDeleteTasks: employee.permission_level >= 2,
          canViewReports: true,
          canApproveReports: employee.permission_level >= 2,
          canAccessAdminPages: employee.permission_level === 3,
          canViewSensitiveData: employee.permission_level === 3
        }
      },
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('❌ [AUTH] 로그인 오류:', error);
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: '서버 오류가 발생했습니다. 잠시 후 다시 시도해주세요.'
        }
      },
      { status: 500 }
    );
  }
  */
}