import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import bcrypt from 'bcryptjs';
import { verifyToken } from '@/utils/auth';

// Force dynamic rendering for API routes
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  try {
    const token = request.headers.get('authorization')?.replace('Bearer ', '') ||
      request.headers.get('cookie')?.match(/auth-token=([^;]+)/)?.[1];

    if (!token) {
      return NextResponse.json({ success: false, error: '인증이 필요합니다' }, { status: 401 });
    }

    const authResult = await verifyToken(token);
    if (!authResult.success) {
      return NextResponse.json(authResult, { status: 401 });
    }

    const currentUser = authResult.data?.user;
    if (!currentUser) {
      return NextResponse.json({ success: false, error: '사용자 정보를 찾을 수 없습니다' }, { status: 401 });
    }

    const body = await request.json();
    const { currentPassword, newPassword } = body;

    // 필수 필드 검증
    if (!currentPassword || !newPassword) {
      return NextResponse.json(
        { success: false, error: '현재 비밀번호와 새 비밀번호를 모두 입력해주세요.' },
        { status: 400 }
      );
    }

    // 새 비밀번호 길이 검증
    if (newPassword.length < 6) {
      return NextResponse.json(
        { success: false, error: '새 비밀번호는 최소 6자 이상이어야 합니다.' },
        { status: 400 }
      );
    }

    // 기존 사용자 정보 조회
    const { data: existingUser, error: fetchError } = await supabaseAdmin
      .from('employees')
      .select('id, email, password_hash, name')
      .eq('id', currentUser.id)
      .eq('is_active', true)
      .eq('is_deleted', false)
      .single();

    if (fetchError || !existingUser) {
      console.error('❌ [CHANGE_PASSWORD] 사용자 조회 실패:', fetchError);
      return NextResponse.json(
        { success: false, error: '사용자 정보를 찾을 수 없습니다.' },
        { status: 404 }
      );
    }

    // 비밀번호가 설정되어 있지 않은 경우 (소셜 로그인 전용 계정)
    if (!existingUser.password_hash) {
      return NextResponse.json(
        { success: false, error: '소셜 로그인 계정입니다. 먼저 비밀번호를 설정해주세요.' },
        { status: 400 }
      );
    }

    // 현재 비밀번호 확인
    const isCurrentPasswordValid = await bcrypt.compare(currentPassword, existingUser.password_hash);
    if (!isCurrentPasswordValid) {
      return NextResponse.json(
        { success: false, error: '현재 비밀번호가 올바르지 않습니다.' },
        { status: 400 }
      );
    }

    // 새 비밀번호 해시
    const newPasswordHash = await bcrypt.hash(newPassword, 12);

    // 비밀번호 업데이트
    const updateData: any = {
      password_hash: newPasswordHash
    };

    // updated_at 컬럼이 존재하는지 확인 후 업데이트
    try {
      updateData.updated_at = new Date().toISOString();
    } catch (error) {
      // updated_at 컬럼이 없어도 계속 진행
    }

    const { error: updateError } = await supabaseAdmin
      .from('employees')
      .update(updateData)
      .eq('id', currentUser.id);

    if (updateError) {
      console.error('❌ [CHANGE_PASSWORD] 비밀번호 변경 실패:', updateError);
      return NextResponse.json(
        { success: false, error: '비밀번호 변경 중 오류가 발생했습니다.' },
        { status: 500 }
      );
    }

    console.log('✅ [CHANGE_PASSWORD] 비밀번호 변경 성공:', {
      userId: currentUser.id,
      email: existingUser.email,
      name: existingUser.name
    });

    return NextResponse.json({
      success: true,
      message: '비밀번호가 성공적으로 변경되었습니다.',
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('❌ [CHANGE_PASSWORD] API 오류:', error);
    return NextResponse.json(
      { success: false, error: '서버 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}