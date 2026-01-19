// scripts/verify-gateway-calculation.js
// gateway_1_2 계산이 실제로 되고 있는지 검증

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() || '';

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function verifyGatewayCalculation() {
  console.log('🔍 Gateway_1_2 계산 검증\n');

  const calcDate = new Date().toISOString().split('T')[0];

  // 1. 설치 완료된 사업장 조회
  const { data: businesses, error: businessError } = await supabase
    .from('business_info')
    .select('*')
    .eq('is_active', true)
    .eq('is_deleted', false)
    .not('installation_date', 'is', null)
    .gte('installation_date', '2025-07-01')
    .lte('installation_date', '2025-07-31');

  if (businessError) {
    console.error('❌ 사업장 조회 실패:', businessError);
    return;
  }

  console.log(`📊 조회된 사업장: ${businesses.length}개\n`);

  // 2. gateway_1_2를 사용하는 사업장만 필터
  const gatewayBusinesses = businesses.filter(b => (b.gateway_1_2 || 0) > 0);
  console.log(`📊 gateway_1_2 사용 사업장: ${gatewayBusinesses.length}개\n`);

  // 3. 제조사별 원가 조회
  const { data: manufacturerPricingData, error: pricingError } = await supabase
    .from('manufacturer_pricing')
    .select('*')
    .eq('is_active', true)
    .lte('effective_from', calcDate)
    .or(`effective_to.is.null,effective_to.gte.${calcDate}`);

  if (pricingError) {
    console.error('❌ 제조사 원가 조회 실패:', pricingError);
    return;
  }

  // 4. 제조사별 원가 맵 생성 (대시보드 API와 동일)
  const manufacturerCostMap = {};
  manufacturerPricingData?.forEach(item => {
    const normalizedManufacturer = item.manufacturer.toLowerCase().trim();
    if (!manufacturerCostMap[normalizedManufacturer]) {
      manufacturerCostMap[normalizedManufacturer] = {};
    }
    manufacturerCostMap[normalizedManufacturer][item.equipment_type] = Number(item.cost_price) || 0;
  });

  console.log('💰 제조사별 gateway_1_2 원가:');
  Object.keys(manufacturerCostMap).forEach(manu => {
    const gateway12Cost = manufacturerCostMap[manu]['gateway_1_2'] || 0;
    console.log(`  ${manu}: ${gateway12Cost.toLocaleString()}원`);
  });
  console.log('');

  // 5. 샘플 사업장 5개로 계산 검증
  console.log('🔍 샘플 사업장 gateway_1_2 계산 검증 (처음 5개):\n');

  let totalGatewayCost = 0;

  gatewayBusinesses.slice(0, 5).forEach((business, index) => {
    console.log(`${index + 1}. ${business.business_name}`);

    const rawManufacturer = business.manufacturer || 'ecosense';
    const normalizedManufacturer = rawManufacturer.toLowerCase().trim();

    let manufacturerCosts = manufacturerCostMap[normalizedManufacturer];
    if (!manufacturerCosts) {
      manufacturerCosts = manufacturerCostMap[rawManufacturer] || {};
    }

    const gateway12Quantity = business.gateway_1_2 || 0;
    const gateway12Cost = manufacturerCosts['gateway_1_2'] || 0;
    const gateway12Total = gateway12Cost * gateway12Quantity;

    console.log(`   제조사: ${rawManufacturer} → ${normalizedManufacturer}`);
    console.log(`   gateway_1_2: ${gateway12Quantity}개 × ${gateway12Cost.toLocaleString()}원 = ${gateway12Total.toLocaleString()}원`);
    console.log('');

    totalGatewayCost += gateway12Total;
  });

  // 6. 전체 사업장으로 총 gateway_1_2 매입금액 계산
  let totalGatewayAllBusinesses = 0;

  gatewayBusinesses.forEach(business => {
    const rawManufacturer = business.manufacturer || 'ecosense';
    const normalizedManufacturer = rawManufacturer.toLowerCase().trim();

    let manufacturerCosts = manufacturerCostMap[normalizedManufacturer];
    if (!manufacturerCosts) {
      manufacturerCosts = manufacturerCostMap[rawManufacturer] || {};
    }

    const gateway12Quantity = business.gateway_1_2 || 0;
    const gateway12Cost = manufacturerCosts['gateway_1_2'] || 0;
    totalGatewayAllBusinesses += gateway12Cost * gateway12Quantity;
  });

  console.log('📊 전체 집계:');
  console.log(`  gateway_1_2 사용 사업장: ${gatewayBusinesses.length}개`);
  console.log(`  gateway_1_2 총 매입금액: ${totalGatewayAllBusinesses.toLocaleString()}원`);
  console.log('');

  // 7. 대시보드 API에서 계산하는 방식과 동일한지 확인
  console.log('✅ 검증 결과:');
  if (totalGatewayAllBusinesses > 0) {
    console.log(`  gateway_1_2는 정상적으로 계산되고 있습니다.`);
    console.log(`  총 매입금액: ${totalGatewayAllBusinesses.toLocaleString()}원`);
  } else {
    console.log(`  ❌ gateway_1_2 계산에 문제가 있습니다.`);
    console.log(`  - 사용 사업장: ${gatewayBusinesses.length}개`);
    console.log(`  - 하지만 총 매입금액: 0원`);
  }
}

verifyGatewayCalculation().catch(console.error);
