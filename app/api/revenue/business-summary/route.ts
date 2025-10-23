// app/api/revenue/business-summary/route.ts - 사업장별 매출 통합 관리 API
import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { verifyTokenString } from '@/utils/auth';

// Force dynamic rendering for API routes
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// 사업장별 매출 요약 정보 인터페이스
interface BusinessRevenueSummary {
  business_id: string;
  business_name: string;
  sales_office: string;
  address: string;
  manager_name: string;
  manager_contact: string;

  // 업무 카테고리별 분류
  task_categories: {
    self_tasks: number;      // 자비 업무 수
    subsidy_tasks: number;   // 보조금 업무 수
    total_tasks: number;     // 전체 업무 수
  };

  // 측정기기 정보
  equipment_summary: {
    total_equipment_count: number;
    equipment_breakdown: {
      ph_meter: number;
      differential_pressure_meter: number;
      temperature_meter: number;
      discharge_current_meter: number;
      fan_current_meter: number;
      pump_current_meter: number;
      gateway: number;
      vpn_wired: number;
      vpn_wireless: number;
      explosion_proof_differential_pressure_meter_domestic: number;
      explosion_proof_temperature_meter_domestic: number;
      expansion_device: number;
      relay_8ch: number;
      relay_16ch: number;
      main_board_replacement: number;
      multiple_stack: number;
    };
  };

  // 매출 계산 결과 (캐시됨)
  revenue_calculation?: {
    calculation_date: string;
    total_revenue: number;
    total_cost: number;
    gross_profit: number;
    sales_commission: number;
    survey_costs: number;
    installation_costs: number;
    net_profit: number;
    profit_margin_percentage: number;
    calculation_status: 'success' | 'error' | 'pending';
    last_calculated: string;
  };

  // 계산 오류 정보
  calculation_error?: string;
}

interface BusinessSummaryResponse {
  success: boolean;
  data: {
    businesses: BusinessRevenueSummary[];
    summary_stats: {
      total_businesses: number;
      businesses_with_revenue_data: number;
      total_tasks: number;
      total_equipment: number;
      aggregate_revenue: number;
      aggregate_profit: number;
    };
    calculation_status: {
      successful_calculations: number;
      failed_calculations: number;
      pending_calculations: number;
    };
  };
  message: string;
}

// 매출 계산 캐시 관리 클래스
class RevenueCalculationCache {
  private static cache = new Map<string, any>();
  private static cacheExpiry = new Map<string, number>();
  private static readonly CACHE_DURATION = 30 * 60 * 1000; // 30분

  static get(businessId: string): any | null {
    const expiry = this.cacheExpiry.get(businessId);
    if (expiry && Date.now() > expiry) {
      this.cache.delete(businessId);
      this.cacheExpiry.delete(businessId);
      return null;
    }
    return this.cache.get(businessId) || null;
  }

  static set(businessId: string, data: any): void {
    this.cache.set(businessId, data);
    this.cacheExpiry.set(businessId, Date.now() + this.CACHE_DURATION);
  }

  static clear(): void {
    this.cache.clear();
    this.cacheExpiry.clear();
  }

  static getStats(): { size: number; hitRate: number } {
    return {
      size: this.cache.size,
      hitRate: 0 // 단순화를 위해 0으로 설정
    };
  }
}

