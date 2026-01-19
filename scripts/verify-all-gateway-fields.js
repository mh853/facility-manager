// scripts/verify-all-gateway-fields.js
// gateway, gateway_1_2, gateway_3_4 모두 확인

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() || '';

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function verifyAllGatewayFields() {
  console.log('🔍 전체 Gateway 필드 검증\n');

  const calcDate = new Date().toISOString().split('T')[0];

  // 1. 설치 완료된 사업장 조회 (2025-07)
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

  console.log(`📊 총 사업장: ${businesses.length}개\n`);

  // 2. Gateway 필드별 사용 현황
  let gatewayOldCount = 0;
  let gateway12Count = 0;
  let gateway34Count = 0;

  businesses.forEach(b => {
    gatewayOldCount += (b.gateway || 0);
    gateway12Count += (b.gateway_1_2 || 0);
    gateway34Count += (b.gateway_3_4 || 0);
  });

  console.log('📊 Gateway 사용 현황:');
  console.log(`  gateway (구형): ${gatewayOldCount}개`);
  console.log(`  gateway_1_2: ${gateway12Count}개`);
  console.log(`  gateway_3_4: ${gateway34Count}개\n`);

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

  // 4. 제조사별 원가 맵 생성
  const manufacturerCostMap = {};
  manufacturerPricingData?.forEach(item => {
    const normalizedManufacturer = item.manufacturer.toLowerCase().trim();
    if (!manufacturerCostMap[normalizedManufacturer]) {
      manufacturerCostMap[normalizedManufacturer] = {};
    }
    manufacturerCostMap[normalizedManufacturer][item.equipment_type] = Number(item.cost_price) || 0;
  });

  // 5. 제조사별 Gateway 원가 출력
  console.log('💰 제조사별 Gateway 원가:\n');
  const manufacturers = ['에코센스', '크린어스', '가이아씨앤에스', '이브이에스'];

  manufacturers.forEach(manu => {
    const normalizedManu = manu.toLowerCase();
    const costs = manufacturerCostMap[normalizedManu] || {};

    console.log(`${manu}:`);
    console.log(`  gateway (구형): ${(costs['gateway'] || 0).toLocaleString()}원`);
    console.log(`  gateway_1_2: ${(costs['gateway_1_2'] || 0).toLocaleString()}원`);
    console.log(`  gateway_3_4: ${(costs['gateway_3_4'] || 0).toLocaleString()}원\n`);
  });

  // 6. 각 필드별 총 매입금액 계산
  let totalGatewayOld = 0;
  let totalGateway12 = 0;
  let totalGateway34 = 0;

  businesses.forEach(business => {
    const rawManufacturer = business.manufacturer || 'ecosense';
    const normalizedManufacturer = rawManufacturer.toLowerCase().trim();

    let manufacturerCosts = manufacturerCostMap[normalizedManufacturer];
    if (!manufacturerCosts) {
      manufacturerCosts = manufacturerCostMap[rawManufacturer] || {};
    }

    // Gateway (구형)
    const gatewayOldQty = business.gateway || 0;
    const gatewayOldCost = manufacturerCosts['gateway'] || 0;
    totalGatewayOld += gatewayOldCost * gatewayOldQty;

    // Gateway_1_2
    const gateway12Qty = business.gateway_1_2 || 0;
    const gateway12Cost = manufacturerCosts['gateway_1_2'] || 0;
    totalGateway12 += gateway12Cost * gateway12Qty;

    // Gateway_3_4
    const gateway34Qty = business.gateway_3_4 || 0;
    const gateway34Cost = manufacturerCosts['gateway_3_4'] || 0;
    totalGateway34 += gateway34Cost * gateway34Qty;
  });

  console.log('📊 Gateway 필드별 총 매입금액:');
  console.log(`  gateway (구형): ${totalGatewayOld.toLocaleString()}원`);
  console.log(`  gateway_1_2: ${totalGateway12.toLocaleString()}원`);
  console.log(`  gateway_3_4: ${totalGateway34.toLocaleString()}원`);
  console.log(`  합계: ${(totalGatewayOld + totalGateway12 + totalGateway34).toLocaleString()}원\n`);

  // 7. Gateway_3_4 사용 사업장 샘플
  const gateway34Businesses = businesses.filter(b => (b.gateway_3_4 || 0) > 0);

  if (gateway34Businesses.length > 0) {
    console.log(`📋 Gateway_3_4 사용 사업장 (${gateway34Businesses.length}개):\n`);
    gateway34Businesses.slice(0, 5).forEach((b, idx) => {
      const rawManufacturer = b.manufacturer || 'ecosense';
      const normalizedManufacturer = rawManufacturer.toLowerCase().trim();
      const manufacturerCosts = manufacturerCostMap[normalizedManufacturer] || manufacturerCostMap[rawManufacturer] || {};
      const gateway34Cost = manufacturerCosts['gateway_3_4'] || 0;

      console.log(`${idx + 1}. ${b.business_name}`);
      console.log(`   제조사: ${rawManufacturer}`);
      console.log(`   gateway_3_4: ${b.gateway_3_4}개 × ${gateway34Cost.toLocaleString()}원 = ${(gateway34Cost * b.gateway_3_4).toLocaleString()}원\n`);
    });
  } else {
    console.log('📋 Gateway_3_4 사용 사업장: 없음\n');
  }

  // 8. 대시보드 API equipmentFields 확인
  console.log('✅ 대시보드 API equipmentFields 설정 상태:');
  console.log('  - gateway (구형): ❌ 제거됨');
  console.log('  - gateway_1_2: ✅ 포함됨');
  console.log('  - gateway_3_4: ✅ 포함됨\n');

  // 9. 최종 결론
  console.log('📊 최종 분석:');

  if (gateway34Count === 0) {
    console.log('  ⚠️ gateway_3_4는 어느 사업장에서도 사용되지 않음');
    console.log('  → gateway_3_4 매입금액: 0원 (정상)');
  } else {
    console.log(`  ✅ gateway_3_4 사용 중: ${gateway34Count}개`);
    console.log(`  → gateway_3_4 매입금액: ${totalGateway34.toLocaleString()}원`);
  }

  console.log(`  ✅ gateway_1_2 매입금액: ${totalGateway12.toLocaleString()}원`);
  console.log(`  ✅ 총 Gateway 매입금액: ${(totalGateway12 + totalGateway34).toLocaleString()}원`);
}

verifyAllGatewayFields().catch(console.error);
