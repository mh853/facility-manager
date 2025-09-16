import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { generateToken } from '@/utils/auth';
import crypto from 'crypto';

// 처리 중인 코드 캐시 (중복 요청 방지)
const processingCodes = new Map<string, Promise<NextResponse>>();
const processedCodes = new Map<string, { response: any; timestamp: number }>();

// 캐시 정리 (10분 후 자동 삭제)
const CACHE_DURATION = 10 * 60 * 1000; // 10분
setInterval(() => {
  const now = Date.now();
  for (const [code, data] of processedCodes.entries()) {
    if (now - data.timestamp > CACHE_DURATION) {
      processedCodes.delete(code);
    }
  }
}, 60 * 1000); // 1분마다 정리

const KAKAO_CLIENT_ID = process.env.NEXT_PUBLIC_KAKAO_CLIENT_ID;
const KAKAO_CLIENT_SECRET = process.env.KAKAO_CLIENT_SECRET;
const KAKAO_REDIRECT_URI = process.env.NODE_ENV === 'production'
  ? 'https://facility.bluon-iot.com/auth/social/kakao-simple/callback'
  : 'http://localhost:3000/auth/social/kakao-simple/callback';

interface KakaoTokenResponse {
  access_token: string;
  token_type: string;
  refresh_token?: string;
  expires_in: number;
  scope?: string;
}

interface KakaoUserInfo {
  id: number;
  connected_at?: string;
  properties?: {
    nickname?: string;
    profile_image?: string;
    thumbnail_image?: string;
  };
  kakao_account?: {
    profile_nickname_needs_agreement?: boolean;
    profile_image_needs_agreement?: boolean;
    profile?: {
      nickname?: string;
      thumbnail_image_url?: string;
      profile_image_url?: string;
      is_default_image?: boolean;
    };
    has_email?: boolean;
    email_needs_agreement?: boolean;
    is_email_valid?: boolean;
    is_email_verified?: boolean;
    email?: string;
  };
}

async function exchangeCodeForToken(code: string): Promise<KakaoTokenResponse> {
  const tokenUrl = 'https://kauth.kakao.com/oauth/token';

  const params = new URLSearchParams({
    grant_type: 'authorization_code',
    client_id: KAKAO_CLIENT_ID!,
    client_secret: KAKAO_CLIENT_SECRET!,
    redirect_uri: KAKAO_REDIRECT_URI,
    code: code
  });

  const response = await fetch(tokenUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body: params.toString()
  });

  if (!response.ok) {
    const errorData = await response.text();
    console.error('카카오 토큰 교환 실패:', response.status, errorData);
    throw new Error(`카카오 토큰 교환 실패: ${response.status}`);
  }

  return await response.json();
}

async function getKakaoUserInfo(accessToken: string): Promise<KakaoUserInfo> {
  const userInfoUrl = 'https://kapi.kakao.com/v2/user/me';

  const response = await fetch(userInfoUrl, {
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/x-www-form-urlencoded;charset=utf-8'
    }
  });

  if (!response.ok) {
    const errorData = await response.text();
    console.error('카카오 사용자 정보 조회 실패:', response.status, errorData);
    throw new Error(`카카오 사용자 정보 조회 실패: ${response.status}`);
  }

  return await response.json();
}

// 간단한 자동 가입 처리
async function createUserDirectly(userInfo: KakaoUserInfo) {
  const email = userInfo.kakao_account?.email;
  const nickname = userInfo.properties?.nickname || userInfo.kakao_account?.profile?.nickname;
  const kakaoId = userInfo.id.toString();

  if (!email) {
    throw new Error('카카오 계정에서 이메일을 가져올 수 없습니다.');
  }

  if (!nickname) {
    throw new Error('카카오 계정에서 닉네임을 가져올 수 없습니다.');
  }

  // 기존 소셜 계정 확인
  const { data: existingSocial } = await supabaseAdmin
    .from('social_accounts')
    .select('employee_id, employees(*)')
    .eq('provider', 'kakao')
    .eq('provider_user_id', kakaoId)
    .single();

  if (existingSocial) {
    console.log('✅ [KAKAO-SIMPLE] 기존 카카오 계정 로그인:', email);
    return {
      employee: existingSocial.employees,
      isNewUser: false
    };
  }

  // 이메일로 기존 직원 확인
  const { data: existingEmployee } = await supabaseAdmin
    .from('employees')
    .select('*')
    .eq('email', email)
    .eq('is_active', true)
    .single();

  if (existingEmployee) {
    // 기존 직원에게 카카오 계정 연결
    await supabaseAdmin
      .from('social_accounts')
      .insert({
        employee_id: existingEmployee.id,
        provider: 'kakao',
        provider_user_id: kakaoId,
        provider_email: email,
        provider_name: nickname,
        is_primary: false,
        connected_at: new Date().toISOString()
      });

    console.log('🔗 [KAKAO-SIMPLE] 기존 직원에게 카카오 계정 연결:', email);
    return {
      employee: existingEmployee,
      isNewUser: false
    };
  }

  // 새 사용자 자동 생성 (모든 소셜 가입자는 권한 1)
  const permissionLevel = 1; // 모든 자동 가입자는 일반 사용자 권한

  const employeeId = crypto.randomUUID();

  const { data: newEmployee, error: employeeError } = await supabaseAdmin
    .from('employees')
    .insert({
      id: employeeId,
      employee_id: `KAKAO_${Date.now()}`,
      name: nickname,
      email: email,
      permission_level: permissionLevel,
      department: null,
      position: '카카오 로그인 사용자',
      is_active: true,
      social_login_enabled: true,
      created_by_social: true
    })
    .select()
    .single();

  if (employeeError) {
    throw employeeError;
  }

  // 소셜 계정 연결
  await supabaseAdmin
    .from('social_accounts')
    .insert({
      employee_id: employeeId,
      provider: 'kakao',
      provider_user_id: kakaoId,
      provider_email: email,
      provider_name: nickname,
      is_primary: true,
      connected_at: new Date().toISOString()
    });

  console.log(`✅ [KAKAO-SIMPLE] 새 사용자 자동 생성 (권한 ${permissionLevel}):`, email);
  return {
    employee: newEmployee,
    isNewUser: true
  };
}

