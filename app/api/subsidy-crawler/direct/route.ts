import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { analyzeAnnouncement, normalizeDate } from '@/lib/gemini';
import { smartExtractContent, validateContentQuality, detectPageType } from '@/lib/smart-content-extractor';

// ============================================================
// Direct URL Crawler API
// ============================================================
// 목적: 211개 직접 URL에서 보조금 공고 크롤링
// 특징: Vercel Pro 호환 (60초 타임아웃), Playwright 크롤링, 배치 처리
// ============================================================

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 60; // Vercel Pro 최대값: 60초 (목록 페이지 크롤링 개수 제한으로 대응)

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

const CRAWLER_SECRET = process.env.CRAWLER_SECRET || 'dev-secret';
const IS_PRODUCTION = process.env.NODE_ENV === 'production';

// ============================================================
// 타입 정의
// ============================================================

interface DirectCrawlRequest {
  urls?: string[];              // 크롤링할 URL 목록 (max 10)
  direct_mode: true;           // 직접 URL 모드 식별자
  retry_failed?: boolean;      // 실패한 URL만 재시도
  batch_size?: number;         // 배치 크기 (기본 10)
}

interface CrawlResult {
  url: string;
  success: boolean;
  announcements_found?: number;
  new_announcements?: number;
  relevant_announcements?: number;
  error?: string;
}

interface DirectCrawlResponse {
  success: boolean;
  total_urls: number;
  successful_urls: number;
  failed_urls: number;
  new_announcements: number;
  relevant_announcements: number;
  results: CrawlResult[];
  errors?: string[];
  crawl_log_id?: string;
}

// ============================================================
// 필수 키워드 검사
// ============================================================

const REQUIRED_KEYWORDS = [
  'IoT', 'iot', 'IOT', '사물인터넷',
  '소규모 대기배출', '소규모대기배출', '소규모 대기오염',
  '방지시설', '대기방지시설', '대기오염방지',
  '대기배출시설', '배출시설',
  '굴뚝', 'TMS', '자동측정', '측정기기',
  '환경IoT', '스마트환경', '원격감시',
];

const EXCLUDE_KEYWORDS = [
  '채용', '모집', '직원', '인력', '구인',
  '입찰', '낙찰', '계약', '용역',
  '결과', '발표', '선정', '합격',
];

function hasRequiredKeyword(title: string): boolean {
  const lowerTitle = title.toLowerCase();
  return REQUIRED_KEYWORDS.some(k => lowerTitle.includes(k.toLowerCase()));
}

function hasExcludeKeyword(title: string): boolean {
  const lowerTitle = title.toLowerCase();
  return EXCLUDE_KEYWORDS.some(k => lowerTitle.includes(k.toLowerCase()));
}

function isRelevantTitle(title: string): boolean {
  return hasRequiredKeyword(title) && !hasExcludeKeyword(title);
}

// ============================================================
// 직접 URL 크롤링 함수 (Playwright 기반)
// ============================================================

