import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { verifyTokenString } from '@/utils/auth';

// Force dynamic rendering for API routes
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

interface GovernmentPricingData {
  equipment_type: string;
  equipment_name: string;
  official_price: number;
  manufacturer_price?: number;
  installation_cost?: number;
  effective_from: string;
  effective_to?: string;
  announcement_number?: string;
}

// 환경부 고시가 목록 조회
export async function GET(request: NextRequest) {
  try {
    // JWT 토큰 검증
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({
        success: false,
        message: '인증이 필요합니다.'
      }, { status: 401 });
    }

    const token = authHeader.substring(7);
    const decoded = verifyTokenString(token);

    if (!decoded) {
      return NextResponse.json({
        success: false,
        message: '유효하지 않은 토큰입니다.'
      }, { status: 401 });
    }

    // 토큰에서 사용자 ID 추출
    const userId = decoded.userId || decoded.id;

    if (!userId) {
      return NextResponse.json({
        success: false,
        message: '토큰에 사용자 정보가 없습니다.'
      }, { status: 401 });
    }

    // DB에서 사용자 정보 조회하여 최신 권한 확인
    const { data: user, error: userError } = await supabaseAdmin
      .from('employees')
      .select('id, permission_level')
      .eq('id', userId)
      .eq('is_active', true)
      .single();

    if (userError || !user) {
      console.log('❌ [GOVERNMENT-PRICING] 사용자 조회 실패:', userError);
      return NextResponse.json({
        success: false,
        message: '사용자를 찾을 수 없습니다.'
      }, { status: 401 });
    }

    const permissionLevel = user.permission_level;

    console.log('🔍 [GOVERNMENT-PRICING] 토큰 검증:', { userId, permissionLevel });

    // 권한 2 이상 확인 (매출 조회)
    if (!permissionLevel || permissionLevel < 2) {
      console.log('❌ [GOVERNMENT-PRICING] 권한 부족:', { permissionLevel });
      return NextResponse.json({
        success: false,
        message: '매출 조회 권한이 필요합니다.'
      }, { status: 403 });
    }

    // URL 파라미터 처리
    const url = new URL(request.url);
    const includeInactive = url.searchParams.get('include_inactive') === 'true';
    const equipmentType = url.searchParams.get('equipment_type');

    // 환경부 고시가 조회
    let query = supabaseAdmin
      .from('government_pricing')
      .select('*')
      .order('equipment_name', { ascending: true });

    if (!includeInactive) {
      query = query.eq('is_active', true);
    }

    if (equipmentType) {
      query = query.eq('equipment_type', equipmentType);
    }

    const { data: pricing, error } = await query;

    if (error) {
      console.error('❌ [GOVERNMENT-PRICING] 조회 오류:', error);
      return NextResponse.json({
        success: false,
        message: '환경부 고시가 조회에 실패했습니다.'
      }, { status: 500 });
    }

    console.log(`📊 [GOVERNMENT-PRICING] 조회 완료: ${pricing?.length || 0}개`);

    return NextResponse.json({
      success: true,
      data: {
        pricing: pricing || [],
        total_count: pricing?.length || 0
      }
    });

  } catch (error) {
    console.error('❌ [GOVERNMENT-PRICING] API 오류:', error);
    return NextResponse.json({
      success: false,
      message: '서버 오류가 발생했습니다.'
    }, { status: 500 });
  }
}

