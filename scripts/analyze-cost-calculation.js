// scripts/analyze-cost-calculation.js
// 대시보드 매입금액 계산 상세 분석

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() || '';

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function analyzeCostCalculation() {
  console.log('🔍 대시보드 매입금액 계산 상세 분석\n');

  const calcDate = new Date().toISOString().split('T')[0];

  // 1. 설치 완료된 사업장 조회 (대시보드와 동일 조건)
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

  // 2. 제조사별 원가 데이터 조회
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

  // 3. 제조사별 원가 맵 생성 (대시보드 API와 100% 동일)
  const manufacturerCostMap = {};
  manufacturerPricingData?.forEach(item => {
    const normalizedManufacturer = item.manufacturer.toLowerCase().trim();
    if (!manufacturerCostMap[normalizedManufacturer]) {
      manufacturerCostMap[normalizedManufacturer] = {};
    }
    manufacturerCostMap[normalizedManufacturer][item.equipment_type] = Number(item.cost_price) || 0;
  });

  console.log('📋 제조사별 원가 맵:');
  Object.keys(manufacturerCostMap).forEach(manu => {
    const costs = manufacturerCostMap[manu];
    const zeroCount = Object.values(costs).filter(v => v === 0).length;
    console.log(`  ${manu}: ${Object.keys(costs).length}개 장비 (0원: ${zeroCount}개)`);
  });
  console.log('');

  // 4. 측정기기 필드 정의 (대시보드 API와 동일)
  // ✅ gateway (구형) 제거 - 게이트웨이(1,2), 게이트웨이(3,4)만 사용
  const equipmentFields = [
    'ph_meter', 'differential_pressure_meter', 'temperature_meter',
    'discharge_current_meter', 'fan_current_meter', 'pump_current_meter',
    'gateway_1_2', 'gateway_3_4', 'vpn_wired', 'vpn_wireless',
    'explosion_proof_differential_pressure_meter_domestic',
    'explosion_proof_temperature_meter_domestic', 'expansion_device',
    'relay_8ch', 'relay_16ch', 'main_board_replacement', 'multiple_stack'
  ];

  // 5. 각 사업장별 매입금액 계산
  let totalCostSum = 0;
  let totalRevenueSum = 0;
  let zeroCostEquipmentCount = 0;
  let totalEquipmentCount = 0;
  const zeroCostEquipments = new Set();

  console.log('🔍 사업장별 매입금액 계산 분석:\n');

  businesses.slice(0, 5).forEach((business, index) => {
    console.log(`\n=== 사업장 ${index + 1}: ${business.business_name} ===`);

    const rawManufacturer = business.manufacturer || 'ecosense';
    const normalizedManufacturer = rawManufacturer.toLowerCase().trim();

    let manufacturerCosts = manufacturerCostMap[normalizedManufacturer];
    if (!manufacturerCosts) {
      manufacturerCosts = manufacturerCostMap[rawManufacturer] || {};
    }

    console.log(`제조사: ${rawManufacturer} → ${normalizedManufacturer}`);
    console.log(`원가 맵 존재: ${manufacturerCosts ? 'O' : 'X'}`);

    let businessCost = 0;
    let businessEquipmentCount = 0;

    equipmentFields.forEach(field => {
      const quantity = business[field] || 0;
      if (quantity <= 0) return;

      const costPrice = manufacturerCosts[field] || 0;
      const itemCost = costPrice * quantity;
      businessCost += itemCost;
      businessEquipmentCount += quantity;

      if (costPrice === 0) {
        console.log(`  ❌ ${field}: ${quantity}개 × 0원 = 0원`);
        zeroCostEquipments.add(field);
      } else {
        console.log(`  ✅ ${field}: ${quantity}개 × ${costPrice.toLocaleString()}원 = ${itemCost.toLocaleString()}원`);
      }
    });

    console.log(`\n사업장 총 매입: ${businessCost.toLocaleString()}원 (장비 ${businessEquipmentCount}개)`);
    totalCostSum += businessCost;
    totalEquipmentCount += businessEquipmentCount;
  });

  // 전체 사업장 집계
  businesses.forEach(business => {
    const rawManufacturer = business.manufacturer || 'ecosense';
    const normalizedManufacturer = rawManufacturer.toLowerCase().trim();

    let manufacturerCosts = manufacturerCostMap[normalizedManufacturer];
    if (!manufacturerCosts) {
      manufacturerCosts = manufacturerCostMap[rawManufacturer] || {};
    }

    equipmentFields.forEach(field => {
      const quantity = business[field] || 0;
      if (quantity <= 0) return;

      const costPrice = manufacturerCosts[field] || 0;
      totalCostSum += costPrice * quantity;

      if (costPrice === 0) {
        zeroCostEquipmentCount += quantity;
      }
    });
  });

  console.log('\n\n📊 전체 집계:');
  console.log(`  총 사업장: ${businesses.length}개`);
  console.log(`  총 매입금액: ${totalCostSum.toLocaleString()}원`);
  console.log(`  원가 0원인 장비 수량: ${zeroCostEquipmentCount}개`);
  console.log(`  원가 0원인 장비 종류: ${Array.from(zeroCostEquipments).join(', ')}`);

  // 6. 문제점 요약
  console.log('\n\n⚠️ 문제점 분석:');
  if (zeroCostEquipmentCount > 0) {
    console.log(`  1. 원가가 0원인 장비가 ${zeroCostEquipmentCount}개 존재`);
    console.log(`  2. 해당 장비들: ${Array.from(zeroCostEquipments).join(', ')}`);
    console.log(`  3. 이로 인해 매입금액이 실제보다 낮게 계산됨`);
  }

  console.log('\n💡 해결 방법:');
  console.log('  /admin/revenue/pricing 페이지에서 0원인 장비의 원가를 입력하세요.');
}

analyzeCostCalculation().catch(console.error);