// GET: 사업장별 매출 통합 요약 조회
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
      console.log('🔍 [BUSINESS-SUMMARY] JWT에 권한 정보 없음, DB에서 조회:', userId);
      const { data: user, error: userError } = await supabaseAdmin
        .from('employees')
        .select('id, permission_level')
        .eq('id', userId)
        .eq('is_active', true)
        .single();

      if (userError || !user) {
        console.error('❌ [BUSINESS-SUMMARY] 사용자 조회 실패:', userError);
        return NextResponse.json({
          success: false,
          message: '사용자를 찾을 수 없습니다.'
        }, { status: 401 });
      }

      permissionLevel = user.permission_level;
      console.log('✅ [BUSINESS-SUMMARY] DB에서 권한 조회 완료:', { userId, permissionLevel });
    }

    // 권한 2 이상 확인 (매출 조회)
    if (!permissionLevel || permissionLevel < 2) {
      return NextResponse.json({
        success: false,
        message: '매출 조회 권한이 필요합니다.'
      }, { status: 403 });
    }

    // URL 파라미터 처리
    const url = new URL(request.url);
    const salesOffice = url.searchParams.get('sales_office');
    const includeRevenue = url.searchParams.get('include_revenue') !== 'false';
    const forceRefresh = url.searchParams.get('force_refresh') === 'true';
    const limit = parseInt(url.searchParams.get('limit') || '100');
    const offset = parseInt(url.searchParams.get('offset') || '0');

    console.log('📊 [BUSINESS-SUMMARY] 사업장별 매출 통합 조회 시작:', {
      salesOffice,
      includeRevenue,
      forceRefresh,
      limit,
      offset
    });

    // 강제 새로고침 시 캐시 클리어
    if (forceRefresh) {
      RevenueCalculationCache.clear();
      console.log('🔄 [BUSINESS-SUMMARY] 캐시 강제 새로고침');
    }

    // 1. 사업장 기본 정보 조회 (기존 business-list API 로직 재사용)
    let businessQuery = supabaseAdmin
      .from('business_info')
      .select(`
        id,
        business_name,
        sales_office,
        address,
        manager_name,
        manager_contact,
        ph_meter,
        differential_pressure_meter,
        temperature_meter,
        discharge_current_meter,
        fan_current_meter,
        pump_current_meter,
        gateway,
        vpn_wired,
        vpn_wireless,
        explosion_proof_differential_pressure_meter_domestic,
        explosion_proof_temperature_meter_domestic,
        expansion_device,
        relay_8ch,
        relay_16ch,
        main_board_replacement,
        multiple_stack,
        air_permit_info!inner(
          id,
          is_active
        )
      `)
      .eq('is_active', true)
      .eq('is_deleted', false)
      .eq('air_permit_info.is_active', true)
      .not('business_name', 'is', null)
      .order('business_name')
      .range(offset, offset + limit - 1);

    if (salesOffice) {
      businessQuery = businessQuery.eq('sales_office', salesOffice);
    }

    const { data: businesses, error: businessError } = await businessQuery;

    if (businessError) {
      console.error('❌ [BUSINESS-SUMMARY] 사업장 조회 오류:', businessError);
      throw businessError;
    }

    if (!businesses || businesses.length === 0) {
      return NextResponse.json({
        success: true,
        data: {
          businesses: [],
          summary_stats: {
            total_businesses: 0,
            businesses_with_revenue_data: 0,
            total_tasks: 0,
            total_equipment: 0,
            aggregate_revenue: 0,
            aggregate_profit: 0
          },
          calculation_status: {
            successful_calculations: 0,
            failed_calculations: 0,
            pending_calculations: 0
          }
        },
        message: '조건에 맞는 사업장이 없습니다.'
      });
    }

    console.log(`📋 [BUSINESS-SUMMARY] ${businesses.length}개 사업장 조회 완료`);

    // 2. 시설 업무 카테고리별 집계 (기존 facility-tasks API 로직 재사용)
    const businessNames = businesses.map(b => b.business_name);

    const { data: facilityTasks, error: tasksError } = await supabaseAdmin
      .from('facility_tasks')
      .select('business_name, task_type')
      .in('business_name', businessNames)
      .eq('is_active', true)
      .eq('is_deleted', false);

    if (tasksError) {
      console.warn('⚠️ [BUSINESS-SUMMARY] 시설 업무 조회 오류:', tasksError);
    }

    // 업무별 집계 맵 생성
    const taskCategoryMap = new Map<string, { self: number; subsidy: number; total: number }>();

    (facilityTasks || []).forEach(task => {
      const current = taskCategoryMap.get(task.business_name) || { self: 0, subsidy: 0, total: 0 };
      current.total++;
      if (task.task_type === 'self') current.self++;
      if (task.task_type === 'subsidy') current.subsidy++;
      taskCategoryMap.set(task.business_name, current);
    });

    // 3. 사업장별 매출 계산 (배치 처리로 최적화)
    const businessSummaries: BusinessRevenueSummary[] = [];
    let successfulCalculations = 0;
    let failedCalculations = 0;

    for (const business of businesses) {
      // 측정기기 수량 집계
      const equipmentFields = [
        'ph_meter', 'differential_pressure_meter', 'temperature_meter',
        'discharge_current_meter', 'fan_current_meter', 'pump_current_meter',
        'gateway', 'vpn_wired', 'vpn_wireless',
        'explosion_proof_differential_pressure_meter_domestic',
        'explosion_proof_temperature_meter_domestic', 'expansion_device',
        'relay_8ch', 'relay_16ch', 'main_board_replacement', 'multiple_stack'
      ];

      const equipmentBreakdown: any = {};
      let totalEquipmentCount = 0;

      equipmentFields.forEach(field => {
        const count = business[field] || 0;
        equipmentBreakdown[field] = count;
        totalEquipmentCount += count;
      });

      // 업무 카테고리 정보
      const taskStats = taskCategoryMap.get(business.business_name) || { self: 0, subsidy: 0, total: 0 };

      const summary: BusinessRevenueSummary = {
        business_id: business.id,
        business_name: business.business_name,
        sales_office: business.sales_office || '기본',
        address: business.address || '',
        manager_name: business.manager_name || '',
        manager_contact: business.manager_contact || '',
        task_categories: {
          self_tasks: taskStats.self,
          subsidy_tasks: taskStats.subsidy,
          total_tasks: taskStats.total
        },
        equipment_summary: {
          total_equipment_count: totalEquipmentCount,
          equipment_breakdown: equipmentBreakdown
        }
      };

      // 4. 매출 계산 (기존 revenue/calculate API 로직 재사용, 캐시 적용)
      if (includeRevenue && totalEquipmentCount > 0) {
        try {
          // 캐시 확인
          let revenueData = RevenueCalculationCache.get(business.id);

          if (!revenueData) {
            console.log(`🧮 [BUSINESS-SUMMARY] ${business.business_name} 매출 계산 시작`);

            // 기존 revenue/calculate API 로직을 재사용하여 매출 계산
            revenueData = await calculateBusinessRevenue(business.id);

            // 성공 시 캐시에 저장
            if (revenueData && revenueData.success) {
              RevenueCalculationCache.set(business.id, revenueData);
            }
          } else {
            console.log(`💾 [BUSINESS-SUMMARY] ${business.business_name} 캐시된 매출 데이터 사용`);
          }

          if (revenueData && revenueData.success) {
            const calc = revenueData.data.calculation;
            summary.revenue_calculation = {
              calculation_date: calc.calculation_date,
              total_revenue: calc.total_revenue,
              total_cost: calc.total_cost,
              gross_profit: calc.gross_profit,
              sales_commission: calc.sales_commission,
              survey_costs: calc.survey_costs,
              installation_costs: calc.installation_costs,
              net_profit: calc.net_profit,
              profit_margin_percentage: calc.total_revenue > 0
                ? parseFloat(((calc.net_profit / calc.total_revenue) * 100).toFixed(2))
                : 0,
              calculation_status: 'success',
              last_calculated: new Date().toISOString()
            };
            successfulCalculations++;
          } else {
            summary.calculation_error = revenueData?.message || '매출 계산 실패';
            failedCalculations++;
          }

        } catch (revenueError: any) {
          console.error(`❌ [BUSINESS-SUMMARY] ${business.business_name} 매출 계산 오류:`, revenueError?.message);
          summary.calculation_error = revenueError?.message || '매출 계산 중 오류 발생';
          failedCalculations++;
        }
      }

      businessSummaries.push(summary);
    }

    // 5. 집계 통계 계산
    const totalTasks = businessSummaries.reduce((sum, b) => sum + b.task_categories.total_tasks, 0);
    const totalEquipment = businessSummaries.reduce((sum, b) => sum + b.equipment_summary.total_equipment_count, 0);
    const businessesWithRevenue = businessSummaries.filter(b => b.revenue_calculation).length;
    const aggregateRevenue = businessSummaries.reduce((sum, b) =>
      sum + (b.revenue_calculation?.total_revenue || 0), 0);
    const aggregateProfit = businessSummaries.reduce((sum, b) =>
      sum + (b.revenue_calculation?.net_profit || 0), 0);

    const response: BusinessSummaryResponse = {
      success: true,
      data: {
        businesses: businessSummaries,
        summary_stats: {
          total_businesses: businessSummaries.length,
          businesses_with_revenue_data: businessesWithRevenue,
          total_tasks: totalTasks,
          total_equipment: totalEquipment,
          aggregate_revenue: aggregateRevenue,
          aggregate_profit: aggregateProfit
        },
        calculation_status: {
          successful_calculations: successfulCalculations,
          failed_calculations: failedCalculations,
          pending_calculations: 0
        }
      },
      message: '사업장별 매출 통합 조회가 완료되었습니다.'
    };

    console.log('✅ [BUSINESS-SUMMARY] 통합 조회 완료:', {
      businesses: businessSummaries.length,
      withRevenue: businessesWithRevenue,
      totalRevenue: aggregateRevenue,
      cacheStats: RevenueCalculationCache.getStats()
    });

    return NextResponse.json(response);

  } catch (error: any) {
    console.error('❌ [BUSINESS-SUMMARY] API 오류:', error);
    return NextResponse.json({
      success: false,
      message: '사업장별 매출 통합 조회 중 오류가 발생했습니다.',
      error: error?.message
    }, { status: 500 });
  }
}

