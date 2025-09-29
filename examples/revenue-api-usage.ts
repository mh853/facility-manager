// examples/revenue-api-usage.ts - 새로운 매출 통합 API 사용 예제

import { BusinessRevenueSummary, BusinessSummaryResponse } from '@/types';

// API 클라이언트 설정
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';

interface ApiOptions {
  token: string;
  salesOffice?: string;
  includeRevenue?: boolean;
  forceRefresh?: boolean;
  limit?: number;
  offset?: number;
}

/**
 * 사업장별 매출 통합 조회 API 클라이언트
 */
export class RevenueBusinessSummaryClient {

  /**
   * 모든 사업장의 매출 통합 정보 조회
   */
  static async getBusinessSummary(options: ApiOptions): Promise<BusinessSummaryResponse> {
    const params = new URLSearchParams();

    if (options.salesOffice) params.append('sales_office', options.salesOffice);
    if (options.includeRevenue !== undefined) params.append('include_revenue', String(options.includeRevenue));
    if (options.forceRefresh) params.append('force_refresh', 'true');
    if (options.limit) params.append('limit', String(options.limit));
    if (options.offset) params.append('offset', String(options.offset));

    const response = await fetch(
      `${API_BASE_URL}/api/revenue/business-summary?${params.toString()}`,
      {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${options.token}`,
          'Content-Type': 'application/json'
        }
      }
    );

    if (!response.ok) {
      throw new Error(`API Error: ${response.status} ${response.statusText}`);
    }

    return response.json();
  }

  /**
   * 특정 사업장 매출 재계산
   */
  static async recalculateBusinessRevenue(businessId: string, token: string): Promise<any> {
    const response = await fetch(
      `${API_BASE_URL}/api/revenue/business-summary`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          business_id: businessId,
          force_refresh: true
        })
      }
    );

    if (!response.ok) {
      throw new Error(`API Error: ${response.status} ${response.statusText}`);
    }

    return response.json();
  }
}

/**
 * 사용 예제 1: 전체 사업장 매출 조회
 */
export async function example1_getAllBusinessSummary() {
  try {
    const token = 'your-jwt-token-here';

    console.log('📊 전체 사업장 매출 통합 조회 시작...');

    const result = await RevenueBusinessSummaryClient.getBusinessSummary({
      token,
      includeRevenue: true,
      limit: 50
    });

    if (result.success) {
      console.log('✅ 조회 성공:');
      console.log(`  - 총 사업장: ${result.data.summary_stats.total_businesses}개`);
      console.log(`  - 매출 데이터 있는 사업장: ${result.data.summary_stats.businesses_with_revenue_data}개`);
      console.log(`  - 총 업무: ${result.data.summary_stats.total_tasks}개`);
      console.log(`  - 총 측정기기: ${result.data.summary_stats.total_equipment}개`);
      console.log(`  - 총 매출: ${result.data.summary_stats.aggregate_revenue.toLocaleString()}원`);
      console.log(`  - 총 순이익: ${result.data.summary_stats.aggregate_profit.toLocaleString()}원`);

      // 상위 5개 사업장 출력
      const topBusinesses = result.data.businesses
        .filter(b => b.revenue_calculation)
        .sort((a, b) => (b.revenue_calculation!.total_revenue) - (a.revenue_calculation!.total_revenue))
        .slice(0, 5);

      console.log('\n🏆 매출 상위 5개 사업장:');
      topBusinesses.forEach((business, index) => {
        const revenue = business.revenue_calculation!;
        console.log(`  ${index + 1}. ${business.business_name}`);
        console.log(`     매출: ${revenue.total_revenue.toLocaleString()}원`);
        console.log(`     순이익: ${revenue.net_profit.toLocaleString()}원`);
        console.log(`     이익률: ${revenue.profit_margin_percentage}%`);
        console.log(`     측정기기: ${business.equipment_summary.total_equipment_count}개`);
        console.log(`     업무: 자비 ${business.task_categories.self_tasks}개, 보조금 ${business.task_categories.subsidy_tasks}개`);
      });

    } else {
      console.error('❌ 조회 실패:', result.message);
    }

  } catch (error) {
    console.error('❌ API 호출 오류:', error);
  }
}

/**
 * 사용 예제 2: 특정 영업점별 매출 조회
 */
export async function example2_getSalesOfficeRevenue(salesOffice: string) {
  try {
    const token = 'your-jwt-token-here';

    console.log(`📊 ${salesOffice} 영업점 매출 조회 시작...`);

    const result = await RevenueBusinessSummaryClient.getBusinessSummary({
      token,
      salesOffice,
      includeRevenue: true
    });

    if (result.success) {
      console.log(`✅ ${salesOffice} 영업점 조회 성공:`);

      const businesses = result.data.businesses;
      const totalRevenue = businesses.reduce((sum, b) =>
        sum + (b.revenue_calculation?.total_revenue || 0), 0);
      const totalProfit = businesses.reduce((sum, b) =>
        sum + (b.revenue_calculation?.net_profit || 0), 0);

      console.log(`  - 사업장 수: ${businesses.length}개`);
      console.log(`  - 총 매출: ${totalRevenue.toLocaleString()}원`);
      console.log(`  - 총 순이익: ${totalProfit.toLocaleString()}원`);
      console.log(`  - 평균 이익률: ${totalRevenue > 0 ? ((totalProfit / totalRevenue) * 100).toFixed(2) : 0}%`);

      // 업무 타입별 분석
      const selfTasks = businesses.reduce((sum, b) => sum + b.task_categories.self_tasks, 0);
      const subsidyTasks = businesses.reduce((sum, b) => sum + b.task_categories.subsidy_tasks, 0);

      console.log(`\n📋 업무 분석:`);
      console.log(`  - 자비 업무: ${selfTasks}개`);
      console.log(`  - 보조금 업무: ${subsidyTasks}개`);
      console.log(`  - 총 업무: ${selfTasks + subsidyTasks}개`);

    } else {
      console.error('❌ 조회 실패:', result.message);
    }

  } catch (error) {
    console.error('❌ API 호출 오류:', error);
  }
}

/**
 * 사용 예제 3: 특정 사업장 매출 재계산
 */
export async function example3_recalculateSpecificBusiness(businessId: string) {
  try {
    const token = 'your-jwt-token-here';

    console.log(`🔄 사업장 ${businessId} 매출 재계산 시작...`);

    const result = await RevenueBusinessSummaryClient.recalculateBusinessRevenue(businessId, token);

    if (result.success) {
      const calc = result.data.calculation;
      console.log('✅ 매출 재계산 성공:');
      console.log(`  - 사업장: ${calc.business_name}`);
      console.log(`  - 총 매출: ${calc.total_revenue.toLocaleString()}원`);
      console.log(`  - 총 비용: ${calc.total_cost.toLocaleString()}원`);
      console.log(`  - 순이익: ${calc.net_profit.toLocaleString()}원`);
      console.log(`  - 계산일: ${calc.calculation_date}`);
    } else {
      console.error('❌ 재계산 실패:', result.message);
    }

  } catch (error) {
    console.error('❌ API 호출 오류:', error);
  }
}

/**
 * 사용 예제 4: 성능 최적화된 대량 조회
 */
export async function example4_optimizedBulkQuery() {
  try {
    const token = 'your-jwt-token-here';

    console.log('🚀 성능 최적화된 대량 조회 시작...');

    // 1단계: 매출 계산 없이 빠른 기본 정보 조회
    const basicResult = await RevenueBusinessSummaryClient.getBusinessSummary({
      token,
      includeRevenue: false,
      limit: 100
    });

    console.log(`📋 1단계 - 기본 정보 조회: ${basicResult.data.businesses.length}개 사업장`);

    // 2단계: 측정기기가 많은 상위 20개 사업장만 매출 계산
    const topEquipmentBusinesses = basicResult.data.businesses
      .sort((a, b) => b.equipment_summary.total_equipment_count - a.equipment_summary.total_equipment_count)
      .slice(0, 20);

    console.log('💰 2단계 - 상위 20개 사업장 매출 계산 중...');

    const revenuePromises = topEquipmentBusinesses.map(business =>
      RevenueBusinessSummaryClient.recalculateBusinessRevenue(business.business_id, token)
        .catch(error => ({
          success: false,
          business_id: business.business_id,
          error: error.message
        }))
    );

    const revenueResults = await Promise.all(revenuePromises);
    const successfulCalculations = revenueResults.filter(r => r.success).length;

    console.log(`✅ 매출 계산 완료: ${successfulCalculations}/${topEquipmentBusinesses.length}개 성공`);

    // 3단계: 결과 분석
    const totalRevenue = revenueResults
      .filter(r => r.success)
      .reduce((sum, r) => sum + (r.data?.calculation?.total_revenue || 0), 0);

    console.log(`📊 최종 결과:`);
    console.log(`  - 분석 대상: 상위 ${topEquipmentBusinesses.length}개 사업장`);
    console.log(`  - 총 매출: ${totalRevenue.toLocaleString()}원`);
    console.log(`  - 평균 매출: ${Math.round(totalRevenue / successfulCalculations).toLocaleString()}원`);

  } catch (error) {
    console.error('❌ 대량 조회 오류:', error);
  }
}

/**
 * 실제 사용 시 환경별 설정
 */
export const REVENUE_API_CONFIG = {
  development: {
    baseUrl: 'http://localhost:3000',
    timeout: 30000
  },
  production: {
    baseUrl: 'https://your-domain.com',
    timeout: 60000
  }
};

// 사용법 데모
if (require.main === module) {
  console.log('🎯 매출 통합 API 사용 예제 실행');
  console.log('실제 사용 시에는 유효한 JWT 토큰을 설정하세요.\n');

  // example1_getAllBusinessSummary();
  // example2_getSalesOfficeRevenue('서울지점');
  // example3_recalculateSpecificBusiness('business-id-123');
  // example4_optimizedBulkQuery();
}