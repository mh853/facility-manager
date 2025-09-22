import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { createToken } from '@/utils/auth';
import { validateInput, ValidationSchemas } from '@/lib/security/input-validation';

// Force dynamic rendering for API routes
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';


// 카카오 API 정보
const KAKAO_CLIENT_ID = process.env.NEXT_PUBLIC_KAKAO_CLIENT_ID;
const KAKAO_CLIENT_SECRET = process.env.KAKAO_CLIENT_SECRET;
const KAKAO_REDIRECT_URI = process.env.NEXTAUTH_URL + '/api/auth/social/kakao/callback';

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

// 카카오 토큰 응답 인터페이스
interface KakaoTokenResponse {
  access_token: string;
  token_type: string;
  refresh_token: string;
  expires_in: number;
  scope?: string;
  refresh_token_expires_in?: number;
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

  console.log('🔐 [KAKAO] 토큰 교환 요청:', {
    url: tokenUrl,
    clientId: KAKAO_CLIENT_ID?.substring(0, 10) + '...',
    redirectUri: KAKAO_REDIRECT_URI,
    codeLength: code.length,
    hasClientSecret: !!KAKAO_CLIENT_SECRET
  });

  const response = await fetch(tokenUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: params.toString()
  });

  console.log('📊 [KAKAO] 토큰 교환 응답:', {
    status: response.status,
    statusText: response.statusText,
    headers: Object.fromEntries(response.headers.entries())
  });

  if (!response.ok) {
    let errorResponse;
    try {
      errorResponse = await response.json();
      console.error('❌ [KAKAO] 토큰 교환 실패 - JSON 응답:', errorResponse);
    } catch (jsonError) {
      const errorText = await response.text();
      console.error('❌ [KAKAO] 토큰 교환 실패 - 텍스트 응답:', errorText);
      errorResponse = { error: 'non_json_response', error_description: errorText };
    }

    console.error('❌ [KAKAO] 토큰 교환 전체 오류 정보:', {
      status: response.status,
      statusText: response.statusText,
      error: errorResponse,
      requestParams: {
        grant_type: 'authorization_code',
        client_id: KAKAO_CLIENT_ID?.substring(0, 10) + '...',
        redirect_uri: KAKAO_REDIRECT_URI,
        code: code.substring(0, 10) + '...'
      }
    });

    throw new Error(`카카오 토큰 교환 실패: ${response.status} - ${errorResponse?.error || errorResponse?.error_description || '알 수 없는 오류'}`);
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
    console.error('❌ [KAKAO] 사용자 정보 조회 실패:', errorText);
    throw new Error(`카카오 사용자 정보 조회 실패: ${response.status}`);
  }

  return await response.json();
}

async function getEmailDomainPolicy(email: string) {
  const domain = email.split('@')[1]?.toLowerCase();

  const { data: policy } = await supabaseAdmin
    .from('social_auth_policies')
    .select('*')
    .eq('email_domain', domain)
    .eq('is_active', true)
    .single();

  // 기본 정책 (가장 제한적) - 모든 외부 도메인은 자동 승인으로 설정
  return policy || {
    auto_approve: true, // 개발/테스트용으로 자동 승인 활성화
    default_permission_level: 1,
    default_department: null,
    require_admin_approval: false
  };
}

