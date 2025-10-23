import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { verifyTokenString } from '@/utils/auth';

// Force dynamic rendering for API routes
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

interface ManufacturerPricingData {
  equipment_type: string;
  equipment_name: string;
  manufacturer: 'ecosense' | 'cleanearth' | 'gaia_cns' | 'evs';
  cost_price: number;
  effective_from: string;
  effective_to?: string;
  notes?: string;
}

// 제조사별 원가 목록 조회
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

    const userId = decoded.userId || decoded.id;
    if (!userId) {
      return NextResponse.json({
        success: false,
        message: '토큰에 사용자 정보가 없습니다.'
      }, { status: 401 });
    }

    // DB에서 사용자 권한 조회
    const { data: user, error: userError } = await supabaseAdmin
      .from('employees')
      .select('id, permission_level')
      .eq('id', userId)
      .eq('is_active', true)
      .single();

    if (userError || !user) {
      return NextResponse.json({
        success: false,
        message: '사용자를 찾을 수 없습니다.'
      }, { status: 401 });
    }

    const permissionLevel = user.permission_level;

    // 권한 2 이상 확인 (매출 조회)
    if (!permissionLevel || permissionLevel < 2) {
      return NextResponse.json({
        success: false,
        message: '매출 조회 권한이 필요합니다.'
      }, { status: 403 });
    }

    // URL 파라미터 처리
    const url = new URL(request.url);
    const includeInactive = url.searchParams.get('include_inactive') === 'true';
    const manufacturer = url.searchParams.get('manufacturer');
    const equipmentType = url.searchParams.get('equipment_type');

    // 제조사별 원가 조회
    const today = new Date().toISOString().split('T')[0];

    let query = supabaseAdmin
      .from('manufacturer_pricing')
      .select('*')
      .order('manufacturer', { ascending: true })
      .order('equipment_name', { ascending: true });

    if (!includeInactive) {
      query = query.eq('is_active', true);
    }

    // 현재 날짜 기준 유효한 가격만 조회
    query = query
      .lte('effective_from', today)
      .or(`effective_to.is.null,effective_to.gte.${today}`);

    if (manufacturer) {
      query = query.eq('manufacturer', manufacturer);
    }

    if (equipmentType) {
      query = query.eq('equipment_type', equipmentType);
    }

    const { data: pricing, error } = await query;

    // 디버깅: ecosense ph_meter 가격 확인
    const ecosensePH = pricing?.find(p => p.manufacturer === 'ecosense' && p.equipment_type === 'ph_meter');
    if (ecosensePH) {
      console.log('🔍 [MANUFACTURER-PRICING] ecosense ph_meter 원가:', ecosensePH.cost_price, '원');
    }

    if (error) {
      console.error('❌ [MANUFACTURER-PRICING] 조회 오류:', error);
      return NextResponse.json({
        success: false,
        message: '제조사별 원가 조회에 실패했습니다.'
      }, { status: 500 });
    }

    console.log(`📊 [MANUFACTURER-PRICING] 조회 완료: ${pricing?.length || 0}개`);

    return NextResponse.json({
      success: true,
      data: {
        pricing: pricing || [],
        total_count: pricing?.length || 0
      }
    });

  } catch (error) {
    console.error('❌ [MANUFACTURER-PRICING] API 오류:', error);
    return NextResponse.json({
      success: false,
      message: '서버 오류가 발생했습니다.'
    }, { status: 500 });
  }
}

// 제조사별 원가 생성/수정
export async function POST(request: NextRequest) {
  try {
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

    const userId = decoded.userId || decoded.id;
    const permissionLevel = decoded.permissionLevel || decoded.permission_level;

    // 권한 3 이상 확인 (원가 관리)
    if (!permissionLevel || permissionLevel < 3) {
      return NextResponse.json({
        success: false,
        message: '원가 관리 권한이 필요합니다.'
      }, { status: 403 });
    }

    const body = await request.json();
    const {
      equipment_type,
      equipment_name,
      manufacturer,
      cost_price,
      effective_from,
      effective_to,
      notes
    }: ManufacturerPricingData = body;

    // 입력 값 검증
    if (!equipment_type || !equipment_name || !manufacturer || !cost_price || !effective_from) {
      return NextResponse.json({
        success: false,
        message: '필수 필드가 누락되었습니다.'
      }, { status: 400 });
    }

    // 기존 데이터 조회
    const { data: existingData } = await supabaseAdmin
      .from('manufacturer_pricing')
      .select('*')
      .eq('equipment_type', equipment_type)
      .eq('manufacturer', manufacturer)
      .eq('is_active', true)
      .single();

    // 새 데이터 삽입
    const insertData = {
      equipment_type,
      equipment_name,
      manufacturer,
      cost_price,
      effective_from,
      effective_to,
      notes,
      created_by: userId,
      is_active: true
    };

    const { data: newPricing, error: insertError } = await supabaseAdmin
      .from('manufacturer_pricing')
      .insert(insertData)
      .select()
      .single();

    if (insertError) {
      console.error('❌ [MANUFACTURER-PRICING] 삽입 오류:', insertError);
      return NextResponse.json({
        success: false,
        message: '제조사별 원가 저장에 실패했습니다.'
      }, { status: 500 });
    }

    // 기존 데이터가 있다면 비활성화
    if (existingData) {
      await supabaseAdmin
        .from('manufacturer_pricing')
        .update({
          is_active: false,
          effective_to: effective_from
        })
        .eq('id', existingData.id);

      // 원가 변경 히스토리 기록
      await supabaseAdmin
        .from('pricing_change_history')
        .insert({
          table_name: 'manufacturer_pricing',
          record_id: newPricing.id,
          change_type: 'cost_update',
          old_values: existingData,
          new_values: newPricing,
          changed_fields: ['cost_price'],
          change_reason: notes || '제조사 원가 업데이트',
          user_id: userId,
          user_name: decoded.name || decoded.username || '알 수 없음'
        });
    }

    console.log(`✅ [MANUFACTURER-PRICING] ${existingData ? '수정' : '생성'} 완료:`, `${manufacturer} - ${equipment_name}`);

    return NextResponse.json({
      success: true,
      data: {
        pricing: newPricing,
        is_update: !!existingData
      },
      message: `제조사별 원가가 성공적으로 ${existingData ? '수정' : '생성'}되었습니다.`
    });

  } catch (error) {
    console.error('❌ [MANUFACTURER-PRICING] API 오류:', error);
    return NextResponse.json({
      success: false,
      message: '서버 오류가 발생했습니다.'
    }, { status: 500 });
  }
}

