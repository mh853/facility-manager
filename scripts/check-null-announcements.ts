#!/usr/bin/env tsx

/**
 * 신청기간, 예산 정보가 NULL인 공고 확인
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !serviceRoleKey) {
  console.error('❌ 오류: SUPABASE_URL 또는 SERVICE_ROLE_KEY가 설정되지 않았습니다.');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey);

async function checkNullAnnouncements() {
  console.log('🔍 공고 데이터 분석 시작...\n');

  // 1. 전체 공고 개수
  const { count: totalCount } = await supabase
    .from('subsidy_announcements')
    .select('*', { count: 'exact', head: true });

  console.log(`📊 전체 공고: ${totalCount}개\n`);

  // 2. NULL 값이 있는 공고 개수
  const { data: nullAnnouncements, count: nullCount } = await supabase
    .from('subsidy_announcements')
    .select('id, title, region_name, application_period_start, application_period_end, budget', { count: 'exact' })
    .or('application_period_start.is.null,application_period_end.is.null,budget.is.null');

  console.log(`⚠️  NULL 값이 있는 공고: ${nullCount}개\n`);

  if (nullAnnouncements && nullAnnouncements.length > 0) {
    console.log('상세 내역:');
    console.log('──────────────────────────────────────────────');

    nullAnnouncements.slice(0, 10).forEach((ann, idx) => {
      console.log(`\n${idx + 1}. ${ann.title}`);
      console.log(`   지자체: ${ann.region_name}`);
      console.log(`   신청기간 시작: ${ann.application_period_start || 'NULL'}`);
      console.log(`   신청기간 종료: ${ann.application_period_end || 'NULL'}`);
      console.log(`   예산: ${ann.budget || 'NULL'}`);
    });

    if (nullAnnouncements.length > 10) {
      console.log(`\n... 외 ${nullAnnouncements.length - 10}개 더`);
    }
  }

  // 3. 계룡시 공고 확인
  console.log('\n\n🔍 계룡시 공고 확인:');
  console.log('──────────────────────────────────────────────');

  const { data: gyeryongAnnouncements } = await supabase
    .from('subsidy_announcements')
    .select('id, title, application_period_start, application_period_end, budget')
    .eq('region_name', '계룡시');

  if (gyeryongAnnouncements && gyeryongAnnouncements.length > 0) {
    gyeryongAnnouncements.forEach((ann, idx) => {
      console.log(`\n${idx + 1}. ${ann.title}`);
      console.log(`   신청기간 시작: ${ann.application_period_start || 'NULL'}`);
      console.log(`   신청기간 종료: ${ann.application_period_end || 'NULL'}`);
      console.log(`   예산: ${ann.budget || 'NULL'}`);
    });
  } else {
    console.log('계룡시 공고가 없습니다.');
  }

  // 4. 통계 요약
  console.log('\n\n📈 통계 요약:');
  console.log('──────────────────────────────────────────────');
  console.log(`전체 공고: ${totalCount}개`);
  console.log(`NULL 있는 공고: ${nullCount}개 (${nullCount && totalCount ? ((nullCount / totalCount) * 100).toFixed(1) : 0}%)`);
  console.log(`완료된 공고: ${totalCount && nullCount ? totalCount - nullCount : 0}개`);
}

checkNullAnnouncements()
  .then(() => {
    console.log('\n✅ 분석 완료');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ 분석 실패:', error);
    process.exit(1);
  });
