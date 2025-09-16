import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-this-in-production';

// 사용자 정보 수정
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // JWT 토큰 검증
    const authHeader = request.headers.get('authorization');
    const token = authHeader?.replace('Bearer ', '');

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

    // 관리자 권한 확인
    if (decodedToken.permissionLevel !== 3) {
      return NextResponse.json(
        { success: false, message: '관리자 권한이 필요합니다.' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { name, email, department, position, permission_level } = body;

    // 입력 데이터 검증
    if (!name || !email) {
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

    const { data: updatedEmployee, error: updateError } = await supabaseAdmin
      .from('employees')
      .update(updateData)
      .eq('id', params.id)
      .select()
      .single();

    if (updateError) {
      console.error('사용자 업데이트 오류:', updateError);
      return NextResponse.json(
        { success: false, message: `사용자 업데이트에 실패했습니다: ${updateError.message}` },
        { status: 500 }
      );
    }

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