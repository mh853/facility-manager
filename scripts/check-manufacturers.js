// scripts/check-manufacturers.js
// 제조사 데이터 확인 스크립트

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() || '';

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function checkManufacturers() {
  console.log('🔍 제조사 데이터 확인 중...\n');

  // 1. manufacturer_pricing 테이블의 제조사 목록
  const { data: manufacturerPricing, error: pricingError } = await supabase
    .from('manufacturer_pricing')
    .select('manufacturer')
    .eq('is_active', true);

  if (pricingError) {
    console.error('❌ manufacturer_pricing 조회 실패:', pricingError);
  } else {
    const uniqueManufacturers = [...new Set(manufacturerPricing.map(m => m.manufacturer))];
    console.log('📊 manufacturer_pricing 테이블의 제조사 목록:');
    uniqueManufacturers.forEach(m => console.log(`  - "${m}" (type: ${typeof m})`));
    console.log('');
  }

  // 2. business_info 테이블의 제조사 목록
  const { data: businesses, error: businessError } = await supabase
    .from('business_info')
    .select('manufacturer');

  if (businessError) {
    console.error('❌ business_info 조회 실패:', businessError);
  } else {
    const uniqueBusinessManufacturers = [...new Set(businesses.map(b => b.manufacturer).filter(Boolean))];
    console.log('📊 business_info 테이블의 제조사 목록:');
    uniqueBusinessManufacturers.forEach(m => console.log(`  - "${m}" (type: ${typeof m})`));
    console.log('');
  }

  // 3. 샘플 제조사 원가 데이터 확인
  const { data: samplePricing, error: sampleError } = await supabase
    .from('manufacturer_pricing')
    .select('*')
    .eq('is_active', true)
    .limit(5);

  if (sampleError) {
    console.error('❌ 샘플 데이터 조회 실패:', sampleError);
  } else {
    console.log('📊 샘플 제조사 원가 데이터:');
    samplePricing.forEach(p => {
      console.log(`  - 제조사: "${p.manufacturer}", 장비: ${p.equipment_type}, 원가: ${p.cost_price}`);
    });
  }
}

checkManufacturers().catch(console.error);
