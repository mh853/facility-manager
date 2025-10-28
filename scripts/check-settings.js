const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkSettings() {
  console.log('🔍 Checking Sales Office and Survey Cost Settings\n');

  // Check sales office settings
  const { data: salesOfficeSettings, error: salesError } = await supabase
    .from('sales_office_settings')
    .select('*');

  console.log('📊 Sales Office Settings:');
  console.log('======================================================================');
  if (salesError) {
    console.error('❌ Error:', salesError.message);
  } else if (!salesOfficeSettings || salesOfficeSettings.length === 0) {
    console.log('⚠️  No sales office settings found in database');
  } else {
    salesOfficeSettings.forEach(setting => {
      console.log(`\n  Sales Office: "${setting.sales_office}"`);
      console.log(`    - Commission Type: ${setting.commission_type}`);
      if (setting.commission_type === 'percentage') {
        console.log(`    - Commission Rate: ${setting.commission_percentage}%`);
      } else if (setting.commission_type === 'per_unit') {
        console.log(`    - Commission Per Unit: ${setting.commission_per_unit.toLocaleString()} 원`);
      }
    });
  }

  // Check survey cost settings
  const { data: surveyCostSettings, error: surveyError } = await supabase
    .from('survey_cost_settings')
    .select('*');

  console.log('\n\n📊 Survey Cost Settings:');
  console.log('======================================================================');
  if (surveyError) {
    console.error('❌ Error:', surveyError.message);
  } else if (!surveyCostSettings || surveyCostSettings.length === 0) {
    console.log('⚠️  No survey cost settings found in database');
  } else {
    surveyCostSettings.forEach(setting => {
      console.log(`  ${setting.survey_type}: ${setting.cost.toLocaleString()} 원`);
    });
  }

  // Check if "블루온" exists in settings
  console.log('\n\n🔍 Checking for "블루온" office:');
  console.log('======================================================================');
  if (salesOfficeSettings && salesOfficeSettings.length > 0) {
    const blueOn = salesOfficeSettings.find(s => s.sales_office === '블루온');
    if (blueOn) {
      console.log('✅ Found "블루온" in settings:');
      console.log(`    - Commission Type: ${blueOn.commission_type}`);
      if (blueOn.commission_type === 'percentage') {
        console.log(`    - Commission Rate: ${blueOn.commission_percentage}%`);
      } else if (blueOn.commission_type === 'per_unit') {
        console.log(`    - Commission Per Unit: ${blueOn.commission_per_unit.toLocaleString()} 원`);
      }
    } else {
      console.log('❌ "블루온" NOT found in settings - will use default 10%');
      console.log('\n  Available offices:');
      salesOfficeSettings.forEach(s => console.log(`    - "${s.sales_office}"`));
    }
  }

  console.log('\n');
}

checkSettings();
