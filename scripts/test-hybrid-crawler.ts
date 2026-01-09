#!/usr/bin/env tsx

/**
 * 하이브리드 크롤러 테스트
 *
 * 계룡시 페이지로 하이브리드 크롤링 테스트
 * - 목록 페이지 감지 확인
 * - 상세 페이지 링크 추출 확인
 * - 각 상세 페이지에서 콘텐츠 추출 확인
 */

import { chromium } from 'playwright';
import { smartExtractContent, validateContentQuality, detectPageType } from '@/lib/smart-content-extractor';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const TEST_URL = 'https://gyeryong.go.kr/kr/html/sub03/030102.html?skey=sj&sval=%EB%B0%A9%EC%A7%80%EC%8B%9C%EC%84%A4';

async function testHybridCrawler() {
  console.log('🧪 하이브리드 크롤러 테스트 시작\n');
  console.log(`📍 테스트 URL: ${TEST_URL}\n`);

  const browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
  });

  const page = await context.newPage();

  try {
    // 1단계: 초기 페이지 로드
    console.log('📄 페이지 로드 중...\n');
    await page.goto(TEST_URL, {
      timeout: 15000,
      waitUntil: 'domcontentloaded',
    });

    // 2단계: 페이지 타입 감지
    console.log('🔍 페이지 타입 감지 중...\n');
    const pageType = await detectPageType(page);

    console.log('════════════════════════════════════════');
    console.log('📊 페이지 타입 감지 결과');
    console.log('════════════════════════════════════════');
    console.log(`타입: ${pageType.type}`);
    console.log(`신뢰도: ${(pageType.confidence * 100).toFixed(1)}%`);

    if (pageType.type === 'list' && pageType.detailLinks) {
      console.log(`발견된 링크: ${pageType.detailLinks.length}개\n`);

      // 3단계: 각 상세 페이지 크롤링 (최대 3개)
      const maxLinks = Math.min(3, pageType.detailLinks.length);
      console.log('════════════════════════════════════════');
      console.log(`📋 상세 페이지 크롤링 (${maxLinks}개)`);
      console.log('════════════════════════════════════════\n');

      for (let i = 0; i < maxLinks; i++) {
        const link = pageType.detailLinks[i];
        console.log(`${i + 1}. 크롤링 중: ${link}\n`);

        try {
          await page.goto(link, {
            timeout: 10000,
            waitUntil: 'domcontentloaded',
          });

          // 제목 추출
          let title = await page.title();
          if (!title || title.length < 5) {
            const h1 = await page.locator('h1').first().textContent({ timeout: 1000 }).catch(() => null);
            title = h1 || '제목 없음';
          }
          title = title.trim();

          console.log(`   📌 제목: ${title}`);

          // 콘텐츠 추출
          const extractionResult = await smartExtractContent(page, link);
          const content = extractionResult.content.replace(/\s+/g, ' ').trim();

          console.log(`   📏 본문 길이: ${content.length}자`);
          console.log(`   🎯 추출 방법: ${extractionResult.method}`);
          console.log(`   💯 신뢰도: ${(extractionResult.confidence * 100).toFixed(1)}%`);

          // 품질 검증
          const validation = validateContentQuality(content);
          console.log(`   ✅ 품질 점수: ${(validation.score * 100).toFixed(1)}%`);
          console.log(`   🔍 유효성: ${validation.isValid ? '✅ 통과' : '❌ 실패'}`);

          if (validation.issues.length > 0) {
            console.log(`   ⚠️  이슈: ${validation.issues.join(', ')}`);
          }

          // 키워드 체크
          const keywords = ['신청기간', '접수기간', '예산', '지원금액', '지원대상'];
          const foundKeywords = keywords.filter(k => content.includes(k));
          console.log(`   🔑 키워드: ${foundKeywords.join(', ') || '없음'}`);

          // 본문 미리보기
          console.log(`   📄 본문 미리보기:`);
          console.log(`   ${content.substring(0, 200)}...\n`);

          // Rate limiting
          await new Promise(resolve => setTimeout(resolve, 500));

        } catch (error: any) {
          console.error(`   ❌ 크롤링 실패: ${error.message}\n`);
        }
      }

      console.log('════════════════════════════════════════');
      console.log('📊 테스트 요약');
      console.log('════════════════════════════════════════');
      console.log(`✅ 페이지 타입 감지: ${pageType.type === 'list' ? '성공' : '실패'}`);
      console.log(`✅ 링크 추출: ${pageType.detailLinks.length}개 발견`);
      console.log(`✅ 상세 페이지 크롤링: ${maxLinks}개 테스트 완료\n`);

    } else if (pageType.type === 'detail') {
      console.log('\n📄 상세 페이지로 감지됨 - 직접 추출 모드\n');

      const extractionResult = await smartExtractContent(page, TEST_URL);
      const content = extractionResult.content.replace(/\s+/g, ' ').trim();

      console.log(`📏 본문 길이: ${content.length}자`);
      console.log(`🎯 추출 방법: ${extractionResult.method}`);
      console.log(`💯 신뢰도: ${(extractionResult.confidence * 100).toFixed(1)}%\n`);

      const validation = validateContentQuality(content);
      console.log(`✅ 품질 점수: ${(validation.score * 100).toFixed(1)}%`);
      console.log(`🔍 유효성: ${validation.isValid ? '✅ 통과' : '❌ 실패'}\n`);

    } else {
      console.log('\n⚠️  페이지 타입을 감지할 수 없습니다.\n');
    }

  } catch (error: any) {
    console.error('❌ 테스트 실패:', error.message);
  } finally {
    await browser.close();
  }
}

// 실행
testHybridCrawler()
  .then(() => {
    console.log('✅ 테스트 완료');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ 테스트 실행 실패:', error);
    process.exit(1);
  });
