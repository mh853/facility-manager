// scripts/check-all-pricing.js
// DB의 모든 제조사별 원가 데이터 확인

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() || '';

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function checkAllPricing() {
  console.log('📊 DB에 저장된 제조사별 원가 데이터\n');

  const { data, error } = await supabase
    .from('manufacturer_pricing')
    .select('manufacturer, equipment_type, cost_price')
    .eq('is_active', true)
    .order('manufacturer', { ascending: true })
    .order('equipment_type', { ascending: true });

  if (error) {
    console.error('❌ 조회 실패:', error);
    return;
  }

  const grouped = {};
  data.forEach(item => {
    if (!grouped[item.manufacturer]) {
      grouped[item.manufacturer] = [];
    }
    const cost = Number(item.cost_price);
    const status = cost === 0 ? '❌ 0원' : '✅';
    grouped[item.manufacturer].push({
      equipment: item.equipment_type,
      cost: cost,
      status: status
    });
  });

  Object.entries(grouped).forEach(([manu, items]) => {
    console.log(`\n=== ${manu} ===`);
    const zeroCount = items.filter(item => item.cost === 0).length;
    console.log(`총 ${items.length}개 장비 (0원: ${zeroCount}개)\n`);

    items.forEach(item => {
      console.log(`  ${item.status} ${item.equipment.padEnd(45)} ${item.cost.toLocaleString()}원`);
    });
  });

  // 0원인 항목 요약
  console.log('\n\n📋 0원으로 저장된 항목 요약:\n');
  Object.entries(grouped).forEach(([manu, items]) => {
    const zeroItems = items.filter(item => item.cost === 0);
    if (zeroItems.length > 0) {
      console.log(`${manu}:`);
      zeroItems.forEach(item => {
        console.log(`  - ${item.equipment}`);
      });
    }
  });
}

checkAllPricing().catch(console.error);
