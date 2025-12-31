import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { analyzeAnnouncement } from '@/lib/gemini';

// ============================================================
// Direct URL Crawler API
// ============================================================
// 목적: 211개 직접 URL에서 보조금 공고 크롤링
// 특징: Vercel Hobby 호환 (10초 제한), 배치 처리 (max 10 URLs)
// ============================================================

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 10; // Vercel Hobby: 10초

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
// 직접 URL 크롤링 함수
// ============================================================

async function crawlDirectUrl(url: string): Promise<{
  success: boolean;
  announcements: any[];
  error?: string;
}> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000); // 8초 타임아웃

    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      },
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const html = await response.text();

    // HTML 파싱 (간단한 정규표현식 기반)
    // 실제로는 cheerio 등의 라이브러리 사용 권장
    const announcements: any[] = [];

    // 제목 추출 (a 태그, h1-h6 등)
    const titleRegex = /<(?:a[^>]*|h[1-6][^>]*)>([^<]+)<\//gi;
    const matches = html.matchAll(titleRegex);

    for (const match of matches) {
      const title = match[1].trim();

      // 관련성 검사
      if (isRelevantTitle(title)) {
        announcements.push({
          title,
          source_url: url,
          crawled_at: new Date().toISOString(),
        });
      }
    }

    return {
      success: true,
      announcements,
    };

  } catch (error: any) {
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

      // 삽입
      const { error } = await supabase
        .from('subsidy_announcements')
        .insert({
          title: announcement.title,
          content: announcement.content || '',
          source_url: announcement.source_url,
          organization: 'Direct URL',
          region_code: '00000',
          region_name: 'Direct',
          announcement_date: new Date().toISOString(),
          relevance_score: relevanceScore,
          ai_analysis: analysisResult?.analysis || null,
          crawled_at: new Date().toISOString(),
        });

      if (!error) {
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
