import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

export async function POST(request: NextRequest) {
  // 소셜 로그인 전용 시스템 - 비밀번호 재설정 비활성화
  return NextResponse.json(
    {
      success: false,
      error: {
        code: 'METHOD_NOT_SUPPORTED',
        message: '비밀번호 재설정은 지원하지 않습니다. 소셜 로그인을 이용해주세요.'
      }
    },
    { status: 405 }
  );

  /* 기존 비밀번호 재설정 코드 비활성화
  try {
    const body = await request.json();
    const { email } = body;

    if (!email) {
      return NextResponse.json(
        { success: false, message: '이메일 주소가 필요합니다.' },
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

    // 사용자 존재 여부 확인
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('id, email, name')
      .eq('email', email)
      .single();

    if (userError || !user) {
      // 보안을 위해 사용자 존재 여부를 명시하지 않음
      return NextResponse.json({
        success: true,
        message: '이메일이 등록되어 있다면 비밀번호 재설정 링크를 발송했습니다.'
      });
    }

    // Supabase Auth를 사용한 비밀번호 재설정 이메일 발송
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'}/reset-password`
    });

    if (resetError) {
      console.error('Password reset error:', resetError);

      // 특정 에러 메시지 처리
      if (resetError.message.includes('Email not confirmed')) {
        return NextResponse.json(
          { success: false, message: '이메일 인증이 완료되지 않은 계정입니다.' },
          { status: 400 }
        );
      }

      return NextResponse.json(
        { success: false, message: '비밀번호 재설정 요청 처리 중 오류가 발생했습니다.' },
        { status: 500 }
      );
    }

    // 성공 응답
    return NextResponse.json({
      success: true,
      message: '비밀번호 재설정 링크를 이메일로 발송했습니다.'
    });

  } catch (error) {
    console.error('Forgot password API error:', error);
    return NextResponse.json(
      { success: false, message: '서버 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
  */
}