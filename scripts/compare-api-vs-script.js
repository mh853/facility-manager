// scripts/compare-api-vs-script.js
// API와 스크립트의 계산 차이 상세 비교

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() || '';

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function compareCalculations() {
  console.log('🔍 API vs 스크립트 계산 비교\n');

  const calcDate = new Date().toISOString().split('T')[0];

  // 1. 설치 완료된 사업장 조회
  const { data: businesses, error: businessError } = await supabase
    .from('business_info')
    .select('*')
    .eq('is_active', true)
    .eq('is_deleted', false)
    .not('installation_date', 'is', null)
    .gte('installation_date', '2025-07-01')
    .lte('installation_date', '2025-07-31')
    .order('id', { ascending: true });

  if (businessError) {
    console.error('❌ 사업장 조회 실패:', businessError);
    return;
  }

  console.log(`📊 총 사업장: ${businesses.length}개\n`);

  // 2. 제조사별 원가 조회
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

  // 3. 제조사별 원가 맵 생성 (API와 100% 동일)
  const manufacturerCostMap = {};
  manufacturerPricingData?.forEach(item => {
    const normalizedManufacturer = item.manufacturer.toLowerCase().trim();
    if (!manufacturerCostMap[normalizedManufacturer]) {
      manufacturerCostMap[normalizedManufacturer] = {};
    }
    manufacturerCostMap[normalizedManufacturer][item.equipment_type] = Number(item.cost_price) || 0;
  });

  console.log('💰 사용 가능한 제조사 키:');
  Object.keys(manufacturerCostMap).forEach(manu => {
    console.log(`  - "${manu}"`);
  });
  console.log('');

  // 4. 측정기기 필드 정의
  const equipmentFields = [
    'ph_meter', 'differential_pressure_meter', 'temperature_meter',
    'discharge_current_meter', 'fan_current_meter', 'pump_current_meter',
    'gateway_1_2', 'gateway_3_4', 'vpn_wired', 'vpn_wireless',
    'explosion_proof_differential_pressure_meter_domestic',
    'explosion_proof_temperature_meter_domestic', 'expansion_device',
    'relay_8ch', 'relay_16ch', 'main_board_replacement', 'multiple_stack'
  ];

  // 5. 각 사업장 계산 및 비교
  let totalCost = 0;
  let manufacturerMismatchCount = 0;
  const mismatchedBusinesses = [];

  console.log('🔍 사업장별 제조사 매칭 및 매입금액 확인:\n');

  businesses.forEach((business, index) => {
    const rawManufacturer = business.manufacturer || 'ecosense';
    const normalizedManufacturer = rawManufacturer.toLowerCase().trim();

    // 제조사 원가 맵에서 검색 (API와 동일)
    let manufacturerCosts = manufacturerCostMap[normalizedManufacturer];

    if (!manufacturerCosts) {
      manufacturerCosts = manufacturerCostMap[rawManufacturer] || {};

      // 제조사 매칭 실패
      if (Object.keys(manufacturerCosts).length === 0) {
        manufacturerMismatchCount++;
        mismatchedBusinesses.push({
          name: business.business_name,
          rawManufacturer,
          normalizedManufacturer
        });
      }
    }

    // 매입금액 계산
    let businessCost = 0;
    let hasGateway12 = false;

    equipmentFields.forEach(field => {
      const quantity = business[field] || 0;
      if (quantity <= 0) return;

      const costPrice = manufacturerCosts[field] || 0;
      businessCost += costPrice * quantity;

      if (field === 'gateway_1_2' && quantity > 0) {
        hasGateway12 = true;
        if (costPrice === 0) {
          console.log(`  ⚠️ [${index + 1}] ${business.business_name}: gateway_1_2 ${quantity}개 있지만 원가 0원 (제조사: "${rawManufacturer}")`);
        }
      }
    });

    totalCost += businessCost;

    // 매입금액이 0원인 사업장 (gateway_1_2 있는데)
    if (hasGateway12 && businessCost === 0) {
      console.log(`  🚨 [${index + 1}] ${business.business_name}: gateway_1_2 있지만 총 매입금액 0원!`);
    }
  });

  console.log('\n\n📊 최종 결과:');
  console.log(`  총 사업장: ${businesses.length}개`);
  console.log(`  총 매입금액: ${totalCost.toLocaleString()}원`);
  console.log(`  제조사 매칭 실패: ${manufacturerMismatchCount}개\n`);

  if (mismatchedBusinesses.length > 0) {
    console.log('⚠️ 제조사 매칭 실패 목록:');
    mismatchedBusinesses.slice(0, 10).forEach((b, idx) => {
      console.log(`  ${idx + 1}. ${b.name}`);
      console.log(`     원본: "${b.rawManufacturer}"`);
      console.log(`     정규화: "${b.normalizedManufacturer}"`);
    });
  }

  console.log('\n📊 서버 로그와 비교:');
  console.log(`  서버 로그: 총매입 163,489,000원`);
  console.log(`  이 스크립트: 총매입 ${totalCost.toLocaleString()}원`);
  console.log(`  차이: ${(totalCost - 163489000).toLocaleString()}원`);
}

compareCalculations().catch(console.error);
