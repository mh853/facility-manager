// app/api/admin/approval-settings/route.ts - 관리자 승인 시스템 설정 API
import { NextRequest } from 'next/server';
import { withApiHandler, createSuccessResponse, createErrorResponse } from '@/lib/api-utils';
import { supabaseAdmin } from '@/lib/supabase';

// 승인 설정 타입
export interface ApprovalSettings {
  id: string;
  auto_approval_enabled: boolean;
  auto_approval_domains: string[];
  auto_approval_permission_level: number;
  manual_approval_required_for_level_3: boolean;
  notification_emails: string[];
  approval_timeout_hours: number;
  created_at: string;
  updated_at: string;
  updated_by: string;
}

// GET: 현재 승인 설정 조회
export const GET = withApiHandler(async (request: NextRequest) => {
  try {
    console.log('⚙️ [APPROVAL-SETTINGS] 승인 설정 조회');

    // 현재 승인 설정 조회
    const { data: settings, error } = await supabaseAdmin
      .from('approval_settings')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (error && error.code !== 'PGRST116') { // PGRST116 = no rows found
      console.error('🔴 [APPROVAL-SETTINGS] 설정 조회 오류:', error);
      throw error;
    }

    // 기본 설정이 없으면 생성
    if (!settings) {
      const defaultSettings = {
        auto_approval_enabled: true,
        auto_approval_domains: ['@company.com'], // 기본 도메인 예시
        auto_approval_permission_level: 1, // 기본적으로 일반사용자 권한
        manual_approval_required_for_level_3: true, // 관리자 권한은 수동 승인
        notification_emails: [],
        approval_timeout_hours: 24,
        updated_by: 'system'
      };

      const { data: newSettings, error: createError } = await supabaseAdmin
        .from('approval_settings')
        .insert(defaultSettings)
        .select()
        .single();

      if (createError) {
        console.error('🔴 [APPROVAL-SETTINGS] 기본 설정 생성 오류:', createError);
        throw createError;
      }

      console.log('✅ [APPROVAL-SETTINGS] 기본 설정 생성 완료');
      return createSuccessResponse({ settings: newSettings });
    }

    console.log('✅ [APPROVAL-SETTINGS] 설정 조회 완료');
    return createSuccessResponse({ settings });

  } catch (error: any) {
    console.error('🔴 [APPROVAL-SETTINGS] GET 오류:', error?.message || error);
    return createErrorResponse('승인 설정 조회 중 오류가 발생했습니다', 500);
  }
}, { logLevel: 'debug' });

