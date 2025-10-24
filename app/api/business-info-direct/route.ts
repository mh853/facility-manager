import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

// Force dynamic rendering for API routes
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';


// UTF-8 normalization function
function normalizeUTF8(str: string): string {
  if (!str || typeof str !== 'string') return '';
  return str.normalize('NFC');
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const searchQuery = searchParams.get('search') || '';
    const limit = parseInt(searchParams.get('limit') || '1500');
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

    // Measurement device fields - all as integers, null-safe
    if (updateData.ph_meter !== undefined) {
      updateObject.ph_meter = updateData.ph_meter === null ? null : parseInt(updateData.ph_meter) || 0;
    }
    if (updateData.differential_pressure_meter !== undefined) {
      updateObject.differential_pressure_meter = updateData.differential_pressure_meter === null ? null : parseInt(updateData.differential_pressure_meter) || 0;
    }
    if (updateData.temperature_meter !== undefined) {
      updateObject.temperature_meter = updateData.temperature_meter === null ? null : parseInt(updateData.temperature_meter) || 0;
    }
    if (updateData.discharge_current_meter !== undefined) {
      updateObject.discharge_current_meter = updateData.discharge_current_meter === null ? null : parseInt(updateData.discharge_current_meter) || 0;
    }
    if (updateData.fan_current_meter !== undefined) {
      updateObject.fan_current_meter = updateData.fan_current_meter === null ? null : parseInt(updateData.fan_current_meter) || 0;
    }
    if (updateData.pump_current_meter !== undefined) {
      updateObject.pump_current_meter = updateData.pump_current_meter === null ? null : parseInt(updateData.pump_current_meter) || 0;
    }
    if (updateData.gateway !== undefined) {
      updateObject.gateway = updateData.gateway === null ? null : parseInt(updateData.gateway) || 0;
    }

    // VPN fields - POST MIGRATION: Direct integer handling (no boolean conversion), null-safe
    if (updateData.vpn_wired !== undefined) {
      updateObject.vpn_wired = updateData.vpn_wired === null ? null : parseInt(updateData.vpn_wired) || 0;
    }
    if (updateData.vpn_wireless !== undefined) {
      updateObject.vpn_wireless = updateData.vpn_wireless === null ? null : parseInt(updateData.vpn_wireless) || 0;
    }
    if (updateData.multiple_stack !== undefined) {
      updateObject.multiple_stack = updateData.multiple_stack === null ? null : parseInt(updateData.multiple_stack) || 0;
    }

    // Additional measurement device fields - null-safe
    if (updateData.explosion_proof_differential_pressure_meter_domestic !== undefined) {
      updateObject.explosion_proof_differential_pressure_meter_domestic = updateData.explosion_proof_differential_pressure_meter_domestic === null ? null : parseInt(updateData.explosion_proof_differential_pressure_meter_domestic) || 0;
    }
    if (updateData.explosion_proof_temperature_meter_domestic !== undefined) {
      updateObject.explosion_proof_temperature_meter_domestic = updateData.explosion_proof_temperature_meter_domestic === null ? null : parseInt(updateData.explosion_proof_temperature_meter_domestic) || 0;
    }
    if (updateData.expansion_device !== undefined) {
      updateObject.expansion_device = updateData.expansion_device === null ? null : parseInt(updateData.expansion_device) || 0;
    }
    if (updateData.relay_8ch !== undefined) {
      updateObject.relay_8ch = updateData.relay_8ch === null ? null : parseInt(updateData.relay_8ch) || 0;
    }
    if (updateData.relay_16ch !== undefined) {
      updateObject.relay_16ch = updateData.relay_16ch === null ? null : parseInt(updateData.relay_16ch) || 0;
    }
    if (updateData.main_board_replacement !== undefined) {
      updateObject.main_board_replacement = updateData.main_board_replacement === null ? null : parseInt(updateData.main_board_replacement) || 0;
    }
    if (updateData.business_management_code !== undefined) {
      updateObject.business_management_code = updateData.business_management_code === null ? null : parseInt(updateData.business_management_code) || 0;
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
    if (updateData.project_year !== undefined) {
      updateObject.project_year = parseInt(updateData.project_year) || null;
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

    // 실사 관리 필드
    if (updateData.estimate_survey_manager !== undefined) {
      updateObject.estimate_survey_manager = normalizeUTF8(updateData.estimate_survey_manager || '');
    }
    if (updateData.estimate_survey_date !== undefined) {
      updateObject.estimate_survey_date = updateData.estimate_survey_date || null;
    }
    if (updateData.pre_construction_survey_manager !== undefined) {
      updateObject.pre_construction_survey_manager = normalizeUTF8(updateData.pre_construction_survey_manager || '');
    }
    if (updateData.pre_construction_survey_date !== undefined) {
      updateObject.pre_construction_survey_date = updateData.pre_construction_survey_date || null;
    }
    if (updateData.completion_survey_manager !== undefined) {
      updateObject.completion_survey_manager = normalizeUTF8(updateData.completion_survey_manager || '');
    }
    if (updateData.completion_survey_date !== undefined) {
      updateObject.completion_survey_date = updateData.completion_survey_date || null;
    }

    // 계산서 및 입금 관리 필드 (보조금 사업장)
    if (updateData.invoice_1st_date !== undefined) {
      updateObject.invoice_1st_date = updateData.invoice_1st_date || null;
    }
    if (updateData.invoice_1st_amount !== undefined) {
      updateObject.invoice_1st_amount = updateData.invoice_1st_amount ? parseInt(updateData.invoice_1st_amount) : null;
    }
    if (updateData.payment_1st_date !== undefined) {
      updateObject.payment_1st_date = updateData.payment_1st_date || null;
    }
    if (updateData.payment_1st_amount !== undefined) {
      updateObject.payment_1st_amount = updateData.payment_1st_amount ? parseInt(updateData.payment_1st_amount) : null;
    }
    if (updateData.invoice_2nd_date !== undefined) {
      updateObject.invoice_2nd_date = updateData.invoice_2nd_date || null;
    }
    if (updateData.invoice_2nd_amount !== undefined) {
      updateObject.invoice_2nd_amount = updateData.invoice_2nd_amount ? parseInt(updateData.invoice_2nd_amount) : null;
    }
    if (updateData.payment_2nd_date !== undefined) {
      updateObject.payment_2nd_date = updateData.payment_2nd_date || null;
    }
    if (updateData.payment_2nd_amount !== undefined) {
      updateObject.payment_2nd_amount = updateData.payment_2nd_amount ? parseInt(updateData.payment_2nd_amount) : null;
    }
    if (updateData.invoice_additional_date !== undefined) {
      updateObject.invoice_additional_date = updateData.invoice_additional_date || null;
    }
    if (updateData.payment_additional_date !== undefined) {
      updateObject.payment_additional_date = updateData.payment_additional_date || null;
    }
    if (updateData.payment_additional_amount !== undefined) {
      updateObject.payment_additional_amount = updateData.payment_additional_amount ? parseInt(updateData.payment_additional_amount) : null;
    }

    // 계산서 및 입금 관리 필드 (자비 사업장)
    if (updateData.invoice_advance_date !== undefined) {
      updateObject.invoice_advance_date = updateData.invoice_advance_date || null;
    }
    if (updateData.invoice_advance_amount !== undefined) {
      updateObject.invoice_advance_amount = updateData.invoice_advance_amount ? parseInt(updateData.invoice_advance_amount) : null;
    }
    if (updateData.payment_advance_date !== undefined) {
      updateObject.payment_advance_date = updateData.payment_advance_date || null;
    }
    if (updateData.payment_advance_amount !== undefined) {
      updateObject.payment_advance_amount = updateData.payment_advance_amount ? parseInt(updateData.payment_advance_amount) : null;
    }
    if (updateData.invoice_balance_date !== undefined) {
      updateObject.invoice_balance_date = updateData.invoice_balance_date || null;
    }
    if (updateData.invoice_balance_amount !== undefined) {
      updateObject.invoice_balance_amount = updateData.invoice_balance_amount ? parseInt(updateData.invoice_balance_amount) : null;
    }
    if (updateData.payment_balance_date !== undefined) {
      updateObject.payment_balance_date = updateData.payment_balance_date || null;
    }
    if (updateData.payment_balance_amount !== undefined) {
      updateObject.payment_balance_amount = updateData.payment_balance_amount ? parseInt(updateData.payment_balance_amount) : null;
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

    // 배치 업로드 모드 확인
    if (businessData.isBatchUpload && Array.isArray(businessData.businesses)) {
      console.log('📦 [BUSINESS-INFO-DIRECT] 배치 업로드 시작 - 총', businessData.businesses.length, '개');

      let created = 0;
      let updated = 0;
      let errors = 0;
      const errorDetails: Array<{ business_name: string; error: string }> = [];

      for (const business of businessData.businesses) {
        try {
          const normalizedName = normalizeUTF8(business.business_name || '');

          if (!normalizedName) {
            errors++;
            errorDetails.push({ business_name: '(이름 없음)', error: '사업장명이 비어있습니다' });
            continue;
          }

          // 기존 사업장 검색 (사업장명으로)
          const { data: existing, error: searchError } = await supabaseAdmin
            .from('business_info')
            .select('id')
            .eq('business_name', normalizedName)
            .eq('is_deleted', false)
            .maybeSingle();

          if (searchError && searchError.code !== 'PGRST116') {
            console.error('❌ [BATCH] 검색 오류:', normalizedName, searchError);
            errors++;
            errorDetails.push({ business_name: normalizedName, error: searchError.message });
            continue;
          }

          // 데이터 정규화
          const normalizedData = {
            business_name: normalizedName,
            local_government: normalizeUTF8(business.local_government || ''),
            address: normalizeUTF8(business.address || ''),
            representative_name: normalizeUTF8(business.representative_name || ''),
            business_registration_number: normalizeUTF8(business.business_registration_number || ''),
            business_type: normalizeUTF8(business.business_type || ''),
            business_contact: normalizeUTF8(business.business_contact || ''),
            manager_name: normalizeUTF8(business.manager_name || ''),
            manager_contact: normalizeUTF8(business.manager_contact || ''),
            manager_position: normalizeUTF8(business.manager_position || ''),
            fax_number: normalizeUTF8(business.fax_number || ''),
            email: normalizeUTF8(business.email || ''),
            ph_meter: parseInt(business.ph_meter || '0') || 0,
            differential_pressure_meter: parseInt(business.differential_pressure_meter || '0') || 0,
            temperature_meter: parseInt(business.temperature_meter || '0') || 0,
            discharge_current_meter: parseInt(business.discharge_current_meter || '0') || 0,
            fan_current_meter: parseInt(business.fan_current_meter || '0') || 0,
            pump_current_meter: parseInt(business.pump_current_meter || '0') || 0,
            gateway: parseInt(business.gateway || '0') || 0,
            vpn_wired: parseInt(business.vpn_wired || '0') || 0,
            vpn_wireless: parseInt(business.vpn_wireless || '0') || 0,
            multiple_stack: parseInt(business.multiple_stack || '0') || 0,
            explosion_proof_differential_pressure_meter_domestic: parseInt(business.explosion_proof_differential_pressure_meter_domestic || '0') || 0,
            explosion_proof_temperature_meter_domestic: parseInt(business.explosion_proof_temperature_meter_domestic || '0') || 0,
            expansion_device: parseInt(business.expansion_device || '0') || 0,
            relay_8ch: parseInt(business.relay_8ch || '0') || 0,
            relay_16ch: parseInt(business.relay_16ch || '0') || 0,
            main_board_replacement: parseInt(business.main_board_replacement || '0') || 0,
            business_management_code: parseInt(business.business_management_code || '0') || 0,
            department: normalizeUTF8(business.department || ''),
            progress_status: normalizeUTF8(business.progress_status || ''),
            project_year: business.project_year ? parseInt(business.project_year) : null,
            installation_team: normalizeUTF8(business.installation_team || ''),
            business_category: normalizeUTF8(business.business_category || ''),
            manufacturer: business.manufacturer || null,
            sales_office: normalizeUTF8(business.sales_office || ''),
            greenlink_id: normalizeUTF8(business.greenlink_id || ''),
            greenlink_pw: normalizeUTF8(business.greenlink_pw || ''),
            additional_cost: business.additional_cost ? parseInt(business.additional_cost) : null,
            negotiation: normalizeUTF8(business.negotiation || ''),

            // 일정 관리
            order_manager: normalizeUTF8(business.order_manager || ''),
            order_request_date: business.order_request_date || null,
            order_date: business.order_date || null,
            shipment_date: business.shipment_date || null,
            installation_date: business.installation_date || null,

            // 실사 관리
            estimate_survey_manager: normalizeUTF8(business.estimate_survey_manager || ''),
            estimate_survey_date: business.estimate_survey_date || null,
            pre_construction_survey_manager: normalizeUTF8(business.pre_construction_survey_manager || ''),
            pre_construction_survey_date: business.pre_construction_survey_date || null,
            completion_survey_manager: normalizeUTF8(business.completion_survey_manager || ''),
            completion_survey_date: business.completion_survey_date || null,

            // 계산서 및 입금 관리 (보조금 사업장)
            invoice_1st_date: business.invoice_1st_date || null,
            invoice_1st_amount: business.invoice_1st_amount ? parseInt(business.invoice_1st_amount) : null,
            payment_1st_date: business.payment_1st_date || null,
            payment_1st_amount: business.payment_1st_amount ? parseInt(business.payment_1st_amount) : null,
            invoice_2nd_date: business.invoice_2nd_date || null,
            invoice_2nd_amount: business.invoice_2nd_amount ? parseInt(business.invoice_2nd_amount) : null,
            payment_2nd_date: business.payment_2nd_date || null,
            payment_2nd_amount: business.payment_2nd_amount ? parseInt(business.payment_2nd_amount) : null,
            invoice_additional_date: business.invoice_additional_date || null,
            payment_additional_date: business.payment_additional_date || null,
            payment_additional_amount: business.payment_additional_amount ? parseInt(business.payment_additional_amount) : null,

            // 계산서 및 입금 관리 (자비 사업장)
            invoice_advance_date: business.invoice_advance_date || null,
            invoice_advance_amount: business.invoice_advance_amount ? parseInt(business.invoice_advance_amount) : null,
            payment_advance_date: business.payment_advance_date || null,
            payment_advance_amount: business.payment_advance_amount ? parseInt(business.payment_advance_amount) : null,
            invoice_balance_date: business.invoice_balance_date || null,
            invoice_balance_amount: business.invoice_balance_amount ? parseInt(business.invoice_balance_amount) : null,
            payment_balance_date: business.payment_balance_date || null,
            payment_balance_amount: business.payment_balance_amount ? parseInt(business.payment_balance_amount) : null,

            updated_at: new Date().toISOString()
          };

          if (existing) {
            // UPDATE: 기존 사업장 업데이트
            const { error: updateError } = await supabaseAdmin
              .from('business_info')
              .update(normalizedData)
              .eq('id', existing.id);

            if (updateError) {
              console.error('❌ [BATCH] 업데이트 실패:', normalizedName, updateError);
              errors++;
              errorDetails.push({ business_name: normalizedName, error: updateError.message });
            } else {
              updated++;
              console.log('✅ [BATCH] 업데이트:', normalizedName);
            }
          } else {
            // INSERT: 새 사업장 추가
            const insertData = {
              ...normalizedData,
              created_at: new Date().toISOString(),
              is_active: true,
              is_deleted: false
            };

            const { error: insertError } = await supabaseAdmin
              .from('business_info')
              .insert([insertData]);

            if (insertError) {
              console.error('❌ [BATCH] 삽입 실패:', normalizedName, insertError);
              errors++;
              errorDetails.push({ business_name: normalizedName, error: insertError.message });
            } else {
              created++;
              console.log('✅ [BATCH] 생성:', normalizedName);
            }
          }
        } catch (itemError: any) {
          errors++;
          errorDetails.push({
            business_name: business.business_name || '(이름 없음)',
            error: itemError.message
          });
        }
      }

      console.log('📦 [BATCH] 완료 - 생성:', created, '/ 업데이트:', updated, '/ 오류:', errors);

      return NextResponse.json({
        success: true,
        message: '배치 업로드가 완료되었습니다.',
        data: {
          results: {
            total: businessData.businesses.length,
            created,
            updated,
            errors,
            errorDetails: errorDetails.slice(0, 10) // 최대 10개만 반환
          }
        }
      });
    }

    // 단일 사업장 생성
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
      project_year: businessData.project_year ? parseInt(businessData.project_year) : null,
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

      // 실사 관리 필드
      estimate_survey_manager: normalizeUTF8(businessData.estimate_survey_manager || ''),
      estimate_survey_date: businessData.estimate_survey_date || null,
      pre_construction_survey_manager: normalizeUTF8(businessData.pre_construction_survey_manager || ''),
      pre_construction_survey_date: businessData.pre_construction_survey_date || null,
      completion_survey_manager: normalizeUTF8(businessData.completion_survey_manager || ''),
      completion_survey_date: businessData.completion_survey_date || null,

      // 계산서 및 입금 관리 (보조금 사업장)
      invoice_1st_date: businessData.invoice_1st_date || null,
      invoice_1st_amount: businessData.invoice_1st_amount ? parseInt(businessData.invoice_1st_amount) : null,
      payment_1st_date: businessData.payment_1st_date || null,
      payment_1st_amount: businessData.payment_1st_amount ? parseInt(businessData.payment_1st_amount) : null,
      invoice_2nd_date: businessData.invoice_2nd_date || null,
      invoice_2nd_amount: businessData.invoice_2nd_amount ? parseInt(businessData.invoice_2nd_amount) : null,
      payment_2nd_date: businessData.payment_2nd_date || null,
      payment_2nd_amount: businessData.payment_2nd_amount ? parseInt(businessData.payment_2nd_amount) : null,
      invoice_additional_date: businessData.invoice_additional_date || null,
      payment_additional_date: businessData.payment_additional_date || null,
      payment_additional_amount: businessData.payment_additional_amount ? parseInt(businessData.payment_additional_amount) : null,

      // 계산서 및 입금 관리 (자비 사업장)
      invoice_advance_date: businessData.invoice_advance_date || null,
      invoice_advance_amount: businessData.invoice_advance_amount ? parseInt(businessData.invoice_advance_amount) : null,
      payment_advance_date: businessData.payment_advance_date || null,
      payment_advance_amount: businessData.payment_advance_amount ? parseInt(businessData.payment_advance_amount) : null,
      invoice_balance_date: businessData.invoice_balance_date || null,
      invoice_balance_amount: businessData.invoice_balance_amount ? parseInt(businessData.invoice_balance_amount) : null,
      payment_balance_date: businessData.payment_balance_date || null,
      payment_balance_amount: businessData.payment_balance_amount ? parseInt(businessData.payment_balance_amount) : null,

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