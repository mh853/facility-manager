// scripts/verify-cost-calculation.js
// 실제 매입 원가 계산 검증

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() || '';

const supabase = createClient(supabaseUrl, supabaseServiceKey);

// 제조사 코드 변환 맵 (API와 동일)
const manufacturerCodeMap = {
  '에코센스': 'ecosense',
  '크린어스': 'cleanearth',
  '가이아씨앤에스': 'gaia_cns',
  '이브이에스': 'evs'
};

async function verifyCostCalculation() {
  console.log('🔍 매입 원가 계산 검증\n');

  const calcDate = '2025-07-15';

  // 1. 제조사별 원가 데이터 조회 (Supabase 사용)
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

  // 2. 제조사별 원가 맵 생성 (API와 동일)
  const manufacturerCostMap = {};
  manufacturerPricingData?.forEach(item => {
    const manufacturerCode = manufacturerCodeMap[item.manufacturer] || item.manufacturer.toLowerCase().trim();
    if (!manufacturerCostMap[manufacturerCode]) {
      manufacturerCostMap[manufacturerCode] = {};
    }
    manufacturerCostMap[manufacturerCode][item.equipment_type] = Number(item.cost_price) || 0;
  });

  console.log('📊 제조사별 원가 맵:', Object.keys(manufacturerCostMap));
  console.log('');

  // 3. 2025-07월 사업장 샘플 조회
  const { data: businesses, error } = await supabase
    .from('business_info')
    .select('*')
    .gte('installation_date', '2025-07-01')
    .lt('installation_date', '2025-08-01')
    .limit(5);

  if (error) {
    console.error('❌ 사업장 조회 실패:', error);
    return;
  }

  console.log(`📊 2025-07월 샘플 사업장: ${businesses.length}개\n`);

  // 4. 각 사업장의 매입 원가 계산
  const equipmentFields = [
    'discharge_current_meter', 'fan_current_meter', 'ph_meter',
    'vpn_wireless', 'vpn_wired', 'cctv_3mp', 'cctv_5mp',
    'air_ems', 'water_ems', 'integrated_tms', 'air_tms'
  ];

  businesses.forEach(business => {
    const rawManufacturer = business.manufacturer || 'ecosense';
    const manufacturerCode = manufacturerCodeMap[rawManufacturer] || rawManufacturer.toLowerCase().trim();
    const manufacturerCosts = manufacturerCostMap[manufacturerCode] || {};

    console.log(`\n사업장: ${business.business_name}`);
    console.log(`  제조사: "${rawManufacturer}" → "${manufacturerCode}"`);
    console.log(`  원가 데이터 존재: ${Object.keys(manufacturerCosts).length > 0 ? '✅' : '❌'}`);

    if (Object.keys(manufacturerCosts).length === 0) {
      console.log(`  ⚠️ 제조사 원가 맵에서 찾을 수 없음!`);
      console.log(`  사용 가능한 제조사:`, Object.keys(manufacturerCostMap));
      return;
    }

    let totalCost = 0;
    let totalRevenue = 0;
    let equipmentCount = 0;

    equipmentFields.forEach(field => {
      const quantity = business[field] || 0;
      if (quantity > 0) {
        const costPrice = manufacturerCosts[field] || 0;
        const itemCost = costPrice * quantity;
        totalCost += itemCost;
        equipmentCount++;

        if (costPrice === 0) {
          console.log(`  ⚠️ ${field}: 수량 ${quantity}개, 원가 0원 (데이터 누락?)`);
        } else {
          console.log(`  - ${field}: ${quantity}개 × ${costPrice.toLocaleString()}원 = ${itemCost.toLocaleString()}원`);
        }
      }
    });

    console.log(`  총 장비: ${equipmentCount}개`);
    console.log(`  총 매입금액: ${totalCost.toLocaleString()}원`);
  });
}

verifyCostCalculation().catch(console.error);