// PUT: 승인 설정 업데이트
export const PUT = withApiHandler(async (request: NextRequest) => {
  try {
    const body = await request.json();
    const {
      auto_approval_enabled,
      auto_approval_domains,
      auto_approval_permission_level,
      manual_approval_required_for_level_3,
      notification_emails,
      approval_timeout_hours,
      updated_by
    } = body;

    console.log('⚙️ [APPROVAL-SETTINGS] 승인 설정 업데이트:', {
      auto_approval_enabled,
      domains_count: auto_approval_domains?.length,
      permission_level: auto_approval_permission_level
    });

    // 유효성 검사
    if (typeof auto_approval_enabled !== 'boolean') {
      return createErrorResponse('자동 승인 활성화 여부는 필수입니다', 400);
    }

    if (!Array.isArray(auto_approval_domains)) {
      return createErrorResponse('자동 승인 도메인 목록은 배열이어야 합니다', 400);
    }

    if (auto_approval_permission_level < 1 || auto_approval_permission_level > 3) {
      return createErrorResponse('권한 레벨은 1~3 사이여야 합니다', 400);
    }

    if (!Array.isArray(notification_emails)) {
      return createErrorResponse('알림 이메일 목록은 배열이어야 합니다', 400);
    }

    if (approval_timeout_hours < 1 || approval_timeout_hours > 168) { // 최대 1주
      return createErrorResponse('승인 타임아웃은 1~168시간 사이여야 합니다', 400);
    }

    // 기존 설정 조회
    const { data: currentSettings, error: fetchError } = await supabaseAdmin
      .from('approval_settings')
      .select('id')
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    const updateData = {
      auto_approval_enabled,
      auto_approval_domains,
      auto_approval_permission_level,
      manual_approval_required_for_level_3: manual_approval_required_for_level_3 ?? true,
      notification_emails,
      approval_timeout_hours,
      updated_at: new Date().toISOString(),
      updated_by: updated_by || 'admin'
    };

    let updatedSettings;

    if (currentSettings) {
      // 기존 설정 업데이트
      const { data, error } = await supabaseAdmin
        .from('approval_settings')
        .update(updateData)
        .eq('id', currentSettings.id)
        .select()
        .single();

      if (error) {
        console.error('🔴 [APPROVAL-SETTINGS] 설정 업데이트 오류:', error);
        throw error;
      }
      updatedSettings = data;
    } else {
      // 새 설정 생성
      const { data, error } = await supabaseAdmin
        .from('approval_settings')
        .insert(updateData)
        .select()
        .single();

      if (error) {
        console.error('🔴 [APPROVAL-SETTINGS] 설정 생성 오류:', error);
        throw error;
      }
      updatedSettings = data;
    }

    console.log('✅ [APPROVAL-SETTINGS] 설정 업데이트 완료');

    return createSuccessResponse({
      message: '승인 설정이 성공적으로 업데이트되었습니다',
      settings: updatedSettings
    });

  } catch (error: any) {
    console.error('🔴 [APPROVAL-SETTINGS] PUT 오류:', error?.message || error);
    return createErrorResponse('승인 설정 업데이트 중 오류가 발생했습니다', 500);
  }
}, { logLevel: 'debug' });

// POST: 도메인별 자동 승인 테스트
export const POST = withApiHandler(async (request: NextRequest) => {
  try {
    const body = await request.json();
    const { email, requested_permission_level } = body;

    console.log('🧪 [APPROVAL-SETTINGS] 자동 승인 테스트:', { email, requested_permission_level });

    if (!email || !requested_permission_level) {
      return createErrorResponse('이메일과 요청 권한 레벨이 필요합니다', 400);
    }

    // 현재 승인 설정 조회
    const { data: settings, error } = await supabaseAdmin
      .from('approval_settings')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (error) {
      console.error('🔴 [APPROVAL-SETTINGS] 설정 조회 오류:', error);
      throw error;
    }

    // 자동 승인 가능 여부 확인
    const emailDomain = '@' + email.split('@')[1];
    const isAutoApprovalEnabled = settings.auto_approval_enabled;
    const isDomainAllowed = settings.auto_approval_domains.includes(emailDomain);
    const isPermissionLevelAllowed = requested_permission_level <= settings.auto_approval_permission_level;
    const isLevel3RequiresManual = requested_permission_level === 3 && settings.manual_approval_required_for_level_3;

    const canAutoApprove = isAutoApprovalEnabled &&
                          isDomainAllowed &&
                          isPermissionLevelAllowed &&
                          !isLevel3RequiresManual;

    console.log('🧪 [APPROVAL-SETTINGS] 테스트 결과:', {
      canAutoApprove,
      isAutoApprovalEnabled,
      isDomainAllowed,
      isPermissionLevelAllowed,
      isLevel3RequiresManual
    });

    return createSuccessResponse({
      canAutoApprove,
      reason: {
        auto_approval_enabled: isAutoApprovalEnabled,
        domain_allowed: isDomainAllowed,
        permission_level_allowed: isPermissionLevelAllowed,
        level_3_requires_manual: isLevel3RequiresManual
      },
      email_domain: emailDomain,
      settings: {
        auto_approval_domains: settings.auto_approval_domains,
        auto_approval_permission_level: settings.auto_approval_permission_level,
        manual_approval_required_for_level_3: settings.manual_approval_required_for_level_3
      }
    });

  } catch (error: any) {
    console.error('🔴 [APPROVAL-SETTINGS] POST 오류:', error?.message || error);
    return createErrorResponse('자동 승인 테스트 중 오류가 발생했습니다', 500);
  }
}, { logLevel: 'debug' });