async function crawlDirectUrl(url: string): Promise<{
  success: boolean;
  announcements: any[];
  error?: string;
}> {
  let browser;
  try {
    const { chromium } = await import('playwright-core');
    const chromiumPack = await import('@sparticuz/chromium');

    // 브라우저 실행 (Vercel Pro 호환)
    browser = await chromium.launch({
      args: chromiumPack.default.args,
      executablePath: await chromiumPack.default.executablePath(),
      headless: chromiumPack.default.headless,
    });

    const context = await browser.newContext({
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
    });

    const page = await context.newPage();

    // 페이지 로드 (10초 타임아웃 - Vercel 60초 제한 고려)
    await page.goto(url, {
      timeout: 10000,
      waitUntil: 'domcontentloaded',
    });

    // 🔍 페이지 타입 감지 (하이브리드 크롤링)
    const pageType = await detectPageType(page);
    console.log(`  📊 페이지 타입: ${pageType.type} (신뢰도: ${pageType.confidence.toFixed(2)})`);

    const announcements: any[] = [];

    if (pageType.type === 'list' && pageType.detailLinks && pageType.detailLinks.length > 0) {
      // 📋 목록 페이지: 각 상세 페이지 크롤링 (최대 3개로 제한 - Vercel 60초 타임아웃 대응)
      const maxDetailPages = 3;
      const limitedLinks = pageType.detailLinks.slice(0, maxDetailPages);
      console.log(`  📋 목록 페이지 감지 - ${pageType.detailLinks.length}개 링크 중 ${limitedLinks.length}개 처리`);

      for (const link of limitedLinks) {
        try {
          console.log(`  → 상세 페이지 크롤링: ${link}`);
          await page.goto(link, { timeout: 10000, waitUntil: 'domcontentloaded' });

          // 상세 페이지에서 콘텐츠 추출
          const extractionResult = await smartExtractContent(page, link);
          const content = extractionResult.content.replace(/\s+/g, ' ').trim();

          // 콘텐츠 품질 검증
          const validation = validateContentQuality(content);
          console.log(`    📊 품질: ${validation.score.toFixed(2)} | 신뢰도: ${extractionResult.confidence.toFixed(2)}`);

          // 제목 추출 (페이지 타이틀 또는 h1 태그)
          let title = await page.title();
          if (!title || title.length < 5) {
            const h1 = await page.locator('h1').first().textContent({ timeout: 1000 }).catch(() => null);
            title = h1 || '제목 없음';
          }
          title = title.trim();

          // 최소 품질 기준 통과 시 추가
          if (content.length >= 100 && validation.score >= 0.3) {
            announcements.push({
              title,
              content,
              source_url: link,
              crawled_at: new Date().toISOString(),
            });
            console.log(`    ✅ 추가 완료: ${title}`);
          } else {
            console.warn(`    ⚠️  품질 미달: ${validation.issues.join(', ')}`);
          }

          // Rate limiting (500ms 대기)
          await new Promise(resolve => setTimeout(resolve, 500));

        } catch (error: any) {
          console.warn(`  ⚠️  상세 페이지 크롤링 실패: ${link} - ${error.message}`);
        }
      }

    } else {
      // 📄 상세 페이지: 직접 콘텐츠 추출
      console.log(`  📄 상세 페이지 감지 - 직접 추출`);

      // 스마트 콘텐츠 추출
      const extractionResult = await smartExtractContent(page, url);
      const content = extractionResult.content.replace(/\s+/g, ' ').trim();

      // 콘텐츠 품질 검증
      const validation = validateContentQuality(content);
      console.log(`  📊 품질 점수: ${validation.score.toFixed(2)} (신뢰도: ${extractionResult.confidence.toFixed(2)})`);

      if (!validation.isValid) {
        console.warn(`  ⚠️  품질 이슈: ${validation.issues.join(', ')}`);
      }

      // HTML 소스에서 제목 추출 (기존 로직 유지)
      const html = await page.content();

      // 제목 추출 (a 태그, h1-h6 등)
      const titleRegex = /<(?:a[^>]*|h[1-6][^>]*)>([^<]+)<\//gi;
      const matches = html.matchAll(titleRegex);

      const seenTitles = new Set<string>();

      for (const match of matches) {
        const title = match[1].trim();

        // 중복 제거 및 관련성 검사
        if (!seenTitles.has(title) && isRelevantTitle(title)) {
          seenTitles.add(title);
          announcements.push({
            title,
            content,
            source_url: url,
            crawled_at: new Date().toISOString(),
          });
        }
      }
    }

    await browser.close();

    console.log(`  ✅ 크롤링 완료: ${announcements.length}개 공고 발견`);

    return {
      success: true,
      announcements,
    };

  } catch (error: any) {
    if (browser) {
      await browser.close();
    }
    return {
      success: false,
      announcements: [],
      error: error.message || 'Unknown error',
    };
  }
}

