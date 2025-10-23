import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { verifyTokenString } from '@/utils/auth';

// Force dynamic rendering for API routes
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

interface EquipmentBreakdown {
  equipment_type: string;
  equipment_name: string;
  quantity: number;
  unit_official_price: number;
  unit_manufacturer_price: number;
  unit_installation_cost: number;
  total_revenue: number;
  total_cost: number;
  total_installation: number;
  profit: number;
}

interface CostBreakdown {
  sales_commission_type: 'percentage' | 'per_unit';
  sales_commission_rate: number;
  sales_commission_amount: number;
  survey_costs: {
    estimate: number;
    pre_construction: number;
    completion: number;
    adjustments: number;
    total: number;
  };
  total_installation_costs: number;
}

interface RevenueCalculationResult {
  business_id: string;
  business_name: string;
  sales_office: string;
  calculation_date: string;
  total_revenue: number;
  total_cost: number;
  gross_profit: number;
  sales_commission: number;
  survey_costs: number;
  installation_costs: number;
  net_profit: number;
  equipment_breakdown: EquipmentBreakdown[];
  cost_breakdown: CostBreakdown;
}

// 매출 계산 실행
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

    console.log('🔍 [REVENUE-CALCULATE] 토큰 검증:', { userId, permissionLevel });

    // 권한 2 이상 확인 (매출 조회/계산)
    if (!permissionLevel || permissionLevel < 2) {
      console.log('❌ [REVENUE-CALCULATE] 권한 부족:', { permissionLevel });
      return NextResponse.json({
        success: false,
        message: '매출 계산 권한이 필요합니다.'
      }, { status: 403 });
    }

    const body = await request.json();
    const { business_id, calculation_date, save_result = true } = body;

    if (!business_id) {
      return NextResponse.json({
        success: false,
        message: 'business_id가 필요합니다.'
      }, { status: 400 });
    }

    const calcDate = calculation_date || new Date().toISOString().split('T')[0];

    console.log('🧮 [REVENUE-CALCULATE] 계산 시작:', { business_id, calcDate });

    // 1. 사업장 정보 조회
    const { data: businessInfo, error: businessError } = await supabaseAdmin
      .from('business_info')
      .select('*')
      .eq('id', business_id)
      .single();

    if (businessError || !businessInfo) {
      return NextResponse.json({
        success: false,
        message: '사업장 정보를 찾을 수 없습니다.'
      }, { status: 404 });
    }

    // 2. 환경부 고시가 정보 조회 (활성화된 최신 데이터)
    const { data: pricingData, error: pricingError } = await supabaseAdmin
      .from('government_pricing')
      .select('*')
      .eq('is_active', true)
      .lte('effective_from', calcDate);

    if (pricingError) {
      console.error('❌ [REVENUE-CALCULATE] 가격 정보 조회 오류:', pricingError);
      return NextResponse.json({
        success: false,
        message: '가격 정보 조회에 실패했습니다.'
      }, { status: 500 });
    }

    // 환경부 고시가를 맵으로 변환
    const officialPriceMap = pricingData?.reduce((acc, item) => {
      acc[item.equipment_type] = item;
      return acc;
    }, {} as Record<string, any>) || {};

    // 2-1. 제조사별 원가 정보 조회
    let manufacturer = businessInfo.manufacturer;

    // 제조사 정보가 없으면 기본값으로 '에코센스' 사용 및 업데이트
    if (!manufacturer || manufacturer.trim() === '') {
      manufacturer = '에코센스';
      console.log(`⚠️ [REVENUE-CALCULATE] ${businessInfo.business_name}: 제조사 정보 없음, 기본값 '에코센스' 사용`);

      // business_info 테이블 업데이트 (다음번 계산을 위해)
      const { error: updateError } = await supabaseAdmin
        .from('business_info')
        .update({ manufacturer: '에코센스' })
        .eq('id', business_id);

      if (updateError) {
        console.error('❌ [REVENUE-CALCULATE] 제조사 업데이트 오류:', updateError);
      } else {
        console.log(`✅ [REVENUE-CALCULATE] ${businessInfo.business_name}: 제조사를 '에코센스'로 업데이트 완료`);
      }
    }

    const { data: manufacturerPricing, error: mfgPricingError } = await supabaseAdmin
      .from('manufacturer_pricing')
      .select('*')
      .eq('manufacturer', manufacturer)
      .eq('is_active', true)
      .lte('effective_from', calcDate)
      .or(`effective_to.is.null,effective_to.gte.${calcDate}`);

    if (mfgPricingError) {
      console.error('❌ [REVENUE-CALCULATE] 제조사별 원가 조회 오류:', mfgPricingError);
      return NextResponse.json({
        success: false,
        message: '제조사별 원가 조회에 실패했습니다.'
      }, { status: 500 });
    }

    // 제조사별 원가를 맵으로 변환
    const manufacturerCostMap = manufacturerPricing?.reduce((acc, item) => {
      acc[item.equipment_type] = item;
      return acc;
    }, {} as Record<string, any>) || {};

    // 2-2. 기기별 기본 설치비 조회
    const { data: installationCosts, error: installError } = await supabaseAdmin
      .from('equipment_installation_cost')
      .select('*')
      .eq('is_active', true)
      .lte('effective_from', calcDate)
      .or(`effective_to.is.null,effective_to.gte.${calcDate}`);

    if (installError) {
      console.error('❌ [REVENUE-CALCULATE] 설치비 조회 오류:', installError);
    }

    const installationCostMap = installationCosts?.reduce((acc, item) => {
      acc[item.equipment_type] = item.base_installation_cost;
      return acc;
    }, {} as Record<string, number>) || {};

    // 2-3. 사업장별 추가 설치비 조회
    const { data: additionalCosts, error: additionalError } = await supabaseAdmin
      .from('business_additional_installation_cost')
      .select('*')
      .eq('business_id', business_id)
      .eq('is_active', true)
      .lte('applied_date', calcDate);

    if (additionalError) {
      console.error('❌ [REVENUE-CALCULATE] 추가 설치비 조회 오류:', additionalError);
    }

    // 사업장 추가 설치비를 맵으로 변환 (equipment_type별로 그룹화)
    const additionalCostMap = additionalCosts?.reduce((acc, item) => {
      const key = item.equipment_type || 'all'; // NULL이면 'all' 키로 저장
      if (!acc[key]) {
        acc[key] = 0;
      }
      acc[key] += item.additional_cost;
      return acc;
    }, {} as Record<string, number>) || {};

    console.log(`🔧 [REVENUE-CALCULATE] 제조사: ${manufacturer}, 기기수: ${Object.keys(manufacturerCostMap).length}`);

    // 원가 데이터가 없는 경우 경고
    if (Object.keys(manufacturerCostMap).length === 0) {
      console.warn(`⚠️ [REVENUE-CALCULATE] ${businessInfo.business_name}: 제조사 '${manufacturer}'의 원가 데이터가 없습니다. 매출 계산이 0이 될 수 있습니다.`);
    }

    // 3. 영업점 비용 설정 조회
    const salesOffice = businessInfo.sales_office || '기본';
    const { data: salesSettings } = await supabaseAdmin
      .from('sales_office_cost_settings')
      .select('*')
      .eq('sales_office', salesOffice)
      .eq('is_active', true)
      .lte('effective_from', calcDate)
      .order('effective_from', { ascending: false })
      .limit(1)
      .single();

    // 기본 영업비용 설정 (3%)
    const defaultCommission = {
      commission_type: 'percentage',
      commission_percentage: 3.0,
      commission_per_unit: null
    };

    const commissionSettings = salesSettings || defaultCommission;

    // 4. 실사비용 설정 조회
    const { data: surveyCosts } = await supabaseAdmin
      .from('survey_cost_settings')
      .select('*')
      .eq('is_active', true)
      .lte('effective_from', calcDate);

    const surveyCostMap = surveyCosts?.reduce((acc, item) => {
      acc[item.survey_type] = item.base_cost;
      return acc;
    }, {} as Record<string, number>) || {
      estimate: 100000,
      pre_construction: 150000,
      completion: 200000
    };

    // 5. 실사비용 조정 조회
    const { data: surveyAdjustments } = await supabaseAdmin
      .from('survey_cost_adjustments')
      .select('*')
      .eq('business_id', business_id)
      .lte('applied_date', calcDate);

    const totalAdjustments = surveyAdjustments?.reduce((sum, adj) => sum + adj.adjustment_amount, 0) || 0;

    // 6. 측정기기별 매출/매입 계산
    const equipmentFields = [
      'ph_meter', 'differential_pressure_meter', 'temperature_meter',
      'discharge_current_meter', 'fan_current_meter', 'pump_current_meter',
      'gateway', 'vpn_wired', 'vpn_wireless',
      'explosion_proof_differential_pressure_meter_domestic',
      'explosion_proof_temperature_meter_domestic', 'expansion_device',
      'relay_8ch', 'relay_16ch', 'main_board_replacement', 'multiple_stack'
    ];

    let totalRevenue = 0;
    let totalCost = 0;
    let totalInstallationCosts = 0;
    let totalEquipmentCount = 0;
    const equipmentBreakdown: EquipmentBreakdown[] = [];

    for (const field of equipmentFields) {
      const quantity = businessInfo[field] || 0;

      if (quantity > 0) {
        // 환경부 고시가 (매출) - DB에서 조회, 없으면 기본값 사용
        const officialPrice = officialPriceMap[field];

        // 기본 환경부 고시가 (fallback)
        const DEFAULT_OFFICIAL_PRICES: Record<string, number> = {
          'ph_meter': 1000000,
          'differential_pressure_meter': 400000,
          'temperature_meter': 500000,
          'discharge_current_meter': 300000,
          'fan_current_meter': 300000,
          'pump_current_meter': 300000,
          'gateway': 1600000,
          'vpn_wired': 400000,
          'vpn_wireless': 400000,
          'explosion_proof_differential_pressure_meter_domestic': 800000,
          'explosion_proof_temperature_meter_domestic': 1500000,
          'expansion_device': 800000,
          'relay_8ch': 300000,
          'relay_16ch': 1600000,
          'main_board_replacement': 350000,
          'multiple_stack': 480000
        };

        let unitRevenue = 0;
        if (officialPrice) {
          unitRevenue = officialPrice.official_price;
        } else {
          unitRevenue = DEFAULT_OFFICIAL_PRICES[field] || 0;
          console.warn(`⚠️ [REVENUE-CALCULATE] ${businessInfo.business_name} - ${field}: 환경부 고시가 없음 → 기본값 사용 (${unitRevenue.toLocaleString()}원)`);
        }

        // 제조사별 원가 (매입) - DB에서 조회, 없으면 기본값 사용
        const manufacturerCost = manufacturerCostMap[field];

        // 기본 원가 (fallback)
        const DEFAULT_COSTS: Record<string, number> = {
          'ph_meter': 250000,
          'differential_pressure_meter': 100000,
          'temperature_meter': 125000,
          'discharge_current_meter': 80000,
          'fan_current_meter': 80000,
          'pump_current_meter': 80000,
          'gateway': 200000,
          'vpn_wired': 100000,
          'vpn_wireless': 120000,
          'explosion_proof_differential_pressure_meter_domestic': 150000,
          'explosion_proof_temperature_meter_domestic': 180000,
          'expansion_device': 120000,
          'relay_8ch': 80000,
          'relay_16ch': 150000,
          'main_board_replacement': 100000,
          'multiple_stack': 120000
        };

        let unitCost = 0;
        if (manufacturerCost) {
          unitCost = manufacturerCost.cost_price;
        } else {
          unitCost = DEFAULT_COSTS[field] || 0;
          console.warn(`⚠️ [REVENUE-CALCULATE] ${businessInfo.business_name} - ${field}: ${manufacturer} 제조사 원가 없음 → 기본값 사용 (${unitCost.toLocaleString()}원)`);
        }

        // 설치비 = 기본 설치비 + 사업장 추가비(공통) + 사업장 추가비(기기별)
        const baseInstallCost = installationCostMap[field] || 0;
        const commonAdditionalCost = additionalCostMap['all'] || 0;
        const equipmentAdditionalCost = additionalCostMap[field] || 0;
        const unitInstallation = baseInstallCost + commonAdditionalCost + equipmentAdditionalCost;

        const itemRevenue = unitRevenue * quantity;
        const itemCost = unitCost * quantity;
        const itemInstallation = unitInstallation * quantity;

        totalRevenue += itemRevenue;
        totalCost += itemCost;
        totalInstallationCosts += itemInstallation;
        totalEquipmentCount += quantity;

        // 기기명 fallback
        const EQUIPMENT_NAMES: Record<string, string> = {
          'ph_meter': 'PH센서',
          'differential_pressure_meter': '차압계',
          'temperature_meter': '온도계',
          'discharge_current_meter': '배출전류계',
          'fan_current_meter': '송풍전류계',
          'pump_current_meter': '펌프전류계',
          'gateway': '게이트웨이',
          'vpn_wired': 'VPN(유선)',
          'vpn_wireless': 'VPN(무선)',
          'explosion_proof_differential_pressure_meter_domestic': '방폭차압계(국산)',
          'explosion_proof_temperature_meter_domestic': '방폭온도계(국산)',
          'expansion_device': '확장디바이스',
          'relay_8ch': '중계기(8채널)',
          'relay_16ch': '중계기(16채널)',
          'main_board_replacement': '메인보드교체',
          'multiple_stack': '복수굴뚝'
        };

        const equipmentName = officialPrice?.equipment_name || EQUIPMENT_NAMES[field] || field;

        equipmentBreakdown.push({
          equipment_type: field,
          equipment_name: equipmentName,
          quantity,
          unit_official_price: unitRevenue,
          unit_manufacturer_price: unitCost,
          unit_installation_cost: unitInstallation,
          total_revenue: itemRevenue,
          total_cost: itemCost,
          total_installation: itemInstallation,
          profit: itemRevenue - itemCost - itemInstallation
        });
      }
    }

    // 7. 영업비용 계산
    let salesCommission = 0;
    if (commissionSettings.commission_type === 'percentage') {
      salesCommission = totalRevenue * (commissionSettings.commission_percentage / 100);
    } else {
      salesCommission = totalEquipmentCount * (commissionSettings.commission_per_unit || 0);
    }

    // 8. 실사비용 계산
    const baseSurveyCosts = surveyCostMap.estimate + surveyCostMap.pre_construction + surveyCostMap.completion;
    const totalSurveyCosts = baseSurveyCosts + totalAdjustments;

    // 9. 추가공사비 및 협의사항 반영
    const additionalCost = businessInfo.additional_cost || 0; // 추가공사비 (매출에 더하기)
    const negotiationDiscount = businessInfo.negotiation ? parseFloat(businessInfo.negotiation) || 0 : 0; // 협의사항 (매출에서 빼기)

    // 최종 매출 = 기본 매출 + 추가공사비 - 협의사항
    const adjustedRevenue = totalRevenue + additionalCost - negotiationDiscount;

    console.log(`💰 [REVENUE-CALCULATE] 매출 조정: 기본 ${totalRevenue} + 추가공사비 ${additionalCost} - 협의사항 ${negotiationDiscount} = ${adjustedRevenue}`);

    // 10. 최종 계산 (조정된 매출 기준)
    const grossProfit = adjustedRevenue - totalCost;
    const netProfit = grossProfit - salesCommission - totalSurveyCosts - totalInstallationCosts;

    const result: RevenueCalculationResult = {
      business_id,
      business_name: businessInfo.business_name,
      sales_office: salesOffice,
      calculation_date: calcDate,
      total_revenue: adjustedRevenue, // 조정된 최종 매출
      total_cost: totalCost,
      gross_profit: grossProfit,
      sales_commission: salesCommission,
      survey_costs: totalSurveyCosts,
      installation_costs: totalInstallationCosts,
      net_profit: netProfit,
      equipment_breakdown: equipmentBreakdown,
      cost_breakdown: {
        sales_commission_type: commissionSettings.commission_type,
        sales_commission_rate: commissionSettings.commission_type === 'percentage'
          ? commissionSettings.commission_percentage
          : commissionSettings.commission_per_unit,
        sales_commission_amount: salesCommission,
        survey_costs: {
          estimate: surveyCostMap.estimate,
          pre_construction: surveyCostMap.pre_construction,
          completion: surveyCostMap.completion,
          adjustments: totalAdjustments,
          total: totalSurveyCosts
        },
        total_installation_costs: totalInstallationCosts
      }
    };

    // 10. 결과 저장 (옵션)
    let savedCalculation = null;
    if (save_result && permissionLevel >= 3) {
      // 가격 정보 스냅샷 생성 (계산 시점의 가격 정보 보존)
      const pricingSnapshot = {
        manufacturer,
        official_prices: officialPriceMap,
        manufacturer_costs: manufacturerCostMap,
        installation_costs: installationCostMap,
        additional_costs: additionalCostMap,
        calculation_date: calcDate
      };

      const { data: saved, error: saveError } = await supabaseAdmin
        .from('revenue_calculations')
        .insert({
          business_id,
          business_name: businessInfo.business_name,
          calculation_date: calcDate,
          total_revenue: adjustedRevenue, // 조정된 최종 매출
          total_cost: totalCost,
          gross_profit: grossProfit,
          sales_commission: salesCommission,
          survey_costs: totalSurveyCosts,
          installation_costs: totalInstallationCosts,
          net_profit: netProfit,
          equipment_breakdown: equipmentBreakdown,
          cost_breakdown: result.cost_breakdown,
          pricing_version_snapshot: pricingSnapshot,
          sales_office: salesOffice,
          business_category: businessInfo.category || null,
          calculated_by: userId
        })
        .select()
        .single();

      if (saveError) {
        console.error('❌ [REVENUE-CALCULATE] 저장 오류:', saveError);
      } else {
        savedCalculation = saved;
        console.log('💾 [REVENUE-CALCULATE] 계산 결과 저장 완료');
      }
    }

    console.log(`✅ [REVENUE-CALCULATE] 계산 완료:`, {
      business_name: businessInfo.business_name,
      total_revenue: totalRevenue,
      net_profit: netProfit
    });

    return NextResponse.json({
      success: true,
      data: {
        calculation: result,
        saved_record: savedCalculation,
        summary: {
          equipment_count: totalEquipmentCount,
          profit_margin: totalRevenue > 0 ? ((grossProfit / totalRevenue) * 100).toFixed(2) + '%' : '0%',
          net_margin: totalRevenue > 0 ? ((netProfit / totalRevenue) * 100).toFixed(2) + '%' : '0%'
        }
      },
      message: '매출 계산이 완료되었습니다.'
    });

  } catch (error) {
    console.error('❌ [REVENUE-CALCULATE] API 오류:', error);
    return NextResponse.json({
      success: false,
      message: '서버 오류가 발생했습니다.'
    }, { status: 500 });
  }
}

