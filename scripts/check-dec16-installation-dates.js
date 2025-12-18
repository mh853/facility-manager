/**
 * 2025-12-16으로 계산된 데이터의 실제 설치일 확인
 */

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function checkDec16InstallationDates() {
  console.log('🔍 2025-12-16 계산 데이터의 설치일 분석\n');

  try {
    // 1. 2025-12-16으로 계산된 데이터 조회
    const { data: calculations, error: calcError } = await supabase
      .from('revenue_calculations')
      .select('id, business_id, calculation_date, created_at')
      .eq('calculation_date', '2025-12-16');

    if (calcError) {
      throw new Error(`계산 데이터 조회 실패: ${calcError.message}`);
    }

    console.log(`📊 2025-12-16으로 계산된 데이터: ${calculations.length}건\n`);

    // 2. 각 사업장의 설치일 확인
    console.log('🏢 사업장별 설치일 확인 중...\n');

    let noInstallDate = 0;
    let correctDate = 0;
    let wrongDate = 0;
    const installDateDistribution = {};

    for (const calc of calculations) {
      const { data: business, error: bizError } = await supabase
        .from('business_info')
        .select('id, business_name, installation_date, completion_date, project_year')
        .eq('id', calc.business_id)
        .single();

      if (bizError || !business) {
        console.log(`   ❌ ${calc.business_id}: 사업장 정보 없음`);
        continue;
      }

      const installDate = business.completion_date || business.installation_date;

      if (!installDate) {
        noInstallDate++;
        console.log(`   ⚠️ ${business.business_name}: 설치일 정보 없음 (project_year: ${business.project_year})`);
      } else if (installDate === '2025-12-16') {
        correctDate++;
        // 올바른 경우는 출력하지 않음
      } else {
        wrongDate++;
        console.log(`   ❌ ${business.business_name}: 설치일 ${installDate} ≠ 계산일 2025-12-16`);

        // 월별 분포
        const month = installDate.substring(0, 7);
        installDateDistribution[month] = (installDateDistribution[month] || 0) + 1;
      }
    }

    // 3. 결과 요약
    console.log('\n' + '='.repeat(60));
    console.log('📊 분석 결과\n');
    console.log(`총 ${calculations.length}건 중:`);
    console.log(`   ✅ 올바른 날짜 (12/16에 실제 설치): ${correctDate}건`);
    console.log(`   ❌ 잘못된 날짜 (다른 날 설치): ${wrongDate}건`);
    console.log(`   ⚠️ 설치일 정보 없음: ${noInstallDate}건`);
    console.log('='.repeat(60));

    if (wrongDate > 0) {
      console.log('\n📅 잘못된 날짜의 실제 설치월 분포:');
      Object.entries(installDateDistribution)
        .sort((a, b) => a[0].localeCompare(b[0]))
        .forEach(([month, count]) => {
          const bar = '█'.repeat(Math.min(count / 5, 50));
          console.log(`   ${month}: ${count.toString().padStart(3)}건 ${bar}`);
        });
    }

    // 4. 권장 조치
    console.log('\n💡 권장 조치:\n');

    if (noInstallDate > 0) {
      console.log(`1. 설치일 없는 ${noInstallDate}건:`);
      console.log('   → 사업장 정보에 설치일 입력 후 재계산\n');
    }

    if (wrongDate > 0) {
      console.log(`2. 잘못된 날짜 ${wrongDate}건:`);
      console.log('   → 재계산 스크립트 실행 필요');
      console.log('   → node scripts/fix-revenue-calculation-dates.js\n');
    }

    if (correctDate === calculations.length) {
      console.log('✅ 모든 데이터가 올바르게 설정되어 있습니다!');
    }

  } catch (error) {
    console.error('❌ 오류 발생:', error);
    process.exit(1);
  }
}

checkDec16InstallationDates()
  .then(() => {
    console.log('\n✅ 분석 완료');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ 분석 실패:', error);
    process.exit(1);
  });
