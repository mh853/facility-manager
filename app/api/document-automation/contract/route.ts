// app/api/document-automation/contract/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { verifyTokenString } from '@/utils/auth';

// Force dynamic rendering
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

interface ContractGenerationRequest {
  business_id: string;
  contract_type: 'subsidy' | 'self_pay';
  contract_date?: string;
  payment_advance_ratio?: number;
  payment_balance_ratio?: number;
  additional_cost?: number;
  negotiation_cost?: number;
}

/**
 * POST /api/document-automation/contract
 * 계약서 생성 및 PDF 변환
 * 권한: 1 이상
 */
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

    const userId = decoded.userId || decoded.id;
    const permissionLevel = decoded.permissionLevel || decoded.permission_level;

    // 권한 확인: 권한 1 이상 필요
    if (!permissionLevel || permissionLevel < 1) {
      return NextResponse.json({
        success: false,
        message: '계약서 생성 권한이 필요합니다. (권한 1 이상)'
      }, { status: 403 });
    }

    // 요청 바디 파싱
    const body: ContractGenerationRequest = await request.json();
    const {
      business_id,
      contract_type,
      contract_date,
      payment_advance_ratio,
      payment_balance_ratio,
      additional_cost,
      negotiation_cost
    } = body;

    console.log('📝 계약서 생성 요청 데이터:', {
      business_id,
      contract_type,
      payment_advance_ratio,
      payment_balance_ratio,
      additional_cost,
      negotiation_cost
    });

    // 필수 파라미터 검증
    if (!business_id || !contract_type) {
      return NextResponse.json({
        success: false,
        message: 'business_id와 contract_type은 필수입니다.'
      }, { status: 400 });
    }

    // contract_type 검증
    if (!['subsidy', 'self_pay'].includes(contract_type)) {
      return NextResponse.json({
        success: false,
        message: 'contract_type은 subsidy 또는 self_pay만 가능합니다.'
      }, { status: 400 });
    }

    // 1. 사업장 정보 조회 (business_info 테이블 사용, 장비 수량 및 비용 정보 포함)
    const { data: business, error: businessError } = await supabaseAdmin
      .from('business_info')
      .select(`
        id,
        business_name,
        address,
        representative_name,
        business_registration_number,
        business_contact,
        fax_number,
        ph_meter,
        differential_pressure_meter,
        temperature_meter,
        discharge_current_meter,
        fan_current_meter,
        pump_current_meter,
        gateway,
        vpn_wired,
        vpn_wireless,
        additional_cost,
        negotiation
      `)
      .eq('id', business_id)
      .eq('is_deleted', false)
      .single();

    if (businessError || !business) {
      console.error('사업장 조회 오류:', businessError);
      return NextResponse.json({
        success: false,
        message: '사업장 정보를 찾을 수 없습니다.'
      }, { status: 404 });
    }

    // 2. 매출금액 조회 (매출 관리 모달과 동일한 실시간 계산 사용)
    let baseRevenue = 0;  // 기본 매출 (기기 합계)
    let totalAmount = 0;  // 최종 매출 (기본 + 추가공사비 - 협의사항)
    let additionalCost = 0;
    let negotiationCost = 0;

    // 2-1. /api/revenue/calculate 호출하여 실시간 매출 계산 (매출 관리 모달과 동일)
    console.log('💰 [CONTRACT] 실시간 매출 계산 시작 (매출 관리 모달 방식)');
    try {
      const calculateResponse = await fetch(`${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/revenue/calculate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`  // ✅ 현재 요청의 토큰 사용
        },
        body: JSON.stringify({
          business_id: business_id,
          save_result: false  // 계산만 하고 저장하지 않음 (모달과 동일)
        })
      });

      if (calculateResponse.ok) {
        const calculateData = await calculateResponse.json();

        console.log('💰 [CONTRACT] API 응답 전체:', JSON.stringify(calculateData, null, 2));

        if (calculateData.success && calculateData.data?.calculation) {
          const calc = calculateData.data.calculation;

          console.log('💰 [CONTRACT] calculation 객체:', {
            base_revenue: calc.base_revenue,
            total_revenue: calc.total_revenue,
            equipment_breakdown_count: calc.equipment_breakdown?.length || 0,
            all_keys: Object.keys(calc)
          });

          // 🔥 대안: equipment_breakdown에서 직접 기본 매출 계산 (API가 base_revenue를 안돌려주므로)
          if (calc.equipment_breakdown && Array.isArray(calc.equipment_breakdown)) {
            baseRevenue = calc.equipment_breakdown.reduce((sum, item) => {
              return sum + (item.total_revenue || 0);
            }, 0);
            console.log('✅ [CONTRACT] equipment_breakdown에서 기본 매출 직접 계산:', {
              count: calc.equipment_breakdown.length,
              base_revenue: baseRevenue,
              items: calc.equipment_breakdown.map(item => ({
                equipment: item.equipment_type,
                revenue: item.total_revenue
              }))
            });
          } else {
            // Fallback: API가 base_revenue를 돌려주면 사용
            baseRevenue = calc.base_revenue || 0;
            console.log('⚠️ [CONTRACT] equipment_breakdown 없음, base_revenue 사용:', baseRevenue);
          }

          // 최종 매출 (기본 + 추가공사비 - 협의사항) - 헤더에 표시
          totalAmount = calc.total_revenue || 0;

          console.log('💰 [CONTRACT] 실시간 매출 계산 성공:', {
            base_revenue: baseRevenue,
            total_revenue: totalAmount,
            calculation: `${baseRevenue} (기기 합계)`
          });
        } else {
          console.warn('⚠️ [CONTRACT] 매출 계산 API 응답이 올바르지 않습니다:', calculateData);
        }
      } else {
        console.error('❌ [CONTRACT] 매출 계산 API 호출 실패:', calculateResponse.status);
      }
    } catch (calcError) {
      console.error('❌ [CONTRACT] 실시간 매출 계산 중 오류:', calcError);
    }

    // 2-2. 추가공사비 및 협의금액 추출 (business_info 테이블에서)
    // 추가공사비 (additional_cost) - 계약서 표에 표시되는 항목
    additionalCost = business.additional_cost || 0;

    // 협의금액 (negotiation)
    negotiationCost = business.negotiation
      ? parseFloat(String(business.negotiation).replace(/[^0-9.-]/g, '')) || 0
      : 0;

    console.log('💰 사업장 비용 정보 최종:', {
      business_id,
      business_name: business.business_name,
      base_revenue: baseRevenue,  // 기본 매출 (기기 합계)
      additional_cost: additionalCost,  // 추가공사비
      negotiation_cost: negotiationCost,  // 협의사항
      total_amount: totalAmount,  // 최종 매출
      calculation_formula: `${baseRevenue} + ${additionalCost} - ${negotiationCost} = ${totalAmount}`,
      calculation_method: 'realtime_api_call'
    });

    // 2-2. 장비 수량 추출 (business_info 테이블에서 직접 사용)
    console.log('🔍 사업장 장비 수량 추출:', {
      business_id,
      business_name: business.business_name,
      equipment_from_business_info: {
        ph_meter: business.ph_meter,
        differential_pressure_meter: business.differential_pressure_meter,
        temperature_meter: business.temperature_meter,
        discharge_current_meter: business.discharge_current_meter,
        fan_current_meter: business.fan_current_meter,
        pump_current_meter: business.pump_current_meter,
        gateway: business.gateway,
        vpn_wired: business.vpn_wired,
        vpn_wireless: business.vpn_wireless
      }
    });

    // business_info 테이블의 장비 수량 사용
    const phCount = business.ph_meter || 0;
    const pressureCount = business.differential_pressure_meter || 0;
    const temperatureCount = business.temperature_meter || 0;
    const dischargeCtCount = business.discharge_current_meter || 0;
    const fanCtCount = business.fan_current_meter || 0;
    const pumpCtCount = business.pump_current_meter || 0;
    const gatewayCount = business.gateway || 0;
    const vpnCount = (business.vpn_wired || 0) + (business.vpn_wireless || 0);

    // 장비 수량 로그
    console.log('🔧 장비 수량 최종 계산:', {
      business_name: business.business_name,
      equipment_counts: {
        ph_meter: phCount,
        differential_pressure_meter: pressureCount,
        temperature_meter: temperatureCount,
        discharge_current_meter: dischargeCtCount,
        fan_current_meter: fanCtCount,
        pump_current_meter: pumpCtCount,
        gateway: gatewayCount,
        vpn: vpnCount
      }
    });

    // 2. 계약서 번호 생성 (CONT-YYYYMMDD-XXX)
    const today = contract_date || new Date().toISOString().split('T')[0];
    const dateStr = today.replace(/-/g, '');

    // 오늘 날짜의 계약서 개수 조회
    const { data: todayContracts, error: countError } = await supabaseAdmin
      .from('contract_history')
      .select('contract_number')
      .like('contract_number', `CONT-${dateStr}-%`)
      .order('contract_number', { ascending: false })
      .limit(1);

    let sequenceNumber = 1;
    if (todayContracts && todayContracts.length > 0) {
      const lastNumber = todayContracts[0].contract_number.split('-')[2];
      sequenceNumber = parseInt(lastNumber) + 1;
    }

    const contractNumber = `CONT-${dateStr}-${String(sequenceNumber).padStart(3, '0')}`;

    // 3. 계약서 템플릿 조회
    const { data: template, error: templateError } = await supabaseAdmin
      .from('contract_templates')
      .select('*')
      .eq('contract_type', contract_type)
      .eq('is_active', true)
      .single();

    if (templateError || !template) {
      console.error('템플릿 조회 오류:', templateError);
      return NextResponse.json({
        success: false,
        message: '계약서 템플릿을 찾을 수 없습니다.'
      }, { status: 404 });
    }

    // 4. 계약서 데이터 생성
    const contractData = {
      contract_number: contractNumber,
      contract_date: today,
      contract_type,
      business_name: business.business_name,
      business_address: business.address || '',
      business_representative: business.representative_name || '',
      business_registration_number: business.business_registration_number || '',
      business_phone: business.business_contact || '',
      business_fax: business.fax_number || '',
      total_amount: baseRevenue,  // 기본 매출 (기기 합계) - 계약서 표의 "금액 계"에 표시
      final_amount: totalAmount,  // 최종 매출 (기본 + 추가공사비 - 협의사항) - 헤더에 표시
      supplier_company_name: template.supplier_company_name,
      supplier_representative: template.supplier_representative,
      supplier_address: template.supplier_address,
      terms_and_conditions: template.terms_and_conditions,
      payment_advance_ratio: payment_advance_ratio || 50,
      payment_balance_ratio: payment_balance_ratio || 50,
      additional_cost: additionalCost,  // 추가공사비
      negotiation_cost: negotiationCost,  // 협의사항
      equipment_counts: {
        ph_meter: phCount,
        differential_pressure_meter: pressureCount,
        temperature_meter: temperatureCount,
        discharge_current_meter: dischargeCtCount,
        fan_current_meter: fanCtCount,
        pump_current_meter: pumpCtCount,
        gateway: gatewayCount,
        vpn: vpnCount
      }
    };

    // 5. 계약서 이력 저장 (모든 정보 포함)
    const { data: savedContract, error: saveError } = await supabaseAdmin
      .from('contract_history')
      .insert({
        business_id,
        business_name: business.business_name,
        contract_type,
        contract_number: contractNumber,
        contract_date: today,
        total_amount: baseRevenue,  // 기본 매출 (호환성)
        base_revenue: baseRevenue,  // 기본 매출 (기기 합계)
        final_amount: totalAmount,  // 최종 매출 (기본 + 추가공사비 - 협의사항)
        business_address: business.address,
        business_representative: business.representative_name,
        business_registration_number: business.business_registration_number || '',
        business_phone: business.business_contact || '',
        business_fax: business.fax_number || '',
        supplier_company_name: template.supplier_company_name,
        supplier_representative: template.supplier_representative,
        supplier_address: template.supplier_address,
        terms_and_conditions: template.terms_and_conditions,
        payment_advance_ratio: payment_advance_ratio || 50,
        payment_balance_ratio: payment_balance_ratio || 50,
        additional_cost: additionalCost,
        negotiation_cost: negotiationCost,
        equipment_counts: {
          ph_meter: phCount,
          differential_pressure_meter: pressureCount,
          temperature_meter: temperatureCount,
          discharge_current_meter: dischargeCtCount,
          fan_current_meter: fanCtCount,
          pump_current_meter: pumpCtCount,
          gateway: gatewayCount,
          vpn: vpnCount
        },
        created_by: userId
      })
      .select()
      .single();

    if (saveError) {
      console.error('계약서 저장 오류:', saveError);
      return NextResponse.json({
        success: false,
        message: '계약서 저장에 실패했습니다.',
        error: saveError.message
      }, { status: 500 });
    }

    // 6. document_history 테이블에도 이력 추가 (실행이력 탭에 표시되도록)
    const documentName = `${contract_type === 'subsidy' ? '보조금' : '자비'} 계약서 - ${business.business_name}`;
    await supabaseAdmin
      .from('document_history')
      .insert({
        business_id,
        document_type: 'contract',
        document_name: documentName,
        document_data: JSON.stringify(contractData),
        file_format: 'pdf',
        file_size: 0, // PDF 생성 후 업데이트 가능
        created_by: userId
      });

    return NextResponse.json({
      success: true,
      message: '계약서가 생성되었습니다.',
      data: {
        contract: savedContract,
        template_data: contractData
      }
    });

  } catch (error) {
    console.error('계약서 생성 API 오류:', error);
    return NextResponse.json({
      success: false,
      message: '서버 오류가 발생했습니다.',
      error: error instanceof Error ? error.message : String(error)
    }, { status: 500 });
  }
}

