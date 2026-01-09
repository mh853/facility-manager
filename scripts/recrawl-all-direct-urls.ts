#!/usr/bin/env tsx

/**
 * 전체 Direct URL 재크롤링
 *
 * 하이브리드 크롤러를 사용하여 모든 direct_url_sources 재크롤링
 * - 목록 페이지는 상세 페이지 링크 추출 후 각각 크롤링
 * - 상세 페이지는 직접 콘텐츠 추출
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, serviceRoleKey);

// API 엔드포인트 (로컬 또는 프로덕션)
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';

async function recrawlAllDirectUrls() {
  console.log('🔄 전체 Direct URL 재크롤링 시작\n');

  try {
    // 1. direct_url_sources에서 모든 활성 URL 가져오기
    const { data: urlSources, error } = await supabase
      .from('direct_url_sources')
      .select('*')
      .eq('is_active', true)
      .order('region_name');

    if (error) {
      throw new Error(`URL 소스 조회 실패: ${error.message}`);
    }

    if (!urlSources || urlSources.length === 0) {
      console.log('⚠️  활성화된 URL 소스가 없습니다.');
      return;
    }

    console.log(`📋 발견된 URL 소스: ${urlSources.length}개\n`);

    // 2. 각 URL 소스별로 크롤링 API 호출
    let successCount = 0;
    let failCount = 0;
    let totalNewAnnouncements = 0;

    for (let i = 0; i < urlSources.length; i++) {
      const source = urlSources[i];
      console.log(`\n[${ i + 1}/${urlSources.length}] ${source.region_name} 크롤링 중...`);
      console.log(`   URL: ${source.url}`);

      try {
        // Direct URL Crawler API 호출
        const response = await fetch(`${API_BASE_URL}/api/subsidy-crawler/direct`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            urls: [source.url], // 단일 URL 배열로 전송
            direct_mode: true,
          }),
        });

        if (!response.ok) {
          throw new Error(`API 호출 실패: ${response.status} ${response.statusText}`);
        }

        const result = await response.json();

        if (result.success) {
          successCount++;
          const newCount = result.results[0]?.new_count || 0;
          totalNewAnnouncements += newCount;

          console.log(`   ✅ 성공: ${newCount}개 신규 공고`);
          console.log(`   📊 전체: ${result.results[0]?.relevant_count || 0}개 관련 공고`);
        } else {
          failCount++;
          console.error(`   ❌ 실패: ${result.error || 'Unknown error'}`);
        }

        // Rate limiting (1초 대기)
        await new Promise(resolve => setTimeout(resolve, 1000));

      } catch (error: any) {
        failCount++;
        console.error(`   ❌ 크롤링 실패: ${error.message}`);
      }
    }

    // 3. 최종 통계
    console.log('\n════════════════════════════════════════');
    console.log('📊 재크롤링 완료 통계');
    console.log('════════════════════════════════════════');
    console.log(`✅ 성공: ${successCount}개 URL`);
    console.log(`❌ 실패: ${failCount}개 URL`);
    console.log(`📋 신규 공고: ${totalNewAnnouncements}개`);
    console.log(`📈 성공률: ${((successCount / urlSources.length) * 100).toFixed(1)}%\n`);

    // 4. 전체 공고 개수 확인
    const { count } = await supabase
      .from('subsidy_announcements')
      .select('*', { count: 'exact', head: true });

    console.log(`💾 현재 DB 총 공고 개수: ${count}개\n`);

  } catch (error: any) {
    console.error('❌ 재크롤링 실패:', error.message);
    process.exit(1);
  }
}

// 실행
recrawlAllDirectUrls()
  .then(() => {
    console.log('✅ 재크롤링 완료');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ 재크롤링 실행 실패:', error);
    process.exit(1);
  });