// ============================================================
// Supabase 저장 함수
// ============================================================

async function saveAnnouncements(
  announcements: any[],
  sourceUrl: string
): Promise<{ new_count: number; relevant_count: number }> {
  let newCount = 0;
  let relevantCount = 0;

  // sourceUrl에서 지자체 정보 가져오기
  const { data: urlSource } = await supabase
    .from('direct_url_sources')
    .select('region_code, region_name, category')
    .eq('url', sourceUrl)
    .single();

  const regionCode = urlSource?.region_code || '00000';
  const regionName = urlSource?.region_name || 'Direct URL Source';

  for (const announcement of announcements) {
    try {
      // Gemini AI 분석
      const analysisResult = await analyzeAnnouncement(
        announcement.title,
        announcement.content || '',
        announcement.source_url
      );

      const relevanceScore = analysisResult?.relevance_score ?? 0;
      const isRelevant = relevanceScore >= 0.75;

      if (isRelevant) {
        relevantCount++;
      }

      // 중복 확인 (source_url UNIQUE 제약)
      const { data: existing } = await supabase
        .from('subsidy_announcements')
        .select('id')
        .eq('source_url', announcement.source_url)
        .single();

      if (existing) {
        continue; // 이미 존재하면 스킵
      }

      // Gemini AI가 추출한 정보
      const extractedInfo = analysisResult?.extracted_info || {};

      // 날짜 정규화
      const startDate = normalizeDate(extractedInfo.application_period_start);
      const endDate = normalizeDate(extractedInfo.application_period_end);

      // 삽입
      const { error } = await supabase
        .from('subsidy_announcements')
        .insert({
          title: announcement.title,
          content: announcement.content || '',
          source_url: announcement.source_url,
          region_code: regionCode,
          region_name: regionName,
          region_type: 'basic', // Required NOT NULL field
          published_at: new Date().toISOString(),
          relevance_score: relevanceScore,
          is_relevant: isRelevant, // Set boolean flag
          crawled_at: new Date().toISOString(),
          // Gemini AI 추출 정보
          application_period_start: startDate,
          application_period_end: endDate,
          budget: extractedInfo.budget || null,
          target_description: extractedInfo.target_description || null,
          support_amount: extractedInfo.support_amount || null,
          keywords_matched: analysisResult?.keywords_matched || [],
        });

      if (error) {
        console.error('❌ Failed to insert announcement:', announcement.title, error);
      } else {
        newCount++;
      }

    } catch (error) {
      console.error('Failed to save announcement:', error);
    }
  }

  return { new_count: newCount, relevant_count: relevantCount };
}

// ============================================================
// 크롤링 로그 기록
// ============================================================

async function createCrawlLog(
  totalUrls: number
): Promise<string> {
  const { data, error } = await supabase
    .from('crawl_logs')
    .insert({
      crawl_type: 'direct',
      started_at: new Date().toISOString(),
      total_urls: totalUrls,
    })
    .select('id')
    .single();

  if (error || !data) {
    throw new Error('Failed to create crawl log');
  }

  return data.id;
}

async function updateCrawlLog(
  logId: string,
  results: {
    successful: number;
    failed: number;
    newAnnouncements: number;
    relevantAnnouncements: number;
    errors: string[];
  }
): Promise<void> {
  await supabase
    .from('crawl_logs')
    .update({
      completed_at: new Date().toISOString(),
      successful_urls: results.successful,
      failed_urls: results.failed,
      new_announcements: results.newAnnouncements,
      relevant_announcements: results.relevantAnnouncements,
      errors: results.errors,
    })
    .eq('id', logId);
}

// ============================================================
// direct_url_sources 테이블 업데이트
// ============================================================

async function recordCrawlSuccess(url: string): Promise<void> {
  const { data: func } = await supabase.rpc('record_crawl_success', {
    p_url: url,
  });
}