/**
 * GET /api/document-automation/contract
 * 계약서 목록 조회
 * 권한: 1 이상
 */
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

    const permissionLevel = decoded.permissionLevel || decoded.permission_level;

    // 권한 확인: 권한 1 이상 필요
    if (!permissionLevel || permissionLevel < 1) {
      return NextResponse.json({
        success: false,
        message: '계약서 조회 권한이 필요합니다. (권한 1 이상)'
      }, { status: 403 });
    }

    // 쿼리 파라미터
    const url = new URL(request.url);
    const businessId = url.searchParams.get('business_id');
    const contractType = url.searchParams.get('contract_type');
    const limit = parseInt(url.searchParams.get('limit') || '50');
    const offset = parseInt(url.searchParams.get('offset') || '0');

    // 쿼리 빌더
    let query = supabaseAdmin
      .from('contract_history')
      .select('*', { count: 'exact' })
      .eq('is_deleted', false) // 삭제되지 않은 계약서만 조회
      .order('created_at', { ascending: false });

    if (businessId) {
      query = query.eq('business_id', businessId);
    }

    if (contractType && ['subsidy', 'self_pay'].includes(contractType)) {
      query = query.eq('contract_type', contractType);
    }

    query = query.range(offset, offset + limit - 1);

    const { data: contracts, error, count } = await query;

    // 디버깅: equipment_counts 확인
    if (contracts && contracts.length > 0) {
      console.log('📋 조회된 계약서 equipment_counts:', contracts.map(c => ({
        contract_number: c.contract_number,
        business_name: c.business_name,
        equipment_counts: c.equipment_counts
      })));
    }

    if (error) {
      console.error('계약서 조회 오류:', error);
      return NextResponse.json({
        success: false,
        message: '계약서 조회에 실패했습니다.'
      }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      data: contracts || [],
      total: count || 0,
      limit,
      offset
    });

  } catch (error) {
    console.error('계약서 조회 API 오류:', error);
    return NextResponse.json({
      success: false,
      message: '서버 오류가 발생했습니다.'
    }, { status: 500 });
  }
}

