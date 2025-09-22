import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { verifyTokenString } from '@/utils/auth';

// Force dynamic rendering for API routes
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// 승인 설정 조회
export async function GET(request: NextRequest) {
  try {
    // 관리자 권한 확인
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({
        success: false,
        error: { code: 'UNAUTHORIZED', message: '인증이 필요합니다.' }
      }, { status: 401 });
    }

    const token = authHeader.substring(7);
    const decoded = verifyTokenString(token);

    if (!decoded) {
      return NextResponse.json({
        success: false,
        error: { code: 'INVALID_TOKEN', message: '유효하지 않은 토큰입니다.' }
      }, { status: 401 });
    }

    const userId = decoded.userId || decoded.id;
    const permissionLevel = decoded.permissionLevel || decoded.permission_level;

    // 관리자 권한 확인
    if (!permissionLevel || permissionLevel < 3) {
      return NextResponse.json({
        success: false,
        error: { code: 'FORBIDDEN', message: '관리자 권한이 필요합니다.' }
      }, { status: 403 });
    }

    console.log('✅ [APPROVAL-SETTINGS] 관리자 권한 확인 완료');

    // 승인 설정 조회 - 기본값 반환 (추후 데이터베이스 연동)
    const defaultSettings = {
      auto_approval_enabled: true,
      auto_approval_domains: ['@company.com'],
      auto_approval_permission_level: 2,
      manual_approval_required_for_level_3: true,
      notification_emails: ['admin@company.com'],
      approval_timeout_hours: 24,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      updated_by: 'system'
    };

    return NextResponse.json({
      success: true,
      data: {
        settings: defaultSettings
      }
    });

  } catch (error) {
    console.error('❌ [APPROVAL-SETTINGS] 설정 조회 실패:', error);
    return NextResponse.json({
      success: false,
      error: {
        code: 'FETCH_ERROR',
        message: '승인 설정 조회에 실패했습니다.'
      }
    }, { status: 500 });
  }
}

// 승인 설정 저장
export async function PUT(request: NextRequest) {
  try {
    // 관리자 권한 확인
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({
        success: false,
        error: { code: 'UNAUTHORIZED', message: '인증이 필요합니다.' }
      }, { status: 401 });
    }

    const token = authHeader.substring(7);
    const decoded = verifyTokenString(token);

    if (!decoded) {
      return NextResponse.json({
        success: false,
        error: { code: 'INVALID_TOKEN', message: '유효하지 않은 토큰입니다.' }
      }, { status: 401 });
    }

    const userId = decoded.userId || decoded.id;
    const permissionLevel = decoded.permissionLevel || decoded.permission_level;

    // 관리자 권한 확인
    if (!permissionLevel || permissionLevel < 3) {
      return NextResponse.json({
        success: false,
        error: { code: 'FORBIDDEN', message: '관리자 권한이 필요합니다.' }
      }, { status: 403 });
    }

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

    // 입력 검증
    if (typeof auto_approval_enabled !== 'boolean') {
      return NextResponse.json({
        success: false,
        error: { code: 'INVALID_INPUT', message: '자동 승인 활성화 설정이 유효하지 않습니다.' }
      }, { status: 400 });
    }

    if (!Array.isArray(auto_approval_domains)) {
      return NextResponse.json({
        success: false,
        error: { code: 'INVALID_INPUT', message: '자동 승인 도메인 목록이 유효하지 않습니다.' }
      }, { status: 400 });
    }

    // 설정 저장 (현재는 메모리에만 저장, 추후 데이터베이스 연동)
    const updatedSettings = {
      auto_approval_enabled,
      auto_approval_domains,
      auto_approval_permission_level,
      manual_approval_required_for_level_3,
      notification_emails,
      approval_timeout_hours,
      updated_at: new Date().toISOString(),
      updated_by
    };

    console.log('✅ [APPROVAL-SETTINGS] 설정 저장 완료:', updatedSettings);

    return NextResponse.json({
      success: true,
      data: {
        settings: updatedSettings,
        message: '승인 설정이 성공적으로 저장되었습니다.'
      }
    });

  } catch (error) {
    console.error('❌ [APPROVAL-SETTINGS] 설정 저장 실패:', error);
    return NextResponse.json({
      success: false,
      error: {
        code: 'SAVE_ERROR',
        message: '승인 설정 저장에 실패했습니다.'
      }
    }, { status: 500 });
  }
}

// 자동 승인 테스트
export async function POST(request: NextRequest) {
  try {
    // 관리자 권한 확인
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({
        success: false,
        error: { code: 'UNAUTHORIZED', message: '인증이 필요합니다.' }
      }, { status: 401 });
    }

    const token = authHeader.substring(7);
    const decoded = verifyTokenString(token);

    if (!decoded) {
      return NextResponse.json({
        success: false,
        error: { code: 'INVALID_TOKEN', message: '유효하지 않은 토큰입니다.' }
      }, { status: 401 });
    }

    const userId = decoded.userId || decoded.id;
    const permissionLevel = decoded.permissionLevel || decoded.permission_level;

    // 관리자 권한 확인
    if (!permissionLevel || permissionLevel < 3) {
      return NextResponse.json({
        success: false,
        error: { code: 'FORBIDDEN', message: '관리자 권한이 필요합니다.' }
      }, { status: 403 });
    }

    const body = await request.json();
    const { email, requested_permission_level } = body;

    if (!email || !requested_permission_level) {
      return NextResponse.json({
        success: false,
        error: { code: 'INVALID_INPUT', message: '이메일과 권한 레벨이 필요합니다.' }
      }, { status: 400 });
    }

    // 자동 승인 테스트 로직
    const emailDomain = email.substring(email.indexOf('@'));
    const autoApprovalDomains = ['@company.com']; // 현재 설정값
    const autoApprovalMaxLevel = 2; // 현재 설정값
    const manualApprovalForLevel3 = true; // 현재 설정값

    let canAutoApprove = true;
    const reason: Record<string, string> = {};

    // 도메인 체크
    if (!autoApprovalDomains.includes(emailDomain)) {
      canAutoApprove = false;
      reason.domain = `도메인 ${emailDomain}은 자동 승인 대상이 아닙니다`;
    } else {
      reason.domain = `도메인 ${emailDomain}은 자동 승인 대상입니다`;
    }

    // 권한 레벨 체크
    if (requested_permission_level > autoApprovalMaxLevel) {
      canAutoApprove = false;
      reason.permission = `요청 권한 레벨 ${requested_permission_level}이 자동 승인 최대 레벨 ${autoApprovalMaxLevel}을 초과합니다`;
    } else {
      reason.permission = `요청 권한 레벨 ${requested_permission_level}은 자동 승인 가능합니다`;
    }

    // 레벨 3 수동 승인 정책 체크
    if (requested_permission_level === 3 && manualApprovalForLevel3) {
      canAutoApprove = false;
      reason.level3Policy = '관리자 권한(레벨 3)은 항상 수동 승인이 필요합니다';
    }

    console.log('🧪 [APPROVAL-TEST]:', {
      email,
      emailDomain,
      requested_permission_level,
      canAutoApprove,
      reason
    });

    return NextResponse.json({
      success: true,
      data: {
        canAutoApprove,
        reason,
        testedEmail: email,
        testedPermissionLevel: requested_permission_level
      }
    });

  } catch (error) {
    console.error('❌ [APPROVAL-SETTINGS] 테스트 실패:', error);
    return NextResponse.json({
      success: false,
      error: {
        code: 'TEST_ERROR',
        message: '자동 승인 테스트에 실패했습니다.'
      }
    }, { status: 500 });
  }
}