async function recordCrawlFailure(url: string, error: string): Promise<void> {
  const { data: func } = await supabase.rpc('record_crawl_failure', {
    p_url: url,
    p_error: error,
  });
}

// ============================================================
// GET: 크롤링 대상 URL 가져오기
// ============================================================

export async function GET(request: NextRequest) {
  // 인증 확인: CRAWLER_SECRET, Authorization Bearer, 또는 쿠키 세션
  const authHeader = request.headers.get('authorization');
  const token = authHeader?.replace('Bearer ', '');

  // 1. CRAWLER_SECRET 인증 (GitHub Actions용)
  if (token && token === CRAWLER_SECRET) {
    // GitHub Actions 크롤러 인증 성공
  }
  // 2. Authorization Bearer 토큰 인증 (JWT 또는 Supabase 세션)
  else if (token && token !== CRAWLER_SECRET) {
    // 2-1. JWT 토큰 검증 시도
    const { getUserFromToken } = await import('@/lib/secure-jwt');
    const jwtUser = await getUserFromToken(request);

    if (jwtUser) {
      // JWT 토큰으로 인증 성공
      if (jwtUser.permission_level < 4) {
        return NextResponse.json(
          { error: 'Forbidden: Insufficient permissions (requires level 4)' },
          { status: 403 }
        );
      }
      // JWT 인증 성공, 계속 진행
    } else {
      // 2-2. JWT 실패 시 Supabase 세션 확인
      const { data: { user }, error: authError } = await supabase.auth.getUser(token);

      if (authError || !user) {
        return NextResponse.json(
          { error: 'Unauthorized: Invalid token (neither JWT nor Supabase session)' },
          { status: 401 }
        );
      }

      // 사용자 권한 확인 (permission_level >= 4)
      const { data: userData, error: userError } = await supabase
        .from('users')
        .select('permission_level')
        .eq('id', user.id)
        .single();

      if (userError || !userData || userData.permission_level < 4) {
        return NextResponse.json(
          { error: 'Forbidden: Insufficient permissions (requires level 4)' },
          { status: 403 }
        );
      }
    }
  }
  // 3. 쿠키 기반 세션 인증 (폴백)
  else {
    // 쿠키에서 세션 토큰 가져오기
    const cookieHeader = request.headers.get('cookie') || '';
    const cookies = Object.fromEntries(
      cookieHeader.split('; ').map(c => c.split('=').map(decodeURIComponent))
    );
    const accessToken = cookies['sb-access-token'] || cookies['sb-uvdvfsjekqshxtxthxeq-auth-token'];

    if (!accessToken) {
      return NextResponse.json(
        { error: 'Unauthorized: No session token' },
        { status: 401 }
      );
    }

    // Supabase 세션 확인
    const { data: { user }, error: authError } = await supabase.auth.getUser(accessToken);

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized: Invalid session' },
        { status: 401 }
      );
    }

    // 사용자 권한 확인 (permission_level >= 4)
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('permission_level')
      .eq('id', user.id)
      .single();

    if (userError || !userData || userData.permission_level < 4) {
      return NextResponse.json(
        { error: 'Forbidden: Insufficient permissions (requires level 4)' },
        { status: 403 }
      );
    }
  }

  const { searchParams } = new URL(request.url);
  const limit = parseInt(searchParams.get('limit') || '10', 10);

  // direct_url_sources에서 크롤링 대상 URL 가져오기
  const { data: urls, error } = await supabase.rpc('get_urls_for_crawling', {
    p_limit: limit,
  });

  if (error) {
    return NextResponse.json(
      { error: 'Failed to fetch URLs', details: error.message },
      { status: 500 }
    );
  }

  return NextResponse.json({
    success: true,
    total_urls: urls?.length || 0,
    urls: urls || [],
  });
}

// ============================================================
// POST: 직접 URL 크롤링 실행
// ============================================================

