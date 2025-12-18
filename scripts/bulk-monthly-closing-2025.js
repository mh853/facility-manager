#!/usr/bin/env node

/**
 * 2025년 전체 월마감 자동 계산 스크립트
 *
 * 사용법:
 * 1. 브라우저에서 /admin/monthly-closing 페이지 접속
 * 2. 브라우저 개발자 도구 (F12) 열기
 * 3. Console 탭에서 이 스크립트 복사 후 실행
 *
 * 또는 Node.js로 직접 실행:
 * node scripts/bulk-monthly-closing-2025.js
 */

async function calculateMonthlyClosing(year, month, token) {
  const response = await fetch('/api/admin/monthly-closing/auto-calculate', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ year, month })
  });

  return await response.json();
}

async function bulkCalculate2025() {
  // 브라우저에서 실행할 경우 localStorage에서 토큰 가져오기
  const token = typeof window !== 'undefined'
    ? localStorage.getItem('token')
    : process.env.AUTH_TOKEN;

  if (!token) {
    console.error('❌ 인증 토큰이 없습니다. 먼저 로그인해주세요.');
    return;
  }

  console.log('🚀 2025년 전체 월마감 자동 계산 시작...\n');

  const results = {
    success: [],
    failed: [],
    warnings: []
  };

  // 1월부터 12월까지 순차 실행
  for (let month = 1; month <= 12; month++) {
    console.log(`📅 ${month}월 계산 중...`);

    try {
      const result = await calculateMonthlyClosing(2025, month, token);

      if (result.success) {
        const data = result.data;
        console.log(`  ✅ 완료: ${data.calculatedBusinesses}개 성공, ${data.failedBusinesses}개 실패`);

        if (result.warning) {
          console.log(`  ⚠️  ${result.warning}`);
          results.warnings.push({ month, warning: result.warning });
        }

        results.success.push({
          month,
          calculated: data.calculatedBusinesses,
          failed: data.failedBusinesses
        });
      } else {
        console.log(`  ❌ 실패: ${result.message}`);
        results.failed.push({ month, error: result.message });
      }
    } catch (error) {
      console.log(`  ❌ 오류: ${error.message}`);
      results.failed.push({ month, error: error.message });
    }

    // 서버 부하 방지를 위해 1초 대기
    await new Promise(resolve => setTimeout(resolve, 1000));
  }

  // 최종 결과 요약
  console.log('\n' + '='.repeat(60));
  console.log('📊 2025년 월마감 계산 완료\n');
  console.log(`✅ 성공: ${results.success.length}개월`);
  console.log(`❌ 실패: ${results.failed.length}개월`);
  console.log(`⚠️  경고: ${results.warnings.length}개월`);

  if (results.failed.length > 0) {
    console.log('\n실패한 월:');
    results.failed.forEach(({ month, error }) => {
      console.log(`  - ${month}월: ${error}`);
    });
  }

  if (results.warnings.length > 0) {
    console.log('\n경고가 있는 월:');
    results.warnings.forEach(({ month, warning }) => {
      console.log(`  - ${month}월: ${warning}`);
    });
  }

  console.log('\n페이지를 새로고침하여 결과를 확인하세요.');
  console.log('='.repeat(60));

  return results;
}

// Node.js 환경에서 실행할 경우
if (typeof window === 'undefined') {
  console.log('⚠️  이 스크립트는 브라우저 콘솔에서 실행해야 합니다.');
  console.log('또는 환경변수 AUTH_TOKEN을 설정하고 API 엔드포인트를 수정하세요.\n');
} else {
  // 브라우저에서 실행할 경우 전역 함수로 등록
  window.bulkCalculate2025 = bulkCalculate2025;
  console.log('✅ 스크립트 로드 완료!');
  console.log('실행하려면: bulkCalculate2025()');
}
