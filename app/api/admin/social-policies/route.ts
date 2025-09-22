import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { verifyTokenString } from '@/utils/auth';
import { validateInput, ValidationSchemas } from '@/lib/security/input-validation';

// Force dynamic rendering for API routes
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';


// 소셜 로그인 정책 목록 조회
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
    console.log('🔍 [ADMIN-POLICIES] GET 토큰 추출:', {
      authHeader: authHeader ? '있음' : '없음',
      tokenLength: token ? token.length : 0,
      tokenStart: token ? token.substring(0, 20) + '...' : '없음'
    });

    const decoded = verifyTokenString(token);
    console.log('🔍 [ADMIN-POLICIES] GET 토큰 디코딩 결과:', {
      decoded: decoded ? '성공' : '실패',
      decodedData: decoded || '없음'
    });

    if (!decoded) {
      console.log('❌ [ADMIN-POLICIES] GET 토큰 검증 실패 - 401 반환');
      return NextResponse.json({
        success: false,
        error: { code: 'INVALID_TOKEN', message: '유효하지 않은 토큰입니다.' }
      }, { status: 401 });
    }

    // 관리자 권한 확인
    const userId = decoded.userId || decoded.id; // JWT 토큰에서 사용자 ID 추출
    console.log('🔍 [ADMIN-POLICIES] 토큰 검증:', { userId, decoded });

    const { data: admin, error: adminError } = await supabaseAdmin
      .from('employees')
      .select('permission_level, name, email')
      .eq('id', userId)
      .eq('is_active', true)
      .single();

    console.log('👤 [ADMIN-POLICIES] 관리자 조회:', { admin, adminError });

    if (adminError || !admin || admin.permission_level < 3) {
      console.log('❌ [ADMIN-POLICIES] 권한 부족:', { admin, adminError });
      return NextResponse.json({
        success: false,
        error: { code: 'FORBIDDEN', message: '관리자 권한이 필요합니다.' }
      }, { status: 403 });
    }

    console.log('✅ [ADMIN-POLICIES] 관리자 권한 확인 완료:', admin.name);

    // 정책 목록 조회 (테이블 존재 여부 확인)
    console.log('📊 [ADMIN-POLICIES] 정책 목록 조회 시작');

    let { data: policies, error: policiesError } = await supabaseAdmin
      .from('social_auth_policies')
      .select('*')
      .order('created_at', { ascending: false });

    // 테이블이 없으면 빈 배열 반환 (자동 가입 시스템이므로 정책 테이블 불필요)
    if (policiesError && (policiesError.message?.includes('does not exist') || policiesError.code === 'PGRST205')) {
      console.log('ℹ️ [ADMIN-POLICIES] 정책 테이블이 없음 - 자동 가입 시스템 운영 중');
      policies = [];
      policiesError = null;
    } else if (policiesError) {
      console.error('❌ [ADMIN-POLICIES] 테이블 조회 오류:', policiesError);
      throw policiesError;
    }

    console.log(`📊 [ADMIN-POLICIES] 조회 완료: ${policies?.length || 0}개 정책`);

    return NextResponse.json({
      success: true,
      data: {
        policies: policies || []
      }
    });

  } catch (error) {
    console.error('❌ [ADMIN-POLICIES] 정책 목록 조회 실패:', error);
    return NextResponse.json({
      success: false,
      error: {
        code: 'FETCH_ERROR',
        message: '정책 목록 조회에 실패했습니다.'
      }
    }, { status: 500 });
  }
}