export async function POST(request: NextRequest) {
  // 인증 확인 (프로덕션 환경에서만)
  if (IS_PRODUCTION) {
    const authHeader = request.headers.get('authorization');
    const token = authHeader?.replace('Bearer ', '');

    if (!token || token !== CRAWLER_SECRET) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }
  }

  try {
    const body: DirectCrawlRequest = await request.json();

    // direct_mode 검증
    if (!body.direct_mode) {
      return NextResponse.json(
        { error: 'direct_mode must be true' },
        { status: 400 }
      );
    }

    // URL 목록 가져오기
    let urlsToProcess: string[] = [];

    if (body.urls && body.urls.length > 0) {
      // 명시적으로 제공된 URL 사용
      urlsToProcess = body.urls.slice(0, 10); // max 10
    } else if (body.retry_failed) {
      // 실패한 URL만 재시도
      const { data: failedUrls } = await supabase
        .from('direct_url_sources')
        .select('url')
        .gt('consecutive_failures', 0)
        .eq('is_active', true)
        .limit(10);

      urlsToProcess = failedUrls?.map(u => u.url) || [];
    } else {
      // DB에서 크롤링 대상 가져오기
      const { data: urls } = await supabase.rpc('get_urls_for_crawling', {
        p_limit: body.batch_size || 10,
      });

      urlsToProcess = urls?.map((u: any) => u.url) || [];
    }

    if (urlsToProcess.length === 0) {
      return NextResponse.json(
        { error: 'No URLs to process' },
        { status: 400 }
      );
    }

    // 크롤링 로그 생성
    const logId = await createCrawlLog(urlsToProcess.length);

    // 병렬 크롤링 (max 10 URLs)
    const crawlPromises = urlsToProcess.map(url => crawlDirectUrl(url));
    const crawlResults = await Promise.all(crawlPromises);

    // 결과 집계
    let successfulUrls = 0;
    let failedUrls = 0;
    let totalNewAnnouncements = 0;
    let totalRelevantAnnouncements = 0;
    const errors: string[] = [];
    const results: CrawlResult[] = [];

    for (let i = 0; i < urlsToProcess.length; i++) {
      const url = urlsToProcess[i];
      const result = crawlResults[i];

      if (result.success) {
        successfulUrls++;

        // Supabase 저장
        const { new_count, relevant_count } = await saveAnnouncements(
          result.announcements,
          url
        );

        totalNewAnnouncements += new_count;
        totalRelevantAnnouncements += relevant_count;

        // direct_url_sources 업데이트 (성공)
        await recordCrawlSuccess(url);

        results.push({
          url,
          success: true,
          announcements_found: result.announcements.length,
          new_announcements: new_count,
          relevant_announcements: relevant_count,
        });

      } else {
        failedUrls++;

        const errorMsg = result.error || 'Unknown error';
        errors.push(`${url}: ${errorMsg}`);

        // direct_url_sources 업데이트 (실패)
        await recordCrawlFailure(url, errorMsg);

        results.push({
          url,
          success: false,
          error: errorMsg,
        });
      }
    }

    // 크롤링 로그 업데이트
    await updateCrawlLog(logId, {
      successful: successfulUrls,
      failed: failedUrls,
      newAnnouncements: totalNewAnnouncements,
      relevantAnnouncements: totalRelevantAnnouncements,
      errors,
    });

    const response: DirectCrawlResponse = {
      success: true,
      total_urls: urlsToProcess.length,
      successful_urls: successfulUrls,
      failed_urls: failedUrls,
      new_announcements: totalNewAnnouncements,
      relevant_announcements: totalRelevantAnnouncements,
      results,
      errors: errors.length > 0 ? errors : undefined,
      crawl_log_id: logId,
    };

    return NextResponse.json(response);

  } catch (error: any) {
    console.error('Direct crawler error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Internal server error',
      },
      { status: 500 }
    );
  }
}