/**
 * PUT /api/document-automation/contract
 * 계약서 수정 (PDF URL 업데이트)
 * 권한: 1 이상
 */
export async function PUT(request: NextRequest) {
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

    const permissionLevel = decoded.permissionLevel || decoded.permission_level;

    // 권한 확인: 권한 1 이상 필요
    if (!permissionLevel || permissionLevel < 1) {
      return NextResponse.json({
        success: false,
        message: '계약서 수정 권한이 필요합니다. (권한 1 이상)'
      }, { status: 403 });
    }

    const body = await request.json();
    const { contract_id, pdf_file_url } = body;

    if (!contract_id) {
      return NextResponse.json({
        success: false,
        message: 'contract_id가 필요합니다.'
      }, { status: 400 });
    }

    // PDF URL 업데이트
    const { data, error } = await supabaseAdmin
      .from('contract_history')
      .update({
        pdf_file_url,
        updated_at: new Date().toISOString()
      })
      .eq('id', contract_id)
      .select()
      .single();

    if (error) {
      console.error('계약서 수정 오류:', error);
      return NextResponse.json({
        success: false,
        message: '계약서 수정에 실패했습니다.'
      }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      message: '계약서가 수정되었습니다.',
      data
    });

  } catch (error) {
    console.error('계약서 수정 API 오류:', error);
    return NextResponse.json({
      success: false,
      message: '서버 오류가 발생했습니다.'
    }, { status: 500 });
  }
}

