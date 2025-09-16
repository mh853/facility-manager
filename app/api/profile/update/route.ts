import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-this-in-production';

export async function PUT(request: NextRequest) {
  try {
    console.log('🟡 [PROFILE-UPDATE] API 시작:', {
      method: request.method,
      url: request.url,
      headers: Object.fromEntries(request.headers.entries()),
      timestamp: new Date().toISOString()
    });

    // JWT 토큰에서 사용자 ID 추출
    const authHeader = request.headers.get('authorization');
    const cookieToken = request.cookies.get('auth_token')?.value;
    const token = authHeader?.replace('Bearer ', '') || cookieToken;

    console.log('🔍 [PROFILE-UPDATE] 토큰 확인:', {
      authHeader: authHeader ? `${authHeader.substring(0, 20)}...` : null,
      hasCookieToken: !!cookieToken,
      hasToken: !!token,
      tokenLength: token?.length || 0
    });

    if (!token) {
      console.error('🔴 [PROFILE-UPDATE] 토큰 없음');
      return NextResponse.json(
        { success: false, message: '인증 토큰이 필요합니다. 다시 로그인해주세요.' },
        { status: 401 }
      );
    }

    // JWT 토큰 검증 및 디코딩
    let decodedToken;
    try {
      console.log('🔍 [PROFILE-UPDATE] JWT 검증 시도:', {
        tokenLength: token.length,
        tokenPreview: token.substring(0, 50) + '...',
        jwtSecret: JWT_SECRET ? 'Present' : 'Missing'
      });

      decodedToken = jwt.verify(token, JWT_SECRET) as any;

      console.log('🔍 [PROFILE-UPDATE] JWT 토큰 검증 성공:', {
        userId: decodedToken.userId,
        email: decodedToken.email,
        exp: new Date(decodedToken.exp * 1000).toISOString(),
        tokenValid: true
      });
    } catch (jwtError: any) {
      console.error('🔴 [PROFILE-UPDATE] JWT 토큰 검증 실패:', {
        error: jwtError.message,
        name: jwtError.name,
        tokenSample: token ? token.substring(0, 30) + '...' : 'No token'
      });
      return NextResponse.json(
        { success: false, message: '유효하지 않은 토큰입니다.' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { name, email, department, position } = body;

    console.log('🔍 [PROFILE-UPDATE] 수신된 데이터:', {
      name, email, department, position
    });

    // 입력 데이터 검증
    if (!name || !email) {
      console.error('🔴 [PROFILE-UPDATE] 필수 필드 누락:', { name, email });
      return NextResponse.json(
        { success: false, message: '이름과 이메일은 필수 항목입니다.' },
        { status: 400 }
      );
    }

    // 이메일 형식 검증
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return NextResponse.json(
        { success: false, message: '올바른 이메일 형식이 아닙니다.' },
        { status: 400 }
      );
    }

    // 이메일 중복 확인 (자신 제외)
    const { data: existingEmployee, error: emailCheckError } = await supabaseAdmin
      .from('employees')
      .select('id')
      .eq('email', email)
      .neq('id', decodedToken.userId)
      .single();

    if (existingEmployee) {
      return NextResponse.json(
        { success: false, message: '이미 사용 중인 이메일입니다.' },
        { status: 400 }
      );
    }

    // 사용자 정보 업데이트
    console.log('🔍 [PROFILE-UPDATE] 업데이트 시작, 사용자 ID:', decodedToken.userId);

    const updateData = {
      name: name.trim(),
      email: email.trim().toLowerCase(),
      department: department?.trim() || null,
      position: position?.trim() || null
    };

    console.log('🔍 [PROFILE-UPDATE] 업데이트할 데이터:', updateData);

    const { data: updatedEmployee, error: updateError } = await supabaseAdmin
      .from('employees')
      .update(updateData)
      .eq('id', decodedToken.userId)
      .select()
      .single();

    console.log('🔍 [PROFILE-UPDATE] 업데이트 결과:', {
      hasUpdatedEmployee: !!updatedEmployee,
      updateError: updateError?.message,
      updateErrorCode: updateError?.code
    });

    if (updateError) {
      console.error('🔴 [PROFILE-UPDATE] 업데이트 실패:', updateError);
      return NextResponse.json(
        { success: false, message: `프로필 업데이트에 실패했습니다: ${updateError.message}` },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: '프로필이 성공적으로 업데이트되었습니다.',
      data: {
        user: {
          id: updatedEmployee.id,
          name: updatedEmployee.name,
          email: updatedEmployee.email,
          department: updatedEmployee.department,
          position: updatedEmployee.position,
          employee_id: updatedEmployee.employee_id,
          permission_level: updatedEmployee.permission_level,
          created_at: updatedEmployee.created_at,
          updated_at: updatedEmployee.updated_at,
          last_login_at: updatedEmployee.last_login_at
        }
      }
    });

  } catch (error) {
    console.error('🔴 [PROFILE-UPDATE] Detailed error:', {
      error: error,
      message: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : 'No stack trace',
      type: typeof error,
      name: error instanceof Error ? error.name : 'Unknown'
    });
    return NextResponse.json(
      {
        success: false,
        message: '서버 오류가 발생했습니다.',
        error: process.env.NODE_ENV === 'development' ? error instanceof Error ? error.message : String(error) : undefined
      },
      { status: 500 }
    );
  }
}