#!/usr/bin/env tsx

/**
 * 스마트 콘텐츠 추출 테스트
 *
 * 계룡시 공고 페이지로 Gemini 기반 스마트 추출 테스트
 */

import { chromium } from 'playwright';
import { smartExtractContent, validateContentQuality } from '@/lib/smart-content-extractor';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const TEST_URL = 'https://gyeryong.go.kr/kr/html/sub03/030102.html?skey=sj&sval=%EB%B0%A9%EC%A7%80%EC%8B%9C%EC%84%A4';

async function testSmartExtraction() {
  console.log('🧪 스마트 추출 테스트 시작\n');
  console.log(`📍 테스트 URL: ${TEST_URL}\n`);

  // Playwright 브라우저 시작
  console.log('🌐 브라우저 시작...\n');
  const browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
  });

  const page = await context.newPage();

  try {
    // 페이지 로드
    console.log('📄 페이지 로드 중...\n');
    await page.goto(TEST_URL, {
      timeout: 15000,
      waitUntil: 'domcontentloaded',
    });

    // 스마트 추출 실행
    console.log('🧠 스마트 콘텐츠 추출 실행...\n');
    const result = await smartExtractContent(page, TEST_URL);

    console.log('════════════════════════════════════════');
    console.log('📊 추출 결과');
    console.log('════════════════════════════════════════');
    console.log(`추출 방법: ${result.method}`);
    console.log(`Selector: ${result.selector || 'N/A'}`);
    console.log(`신뢰도: ${(result.confidence * 100).toFixed(1)}%`);
    console.log(`본문 길이: ${result.content.length}자`);

    // 품질 검증
    const validation = validateContentQuality(result.content);
    console.log('\n════════════════════════════════════════');
    console.log('✅ 품질 검증');
    console.log('════════════════════════════════════════');
    console.log(`유효성: ${validation.isValid ? '✅ 통과' : '❌ 실패'}`);
    console.log(`품질 점수: ${(validation.score * 100).toFixed(1)}%`);
    console.log(`이슈: ${validation.issues.length > 0 ? validation.issues.join(', ') : '없음'}`);

    // 키워드 체크
    console.log('\n════════════════════════════════════════');
    console.log('🔍 핵심 키워드 포함 여부');
    console.log('════════════════════════════════════════');
    const keywords = [
      '신청기간', '접수기간', '모집기간',
      '예산', '지원금액', '지원규모',
      '지원대상', '신청대상',
      '지원내용', '사업내용',
    ];

    keywords.forEach(keyword => {
      const included = result.content.includes(keyword);
      console.log(`  ${included ? '✅' : '❌'} ${keyword}`);
    });

    // 본문 미리보기
    console.log('\n════════════════════════════════════════');
    console.log('📄 본문 미리보기 (처음 800자)');
    console.log('════════════════════════════════════════');
    console.log(result.content.substring(0, 800));
    console.log('...\n');

    // 네비게이션 오염도 체크
    const noiseKeywords = ['메뉴', '바로가기', 'Language', 'SITE MAP', '로그인'];
    const noiseCount = noiseKeywords.filter(k => result.content.includes(k)).length;
    console.log('════════════════════════════════════════');
    console.log('⚠️  네비게이션 오염도');
    console.log('════════════════════════════════════════');
    console.log(`오염 키워드 발견: ${noiseCount}/${noiseKeywords.length}개`);
    console.log(`상태: ${noiseCount <= 1 ? '✅ 깨끗함' : noiseCount <= 3 ? '⚠️  보통' : '❌ 높음'}\n`);

  } catch (error: any) {
    console.error('❌ 테스트 실패:', error.message);
  } finally {
    await browser.close();
  }
}

// 실행
testSmartExtraction()
  .then(() => {
    console.log('✅ 테스트 완료');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ 테스트 실행 실패:', error);
    process.exit(1);
  });
