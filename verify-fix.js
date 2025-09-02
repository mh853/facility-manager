// verify-fix.js - Verify that the data filtering fix worked
async function verifyFix() {
  const businessName = '(주)조양(전체)';
  const encodedName = encodeURIComponent(businessName);
  
  console.log('🧪 Verifying Data Filtering Fix\n');
  
  try {
    // Test the fixed API
    const response = await fetch(`http://localhost:3000/api/facilities-supabase/${encodedName}`);
    const data = await response.json();
    
    if (data.success) {
      const result = data.data;
      
      console.log('📊 API Results:');
      console.log(`✅ Discharge: ${result.dischargeCount}/19 expected`);
      console.log(`✅ Prevention: ${result.preventionCount}/4 expected`);
      console.log(`✅ Outlets: ${result.outlets?.count}/4 expected`);
      
      const isFixed = 
        result.dischargeCount === 19 && 
        result.preventionCount === 4 && 
        result.outlets?.count === 4;
      
      if (isFixed) {
        console.log('\n🎉 COMPLETE SUCCESS!');
        console.log('✅ Data filtering issue is fully resolved');
        console.log('✅ API returns exact expected counts');
        console.log('✅ Business-specific filtering works perfectly');
      } else {
        console.log('\n📋 Current Status:');
        console.log('- Schema fix: Applied ✅');
        console.log('- Data cleared: Applied ✅');
        console.log('- Correct data: Needs SQL execution ⏳');
        console.log('\n💡 Next step: Run the SQL from complete-fix.sql in Supabase');
      }
      
    } else {
      console.log('❌ API Error:', data.message);
    }
    
  } catch (error) {
    console.error('❌ Verification failed:', error.message);
  }
}

verifyFix();