import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-this-in-production';

// 비밀번호 재설정
export async function POST(
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
    const { newPassword } = body;

    // 입력 데이터 검증
    if (!newPassword || newPassword.length < 8) {
      return NextResponse.json(
        { success: false, message: '새 비밀번호는 최소 8자 이상이어야 합니다.' },
        { status: 400 }
      );
    }

    // 사용자 존재 확인
    const { data: employee, error: findError } = await supabaseAdmin
      .from('employees')
      .select('id, name, email')
      .eq('id', params.id)
      .single();

    if (findError || !employee) {
      return NextResponse.json(
        { success: false, message: '사용자를 찾을 수 없습니다.' },
        { status: 404 }
      );
    }

    // 비밀번호 해시화
    const saltRounds = 12;
    const hashedPassword = await bcrypt.hash(newPassword, saltRounds);

    // 비밀번호 업데이트
    const { error: updateError } = await supabaseAdmin
      .from('employees')
      .update({
        password_hash: hashedPassword,
        password_changed_at: new Date().toISOString()
      })
      .eq('id', params.id);

    if (updateError) {
      console.error('비밀번호 업데이트 오류:', updateError);
      return NextResponse.json(
        { success: false, message: `비밀번호 재설정에 실패했습니다: ${updateError.message}` },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: `${employee.name}님의 비밀번호가 성공적으로 재설정되었습니다.`
    });

  } catch (error) {
    console.error('비밀번호 재설정 API 오류:', error);
    return NextResponse.json(
      { success: false, message: '서버 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}