export async function GET(request: NextRequest) {
  try {
    if (!KAKAO_CLIENT_ID || !KAKAO_CLIENT_SECRET) {
      return NextResponse.json({
        success: false,
        error: { code: 'CONFIG_ERROR', message: '카카오 설정이 완료되지 않았습니다.' }
      }, { status: 500 });
    }

    const { searchParams } = new URL(request.url);
    const code = searchParams.get('code');
    const error = searchParams.get('error');

    if (error) {
      console.error('❌ [KAKAO-SIMPLE] OAuth 오류:', error);
      return NextResponse.json({
        success: false,
        error: { code: 'OAUTH_ERROR', message: '카카오 로그인 중 오류가 발생했습니다.' }
      }, { status: 400 });
    }

    if (!code) {
      return NextResponse.json({
        success: false,
        error: { code: 'NO_CODE', message: '인증 코드가 없습니다.' }
      }, { status: 400 });
    }

    // 중복 요청 방지 - 이미 처리된 코드인지 확인
    const cachedResult = processedCodes.get(code);
    if (cachedResult) {
      console.log('✅ [KAKAO-SIMPLE] 캐시된 결과 반환:', code.substring(0, 10) + '...');
      return NextResponse.json(cachedResult.response);
    }

    // 현재 처리 중인 코드인지 확인
    const ongoingProcess = processingCodes.get(code);
    if (ongoingProcess) {
      console.log('⏳ [KAKAO-SIMPLE] 이미 처리 중인 코드, 대기:', code.substring(0, 10) + '...');
      return await ongoingProcess;
    }

    console.log('🔄 [KAKAO-SIMPLE] 토큰 교환 시작');

    // 새로운 처리 시작 - Promise를 캐시에 저장
    const processingPromise = processKakaoLogin(code, request);
    processingCodes.set(code, processingPromise);

    try {
      const result = await processingPromise;

      // 처리 완료 후 결과 캐시
      const responseData = await result.json();
      processedCodes.set(code, {
        response: responseData,
        timestamp: Date.now()
      });

      return NextResponse.json(responseData);
    } finally {
      // 처리 중 캐시에서 제거
      processingCodes.delete(code);
    }

  } catch (error) {
    console.error('❌ [KAKAO-SIMPLE] 처리 실패:', error);
    return NextResponse.json({
      success: false,
      error: {
        code: 'LOGIN_ERROR',
        message: error instanceof Error ? error.message : '카카오 로그인 처리 중 오류가 발생했습니다.'
      }
    }, { status: 500 });
  }
}

// 실제 카카오 로그인 처리 함수
async function processKakaoLogin(code: string, request: NextRequest): Promise<NextResponse> {
  // 1. 코드를 토큰으로 교환
  const tokenData = await exchangeCodeForToken(code);
  console.log('✅ [KAKAO-SIMPLE] 토큰 교환 완료');

  // 2. 사용자 정보 조회
  const userInfo = await getKakaoUserInfo(tokenData.access_token);
  console.log('👤 [KAKAO-SIMPLE] 사용자 정보 조회 완료:', userInfo.kakao_account?.email);

  // 3. 사용자 자동 생성 또는 로그인
  const userResult = await createUserDirectly(userInfo);

  // 4. JWT 토큰 생성
  const jwtToken = generateToken({
    id: userResult.employee.id,
    email: userResult.employee.email,
    name: userResult.employee.name,
    permission_level: userResult.employee.permission_level
  });

  // 5. 로그인 기록
  await supabaseAdmin
    .from('login_attempts')
    .insert({
      email: userResult.employee.email,
      ip_address: request.ip || 'unknown',
      user_agent: request.headers.get('user-agent') || 'unknown',
      login_method: 'kakao',
      success: true,
      employee_id: userResult.employee.id
    });

  // 6. 마지막 로그인 시간 업데이트
  await supabaseAdmin
    .from('employees')
    .update({ last_login_at: new Date().toISOString() })
    .eq('id', userResult.employee.id);

  console.log('🎉 [KAKAO-SIMPLE] 로그인 성공:', userResult.employee.email);

  // 7. 응답 반환
  const response = NextResponse.json({
    success: true,
    data: {
      message: userResult.isNewUser ? '카카오 계정으로 가입되었습니다!' : '카카오로 로그인되었습니다!',
      user: {
        id: userResult.employee.id,
        email: userResult.employee.email,
        name: userResult.employee.name,
        permission_level: userResult.employee.permission_level,
        employee_id: userResult.employee.employee_id,
        department: userResult.employee.department,
        position: userResult.employee.position
      },
      isNewUser: userResult.isNewUser,
      provider: 'kakao',
      token: jwtToken
    }
  });

  // JWT 토큰을 쿠키에 설정
  response.cookies.set('auth-token', jwtToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 24 * 60 * 60 // 24시간
  });

  return response;
}