// GET: 카카오 로그인 URL 생성 및 리다이렉트
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const redirectUri = searchParams.get('redirect_uri') ||
                       `${process.env.NEXTAUTH_URL}/api/auth/social/kakao/callback`;

    console.log('🔐 [KAKAO-LOGIN] 카카오 로그인 요청 받음');

    if (!KAKAO_CLIENT_ID) {
      return NextResponse.json({
        success: false,
        error: {
          code: 'MISSING_CONFIG',
          message: 'KAKAO_CLIENT_ID가 설정되지 않았습니다.'
        }
      }, { status: 500 });
    }

    // 상태값 생성 (CSRF 보호)
    const state = Math.random().toString(36).substring(2, 15);

    // 카카오 OAuth URL 생성
    const kakaoAuthUrl = new URL('https://kauth.kakao.com/oauth/authorize');
    kakaoAuthUrl.searchParams.append('client_id', KAKAO_CLIENT_ID);
    kakaoAuthUrl.searchParams.append('redirect_uri', redirectUri);
    kakaoAuthUrl.searchParams.append('response_type', 'code');
    kakaoAuthUrl.searchParams.append('state', state);
    kakaoAuthUrl.searchParams.append('scope', 'profile_nickname,account_email');

    console.log('🎯 [KAKAO-LOGIN] 카카오 로그인 URL 생성:', {
      clientId: KAKAO_CLIENT_ID.substring(0, 10) + '...',
      redirectUri,
      state
    });

    // 카카오 로그인 페이지로 리다이렉트
    return NextResponse.redirect(kakaoAuthUrl.toString());

  } catch (error: any) {
    console.error('🔴 [KAKAO-LOGIN] GET 오류:', error?.message || error);
    return NextResponse.json({
      success: false,
      error: {
        code: 'KAKAO_AUTH_ERROR',
        message: '카카오 로그인 URL 생성 중 오류가 발생했습니다.'
      }
    }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const ip = request.ip || request.headers.get('x-forwarded-for') || 'unknown';
    const userAgent = request.headers.get('user-agent') || 'unknown';

    // 입력 검증
    const validation = validateInput(ValidationSchemas.socialToken, body.code);
    if (!validation.success) {
      return NextResponse.json({
        success: false,
        error: {
          code: 'INVALID_INPUT',
          message: validation.errors?.[0] || '유효하지 않은 입력입니다.'
        }
      }, { status: 400 });
    }

    const { code } = body;

    console.log('🔐 [KAKAO] 로그인 시작:', {
      code: code.substring(0, 10) + '...',
      codeLength: code.length
    });

    console.log('🔧 [KAKAO] 환경 변수 확인:', {
      hasClientId: !!KAKAO_CLIENT_ID,
      hasClientSecret: !!KAKAO_CLIENT_SECRET,
      clientIdPrefix: KAKAO_CLIENT_ID?.substring(0, 10) + '...',
      redirectUri: KAKAO_REDIRECT_URI,
      nextAuthUrl: process.env.NEXTAUTH_URL
    });

    // 1. 카카오에서 액세스 토큰 교환
    const tokenData = await exchangeCodeForToken(code);
    console.log('✅ [KAKAO] 토큰 교환 성공:', {
      hasAccessToken: !!tokenData.access_token,
      tokenType: tokenData.token_type,
      expiresIn: tokenData.expires_in
    });

    // 2. 카카오 사용자 정보 조회
    const kakaoUser = await getKakaoUserInfo(tokenData.access_token);
    console.log('✅ [KAKAO] 사용자 정보 조회 성공:', {
      id: kakaoUser.id,
      nickname: kakaoUser.properties?.nickname,
      email: kakaoUser.kakao_account?.email
    });

    if (!kakaoUser.kakao_account?.email) {
      return NextResponse.json({
        success: false,
        error: {
          code: 'EMAIL_NOT_PROVIDED',
          message: '카카오 계정에서 이메일 정보를 제공하지 않습니다. 카카오 계정 설정에서 이메일을 공개로 설정해주세요.'
        }
      }, { status: 400 });
    }

    const email = kakaoUser.kakao_account.email;
    const name = kakaoUser.properties?.nickname || kakaoUser.kakao_account.profile?.nickname;
    const profileImage = kakaoUser.kakao_account.profile?.profile_image_url;

    // 3. 이메일 도메인 정책 확인
    const policy = await getEmailDomainPolicy(email);
    console.log('📋 [KAKAO] 도메인 정책:', { email, policy });

    // 4. 기존 소셜 계정 확인 (테이블이 없으면 건너뛰기)
    let existingSocialAccount = null;
    try {
      const { data } = await supabaseAdmin
        .from('social_accounts')
        .select(`
          *,
          employees:user_id (
            id, name, email, permission_level, is_active, is_deleted
          )
        `)
        .eq('provider', 'kakao')
        .eq('provider_id', kakaoUser.id.toString())
        .eq('is_active', true)
        .single();
      existingSocialAccount = data;
    } catch (socialError: any) {
      console.log('⚠️ [KAKAO] social_accounts 테이블 확인 실패, 건너뛰기:', socialError.message);
    }

    // 5. 기존 계정이 있는 경우 - 로그인 처리
    if (existingSocialAccount?.employees) {
      const employee = existingSocialAccount.employees as any;

      if (!employee.is_active || employee.is_deleted) {
        return NextResponse.json({
          success: false,
          error: {
            code: 'ACCOUNT_DISABLED',
            message: '비활성화된 계정입니다. 관리자에게 문의하세요.'
          }
        }, { status: 403 });
      }

      // 로그인 시도 기록
      await supabaseAdmin.rpc('record_login_attempt', {
        p_email: email,
        p_provider: 'kakao',
        p_ip_address: ip,
        p_user_agent: userAgent,
        p_success: true,
        p_employee_id: employee.id
      });

      // 소셜 계정 정보 업데이트
      await supabaseAdmin
        .from('social_accounts')
        .update({
          access_token: tokenData.access_token,
          refresh_token: tokenData.refresh_token,
          expires_at: new Date(Date.now() + tokenData.expires_in * 1000).toISOString(),
          last_used_at: new Date().toISOString()
        })
        .eq('id', existingSocialAccount.id);

      // JWT 토큰 생성
      const jwtToken = createToken({
        id: employee.id,
        email: employee.email,
        name: employee.name,
        permission_level: employee.permission_level
      });

      console.log('✅ [KAKAO] 기존 사용자 로그인 성공:', employee.email);

      return NextResponse.json({
        success: true,
        data: {
          token: jwtToken,
          user: {
            id: employee.id,
            name: employee.name,
            email: employee.email,
            permission_level: employee.permission_level
          },
          isNewUser: false
        }
      });
    }

    // 6. 이메일로 기존 직원 계정 확인 (소셜 연동되지 않은 기존 계정)
    const { data: existingEmployee } = await supabaseAdmin
      .from('employees')
      .select('id, name, email, permission_level, is_active, is_deleted')
      .eq('email', email)
      .eq('is_active', true)
      .single();

    if (existingEmployee) {
      console.log('🔄 [KAKAO] 기존 이메일 계정 발견, 소셜 계정 연동:', email);

      // 기존 직원 계정에 소셜 계정 연동 (테이블이 없으면 건너뛰기)
      try {
        const { data: newSocialAccount, error: socialError } = await supabaseAdmin
          .from('social_accounts')
          .upsert({
            user_id: existingEmployee.id,
            provider: 'kakao',
            provider_id: kakaoUser.id.toString(),
            access_token: tokenData.access_token,
            refresh_token: tokenData.refresh_token,
            expires_at: new Date(Date.now() + tokenData.expires_in * 1000).toISOString(),
            provider_data: {
              email: email,
              name: name,
              profile_image: profileImage
            },
            is_active: true,
            connected_at: new Date().toISOString(),
            last_used_at: new Date().toISOString()
          }, {
            onConflict: 'provider,provider_id',
            ignoreDuplicates: false
          })
          .select()
          .single();

        if (socialError) {
          console.log('⚠️ [KAKAO] 소셜 계정 연동 실패하지만 로그인 진행:', socialError.message);
        } else {
          console.log('✅ [KAKAO] 소셜 계정 연동 성공');
        }
      } catch (linkError: any) {
        console.log('⚠️ [KAKAO] 소셜 계정 테이블 없음, 연동 건너뛰기:', linkError.message);
      }

      // 로그인 시도 기록
      await supabaseAdmin.rpc('record_login_attempt', {
        p_email: email,
        p_provider: 'kakao',
        p_ip_address: ip,
        p_user_agent: userAgent,
        p_success: true,
        p_user_id: existingEmployee.id
      });

      // JWT 토큰 생성
      const jwtToken = createToken({
        id: existingEmployee.id,
        email: existingEmployee.email,
        name: existingEmployee.name,
        permission_level: existingEmployee.permission_level
      });

      console.log('✅ [KAKAO] 기존 계정 소셜 연동 및 로그인 성공:', email);

      return NextResponse.json({
        success: true,
        data: {
          token: jwtToken,
          user: {
            id: existingEmployee.id,
            name: existingEmployee.name,
            email: existingEmployee.email,
            permission_level: existingEmployee.permission_level
          },
          isNewUser: false,
          socialLinked: true
        }
      });
    }

    // 7. 신규 사용자 처리
    if (policy.auto_approve) {
      // 자동 승인된 도메인 - 직원 계정 생성
      const employeeId = crypto.randomUUID();

      // 직원 계정 생성
      const { data: newEmployee, error: employeeError } = await supabaseAdmin
        .from('employees')
        .insert({
          id: employeeId,
          employee_id: `SOCIAL_${Date.now()}`, // 임시 사번
          name: name,
          email: email,
          permission_level: policy.default_permission_level,
          department: policy.default_department,
          position: '소셜 로그인 사용자',
          is_active: true,
          social_login_enabled: true,
          created_by_social: true
        })
        .select()
        .single();

      if (employeeError || !newEmployee) {
        console.error('❌ [KAKAO] 직원 계정 생성 실패:', employeeError);
        return NextResponse.json({
          success: false,
          error: {
            code: 'ACCOUNT_CREATION_FAILED',
            message: '계정 생성에 실패했습니다.'
          }
        }, { status: 500 });
      }

      // 소셜 계정 연결
      await supabaseAdmin
        .from('social_accounts')
        .insert({
          user_id: employeeId,
          provider: 'kakao',
          provider_id: kakaoUser.id.toString(),
          provider_email: email,
          provider_name: name,
          provider_picture_url: profileImage,
          access_token: tokenData.access_token,
          refresh_token: tokenData.refresh_token,
          expires_at: new Date(Date.now() + tokenData.expires_in * 1000).toISOString(),
          is_primary: true,
          connected_at: new Date().toISOString(),
          last_used_at: new Date().toISOString()
        });

      // 로그인 시도 기록
      await supabaseAdmin.rpc('record_login_attempt', {
        p_email: email,
        p_provider: 'kakao',
        p_ip_address: ip,
        p_user_agent: userAgent,
        p_success: true,
        p_user_id: employeeId
      });

      // JWT 토큰 생성
      const jwtToken = createToken({
        id: newEmployee.id,
        email: newEmployee.email,
        name: newEmployee.name,
        permission_level: newEmployee.permission_level
      });

      console.log('✅ [KAKAO] 신규 사용자 자동 승인 완료:', email);

      return NextResponse.json({
        success: true,
        data: {
          token: jwtToken,
          user: {
            id: newEmployee.id,
            name: newEmployee.name,
            email: newEmployee.email,
            permission_level: newEmployee.permission_level
          },
          isNewUser: true
        }
      });

    } else {
      // 수동 승인 필요한 경우 - 임시로 자동 승인 처리 (테스트용)
      // TODO: 나중에 실제 승인 시스템 구현시 social_auth_approvals 테이블 생성 필요
      console.log('⚠️ [KAKAO] 수동 승인 필요하지만 임시로 자동 승인 처리:', email);

      // 임시로 자동 승인으로 처리 - 직원 계정 생성
      const employeeId = crypto.randomUUID();

      const { data: newEmployee, error: employeeError } = await supabaseAdmin
        .from('employees')
        .insert({
          id: employeeId,
          employee_id: `SOCIAL_${Date.now()}`, // 임시 사번
          name: name,
          email: email,
          permission_level: policy.default_permission_level,
          department: policy.default_department,
          position: '소셜 로그인 사용자',
          is_active: true,
          social_login_enabled: true,
          created_by_social: true
        })
        .select()
        .single();

      if (employeeError || !newEmployee) {
        console.error('❌ [KAKAO] 직원 계정 생성 실패:', employeeError);
        return NextResponse.json({
          success: false,
          error: {
            code: 'ACCOUNT_CREATION_FAILED',
            message: '계정 생성에 실패했습니다.'
          }
        }, { status: 500 });
      }

      // 소셜 계정 연결 (테이블이 없으면 건너뛰기)
      try {
        await supabaseAdmin
          .from('social_accounts')
          .insert({
            user_id: employeeId,
            provider: 'kakao',
            provider_id: kakaoUser.id.toString(),
            access_token: tokenData.access_token,
            refresh_token: tokenData.refresh_token,
            expires_at: new Date(Date.now() + tokenData.expires_in * 1000).toISOString(),
            provider_data: {
              email: email,
              name: name,
              profile_image: profileImage
            },
            is_active: true,
            connected_at: new Date().toISOString(),
            last_used_at: new Date().toISOString()
          });
        console.log('✅ [KAKAO] 신규 사용자 소셜 계정 연결 성공');
      } catch (linkError: any) {
        console.log('⚠️ [KAKAO] 소셜 계정 테이블 없음, 연결 건너뛰기:', linkError.message);
      }

      // 로그인 시도 기록
      await supabaseAdmin.rpc('record_login_attempt', {
        p_email: email,
        p_provider: 'kakao',
        p_ip_address: ip,
        p_user_agent: userAgent,
        p_success: true,
        p_user_id: employeeId
      });

      // JWT 토큰 생성
      const jwtToken = createToken({
        id: newEmployee.id,
        email: newEmployee.email,
        name: newEmployee.name,
        permission_level: newEmployee.permission_level
      });

      console.log('✅ [KAKAO] 임시 자동 승인으로 신규 사용자 생성 완료:', email);

      return NextResponse.json({
        success: true,
        data: {
          token: jwtToken,
          user: {
            id: newEmployee.id,
            name: newEmployee.name,
            email: newEmployee.email,
            permission_level: newEmployee.permission_level
          },
          isNewUser: true
        }
      });
    }

  } catch (error) {
    console.error('❌ [KAKAO] 로그인 오류:', error);

    // 로그인 시도 기록 (실패)
    try {
      const ip = request.ip || 'unknown';
      const userAgent = request.headers.get('user-agent') || 'unknown';

      await supabaseAdmin.rpc('record_login_attempt', {
        p_email: null,
        p_provider: 'kakao',
        p_ip_address: ip,
        p_user_agent: userAgent,
        p_success: false,
        p_failure_reason: 'SYSTEM_ERROR'
      });
    } catch (logError) {
      console.error('로그인 시도 기록 실패:', logError);
    }

    return NextResponse.json({
      success: false,
      error: {
        code: 'KAKAO_LOGIN_ERROR',
        message: '카카오 로그인 중 오류가 발생했습니다.',
        details: error instanceof Error ? error.message : String(error)
      }
    }, { status: 500 });
  }
}