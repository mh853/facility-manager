/**
 * 매출 계산일 현황 확인 스크립트
 */

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function checkRevenueDates() {
  console.log('🔍 매출 계산일 현황 분석\n');

  try {
    // 1. 전체 매출 계산 데이터 조회
    const { data: allCalcs, error: allError } = await supabase
      .from('revenue_calculations')
      .select('id, business_id, calculation_date')
      .order('calculation_date', { ascending: false });

    if (allError) {
      throw new Error(`데이터 조회 실패: ${allError.message}`);
    }

    console.log(`📊 전체 매출 계산 데이터: ${allCalcs.length}건\n`);

    // 2. 날짜별 분포 분석
    const dateDistribution = allCalcs.reduce((acc, calc) => {
      const date = calc.calculation_date;
      acc[date] = (acc[date] || 0) + 1;
      return acc;
    }, {});

    console.log('📅 날짜별 분포 (최근 20개):');
    const sortedDates = Object.entries(dateDistribution)
      .sort((a, b) => b[0].localeCompare(a[0]))
      .slice(0, 20);

    sortedDates.forEach(([date, count]) => {
      const bar = '█'.repeat(Math.min(count / 5, 50));
      console.log(`   ${date}: ${count.toString().padStart(4)}건 ${bar}`);
    });

    // 3. 월별 집계
    console.log('\n📊 월별 집계:');
    const monthlyDistribution = allCalcs.reduce((acc, calc) => {
      const month = calc.calculation_date.substring(0, 7); // YYYY-MM
      acc[month] = (acc[month] || 0) + 1;
      return acc;
    }, {});

    Object.entries(monthlyDistribution)
      .sort((a, b) => b[0].localeCompare(a[0]))
      .slice(0, 12)
      .forEach(([month, count]) => {
        const bar = '█'.repeat(Math.min(count / 10, 50));
        console.log(`   ${month}: ${count.toString().padStart(4)}건 ${bar}`);
      });

    // 4. 2024-12-16 데이터 확인
    console.log('\n🔍 2024-12-16 데이터 상세 확인:');
    const dec16Count = dateDistribution['2024-12-16'] || 0;
    console.log(`   계산일이 2024-12-16인 데이터: ${dec16Count}건`);

    if (dec16Count > 0) {
      const { data: dec16Data, error: dec16Error } = await supabase
        .from('revenue_calculations')
        .select('id, business_id, calculation_date, created_at')
        .eq('calculation_date', '2024-12-16')
        .order('created_at', { ascending: false })
        .limit(10);

      if (!dec16Error && dec16Data) {
        console.log('\n   최근 10건 샘플:');
        dec16Data.forEach(calc => {
          console.log(`      ID: ${calc.id}, 생성일: ${calc.created_at}`);
        });
      }
    }

    // 5. 12월 전체 데이터 확인
    console.log('\n📅 2024년 12월 전체 데이터:');
    const decemberData = allCalcs.filter(calc =>
      calc.calculation_date >= '2024-12-01' && calc.calculation_date < '2025-01-01'
    );
    console.log(`   총 ${decemberData.length}건`);

    // 날짜별 상세
    const decDist = decemberData.reduce((acc, calc) => {
      acc[calc.calculation_date] = (acc[calc.calculation_date] || 0) + 1;
      return acc;
    }, {});

    console.log('   날짜별 분포:');
    Object.entries(decDist)
      .sort((a, b) => a[0].localeCompare(b[0]))
      .forEach(([date, count]) => {
        console.log(`      ${date}: ${count}건`);
      });

    // 6. 최근 생성된 데이터 확인
    console.log('\n🕐 최근 생성된 계산 데이터 (최근 20건):');
    const recentCalcs = allCalcs
      .sort((a, b) => (b.created_at || '').localeCompare(a.created_at || ''))
      .slice(0, 20);

    const { data: recentWithCreated, error: recentError } = await supabase
      .from('revenue_calculations')
      .select('id, business_id, calculation_date, created_at')
      .order('created_at', { ascending: false })
      .limit(20);

    if (!recentError && recentWithCreated) {
      recentWithCreated.forEach(calc => {
        const createdDate = calc.created_at ? calc.created_at.split('T')[0] : 'N/A';
        console.log(`   ${createdDate} → calculation_date: ${calc.calculation_date}`);
      });
    }

    // 7. 사업장과 설치일 매칭 확인
    console.log('\n🏢 사업장 설치일 vs 계산일 비교 (샘플 10건):');
    const { data: sampleBusinesses, error: bizError } = await supabase
      .from('business_info')
      .select('id, business_name, installation_date, completion_date')
      .not('installation_date', 'is', null)
      .limit(10);

    if (!bizError && sampleBusinesses) {
      for (const biz of sampleBusinesses) {
        const { data: calc, error: calcError } = await supabase
          .from('revenue_calculations')
          .select('calculation_date')
          .eq('business_id', biz.id)
          .order('created_at', { ascending: false })
          .limit(1)
          .single();

        if (!calcError && calc) {
          const installDate = biz.completion_date || biz.installation_date;
          const match = installDate === calc.calculation_date ? '✅' : '❌';
          console.log(`   ${match} ${biz.business_name}`);
          console.log(`      설치일: ${installDate}, 계산일: ${calc.calculation_date}`);
        }
      }
    }

  } catch (error) {
    console.error('❌ 오류 발생:', error);
    process.exit(1);
  }
}

checkRevenueDates()
  .then(() => {
    console.log('\n✅ 분석 완료');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ 분석 실패:', error);
    process.exit(1);
  });