// 새 정책 생성
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
    console.log('🔍 [ADMIN-POLICIES] POST 토큰 추출:', {
      authHeader: authHeader ? '있음' : '없음',
      tokenLength: token ? token.length : 0,
      tokenStart: token ? token.substring(0, 20) + '...' : '없음'
    });

    const decoded = verifyTokenString(token);
    console.log('🔍 [ADMIN-POLICIES] POST 토큰 디코딩 결과:', {
      decoded: decoded ? '성공' : '실패',
      decodedData: decoded || '없음'
    });

    if (!decoded) {
      console.log('❌ [ADMIN-POLICIES] POST 토큰 검증 실패 - 401 반환');
      return NextResponse.json({
        success: false,
        error: { code: 'INVALID_TOKEN', message: '유효하지 않은 토큰입니다.' }
      }, { status: 401 });
    }

    // 관리자 권한 확인
    const userId = decoded.userId || decoded.id; // JWT 토큰에서 사용자 ID 추출
    console.log('🔍 [ADMIN-POLICIES] POST 토큰 검증:', { userId, decoded });

    const { data: admin, error: adminError } = await supabaseAdmin
      .from('employees')
      .select('permission_level, name, email')
      .eq('id', userId)
      .eq('is_active', true)
      .single();

    console.log('👤 [ADMIN-POLICIES] POST 관리자 조회:', { admin, adminError });

    if (adminError || !admin || admin.permission_level < 3) {
      console.log('❌ [ADMIN-POLICIES] POST 권한 부족:', { admin, adminError });
      return NextResponse.json({
        success: false,
        error: { code: 'FORBIDDEN', message: '관리자 권한이 필요합니다.' }
      }, { status: 403 });
    }

    console.log('✅ [ADMIN-POLICIES] POST 관리자 권한 확인 완료:', admin.name);

    const body = await request.json();
    const {
      email_domain,
      auto_approve,
      default_permission_level,
      default_department,
      description
    } = body;

    // 입력 검증
    if (!email_domain || typeof auto_approve !== 'boolean') {
      return NextResponse.json({
        success: false,
        error: { code: 'INVALID_INPUT', message: '필수 필드가 누락되었습니다.' }
      }, { status: 400 });
    }

    // 도메인 형식 검증
    const domainRegex = /^[a-zA-Z0-9]([a-zA-Z0-9\-]{0,61}[a-zA-Z0-9])?(\.[a-zA-Z0-9]([a-zA-Z0-9\-]{0,61}[a-zA-Z0-9])?)*$/;
    if (!domainRegex.test(email_domain)) {
      return NextResponse.json({
        success: false,
        error: { code: 'INVALID_DOMAIN', message: '유효하지 않은 도메인 형식입니다.' }
      }, { status: 400 });
    }

    // 권한 레벨 검증
    if (default_permission_level && (default_permission_level < 1 || default_permission_level > 3)) {
      return NextResponse.json({
        success: false,
        error: { code: 'INVALID_PERMISSION', message: '권한 레벨은 1-3 사이여야 합니다.' }
      }, { status: 400 });
    }

    // 테이블 존재 여부 확인 후 중복 확인
    let existing = null;
    const { data: existingData, error: existingError } = await supabaseAdmin
      .from('social_auth_policies')
      .select('id')
      .eq('email_domain', email_domain.toLowerCase())
      .single();

    // 테이블이 없으면 자동 가입 시스템으로 처리
    if (existingError && (existingError.message?.includes('does not exist') || existingError.code === 'PGRST205')) {
      console.log('ℹ️ [ADMIN-POLICIES] POST 정책 테이블이 없음 - 자동 가입 시스템에서 정책 생성 불필요');
      return NextResponse.json({
        success: false,
        error: { code: 'AUTO_SIGNUP_SYSTEM', message: '자동 가입 시스템에서는 정책 설정이 불필요합니다.' }
      }, { status: 400 });
    } else if (existingError) {
      throw existingError;
    } else {
      existing = existingData;
    }

    if (existing) {
      return NextResponse.json({
        success: false,
        error: { code: 'DUPLICATE_DOMAIN', message: '이미 존재하는 도메인입니다.' }
      }, { status: 409 });
    }

    // 정책 생성
    const { data: newPolicy, error: createError } = await supabaseAdmin
      .from('social_auth_policies')
      .insert({
        email_domain: email_domain.toLowerCase(),
        auto_approve,
        default_permission_level: default_permission_level || 1,
        default_department,
        description,
        created_by: admin.name,
        is_active: true
      })
      .select()
      .single();

    if (createError) {
      throw createError;
    }

    console.log('✅ [ADMIN-POLICIES] 정책 생성 완료:', {
      domain: email_domain,
      autoApprove: auto_approve,
      createdBy: admin.name
    });

    return NextResponse.json({
      success: true,
      data: {
        message: '정책이 성공적으로 생성되었습니다.',
        policy: newPolicy
      }
    });

  } catch (error) {
    console.error('❌ [ADMIN-POLICIES] 정책 생성 실패:', error);
    return NextResponse.json({
      success: false,
      error: {
        code: 'CREATE_ERROR',
        message: '정책 생성에 실패했습니다.'
      }
    }, { status: 500 });
  }
}