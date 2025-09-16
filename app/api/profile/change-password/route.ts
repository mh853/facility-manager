import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-this-in-production';

export async function PUT(request: NextRequest) {
  try {
    // JWT 토큰에서 사용자 ID 추출
    const token = request.headers.get('authorization')?.replace('Bearer ', '') ||
                  request.cookies.get('auth_token')?.value;

    if (!token) {
      return NextResponse.json(
        { success: false, message: '인증 토큰이 필요합니다.' },
        { status: 401 }
      );
    }

    // JWT 토큰 검증 및 디코딩
    let decodedToken;
    try {
      decodedToken = jwt.verify(token, JWT_SECRET) as any;
    } catch (jwtError: any) {
      return NextResponse.json(
        { success: false, message: '유효하지 않은 토큰입니다.' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { currentPassword, newPassword } = body;

    // 입력 데이터 검증
    if (!currentPassword || !newPassword) {
      return NextResponse.json(
        { success: false, message: '현재 비밀번호와 새 비밀번호를 입력해주세요.' },
        { status: 400 }
      );
    }

    // 새 비밀번호 강도 검증
    if (newPassword.length < 8) {
      return NextResponse.json(
        { success: false, message: '새 비밀번호는 최소 8자 이상이어야 합니다.' },
        { status: 400 }
      );
    }

    // 현재 사용자의 비밀번호 조회
    const { data: employee, error: employeeError } = await supabaseAdmin
      .from('employees')
      .select('id, email, password_hash')
      .eq('id', decodedToken.userId)
      .single();

    if (employeeError || !employee) {
      return NextResponse.json(
        { success: false, message: '사용자 정보를 찾을 수 없습니다.' },
        { status: 404 }
      );
    }

    // 현재 비밀번호 확인
    const isCurrentPasswordValid = await bcrypt.compare(currentPassword, employee.password_hash);
    if (!isCurrentPasswordValid) {
      return NextResponse.json(
        { success: false, message: '현재 비밀번호가 올바르지 않습니다.' },
        { status: 400 }
      );
    }

    // 새 비밀번호 해시화
    const saltRounds = 12;
    const newPasswordHash = await bcrypt.hash(newPassword, saltRounds);

    // 비밀번호 업데이트
    const { error: updateError } = await supabaseAdmin
      .from('employees')
      .update({
        password_hash: newPasswordHash,
        updated_at: new Date().toISOString()
      })
      .eq('id', decodedToken.userId);

    if (updateError) {
      console.error('Password update error:', updateError);
      return NextResponse.json(
        { success: false, message: '비밀번호 변경에 실패했습니다.' },
        { status: 500 }
      );
    }

    // 성공 응답
    return NextResponse.json({
      success: true,
      message: '비밀번호가 성공적으로 변경되었습니다.'
    });

  } catch (error) {
    console.error('Change password API error:', error);
    return NextResponse.json(
      { success: false, message: '서버 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}