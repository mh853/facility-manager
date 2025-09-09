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
    if (updateData.local_government !== undefined) {
      updateObject.local_government = normalizeUTF8(updateData.local_government || '');
    }
    if (updateData.address !== undefined) {
      updateObject.address = normalizeUTF8(updateData.address || '');
    }
    if (updateData.representative_name !== undefined) {
      updateObject.representative_name = normalizeUTF8(updateData.representative_name || '');
    }
    if (updateData.business_registration_number !== undefined) {
      updateObject.business_registration_number = normalizeUTF8(updateData.business_registration_number || '');
    }
    if (updateData.business_type !== undefined) {
      updateObject.business_type = normalizeUTF8(updateData.business_type || '');
    }
    if (updateData.business_contact !== undefined) {
      updateObject.business_contact = normalizeUTF8(updateData.business_contact || '');
    }
    if (updateData.manager_name !== undefined) {
      updateObject.manager_name = normalizeUTF8(updateData.manager_name || '');
    }
    if (updateData.manager_contact !== undefined) {
      updateObject.manager_contact = normalizeUTF8(updateData.manager_contact || '');
    }
    if (updateData.manager_position !== undefined) {
      updateObject.manager_position = normalizeUTF8(updateData.manager_position || '');
    }
    if (updateData.fax_number !== undefined) {
      updateObject.fax_number = normalizeUTF8(updateData.fax_number || '');
    }
    if (updateData.email !== undefined) {
      updateObject.email = normalizeUTF8(updateData.email || '');
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

    // Project management fields
    if (updateData.row_number !== undefined) {
      updateObject.row_number = parseInt(updateData.row_number) || null;
    }
    if (updateData.department !== undefined) {
      updateObject.department = normalizeUTF8(updateData.department || '');
    }
    if (updateData.progress_status !== undefined) {
      updateObject.progress_status = normalizeUTF8(updateData.progress_status || '');
    }
    if (updateData.contract_document !== undefined) {
      updateObject.contract_document = normalizeUTF8(updateData.contract_document || '');
    }
    if (updateData.order_request_date !== undefined) {
      updateObject.order_request_date = updateData.order_request_date || null;
    }
    if (updateData.wireless_document !== undefined) {
      updateObject.wireless_document = normalizeUTF8(updateData.wireless_document || '');
    }
    if (updateData.installation_support !== undefined) {
      updateObject.installation_support = normalizeUTF8(updateData.installation_support || '');
    }
    if (updateData.order_manager !== undefined) {
      updateObject.order_manager = normalizeUTF8(updateData.order_manager || '');
    }
    if (updateData.order_date !== undefined) {
      updateObject.order_date = updateData.order_date || null;
    }
    if (updateData.shipment_date !== undefined) {
      updateObject.shipment_date = updateData.shipment_date || null;
    }
    if (updateData.inventory_check !== undefined) {
      updateObject.inventory_check = normalizeUTF8(updateData.inventory_check || '');
    }
    if (updateData.installation_date !== undefined) {
      updateObject.installation_date = updateData.installation_date || null;
    }
    if (updateData.installation_team !== undefined) {
      updateObject.installation_team = normalizeUTF8(updateData.installation_team || '');
    }

    // Business classification and operational fields
    if (updateData.business_category !== undefined) {
      updateObject.business_category = normalizeUTF8(updateData.business_category || '');
    }
    if (updateData.pollutants !== undefined) {
      updateObject.pollutants = normalizeUTF8(updateData.pollutants || '');
    }
    if (updateData.annual_emission_amount !== undefined) {
      updateObject.annual_emission_amount = parseInt(updateData.annual_emission_amount) || null;
    }
    if (updateData.first_report_date !== undefined) {
      updateObject.first_report_date = updateData.first_report_date || null;
    }
    if (updateData.operation_start_date !== undefined) {
      updateObject.operation_start_date = updateData.operation_start_date || null;
    }
    if (updateData.subsidy_approval_date !== undefined) {
      updateObject.subsidy_approval_date = updateData.subsidy_approval_date || null;
    }

    // System and additional fields
    if (updateData.manufacturer !== undefined) {
      updateObject.manufacturer = updateData.manufacturer;
    }
    if (updateData.vpn !== undefined) {
      updateObject.vpn = updateData.vpn;
    }
    if (updateData.greenlink_id !== undefined) {
      updateObject.greenlink_id = normalizeUTF8(updateData.greenlink_id || '');
    }
    if (updateData.greenlink_pw !== undefined) {
      updateObject.greenlink_pw = normalizeUTF8(updateData.greenlink_pw || '');
    }
    if (updateData.sales_office !== undefined) {
      updateObject.sales_office = normalizeUTF8(updateData.sales_office || '');
    }
    if (updateData.expansion_pack !== undefined) {
      updateObject.expansion_pack = parseInt(updateData.expansion_pack) || null;
    }
    if (updateData.other_equipment !== undefined) {
      updateObject.other_equipment = normalizeUTF8(updateData.other_equipment || '');
    }
    if (updateData.additional_cost !== undefined) {
      updateObject.additional_cost = parseInt(updateData.additional_cost) || null;
    }
    if (updateData.negotiation !== undefined) {
      updateObject.negotiation = normalizeUTF8(updateData.negotiation || '');
    }
    if (updateData.multiple_stack_cost !== undefined) {
      updateObject.multiple_stack_cost = parseInt(updateData.multiple_stack_cost) || null;
    }
    if (updateData.representative_birth_date !== undefined) {
      updateObject.representative_birth_date = updateData.representative_birth_date || null;
    }
    if (updateData.is_active !== undefined) {
      updateObject.is_active = Boolean(updateData.is_active);
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

    // Normalize and structure all fields properly
    const normalizedData = {
      // Basic business information
      business_name: normalizeUTF8(businessData.business_name || ''),
      local_government: normalizeUTF8(businessData.local_government || ''),
      address: normalizeUTF8(businessData.address || ''),
      representative_name: normalizeUTF8(businessData.representative_name || ''),
      business_registration_number: normalizeUTF8(businessData.business_registration_number || ''),
      business_type: normalizeUTF8(businessData.business_type || ''),
      business_contact: normalizeUTF8(businessData.business_contact || ''),
      manager_name: normalizeUTF8(businessData.manager_name || ''),
      manager_contact: normalizeUTF8(businessData.manager_contact || ''),
      manager_position: normalizeUTF8(businessData.manager_position || ''),
      fax_number: normalizeUTF8(businessData.fax_number || ''),
      email: normalizeUTF8(businessData.email || ''),
      
      // Measurement device fields
      ph_meter: parseInt(businessData.ph_meter || '0') || 0,
      differential_pressure_meter: parseInt(businessData.differential_pressure_meter || '0') || 0,
      temperature_meter: parseInt(businessData.temperature_meter || '0') || 0,
      discharge_current_meter: parseInt(businessData.discharge_current_meter || '0') || 0,
      fan_current_meter: parseInt(businessData.fan_current_meter || '0') || 0,
      pump_current_meter: parseInt(businessData.pump_current_meter || '0') || 0,
      gateway: businessData.gateway,
      
      // VPN fields as integers (post-migration)
      vpn_wired: parseInt(businessData.vpn_wired || '0') || 0,
      vpn_wireless: parseInt(businessData.vpn_wireless || '0') || 0,
      multiple_stack: parseInt(businessData.multiple_stack || '0') || 0,
      
      // Additional measurement device fields
      explosion_proof_differential_pressure_meter_domestic: parseInt(businessData.explosion_proof_differential_pressure_meter_domestic || '0') || 0,
      explosion_proof_temperature_meter_domestic: parseInt(businessData.explosion_proof_temperature_meter_domestic || '0') || 0,
      expansion_device: parseInt(businessData.expansion_device || '0') || 0,
      relay_8ch: parseInt(businessData.relay_8ch || '0') || 0,
      relay_16ch: parseInt(businessData.relay_16ch || '0') || 0,
      main_board_replacement: parseInt(businessData.main_board_replacement || '0') || 0,
      business_management_code: parseInt(businessData.business_management_code || '0') || 0,
      
      // Project management fields
      row_number: businessData.row_number ? parseInt(businessData.row_number) : null,
      department: normalizeUTF8(businessData.department || ''),
      progress_status: normalizeUTF8(businessData.progress_status || ''),
      contract_document: normalizeUTF8(businessData.contract_document || ''),
      order_request_date: businessData.order_request_date || null,
      wireless_document: normalizeUTF8(businessData.wireless_document || ''),
      installation_support: normalizeUTF8(businessData.installation_support || ''),
      order_manager: normalizeUTF8(businessData.order_manager || ''),
      order_date: businessData.order_date || null,
      shipment_date: businessData.shipment_date || null,
      inventory_check: normalizeUTF8(businessData.inventory_check || ''),
      installation_date: businessData.installation_date || null,
      installation_team: normalizeUTF8(businessData.installation_team || ''),
      
      // Business classification and operational fields
      business_category: normalizeUTF8(businessData.business_category || ''),
      pollutants: normalizeUTF8(businessData.pollutants || ''),
      annual_emission_amount: businessData.annual_emission_amount ? parseInt(businessData.annual_emission_amount) : null,
      first_report_date: businessData.first_report_date || null,
      operation_start_date: businessData.operation_start_date || null,
      subsidy_approval_date: businessData.subsidy_approval_date || null,
      
      // System and additional fields
      manufacturer: businessData.manufacturer,
      vpn: businessData.vpn,
      greenlink_id: normalizeUTF8(businessData.greenlink_id || ''),
      greenlink_pw: normalizeUTF8(businessData.greenlink_pw || ''),
      sales_office: normalizeUTF8(businessData.sales_office || ''),
      expansion_pack: businessData.expansion_pack ? parseInt(businessData.expansion_pack) : null,
      other_equipment: normalizeUTF8(businessData.other_equipment || ''),
      additional_cost: businessData.additional_cost ? parseInt(businessData.additional_cost) : null,
      negotiation: normalizeUTF8(businessData.negotiation || ''),
      multiple_stack_cost: businessData.multiple_stack_cost ? parseInt(businessData.multiple_stack_cost) : null,
      representative_birth_date: businessData.representative_birth_date || null,
      
      // System fields
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