/**
 * STEP 2: 잘못된 계산 결과 재계산 및 업데이트
 *
 * 실행 방법:
 * 1. STEP1_fix_manufacturer_constraint_and_data.sql을 먼저 실행
 * 2. npm 패키지 설치: npm install
 * 3. 이 스크립트 실행: node STEP2_recalculate_revenue.js
 *
 * 작업 내용:
 * - revenue_calculations에서 total_revenue = 0인 데이터 찾기
 * - 해당 사업장들을 다시 계산하여 업데이트
 */

const { createClient } = require('@supabase/supabase-js');
const fetch = require('node-fetch');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// 관리자 JWT 토큰 생성 (테스트용)
async function getAdminToken() {
  // 실제 환경에서는 로그인 API를 통해 토큰을 받아야 합니다
  // 여기서는 직접 계산 API를 호출하므로 서비스 롤 키를 사용합니다
  return process.env.SUPABASE_SERVICE_ROLE_KEY;
}

async function recalculateRevenue() {
  console.log('🔄 매출 재계산 시작...\n');

  try {
    // 1. total_revenue = 0인 계산 결과 조회
    console.log('1️⃣ 잘못된 계산 결과 조회 중...');
    const { data: badCalculations, error: fetchError } = await supabase
      .from('revenue_calculations')
      .select('id, business_id, business_name, total_revenue, total_cost, calculation_date')
      .eq('total_revenue', 0)
      .order('created_at', { ascending: false });

    if (fetchError) {
      console.error('❌ 조회 오류:', fetchError);
      return;
    }

    console.log(`📊 발견된 잘못된 계산 결과: ${badCalculations?.length || 0}건\n`);

    if (!badCalculations || badCalculations.length === 0) {
      console.log('✅ 재계산이 필요한 데이터가 없습니다.');
      return;
    }

    // 중복 제거 (business_id 기준)
    const uniqueBusinessIds = [...new Set(badCalculations.map(c => c.business_id))];
    console.log(`🏢 재계산 대상 사업장: ${uniqueBusinessIds.length}개\n`);

    // 2. 각 사업장별로 재계산
    let successCount = 0;
    let errorCount = 0;
    let skipCount = 0;

    for (const businessId of uniqueBusinessIds) {
      const businessName = badCalculations.find(c => c.business_id === businessId)?.business_name || businessId;

      try {
        console.log(`📍 ${businessName} 재계산 중...`);

        // API를 통해 재계산 (POST 요청)
        const response = await fetch('http://localhost:3000/api/revenue/calculate', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${await getAdminToken()}`
          },
          body: JSON.stringify({
            business_id: businessId,
            calculation_date: new Date().toISOString().split('T')[0],
            save_result: false // 먼저 계산만 해보기
          })
        });

        const result = await response.json();

        if (result.success) {
          const newRevenue = result.data.calculation.total_revenue;
          const newCost = result.data.calculation.total_cost;
          const newProfit = result.data.calculation.net_profit;

          // 여전히 0이면 스킵
          if (newRevenue === 0 && newCost === 0) {
            console.log(`  ⏭️  여전히 0: 기기 데이터 또는 원가 정보 부족으로 추정`);
            skipCount++;
            continue;
          }

          // 기존 계산 결과 업데이트
          const calculationsToUpdate = badCalculations.filter(c => c.business_id === businessId);

          for (const calc of calculationsToUpdate) {
            const { error: updateError } = await supabase
              .from('revenue_calculations')
              .update({
                total_revenue: newRevenue,
                total_cost: newCost,
                gross_profit: result.data.calculation.gross_profit,
                sales_commission: result.data.calculation.sales_commission,
                survey_costs: result.data.calculation.survey_costs,
                installation_costs: result.data.calculation.installation_costs,
                net_profit: newProfit,
                equipment_breakdown: result.data.calculation.equipment_breakdown,
                cost_breakdown: result.data.calculation.cost_breakdown
              })
              .eq('id', calc.id);

            if (updateError) {
              console.error(`  ❌ 업데이트 오류:`, updateError);
            }
          }

          console.log(`  ✅ 성공: 매출 ₩${newRevenue.toLocaleString()}, 이익 ₩${newProfit.toLocaleString()}`);
          successCount++;
        } else {
          console.log(`  ❌ 계산 실패: ${result.message}`);
          errorCount++;
        }

        // API 호출 간격 (과부하 방지)
        await new Promise(resolve => setTimeout(resolve, 200));

      } catch (error) {
        console.error(`  ❌ ${businessName} 오류:`, error.message);
        errorCount++;
      }
    }

    console.log('\n📊 재계산 완료!');
    console.log(`  ✅ 성공: ${successCount}건`);
    console.log(`  ❌ 실패: ${errorCount}건`);
    console.log(`  ⏭️  스킵: ${skipCount}건`);

  } catch (error) {
    console.error('❌ 전체 프로세스 오류:', error);
  }
}

// 실행
recalculateRevenue();