// 제조사별 원가 수정 (기존 레코드 업데이트)
export async function PATCH(request: NextRequest) {
  try {
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

    const userId = decoded.userId || decoded.id;
    const permissionLevel = decoded.permissionLevel || decoded.permission_level;

    // 권한 3 이상 확인 (원가 관리)
    if (!permissionLevel || permissionLevel < 3) {
      return NextResponse.json({
        success: false,
        message: '원가 관리 권한이 필요합니다.'
      }, { status: 403 });
    }

    const body = await request.json();
    const {
      id,
      cost_price,
      effective_from,
      effective_to,
      notes
    } = body;

    if (!id) {
      return NextResponse.json({
        success: false,
        message: 'ID가 필요합니다.'
      }, { status: 400 });
    }

    // 기존 데이터 조회
    const { data: existingData, error: fetchError } = await supabaseAdmin
      .from('manufacturer_pricing')
      .select('*')
      .eq('id', id)
      .single();

    if (fetchError || !existingData) {
      return NextResponse.json({
        success: false,
        message: '해당 데이터를 찾을 수 없습니다.'
      }, { status: 404 });
    }

    // 업데이트할 데이터 준비 (equipment_type, manufacturer는 수정 불가)
    const updateData: any = {};

    if (cost_price !== undefined) updateData.cost_price = cost_price;
    if (effective_from !== undefined) updateData.effective_from = effective_from;
    if (effective_to !== undefined) updateData.effective_to = effective_to;
    if (notes !== undefined) updateData.notes = notes;

    // 수정할 내용이 없으면 에러
    if (Object.keys(updateData).length === 0) {
      return NextResponse.json({
        success: false,
        message: '수정할 내용이 없습니다.'
      }, { status: 400 });
    }

    // 레코드 업데이트
    const { data: updatedData, error: updateError } = await supabaseAdmin
      .from('manufacturer_pricing')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (updateError) {
      console.error('❌ [MANUFACTURER-PRICING] 수정 오류:', updateError);
      return NextResponse.json({
        success: false,
        message: '제조사별 원가 수정에 실패했습니다.'
      }, { status: 500 });
    }

    // 변경 이력 기록 (원가가 변경된 경우에만)
    if (cost_price !== undefined && cost_price !== existingData.cost_price) {
      await supabaseAdmin
        .from('pricing_change_history')
        .insert({
          table_name: 'manufacturer_pricing',
          record_id: id,
          change_type: 'cost_update',
          old_values: {
            cost_price: existingData.cost_price,
            effective_from: existingData.effective_from,
            effective_to: existingData.effective_to,
            notes: existingData.notes
          },
          new_values: {
            cost_price: updatedData.cost_price,
            effective_from: updatedData.effective_from,
            effective_to: updatedData.effective_to,
            notes: updatedData.notes
          },
          changed_fields: ['cost_price'],
          change_reason: notes || `원가 변경: ${existingData.cost_price} → ${cost_price}`,
          user_id: userId,
          user_name: decoded.name || decoded.username || '알 수 없음'
        });
    }

    console.log(`✏️ [MANUFACTURER-PRICING] 수정 완료:`, `${existingData.manufacturer} - ${existingData.equipment_name}`);

    return NextResponse.json({
      success: true,
      data: updatedData,
      message: '제조사별 원가가 성공적으로 수정되었습니다.'
    });

  } catch (error) {
    console.error('❌ [MANUFACTURER-PRICING] API 오류:', error);
    return NextResponse.json({
      success: false,
      message: '서버 오류가 발생했습니다.'
    }, { status: 500 });
  }
}

// 제조사별 원가 삭제 (비활성화)
export async function DELETE(request: NextRequest) {
  try {
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
    const { id } = body;

    if (!id) {
      return NextResponse.json({
        success: false,
        message: 'ID가 필요합니다.'
      }, { status: 400 });
    }

    // 기존 데이터 조회
    const { data: existingData, error: fetchError } = await supabaseAdmin
      .from('manufacturer_pricing')
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
      .from('manufacturer_pricing')
      .update({
        is_active: false,
        effective_to: new Date().toISOString().split('T')[0]
      })
      .eq('id', id);

    if (updateError) {
      console.error('❌ [MANUFACTURER-PRICING] 삭제 오류:', updateError);
      return NextResponse.json({
        success: false,
        message: '제조사별 원가 삭제에 실패했습니다.'
      }, { status: 500 });
    }

    console.log(`🗑️ [MANUFACTURER-PRICING] 삭제 완료:`, `${existingData.manufacturer} - ${existingData.equipment_name}`);

    return NextResponse.json({
      success: true,
      message: '제조사별 원가가 성공적으로 삭제되었습니다.'
    });

  } catch (error) {
    console.error('❌ [MANUFACTURER-PRICING] API 오류:', error);
    return NextResponse.json({
      success: false,
      message: '서버 오류가 발생했습니다.'
    }, { status: 500 });
  }
}
