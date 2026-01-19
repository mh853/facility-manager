// scripts/verify-date-filtering.js
// 날짜 필터링 로직 차이 검증

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() || '';

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function verifyDateFiltering() {
  console.log('🔍 날짜 필터링 로직 차이 검증\n');

  // 1. 대시보드 방식: 2025-07-01 ~ 2025-07-31 (연도 + 월)
  const { data: dashboardData, error: dashboardError } = await supabase
    .from('business_info')
    .select('*')
    .eq('is_active', true)
    .eq('is_deleted', false)
    .not('installation_date', 'is', null)
    .gte('installation_date', '2025-07-01')
    .lte('installation_date', '2025-07-31');

  if (dashboardError) {
    console.error('❌ 대시보드 쿼리 실패:', dashboardError);
    return;
  }

  console.log('📊 대시보드 방식 (2025-07-01 ~ 2025-07-31):');
  console.log(`   총 사업장: ${dashboardData.length}개`);
  console.log(`   설치일 범위: ${dashboardData.map(b => b.installation_date).sort()[0]} ~ ${dashboardData.map(b => b.installation_date).sort().reverse()[0]}`);

  // 2. 매출 관리 방식: 모든 7월 (연도 무시)
  const { data: allData, error: allError } = await supabase
    .from('business_info')
    .select('*')
    .eq('is_active', true)
    .eq('is_deleted', false)
    .not('installation_date', 'is', null);

  if (allError) {
    console.error('❌ 전체 쿼리 실패:', allError);
    return;
  }

  // 클라이언트에서 월 필터링 (매출 관리 페이지와 동일)
  const revenuePageData = allData.filter(business => {
    const installDate = business.installation_date;
    if (installDate) {
      const date = new Date(installDate);
      const month = date.getMonth() + 1; // 1-12
      return month === 7; // 7월만
    }
    return false;
  });

  console.log('\n💰 매출 관리 방식 (모든 연도의 7월):');
  console.log(`   총 사업장: ${revenuePageData.length}개`);

  // 연도별 분포
  const yearCounts = {};
  revenuePageData.forEach(b => {
    const year = new Date(b.installation_date).getFullYear();
    yearCounts[year] = (yearCounts[year] || 0) + 1;
  });
  console.log(`   연도별 분포:`, yearCounts);

  // 3. 차이 분석
  console.log('\n📊 차이 분석:');
  console.log(`   대시보드: ${dashboardData.length}개 사업장`);
  console.log(`   매출 관리: ${revenuePageData.length}개 사업장`);
  console.log(`   차이: ${revenuePageData.length - dashboardData.length}개 (매출 관리가 더 많음)`);

  // 4. 매출 관리에만 포함된 사업장 확인 (다른 연도의 7월)
  const otherYearsJuly = revenuePageData.filter(b => {
    const year = new Date(b.installation_date).getFullYear();
    return year !== 2025;
  });

  console.log(`\n🔍 다른 연도의 7월 설치 사업장: ${otherYearsJuly.length}개`);
  if (otherYearsJuly.length > 0) {
    console.log('   샘플 (처음 5개):');
    otherYearsJuly.slice(0, 5).forEach(b => {
      console.log(`   - ${b.business_name}: ${b.installation_date}`);
    });
  }
}

verifyDateFiltering().catch(console.error);
