#!/usr/bin/env tsx

/**
 * 페이지 HTML 구조 분석
 */

import { chromium } from 'playwright';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const TEST_URL = 'https://gyeryong.go.kr/kr/html/sub03/030102.html?skey=sj&sval=%EB%B0%A9%EC%A7%80%EC%8B%9C%EC%84%A4';

async function analyzePageStructure() {
  console.log('🔍 페이지 구조 분석...\n');

  const browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  const page = await browser.newPage();

  try {
    await page.goto(TEST_URL, {
      timeout: 15000,
      waitUntil: 'domcontentloaded',
    });

    // 가능한 콘텐츠 영역 selector들 테스트
    const candidateSelectors = [
      'table.bbsList',
      'table.view',
      '.board-view',
      '.view-content',
      '#content',
      'article',
      'main',
      '.boardView',
      '.board_view',
      'table tbody',
      'td.txt',
      'td.content',
    ];

    console.log('📋 Selector 테스트 결과:\n');

    for (const selector of candidateSelectors) {
      try {
        const element = page.locator(selector).first();
        const exists = await element.count() > 0;

        if (exists) {
          const content = await element.textContent({ timeout: 1000 });
          const length = content?.length || 0;
          const hasKeywords = content?.includes('신청') || content?.includes('지원');

          console.log(`✅ ${selector}`);
          console.log(`   길이: ${length}자`);
          console.log(`   키워드: ${hasKeywords ? '✓' : '✗'}`);
          if (length > 0 && length < 500) {
            console.log(`   내용: ${content?.substring(0, 100)}...`);
          }
          console.log('');
        }
      } catch (e) {
        // 무시
      }
    }

    // HTML 구조 출력 (일부)
    console.log('\n📄 HTML 구조 샘플:\n');
    const html = await page.content();

    // table 태그 찾기
    const tableMatch = html.match(/<table[^>]*>[\s\S]{0,2000}/i);
    if (tableMatch) {
      console.log('Table 구조:');
      console.log(tableMatch[0].substring(0, 800));
    }

  } finally {
    await browser.close();
  }
}

analyzePageStructure();
