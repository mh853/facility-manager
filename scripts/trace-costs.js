const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

// Hardcoded default costs from the codebase
const INSTALLATION_COSTS = {
  local_suction_facility: 200000,      // 국소배기시설
  complete_enclosure_facility: 200000, // 완전밀폐시설
  tank_suction_facility: 200000,       // 탱크배기시설
  sanding_facility: 150000,            // 연마시설
  high_speed_rotation_facility: 150000, // 고속회전시설
  installation_facility: 150000,       // 설치시설
  other_facility: 150000              // 기타시설
};

async function traceCosts() {
  console.log('🔍 추적: (주)공담 C동의 ₩1,450,000 비용 출처\n');
  console.log('='.repeat(70));

  // Get business data
  const { data: businesses } = await supabase
    .from('business_info')
    .select('*')
    .ilike('business_name', '%공담%C동%')
    .eq('is_deleted', false);

  if (!businesses || businesses.length === 0) {
    console.error('❌ Business not found');
    return;
  }

  const business = businesses[0];

  console.log('\n📊 모든 관련 필드 확인:\n');

  // Check all cost-related fields
  const costFields = [
    'total_cost',
    'total_base_installation_cost',
    'additional_cost',
    'additional_construction_cost',
    'negotiation',
    'multiple_stack_cost',
    'installation_costs',
    'sales_commission',
    'survey_costs'
  ];

  costFields.forEach(field => {
    const value = business[field];
    if (value !== null && value !== undefined && value !== 0 && value !== '') {
      console.log(`  ✅ ${field}: ${typeof value === 'number' ? value.toLocaleString() : value}`);
    } else {
      console.log(`  ⚪ ${field}: ${value === null ? 'null' : value === '' ? '(empty)' : '0'}`);
    }
  });

  console.log('\n📋 기기 수량 확인:\n');

  const EQUIPMENT_FIELDS = [
    'local_suction_facility',
    'complete_enclosure_facility',
    'tank_suction_facility',
    'sanding_facility',
    'high_speed_rotation_facility',
    'installation_facility',
    'other_facility'
  ];

  let totalQuantity = 0;
  let totalDefaultInstallation = 0;

  EQUIPMENT_FIELDS.forEach(field => {
    const quantity = business[field] || 0;
    const unitCost = INSTALLATION_COSTS[field] || 0;
    const totalCost = quantity * unitCost;

    totalQuantity += quantity;
    totalDefaultInstallation += totalCost;

    if (quantity > 0) {
      console.log(`  ✅ ${field}: ${quantity}대 × ${unitCost.toLocaleString()}원 = ${totalCost.toLocaleString()}원`);
    } else {
      console.log(`  ⚪ ${field}: 0대`);
    }
  });

  console.log(`\n  총 기기 수량: ${totalQuantity}대`);
  console.log(`  총 기본 설치비 (하드코딩): ${totalDefaultInstallation.toLocaleString()}원`);

  // Check if there are any settings in the database
  console.log('\n🔍 데이터베이스 설정 확인:\n');

  // Try to get installation costs from DB
  try {
    const { data: installCosts, error: installError } = await supabase
      .from('installation_cost_settings')
      .select('*');

    if (installError) {
      console.log(`  ⚠️  installation_cost_settings: 테이블 없음 (${installError.message})`);
    } else if (!installCosts || installCosts.length === 0) {
      console.log('  ⚠️  installation_cost_settings: 데이터 없음');
    } else {
      console.log(`  ✅ installation_cost_settings: ${installCosts.length}개 설정 존재`);
      installCosts.forEach(setting => {
        console.log(`     - ${setting.equipment_type}: ${setting.base_installation_cost.toLocaleString()}원`);
      });
    }
  } catch (e) {
    console.log(`  ❌ installation_cost_settings 조회 실패: ${e.message}`);
  }

  // Calculate what the UI might be showing
  console.log('\n💡 가능한 비용 구성:\n');

  const adjustedRevenue = 1000000; // We know this from the screenshot
  const salesCommission10Percent = adjustedRevenue * 0.10; // 100,000
  const salesCommission15Percent = adjustedRevenue * 0.15; // 150,000

  console.log(`  시나리오 1: 영업비용 10% + 추가비용`);
  console.log(`    - 영업비용 (10%): ${salesCommission10Percent.toLocaleString()}원`);
  console.log(`    - 필요한 추가비용: ${(1450000 - salesCommission10Percent).toLocaleString()}원`);
  console.log(`    - 총 비용: ${(salesCommission10Percent + 1350000).toLocaleString()}원`);

  console.log(`\n  시나리오 2: 영업비용 15%`);
  console.log(`    - 영업비용 (15%): ${salesCommission15Percent.toLocaleString()}원`);
  console.log(`    - 필요한 추가비용: ${(1450000 - salesCommission15Percent).toLocaleString()}원`);
  console.log(`    - 총 비용: ${salesCommission15Percent + 1300000}원`);

  console.log(`\n  ⚠️  추가공사비(additional_cost) 자체가 비용으로 처리되는 경우:`);
  console.log(`    - additional_cost: 1,000,000원 (비용으로 차감)`);
  console.log(`    - 영업비용: 100,000원 (10%)`);
  console.log(`    - 기타 비용: 350,000원`);
  console.log(`    - 총 비용: 1,450,000원 ✅`);

  console.log(`\n  🎯 가장 가능성 높은 시나리오:`);
  console.log(`    1. additional_cost (1,000,000원)가 매출이 아닌 '비용'으로 차감됨`);
  console.log(`    2. 영업비용 10% (100,000원) 차감`);
  console.log(`    3. 추가 비용 350,000원 차감 (출처 불명)`);
  console.log(`    = 순이익: 1,000,000 - 0 - 1,000,000 - 100,000 - 350,000 = -450,000원`);

  // Check if additional_construction_cost might be involved
  const additionalConstructionCost = business.additional_construction_cost || 0;
  if (additionalConstructionCost !== 0) {
    console.log(`\n  ✅ additional_construction_cost 발견: ${additionalConstructionCost.toLocaleString()}원`);
  }

  console.log('\n');
}

traceCosts();
