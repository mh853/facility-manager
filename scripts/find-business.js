const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function findBusiness() {
  console.log('🔍 Searching for (주)공담 C동 business...\n');

  const { data, error } = await supabase
    .from('business_info')
    .select('*')
    .ilike('business_name', '%공담%C동%')
    .eq('is_deleted', false);

  if (error) {
    console.error('❌ Error:', error);
    return;
  }

  if (data && data.length > 0) {
    const business = data[0];

    // Extract key financial fields
    console.log('📊 Business Data for:', business.business_name);
    console.log('=====================================\n');

    console.log('💰 Revenue Fields:');
    console.log('  - total_revenue:', business.total_revenue || 0);
    console.log('  - additional_cost:', business.additional_cost || 0);
    console.log('  - additional_installation_revenue:', business.additional_installation_revenue || 0);
    console.log('  - negotiation:', business.negotiation || 0);

    console.log('\n💸 Cost Fields:');
    console.log('  - total_cost:', business.total_cost || 0);
    console.log('  - total_base_installation_cost:', business.total_base_installation_cost || 0);

    console.log('\n🏢 Sales Office:');
    console.log('  - sales_office:', business.sales_office || 'Not set');

    console.log('\n📅 Survey Dates:');
    console.log('  - estimate_survey_date:', business.estimate_survey_date || 'None');
    console.log('  - pre_construction_survey_date:', business.pre_construction_survey_date || 'None');
    console.log('  - completion_survey_date:', business.completion_survey_date || 'None');

    console.log('\n📋 Equipment Quantities:');
    const equipmentFields = [
      'local_suction_facility',
      'complete_enclosure_facility',
      'tank_suction_facility',
      'sanding_facility',
      'high_speed_rotation_facility',
      'installation_facility',
      'other_facility'
    ];

    equipmentFields.forEach(field => {
      if (business[field]) {
        console.log(`  - ${field}: ${business[field]}`);
      }
    });

    console.log('\n📄 Full Business Data:');
    console.log(JSON.stringify(business, null, 2));
  } else {
    console.log('❌ Business not found - trying alternative search...\n');

    // Try broader search
    const { data: allData, error: allError } = await supabase
      .from('business_info')
      .select('business_name')
      .eq('is_deleted', false)
      .order('business_name');

    if (allData) {
      console.log('📋 Available businesses containing "공담":');
      const filtered = allData.filter(b => b.business_name && b.business_name.includes('공담'));
      filtered.forEach(b => console.log('  -', b.business_name));
    }
  }
}

findBusiness();