// 환경부 고시가 생성/수정
export async function POST(request: NextRequest) {
  try {
    // JWT 토큰 검증
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({
        success: false,
        message: '인증이 필요합니다.'
      }, { status: 401 });
    }

    const token = authHeader.substring(7);
    const decoded = verifyTokenString(token);

    if (!decoded) {
      return NextResponse.json({
        success: false,
        message: '유효하지 않은 토큰입니다.'
      }, { status: 401 });
    }

    // 토큰에서 사용자 정보 추출
    const userId = decoded.userId || decoded.id;
    const permissionLevel = decoded.permissionLevel || decoded.permission_level;

    console.log('🔍 [GOVERNMENT-PRICING] 토큰 검증:', { userId, permissionLevel });

    // 권한 3 이상 확인 (원가 관리)
    if (!permissionLevel || permissionLevel < 3) {
      console.log('❌ [GOVERNMENT-PRICING] 권한 부족:', { permissionLevel });
      return NextResponse.json({
        success: false,
        message: '원가 관리 권한이 필요합니다.'
      }, { status: 403 });
    }

    const body = await request.json();
    const {
      equipment_type,
      equipment_name,
      official_price,
      manufacturer_price,
      installation_cost,
      effective_from,
      effective_to,
      announcement_number,
      change_reason
    }: GovernmentPricingData & { change_reason?: string } = body;

    // 입력 값 검증
    if (!equipment_type || !equipment_name || !official_price || !effective_from) {
      return NextResponse.json({
        success: false,
        message: '필수 필드가 누락되었습니다.'
      }, { status: 400 });
    }

    // 기존 데이터 조회 (히스토리 용)
    const { data: existingData } = await supabaseAdmin
      .from('government_pricing')
      .select('*')
      .eq('equipment_type', equipment_type)
      .eq('is_active', true)
      .single();

    // 새 데이터 삽입
    const insertData = {
      equipment_type,
      equipment_name,
      official_price,
      manufacturer_price: manufacturer_price || 0,
      installation_cost: installation_cost || 0,
      effective_from,
      effective_to,
      announcement_number,
      created_by: userId,
      is_active: true
    };

    const { data: newPricing, error: insertError } = await supabaseAdmin
      .from('government_pricing')
      .insert(insertData)
      .select()
      .single();

    if (insertError) {
      console.error('❌ [GOVERNMENT-PRICING] 삽입 오류:', insertError);
      return NextResponse.json({
        success: false,
        message: '환경부 고시가 저장에 실패했습니다.'
      }, { status: 500 });
    }

    // 기존 데이터가 있다면 비활성화
    if (existingData) {
      await supabaseAdmin
        .from('government_pricing')
        .update({
          is_active: false,
          effective_to: effective_from
        })
        .eq('id', existingData.id);

      // 원가 변경 히스토리 기록
      await supabaseAdmin
        .from('pricing_change_history')
        .insert({
          table_name: 'government_pricing',
          record_id: newPricing.id,
          change_type: 'price_update',
          old_values: existingData,
          new_values: newPricing,
          changed_fields: ['official_price', 'manufacturer_price', 'installation_cost'],
          change_reason: change_reason || '원가 업데이트',
          user_id: userId,
          user_name: decoded.name || decoded.username || '알 수 없음'
        });
    }

    // 감사 로그 기록
    await supabaseAdmin
      .from('revenue_audit_log')
      .insert({
        table_name: 'government_pricing',
        record_id: newPricing.id,
        action_type: 'INSERT',
        new_values: newPricing,
        action_description: `환경부 고시가 ${existingData ? '수정' : '생성'}: ${equipment_name}`,
        user_id: userId,
        user_name: decoded.name || decoded.username || '알 수 없음',
        user_permission_level: permissionLevel
      });

    console.log(`✅ [GOVERNMENT-PRICING] ${existingData ? '수정' : '생성'} 완료:`, equipment_name);

    return NextResponse.json({
      success: true,
      data: {
        pricing: newPricing,
        is_update: !!existingData
      },
      message: `환경부 고시가가 성공적으로 ${existingData ? '수정' : '생성'}되었습니다.`
    });

  } catch (error) {
    console.error('❌ [GOVERNMENT-PRICING] API 오류:', error);
    return NextResponse.json({
      success: false,
      message: '서버 오류가 발생했습니다.'
    }, { status: 500 });
  }
}

// 환경부 고시가 삭제 (비활성화)
export async function DELETE(request: NextRequest) {
  try {
    // JWT 토큰 검증
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({
        success: false,
        message: '인증이 필요합니다.'
      }, { status: 401 });
    }

    const token = authHeader.substring(7);
    const decoded = verifyTokenString(token);

    if (!decoded) {
      return NextResponse.json({
        success: false,
        message: '유효하지 않은 토큰입니다.'
      }, { status: 401 });
    }

    // 토큰에서 사용자 정보 추출
    const userId = decoded.userId || decoded.id;
    const permissionLevel = decoded.permissionLevel || decoded.permission_level;

    // 권한 3 이상 확인
    if (!permissionLevel || permissionLevel < 3) {
      return NextResponse.json({
        success: false,
        message: '원가 관리 권한이 필요합니다.'
      }, { status: 403 });
    }

    const body = await request.json();
    const { id, delete_reason } = body;

    if (!id) {
      return NextResponse.json({
        success: false,
        message: 'ID가 필요합니다.'
      }, { status: 400 });
    }

    // 기존 데이터 조회
    const { data: existingData, error: fetchError } = await supabaseAdmin
      .from('government_pricing')
      .select('*')
      .eq('id', id)
      .single();

    if (fetchError || !existingData) {
      return NextResponse.json({
        success: false,
        message: '해당 데이터를 찾을 수 없습니다.'
      }, { status: 404 });
    }

    // 비활성화 처리
    const { error: updateError } = await supabaseAdmin
      .from('government_pricing')
      .update({
        is_active: false,
        effective_to: new Date().toISOString().split('T')[0]
      })
      .eq('id', id);

    if (updateError) {
      console.error('❌ [GOVERNMENT-PRICING] 삭제 오류:', updateError);
      return NextResponse.json({
        success: false,
        message: '환경부 고시가 삭제에 실패했습니다.'
      }, { status: 500 });
    }

    // 감사 로그 기록
    await supabaseAdmin
      .from('revenue_audit_log')
      .insert({
        table_name: 'government_pricing',
        record_id: id,
        action_type: 'DELETE',
        old_values: existingData,
        action_description: `환경부 고시가 삭제: ${existingData.equipment_name}`,
        user_id: userId,
        user_name: decoded.name || decoded.username || '알 수 없음',
        user_permission_level: permissionLevel
      });

    console.log(`🗑️ [GOVERNMENT-PRICING] 삭제 완료:`, existingData.equipment_name);

    return NextResponse.json({
      success: true,
      message: '환경부 고시가가 성공적으로 삭제되었습니다.'
    });

  } catch (error) {
    console.error('❌ [GOVERNMENT-PRICING] API 오류:', error);
    return NextResponse.json({
      success: false,
      message: '서버 오류가 발생했습니다.'
    }, { status: 500 });
  }
}