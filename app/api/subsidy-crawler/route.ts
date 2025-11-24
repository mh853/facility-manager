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

// 데모 공고 데이터 인터페이스
interface DemoAnnouncement {
  title: string;
  content: string;
  source_url: string;
  published_at: string;
  // 직접 추출된 데이터 (AI 분석 폴백용)
  extracted_data: {
    application_period_start: string;
    application_period_end: string;
    budget: string;
    target_description: string;
    support_amount: string;
  };
}

// 실제 지자체 사이트 크롤링 함수
async function crawlGovernmentSite(source: typeof GOVERNMENT_SOURCES[0]): Promise<DemoAnnouncement[]> {
  // 🚧 실제 구현 시:
  // 1. 각 지자체별 공고 페이지 구조 분석
  // 2. Puppeteer/Playwright로 동적 페이지 처리
  // 3. 공고 목록 → 상세 페이지 순회
  // 4. 제목, 내용, 첨부파일 추출

  // 현재: 데모 데이터 생성 (실제 크롤링 구현 전까지)
  const today = new Date();

  // 다양한 공고 유형 생성
  const announcementTypes = [
    {
      titlePrefix: '소규모 사업장 대기오염 방지시설 IoT 설치 지원사업',
      keywords: ['대기배출시설', 'IoT', '굴뚝 자동측정기기', 'TMS'],
      budget: '5억원 (약 100개소)',
      supportAmount: '업체당 최대 500만원',
      target: '관내 1~3종 대기배출시설 보유 사업장',
    },
    {
      titlePrefix: '미세먼지 저감 스마트 모니터링 시스템 보급사업',
      keywords: ['미세먼지', '스마트 모니터링', '대기질 측정'],
      budget: '3억원 (약 60개소)',
      supportAmount: '업체당 최대 300만원',
      target: '관내 소규모 제조업체',
    },
    {
      titlePrefix: '환경오염 방지시설 스마트화 지원사업',
      keywords: ['환경오염', '방지시설', 'IoT', '스마트화'],
      budget: '10억원 (약 100개소)',
      supportAmount: '업체당 최대 1,000만원',
      target: '관내 환경오염 방지시설 보유 사업장',
    },
  ];

  // 지역별로 다른 공고 유형 선택 (region_code 기반)
  const typeIndex = parseInt(source.region_code.slice(-1)) % announcementTypes.length;
  const announcementType = announcementTypes[typeIndex];

  // 신청 기간 계산 (오늘부터 2개월)
  const startDate = new Date(today);
  startDate.setDate(startDate.getDate() + 7); // 1주일 후 시작
  const endDate = new Date(startDate);
  endDate.setMonth(endDate.getMonth() + 2); // 2개월간

  // ISO 날짜 형식 (데이터베이스 저장용)
  const formatISODate = (d: Date) => d.toISOString().split('T')[0];
  // 한국어 날짜 형식 (콘텐츠 표시용)
  const formatKRDate = (d: Date) => `${d.getFullYear()}년 ${d.getMonth() + 1}월 ${d.getDate()}일`;

  const demoAnnouncements: DemoAnnouncement[] = [
    {
      title: `[${source.region_name}] 2025년 ${announcementType.titlePrefix} 공고`,
      content: `
        ${source.region_name}에서는 관내 사업장을 대상으로
        ${announcementType.titlePrefix}을 실시합니다.

        ◈ 지원대상: ${announcementType.target}
        ◈ 지원내용: ${announcementType.keywords.join(', ')} 설치비 지원
        ◈ 지원금액: ${announcementType.supportAmount}
        ◈ 신청기간: ${formatKRDate(startDate)} ~ ${formatKRDate(endDate)}
        ◈ 총 예산: ${announcementType.budget}

        ※ 관련 키워드: ${announcementType.keywords.join(', ')}

        ■ 원문보기 클릭 시
        → 기업마당(bizinfo.go.kr) ${source.region_name} 대기배출 관련 지원사업 목록으로 이동
        → 실제 공고문을 바로 확인할 수 있습니다

        문의: ${source.region_name} 환경과
      `,
      // 실제 지자체 공고 게시판 URL로 연결
      source_url: source.announcement_url,
      published_at: today.toISOString(),
      // AI 분석 폴백용 직접 추출 데이터
      extracted_data: {
        application_period_start: formatISODate(startDate),
        application_period_end: formatISODate(endDate),
        budget: announcementType.budget,
        target_description: announcementType.target,
        support_amount: announcementType.supportAmount,
      },
    },
  ];

  return demoAnnouncements;
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
