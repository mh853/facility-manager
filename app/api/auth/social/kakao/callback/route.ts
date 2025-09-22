import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { supabaseAdmin } from '@/lib/supabase';
import { createToken } from '@/utils/auth';

// Force dynamic rendering for API routes
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// 카카오 API 정보
const KAKAO_CLIENT_ID = process.env.NEXT_PUBLIC_KAKAO_CLIENT_ID;
const KAKAO_CLIENT_SECRET = process.env.KAKAO_CLIENT_SECRET;
const KAKAO_REDIRECT_URI = process.env.NEXTAUTH_URL + '/api/auth/social/kakao/callback';

// 카카오 토큰 응답 인터페이스
interface KakaoTokenResponse {
  access_token: string;
  token_type: string;
  refresh_token: string;
  expires_in: number;
  scope?: string;
  refresh_token_expires_in?: number;
}

// 카카오 사용자 정보 인터페이스
interface KakaoUserInfo {
  id: number;
  connected_at: string;
  properties: {
    nickname: string;
    profile_image?: string;
    thumbnail_image?: string;
  };
  kakao_account: {
    profile_nickname_needs_agreement: boolean;
    profile_image_needs_agreement: boolean;
    profile: {
      nickname: string;
      thumbnail_image_url?: string;
      profile_image_url?: string;
    };
    has_email: boolean;
    email_needs_agreement: boolean;
    is_email_valid: boolean;
    is_email_verified: boolean;
    email: string;
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

  console.log('🔐 [KAKAO-CALLBACK] 토큰 교환 요청:', {
    url: tokenUrl,
    clientId: KAKAO_CLIENT_ID?.substring(0, 10) + '...',
    redirectUri: KAKAO_REDIRECT_URI,
    codeLength: code.length
  });

  const response = await fetch(tokenUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: params.toString()
  });

  console.log('📊 [KAKAO-CALLBACK] 토큰 교환 응답:', {
    status: response.status,
    statusText: response.statusText
  });

  if (!response.ok) {
    let errorResponse;
    try {
      errorResponse = await response.json();
      console.error('❌ [KAKAO-CALLBACK] 토큰 교환 실패 - JSON 응답:', errorResponse);
    } catch (jsonError) {
      const errorText = await response.text();
      console.error('❌ [KAKAO-CALLBACK] 토큰 교환 실패 - 텍스트 응답:', errorText);
      errorResponse = { error: 'non_json_response', error_description: errorText };
    }
    throw new Error(`토큰 교환 실패: ${response.status} - ${errorResponse?.error || errorResponse?.error_description || '알 수 없는 오류'}`);
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
    const errorText = await response.text();
    console.error('❌ [KAKAO-CALLBACK] 사용자 정보 조회 실패:', errorText);
    throw new Error(`사용자 정보 조회 실패: ${response.status}`);
  }

  return await response.json();
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const code = searchParams.get('code');
    const error = searchParams.get('error');
    const state = searchParams.get('state');

    console.log('🔄 [KAKAO-CALLBACK] 콜백 처리 시작:', {
      code: code?.substring(0, 10) + '...',
      error,
      state,
      codeLength: code?.length
    });

    // 오류 처리
    if (error) {
      console.error('🔴 [KAKAO-CALLBACK] 카카오 로그인 오류:', error);
      return NextResponse.redirect(new URL('/login?error=kakao_login_failed', request.url));
    }

    if (!code) {
      console.error('🔴 [KAKAO-CALLBACK] 인증 코드가 없음');
      return NextResponse.redirect(new URL('/login?error=no_code', request.url));
    }

    // 1. 카카오에서 액세스 토큰 교환 (직접 처리)
    const tokenData = await exchangeCodeForToken(code);
    console.log('✅ [KAKAO-CALLBACK] 토큰 교환 성공');

    // 2. 카카오 사용자 정보 조회
    const kakaoUser = await getKakaoUserInfo(tokenData.access_token);
    console.log('✅ [KAKAO-CALLBACK] 사용자 정보 조회 성공:', {
      id: kakaoUser.id,
      nickname: kakaoUser.properties?.nickname,
      email: kakaoUser.kakao_account?.email
    });

    if (!kakaoUser.kakao_account?.email) {
      return NextResponse.redirect(new URL('/login?error=no_email', request.url));
    }

    const email = kakaoUser.kakao_account.email;
    const name = kakaoUser.properties?.nickname || kakaoUser.kakao_account.profile?.nickname;

    // 3. 사용자 계정 처리 (간단한 자동 생성)
    const employeeId = crypto.randomUUID();

    try {
      const { data: newEmployee, error: employeeError } = await supabaseAdmin
        .from('employees')
        .insert({
          id: employeeId,
          employee_id: `SOCIAL_${Date.now()}`,
          name: name,
          email: email,
          permission_level: 1,
          position: '소셜 로그인 사용자',
          is_active: true,
          social_login_enabled: true,
          created_by_social: true
        })
        .select()
        .single();

      if (employeeError) {
        // 이미 존재하는 경우 기존 사용자 조회
        const { data: existingEmployee } = await supabaseAdmin
          .from('employees')
          .select('*')
          .eq('email', email)
          .eq('is_active', true)
          .single();

        if (existingEmployee) {
          // JWT 토큰 생성
          const jwtToken = createToken({
            id: existingEmployee.id,
            email: existingEmployee.email,
            name: existingEmployee.name,
            permission_level: existingEmployee.permission_level
          });

          console.log('✅ [KAKAO-CALLBACK] 기존 사용자 로그인 성공:', email);

          // 쿠키에 토큰 저장
          const cookieStore = cookies();
          cookieStore.set('facility_manager_token', jwtToken, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'lax',
            maxAge: 365 * 24 * 60 * 60,
            path: '/'
          });

          return NextResponse.redirect(new URL('/admin', request.url));
        } else {
          throw new Error('사용자 계정 생성 및 조회 실패');
        }
      } else {
        // 신규 사용자 생성 성공
        const jwtToken = createToken({
          id: newEmployee.id,
          email: newEmployee.email,
          name: newEmployee.name,
          permission_level: newEmployee.permission_level
        });

        console.log('✅ [KAKAO-CALLBACK] 신규 사용자 생성 및 로그인 성공:', email);

        // 쿠키에 토큰 저장
        const cookieStore = cookies();
        cookieStore.set('facility_manager_token', jwtToken, {
          httpOnly: true,
          secure: process.env.NODE_ENV === 'production',
          sameSite: 'lax',
          maxAge: 365 * 24 * 60 * 60,
          path: '/'
        });

        return NextResponse.redirect(new URL('/admin', request.url));
      }
    } catch (dbError: any) {
      console.error('❌ [KAKAO-CALLBACK] 데이터베이스 오류:', dbError);
      return NextResponse.redirect(new URL('/login?error=database_error', request.url));
    }

  } catch (error: any) {
    console.error('🔴 [KAKAO-CALLBACK] 콜백 처리 오류:', error);
    const errorParam = encodeURIComponent(error.message || '카카오 로그인 중 오류가 발생했습니다.');
    return NextResponse.redirect(new URL(`/login?error=${errorParam}`, request.url));
  }
}