// 저장된 계산 결과 조회
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

    // 사용자 ID 추출
    const userId = decoded.userId || decoded.id;
    if (!userId) {
      return NextResponse.json({
        success: false,
        message: '토큰에 사용자 정보가 없습니다.'
      }, { status: 401 });
    }

    // 권한 레벨 확인 - JWT에 없으면 DB에서 조회
    let permissionLevel = decoded.permissionLevel || decoded.permission_level;

    if (!permissionLevel) {
      console.log('🔍 [REVENUE-CALCULATE-GET] JWT에 권한 정보 없음, DB에서 조회:', userId);
      const { data: user, error: userError } = await supabaseAdmin
        .from('employees')
        .select('id, permission_level')
        .eq('id', userId)
        .eq('is_active', true)
        .single();

      if (userError || !user) {
        console.error('❌ [REVENUE-CALCULATE-GET] 사용자 조회 실패:', userError);
        return NextResponse.json({
          success: false,
          message: '사용자를 찾을 수 없습니다.'
        }, { status: 401 });
      }

      permissionLevel = user.permission_level;
      console.log('✅ [REVENUE-CALCULATE-GET] DB에서 권한 조회 완료:', { userId, permissionLevel });
    }

    // 권한 2 이상 확인
    if (!permissionLevel || permissionLevel < 2) {
      return NextResponse.json({
        success: false,
        message: '매출 조회 권한이 필요합니다.'
      }, { status: 403 });
    }

    // URL 파라미터 처리
    const url = new URL(request.url);
    const businessId = url.searchParams.get('business_id');
    const salesOffice = url.searchParams.get('sales_office');
    const startDate = url.searchParams.get('start_date');
    const endDate = url.searchParams.get('end_date');
    const limit = parseInt(url.searchParams.get('limit') || '50');
    const offset = parseInt(url.searchParams.get('offset') || '0');

    // 계산 결과 조회
    let query = supabaseAdmin
      .from('revenue_calculations')
      .select('*')
      .order('calculation_date', { ascending: false })
      .range(offset, offset + limit - 1);

    if (businessId) {
      query = query.eq('business_id', businessId);
    }

    if (salesOffice) {
      query = query.eq('sales_office', salesOffice);
    }

    if (startDate) {
      query = query.gte('calculation_date', startDate);
    }

    if (endDate) {
      query = query.lte('calculation_date', endDate);
    }

    const { data: calculations, error } = await query;

    if (error) {
      console.error('❌ [REVENUE-CALCULATE] 조회 오류:', error);
      return NextResponse.json({
        success: false,
        message: '계산 결과 조회에 실패했습니다.'
      }, { status: 500 });
    }

    // 집계 정보 계산
    const totalRevenue = calculations?.reduce((sum, calc) => sum + (calc.total_revenue || 0), 0) || 0;
    const totalProfit = calculations?.reduce((sum, calc) => sum + (calc.net_profit || 0), 0) || 0;

    console.log(`📊 [REVENUE-CALCULATE] 조회 완료: ${calculations?.length || 0}건`);

    return NextResponse.json({
      success: true,
      data: {
        calculations: calculations || [],
        pagination: {
          total_count: calculations?.length || 0,
          offset,
          limit,
          has_more: (calculations?.length || 0) === limit
        },
        summary: {
          total_revenue: totalRevenue,
          total_profit: totalProfit,
          average_profit_margin: totalRevenue > 0 ? ((totalProfit / totalRevenue) * 100).toFixed(2) + '%' : '0%'
        }
      }
    });

  } catch (error) {
    console.error('❌ [REVENUE-CALCULATE] API 오류:', error);
    return NextResponse.json({
      success: false,
      message: '서버 오류가 발생했습니다.'
    }, { status: 500 });
  }
}