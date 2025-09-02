// api-test-after-fix.js - Test API after applying the fix
async function testAPIAfterFix() {
  const businessName = '(주)조양(전체)';
  const encodedName = encodeURIComponent(businessName);
  
  console.log('🧪 Testing API after fix...\n');
  console.log('🏭 Business:', businessName);
  console.log('🔗 URL-encoded:', encodedName);
  
  try {
    const url = `http://localhost:3000/api/facilities-supabase/${encodedName}`;
    console.log('\n📡 Calling API:', url);
    
    const response = await fetch(url);
    console.log('📊 Response status:', response.status);
    
    if (!response.ok) {
      const text = await response.text();
      console.log('❌ Error response:', text.substring(0, 200));
      return;
    }
    
    const data = await response.json();
    
    if (data.success) {
      const result = data.data;
      console.log('\n✅ API Response Success:');
      console.log(`- Discharge facilities: ${result.dischargeCount} (expected: 19)`);
      console.log(`- Prevention facilities: ${result.preventionCount} (expected: 4)`);
      console.log(`- Outlets: ${result.outlets?.count || 0} (expected: 4)`);
      console.log(`- Processing time: ${result.processingTime}ms`);
      
      if (result.outlets?.outlets) {
        console.log(`- Outlet numbers: [${result.outlets.outlets.join(', ')}]`);
      }
      
      // Show sample facilities
      if (result.facilities?.discharge?.length > 0) {
        console.log('\n📋 Sample Discharge Facilities:');
        result.facilities.discharge.slice(0, 3).forEach(f => {
          console.log(`  - ${f.displayName}: ${f.name} (${f.capacity})`);
        });
      }
      
      if (result.facilities?.prevention?.length > 0) {
        console.log('\n📋 Sample Prevention Facilities:');
        result.facilities.prevention.slice(0, 3).forEach(f => {
          console.log(`  - ${f.displayName}: ${f.name} (${f.capacity})`);
        });
      }
      
      // Success criteria
      const isFixed = 
        result.dischargeCount === 19 && 
        result.preventionCount === 4 && 
        result.outlets?.count === 4;
      
      if (isFixed) {
        console.log('\n🎉 PERFECT SUCCESS: Data filtering issue is COMPLETELY FIXED!');
        console.log('✅ All counts match expected values');
        console.log('✅ Business-specific filtering works correctly');
        console.log('✅ API performance should be optimal');
      } else {
        console.log('\n⚠️ PARTIAL SUCCESS: Improvement made but not perfect');
        console.log('Expected: 19 discharge + 4 prevention + 4 outlets');
        console.log(`Actual: ${result.dischargeCount} discharge + ${result.preventionCount} prevention + ${result.outlets?.count || 0} outlets`);
      }
      
    } else {
      console.log('❌ API returned error:', data.message);
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

// Run the test
testAPIAfterFix();