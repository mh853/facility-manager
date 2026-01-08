#!/usr/bin/env tsx

/**
 * 기존 Direct URL 크롤링 데이터의 region_name 업데이트
 *
 * 용도: "Direct URL Source" → 실제 지자체명으로 업데이트
 * 실행: npx tsx scripts/update-direct-url-regions.ts
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';

// .env.local 로드
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !serviceRoleKey) {
  console.error('❌ 오류: SUPABASE_URL 또는 SERVICE_ROLE_KEY가 설정되지 않았습니다.');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey);

async function updateDirectUrlRegions() {
  console.log('🔄 Direct URL Source 데이터 업데이트 시작...\n');

  // 1. Direct URL Source로 저장된 공고 조회
  const { data: announcements, error: fetchError } = await supabase
    .from('subsidy_announcements')
    .select('id, source_url')
    .eq('region_name', 'Direct URL Source');

  if (fetchError) {
    console.error('❌ 공고 조회 실패:', fetchError);
    process.exit(1);
  }

  if (!announcements || announcements.length === 0) {
    console.log('✅ 업데이트할 공고가 없습니다.');
    return;
  }

  console.log(`📊 업데이트 대상: ${announcements.length}개 공고\n`);

  let successCount = 0;
  let failCount = 0;
  const regionStats: Record<string, number> = {};

  // 2. 각 공고의 source_url로 direct_url_sources에서 지자체 정보 가져와서 업데이트
  for (const announcement of announcements) {
    try {
      // source_url에서 지자체 정보 가져오기
      const { data: urlSource, error: urlError } = await supabase
        .from('direct_url_sources')
        .select('region_code, region_name')
        .eq('url', announcement.source_url)
        .single();

      if (urlError || !urlSource) {
        console.log(`⚠️  URL 정보를 찾을 수 없음: ${announcement.source_url}`);
        failCount++;
        continue;
      }

      // 공고 업데이트
      const { error: updateError } = await supabase
        .from('subsidy_announcements')
        .update({
          region_code: urlSource.region_code,
          region_name: urlSource.region_name,
        })
        .eq('id', announcement.id);

      if (updateError) {
        console.error(`❌ 업데이트 실패 (ID: ${announcement.id}):`, updateError);
        failCount++;
      } else {
        successCount++;
        regionStats[urlSource.region_name] = (regionStats[urlSource.region_name] || 0) + 1;
      }
    } catch (error) {
      console.error(`❌ 처리 중 오류 (ID: ${announcement.id}):`, error);
      failCount++;
    }
  }

  console.log('\n====================================');
  console.log('📊 업데이트 결과');
  console.log('====================================');
  console.log(`✅ 성공: ${successCount}개`);
  console.log(`❌ 실패: ${failCount}개`);
  console.log('\n📍 지자체별 통계:');

  Object.entries(regionStats)
    .sort(([, a], [, b]) => b - a)
    .forEach(([region, count]) => {
      console.log(`   ${region}: ${count}개`);
    });

  // 3. 검증: Direct URL Source가 남아있는지 확인
  const { data: remaining, error: checkError } = await supabase
    .from('subsidy_announcements')
    .select('id', { count: 'exact', head: true })
    .eq('region_name', 'Direct URL Source');

  if (!checkError) {
    const remainingCount = (remaining as any) || 0;
    console.log(`\n🔍 남은 "Direct URL Source": ${remainingCount}개`);

    if (remainingCount === 0) {
      console.log('✅ 모든 데이터가 성공적으로 업데이트되었습니다!');
    } else {
      console.log('⚠️  일부 데이터가 업데이트되지 않았습니다.');
    }
  }

  console.log('\n====================================\n');
}

// 실행
updateDirectUrlRegions()
  .then(() => {
    console.log('✅ 스크립트 실행 완료');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ 스크립트 실행 실패:', error);
    process.exit(1);
  });
