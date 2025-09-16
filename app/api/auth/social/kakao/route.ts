import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { generateToken } from '@/utils/auth';
import { validateInput, ValidationSchemas } from '@/lib/security/input-validation';

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

  const response = await fetch(tokenUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: params.toString()
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error('❌ [KAKAO] 토큰 교환 실패:', errorText);
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

  // 기본 정책 (가장 제한적)
  return policy || {
    auto_approve: false,
    default_permission_level: 1,
    default_department: null,
    require_admin_approval: true
  };
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

    console.log('🔐 [KAKAO] 로그인 시작:', { code: code.substring(0, 10) + '...' });

    // 1. 카카오에서 액세스 토큰 교환
    const tokenData = await exchangeCodeForToken(code);
    console.log('✅ [KAKAO] 토큰 교환 성공');

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

    // 4. 기존 소셜 계정 확인
    const { data: existingSocialAccount } = await supabaseAdmin
      .from('social_accounts')
      .select(`
        *,
        employees:employee_id (
          id, name, email, permission_level, is_active, is_deleted
        )
      `)
      .eq('provider', 'kakao')
      .eq('provider_user_id', kakaoUser.id.toString())
      .eq('is_active', true)
      .single();

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
          token_expires_at: new Date(Date.now() + tokenData.expires_in * 1000).toISOString(),
          last_login_at: new Date().toISOString(),
          provider_email: email,
          provider_name: name,
          provider_picture_url: profileImage
        })
        .eq('id', existingSocialAccount.id);

      // JWT 토큰 생성
      const jwtToken = generateToken({
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

    // 6. 신규 사용자 처리
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
          employee_id: employeeId,
          provider: 'kakao',
          provider_user_id: kakaoUser.id.toString(),
          provider_email: email,
          provider_name: name,
          provider_picture_url: profileImage,
          access_token: tokenData.access_token,
          refresh_token: tokenData.refresh_token,
          token_expires_at: new Date(Date.now() + tokenData.expires_in * 1000).toISOString(),
          is_primary: true,
          connected_at: new Date().toISOString(),
          last_login_at: new Date().toISOString()
        });

      // 로그인 시도 기록
      await supabaseAdmin.rpc('record_login_attempt', {
        p_email: email,
        p_provider: 'kakao',
        p_ip_address: ip,
        p_user_agent: userAgent,
        p_success: true,
        p_employee_id: employeeId
      });

      // JWT 토큰 생성
      const jwtToken = generateToken({
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
      // 수동 승인 필요 - 승인 요청 생성
      const { data: approvalRequest, error: approvalError } = await supabaseAdmin
        .from('social_auth_approvals')
        .insert({
          requester_name: name,
          requester_email: email,
          provider: 'kakao',
          provider_user_id: kakaoUser.id.toString(),
          requested_permission_level: policy.default_permission_level,
          requested_department: policy.default_department,
          approval_status: 'pending'
        })
        .select()
        .single();

      if (approvalError) {
        console.error('❌ [KAKAO] 승인 요청 생성 실패:', approvalError);
        return NextResponse.json({
          success: false,
          error: {
            code: 'APPROVAL_REQUEST_FAILED',
            message: '승인 요청 생성에 실패했습니다.'
          }
        }, { status: 500 });
      }

      // 로그인 시도 기록 (승인 대기)
      await supabaseAdmin.rpc('record_login_attempt', {
        p_email: email,
        p_provider: 'kakao',
        p_ip_address: ip,
        p_user_agent: userAgent,
        p_success: false,
        p_failure_reason: 'APPROVAL_PENDING'
      });

      console.log('⏳ [KAKAO] 승인 요청 생성 완료:', email);

      return NextResponse.json({
        success: false,
        error: {
          code: 'APPROVAL_PENDING',
          message: '계정 승인이 필요합니다. 관리자 승인 후 다시 로그인해주세요.',
          details: {
            requestId: approvalRequest.id,
            estimatedProcessingTime: '1-2 영업일'
          }
        }
      }, { status: 202 }); // 202 Accepted
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