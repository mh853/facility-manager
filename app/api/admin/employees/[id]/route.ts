import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import jwt from 'jsonwebtoken';

// Force dynamic rendering for API routes
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';


const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-this-in-production';

// 사용자 정보 조회
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // JWT 토큰 검증 - Authorization 헤더 또는 httpOnly 쿠키에서 토큰 확인
    const authHeader = request.headers.get('authorization');
    let token: string | null = null;

    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.replace('Bearer ', '');
    } else {
      // httpOnly 쿠키에서 토큰 확인
      const cookieToken = request.cookies.get('auth_token')?.value;
      if (cookieToken) {
        token = cookieToken;
      }
    }

    if (!token) {
      return NextResponse.json(
        { success: false, message: '인증 토큰이 필요합니다.' },
        { status: 401 }
      );
    }

    let decodedToken;
    try {
      decodedToken = jwt.verify(token, JWT_SECRET) as any;
    } catch (jwtError) {
      return NextResponse.json(
        { success: false, message: '유효하지 않은 토큰입니다.' },
        { status: 401 }
      );
    }

    // 자신의 정보이거나 관리자/슈퍼관리자인 경우에만 접근 허용
    if (decodedToken.id !== params.id && decodedToken.permissionLevel < 3) {
      return NextResponse.json(
        { success: false, message: '접근 권한이 없습니다.' },
        { status: 403 }
      );
    }

    // 사용자 정보 조회
    const { data: employee, error: fetchError } = await supabaseAdmin
      .from('employees')
      .select('*')
      .eq('id', params.id)
      .single();

    if (fetchError) {
      console.error('사용자 조회 오류:', fetchError);
      return NextResponse.json(
        { success: false, message: `사용자 조회에 실패했습니다: ${fetchError.message}` },
        { status: 500 }
      );
    }

    if (!employee) {
      return NextResponse.json(
        { success: false, message: '사용자를 찾을 수 없습니다.' },
        { status: 404 }
      );
    }

    // 소셜 계정 정보도 함께 조회
    const { data: socialAccounts, error: socialError } = await supabaseAdmin
      .from('social_accounts')
      .select('*')
      .eq('user_id', params.id);

    return NextResponse.json({
      success: true,
      data: {
        employee,
        socialAccounts: socialAccounts || [],
        permissions: {
          canViewAllTasks: employee.permission_level >= 1,
          canCreateTasks: employee.permission_level >= 1,
          canEditTasks: employee.permission_level >= 1,
          canDeleteTasks: employee.permission_level >= 1,
          canViewReports: employee.permission_level >= 1,
          canApproveReports: employee.permission_level >= 1,
          canAccessAdminPages: employee.permission_level >= 3,
          canViewSensitiveData: employee.permission_level >= 3,
        }
      }
    });

  } catch (error) {
    console.error('사용자 조회 API 오류:', error);
    return NextResponse.json(
      { success: false, message: '서버 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}

// 사용자 정보 수정
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // JWT 토큰 검증 - Authorization 헤더 또는 httpOnly 쿠키에서 토큰 확인
    const authHeader = request.headers.get('authorization');
    let token: string | null = null;

    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.replace('Bearer ', '');
    } else {
      // httpOnly 쿠키에서 토큰 확인
      const cookieToken = request.cookies.get('auth_token')?.value;
      if (cookieToken) {
        token = cookieToken;
      }
    }

    if (!token) {
      return NextResponse.json(
        { success: false, message: '인증 토큰이 필요합니다.' },
        { status: 401 }
      );
    }

    let decodedToken;
    try {
      decodedToken = jwt.verify(token, JWT_SECRET) as any;
    } catch (jwtError) {
      return NextResponse.json(
        { success: false, message: '유효하지 않은 토큰입니다.' },
        { status: 401 }
      );
    }

    // 관리자 권한 확인 (레벨 3 이상: 관리자, 슈퍼 관리자)
    if (decodedToken.permissionLevel < 3) {
      return NextResponse.json(
        { success: false, message: '관리자 권한이 필요합니다.' },
        { status: 403 }
      );
    }

    const body = await request.json();
    console.log('📥 [USER-UPDATE] 받은 데이터:', {
      userId: params.id,
      body,
      requestorPermission: decodedToken.permissionLevel
    });

    const { name, email, department, position, permission_level } = body;

    // 입력 데이터 검증
    if (!name || !email) {
      console.error('❌ [USER-UPDATE] 필수 필드 누락:', { name, email });
      return NextResponse.json(
        { success: false, message: '이름과 이메일은 필수 항목입니다.' },
        { status: 400 }
      );
    }

    // 이메일 중복 확인 (자신 제외)
    const { data: existingEmployee, error: emailCheckError } = await supabaseAdmin
      .from('employees')
      .select('id')
      .eq('email', email)
      .neq('id', params.id)
      .single();

    if (existingEmployee) {
      return NextResponse.json(
        { success: false, message: '이미 사용 중인 이메일입니다.' },
        { status: 400 }
      );
    }

    // 사용자 정보 업데이트
    const updateData = {
      name: name.trim(),
      email: email.trim().toLowerCase(),
      department: department?.trim() || null,
      position: position?.trim() || null,
      permission_level: permission_level || 1
    };

    console.log('📝 [USER-UPDATE] 업데이트할 데이터:', updateData);

    const { data: updatedEmployee, error: updateError } = await supabaseAdmin
      .from('employees')
      .update(updateData)
      .eq('id', params.id)
      .select()
      .single();

    if (updateError) {
      console.error('❌ [USER-UPDATE] Supabase 업데이트 오류:', {
        error: updateError,
        code: updateError.code,
        message: updateError.message,
        details: updateError.details
      });
      return NextResponse.json(
        { success: false, message: `사용자 업데이트에 실패했습니다: ${updateError.message}` },
        { status: 500 }
      );
    }

    console.log('✅ [USER-UPDATE] 업데이트 성공:', updatedEmployee);

    return NextResponse.json({
      success: true,
      message: '사용자 정보가 성공적으로 업데이트되었습니다.',
      data: { employee: updatedEmployee }
    });

  } catch (error) {
    console.error('사용자 업데이트 API 오류:', error);
    return NextResponse.json(
      { success: false, message: '서버 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}