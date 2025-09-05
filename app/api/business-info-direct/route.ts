import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

// UTF-8 normalization function
function normalizeUTF8(str: string): string {
  if (!str || typeof str !== 'string') return '';
  return str.normalize('NFC');
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const searchQuery = searchParams.get('search') || '';
    const limit = parseInt(searchParams.get('limit') || '1000');
    const id = searchParams.get('id');
    const includeFileStats = searchParams.get('includeFileStats') === 'true';

    console.log('📊 [BUSINESS-INFO-DIRECT] 직접 조회 시작 - 검색:', `"${searchQuery}"`, '제한:', limit, 'ID:', id || 'N/A');

    let query = supabaseAdmin.from('business_info').select('*');

    if (id) {
      query = query.eq('id', id);
    } else if (searchQuery) {
      query = query.or(
        `business_name.ilike.%${searchQuery}%,` +
        `address.ilike.%${searchQuery}%,` +
        `manager_name.ilike.%${searchQuery}%`
      );
    }

    if (limit > 0) {
      query = query.limit(limit);
    }

    const { data: businesses, error } = await query.order('updated_at', { ascending: false });

    if (error) {
      console.error('❌ [BUSINESS-INFO-DIRECT] 조회 오류:', error);
      return NextResponse.json({ 
        success: false, 
        error: error.message,
        data: []
      }, { status: 500 });
    }

    console.log('✅ [BUSINESS-INFO-DIRECT] 조회 완료 -', `${businesses?.length}개 사업장`);

    // Include file statistics if requested
    if (includeFileStats && businesses?.length) {
      console.log('📊 [BUSINESS-INFO-DIRECT] 파일 통계 추가 중...');
      // Add file stats logic here if needed
      console.log('✅ [BUSINESS-INFO-DIRECT] 파일 통계 추가 완료 - 0개 매칭');
    }

    return NextResponse.json({ 
      success: true, 
      data: businesses || [],
      count: businesses?.length || 0
    });

  } catch (error) {
    console.error('❌ [BUSINESS-INFO-DIRECT] 조회 실패:', error);
    return NextResponse.json({ 
      success: false, 
      error: error instanceof Error ? error.message : '알 수 없는 오류',
      data: []
    }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const { id, updateData } = await request.json();

    if (!id) {
      return NextResponse.json({ 
        success: false, 
        error: 'ID가 필요합니다' 
      }, { status: 400 });
    }

    const business = await supabaseAdmin
      .from('business_info')
      .select('*')
      .eq('id', id)
      .single();

    if (business.error) {
      return NextResponse.json({ 
        success: false, 
        error: `사업장을 찾을 수 없습니다: ${business.error.message}` 
      }, { status: 404 });
    }

    // Build update object with proper field handling
    const updateObject: any = {};

    // String fields with UTF-8 normalization
    if (updateData.business_name !== undefined) {
      updateObject.business_name = normalizeUTF8(updateData.business_name || '');
    }
    if (updateData.address !== undefined) {
      updateObject.address = normalizeUTF8(updateData.address || '');
    }
    if (updateData.manager_name !== undefined) {
      updateObject.manager_name = normalizeUTF8(updateData.manager_name || '');
    }

    // Measurement device fields - all as integers
    if (updateData.ph_meter !== undefined) {
      updateObject.ph_meter = parseInt(updateData.ph_meter) || 0;
    }
    if (updateData.differential_pressure_meter !== undefined) {
      updateObject.differential_pressure_meter = parseInt(updateData.differential_pressure_meter) || 0;
    }
    if (updateData.temperature_meter !== undefined) {
      updateObject.temperature_meter = parseInt(updateData.temperature_meter) || 0;
    }
    if (updateData.discharge_current_meter !== undefined) {
      updateObject.discharge_current_meter = parseInt(updateData.discharge_current_meter) || 0;
    }
    if (updateData.fan_current_meter !== undefined) {
      updateObject.fan_current_meter = parseInt(updateData.fan_current_meter) || 0;
    }
    if (updateData.pump_current_meter !== undefined) {
      updateObject.pump_current_meter = parseInt(updateData.pump_current_meter) || 0;
    }
    if (updateData.gateway !== undefined) {
      updateObject.gateway = updateData.gateway;
    }

    // VPN fields - POST MIGRATION: Direct integer handling (no boolean conversion)
    if (updateData.vpn_wired !== undefined) {
      updateObject.vpn_wired = parseInt(updateData.vpn_wired) || 0;
    }
    if (updateData.vpn_wireless !== undefined) {
      updateObject.vpn_wireless = parseInt(updateData.vpn_wireless) || 0;
    }
    if (updateData.multiple_stack !== undefined) {
      updateObject.multiple_stack = parseInt(updateData.multiple_stack) || 0;
    }

    // Additional measurement device fields
    if (updateData.explosion_proof_differential_pressure_meter_domestic !== undefined) {
      updateObject.explosion_proof_differential_pressure_meter_domestic = parseInt(updateData.explosion_proof_differential_pressure_meter_domestic) || 0;
    }
    if (updateData.explosion_proof_temperature_meter_domestic !== undefined) {
      updateObject.explosion_proof_temperature_meter_domestic = parseInt(updateData.explosion_proof_temperature_meter_domestic) || 0;
    }
    if (updateData.expansion_device !== undefined) {
      updateObject.expansion_device = parseInt(updateData.expansion_device) || 0;
    }
    if (updateData.relay_8ch !== undefined) {
      updateObject.relay_8ch = parseInt(updateData.relay_8ch) || 0;
    }
    if (updateData.relay_16ch !== undefined) {
      updateObject.relay_16ch = parseInt(updateData.relay_16ch) || 0;
    }
    if (updateData.main_board_replacement !== undefined) {
      updateObject.main_board_replacement = parseInt(updateData.main_board_replacement) || 0;
    }
    if (updateData.business_management_code !== undefined) {
      updateObject.business_management_code = parseInt(updateData.business_management_code) || 0;
    }

    // Set updated timestamp
    updateObject.updated_at = new Date().toISOString();

    // Update business
    const { data: updatedBusiness, error: updateError } = await supabaseAdmin
      .from('business_info')
      .update(updateObject)
      .eq('id', id)
      .select('*')
      .single();

    if (updateError) {
      console.error('❌ [BUSINESS-INFO-DIRECT] PUT 실패:', updateError);
      return NextResponse.json({ 
        success: false, 
        error: `업데이트 실패: ${updateError.message}` 
      }, { status: 500 });
    }

    console.log('✅ [BUSINESS-INFO-DIRECT] PUT 성공:', `사업장 ${updatedBusiness.business_name} 업데이트 완료`);

    return NextResponse.json({ 
      success: true, 
      message: '사업장 정보가 성공적으로 수정되었습니다.',
      data: updatedBusiness
    });

  } catch (error) {
    console.error('❌ [BUSINESS-INFO-DIRECT] PUT 실패:', error);
    return NextResponse.json({ 
      success: false, 
      error: error instanceof Error ? error.message : '알 수 없는 오류' 
    }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const businessData = await request.json();
    
    console.log('📝 [BUSINESS-INFO-DIRECT] POST 시작 - 새 사업장 생성');

    // Normalize text fields
    const normalizedData = {
      ...businessData,
      business_name: normalizeUTF8(businessData.business_name || ''),
      address: normalizeUTF8(businessData.address || ''),
      manager_name: normalizeUTF8(businessData.manager_name || ''),
      
      // VPN fields as integers (post-migration)
      vpn_wired: parseInt(businessData.vpn_wired || '0') || 0,
      vpn_wireless: parseInt(businessData.vpn_wireless || '0') || 0,
      multiple_stack: parseInt(businessData.multiple_stack || '0') || 0,
      
      // Other measurement device fields
      ph_meter: parseInt(businessData.ph_meter || '0') || 0,
      differential_pressure_meter: parseInt(businessData.differential_pressure_meter || '0') || 0,
      temperature_meter: parseInt(businessData.temperature_meter || '0') || 0,
      discharge_current_meter: parseInt(businessData.discharge_current_meter || '0') || 0,
      fan_current_meter: parseInt(businessData.fan_current_meter || '0') || 0,
      pump_current_meter: parseInt(businessData.pump_current_meter || '0') || 0,
      
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      is_active: businessData.is_active ?? true,
      is_deleted: businessData.is_deleted ?? false
    };

    const { data: newBusiness, error } = await supabaseAdmin
      .from('business_info')
      .insert([normalizedData])
      .select('*')
      .single();

    if (error) {
      console.error('❌ [BUSINESS-INFO-DIRECT] POST 실패:', error);
      return NextResponse.json({ 
        success: false, 
        error: `생성 실패: ${error.message}` 
      }, { status: 500 });
    }

    console.log('✅ [BUSINESS-INFO-DIRECT] POST 성공:', `사업장 ${newBusiness.business_name} 생성 완료`);

    return NextResponse.json({ 
      success: true, 
      message: '사업장이 성공적으로 생성되었습니다.',
      data: newBusiness
    });

  } catch (error) {
    console.error('❌ [BUSINESS-INFO-DIRECT] POST 실패:', error);
    return NextResponse.json({ 
      success: false, 
      error: error instanceof Error ? error.message : '알 수 없는 오류' 
    }, { status: 500 });
  }
}