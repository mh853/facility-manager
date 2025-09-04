// Step-by-step measurement device update
const stepUpdate = async () => {
  try {
    console.log('🔄 Step-by-step measurement device update...');
    
    // Update (주)조양(방1,2,3) - avoid multiple_stack > 1
    console.log('\n🏢 Updating (주)조양(방1,2,3)...');
    const response1 = await fetch('http://localhost:3003/api/business-info-direct', {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        id: '33b8d961-47f1-4906-8919-dc2db24b5e6f',
        updateData: {
          ph_meter: 1,
          differential_pressure_meter: 2,
          temperature_meter: 1,
          discharge_current_meter: 2,
          fan_current_meter: 1,
          pump_current_meter: 1,
          gateway: 1,
          vpn_wired: 1,
          vpn_wireless: 0,
          multiple_stack: 1
        }
      })
    });
    
    const result1 = await response1.json();
    console.log('Result1:', result1.success ? '✅ 성공' : `❌ 실패: ${result1.message}`);
    
    // Update (주)조양(전체) - avoid multiple_stack > 1
    console.log('\n🏢 Updating (주)조양(전체)...');
    const response2 = await fetch('http://localhost:3003/api/business-info-direct', {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        id: '060fcb98-be7f-4b9b-b069-794aa00813e8',
        updateData: {
          ph_meter: 2,
          differential_pressure_meter: 3,
          temperature_meter: 2,
          discharge_current_meter: 4,
          fan_current_meter: 2,
          pump_current_meter: 1,
          gateway: 2,
          vpn_wired: 1,
          vpn_wireless: 1,
          multiple_stack: 1
        }
      })
    });
    
    const result2 = await response2.json();
    console.log('Result2:', result2.success ? '✅ 성공' : `❌ 실패: ${result2.message}`);
    
  } catch (error) {
    console.error('❌ Step update failed:', error.message);
  }
};

stepUpdate();