#!/usr/bin/env tsx

/**
 * API 단일 URL 테스트
 */

const TEST_URL = 'https://gyeryong.go.kr/kr/html/sub03/030102.html?skey=sj&sval=%EB%B0%A9%EC%A7%80%EC%8B%9C%EC%84%A4';

async function testApiSingleUrl() {
  console.log('🧪 API 단일 URL 테스트\n');
  console.log(`📍 URL: ${TEST_URL}\n`);

  try {
    const response = await fetch('http://localhost:3000/api/subsidy-crawler/direct', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        urls: [TEST_URL],
        direct_mode: true,
      }),
    });

    console.log(`📊 상태 코드: ${response.status} ${response.statusText}\n`);

    const result = await response.json();

    console.log('════════════════════════════════════════');
    console.log('📊 API 응답');
    console.log('════════════════════════════════════════');
    console.log(JSON.stringify(result, null, 2));

  } catch (error: any) {
    console.error('❌ 테스트 실패:', error.message);
    process.exit(1);
  }
}

testApiSingleUrl();
