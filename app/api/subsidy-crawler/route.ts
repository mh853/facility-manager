import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { analyzeAnnouncement, normalizeDate } from '@/lib/gemini';
import type { CrawlResult, CrawlRequest } from '@/types/subsidy';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

// 크롤러 인증 토큰 (GitHub Actions에서 사용)
const CRAWLER_SECRET = process.env.CRAWLER_SECRET || 'dev-secret';

// 정부 지원사업 통합 포털 (실제 공고 검색 가능)
const SUPPORT_PORTALS = {
  // 기업마당 - 정부 지원사업 통합 포털 (지역별 검색 가능)
  bizinfo: 'https://www.bizinfo.go.kr/web/lay1/bbs/S1T122C128/AS/74/list.do?rows=10&cpage=1&pblancNm=대기배출',
  // 코네틱 - 환경산업기술정보시스템
  konetic: 'https://konetic.or.kr/user/T/TB/TB003_L02.do',
  // 그린링크 - 소규모 대기배출시설 관리시스템
  greenlink: 'https://www.greenlink.or.kr/web/link/?pMENU_ID=60',
  // 경기도환경에너지진흥원 - 대기분야 지원사업
  ggeea: 'https://www.ggeea.or.kr/news?sca=대기물산업지원팀',
};

// 크롤링 대상 지자체 목록 (기업마당 지역 검색 URL 사용)
const GOVERNMENT_SOURCES = [
  // 광역시도 - 기업마당 지역별 환경 지원사업 검색 URL
  { region_code: '11', region_name: '서울특별시', region_type: 'metropolitan' as const, announcement_url: 'https://www.bizinfo.go.kr/web/lay1/bbs/S1T122C128/AS/74/list.do?rows=10&cpage=1&pblancNm=대기배출&areaCd=11' },
  { region_code: '26', region_name: '부산광역시', region_type: 'metropolitan' as const, announcement_url: 'https://www.bizinfo.go.kr/web/lay1/bbs/S1T122C128/AS/74/list.do?rows=10&cpage=1&pblancNm=대기배출&areaCd=26' },
  { region_code: '27', region_name: '대구광역시', region_type: 'metropolitan' as const, announcement_url: 'https://www.bizinfo.go.kr/web/lay1/bbs/S1T122C128/AS/74/list.do?rows=10&cpage=1&pblancNm=대기배출&areaCd=27' },
  { region_code: '28', region_name: '인천광역시', region_type: 'metropolitan' as const, announcement_url: 'https://www.bizinfo.go.kr/web/lay1/bbs/S1T122C128/AS/74/list.do?rows=10&cpage=1&pblancNm=대기배출&areaCd=28' },
  { region_code: '29', region_name: '광주광역시', region_type: 'metropolitan' as const, announcement_url: 'https://www.bizinfo.go.kr/web/lay1/bbs/S1T122C128/AS/74/list.do?rows=10&cpage=1&pblancNm=대기배출&areaCd=29' },
  { region_code: '30', region_name: '대전광역시', region_type: 'metropolitan' as const, announcement_url: 'https://www.bizinfo.go.kr/web/lay1/bbs/S1T122C128/AS/74/list.do?rows=10&cpage=1&pblancNm=대기배출&areaCd=30' },
  { region_code: '31', region_name: '울산광역시', region_type: 'metropolitan' as const, announcement_url: 'https://www.bizinfo.go.kr/web/lay1/bbs/S1T122C128/AS/74/list.do?rows=10&cpage=1&pblancNm=대기배출&areaCd=31' },
  { region_code: '36', region_name: '세종특별자치시', region_type: 'metropolitan' as const, announcement_url: 'https://www.bizinfo.go.kr/web/lay1/bbs/S1T122C128/AS/74/list.do?rows=10&cpage=1&pblancNm=대기배출&areaCd=36' },
  { region_code: '41', region_name: '경기도', region_type: 'metropolitan' as const, announcement_url: 'https://www.bizinfo.go.kr/web/lay1/bbs/S1T122C128/AS/74/list.do?rows=10&cpage=1&pblancNm=대기배출&areaCd=41' },
  { region_code: '42', region_name: '강원특별자치도', region_type: 'metropolitan' as const, announcement_url: 'https://www.bizinfo.go.kr/web/lay1/bbs/S1T122C128/AS/74/list.do?rows=10&cpage=1&pblancNm=대기배출&areaCd=42' },
  { region_code: '43', region_name: '충청북도', region_type: 'metropolitan' as const, announcement_url: 'https://www.bizinfo.go.kr/web/lay1/bbs/S1T122C128/AS/74/list.do?rows=10&cpage=1&pblancNm=대기배출&areaCd=43' },
  { region_code: '44', region_name: '충청남도', region_type: 'metropolitan' as const, announcement_url: 'https://www.bizinfo.go.kr/web/lay1/bbs/S1T122C128/AS/74/list.do?rows=10&cpage=1&pblancNm=대기배출&areaCd=44' },
  { region_code: '45', region_name: '전북특별자치도', region_type: 'metropolitan' as const, announcement_url: 'https://www.bizinfo.go.kr/web/lay1/bbs/S1T122C128/AS/74/list.do?rows=10&cpage=1&pblancNm=대기배출&areaCd=45' },
  { region_code: '46', region_name: '전라남도', region_type: 'metropolitan' as const, announcement_url: 'https://www.bizinfo.go.kr/web/lay1/bbs/S1T122C128/AS/74/list.do?rows=10&cpage=1&pblancNm=대기배출&areaCd=46' },
  { region_code: '47', region_name: '경상북도', region_type: 'metropolitan' as const, announcement_url: 'https://www.bizinfo.go.kr/web/lay1/bbs/S1T122C128/AS/74/list.do?rows=10&cpage=1&pblancNm=대기배출&areaCd=47' },
  { region_code: '48', region_name: '경상남도', region_type: 'metropolitan' as const, announcement_url: 'https://www.bizinfo.go.kr/web/lay1/bbs/S1T122C128/AS/74/list.do?rows=10&cpage=1&pblancNm=대기배출&areaCd=48' },
  { region_code: '50', region_name: '제주특별자치도', region_type: 'metropolitan' as const, announcement_url: 'https://www.bizinfo.go.kr/web/lay1/bbs/S1T122C128/AS/74/list.do?rows=10&cpage=1&pblancNm=대기배출&areaCd=50' },
  // 기초지자체 샘플 - 상위 광역시도 검색 URL 사용
  { region_code: '11680', region_name: '서울 강남구', region_type: 'basic' as const, announcement_url: 'https://www.bizinfo.go.kr/web/lay1/bbs/S1T122C128/AS/74/list.do?rows=10&cpage=1&pblancNm=대기배출&areaCd=11' },
  { region_code: '11740', region_name: '서울 강동구', region_type: 'basic' as const, announcement_url: 'https://www.bizinfo.go.kr/web/lay1/bbs/S1T122C128/AS/74/list.do?rows=10&cpage=1&pblancNm=대기배출&areaCd=11' },
  { region_code: '26440', region_name: '부산 해운대구', region_type: 'basic' as const, announcement_url: 'https://www.bizinfo.go.kr/web/lay1/bbs/S1T122C128/AS/74/list.do?rows=10&cpage=1&pblancNm=대기배출&areaCd=26' },
  { region_code: '41111', region_name: '경기 수원시', region_type: 'basic' as const, announcement_url: 'https://www.bizinfo.go.kr/web/lay1/bbs/S1T122C128/AS/74/list.do?rows=10&cpage=1&pblancNm=대기배출&areaCd=41' },
  { region_code: '41131', region_name: '경기 성남시', region_type: 'basic' as const, announcement_url: 'https://www.bizinfo.go.kr/web/lay1/bbs/S1T122C128/AS/74/list.do?rows=10&cpage=1&pblancNm=대기배출&areaCd=41' },
];

