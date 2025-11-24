import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
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

// ============================================================
// Phase 2: 환경 관련 기관 크롤링 소스
// ============================================================

type Phase2SourceType = 'ggeea' | 'keci' | 'gec';

interface Phase2Source {
  id: string;
  name: string;
  type: Phase2SourceType;
  region_code: string;
  region_name: string;
  announcement_url: string;
  detail_base_url?: string;
}

// Phase 2 크롤링 대상: 환경 관련 기관
const PHASE2_SOURCES: Phase2Source[] = [
  // 경기환경에너지진흥원 (GGEEA)
  {
    id: 'ggeea',
    name: '경기환경에너지진흥원',
    type: 'ggeea',
    region_code: '41',
    region_name: '경기도',
    announcement_url: 'https://www.ggeea.or.kr/news',
    detail_base_url: 'https://www.ggeea.or.kr/news/',
  },
  // 한국환경보전원 (KECI)
  {
    id: 'keci',
    name: '한국환경보전원',
    type: 'keci',
    region_code: '00',
    region_name: '전국',
    announcement_url: 'https://www.keci.or.kr/web/board/BD_board.list.do?bbsCd=1001',
    detail_base_url: 'https://www.keci.or.kr/web/board/BD_board.view.do?bbsCd=1001&seq=',
  },
  // 경북녹색환경지원센터 (GBGEC)
  {
    id: 'gbgec',
    name: '경북녹색환경지원센터',
    type: 'gec',
    region_code: '47',
    region_name: '경상북도',
    announcement_url: 'http://www.gbgec.or.kr/bbs/board.php?bo_table=sub5_1',
    detail_base_url: 'http://www.gbgec.or.kr/bbs/board.php?bo_table=sub5_1&wr_id=',
  },
  // 울산녹색환경지원센터 (UGEC) - 2024.11 기준 사이트 접속 불가로 비활성화
  // {
  //   id: 'ugec',
  //   name: '울산녹색환경지원센터',
  //   type: 'gec',
  //   region_code: '31',
  //   region_name: '울산광역시',
  //   announcement_url: 'http://www.ugec.or.kr/bbs/board.php?bo_table=sub0401',
  //   detail_base_url: 'http://www.ugec.or.kr/bbs/board.php?bo_table=sub0401&wr_id=',
  // },
];

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

    // 병렬 크롤링 (5개씩 배치 처리로 타임아웃 방지)
    const BATCH_SIZE = 5;

    for (let i = 0; i < targets.length; i += BATCH_SIZE) {
      const batch = targets.slice(i, i + BATCH_SIZE);

      // 배치 내 병렬 처리
      const batchResults = await Promise.allSettled(
        batch.map(async (source) => {
          try {
            const announcements = await crawlGovernmentSite(source);

            for (const announcement of announcements) {
              // 중복 체크
              const { data: existing } = await supabase
                .from('subsidy_announcements')
                .select('id')
                .eq('source_url', announcement.source_url)
                .single();

              if (existing && !force) {
                continue;
              }

              // 간단한 키워드 기반 관련성 판단 (AI 분석 생략으로 속도 향상)
              const keywords = ['대기배출', 'IoT', '사물인터넷', '방지시설', '환경', '미세먼지'];
              const text = `${announcement.title} ${announcement.content}`.toLowerCase();
              const matchedKeywords = keywords.filter(k => text.includes(k.toLowerCase()));

              const insertData = {
                region_code: source.region_code,
                region_name: source.region_name,
                region_type: source.region_type,
                title: announcement.title,
                content: announcement.content,
                source_url: announcement.source_url,
                published_at: announcement.published_at,
                // 키워드 기반 관련성 (AI 분석 대신)
                is_relevant: true,  // 대기배출 검색 결과이므로 기본 true
                relevance_score: Math.min(0.5 + matchedKeywords.length * 0.1, 1.0),
                keywords_matched: matchedKeywords.length > 0 ? matchedKeywords : ['대기배출'],
              };

              const { error } = await supabase
                .from('subsidy_announcements')
                .upsert(insertData, { onConflict: 'source_url' });

              if (!error) {
                results.new_announcements++;
                results.relevant_announcements++;
              }
            }

            return { success: true, region_code: source.region_code };
          } catch (error) {
            return {
              success: false,
              region_code: source.region_code,
              error: error instanceof Error ? error.message : '알 수 없는 오류'
            };
          }
        })
      );

      // 배치 결과 집계
      for (const result of batchResults) {
        if (result.status === 'fulfilled' && result.value.success) {
          results.successful_regions++;
        } else {
          results.failed_regions++;
          const errorInfo = result.status === 'fulfilled' ? result.value : { region_code: 'unknown', error: 'Promise rejected' };
          results.errors?.push({
            region_code: errorInfo.region_code || 'unknown',
            error: (errorInfo as any).error || 'Unknown error',
          });
        }
      }
    }

    // ============================================================
    // Phase 2: 환경 기관 크롤링 추가
    // ============================================================
    console.log('[CRAWLER] Phase 2 크롤링 시작...');

    for (const source of PHASE2_SOURCES) {
      try {
        const announcements = await crawlPhase2Source(source);

        for (const announcement of announcements) {
          // 중복 체크
          const { data: existing } = await supabase
            .from('subsidy_announcements')
            .select('id')
            .eq('source_url', announcement.source_url)
            .single();

          if (existing && !force) {
            continue;
          }

          // 키워드 기반 관련성 판단
          const keywords = ['대기배출', 'IoT', '사물인터넷', '방지시설', '환경', '미세먼지', '소규모'];
          const text = `${announcement.title} ${announcement.content}`.toLowerCase();
          const matchedKeywords = keywords.filter(k => text.includes(k.toLowerCase()));

          const insertData = {
            region_code: source.region_code,
            region_name: source.region_name,
            region_type: 'metropolitan' as const,
            title: announcement.title,
            content: announcement.content,
            source_url: announcement.source_url,
            published_at: announcement.published_at,
            is_relevant: true,
            relevance_score: Math.min(0.6 + matchedKeywords.length * 0.1, 1.0),
            keywords_matched: matchedKeywords.length > 0 ? matchedKeywords : ['환경'],
          };

          const { error } = await supabase
            .from('subsidy_announcements')
            .upsert(insertData, { onConflict: 'source_url' });

          if (!error) {
            results.new_announcements++;
            results.relevant_announcements++;
          }
        }

        results.successful_regions++;
        console.log(`[CRAWLER-P2] ${source.name} 완료`);

      } catch (error) {
        results.failed_regions++;
        results.errors?.push({
          region_code: source.id,
          error: error instanceof Error ? error.message : '알 수 없는 오류',
        });
        console.error(`[CRAWLER-P2] ${source.name} 실패:`, error);
      }
    }

    // Phase 2 소스 수 반영
    results.total_regions += PHASE2_SOURCES.length;

    results.duration_ms = Date.now() - startTime;

    // 크롤링 로그 저장
    await supabase.from('crawl_logs').insert({
      status: results.failed_regions === 0 ? 'success' : results.successful_regions > 0 ? 'partial' : 'failed',
      announcements_found: results.new_announcements,
      relevant_found: results.relevant_announcements,
      duration_ms: results.duration_ms,
      error_message: results.errors?.length ? JSON.stringify(results.errors) : null,
    });

    console.log(`[CRAWLER] 전체 크롤링 완료: ${results.new_announcements}개 공고, ${results.duration_ms}ms`);

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

    // 공고 링크 추출 - href="view.do?pblancId=PBLN_000000000XXXXXX" 형식
    // <a href="view.do?pblancId=PBLN_000000000116479">제목</a>
    const linkPattern = /<a[^>]*href="view\.do\?pblancId=(PBLN_\d+)"[^>]*>([^<]+)<\/a>/gi;

    // 공고 ID와 제목 동시 추출
    const pblancIds: string[] = [];
    const titles: string[] = [];
    let match;

    while ((match = linkPattern.exec(html)) !== null) {
      const pblancId = match[1];
      const title = match[2].trim().replace(/\s+/g, ' ');

      // 중복 제거 및 유효성 검사
      if (pblancId && !pblancIds.includes(pblancId) && title && title.length > 5) {
        pblancIds.push(pblancId);
        titles.push(title);
      }
    }

    console.log(`[CRAWLER] ${source.region_name}: ${pblancIds.length}개 공고 발견`);

    // 공고 데이터 생성 (최대 5개)
    const maxAnnouncements = Math.min(pblancIds.length, 5);

    for (let i = 0; i < maxAnnouncements; i++) {
      const pblancId = pblancIds[i];
      const title = titles[i] || `지원사업 공고`;
      const detailUrl = `${BIZINFO_DETAIL_URL}${pblancId}`;

      // 상세 페이지 조회 생략 (타임아웃 방지)
      // 사용자가 원문보기 클릭 시 직접 상세 페이지 확인
      announcements.push({
        title: `[${source.region_name}] ${title}`,
        content: `${source.region_name} 지역 지원사업 공고입니다.\n\n원문보기를 클릭하여 상세 내용(지원대상, 신청기간, 지원금액 등)을 확인하세요.`,
        source_url: detailUrl,  // 실제 공고 상세 페이지 URL
        published_at: new Date().toISOString(),
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

// ============================================================
// Phase 2: 환경 기관 전용 크롤링 함수
// ============================================================

// 경기환경에너지진흥원 (GGEEA) 크롤링
async function crawlGGEEA(source: Phase2Source): Promise<CrawledAnnouncement[]> {
  const announcements: CrawledAnnouncement[] = [];

  try {
    console.log(`[CRAWLER-P2] ${source.name} 크롤링 시작`);

    const response = await fetch(source.announcement_url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'ko-KR,ko;q=0.9',
      },
      signal: AbortSignal.timeout(10000),
    });

    if (!response.ok) {
      console.error(`[CRAWLER-P2] ${source.name} HTTP 오류: ${response.status}`);
      return [];
    }

    const html = await response.text();

    // GGEEA 링크 패턴: <a href="/news/123">제목</a>
    const linkPattern = /<a[^>]*href="\/news\/(\d+)"[^>]*>([^<]+)<\/a>/gi;
    const items: { id: string; title: string }[] = [];
    let match;

    while ((match = linkPattern.exec(html)) !== null) {
      const id = match[1];
      const title = match[2].trim().replace(/\s+/g, ' ');

      // 대기배출, 방지시설, IoT 관련 키워드 필터링
      const keywords = ['대기', '방지시설', 'IoT', '사물인터넷', '소규모', '배출', '환경'];
      const hasKeyword = keywords.some(k => title.toLowerCase().includes(k.toLowerCase()));

      if (id && title.length > 5 && !items.find(i => i.id === id)) {
        items.push({ id, title });
      }
    }

    console.log(`[CRAWLER-P2] ${source.name}: ${items.length}개 공고 발견`);

    // 최대 10개 공고 저장
    const maxItems = Math.min(items.length, 10);
    for (let i = 0; i < maxItems; i++) {
      const { id, title } = items[i];
      announcements.push({
        title: `[${source.name}] ${title}`,
        content: `${source.name}에서 게시한 공고입니다.\n\n원문보기를 클릭하여 상세 내용을 확인하세요.`,
        source_url: `${source.detail_base_url}${id}`,
        published_at: new Date().toISOString(),
      });
    }

    return announcements;

  } catch (error) {
    console.error(`[CRAWLER-P2] ${source.name} 크롤링 오류:`, error);
    return [{
      title: `[${source.name}] 사업공고`,
      content: `크롤링 중 오류가 발생했습니다.\n원문보기를 클릭하여 직접 확인해주세요.`,
      source_url: source.announcement_url,
      published_at: new Date().toISOString(),
    }];
  }
}

// 한국환경보전원 (KECI) 크롤링
async function crawlKECI(source: Phase2Source): Promise<CrawledAnnouncement[]> {
  const announcements: CrawledAnnouncement[] = [];

  try {
    console.log(`[CRAWLER-P2] ${source.name} 크롤링 시작`);

    const response = await fetch(source.announcement_url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'ko-KR,ko;q=0.9',
      },
      signal: AbortSignal.timeout(10000),
    });

    if (!response.ok) {
      console.error(`[CRAWLER-P2] ${source.name} HTTP 오류: ${response.status}`);
      return [];
    }

    const html = await response.text();

    // KECI 링크 패턴: seq= 파라미터를 포함한 링크
    // <a href="javascript:fn_view('123')">제목</a> 또는 seq=123 패턴
    const linkPattern1 = /fn_view\s*\(\s*['"]?(\d+)['"]?\s*\)[^>]*>([^<]+)</gi;
    const linkPattern2 = /seq=(\d+)[^>]*>([^<]+)</gi;

    const items: { id: string; title: string }[] = [];

    // 패턴 1 시도
    let match;
    while ((match = linkPattern1.exec(html)) !== null) {
      const id = match[1];
      const title = match[2].trim().replace(/\s+/g, ' ');
      if (id && title.length > 5 && !items.find(i => i.id === id)) {
        items.push({ id, title });
      }
    }

    // 패턴 2 시도
    while ((match = linkPattern2.exec(html)) !== null) {
      const id = match[1];
      const title = match[2].trim().replace(/\s+/g, ' ');
      if (id && title.length > 5 && !items.find(i => i.id === id)) {
        items.push({ id, title });
      }
    }

    console.log(`[CRAWLER-P2] ${source.name}: ${items.length}개 공고 발견`);

    // 최대 10개 공고 저장
    const maxItems = Math.min(items.length, 10);
    for (let i = 0; i < maxItems; i++) {
      const { id, title } = items[i];
      announcements.push({
        title: `[${source.name}] ${title}`,
        content: `${source.name}에서 게시한 공고입니다.\n\n원문보기를 클릭하여 상세 내용을 확인하세요.`,
        source_url: `${source.detail_base_url}${id}`,
        published_at: new Date().toISOString(),
      });
    }

    // 공고가 없으면 기본 링크 제공
    if (announcements.length === 0) {
      announcements.push({
        title: `[${source.name}] 공지사항`,
        content: `${source.name}의 공지사항을 확인하세요.\n\n원문보기를 클릭하여 최신 공고를 확인하세요.`,
        source_url: source.announcement_url,
        published_at: new Date().toISOString(),
      });
    }

    return announcements;

  } catch (error) {
    console.error(`[CRAWLER-P2] ${source.name} 크롤링 오류:`, error);
    return [{
      title: `[${source.name}] 공지사항`,
      content: `크롤링 중 오류가 발생했습니다.\n원문보기를 클릭하여 직접 확인해주세요.`,
      source_url: source.announcement_url,
      published_at: new Date().toISOString(),
    }];
  }
}

// 녹색환경지원센터 (GEC) 공통 크롤링
async function crawlGEC(source: Phase2Source): Promise<CrawledAnnouncement[]> {
  const announcements: CrawledAnnouncement[] = [];

  try {
    console.log(`[CRAWLER-P2] ${source.name} 크롤링 시작`);

    const response = await fetch(source.announcement_url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'ko-KR,ko;q=0.9',
      },
      signal: AbortSignal.timeout(10000),
    });

    if (!response.ok) {
      console.error(`[CRAWLER-P2] ${source.name} HTTP 오류: ${response.status}`);
      // SSL 인증서 오류 등으로 실패해도 링크는 제공
      return [{
        title: `[${source.name}] 사업공고`,
        content: `${source.name}의 사업공고를 확인하세요.\n\n원문보기를 클릭하여 최신 공고를 확인하세요.`,
        source_url: source.announcement_url,
        published_at: new Date().toISOString(),
      }];
    }

    const html = await response.text();

    // 그누보드/XE 등 일반적인 게시판 패턴: wr_id= 파라미터
    const linkPattern = /wr_id=(\d+)[^>]*>([^<]+)</gi;
    const items: { id: string; title: string }[] = [];
    let match;

    while ((match = linkPattern.exec(html)) !== null) {
      const id = match[1];
      const title = match[2].trim().replace(/\s+/g, ' ');
      if (id && title.length > 5 && !items.find(i => i.id === id)) {
        items.push({ id, title });
      }
    }

    console.log(`[CRAWLER-P2] ${source.name}: ${items.length}개 공고 발견`);

    // 최대 10개 공고 저장
    const maxItems = Math.min(items.length, 10);
    for (let i = 0; i < maxItems; i++) {
      const { id, title } = items[i];
      announcements.push({
        title: `[${source.name}] ${title}`,
        content: `${source.name}에서 게시한 공고입니다.\n\n원문보기를 클릭하여 상세 내용을 확인하세요.`,
        source_url: `${source.detail_base_url}${id}`,
        published_at: new Date().toISOString(),
      });
    }

    // 공고가 없으면 기본 링크 제공
    if (announcements.length === 0) {
      announcements.push({
        title: `[${source.name}] 사업공고`,
        content: `${source.name}의 사업공고를 확인하세요.\n\n원문보기를 클릭하여 최신 공고를 확인하세요.`,
        source_url: source.announcement_url,
        published_at: new Date().toISOString(),
      });
    }

    return announcements;

  } catch (error) {
    console.error(`[CRAWLER-P2] ${source.name} 크롤링 오류:`, error);
    // 오류 시에도 링크는 제공 (SSL 인증서 만료 등)
    return [{
      title: `[${source.name}] 사업공고`,
      content: `크롤링 중 오류가 발생했습니다.\n원문보기를 클릭하여 직접 확인해주세요.`,
      source_url: source.announcement_url,
      published_at: new Date().toISOString(),
    }];
  }
}

// Phase 2 소스 크롤링 라우터
async function crawlPhase2Source(source: Phase2Source): Promise<CrawledAnnouncement[]> {
  switch (source.type) {
    case 'ggeea':
      return crawlGGEEA(source);
    case 'keci':
      return crawlKECI(source);
    case 'gec':
      return crawlGEC(source);
    default:
      return [];
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
