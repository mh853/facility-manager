// scripts/check-gateway-calculation.js
// 게이트웨이 계산 상세 확인

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() || '';

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function checkGatewayCalculation() {
  console.log('🔍 게이트웨이 계산 상세 확인\n');

  // 1. 설치 완료된 사업장 조회 (2025년 7월)
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

  // 2. 게이트웨이 필드별 사용 현황
  let gatewayCount = 0;
  let gateway12Count = 0;
  let gateway34Count = 0;

  businesses.forEach(b => {
    gatewayCount += (b.gateway || 0);
    gateway12Count += (b.gateway_1_2 || 0);
    gateway34Count += (b.gateway_3_4 || 0);
  });

  console.log('📊 게이트웨이 사용 현황:');
  console.log(`  gateway (구형): ${gatewayCount}개`);
  console.log(`  gateway_1_2 (신형): ${gateway12Count}개`);
  console.log(`  gateway_3_4 (신형): ${gateway34Count}개\n`);

  // 3. 제조사별 원가 조회
  const calcDate = new Date().toISOString().split('T')[0];
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

  // 4. 제조사별 게이트웨이 원가 확인
  console.log('💰 제조사별 게이트웨이 원가:');
  const manufacturers = ['에코센스', '크린어스', '가이아씨앤에스', '이브이에스'];

  manufacturers.forEach(manu => {
    const manuData = manufacturerPricingData.filter(p => p.manufacturer === manu);
    const gateway = manuData.find(p => p.equipment_type === 'gateway');
    const gateway12 = manuData.find(p => p.equipment_type === 'gateway_1_2');
    const gateway34 = manuData.find(p => p.equipment_type === 'gateway_3_4');

    console.log(`\n${manu}:`);
    console.log(`  gateway (구형): ${gateway ? Number(gateway.cost_price).toLocaleString() + '원' : '없음'}`);
    console.log(`  gateway_1_2: ${gateway12 ? Number(gateway12.cost_price).toLocaleString() + '원' : '없음'}`);
    console.log(`  gateway_3_4: ${gateway34 ? Number(gateway34.cost_price).toLocaleString() + '원' : '없음'}`);
  });

  // 5. 실제 매입금액 계산 (구형 포함 vs 제외)
  const manufacturerCostMap = {};
  manufacturerPricingData?.forEach(item => {
    const normalizedManufacturer = item.manufacturer.toLowerCase().trim();
    if (!manufacturerCostMap[normalizedManufacturer]) {
      manufacturerCostMap[normalizedManufacturer] = {};
    }
    manufacturerCostMap[normalizedManufacturer][item.equipment_type] = Number(item.cost_price) || 0;
  });

  // 구형 포함 계산
  const fieldsWithOld = ['gateway', 'gateway_1_2', 'gateway_3_4'];
  let totalWithOld = 0;

  businesses.forEach(business => {
    const rawManufacturer = business.manufacturer || 'ecosense';
    const normalizedManufacturer = rawManufacturer.toLowerCase().trim();
    let manufacturerCosts = manufacturerCostMap[normalizedManufacturer] || {};

    fieldsWithOld.forEach(field => {
      const quantity = business[field] || 0;
      const costPrice = manufacturerCosts[field] || 0;
      totalWithOld += costPrice * quantity;
    });
  });

  // 구형 제외 계산
  const fieldsWithoutOld = ['gateway_1_2', 'gateway_3_4'];
  let totalWithoutOld = 0;

  businesses.forEach(business => {
    const rawManufacturer = business.manufacturer || 'ecosense';
    const normalizedManufacturer = rawManufacturer.toLowerCase().trim();
    let manufacturerCosts = manufacturerCostMap[normalizedManufacturer] || {};

    fieldsWithoutOld.forEach(field => {
      const quantity = business[field] || 0;
      const costPrice = manufacturerCosts[field] || 0;
      totalWithoutOld += costPrice * quantity;
    });
  });

  console.log('\n\n📊 게이트웨이 매입금액 비교:');
  console.log(`  구형 포함 (gateway + gateway_1_2 + gateway_3_4): ${totalWithOld.toLocaleString()}원`);
  console.log(`  구형 제외 (gateway_1_2 + gateway_3_4만): ${totalWithoutOld.toLocaleString()}원`);
  console.log(`  차이: ${(totalWithOld - totalWithoutOld).toLocaleString()}원\n`);

  // 6. 게이트웨이를 사용하는 샘플 사업장 확인
  console.log('📋 게이트웨이 사용 사업장 샘플 (처음 5개):\n');

  const gatewayBusinesses = businesses.filter(b =>
    (b.gateway || 0) > 0 || (b.gateway_1_2 || 0) > 0 || (b.gateway_3_4 || 0) > 0
  ).slice(0, 5);

  gatewayBusinesses.forEach((b, idx) => {
    console.log(`${idx + 1}. ${b.business_name}`);
    console.log(`   제조사: ${b.manufacturer}`);
    if (b.gateway) console.log(`   gateway (구형): ${b.gateway}개`);
    if (b.gateway_1_2) console.log(`   gateway_1_2: ${b.gateway_1_2}개`);
    if (b.gateway_3_4) console.log(`   gateway_3_4: ${b.gateway_3_4}개`);
    console.log('');
  });
}

checkGatewayCalculation().catch(console.error);
