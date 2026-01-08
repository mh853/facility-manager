#!/usr/bin/env tsx

/**
 * 기존 공고 재크롤링 스크립트 (Playwright로 본문 추출)
 *
 * 목적: content가 NULL인 공고를 Playwright로 재크롤링하여 본문 추출
 */

import { createClient } from '@supabase/supabase-js';
import { chromium, Browser, Page } from 'playwright';
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

interface Announcement {
  id: string;
  title: string;
  source_url: string;
  content: string | null;
}

async function extractContentFromUrl(url: string, browser: Browser): Promise<string | null> {
  let page: Page | null = null;
  try {
    const context = await browser.newContext({
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
    });

    page = await context.newPage();

    // 페이지 로드
    await page.goto(url, {
      timeout: 15000,
      waitUntil: 'domcontentloaded',
    });

    // 콘텐츠 추출
    let content = '';
    try {
      // 1차 시도: 주요 콘텐츠 영역
      const mainContent = await page.locator(
        'main, article, [role="main"], .content, #content, .board-content, .post-content, .view-content, .detail-content'
      ).first().textContent({ timeout: 3000 });
      content = mainContent?.trim() || '';
    } catch (e) {
      // 2차 시도: body 전체
      try {
        const bodyContent = await page.locator('body').textContent({ timeout: 3000 });
        content = bodyContent?.trim() || '';
      } catch (e2) {
        console.warn(`  ⚠️  콘텐츠 추출 실패: ${url}`);
        return null;
      }
    }

    // 콘텐츠 정리
    content = content
      .replace(/\s+/g, ' ')
      .replace(/[\n\r\t]+/g, ' ')
      .trim();

    await context.close();

    // 최소 길이 체크 (너무 짧으면 의미 없음)
    if (content.length < 50) {
      console.warn(`  ⚠️  콘텐츠가 너무 짧음 (${content.length}자): ${url}`);
      return null;
    }

    return content;

  } catch (error: any) {
    console.error(`  ❌ 에러: ${error.message}`);
    return null;
  } finally {
    if (page) {
      await page.close();
    }
  }
}

async function recrawlAnnouncements() {
  console.log('🔄 기존 공고 재크롤링 시작...\n');

  // 1. content가 NULL이거나 짧은 공고 조회
  const { data: announcements, error: fetchError } = await supabase
    .from('subsidy_announcements')
    .select('id, title, source_url, content')
    .or('content.is.null,content.eq.');

  if (fetchError) {
    console.error('❌ 공고 조회 실패:', fetchError);
    process.exit(1);
  }

  if (!announcements || announcements.length === 0) {
    console.log('✅ 재크롤링할 공고가 없습니다.');
    return;
  }

  console.log(`📊 재크롤링 대상: ${announcements.length}개 공고\n`);

  // 2. Playwright 브라우저 실행
  console.log('🌐 Playwright 브라우저 시작...\n');
  const browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  let successCount = 0;
  let failCount = 0;
  let skippedCount = 0;

  // 3. 각 공고 재크롤링
  for (let i = 0; i < announcements.length; i++) {
    const announcement = announcements[i];
    const progress = `[${i + 1}/${announcements.length}]`;

    console.log(`${progress} ${announcement.title.substring(0, 60)}...`);
    console.log(`  URL: ${announcement.source_url}`);

    try {
      // Playwright로 콘텐츠 추출
      const content = await extractContentFromUrl(announcement.source_url, browser);

      if (!content) {
        skippedCount++;
        console.log(`  ⏭️  스킵 (콘텐츠 추출 실패)\n`);
        continue;
      }

      // Supabase 업데이트
      const { error: updateError } = await supabase
        .from('subsidy_announcements')
        .update({
          content,
          updated_at: new Date().toISOString(),
        })
        .eq('id', announcement.id);

      if (updateError) {
        console.error(`  ❌ 업데이트 실패:`, updateError);
        failCount++;
      } else {
        successCount++;
        console.log(`  ✅ 성공 (${content.length}자)\n`);
      }

      // Rate limiting (1초 대기)
      await new Promise(resolve => setTimeout(resolve, 1000));

    } catch (error: any) {
      console.error(`  ❌ 처리 실패:`, error.message);
      failCount++;
    }
  }

  // 4. 브라우저 종료
  await browser.close();

  // 5. 결과 요약
  console.log('\n====================================');
  console.log('📊 재크롤링 결과');
  console.log('====================================');
  console.log(`✅ 성공: ${successCount}개`);
  console.log(`❌ 실패: ${failCount}개`);
  console.log(`⏭️  스킵: ${skippedCount}개`);
  console.log(`📈 총 처리: ${successCount + failCount + skippedCount}개`);

  // 6. 검증
  const { count: remainingNullCount } = await supabase
    .from('subsidy_announcements')
    .select('id', { count: 'exact', head: true })
    .or('content.is.null,content.eq.');

  console.log(`\n🔍 남은 NULL content: ${remainingNullCount || 0}개`);

  if (remainingNullCount === 0) {
    console.log('✅ 모든 공고에 본문이 추가되었습니다!');
  } else {
    console.log(`⚠️  ${remainingNullCount}개 공고는 여전히 본문이 없습니다.`);
  }

  console.log('\n====================================\n');
}

// 실행
recrawlAnnouncements()
  .then(() => {
    console.log('✅ 스크립트 실행 완료');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ 스크립트 실행 실패:', error);
    process.exit(1);
  });