/**
 * DELETE /api/document-automation/contract
 * 계약서 삭제
 * 권한: 3 이상만 가능
 */
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

    const permissionLevel = decoded.permissionLevel || decoded.permission_level;
    const userId = decoded.userId || decoded.id;

    // 권한 확인: 권한 4 이상 필요
    if (!permissionLevel || permissionLevel < 4) {
      return NextResponse.json({
        success: false,
        message: '계약서 삭제 권한이 없습니다. (권한 4 이상 필요)'
      }, { status: 403 });
    }

    const url = new URL(request.url);
    const contractId = url.searchParams.get('id');

    if (!contractId) {
      return NextResponse.json({
        success: false,
        message: '삭제할 계약서 ID가 필요합니다.'
      }, { status: 400 });
    }

    // 계약서 soft delete (is_deleted = true로 업데이트)
    const { error } = await supabaseAdmin
      .from('contract_history')
      .update({
        is_deleted: true,
        deleted_at: new Date().toISOString(),
        deleted_by: userId
      })
      .eq('id', contractId);

    if (error) {
      console.error('계약서 삭제 오류:', error);
      return NextResponse.json({
        success: false,
        message: '계약서 삭제에 실패했습니다.'
      }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      message: '계약서가 삭제되었습니다.'
    });

  } catch (error) {
    console.error('계약서 삭제 API 오류:', error);
    return NextResponse.json({
      success: false,
      message: '서버 오류가 발생했습니다.'
    }, { status: 500 });
  }
}
