import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-this-in-production';

interface SetPasswordRequest {
  email: string;
  password: string;
  confirmPassword: string;
}

export async function POST(request: NextRequest) {
  try {
    const origin = request.headers.get('origin');
    const allowedOrigins = [
      'https://facility.blueon-iot.com',
      'https://www.facility.blueon-iot.com',
      'http://localhost:3000',
      'http://127.0.0.1:3000'
    ];

    const allowedDomainPatterns = [
      /^https:\/\/.*\.vercel\.app$/,
      /^https:\/\/facility\.blueon-iot\.com$/,
      /^https:\/\/.*\.facility\.blueon-iot\.com$/
    ];

    console.log('🔐 [SET-PASSWORD] 요청 헤더 정보:', {
      origin,
      referer: request.headers.get('referer'),
      userAgent: request.headers.get('user-agent')
    });

    // Origin 검증
    let isOriginAllowed = false;
    if (!origin) {
      isOriginAllowed = true;
    } else if (allowedOrigins.includes(origin)) {
      isOriginAllowed = true;
    } else {
      isOriginAllowed = allowedDomainPatterns.some(pattern => pattern.test(origin));
    }

    if (!isOriginAllowed) {
      console.error('❌ [SET-PASSWORD] 허용되지 않은 Origin:', { origin });
      return NextResponse.json(
        { success: false, error: { code: 'FORBIDDEN_ORIGIN', message: `허용되지 않은 도메인입니다. Origin: ${origin}` } },
        { status: 403 }
      );
    }

    const { email, password, confirmPassword }: SetPasswordRequest = await request.json();

    // 입력 검증
    if (!email?.trim()) {
      return NextResponse.json(
        { success: false, error: { code: 'INVALID_INPUT', message: '이메일을 입력해주세요.' } },
        { status: 400 }
      );
    }

    if (!password) {
      return NextResponse.json(
        { success: false, error: { code: 'INVALID_INPUT', message: '비밀번호를 입력해주세요.' } },
        { status: 400 }
      );
    }

    if (password.length < 6) {
      return NextResponse.json(
        { success: false, error: { code: 'INVALID_INPUT', message: '비밀번호는 6자 이상이어야 합니다.' } },
        { status: 400 }
      );
    }

    if (password !== confirmPassword) {
      return NextResponse.json(
        { success: false, error: { code: 'INVALID_INPUT', message: '비밀번호가 일치하지 않습니다.' } },
        { status: 400 }
      );
    }

    // 사용자 조회
    const { data: employee, error: findError } = await supabaseAdmin
      .from('employees')
      .select('*')
      .eq('email', email.toLowerCase())
      .eq('is_deleted', false)
      .single();

    if (findError || !employee) {
      console.log('❌ [SET-PASSWORD] 사용자 조회 실패:', findError?.message);
      return NextResponse.json(
        { success: false, error: { code: 'USER_NOT_FOUND', message: '존재하지 않는 사용자입니다.' } },
        { status: 404 }
      );
    }

    // 활성 상태 확인
    if (!employee.is_active) {
      console.log('❌ [SET-PASSWORD] 승인 대기 중인 사용자:', email);
      return NextResponse.json(
        { success: false, error: { code: 'ACCOUNT_PENDING', message: '계정 승인 대기 중입니다. 관리자에게 문의하세요.' } },
        { status: 403 }
      );
    }

    // 소셜 계정인지 확인
    if (employee.signup_method && employee.signup_method !== 'direct' && !employee.password_hash) {
      // 소셜 계정에 비밀번호 설정 - 허용
      console.log('✅ [SET-PASSWORD] 소셜 계정에 비밀번호 설정:', email);
    } else if (employee.password_hash) {
      // 이미 비밀번호가 설정된 계정
      return NextResponse.json(
        { success: false, error: { code: 'PASSWORD_EXISTS', message: '이미 비밀번호가 설정된 계정입니다. 비밀번호 변경을 이용해주세요.' } },
        { status: 400 }
      );
    }

    // 비밀번호 해싱
    const saltRounds = 12;
    const hashedPassword = await bcrypt.hash(password, saltRounds);

    // signup_method 결정
    let newSignupMethod = 'direct';
    if (employee.signup_method && employee.signup_method !== 'direct') {
      newSignupMethod = 'social+direct'; // 하이브리드 계정
    }

    // 비밀번호 설정
    const { error: updateError } = await supabaseAdmin
      .from('employees')
      .update({
        password_hash: hashedPassword,
        signup_method: newSignupMethod,
        updated_at: new Date().toISOString()
      })
      .eq('id', employee.id);

    if (updateError) {
      console.error('❌ [SET-PASSWORD] 비밀번호 설정 오류:', updateError);
      return NextResponse.json(
        { success: false, error: { code: 'UPDATE_FAILED', message: '비밀번호 설정 중 오류가 발생했습니다.' } },
        { status: 500 }
      );
    }

    console.log('✅ [SET-PASSWORD] 비밀번호 설정 성공:', {
      email: employee.email,
      name: employee.name,
      signupMethod: newSignupMethod
    });

    // JWT 토큰 생성 (자동 로그인)
    const token = jwt.sign(
      {
        id: employee.id,
        userId: employee.id,
        email: employee.email,
        permissionLevel: employee.permission_level,
        name: employee.name
      },
      JWT_SECRET,
      { expiresIn: '24h' }
    );

    // 응답 데이터 (password_hash 제외)
    const { password_hash, ...safeEmployee } = employee;

    const response = NextResponse.json({
      success: true,
      message: '비밀번호가 설정되었습니다. 이제 이메일과 비밀번호로 로그인할 수 있습니다.',
      data: {
        token,
        user: {
          ...safeEmployee,
          signup_method: newSignupMethod
        },
        permissions: {
          canViewAllTasks: employee.permission_level >= 1,
          canCreateTasks: true,
          canEditTasks: true,
          canDeleteTasks: employee.permission_level >= 1,
          canViewReports: true,
          canApproveReports: employee.permission_level >= 1,
          canAccessAdminPages: employee.permission_level >= 3,
          canViewSensitiveData: employee.permission_level >= 3
        }
      },
      timestamp: new Date().toISOString()
    });

    // httpOnly 쿠키로 토큰 설정
    response.cookies.set('auth_token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 24 * 60 * 60, // 24시간
      path: '/'
    });

    return response;

  } catch (error) {
    console.error('❌ [SET-PASSWORD] 처리 오류:', error);
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
}