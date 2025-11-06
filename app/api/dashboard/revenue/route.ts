import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import {
  determineAggregationLevel,
  getAggregationKey,
  generateAggregationKeys,
  type AggregationLevel
} from '@/lib/dashboard-utils'

interface RevenueQueryParams {
  months?: string;
  office?: string;
  manufacturer?: string;
  salesOffice?: string;
}

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;

    // 기간 파라미터 (3가지 모드)
    const months = searchParams.get('months') ? parseInt(searchParams.get('months')!) : null;
    const startDate = searchParams.get('startDate'); // YYYY-MM-DD 또는 YYYY-MM 형식
    const endDate = searchParams.get('endDate');     // YYYY-MM-DD 또는 YYYY-MM 형식
    const year = searchParams.get('year') ? parseInt(searchParams.get('year')!) : null;

    // 필터 파라미터
    const office = searchParams.get('office'); // 지역 필터 (주소에서 추출)
    const manufacturer = searchParams.get('manufacturer');
    const salesOffice = searchParams.get('salesOffice');
    const progressStatus = searchParams.get('progressStatus'); // 진행구분 필터

    console.log('📊 [Dashboard Revenue API] Request params:', { months, startDate, endDate, year, office, manufacturer, salesOffice, progressStatus });

    const supabase = supabaseAdmin;
    const calcDate = new Date().toISOString().split('T')[0];

    // 1. 사업장 조회 (설치 완료된 사업장만)
    let businessQuery = supabase
      .from('business_info')
      .select('*', { count: 'exact' })
      .eq('is_active', true)
      .eq('is_deleted', false)
      .not('installation_date', 'is', null)
      .limit(10000); // 최대 10,000개까지 조회

    // 날짜 범위 필터 (기간 지정 모드에서만 적용)
    if (startDate && endDate) {
      businessQuery = businessQuery
        .gte('installation_date', startDate)
        .lte('installation_date', endDate);
    }

    // 필터 적용
    if (manufacturer) businessQuery = businessQuery.eq('manufacturer', manufacturer);
    if (salesOffice) businessQuery = businessQuery.eq('sales_office', salesOffice);
    if (progressStatus) businessQuery = businessQuery.eq('progress_status', progressStatus);

    const { data: businesses, error: businessError } = await businessQuery;

    if (businessError) {
      console.error('❌ [Dashboard Revenue API] Business query error:', businessError);
      throw businessError;
    }

    console.log('📊 [Dashboard Revenue API] Total businesses (before region filter):', businesses?.length || 0);

    // 지역 필터링 (주소에서 지역 추출 - 사업장 관리와 동일)
    let filteredBusinesses = businesses || [];
    if (office) {
      filteredBusinesses = filteredBusinesses.filter(business => {
        const address = business.address || '';
        if (!address) return false;

        // 주소에서 지역 추출 (예: "서울시", "경기도 수원시" -> "경기도")
        const regionMatch = address.match(/^(.*?시|.*?도|.*?군)/);
        const region = regionMatch ? regionMatch[1] : '';
        return region === office;
      });
    }

    console.log('📊 [Dashboard Revenue API] Total businesses (after filters):', filteredBusinesses.length);

    // 2. 환경부 고시가 정보 조회
    const { data: pricingData, error: pricingError } = await supabase
      .from('government_pricing')
      .select('*')
      .eq('is_active', true)
      .lte('effective_from', calcDate);

    if (pricingError) {
      console.error('❌ [Dashboard Revenue API] Pricing query error:', pricingError);
      throw pricingError;
    }

    const priceMap = pricingData?.reduce((acc, item) => {
      acc[item.equipment_type] = item;
      return acc;
    }, {} as Record<string, any>) || {};

    // 2-1. 제조사별 원가 정보 조회
    const { data: manufacturerPricingData, error: manuPricingError } = await supabase
      .from('manufacturer_pricing')
      .select('*')
      .eq('is_active', true)
      .lte('effective_from', calcDate)
      .or(`effective_to.is.null,effective_to.gte.${calcDate}`);

    if (manuPricingError) {
      console.error('❌ [Dashboard Revenue API] Manufacturer pricing query error:', manuPricingError);
    }

    // 제조사별 원가 맵 생성 (제조사별로 구분)
    const manufacturerCostMap: Record<string, Record<string, number>> = {};
    manufacturerPricingData?.forEach(item => {
      if (!manufacturerCostMap[item.manufacturer]) {
        manufacturerCostMap[item.manufacturer] = {};
      }
      manufacturerCostMap[item.manufacturer][item.equipment_type] = item.cost_price;
    });

    console.log('📊 [Dashboard Revenue API] Manufacturer pricing loaded:', Object.keys(manufacturerCostMap).length, 'manufacturers');

    // 2-2. 기본 설치비 정보 조회 (매출 관리와 동일한 테이블 사용)
    const { data: installationCostData, error: installCostError } = await supabase
      .from('equipment_installation_cost')
      .select('*')
      .eq('is_active', true)
      .lte('effective_from', calcDate)
      .or(`effective_to.is.null,effective_to.gte.${calcDate}`);

    if (installCostError) {
      console.error('❌ [Dashboard Revenue API] Installation cost query error:', installCostError);
    }

    // 기본 설치비 맵 생성
    const installationCostMap: Record<string, number> = {};
    installationCostData?.forEach(item => {
      installationCostMap[item.equipment_type] = item.base_installation_cost;
    });

    console.log('📊 [Dashboard Revenue API] Installation costs loaded:', Object.keys(installationCostMap).length, 'equipment types');

    // 2-3. 실사비용 조정 일괄 조회 (N+1 쿼리 문제 해결)
    const businessIds = filteredBusinesses.map(b => b.id).filter(Boolean) || [];
    const surveyAdjustmentsMap: Record<string, number> = {};

    if (businessIds.length > 0) {
      const { data: allSurveyAdjustments, error: surveyAdjError } = await supabase
        .from('survey_cost_adjustments')
        .select('*')
        .in('business_id', businessIds)
        .lte('applied_date', calcDate);

      if (surveyAdjError) {
        console.error('❌ [Dashboard Revenue API] Survey adjustments query error:', surveyAdjError);
      }

      // 사업장별 실사비용 조정 맵 생성
      allSurveyAdjustments?.forEach(adj => {
        if (!surveyAdjustmentsMap[adj.business_id]) {
          surveyAdjustmentsMap[adj.business_id] = 0;
        }
        surveyAdjustmentsMap[adj.business_id] += adj.adjustment_amount;
      });

      console.log('📊 [Dashboard Revenue API] Survey adjustments loaded for', Object.keys(surveyAdjustmentsMap).length, 'businesses');
    }

    // 3. 집계 단위 결정 및 데이터 맵 초기화
    let aggregationLevel: AggregationLevel = 'monthly'; // 기본값
    const aggregationData: Map<string, any> = new Map();

    if (year) {
      // 연도별 모드: 월별 집계 (기존 로직 유지)
      aggregationLevel = 'monthly';
      for (let month = 1; month <= 12; month++) {
        const monthKey = `${year}-${String(month).padStart(2, '0')}`;
        aggregationData.set(monthKey, {
          month: monthKey,
          revenue: 0,
          cost: 0,
          profit: 0,
          profitRate: 0,
          prevMonthChange: 0,
          count: 0
        });
      }
    } else if (startDate && endDate) {
      // 기간 지정 모드: 집계 단위 자동 결정
      aggregationLevel = determineAggregationLevel(startDate, endDate);
      console.log('📊 [Dashboard Revenue API] Aggregation level:', aggregationLevel);

      // 집계 키 생성
      const keys = generateAggregationKeys(startDate, endDate, aggregationLevel);
      keys.forEach(key => {
        aggregationData.set(key, {
          month: key, // 호환성을 위해 'month' 키 유지
          revenue: 0,
          cost: 0,
          profit: 0,
          profitRate: 0,
          prevMonthChange: 0,
          count: 0
        });
      });
    } else {
      // 최근 N개월 모드: 월별 집계 (기존 로직 유지)
      aggregationLevel = 'monthly';
      const monthsToShow = months || 12;
      for (let i = 0; i < monthsToShow; i++) {
        const date = new Date();
        date.setMonth(date.getMonth() - i);
        const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
        aggregationData.set(monthKey, {
          month: monthKey,
          revenue: 0,
          cost: 0,
          profit: 0,
          profitRate: 0,
          prevMonthChange: 0,
          count: 0
        });
      }
    }

    // 4. 영업점 비용 설정 및 실사비용 설정 조회
    const { data: salesSettings } = await supabase
      .from('sales_office_cost_settings')
      .select('*')
      .eq('is_active', true)
      .lte('effective_from', calcDate)
      .order('effective_from', { ascending: false });

    const salesSettingsMap = new Map(
      salesSettings?.map(s => [s.sales_office, s]) || []
    );

    const defaultCommission = {
      commission_type: 'percentage',
      commission_percentage: 10.0,
      commission_per_unit: null
    };

    const { data: surveyCosts } = await supabase
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

    // 5. 측정기기 필드 정의
    const equipmentFields = [
      'ph_meter', 'differential_pressure_meter', 'temperature_meter',
      'discharge_current_meter', 'fan_current_meter', 'pump_current_meter',
      'gateway', 'vpn_wired', 'vpn_wireless',
      'explosion_proof_differential_pressure_meter_domestic',
      'explosion_proof_temperature_meter_domestic', 'expansion_device',
      'relay_8ch', 'relay_16ch', 'main_board_replacement', 'multiple_stack'
    ];

    // 6. 사업장별 실시간 매출 계산 및 집계
    for (const business of filteredBusinesses) {
      if (!business.installation_date) continue;

      const installDate = new Date(business.installation_date);
      const aggregationKey = getAggregationKey(installDate, aggregationLevel);

      if (!aggregationData.has(aggregationKey)) continue;

      // 사업장의 제조사 정보 (기본값: ecosense)
      const businessManufacturer = business.manufacturer || 'ecosense';
      const manufacturerCosts = manufacturerCostMap[businessManufacturer] || {};

      // 매출/제조사 매입 계산
      let businessRevenue = 0;
      let manufacturerCost = 0;
      let totalInstallationCosts = 0;
      let totalEquipmentCount = 0;

      equipmentFields.forEach(field => {
        const quantity = business[field] || 0;
        const priceInfo = priceMap[field];

        if (quantity > 0 && priceInfo) {
          // 매출 = 환경부 고시가 × 수량
          businessRevenue += priceInfo.official_price * quantity;

          // 매입 = 제조사별 원가 × 수량 (manufacturer_pricing 테이블)
          const costPrice = manufacturerCosts[field] || 0;
          manufacturerCost += costPrice * quantity;

          // 기본 설치비 (equipment_installation_cost 테이블 - 매출 관리와 동일)
          const installCost = installationCostMap[field] || 0;
          totalInstallationCosts += installCost * quantity;
          totalEquipmentCount += quantity;
        }
      });

      // 추가공사비 및 협의사항 반영
      const additionalCost = business.additional_cost || 0;
      const negotiationDiscount = business.negotiation ? parseFloat(business.negotiation) || 0 : 0;
      businessRevenue += additionalCost - negotiationDiscount;

      // 영업비용 계산
      const salesOffice = business.sales_office || '기본';
      const commissionSettings = salesSettingsMap.get(salesOffice) || defaultCommission;

      let salesCommission = 0;
      if (commissionSettings.commission_type === 'percentage') {
        salesCommission = businessRevenue * (commissionSettings.commission_percentage / 100);
      } else {
        salesCommission = totalEquipmentCount * (commissionSettings.commission_per_unit || 0);
      }

      // 실사비용 계산 (매출 관리와 동일: 실사일이 있는 경우에만 비용 추가)
      let totalSurveyCosts = 0;

      // 견적실사 비용 (견적실사일이 있고 빈 문자열이 아닌 경우에만)
      if (business.estimate_survey_date && business.estimate_survey_date.trim() !== '') {
        totalSurveyCosts += surveyCostMap.estimate || 0;
      }

      // 착공전실사 비용 (착공전실사일이 있고 빈 문자열이 아닌 경우에만)
      if (business.pre_construction_survey_date && business.pre_construction_survey_date.trim() !== '') {
        totalSurveyCosts += surveyCostMap.pre_construction || 0;
      }

      // 준공실사 비용 (준공실사일이 있고 빈 문자열이 아닌 경우에만)
      if (business.completion_survey_date && business.completion_survey_date.trim() !== '') {
        totalSurveyCosts += surveyCostMap.completion || 0;
      }

      // 실사비용 조정 (미리 로드된 맵에서 가져오기 - N+1 쿼리 해결)
      const totalAdjustments = surveyAdjustmentsMap[business.id] || 0;
      totalSurveyCosts += totalAdjustments;

      // 추가설치비 (설치팀 요청 추가 비용)
      const installationExtraCost = business.installation_extra_cost || 0;

      // 매출 관리와 동일한 계산 방식
      // total_cost = 제조사 매입만 (매입금액)
      const totalCost = manufacturerCost;

      // 총이익 = 매출 - 제조사 매입
      const grossProfit = businessRevenue - totalCost;

      // 순이익 = 총이익 - 영업비용 - 실사비용 - 기본설치비 - 추가설치비
      const netProfit = grossProfit - salesCommission - totalSurveyCosts - totalInstallationCosts - installationExtraCost;

      // 월별 데이터 업데이트
      const current = aggregationData.get(aggregationKey);
      current.revenue += businessRevenue;
      current.cost += totalCost;  // 매입금액 (제조사 매입만)
      current.profit += netProfit;  // 순이익 (모든 비용 차감 후)
      current.count += 1;
    }

    // 6. 이익률 계산 및 전월 대비 증감 계산
    const sortedMonths = Array.from(aggregationData.keys()).sort();
    let prevProfit = 0;

    sortedMonths.forEach((monthKey, index) => {
      const data = aggregationData.get(monthKey);

      // 이익률 계산
      if (data.revenue > 0) {
        data.profitRate = (data.profit / data.revenue) * 100;
      }

      // 전월 대비 증감률 (첫 달은 제외)
      if (index > 0 && prevProfit !== 0) {
        data.prevMonthChange = ((data.profit - prevProfit) / Math.abs(prevProfit)) * 100;
      }

      prevProfit = data.profit;
    });

    // 7. 목표값 조회
    const { data: targets, error: targetError } = await supabase
      .from('dashboard_targets')
      .select('*')
      .eq('target_type', 'revenue')
      .in('month', sortedMonths);

    if (targetError) {
      console.warn('⚠️ [Dashboard Revenue API] Target query warning:', targetError);
    }

    const targetMap = new Map(targets?.map(t => [t.month, t.target_value]) || []);

    // 8. 목표 달성률 계산
    sortedMonths.forEach(monthKey => {
      const data = aggregationData.get(monthKey);
      const target = targetMap.get(monthKey);
      if (target && target > 0) {
        data.target = target;
        data.achievementRate = (data.profit / target) * 100;
      }
    });

    // 9. 평균값 계산 및 최종 데이터 배열 생성
    // 연도별/기간지정 모드는 오래된 것부터, 최근 모드는 최신부터
    const dataArray = (year || (startDate && endDate))
      ? Array.from(aggregationData.values()) // 연도별/기간지정: 순방향 (1월→12월)
      : Array.from(aggregationData.values()).reverse(); // 최근 모드: 역방향 (최신→과거)
    const totalProfit = dataArray.reduce((sum, d) => sum + d.profit, 0);
    const totalRevenue = dataArray.reduce((sum, d) => sum + d.revenue, 0);
    const validProfitRates = dataArray.filter(d => d.profitRate > 0);

    const monthCount = dataArray.length; // 실제 월 개수 사용
    const avgProfit = monthCount > 0 ? totalProfit / monthCount : 0;
    const avgProfitRate = validProfitRates.length > 0
      ? validProfitRates.reduce((sum, d) => sum + d.profitRate, 0) / validProfitRates.length
      : 0;

    console.log('📊 [Dashboard Revenue API] Summary:', {
      businesses: filteredBusinesses.length,
      avgProfit: Math.round(avgProfit),
      avgProfitRate: Math.round(avgProfitRate * 100) / 100,
      totalRevenue,
      totalProfit
    });

    return NextResponse.json({
      success: true,
      data: dataArray,
      summary: {
        avgProfit: Math.round(avgProfit),
        avgProfitRate: Math.round(avgProfitRate * 100) / 100,
        totalRevenue,
        totalProfit
      }
    });

  } catch (error: any) {
    console.error('❌ [Dashboard Revenue API Error]', error);
    return NextResponse.json(
      {
        success: false,
        error: error.message,
        data: [],
        summary: {
          avgProfit: 0,
          avgProfitRate: 0,
          totalRevenue: 0,
          totalProfit: 0
        }
      },
      { status: 500 }
    );
  }
}
