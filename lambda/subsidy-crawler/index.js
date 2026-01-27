// AWS Lambda Handler for Subsidy Crawler
// Puppeteer + @sparticuz/chromium 조합으로 Lambda 환경 최적화

const puppeteer = require('puppeteer-core');
const chromium = require('@sparticuz/chromium');

// Supabase 클라이언트 (Lambda 환경용)
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Gemini AI 분석 함수
async function analyzeWithGemini(content) {
  const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
  if (!GEMINI_API_KEY) {
    return { relevant: false, reason: 'Gemini API key not configured' };
  }

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{
            parts: [{
              text: `다음은 지방자치단체 보조금 공고입니다. 시설 관련 보조금인지 분석해주세요.\n\n${content.substring(0, 3000)}\n\n{"relevant": boolean, "reason": "이유"} 형식으로만 답변해주세요.`
            }]
          }]
        })
      }
    );

    const data = await response.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '{}';
    return JSON.parse(text.replace(/```json\n?|\n?```/g, ''));
  } catch (error) {
    console.error('[GEMINI] 분석 오류:', error);
    return { relevant: false, reason: 'AI 분석 실패' };
  }
}

// 페이지 타입 감지
async function detectPageType(page) {
  try {
    const detailLinks = await page.evaluate(() => {
      const links = Array.from(document.querySelectorAll('a[href*="view"], a[href*="detail"], a[href*="board"]'));
      return links
        .slice(0, 5)
        .map(a => a.href)
        .filter(href => href && href.startsWith('http'));
    });

    if (detailLinks.length >= 3) {
      return { type: 'list', confidence: 0.8, detailLinks };
    }
    return { type: 'detail', confidence: 0.7, detailLinks: [] };
  } catch (error) {
    return { type: 'detail', confidence: 0.5, detailLinks: [] };
  }
}

// 스마트 콘텐츠 추출
async function smartExtractContent(page) {
  try {
    const content = await page.evaluate(() => {
      const selectors = [
        'article', 'main', '.content', '.board-content', '.view-content',
        '#content', '.post-content', '.notice-content'
      ];

      for (const selector of selectors) {
        const element = document.querySelector(selector);
        if (element) return element.innerText;
      }
      return document.body.innerText;
    });

    return {
      content: content.replace(/\s+/g, ' ').trim(),
      confidence: 0.8
    };
  } catch (error) {
    return { content: '', confidence: 0 };
  }
}

// 콘텐츠 품질 검증
function validateContentQuality(content) {
  const length = content.length;
  const hasKeywords = /보조금|지원금|지원사업|공고|신청|접수/.test(content);

  if (length < 100) return { isValid: false, score: 0.1 };
  if (length < 300) return { isValid: hasKeywords, score: hasKeywords ? 0.5 : 0.2 };

  return { isValid: true, score: hasKeywords ? 0.9 : 0.6 };
}

// 메인 크롤링 함수
async function crawlUrl(url, browser) {
  console.log(`\n🔍 [${url}] 크롤링 시작`);

  try {
    const page = await browser.newPage();

    // 페이지 로드
    await page.goto(url, {
      timeout: 30000,
      waitForNavigation: 'domcontentloaded'
    });

    // 페이지 타입 감지
    const pageType = await detectPageType(page);
    console.log(`  📊 페이지 타입: ${pageType.type}`);

    const announcements = [];

    if (pageType.type === 'list' && pageType.detailLinks.length > 0) {
      // 목록 페이지: 모든 상세 페이지 크롤링
      console.log(`  📋 목록 페이지 - ${pageType.detailLinks.length}개 링크 처리`);

      for (const link of pageType.detailLinks) {
        try {
          await page.goto(link, { timeout: 30000, waitForNavigation: 'domcontentloaded' });

          const extractionResult = await smartExtractContent(page);
          const content = extractionResult.content;

          const validation = validateContentQuality(content);

          if (validation.isValid) {
            const analysis = await analyzeWithGemini(content);

            if (analysis.relevant) {
              announcements.push({
                source_url: link,
                title: content.substring(0, 100),
                content: content.substring(0, 5000),
                is_relevant: true,
                ai_reason: analysis.reason
              });
            }
          }
        } catch (error) {
          console.error(`  ❌ 상세 페이지 오류 [${link}]:`, error.message);
        }
      }
    } else {
      // 단일 상세 페이지
      const extractionResult = await smartExtractContent(page);
      const content = extractionResult.content;

      const validation = validateContentQuality(content);

      if (validation.isValid) {
        const analysis = await analyzeWithGemini(content);

        if (analysis.relevant) {
          announcements.push({
            source_url: url,
            title: content.substring(0, 100),
            content: content.substring(0, 5000),
            is_relevant: true,
            ai_reason: analysis.reason
          });
        }
      }
    }

    await page.close();

    console.log(`  ✅ 완료 - ${announcements.length}개 공고 발견`);

    return {
      url,
      success: true,
      announcements_count: announcements.length,
      announcements
    };

  } catch (error) {
    console.error(`  ❌ 크롤링 실패 [${url}]:`, error.message);

    return {
      url,
      success: false,
      error: error.message,
      announcements_count: 0,
      announcements: []
    };
  }
}

// Lambda Handler
exports.handler = async (event) => {
  console.log('🚀 Lambda 크롤러 시작');

  try {
    // API Gateway 요청 파싱
    const body = JSON.parse(event.body || '{}');
    const { urls, secret, batch_number, run_id } = body;

    // 시크릿 검증
    if (secret !== process.env.CRAWLER_SECRET) {
      return {
        statusCode: 401,
        body: JSON.stringify({ success: false, error: 'Unauthorized' })
      };
    }

    if (!urls || !Array.isArray(urls) || urls.length === 0) {
      return {
        statusCode: 400,
        body: JSON.stringify({ success: false, error: 'Invalid URLs' })
      };
    }

    console.log(`📦 배치 ${batch_number} - ${urls.length}개 URL 처리`);

    // Chromium 브라우저 시작 (Lambda 최적화)
    const browser = await puppeteer.launch({
      args: chromium.args,
      defaultViewport: chromium.defaultViewport,
      executablePath: await chromium.executablePath(),
      headless: chromium.headless
    });

    console.log('🌐 Chromium 브라우저 시작 완료');

    // 모든 URL 크롤링
    const results = [];
    for (const url of urls) {
      const result = await crawlUrl(url, browser);
      results.push(result);

      // Supabase에 결과 저장
      for (const announcement of result.announcements) {
        try {
          await supabase.from('subsidy_announcements').insert({
            ...announcement,
            run_id,
            created_at: new Date().toISOString()
          });
        } catch (error) {
          console.error('  ⚠️ Supabase 저장 오류:', error.message);
        }
      }
    }

    await browser.close();
    console.log('✅ 브라우저 종료');

    // 성공/실패 통계
    const successful = results.filter(r => r.success).length;
    const failed = results.filter(r => !r.success).length;
    const total_announcements = results.reduce((sum, r) => sum + r.announcements_count, 0);

    console.log(`\n📊 배치 ${batch_number} 완료:`);
    console.log(`  - 성공: ${successful}개`);
    console.log(`  - 실패: ${failed}개`);
    console.log(`  - 공고: ${total_announcements}개`);

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        success: true,
        batch_number,
        results: {
          successful_urls: successful,
          failed_urls: failed,
          total_announcements
        },
        details: results
      })
    };

  } catch (error) {
    console.error('❌ Lambda 실행 오류:', error);

    return {
      statusCode: 500,
      body: JSON.stringify({
        success: false,
        error: error.message
      })
    };
  }
};
