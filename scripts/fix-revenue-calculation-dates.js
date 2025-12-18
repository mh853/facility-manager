/**
 * 매출 계산일 수정 스크립트
 *
 * 문제: 미계산 일괄 계산 시 모든 사업장이 현재 날짜(2024-12-16)로 계산됨
 * 해결: 각 사업장의 설치일 기준으로 재계산
 *
 * 실행 방법:
 * node scripts/fix-revenue-calculation-dates.js
 */

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function fixRevenueCalculationDates() {
  console.log('🚀 매출 계산일 수정 스크립트 시작\n');

  try {
    // 1. 문제가 있는 계산 데이터 조회 (2025-12-16으로 계산된 것들)
    console.log('1️⃣ 2025-12-16으로 계산된 사업장 조회 중...');
    const { data: calculations, error: calcError } = await supabase
      .from('revenue_calculations')
      .select('id, business_id, calculation_date')
      .eq('calculation_date', '2025-12-16');

    if (calcError) {
      throw new Error(`계산 데이터 조회 실패: ${calcError.message}`);
    }

    console.log(`   → 발견: ${calculations.length}건\n`);

    if (calculations.length === 0) {
      console.log('✅ 수정이 필요한 데이터가 없습니다.');
      return;
    }

    // 2. 각 사업장의 설치일 정보 조회 및 재계산
    console.log('2️⃣ 사업장별 설치일 기준 재계산 시작...\n');

    let successCount = 0;
    let failCount = 0;
    let skipCount = 0;
    const errors = [];

    for (const calc of calculations) {
      try {
        // 사업장 정보 조회
        const { data: business, error: bizError } = await supabase
          .from('business_info')
          .select('id, business_name, installation_date, completion_date')
          .eq('id', calc.business_id)
          .single();

        if (bizError || !business) {
          failCount++;
          errors.push(`${calc.business_id}: 사업장 정보 없음`);
          continue;
        }

        // 설치일 확인
        const correctDate = business.completion_date || business.installation_date;

        if (!correctDate) {
          skipCount++;
          console.log(`   ⏭️ ${business.business_name}: 설치일 정보 없음 (건너뜀)`);
          continue;
        }

        // 이미 올바른 날짜면 건너뛰기
        if (calc.calculation_date === correctDate) {
          skipCount++;
          continue;
        }

        // 재계산 API 호출
        const response = await fetch('http://localhost:3000/api/revenue/calculate', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`
          },
          body: JSON.stringify({
            business_id: calc.business_id,
            calculation_date: correctDate, // 올바른 설치일로 재계산
            save_result: true
          })
        });

        const result = await response.json();

        if (result.success) {
          successCount++;
          console.log(`   ✅ ${business.business_name}: ${calc.calculation_date} → ${correctDate}`);
        } else {
          failCount++;
          errors.push(`${business.business_name}: ${result.message}`);
          console.log(`   ❌ ${business.business_name}: 재계산 실패`);
        }

        // 서버 부하 방지 (100ms 대기)
        await new Promise(resolve => setTimeout(resolve, 100));

      } catch (error) {
        failCount++;
        errors.push(`${calc.business_id}: ${error.message}`);
        console.log(`   ❌ ${calc.business_id}: 오류 발생`);
      }
    }

    // 3. 결과 요약
    console.log('\n' + '='.repeat(50));
    console.log('📊 재계산 완료 결과\n');
    console.log(`✅ 성공: ${successCount}건`);
    console.log(`❌ 실패: ${failCount}건`);
    console.log(`⏭️ 건너뜀: ${skipCount}건`);
    console.log(`📋 총: ${calculations.length}건`);
    console.log('='.repeat(50));

    if (errors.length > 0) {
      console.log('\n⚠️ 오류 목록:');
      errors.forEach(err => console.log(`   - ${err}`));
    }

    // 4. 검증 쿼리
    console.log('\n🔍 검증을 위한 SQL 쿼리:');
    console.log(`
-- 월별 분포 확인
SELECT
  TO_CHAR(calculation_date, 'YYYY-MM') as month,
  COUNT(*) as count
FROM revenue_calculations
GROUP BY TO_CHAR(calculation_date, 'YYYY-MM')
ORDER BY month DESC;

-- 12월 데이터 확인
SELECT COUNT(*) as december_count
FROM revenue_calculations
WHERE calculation_date >= '2024-12-01' AND calculation_date < '2025-01-01';
    `);

  } catch (error) {
    console.error('❌ 스크립트 실행 오류:', error);
    process.exit(1);
  }
}

// 스크립트 실행
fixRevenueCalculationDates()
  .then(() => {
    console.log('\n✅ 스크립트 완료');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ 스크립트 실패:', error);
    process.exit(1);
  });
