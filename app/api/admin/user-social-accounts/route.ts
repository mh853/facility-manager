// app/api/admin/user-social-accounts/route.ts - 사용자 소셜 계정 관리 API
import { NextRequest } from 'next/server';
import { withApiHandler, createSuccessResponse, createErrorResponse } from '@/lib/api-utils';
import { supabaseAdmin } from '@/lib/supabase';

// 소셜 계정 정보 타입
export interface UserSocialAccount {
  id: string;
  user_id: string;
  provider: 'google' | 'kakao' | 'naver';
  provider_user_id: string;
  provider_email: string;
  provider_name: string;
  provider_picture_url?: string;
  connected_at: string;
  last_login_at?: string;
  is_primary: boolean;
  is_active: boolean;
}

// GET: 특정 사용자의 소셜 계정 목록 조회
export const GET = withApiHandler(async (request: NextRequest) => {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');

    console.log('👤 [USER-SOCIAL] 소셜 계정 조회:', { userId });

    if (!userId) {
      return createErrorResponse('사용자 ID가 필요합니다', 400);
    }

    // 사용자 소셜 계정 조회
    const { data: socialAccounts, error } = await supabaseAdmin
      .from('social_accounts')
      .select(`
        id,
        user_id,
        provider,
        provider_user_id,
        provider_email,
        provider_name,
        provider_picture_url,
        connected_at,
        last_login_at,
        is_primary,
        is_active
      `)
      .eq('user_id', userId)
      .eq('is_active', true)
      .order('connected_at', { ascending: false });

    if (error) {
      console.error('🔴 [USER-SOCIAL] 소셜 계정 조회 오류:', error);
      throw error;
    }

    // 사용자 기본 정보도 함께 조회
    const { data: user, error: userError } = await supabaseAdmin
      .from('employees')
      .select('id, name, email')
      .eq('id', userId)
      .single();

    if (userError) {
      console.error('🔴 [USER-SOCIAL] 사용자 조회 오류:', userError);
      throw userError;
    }

    console.log('✅ [USER-SOCIAL] 조회 성공:', socialAccounts?.length || 0, '개 계정');

    return createSuccessResponse({
      user: {
        id: user.id,
        name: user.name,
        email: user.email
      },
      socialAccounts: socialAccounts || [],
      summary: {
        totalAccounts: socialAccounts?.length || 0,
        providers: [...new Set(socialAccounts?.map(acc => acc.provider) || [])]
      }
    });

  } catch (error: any) {
    console.error('🔴 [USER-SOCIAL] GET 오류:', error?.message || error);
    return createErrorResponse('소셜 계정 조회 중 오류가 발생했습니다', 500);
  }
}, { logLevel: 'debug' });

// DELETE: 소셜 계정 연결 해제
export const DELETE = withApiHandler(async (request: NextRequest) => {
  try {
    const { searchParams } = new URL(request.url);
    const socialAccountId = searchParams.get('socialAccountId');

    console.log('🗑️ [USER-SOCIAL] 소셜 계정 연결 해제:', { socialAccountId });

    if (!socialAccountId) {
      return createErrorResponse('소셜 계정 ID가 필요합니다', 400);
    }

    // 소셜 계정 정보 조회 (삭제 전 확인)
    const { data: socialAccount, error: fetchError } = await supabaseAdmin
      .from('social_accounts')
      .select('*')
      .eq('id', socialAccountId)
      .single();

    if (fetchError || !socialAccount) {
      console.error('🔴 [USER-SOCIAL] 소셜 계정 조회 실패:', fetchError);
      return createErrorResponse('소셜 계정을 찾을 수 없습니다', 404);
    }

    // 주 계정인지 확인 (주 계정은 삭제 불가)
    if (socialAccount.is_primary) {
      return createErrorResponse('주 소셜 계정은 연결 해제할 수 없습니다', 400);
    }

    // 소셜 계정 비활성화 (완전 삭제 대신)
    const { data: updatedAccount, error } = await supabaseAdmin
      .from('social_accounts')
      .update({
        is_active: false,
        disconnected_at: new Date().toISOString()
      })
      .eq('id', socialAccountId)
      .select()
      .single();

    if (error) {
      console.error('🔴 [USER-SOCIAL] 연결 해제 오류:', error);
      throw error;
    }

    console.log('✅ [USER-SOCIAL] 연결 해제 성공:', socialAccount.provider);

    return createSuccessResponse({
      message: `${socialAccount.provider} 계정 연결이 해제되었습니다`,
      disconnectedAccount: {
        provider: socialAccount.provider,
        provider_email: socialAccount.provider_email
      }
    });

  } catch (error: any) {
    console.error('🔴 [USER-SOCIAL] DELETE 오류:', error?.message || error);
    return createErrorResponse('소셜 계정 연결 해제 중 오류가 발생했습니다', 500);
  }
}, { logLevel: 'debug' });

// PUT: 주 소셜 계정 변경
export const PUT = withApiHandler(async (request: NextRequest) => {
  try {
    const body = await request.json();
    const { socialAccountId, action } = body;

    console.log('🔄 [USER-SOCIAL] 소셜 계정 수정:', { socialAccountId, action });

    if (!socialAccountId) {
      return createErrorResponse('소셜 계정 ID가 필요합니다', 400);
    }

    if (action === 'set_primary') {
      // 소셜 계정 정보 조회
      const { data: socialAccount, error: fetchError } = await supabaseAdmin
        .from('social_accounts')
        .select('user_id, provider')
        .eq('id', socialAccountId)
        .eq('is_active', true)
        .single();

      if (fetchError || !socialAccount) {
        return createErrorResponse('소셜 계정을 찾을 수 없습니다', 404);
      }

      // 해당 사용자의 모든 소셜 계정을 주 계정에서 해제
      await supabaseAdmin
        .from('social_accounts')
        .update({ is_primary: false })
        .eq('user_id', socialAccount.user_id)
        .eq('is_active', true);

      // 선택된 계정을 주 계정으로 설정
      const { data: updatedAccount, error } = await supabaseAdmin
        .from('social_accounts')
        .update({ is_primary: true })
        .eq('id', socialAccountId)
        .select()
        .single();

      if (error) {
        console.error('🔴 [USER-SOCIAL] 주 계정 설정 오류:', error);
        throw error;
      }

      console.log('✅ [USER-SOCIAL] 주 계정 설정 성공:', socialAccount.provider);

      return createSuccessResponse({
        message: `${socialAccount.provider} 계정이 주 계정으로 설정되었습니다`,
        primaryAccount: {
          id: socialAccountId,
          provider: socialAccount.provider
        }
      });
    }

    return createErrorResponse('지원하지 않는 작업입니다', 400);

  } catch (error: any) {
    console.error('🔴 [USER-SOCIAL] PUT 오류:', error?.message || error);
    return createErrorResponse('소셜 계정 수정 중 오류가 발생했습니다', 500);
  }
}, { logLevel: 'debug' });