// 개별 사업장 매출 계산 함수 (기존 revenue/calculate API 로직 재사용)
async function calculateBusinessRevenue(businessId: string): Promise<any> {
  try {
    const calcDate = new Date().toISOString().split('T')[0];

    // 1. 사업장 정보 조회
    const { data: businessInfo, error: businessError } = await supabaseAdmin
      .from('business_info')
      .select('*')
      .eq('id', businessId)
      .single();

    if (businessError || !businessInfo) {
      return {
        success: false,
        message: '사업장 정보를 찾을 수 없습니다.'
      };
    }

    // 2. 환경부 고시가 정보 조회
    const { data: pricingData, error: pricingError } = await supabaseAdmin
      .from('government_pricing')
      .select('*')
      .eq('is_active', true)
      .lte('effective_from', calcDate);

    if (pricingError) {
      return {
        success: false,
        message: '가격 정보 조회에 실패했습니다.'
      };
    }

    // 가격 정보를 맵으로 변환
    const priceMap = pricingData?.reduce((acc, item) => {
      acc[item.equipment_type] = item;
      return acc;
    }, {} as Record<string, any>) || {};

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
      .eq('business_id', businessId)
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

    for (const field of equipmentFields) {
      const quantity = businessInfo[field] || 0;
      const priceInfo = priceMap[field];

      if (quantity > 0 && priceInfo) {
        const unitRevenue = priceInfo.official_price;
        const unitCost = priceInfo.manufacturer_price;
        const unitInstallation = priceInfo.installation_cost;

        totalRevenue += unitRevenue * quantity;
        totalCost += unitCost * quantity;
        totalInstallationCosts += unitInstallation * quantity;
        totalEquipmentCount += quantity;
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
    const additionalCost = businessInfo.additional_cost || 0;
    const negotiationDiscount = businessInfo.negotiation ? parseFloat(businessInfo.negotiation) || 0 : 0;
    const adjustedRevenue = totalRevenue + additionalCost - negotiationDiscount;

    // 10. 최종 계산 (조정된 매출 기준)
    const grossProfit = adjustedRevenue - totalCost;
    const netProfit = grossProfit - salesCommission - totalSurveyCosts - totalInstallationCosts;

    return {
      success: true,
      data: {
        calculation: {
          business_id: businessId,
          business_name: businessInfo.business_name,
          sales_office: salesOffice,
          calculation_date: calcDate,
          total_revenue: adjustedRevenue,
          total_cost: totalCost,
          gross_profit: grossProfit,
          sales_commission: salesCommission,
          survey_costs: totalSurveyCosts,
          installation_costs: totalInstallationCosts,
          net_profit: netProfit,
          additional_cost: additionalCost,
          negotiation: negotiationDiscount
        }
      }
    };

  } catch (error) {
    console.error('❌ [BUSINESS-REVENUE-CALC] 매출 계산 오류:', error);
    return {
      success: false,
      message: '매출 계산 중 오류가 발생했습니다.'
    };
  }
}

// POST: 특정 사업장 매출 재계산 요청
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

    // 권한 3 이상 확인 (매출 재계산)
    const permissionLevel = decoded.permissionLevel || decoded.permission_level;
    if (!permissionLevel || permissionLevel < 3) {
      return NextResponse.json({
        success: false,
        message: '매출 재계산 권한이 필요합니다.'
      }, { status: 403 });
    }

    const body = await request.json();
    const { business_id, force_refresh = true } = body;

    if (!business_id) {
      return NextResponse.json({
        success: false,
        message: 'business_id가 필요합니다.'
      }, { status: 400 });
    }

    console.log('🔄 [BUSINESS-SUMMARY] 특정 사업장 매출 재계산:', business_id);

    // 캐시에서 해당 사업장 데이터 삭제
    RevenueCalculationCache.cache.delete(business_id);
    RevenueCalculationCache.cacheExpiry.delete(business_id);

    // 매출 재계산
    const revenueData = await calculateBusinessRevenue(business_id);

    if (revenueData.success) {
      // 성공 시 캐시에 저장
      RevenueCalculationCache.set(business_id, revenueData);

      return NextResponse.json({
        success: true,
        data: revenueData.data,
        message: '매출 재계산이 완료되었습니다.'
      });
    } else {
      return NextResponse.json({
        success: false,
        message: revenueData.message
      }, { status: 400 });
    }

  } catch (error: any) {
    console.error('❌ [BUSINESS-SUMMARY] POST 오류:', error);
    return NextResponse.json({
      success: false,
      message: '매출 재계산 중 오류가 발생했습니다.',
      error: error?.message
    }, { status: 500 });
  }
}