// investigate-schema.js - Check actual database schema
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

// Load environment variables
const envContent = fs.readFileSync('.env.local', 'utf8');
const env = {};
envContent.split('\n').forEach(line => {
  const [key, ...values] = line.split('=');
  if (key && values.length) {
    env[key.trim()] = values.join('=').trim().replace(/^["']|["']$/g, '');
  }
});

async function investigateSchema() {
  const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false }
  });

  console.log('🔍 Investigating actual database schema...\n');
  
  try {
    // Get sample records to understand actual schema
    const { data: dischargeSample } = await supabase
      .from('discharge_facilities')
      .select('*')
      .limit(2);
    
    const { data: preventionSample } = await supabase
      .from('prevention_facilities')
      .select('*')
      .limit(2);
    
    console.log('📊 Discharge Facilities Schema:');
    if (dischargeSample && dischargeSample.length > 0) {
      const sample = dischargeSample[0];
      console.log('Columns found:');
      Object.keys(sample).forEach(key => {
        const value = sample[key];
        const type = typeof value;
        console.log(`  - ${key}: ${type} = ${JSON.stringify(value)}`);
      });
    }
    
    console.log('\n📊 Prevention Facilities Schema:');
    if (preventionSample && preventionSample.length > 0) {
      const sample = preventionSample[0];
      console.log('Columns found:');
      Object.keys(sample).forEach(key => {
        const value = sample[key];
        const type = typeof value;
        console.log(`  - ${key}: ${type} = ${JSON.stringify(value)}`);
      });
    }

    // Check if there are outlet records
    const { data: outlets } = await supabase
      .from('outlets')
      .select('*')
      .limit(5)
      .catch(() => ({ data: null }));
    
    if (outlets) {
      console.log('\n📍 Outlets Table Found:');
      outlets.forEach(outlet => {
        console.log(`  - ID: ${outlet.id}, Business: ${outlet.business_name || outlet.business_id}, Number: ${outlet.outlet_number || outlet.number}`);
      });
    } else {
      console.log('\n❌ No outlets table found or accessible');
    }

    // Try to understand the relationship
    console.log('\n🔗 Relationship Analysis:');
    if (dischargeSample && dischargeSample.length > 0) {
      const sample = dischargeSample[0];
      if (sample.outlet_id) {
        const { data: relatedOutlet } = await supabase
          .from('outlets')
          .select('*')
          .eq('id', sample.outlet_id)
          .single()
          .catch(() => ({ data: null }));
        
        if (relatedOutlet) {
          console.log('✅ Found related outlet:', relatedOutlet);
        } else {
          console.log('❌ No related outlet found for outlet_id:', sample.outlet_id);
        }
      }
    }

  } catch (error) {
    console.error('❌ Schema investigation failed:', error.message);
  }
}

investigateSchema().catch(console.error);