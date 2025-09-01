// 건양 사업장 배출구 구조 확인
const fetch = require('node-fetch');

async function debugGunyang() {
  try {
    // Google Sheets에서 건양 관련 데이터 찾기
    const response = await fetch('http://localhost:3001/api/test-sheets?searchTerm=건양');
    const result = await response.json();
    
    console.log('🔍 건양 검색 결과:', JSON.stringify(result, null, 2));
    
  } catch (error) {
    console.error('❌ 오류:', error);
  }
}

debugGunyang();