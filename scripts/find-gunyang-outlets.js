// 건양 배출구 구조 확인을 위한 Google Sheets 직접 접근
const fetch = require('node-fetch');

async function findGunyangOutlets() {
  try {
    console.log('🔍 건양 배출구 구조 확인 중...');
    
    // 전체 시트에서 건양 관련 모든 행 찾기
    const response = await fetch('http://localhost:3001/api/import-all-facilities', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        dryRun: true,
        debug: true,
        searchBusiness: '건양'
      })
    });
    
    const result = await response.json();
    
    if (result.success) {
      console.log('✅ 건양 검색 결과:', result.data);
    } else {
      console.error('❌ 검색 실패:', result.message);
    }
    
  } catch (error) {
    console.error('❌ 오류:', error);
  }
}

findGunyangOutlets();