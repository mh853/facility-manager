const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

// Equipment fields from the codebase
const EQUIPMENT_FIELDS = [
  'local_suction_facility',
  'complete_enclosure_facility',
  'tank_suction_facility',
  'sanding_facility',
  'high_speed_rotation_facility',
  'installation_facility',
  'other_facility'
];

async function calculateProfit() {
  console.log('💰 Profit Calculation Analysis for (주)공담 C동\n');
  console.log('='.repeat(70));

  // Get business data
  const { data: businesses, error: businessError } = await supabase
    .from('business_info')
    .select('*')
    .ilike('business_name', '%공담%C동%')
    .eq('is_deleted', false);

  if (businessError || !businesses || businesses.length === 0) {
    console.error('❌ Failed to find business');
    return;
  }

  const business = businesses[0];

  // Get sales office settings
  const { data: salesOfficeSettings } = await supabase
    .from('sales_office_settings')
    .select('*');

  // Get survey cost settings
  const { data: surveyCostSettings } = await supabase
    .from('survey_cost_settings')
    .select('*');

  console.log('\n📋 STEP 1: Base Revenue Calculation');
  console.log('-'.repeat(70));

  const totalRevenue = business.total_revenue || 0;
  const additionalCost = business.additional_cost || 0;
  const additionalInstallationRevenue = business.additional_installation_revenue || 0;
  const negotiation = business.negotiation || 0;

  console.log(`  total_revenue:                    ${totalRevenue.toLocaleString()} 원`);
  console.log(`  + additional_cost:                ${additionalCost.toLocaleString()} 원`);
  console.log(`  + additional_installation_revenue: ${additionalInstallationRevenue.toLocaleString()} 원`);
  console.log(`  - negotiation:                    ${negotiation.toLocaleString()} 원`);

  const adjustedRevenue = totalRevenue + additionalCost + additionalInstallationRevenue - negotiation;
  console.log(`  ───────────────────────────────────────────────`);
  console.log(`  = Adjusted Revenue:               ${adjustedRevenue.toLocaleString()} 원`);

  console.log('\n📋 STEP 2: Sales Commission Calculation');
  console.log('-'.repeat(70));

  const salesOffice = business.sales_office || '';
  console.log(`  Sales Office: "${salesOffice}"`);

  let salesCommission = 0;

  if (salesOfficeSettings && salesOffice) {
    const setting = salesOfficeSettings.find(s => s.sales_office === salesOffice);

    if (setting) {
      console.log(`  Commission Type: ${setting.commission_type}`);

      if (setting.commission_type === 'percentage' && setting.commission_percentage !== undefined) {
        salesCommission = adjustedRevenue * (setting.commission_percentage / 100);
        console.log(`  Rate: ${setting.commission_percentage}%`);
        console.log(`  Calculation: ${adjustedRevenue.toLocaleString()} × ${setting.commission_percentage}% = ${salesCommission.toLocaleString()} 원`);
      } else if (setting.commission_type === 'per_unit' && setting.commission_per_unit !== undefined) {
        const totalQuantity = EQUIPMENT_FIELDS.reduce((sum, field) => sum + (business[field] || 0), 0);
        salesCommission = totalQuantity * setting.commission_per_unit;
        console.log(`  Per Unit Cost: ${setting.commission_per_unit.toLocaleString()} 원`);
        console.log(`  Total Quantity: ${totalQuantity}`);
        console.log(`  Calculation: ${totalQuantity} × ${setting.commission_per_unit.toLocaleString()} = ${salesCommission.toLocaleString()} 원`);
      } else {
        salesCommission = adjustedRevenue * 0.10;
        console.log(`  ⚠️  No valid commission setting found`);
        console.log(`  Using default: 10%`);
        console.log(`  Calculation: ${adjustedRevenue.toLocaleString()} × 10% = ${salesCommission.toLocaleString()} 원`);
      }
    } else {
      salesCommission = adjustedRevenue * 0.10;
      console.log(`  ⚠️  Office "${salesOffice}" not found in settings`);
      console.log(`  Using default: 10%`);
      console.log(`  Calculation: ${adjustedRevenue.toLocaleString()} × 10% = ${salesCommission.toLocaleString()} 원`);
    }
  } else {
    salesCommission = adjustedRevenue * 0.10;
    console.log(`  ⚠️  No sales office settings found`);
    console.log(`  Using default: 10%`);
    console.log(`  Calculation: ${adjustedRevenue.toLocaleString()} × 10% = ${salesCommission.toLocaleString()} 원`);
  }

  console.log(`  ───────────────────────────────────────────────`);
  console.log(`  = Sales Commission:               ${salesCommission.toLocaleString()} 원`);

  console.log('\n📋 STEP 3: Survey Costs Calculation');
  console.log('-'.repeat(70));

  let surveyCosts = 0;
  const surveyCostMap = {};

  if (surveyCostSettings && surveyCostSettings.length > 0) {
    surveyCostSettings.forEach(setting => {
      surveyCostMap[setting.survey_type] = setting.cost;
    });

    console.log('  Survey Cost Settings:');
    console.log(`    - estimate: ${(surveyCostMap['estimate'] || 0).toLocaleString()} 원`);
    console.log(`    - pre_construction: ${(surveyCostMap['pre_construction'] || 0).toLocaleString()} 원`);
    console.log(`    - completion: ${(surveyCostMap['completion'] || 0).toLocaleString()} 원`);

    console.log('\n  Survey Dates:');

    if (business.estimate_survey_date && business.estimate_survey_date.trim() !== '') {
      const cost = surveyCostMap['estimate'] || 0;
      surveyCosts += cost;
      console.log(`    ✅ estimate_survey_date: ${business.estimate_survey_date} → +${cost.toLocaleString()} 원`);
    } else {
      console.log(`    ❌ estimate_survey_date: None`);
    }

    if (business.pre_construction_survey_date && business.pre_construction_survey_date.trim() !== '') {
      const cost = surveyCostMap['pre_construction'] || 0;
      surveyCosts += cost;
      console.log(`    ✅ pre_construction_survey_date: ${business.pre_construction_survey_date} → +${cost.toLocaleString()} 원`);
    } else {
      console.log(`    ❌ pre_construction_survey_date: None`);
    }

    if (business.completion_survey_date && business.completion_survey_date.trim() !== '') {
      const cost = surveyCostMap['completion'] || 0;
      surveyCosts += cost;
      console.log(`    ✅ completion_survey_date: ${business.completion_survey_date} → +${cost.toLocaleString()} 원`);
    } else {
      console.log(`    ❌ completion_survey_date: None`);
    }
  } else {
    console.log('  ⚠️  No survey cost settings found');
  }

  console.log(`  ───────────────────────────────────────────────`);
  console.log(`  = Total Survey Costs:             ${surveyCosts.toLocaleString()} 원`);

  console.log('\n📋 STEP 4: Costs Calculation');
  console.log('-'.repeat(70));

  const totalCost = business.total_cost || 0;
  const totalBaseInstallationCost = business.total_base_installation_cost || 0;

  console.log(`  Purchase Cost (total_cost):                ${totalCost.toLocaleString()} 원`);
  console.log(`  Base Installation Cost:                    ${totalBaseInstallationCost.toLocaleString()} 원`);

  console.log('\n📋 STEP 5: Final Profit Calculation');
  console.log('-'.repeat(70));

  const grossProfit = adjustedRevenue - totalCost;
  console.log(`  Gross Profit = Adjusted Revenue - Purchase Cost`);
  console.log(`               = ${adjustedRevenue.toLocaleString()} - ${totalCost.toLocaleString()}`);
  console.log(`               = ${grossProfit.toLocaleString()} 원`);

  console.log('\n  Net Profit = Gross Profit - Sales Commission - Survey Costs - Installation Cost');
  console.log(`             = ${grossProfit.toLocaleString()} - ${salesCommission.toLocaleString()} - ${surveyCosts.toLocaleString()} - ${totalBaseInstallationCost.toLocaleString()}`);

  const netProfit = grossProfit - salesCommission - surveyCosts - totalBaseInstallationCost;
  console.log(`             = ${netProfit.toLocaleString()} 원`);

  console.log('\n' + '='.repeat(70));
  console.log(`🎯 FINAL RESULT: ${netProfit.toLocaleString()} 원`);
  console.log('='.repeat(70));

  console.log('\n📊 BREAKDOWN SUMMARY:');
  console.log('-'.repeat(70));
  console.log(`  Adjusted Revenue:        ${adjustedRevenue.toLocaleString().padStart(15)} 원`);
  console.log(`  - Purchase Cost:         ${totalCost.toLocaleString().padStart(15)} 원`);
  console.log(`  ─────────────────────────────────────`);
  console.log(`  = Gross Profit:          ${grossProfit.toLocaleString().padStart(15)} 원`);
  console.log(`  - Sales Commission:      ${salesCommission.toLocaleString().padStart(15)} 원`);
  console.log(`  - Survey Costs:          ${surveyCosts.toLocaleString().padStart(15)} 원`);
  console.log(`  - Installation Cost:     ${totalBaseInstallationCost.toLocaleString().padStart(15)} 원`);
  console.log(`  ─────────────────────────────────────`);
  console.log(`  = Net Profit:            ${netProfit.toLocaleString().padStart(15)} 원`);

  if (netProfit < 0) {
    console.log('\n⚠️  NEGATIVE PROFIT ANALYSIS:');
    console.log('-'.repeat(70));

    if (adjustedRevenue === 0) {
      console.log('  ❌ No revenue recorded (total_revenue = 0)');
    }

    if (salesCommission > 0 && adjustedRevenue > 0) {
      const commissionPercent = ((salesCommission / adjustedRevenue) * 100).toFixed(2);
      console.log(`  💸 Sales commission (${commissionPercent}% of revenue): -${salesCommission.toLocaleString()} 원`);
    } else if (salesCommission > 0) {
      console.log(`  💸 Sales commission deducted despite zero revenue: -${salesCommission.toLocaleString()} 원`);
    }

    if (surveyCosts > 0) {
      console.log(`  📋 Survey costs deducted: -${surveyCosts.toLocaleString()} 원`);
    }

    if (totalBaseInstallationCost > 0) {
      console.log(`  🔧 Installation costs deducted: -${totalBaseInstallationCost.toLocaleString()} 원`);
    }

    if (additionalCost > 0) {
      console.log(`  ⚠️  additional_cost (${additionalCost.toLocaleString()} 원) is ADDED to revenue`);
      console.log(`      This increases commission but appears to be a cost field`);
    }
  }

  console.log('\n');
}

calculateProfit();