// POST: 크롤링 실행
export async function POST(request: NextRequest) {
  const startTime = Date.now();

  try {
    // 인증 확인
    const authHeader = request.headers.get('authorization');
    if (authHeader !== `Bearer ${CRAWLER_SECRET}`) {
      return NextResponse.json({
        success: false,
        error: '인증 실패'
      }, { status: 401 });
    }

    const body: CrawlRequest = await request.json().catch(() => ({}));
    const { region_codes, force } = body;

    // 크롤링 대상 지자체 결정
    let targets = GOVERNMENT_SOURCES;
    if (region_codes && region_codes.length > 0) {
      targets = targets.filter(t => region_codes.includes(t.region_code));
    }

    const results: CrawlResult = {
      success: true,
      total_regions: targets.length,
      successful_regions: 0,
      failed_regions: 0,
      new_announcements: 0,
      relevant_announcements: 0,
      duration_ms: 0,
      errors: [],
    };

    // 각 지자체 크롤링 (실제 구현 시 병렬 처리)
    for (const source of targets) {
      try {
        // 실제 크롤링 로직 (데모용 시뮬레이션)
        const announcements = await crawlGovernmentSite(source);

        for (const announcement of announcements) {
          // 중복 체크 (region_code + title 조합으로 변경 - 공고 게시판 URL이 같을 수 있음)
          const { data: existing } = await supabase
            .from('subsidy_announcements')
            .select('id')
            .eq('region_code', source.region_code)
            .eq('title', announcement.title)
            .single();

          if (existing && !force) {
            continue; // 이미 존재하는 공고 스킵
          }

          // AI 분석
          const analysis = await analyzeAnnouncement(
            announcement.title,
            announcement.content || ''
          );

          // 직접 추출 데이터 (폴백용)
          const fallbackData = announcement.extracted_data;

          // 데이터 저장 (AI 분석 + 폴백 데이터 병합)
          const insertData = {
            region_code: source.region_code,
            region_name: source.region_name,
            region_type: source.region_type,
            title: announcement.title,
            content: announcement.content,
            source_url: announcement.source_url,
            published_at: announcement.published_at,
            // AI 분석 결과
            is_relevant: analysis.is_relevant,
            relevance_score: analysis.relevance_score,
            keywords_matched: analysis.keywords_matched,
            // AI 추출 데이터 (없으면 폴백 데이터 사용)
            application_period_start: normalizeDate(analysis.extracted_info.application_period_start) || fallbackData?.application_period_start || null,
            application_period_end: normalizeDate(analysis.extracted_info.application_period_end) || fallbackData?.application_period_end || null,
            budget: analysis.extracted_info.budget || fallbackData?.budget || null,
            target_description: analysis.extracted_info.target_description || fallbackData?.target_description || null,
            support_amount: analysis.extracted_info.support_amount || fallbackData?.support_amount || null,
          };

          const { error } = await supabase
            .from('subsidy_announcements')
            .upsert(insertData, { onConflict: 'source_url' });

          if (!error) {
            results.new_announcements++;
            if (analysis.is_relevant) {
              results.relevant_announcements++;
            }
          }
        }

        results.successful_regions++;

      } catch (error) {
        results.failed_regions++;
        results.errors?.push({
          region_code: source.region_code,
          error: error instanceof Error ? error.message : '알 수 없는 오류',
        });
      }
    }

    results.duration_ms = Date.now() - startTime;

    // 크롤링 로그 저장
    await supabase.from('crawl_logs').insert({
      status: results.failed_regions === 0 ? 'success' : results.successful_regions > 0 ? 'partial' : 'failed',
      announcements_found: results.new_announcements,
      relevant_found: results.relevant_announcements,
      duration_ms: results.duration_ms,
      error_message: results.errors?.length ? JSON.stringify(results.errors) : null,
    });

    return NextResponse.json(results);

  } catch (error) {
    console.error('크롤러 오류:', error);

    // 오류 로그 저장
    await supabase.from('crawl_logs').insert({
      status: 'failed',
      error_message: error instanceof Error ? error.message : '알 수 없는 오류',
      duration_ms: Date.now() - startTime,
    });

    return NextResponse.json({
      success: false,
      error: '크롤링 실패'
    }, { status: 500 });
  }
}

