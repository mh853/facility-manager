import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import bcrypt from 'bcryptjs';

// Force dynamic rendering for API routes
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

interface SignupRequest {
  name: string;
  email: string;
  password: string;
  department: string;
  position: string;
  agreements: {
    terms: boolean;
    privacy: boolean;
    personalInfo: boolean;
    marketing: boolean;
  };
}

export async function POST(request: NextRequest) {
  try {
    // CORS 헤더 설정
    const origin = request.headers.get('origin');
    const allowedOrigins = ['https://facility.blueon-iot.com', 'http://localhost:3000'];

    if (origin && !allowedOrigins.includes(origin)) {
      return NextResponse.json(
        { success: false, message: '허용되지 않은 도메인입니다.' },
        { status: 403 }
      );
    }

    const body: SignupRequest = await request.json();
    const {
      name,
      email,
      password,
      department,
      position,
      agreements
    } = body;

    console.log('🔐 [SIGNUP] 회원가입 요청:', {
      email,
      name,
      department,
      position,
      agreements
    });

    // 입력 검증
    if (!name?.trim()) {
      return NextResponse.json(
        { success: false, message: '이름을 입력해주세요.' },
        { status: 400 }
      );
    }

    if (!email?.trim()) {
      return NextResponse.json(
        { success: false, message: '이메일을 입력해주세요.' },
        { status: 400 }
      );
    }

    if (!password) {
      return NextResponse.json(
        { success: false, message: '비밀번호를 입력해주세요.' },
        { status: 400 }
      );
    }

    if (password.length < 6) {
      return NextResponse.json(
        { success: false, message: '비밀번호는 6자 이상이어야 합니다.' },
        { status: 400 }
      );
    }

    if (!department?.trim()) {
      return NextResponse.json(
        { success: false, message: '부서를 입력해주세요.' },
        { status: 400 }
      );
    }

    if (!position?.trim()) {
      return NextResponse.json(
        { success: false, message: '직책을 입력해주세요.' },
        { status: 400 }
      );
    }

    // 필수 약관 동의 확인
    if (!agreements.terms) {
      return NextResponse.json(
        { success: false, message: '서비스 이용약관에 동의해주세요.' },
        { status: 400 }
      );
    }

    if (!agreements.privacy) {
      return NextResponse.json(
        { success: false, message: '개인정보 처리방침에 동의해주세요.' },
        { status: 400 }
      );
    }

    if (!agreements.personalInfo) {
      return NextResponse.json(
        { success: false, message: '개인정보 수집 및 이용에 동의해주세요.' },
        { status: 400 }
      );
    }

    // 이메일 중복 확인
    const { data: existingUser, error: checkError } = await supabaseAdmin
      .from('employees')
      .select('email')
      .eq('email', email.toLowerCase())
      .single();

    if (checkError && checkError.code !== 'PGRST116') {
      console.error('❌ [SIGNUP] 이메일 중복 확인 오류:', checkError);
      return NextResponse.json(
        { success: false, message: '이메일 확인 중 오류가 발생했습니다.' },
        { status: 500 }
      );
    }

    if (existingUser) {
      return NextResponse.json(
        { success: false, message: '이미 가입된 이메일입니다.' },
        { status: 409 }
      );
    }

    // 비밀번호 해싱
    const saltRounds = 12;
    const hashedPassword = await bcrypt.hash(password, saltRounds);

    // 직원 ID 생성
    const employeeId = crypto.randomUUID();
    const employeeNumber = `EMP_${Date.now()}`;

    // 회원 생성
    const { data: newEmployee, error: createError } = await supabaseAdmin
      .from('employees')
      .insert({
        id: employeeId,
        employee_id: employeeNumber,
        name: name.trim(),
        email: email.toLowerCase().trim(),
        password_hash: hashedPassword,
        department: department.trim(),
        position: position.trim(),
        permission_level: 1, // 기본 권한
        is_active: true,
        created_at: new Date().toISOString(),
        // 약관 동의 정보
        terms_agreed_at: new Date().toISOString(),
        privacy_agreed_at: new Date().toISOString(),
        personal_info_agreed_at: new Date().toISOString(),
        marketing_agreed_at: agreements.marketing ? new Date().toISOString() : null,
        signup_method: 'direct'
      })
      .select()
      .single();

    if (createError) {
      console.error('❌ [SIGNUP] 회원 생성 오류:', createError);
      return NextResponse.json(
        { success: false, message: '회원가입 중 오류가 발생했습니다.' },
        { status: 500 }
      );
    }

    console.log('✅ [SIGNUP] 회원가입 성공:', {
      id: newEmployee.id,
      email: newEmployee.email,
      name: newEmployee.name
    });

    // 성공 응답 (비밀번호 제외)
    return NextResponse.json({
      success: true,
      message: '회원가입이 완료되었습니다.',
      user: {
        id: newEmployee.id,
        name: newEmployee.name,
        email: newEmployee.email,
        department: newEmployee.department,
        position: newEmployee.position
      }
    });

  } catch (error: any) {
    console.error('❌ [SIGNUP] 회원가입 처리 오류:', error);
    return NextResponse.json(
      { success: false, message: '서버 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}