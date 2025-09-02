const https = require('http');

console.log('🔍 포트 3008에서 실제 상태 확인...\n');

// 1. 사업장 목록 확인
https.get('http://localhost:3008/api/business-list', (res) => {
  let data = '';
  res.on('data', (chunk) => data += chunk);
  res.on('end', () => {
    try {
      const businessList = JSON.parse(data);
      console.log('=== 사업장 목록 API (포트 3008) ===');
      
      if (businessList.data && businessList.data.businesses) {
        console.log(`사업장 수: ${businessList.data.businesses.length}개`);
        console.log(`샘플: ${businessList.data.businesses.slice(0, 3).join(', ')}`);
      } else {
        console.log('❌ 사업장 데이터를 찾을 수 없음');
        console.log('응답 구조:', Object.keys(businessList));
      }
      
      // 2. 시설 통계 확인
      https.get('http://localhost:3008/api/facility-stats', (res2) => {
        let data2 = '';
        res2.on('data', (chunk) => data2 += chunk);
        res2.on('end', () => {
          try {
            const stats = JSON.parse(data2);
            
            console.log('\n=== 시설 통계 API (포트 3008) ===');
            console.log(`총 사업장: ${stats.data.totalBusinesses}개`);
            console.log(`총 배출시설: ${stats.data.totalDischarge}개`);
            console.log(`총 방지시설: ${stats.data.totalPrevention}개`);
            
            console.log('\n배출구별 배출시설 분포:');
            [1,2,3,4].forEach(outlet => {
              const dist = stats.data.outletDistribution[outlet];
              if (dist) {
                console.log(`  배출구 ${outlet}: ${dist.discharge}개`);
              }
            });
            
            // 문제 진단
            console.log('\n=== 문제 진단 ===');
            const businessCount = businessList.data?.businesses?.length || 0;
            const statsBusinessCount = stats.data.totalBusinesses;
            const totalFacilities = stats.data.totalDischarge + stats.data.totalPrevention;
            
            console.log(`UI 사업장 수: ${businessCount}개`);
            console.log(`DB 사업장 수: ${statsBusinessCount}개`);
            console.log(`총 시설 수: ${totalFacilities}개`);
            
            if (totalFacilities === 0) {
              console.log('\n❌ 치명적 문제: 모든 시설 데이터가 비어있음');
              console.log('   Supabase 테이블이 비어있거나 연결 문제 발생');
            } else if (stats.data.outletDistribution['2']?.discharge === 0) {
              console.log('\n⚠️  부분적 문제: 배출구 2,3,4에 배출시설 없음');
            } else {
              console.log('\n✅ 정상: 배출구별로 데이터 분산됨');
            }
            
          } catch (e) {
            console.log('❌ 시설 통계 API 파싱 오류:', e.message);
          }
        });
      }).on('error', (err) => {
        console.error('❌ 시설 통계 API 오류:', err.message);
      });
      
    } catch (e) {
      console.log('❌ 사업장 목록 API 파싱 오류:', e.message);
    }
  });
}).on('error', (err) => {
  console.error('❌ 사업장 목록 API 오류:', err.message);
});