// 크롤링된 공고 데이터 인터페이스
interface CrawledAnnouncement {
  title: string;
  content: string;
  source_url: string;  // 실제 공고 상세 페이지 URL
  published_at: string;
  // 직접 추출된 데이터 (AI 분석 폴백용)
  extracted_data?: {
    application_period_start?: string;
    application_period_end?: string;
    budget?: string;
    target_description?: string;
    support_amount?: string;
  };
}

// 기업마당 공고 상세 URL 생성
const BIZINFO_DETAIL_URL = 'https://www.bizinfo.go.kr/web/lay1/bbs/S1T122C128/AS/74/view.do?pblancId=';

// 실제 기업마당 크롤링 함수
async function crawlGovernmentSite(source: typeof GOVERNMENT_SOURCES[0]): Promise<CrawledAnnouncement[]> {
  const announcements: CrawledAnnouncement[] = [];

  try {
    console.log(`[CRAWLER] ${source.region_name} 크롤링 시작: ${source.announcement_url}`);

    // 기업마당 검색 페이지 요청
    const response = await fetch(source.announcement_url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7',
      },
      // Vercel Edge에서 타임아웃 설정
      signal: AbortSignal.timeout(10000),
    });

    if (!response.ok) {
      console.error(`[CRAWLER] ${source.region_name} HTTP 오류: ${response.status}`);
      return [];
    }

    const html = await response.text();

    // 공고 ID 추출 (pblancId 패턴)
    // 패턴: view.do?pblancId=PBLN_000000000XXXXXX 또는 fnView('PBLN_000000000XXXXXX')
    const pblancIdPattern = /(?:pblancId=|fnView\(['"])(PBLN_\d+)(?:['"]?\))?/g;
    const titlePattern = /<td[^>]*class="[^"]*tit[^"]*"[^>]*>[\s\S]*?<a[^>]*>([\s\S]*?)<\/a>/gi;

    // 공고 ID 추출
    const pblancIds: string[] = [];
    let match;
    while ((match = pblancIdPattern.exec(html)) !== null) {
      if (!pblancIds.includes(match[1])) {
        pblancIds.push(match[1]);
      }
    }

    // 공고 제목 추출 (간단한 정규식)
    const titles: string[] = [];
    const simpleTitlePattern = /<a[^>]*onclick="[^"]*fnView[^"]*"[^>]*>([^<]+)<\/a>/gi;
    while ((match = simpleTitlePattern.exec(html)) !== null) {
      const title = match[1].trim().replace(/\s+/g, ' ');
      if (title && title.length > 5) {
        titles.push(title);
      }
    }

    console.log(`[CRAWLER] ${source.region_name}: ${pblancIds.length}개 공고 ID 발견, ${titles.length}개 제목 발견`);

    // 공고 데이터 생성 (최대 5개)
    const maxAnnouncements = Math.min(pblancIds.length, titles.length, 5);

    for (let i = 0; i < maxAnnouncements; i++) {
      const pblancId = pblancIds[i];
      const title = titles[i] || `[${source.region_name}] 지원사업 공고`;
      const detailUrl = `${BIZINFO_DETAIL_URL}${pblancId}`;

      // 공고 상세 정보 가져오기 (선택적)
      let content = '';
      let extractedData: CrawledAnnouncement['extracted_data'] = undefined;

      try {
        const detailInfo = await fetchAnnouncementDetail(detailUrl);
        content = detailInfo.content;
        extractedData = detailInfo.extractedData;
      } catch (detailError) {
        console.warn(`[CRAWLER] 상세 정보 조회 실패 (${pblancId}):`, detailError);
        content = `${source.region_name} 지원사업 공고입니다.\n원문보기를 클릭하여 상세 내용을 확인하세요.`;
      }

      announcements.push({
        title: `[${source.region_name}] ${title}`,
        content,
        source_url: detailUrl,  // 실제 공고 상세 페이지 URL
        published_at: new Date().toISOString(),
        extracted_data: extractedData,
      });
    }

    // 공고를 찾지 못한 경우 - 지역 검색 페이지 링크 제공
    if (announcements.length === 0) {
      console.log(`[CRAWLER] ${source.region_name}: 관련 공고 없음, 검색 링크 제공`);
      announcements.push({
        title: `[${source.region_name}] 대기배출 관련 지원사업 검색`,
        content: `${source.region_name} 지역의 대기배출 관련 지원사업을 검색합니다.\n\n원문보기를 클릭하여 최신 공고를 확인하세요.`,
        source_url: source.announcement_url,  // 검색 결과 페이지
        published_at: new Date().toISOString(),
      });
    }

    return announcements;

  } catch (error) {
    console.error(`[CRAWLER] ${source.region_name} 크롤링 오류:`, error);

    // 오류 시 검색 페이지 링크 제공
    return [{
      title: `[${source.region_name}] 대기배출 관련 지원사업`,
      content: `크롤링 중 오류가 발생했습니다.\n원문보기를 클릭하여 직접 확인해주세요.`,
      source_url: source.announcement_url,
      published_at: new Date().toISOString(),
    }];
  }
}

// 공고 상세 페이지에서 정보 추출
async function fetchAnnouncementDetail(detailUrl: string): Promise<{
  content: string;
  extractedData?: CrawledAnnouncement['extracted_data'];
}> {
  try {
    const response = await fetch(detailUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'ko-KR,ko;q=0.9',
      },
      signal: AbortSignal.timeout(8000),
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const html = await response.text();

    // 간단한 내용 추출
    let content = '';

    // 지원대상, 지원내용 등 주요 정보 추출 시도
    const infoPatterns = [
      { label: '지원대상', pattern: /지원\s*대상[:\s]*([^<\n]{10,200})/i },
      { label: '지원내용', pattern: /지원\s*내용[:\s]*([^<\n]{10,200})/i },
      { label: '신청기간', pattern: /신청\s*기간[:\s]*([^<\n]{10,100})/i },
      { label: '접수기간', pattern: /접수\s*기간[:\s]*([^<\n]{10,100})/i },
      { label: '지원금액', pattern: /지원\s*금액[:\s]*([^<\n]{10,100})/i },
      { label: '예산', pattern: /예\s*산[:\s]*([^<\n]{5,50})/i },
    ];

    const extractedInfo: string[] = [];
    const extractedData: CrawledAnnouncement['extracted_data'] = {};

    for (const { label, pattern } of infoPatterns) {
      const match = html.match(pattern);
      if (match) {
        const value = match[1].replace(/<[^>]*>/g, '').trim();
        extractedInfo.push(`◈ ${label}: ${value}`);

        // 구조화된 데이터 저장
        if (label === '지원대상') extractedData.target_description = value;
        if (label === '지원금액') extractedData.support_amount = value;
        if (label === '예산') extractedData.budget = value;
        if (label === '신청기간' || label === '접수기간') {
          // 날짜 파싱 시도
          const dateMatch = value.match(/(\d{4})[.\-\/](\d{1,2})[.\-\/](\d{1,2})/g);
          if (dateMatch && dateMatch.length >= 2) {
            extractedData.application_period_start = dateMatch[0].replace(/[.\-\/]/g, '-');
            extractedData.application_period_end = dateMatch[1].replace(/[.\-\/]/g, '-');
          }
        }
      }
    }

    if (extractedInfo.length > 0) {
      content = extractedInfo.join('\n');
    } else {
      content = '상세 내용은 원문보기를 통해 확인하세요.';
    }

    return {
      content,
      extractedData: Object.keys(extractedData).length > 0 ? extractedData : undefined,
    };

  } catch (error) {
    console.warn(`[CRAWLER] 상세 페이지 조회 실패:`, error);
    return {
      content: '상세 내용은 원문보기를 통해 확인하세요.',
    };
  }
}

// GET: 크롤러 상태 확인
export async function GET(request: NextRequest) {
  try {
    // 최근 크롤링 로그 조회
    const { data: logs } = await supabase
      .from('crawl_logs')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(10);

    // 지자체 목록 조회
    const { count: regionCount } = await supabase
      .from('local_governments')
      .select('*', { count: 'exact', head: true })
      .eq('is_active', true);

    return NextResponse.json({
      success: true,
      data: {
        active_regions: regionCount || GOVERNMENT_SOURCES.length,
        recent_logs: logs || [],
        crawler_status: 'ready',
      }
    });

  } catch (error) {
    console.error('크롤러 상태 조회 오류:', error);
    return NextResponse.json({
      success: false,
      error: '상태 조회 실패'
    }, { status: 500 });
  }
}
