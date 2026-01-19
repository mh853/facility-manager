// scripts/check-manufacturer-gateway-pricing.js
// 제조사별 Gateway 원가 확인

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() || '';

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function checkGatewayPricing() {
  console.log('🔍 제조사별 Gateway 원가 확인\n');

  const calcDate = new Date().toISOString().split('T')[0];

  // 1. 제조사별 원가 조회 (API와 동일한 쿼리)
  const { data: manufacturerPricingData, error } = await supabase
    .from('manufacturer_pricing')
    .select('*')
    .eq('is_active', true)
    .lte('effective_from', calcDate)
    .or(`effective_to.is.null,effective_to.gte.${calcDate}`);

  if (error) {
    console.error('❌ 제조사 원가 조회 실패:', error);
    return;
  }

  console.log(`📊 제조사 원가 데이터 총 ${manufacturerPricingData.length}개\n`);

  // 2. Gateway 관련 원가만 필터링
  const gatewayPricing = manufacturerPricingData.filter(item =>
    item.equipment_type.includes('gateway')
  );

  console.log('🔍 Gateway 관련 원가:\n');
  gatewayPricing.forEach(item => {
    console.log(`제조사: "${item.manufacturer}"`);
    console.log(`  장비 타입: ${item.equipment_type}`);
    console.log(`  원가: ${Number(item.cost_price).toLocaleString()}원`);
    console.log(`  유효 기간: ${item.effective_from} ~ ${item.effective_to || '무제한'}\n`);
  });

  // 3. 제조사별 맵 생성 (API와 동일한 로직)
  const manufacturerCostMap = {};
  manufacturerPricingData.forEach(item => {
    const normalizedManufacturer = item.manufacturer.toLowerCase().trim();
    if (!manufacturerCostMap[normalizedManufacturer]) {
      manufacturerCostMap[normalizedManufacturer] = {};
    }
    manufacturerCostMap[normalizedManufacturer][item.equipment_type] = Number(item.cost_price) || 0;
  });

  console.log('📊 제조사별 Gateway 원가 맵:\n');
  const manufacturers = ['에코센스', '크린어스', '가이아씨앤에스', '이브이에스'];

  manufacturers.forEach(manu => {
    const normalizedManu = manu.toLowerCase().trim();
    const costs = manufacturerCostMap[normalizedManu] || {};

    console.log(`${manu} (키: "${normalizedManu}"):`);
    console.log(`  gateway: ${(costs['gateway'] || 0).toLocaleString()}원`);
    console.log(`  gateway_1_2: ${(costs['gateway_1_2'] || 0).toLocaleString()}원`);
    console.log(`  gateway_3_4: ${(costs['gateway_3_4'] || 0).toLocaleString()}원\n`);
  });

  // 4. 동승고무기기공업사 확인
  const { data: dongseung, error: dsError } = await supabase
    .from('business_info')
    .select('*')
    .eq('business_name', '동승고무기기공업사')
    .single();

  if (!dsError && dongseung) {
    console.log('🔍 동승고무기기공업사 정보:\n');
    console.log(`  제조사: "${dongseung.manufacturer}"`);
    console.log(`  gateway: ${dongseung.gateway || 0}개`);
    console.log(`  gateway_1_2: ${dongseung.gateway_1_2 || 0}개`);
    console.log(`  gateway_3_4: ${dongseung.gateway_3_4 || 0}개\n`);

    const rawManufacturer = dongseung.manufacturer || 'ecosense';
    const normalizedManufacturer = rawManufacturer.toLowerCase().trim();

    console.log(`  정규화된 제조사 키: "${normalizedManufacturer}"`);

    const manufacturerCosts = manufacturerCostMap[normalizedManufacturer];

    if (manufacturerCosts) {
      console.log(`  ✅ 제조사 매칭 성공!`);
      console.log(`  gateway_1_2 원가: ${(manufacturerCosts['gateway_1_2'] || 0).toLocaleString()}원\n`);

      const gateway12Total = (manufacturerCosts['gateway_1_2'] || 0) * (dongseung.gateway_1_2 || 0);
      console.log(`  예상 gateway_1_2 매입: ${gateway12Total.toLocaleString()}원`);
    } else {
      console.log(`  ❌ 제조사 매칭 실패!`);
      console.log(`  사용 가능한 제조사 키:`, Object.keys(manufacturerCostMap));
    }
  }
}

checkGatewayPricing().catch(console.error);
