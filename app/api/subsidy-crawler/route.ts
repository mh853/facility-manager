import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import type { CrawlResult, CrawlRequest } from '@/types/subsidy';
import { analyzeAnnouncement } from '@/lib/gemini';

// Force dynamic rendering and extend timeout for crawler
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 10; // Vercel Hobby: 10초 (GitHub Actions에서 배치 처리)

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

type Phase2SourceType = 'ggeea' | 'keci' | 'gec' | 'geca' | 'gec_gnuboard' | 'gec_cms' | 'gec_igec' | 'gec_jngec' | 'metro_daegu' | 'metro_gyeongbuk' | 'metro_chungnam' | 'metro_generic';

interface Phase2Source {
  id: string;
  name: string;
  type: Phase2SourceType;
  region_code: string;
  region_name: string;
  announcement_url: string;
  detail_base_url?: string;
  // 그누보드용 추가 필드
  bo_table?: string;
  // CMS용 추가 필드
  menu_id?: string;
}

// ============================================================
// 🔑 핵심 키워드 (제목에 반드시 포함되어야 저장)
// ============================================================
const REQUIRED_KEYWORDS = [
  // 핵심 키워드 (하나 이상 반드시 포함)
  '사물인터넷', 'IoT', 'iot', 'IOT',
  '소규모 대기배출', '소규모대기배출', '소규모 대기오염',
  '방지시설', '대기방지시설', '대기오염방지',
  '대기배출시설', '배출시설',
  '굴뚝', 'TMS', '자동측정', '측정기기',
  '환경IoT', '스마트환경', '원격감시',
];

// 제외 키워드 (이 키워드가 포함되면 저장하지 않음)
const EXCLUDE_KEYWORDS = [
  '채용', '모집', '직원', '인력', '구인',
  '입찰', '낙찰', '계약', '용역',
  '결과', '발표', '선정', '합격',
];

// 제목에 필수 키워드 포함 여부 확인
function hasRequiredKeyword(title: string): boolean {
  const lowerTitle = title.toLowerCase();
  return REQUIRED_KEYWORDS.some(k => lowerTitle.includes(k.toLowerCase()));
}

// 제외 키워드 포함 여부 확인
function hasExcludeKeyword(title: string): boolean {
  const lowerTitle = title.toLowerCase();
  return EXCLUDE_KEYWORDS.some(k => lowerTitle.includes(k.toLowerCase()));
}

// 관련성 검사 (제목 기준)
function isRelevantTitle(title: string): boolean {
  return hasRequiredKeyword(title) && !hasExcludeKeyword(title);
}

// IoT/소규모 대기배출시설 관련 키워드 (관련성 점수 계산용)
const IOT_KEYWORDS = [
  ...REQUIRED_KEYWORDS,
  // 추가 관련 키워드 (점수 계산용)
  '미세먼지', '대기관리', '환경모니터링',
  '설치지원', '지원사업', '보조금', '설치비',
];

// Phase 2 크롤링 대상: 환경 관련 기관
const PHASE2_SOURCES: Phase2Source[] = [
  // ============================================================
  // 개별 녹색환경지원센터 (전국 18개 센터)
  // ============================================================

  // --- CMS 패턴 사용 센터 (부산, 대전 등) ---
  {
    id: 'bgec',
    name: '부산녹색환경지원센터',
    type: 'gec_cms',
    region_code: '26',
    region_name: '부산광역시',
    announcement_url: 'http://www.bgec.or.kr/ko/23',
    detail_base_url: 'http://www.bgec.or.kr/ko/23/view?SEQ=',
    menu_id: '23',
  },
  {
    id: 'djgec',
    name: '대전녹색환경지원센터',
    type: 'gec_cms',
    region_code: '30',
    region_name: '대전광역시',
    announcement_url: 'https://www.djgec.or.kr/ko/19',
    detail_base_url: 'https://www.djgec.or.kr/ko/19/view?SEQ=',
    menu_id: '19',
  },
  {
    id: 'gjgec',
    name: '광주녹색환경지원센터',
    type: 'gec_cms',
    region_code: '29',
    region_name: '광주광역시',
    announcement_url: 'http://www.gjgec.or.kr/ko/23',
    detail_base_url: 'http://www.gjgec.or.kr/ko/23/view?SEQ=',
    menu_id: '23',
  },
  {
    id: 'degec',
    name: '대구녹색환경지원센터',
    type: 'gec_cms',
    region_code: '27',
    region_name: '대구광역시',
    announcement_url: 'http://www.degec.or.kr/ko/23',
    detail_base_url: 'http://www.degec.or.kr/ko/23/view?SEQ=',
    menu_id: '23',
  },
  {
    id: 'gngec',
    name: '경남녹색환경지원센터',
    type: 'gec_cms',
    region_code: '48',
    region_name: '경상남도',
    announcement_url: 'https://www.gngec.or.kr/ko/23',
    detail_base_url: 'https://www.gngec.or.kr/ko/23/view?SEQ=',
    menu_id: '23',
  },
  {
    id: 'jbgec',
    name: '전북녹색환경지원센터',
    type: 'gec_cms',
    region_code: '45',
    region_name: '전북특별자치도',
    announcement_url: 'http://www.jbgec.or.kr/ko/23',
    detail_base_url: 'http://www.jbgec.or.kr/ko/23/view?SEQ=',
    menu_id: '23',
  },
  {
    id: 'cbgec',
    name: '충북녹색환경지원센터',
    type: 'gec_cms',
    region_code: '43',
    region_name: '충청북도',
    announcement_url: 'http://www.cbgec.or.kr/ko/23',
    detail_base_url: 'http://www.cbgec.or.kr/ko/23/view?SEQ=',
    menu_id: '23',
  },
  {
    id: 'jgec',
    name: '제주녹색환경지원센터',
    type: 'gec_cms',
    region_code: '50',
    region_name: '제주특별자치도',
    announcement_url: 'http://www.jgec.kr/ko/23',
    detail_base_url: 'http://www.jgec.kr/ko/23/view?SEQ=',
    menu_id: '23',
  },

  // --- 그누보드 패턴 사용 센터 (경북, 충남, 시흥 등) ---
  {
    id: 'gbgec',
    name: '경북녹색환경지원센터',
    type: 'gec_gnuboard',
    region_code: '47',
    region_name: '경상북도',
    announcement_url: 'http://www.gbgec.or.kr/bbs/board.php?bo_table=sub5_1',
    detail_base_url: 'http://www.gbgec.or.kr/bbs/board.php?bo_table=sub5_1&wr_id=',
    bo_table: 'sub5_1',
  },
  {
    id: 'cngec',
    name: '충남녹색환경지원센터',
    type: 'gec_gnuboard',
    region_code: '44',
    region_name: '충청남도',
    announcement_url: 'http://www.cngec.or.kr/bbs/board.php?bo_table=notice',
    detail_base_url: 'http://www.cngec.or.kr/bbs/board.php?bo_table=notice&wr_id=',
    bo_table: 'notice',
  },
  {
    id: 'shgec',
    name: '시흥녹색환경지원센터',
    type: 'gec_gnuboard',
    region_code: '41390',
    region_name: '경기도 시흥시',
    announcement_url: 'http://www.shgec.or.kr/bbs/board.php?bo_table=g81',
    detail_base_url: 'http://www.shgec.or.kr/bbs/board.php?bo_table=g81&wr_id=',
    bo_table: 'g81',
  },

  // --- 커스텀 CMS 패턴 센터 (인천, 전남) ---
  {
    id: 'igec',
    name: '인천녹색환경지원센터',
    type: 'gec_igec',
    region_code: '28',
    region_name: '인천광역시',
    announcement_url: 'https://www.igec.re.kr/notice',
    detail_base_url: 'https://www.igec.re.kr/notice/',
  },
  {
    id: 'jngec',
    name: '전남녹색환경지원센터',
    type: 'gec_jngec',
    region_code: '46',
    region_name: '전라남도',
    announcement_url: 'http://www.jngec.or.kr/rpm.php?rpm=mobile&mode=bbs&doit=list&&id=menu6_1',
    detail_base_url: 'http://www.jngec.or.kr/rpm.php?rpm=mobile&mode=bbs&doit=view&&id=menu6_1&no=',
  },

  // ============================================================
  // 기타 환경 기관
  // ============================================================
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

  // ============================================================
  // 광역시도 환경국/환경과 공지사항
  // ============================================================

  // 대구광역시 환경 분야
  {
    id: 'metro_daegu',
    name: '대구광역시 환경국',
    type: 'metro_daegu',
    region_code: '27',
    region_name: '대구광역시',
    announcement_url: 'https://www.daegu.go.kr/env/index.do?menu_id=00001230&menu_link=/icms/bbs/selectBoardList.do&bbsId=BBS_00029',
    detail_base_url: 'https://www.daegu.go.kr/env/index.do?menu_id=00001230&menu_link=/icms/bbs/selectBoardArticle.do&bbsId=BBS_00029&nttId=',
  },

  // 경상북도 환경 분야
  {
    id: 'metro_gyeongbuk',
    name: '경상북도 환경안전과',
    type: 'metro_gyeongbuk',
    region_code: '47',
    region_name: '경상북도',
    announcement_url: 'https://www.gb.go.kr/Main/open_contents/section/env/page.do?mnu_uid=6292&BD_CODE=environ_notice&cmd=1',
    detail_base_url: 'https://www.gb.go.kr/Main/open_contents/section/env/page.do?mnu_uid=6292&BD_CODE=environ_notice&cmd=2&B_NUM=',
  },

  // 충청남도 환경소식
  {
    id: 'metro_chungnam',
    name: '충청남도 환경산림국',
    type: 'metro_chungnam',
    region_code: '44',
    region_name: '충청남도',
    announcement_url: 'https://www.chungnam.go.kr/cnportal/bbs/B0000243/list.do?menuNo=500346',
    detail_base_url: 'https://www.chungnam.go.kr/cnportal/bbs/B0000243/view.do?menuNo=500346&nttId=',
  },

  // 인천광역시 환경 분야
  {
    id: 'metro_incheon',
    name: '인천광역시 환경국',
    type: 'metro_generic',
    region_code: '28',
    region_name: '인천광역시',
    announcement_url: 'https://www.incheon.go.kr/env/ENV020901',
    detail_base_url: 'https://www.incheon.go.kr/env/ENV020901/',
  },

  // 광주광역시 환경 분야
  {
    id: 'metro_gwangju',
    name: '광주광역시 환경국',
    type: 'metro_generic',
    region_code: '29',
    region_name: '광주광역시',
    announcement_url: 'https://www.gwangju.go.kr/envi/',
    detail_base_url: 'https://www.gwangju.go.kr/envi/',
  },

  // 대전광역시 환경국
  {
    id: 'metro_daejeon',
    name: '대전광역시 환경국',
    type: 'metro_generic',
    region_code: '30',
    region_name: '대전광역시',
    announcement_url: 'https://www.daejeon.go.kr/env/index.do?menuSeq=2673',
    detail_base_url: 'https://www.daejeon.go.kr/drh/depart/board/boardNormalView.do?boardId=normal_0106&menuSeq=2684&ntatcSeq=',
  },

  // 울산광역시 환경녹지국
  {
    id: 'metro_ulsan',
    name: '울산광역시 환경녹지국',
    type: 'metro_generic',
    region_code: '31',
    region_name: '울산광역시',
    announcement_url: 'https://www.ulsan.go.kr/u/envi/contents.ulsan?mId=001002002001000000',
    detail_base_url: 'https://www.ulsan.go.kr/u/envi/',
  },

  // 제주특별자치도 기후환경국
  {
    id: 'metro_jeju',
    name: '제주특별자치도 기후환경국',
    type: 'metro_generic',
    region_code: '50',
    region_name: '제주특별자치도',
    announcement_url: 'https://www.jeju.go.kr/group/part8.htm',
    detail_base_url: 'https://www.jeju.go.kr/group/part8/',
  },
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
  const startedAt = new Date().toISOString();
  let runId: string | null = null; // Track runId for error handling

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
    const { region_codes, force, enable_phase2, batch_num, batch_size } = body;

    // 크롤링 대상 지자체 결정
    let targets = GOVERNMENT_SOURCES;
    if (region_codes && region_codes.length > 0) {
      targets = targets.filter(t => region_codes.includes(t.region_code));
    }

    // Generate unique run_id
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
    const crawlerType = enable_phase2 ? 'phase2' : 'government';
    runId = `run_${crawlerType}_${timestamp}`;

    // Create crawl_run record
    const { data: crawlRun, error: runError } = await supabase
      .from('crawl_runs')
      .insert({
        run_id: runId,
        started_at: startedAt,
        trigger_type: 'manual', // or 'scheduled' from GitHub Actions
        total_batches: 1, // Single batch for government/phase2 crawlers
        total_urls_crawled: 0,
        successful_urls: 0,
        failed_urls: 0,
        total_announcements: 0,
        new_announcements: 0,
        relevant_announcements: 0,
        ai_verified_announcements: 0,
        status: 'running',
      })
      .select()
      .single();

    if (runError) {
      console.error('[CRAWLER] Failed to create crawl_run:', runError);
      throw new Error(`Failed to create crawl_run: ${runError.message}`);
    }

    console.log(`[CRAWLER] Created crawl_run: ${runId}`);

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

              // Gemini AI를 사용한 관련성 분석
              let analysisResult;
              try {
                console.log(`[CRAWLER] Gemini 분석 시작: ${announcement.title.substring(0, 50)}...`);
                analysisResult = await analyzeAnnouncement(
                  announcement.title,
                  announcement.content || ''
                );
                console.log(`[CRAWLER] Gemini 분석 완료: 관련도 ${Math.round(analysisResult.relevance_score * 100)}%`);
              } catch (geminiError) {
                console.warn(`[CRAWLER] Gemini 분석 실패, 키워드 폴백 사용:`, geminiError);
                // 폴백: 키워드 기반 관련성 판단
                const keywords = ['대기배출', 'IoT', '사물인터넷', '방지시설', '환경', '미세먼지'];
                const text = `${announcement.title} ${announcement.content}`.toLowerCase();
                const matchedKeywords = keywords.filter(k => text.includes(k.toLowerCase()));
                analysisResult = {
                  is_relevant: matchedKeywords.length >= 2,
                  relevance_score: Math.min(0.5 + matchedKeywords.length * 0.1, 1.0),
                  keywords_matched: matchedKeywords.length > 0 ? matchedKeywords : ['대기배출'],
                  extracted_info: {},
                };
              }

              const insertData = {
                region_code: source.region_code,
                region_name: source.region_name,
                region_type: source.region_type,
                title: announcement.title,
                content: announcement.content,
                source_url: announcement.source_url,
                published_at: announcement.published_at,
                // Gemini AI 또는 크롤러에서 추출된 상세 정보 (우선순위: Gemini > 크롤러)
                application_period_start: analysisResult.extracted_info?.application_period_start || announcement.application_period_start || null,
                application_period_end: analysisResult.extracted_info?.application_period_end || announcement.application_period_end || null,
                budget: analysisResult.extracted_info?.budget || announcement.budget || null,
                target_description: analysisResult.extracted_info?.target_description || announcement.target_description || null,
                support_amount: analysisResult.extracted_info?.support_amount || announcement.support_amount || null,
                // Gemini AI 관련성 분석 결과
                is_relevant: analysisResult.is_relevant,
                relevance_score: analysisResult.relevance_score,
                keywords_matched: analysisResult.keywords_matched,
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
    // Phase 2: 환경 기관 크롤링 추가 (키워드 필터링 적용)
    // ============================================================
    // Phase 2는 별도 스케줄에서 enable_phase2=true로 실행
    if (enable_phase2) {
      // 배치 처리 로직: 31개 환경센터를 분할하여 처리
      const effectiveBatchSize = batch_size || 8;  // 기본값: 8개씩
      const effectiveBatchNum = batch_num || 1;    // 기본값: 첫 번째 배치

      // 배치 범위 계산
      const startIdx = (effectiveBatchNum - 1) * effectiveBatchSize;
      const endIdx = Math.min(startIdx + effectiveBatchSize, PHASE2_SOURCES.length);
      const batchSources = PHASE2_SOURCES.slice(startIdx, endIdx);

      const totalBatches = Math.ceil(PHASE2_SOURCES.length / effectiveBatchSize);
      const batchInfo = `배치 ${effectiveBatchNum}/${totalBatches}: ${batchSources.length}개 센터 처리`;

      console.log(`[CRAWLER] Phase 2 ${batchInfo} 시작...`);
      console.log(`[CRAWLER] 처리 센터: ${batchSources.map(s => s.name).join(', ')}`);

      for (const source of batchSources) {
      try {
        const announcements = await crawlPhase2Source(source);

        // 🔑 크롤러가 이미 키워드 필터링을 적용하여 관련 공고만 반환
        console.log(`[CRAWLER-P2] ${source.name}: ${announcements.length}개 관련 공고 처리 중`);

        for (const announcement of announcements) {
          // 중복 체크
          const { data: existing } = await supabase
            .from('subsidy_announcements')
            .select('id')
            .eq('source_url', announcement.source_url)
            .single();

          if (existing && !force) {
            console.log(`[CRAWLER-P2] 중복 건너뜀: ${announcement.title}`);
            continue;
          }

          // Gemini AI를 사용한 관련성 분석 (Phase 2)
          let analysisResult;
          try {
            console.log(`[CRAWLER-P2] Gemini 분석 시작: ${announcement.title.substring(0, 50)}...`);
            analysisResult = await analyzeAnnouncement(
              announcement.title,
              announcement.content || ''
            );
            console.log(`[CRAWLER-P2] Gemini 분석 완료: 관련도 ${Math.round(analysisResult.relevance_score * 100)}%`);
          } catch (geminiError) {
            console.warn(`[CRAWLER-P2] Gemini 분석 실패, 키워드 폴백 사용:`, geminiError);
            // 폴백: 키워드 기반 관련성 점수
            const keywordsCount = announcement.keywords_matched?.length || 0;
            analysisResult = {
              is_relevant: true,  // 키워드 필터링 통과한 공고
              relevance_score: Math.min(0.7 + keywordsCount * 0.1, 1.0),
              keywords_matched: announcement.keywords_matched || [],
              extracted_info: {},
            };
          }

          const insertData = {
            region_code: source.region_code,
            region_name: source.region_name,
            region_type: 'metropolitan' as const,
            title: announcement.title,
            content: announcement.content,
            source_url: announcement.source_url,
            published_at: announcement.published_at,
            // Gemini AI 또는 크롤러에서 추출된 상세 정보 (우선순위: Gemini > 크롤러)
            application_period_start: analysisResult.extracted_info?.application_period_start || announcement.application_period_start || null,
            application_period_end: analysisResult.extracted_info?.application_period_end || announcement.application_period_end || null,
            budget: analysisResult.extracted_info?.budget || announcement.budget || null,
            target_description: analysisResult.extracted_info?.target_description || announcement.target_description || null,
            support_amount: analysisResult.extracted_info?.support_amount || announcement.support_amount || null,
            // Gemini AI 관련성 분석 결과
            is_relevant: analysisResult.is_relevant,
            relevance_score: analysisResult.relevance_score,
            keywords_matched: analysisResult.keywords_matched,
          };

          const { error } = await supabase
            .from('subsidy_announcements')
            .upsert(insertData, { onConflict: 'source_url' });

          if (!error) {
            results.new_announcements++;
            results.relevant_announcements++;
            console.log(`[CRAWLER-P2] ✅ 저장 완료: ${announcement.title}`);
          } else {
            console.error(`[CRAWLER-P2] 저장 실패: ${announcement.title}`, error);
          }
        }

        results.successful_regions++;
        console.log(`[CRAWLER-P2] ${source.name} 완료: ${announcements.length}개 관련 공고`);

      } catch (error) {
        results.failed_regions++;
        results.errors?.push({
          region_code: source.id,
          error: error instanceof Error ? error.message : '알 수 없는 오류',
        });
        console.error(`[CRAWLER-P2] ${source.name} 실패:`, error);
      }
    }

      // Phase 2 소스 수 반영 (배치 처리된 센터 수만 반영)
      results.total_regions += batchSources.length;
      results.batch_info = batchInfo;
      console.log(`[CRAWLER] Phase 2 ${batchInfo} 완료`);
    } else {
      console.log('[CRAWLER] Phase 2 크롤링 건너뜀 (enable_phase2=false)');
    }

    results.duration_ms = Date.now() - startTime;

    // Update crawl_run record with final statistics
    const finalStatus = results.failed_regions === 0 ? 'completed' : results.successful_regions > 0 ? 'partial' : 'failed';

    await supabase
      .from('crawl_runs')
      .update({
        completed_at: new Date().toISOString(),
        completed_batches: 1,
        total_urls_crawled: results.total_regions,
        successful_urls: results.successful_regions,
        failed_urls: results.failed_regions,
        total_announcements: results.new_announcements,
        new_announcements: results.new_announcements,
        relevant_announcements: results.relevant_announcements,
        ai_verified_announcements: results.relevant_announcements, // All relevant are AI-verified
        total_processing_time_seconds: Math.floor(results.duration_ms / 1000),
        status: finalStatus,
        error_message: results.errors?.length ? results.errors.join('; ') : null,
      })
      .eq('run_id', runId);

    console.log(`[CRAWLER] 전체 크롤링 완료 (${runId}): ${results.new_announcements}개 공고, ${results.duration_ms}ms`);

    return NextResponse.json({ ...results, run_id: runId });

  } catch (error) {
    console.error('크롤러 오류:', error);

    // Try to update crawl_run if it was created
    if (runId) {
      try {
        await supabase
          .from('crawl_runs')
          .update({
            completed_at: new Date().toISOString(),
            status: 'failed',
            error_message: error instanceof Error ? error.message : '알 수 없는 오류',
            total_processing_time_seconds: Math.floor((Date.now() - startTime) / 1000),
          })
          .eq('run_id', runId);
      } catch (updateError) {
        console.error('[CRAWLER] Failed to update crawl_run on error:', updateError);
      }
    }

    return NextResponse.json({
      success: false,
      error: '크롤링 실패',
      run_id: runId
    }, { status: 500 });
  }
}

// 크롤링된 공고 데이터 인터페이스
interface CrawledAnnouncement {
  title: string;
  content: string;
  source_url: string;  // 실제 공고 상세 페이지 URL
  published_at: string;
  // 직접 추출된 데이터
  application_period_start?: string;
  application_period_end?: string;
  budget?: string;
  target_description?: string;
  support_amount?: string;
  // 키워드 매칭 정보
  keywords_matched?: string[];
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

      // 상세 페이지 조회 제거 (Vercel Hobby 플랜 10초 제한 대응)
      // 기본 안내 메시지만 제공
      const detailContent = `${source.region_name} 지역 지원사업 공고입니다.\n\n원문보기를 클릭하여 상세 내용을 확인하세요.`;

      announcements.push({
        title: `[${source.region_name}] ${title}`,
        content: detailContent,
        source_url: detailUrl,
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

// ============================================================
// 상세 페이지에서 정보 추출 (신청기간, 예산, 지원대상 등)
// ============================================================

interface ExtractedInfo {
  content: string;
  application_period_start?: string;
  application_period_end?: string;
  budget?: string;
  target_description?: string;
  support_amount?: string;
}

// 녹색환경지원센터 상세 페이지에서 정보 추출
async function fetchGECDetail(detailUrl: string): Promise<ExtractedInfo> {
  try {
    console.log(`[CRAWLER] 상세 페이지 조회: ${detailUrl}`);

    const response = await fetch(detailUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'ko-KR,ko;q=0.9',
      },
      signal: AbortSignal.timeout(10000),
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const html = await response.text();

    // HTML 태그 제거 함수
    const stripHtml = (str: string) => str.replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').trim();

    // 추출된 정보 저장
    const info: ExtractedInfo = { content: '' };
    const extractedParts: string[] = [];

    // 1. 신청기간/접수기간 추출
    const periodPatterns = [
      /(?:신청|접수|모집)\s*기간[:\s]*([^<\n]{10,150})/i,
      /기\s*간[:\s]*(\d{4}[.\-\/년]\s*\d{1,2}[.\-\/월]\s*\d{1,2}[일]?\s*[~\-]\s*\d{4}[.\-\/년]\s*\d{1,2}[.\-\/월]\s*\d{1,2})/i,
      /(\d{4}[.\-\/년]\s*\d{1,2}[.\-\/월]\s*\d{1,2}[일]?)\s*[~\-]\s*(\d{4}[.\-\/년]?\s*\d{1,2}[.\-\/월]\s*\d{1,2})/i,
    ];

    for (const pattern of periodPatterns) {
      const match = html.match(pattern);
      if (match) {
        const periodText = stripHtml(match[0]);
        extractedParts.push(`📅 신청기간: ${periodText}`);

        // 날짜 파싱
        const datePattern = /(\d{4})[.\-\/년]?\s*(\d{1,2})[.\-\/월]?\s*(\d{1,2})/g;
        const dates = [...periodText.matchAll(datePattern)];
        if (dates.length >= 1) {
          info.application_period_start = `${dates[0][1]}-${dates[0][2].padStart(2, '0')}-${dates[0][3].padStart(2, '0')}`;
        }
        if (dates.length >= 2) {
          info.application_period_end = `${dates[1][1]}-${dates[1][2].padStart(2, '0')}-${dates[1][3].padStart(2, '0')}`;
        }
        break;
      }
    }

    // 2. 예산/사업비 추출
    const budgetPatterns = [
      /(?:사업비|예산|총\s*예산)[:\s]*([^<\n]{5,80})/i,
      /(\d{1,3}(?:,\d{3})*(?:백만원|억원|천만원|만원|원))/i,
    ];

    for (const pattern of budgetPatterns) {
      const match = html.match(pattern);
      if (match) {
        const budgetText = stripHtml(match[1] || match[0]);
        if (budgetText.match(/\d/)) {  // 숫자가 포함된 경우만
          info.budget = budgetText;
          extractedParts.push(`💰 예산: ${budgetText}`);
          break;
        }
      }
    }

    // 3. 지원대상 추출
    const targetPatterns = [
      /(?:지원|신청)\s*대상[:\s]*([^<\n]{10,300})/i,
      /대\s*상[:\s]*([^<\n]{10,200})/i,
    ];

    for (const pattern of targetPatterns) {
      const match = html.match(pattern);
      if (match) {
        const targetText = stripHtml(match[1]).substring(0, 200);
        info.target_description = targetText;
        extractedParts.push(`🎯 지원대상: ${targetText}`);
        break;
      }
    }

    // 4. 지원금액/지원내용 추출
    const supportPatterns = [
      /(?:지원|보조)\s*(?:금액|내용|한도)[:\s]*([^<\n]{10,200})/i,
      /(?:설치비|보조금)[:\s]*([^<\n]{5,100})/i,
    ];

    for (const pattern of supportPatterns) {
      const match = html.match(pattern);
      if (match) {
        const supportText = stripHtml(match[1]).substring(0, 150);
        info.support_amount = supportText;
        extractedParts.push(`💵 지원금액: ${supportText}`);
        break;
      }
    }

    // 5. 본문 내용 일부 추출 (첫 500자)
    const bodyPatterns = [
      /<div[^>]*class="[^"]*(?:content|view|body|detail)[^"]*"[^>]*>([\s\S]*?)<\/div>/i,
      /<td[^>]*class="[^"]*(?:content|view|body)[^"]*"[^>]*>([\s\S]*?)<\/td>/i,
    ];

    let bodyText = '';
    for (const pattern of bodyPatterns) {
      const match = html.match(pattern);
      if (match) {
        bodyText = stripHtml(match[1]).substring(0, 500);
        break;
      }
    }

    // 최종 content 조합
    if (extractedParts.length > 0) {
      info.content = extractedParts.join('\n\n');
      if (bodyText && bodyText.length > 50) {
        info.content += '\n\n📄 내용 요약:\n' + bodyText;
      }
    } else if (bodyText) {
      info.content = bodyText;
    } else {
      info.content = '상세 내용은 원문보기를 통해 확인하세요.';
    }

    return info;

  } catch (error) {
    console.warn(`[CRAWLER] 상세 페이지 조회 실패: ${detailUrl}`, error);
    return {
      content: '상세 내용은 원문보기를 통해 확인하세요.',
    };
  }
}

// 공고 상세 페이지에서 정보 추출 (기존 함수 - 기업마당용)
async function fetchAnnouncementDetail(detailUrl: string): Promise<{
  content: string;
  extractedData?: {
    application_period_start?: string;
    application_period_end?: string;
    budget?: string;
    target_description?: string;
    support_amount?: string;
  };
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
    const extractedData: {
      application_period_start?: string;
      application_period_end?: string;
      budget?: string;
      target_description?: string;
      support_amount?: string;
    } = {};

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

// 녹색환경지원센터연합회 (GECA) 크롤링 - 전국 18개 센터 통합
async function crawlGECA(source: Phase2Source): Promise<CrawledAnnouncement[]> {
  const announcements: CrawledAnnouncement[] = [];

  try {
    console.log(`[CRAWLER-P2] ${source.name} 크롤링 시작 (전국 18개 센터 통합)`);

    const response = await fetch(source.announcement_url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'ko-KR,ko;q=0.9',
      },
      signal: AbortSignal.timeout(15000),
    });

    if (!response.ok) {
      console.error(`[CRAWLER-P2] ${source.name} HTTP 오류: ${response.status}`);
      return [{
        title: `[${source.name}] 사업공고`,
        content: `전국 녹색환경지원센터 사업공고를 확인하세요.\n\n원문보기를 클릭하여 최신 공고를 확인하세요.`,
        source_url: source.announcement_url,
        published_at: new Date().toISOString(),
      }];
    }

    const html = await response.text();

    // GECA 게시판 패턴: /home/board/read.do?menuId=30&boardId=XXX&boardMasterId=2
    // 또는 boardId=XXX 파라미터
    const linkPatterns = [
      /boardId=(\d+)[^>]*>([^<]+)</gi,
      /read\.do\?[^"]*boardId=(\d+)[^"]*"[^>]*>([^<]+)</gi,
    ];

    const items: { id: string; title: string }[] = [];

    for (const pattern of linkPatterns) {
      let match;
      while ((match = pattern.exec(html)) !== null) {
        const id = match[1];
        const title = match[2].trim().replace(/\s+/g, ' ').replace(/&nbsp;/g, ' ');

        // 중복 체크 및 유효성 검사
        if (id && title.length > 3 && !items.find(i => i.id === id)) {
          // IoT/소규모 대기배출 관련 키워드 필터링
          const hasRelevantKeyword = IOT_KEYWORDS.some(k =>
            title.toLowerCase().includes(k.toLowerCase())
          );

          // 관련 키워드가 있거나 일반 공고면 추가
          items.push({ id, title });
        }
      }
    }

    console.log(`[CRAWLER-P2] ${source.name}: ${items.length}개 공고 발견`);

    // 최대 20개 공고 저장 (전국 통합이므로 더 많이)
    const maxItems = Math.min(items.length, 20);
    for (let i = 0; i < maxItems; i++) {
      const { id, title } = items[i];

      // 키워드 매칭 확인
      const matchedKeywords = IOT_KEYWORDS.filter(k =>
        title.toLowerCase().includes(k.toLowerCase())
      );

      const keywordInfo = matchedKeywords.length > 0
        ? `\n\n매칭 키워드: ${matchedKeywords.join(', ')}`
        : '';

      announcements.push({
        title: `[녹색환경지원센터] ${title}`,
        content: `녹색환경지원센터연합회에서 게시한 공고입니다.${keywordInfo}\n\n원문보기를 클릭하여 상세 내용을 확인하세요.`,
        source_url: `${source.detail_base_url}${id}`,
        published_at: new Date().toISOString(),
      });
    }

    // 공고가 없으면 기본 링크 제공
    if (announcements.length === 0) {
      announcements.push({
        title: `[녹색환경지원센터] 사업공고`,
        content: `전국 녹색환경지원센터 사업공고를 확인하세요.\n\n원문보기를 클릭하여 최신 공고를 확인하세요.`,
        source_url: source.announcement_url,
        published_at: new Date().toISOString(),
      });
    }

    return announcements;

  } catch (error) {
    console.error(`[CRAWLER-P2] ${source.name} 크롤링 오류:`, error);
    return [{
      title: `[녹색환경지원센터] 사업공고`,
      content: `크롤링 중 오류가 발생했습니다.\n원문보기를 클릭하여 직접 확인해주세요.`,
      source_url: source.announcement_url,
      published_at: new Date().toISOString(),
    }];
  }
}

// 녹색환경지원센터 - 그누보드 패턴 (경북 등)
// ⚠️ 키워드 필터링 적용: 관련 키워드가 제목에 포함된 공고만 저장
async function crawlGEC_Gnuboard(source: Phase2Source): Promise<CrawledAnnouncement[]> {
  const announcements: CrawledAnnouncement[] = [];

  try {
    console.log(`[CRAWLER-P2] ${source.name} 크롤링 시작 (그누보드, 키워드 필터링 적용)`);

    const response = await fetch(source.announcement_url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'ko-KR,ko;q=0.9',
      },
      signal: AbortSignal.timeout(15000),
    });

    if (!response.ok) {
      console.error(`[CRAWLER-P2] ${source.name} HTTP 오류: ${response.status}`);
      return [];  // 오류 시 빈 배열 반환 (관련 없는 공고 저장 방지)
    }

    const html = await response.text();

    // 그누보드 패턴: wr_id=XXX 파라미터와 제목 추출
    const linkPattern = /wr_id=(\d+)[^>]*>([^<]+)</gi;
    const items: { id: string; title: string }[] = [];
    let match;

    while ((match = linkPattern.exec(html)) !== null) {
      const id = match[1];
      const title = match[2].trim().replace(/\s+/g, ' ').replace(/&nbsp;/g, ' ');

      // 🔑 핵심: 관련 키워드가 제목에 포함된 경우만 추가
      if (id && title.length > 3 && !items.find(i => i.id === id) && isRelevantTitle(title)) {
        items.push({ id, title });
        console.log(`[CRAWLER-P2] ✅ 관련 공고 발견: ${title}`);
      }
    }

    console.log(`[CRAWLER-P2] ${source.name}: ${items.length}개 관련 공고 발견 (키워드 필터링 후)`);

    // 관련 공고에 대해 상세 페이지 조회 및 정보 추출
    for (const { id, title } of items) {
      const detailUrl = `${source.detail_base_url}${id}`;

      // 매칭된 키워드 확인
      const matchedKeywords = REQUIRED_KEYWORDS.filter(k =>
        title.toLowerCase().includes(k.toLowerCase())
      );

      // 상세 페이지에서 정보 추출
      const detailInfo = await fetchGECDetail(detailUrl);

      announcements.push({
        title: `[${source.name}] ${title}`,
        content: detailInfo.content,
        source_url: detailUrl,
        published_at: new Date().toISOString(),
        application_period_start: detailInfo.application_period_start,
        application_period_end: detailInfo.application_period_end,
        budget: detailInfo.budget,
        target_description: detailInfo.target_description,
        support_amount: detailInfo.support_amount,
        keywords_matched: matchedKeywords,
      });
    }

    return announcements;

  } catch (error) {
    console.error(`[CRAWLER-P2] ${source.name} 크롤링 오류:`, error);
    return [];  // 오류 시 빈 배열 반환
  }
}

// 녹색환경지원센터 - CMS 패턴 (부산, 대전, 광주 등)
// ⚠️ 키워드 필터링 적용: 관련 키워드가 제목에 포함된 공고만 저장
async function crawlGEC_CMS(source: Phase2Source): Promise<CrawledAnnouncement[]> {
  const announcements: CrawledAnnouncement[] = [];

  try {
    console.log(`[CRAWLER-P2] ${source.name} 크롤링 시작 (CMS, 키워드 필터링 적용)`);

    const response = await fetch(source.announcement_url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'ko-KR,ko;q=0.9',
      },
      signal: AbortSignal.timeout(15000),
    });

    if (!response.ok) {
      console.error(`[CRAWLER-P2] ${source.name} HTTP 오류: ${response.status}`);
      return [];  // 오류 시 빈 배열 반환 (관련 없는 공고 저장 방지)
    }

    const html = await response.text();

    // CMS 패턴: /ko/XX/view?SEQ=YYY 또는 SEQ=YYY
    const linkPatterns = [
      /view\?SEQ=(\d+)[^>]*>([^<]+)</gi,
      /SEQ=(\d+)[^>]*>([^<]+)</gi,
    ];

    const items: { id: string; title: string }[] = [];

    for (const pattern of linkPatterns) {
      let match;
      while ((match = pattern.exec(html)) !== null) {
        const id = match[1];
        const title = match[2].trim().replace(/\s+/g, ' ').replace(/&nbsp;/g, ' ');

        // 🔑 핵심: 관련 키워드가 제목에 포함된 경우만 추가
        if (id && title.length > 3 && !items.find(i => i.id === id) && isRelevantTitle(title)) {
          items.push({ id, title });
          console.log(`[CRAWLER-P2] ✅ 관련 공고 발견: ${title}`);
        }
      }
    }

    console.log(`[CRAWLER-P2] ${source.name}: ${items.length}개 관련 공고 발견 (키워드 필터링 후)`);

    // 관련 공고에 대해 상세 페이지 조회 및 정보 추출
    for (const { id, title } of items) {
      const detailUrl = `${source.detail_base_url}${id}`;

      // 매칭된 키워드 확인
      const matchedKeywords = REQUIRED_KEYWORDS.filter(k =>
        title.toLowerCase().includes(k.toLowerCase())
      );

      // 상세 페이지에서 정보 추출
      const detailInfo = await fetchGECDetail(detailUrl);

      announcements.push({
        title: `[${source.name}] ${title}`,
        content: detailInfo.content,
        source_url: detailUrl,
        published_at: new Date().toISOString(),
        application_period_start: detailInfo.application_period_start,
        application_period_end: detailInfo.application_period_end,
        budget: detailInfo.budget,
        target_description: detailInfo.target_description,
        support_amount: detailInfo.support_amount,
        keywords_matched: matchedKeywords,
      });
    }

    return announcements;

  } catch (error) {
    console.error(`[CRAWLER-P2] ${source.name} 크롤링 오류:`, error);
    return [];  // 오류 시 빈 배열 반환
  }
}

// 인천녹색환경지원센터 (IGEC) 크롤링 - 커스텀 CMS 패턴
// URL 패턴: /notice/{slug}
async function crawlGEC_IGEC(source: Phase2Source): Promise<CrawledAnnouncement[]> {
  const announcements: CrawledAnnouncement[] = [];

  try {
    console.log(`[CRAWLER-P2] ${source.name} 크롤링 시작 (커스텀 CMS, 키워드 필터링 적용)`);

    const response = await fetch(source.announcement_url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'ko-KR,ko;q=0.9',
      },
      signal: AbortSignal.timeout(15000),
    });

    if (!response.ok) {
      console.error(`[CRAWLER-P2] ${source.name} HTTP 오류: ${response.status}`);
      return [];
    }

    const html = await response.text();

    // IGEC 링크 패턴: href="/notice/slug-title-here" 또는 /notice/123
    const linkPatterns = [
      /<a[^>]*href="\/notice\/([^"]+)"[^>]*>([^<]+)<\/a>/gi,
      /href="\/notice\/([^"]+)"[^>]*>[\s\S]*?<[^>]*>([^<]+)</gi,
    ];

    const items: { slug: string; title: string }[] = [];

    for (const pattern of linkPatterns) {
      let match;
      while ((match = pattern.exec(html)) !== null) {
        const slug = match[1].trim();
        const title = match[2].trim().replace(/\s+/g, ' ').replace(/&nbsp;/g, ' ');

        // 🔑 핵심: 관련 키워드가 제목에 포함된 경우만 추가
        if (slug && title.length > 3 && !items.find(i => i.slug === slug) && isRelevantTitle(title)) {
          items.push({ slug, title });
          console.log(`[CRAWLER-P2] ✅ 관련 공고 발견: ${title}`);
        }
      }
    }

    console.log(`[CRAWLER-P2] ${source.name}: ${items.length}개 관련 공고 발견 (키워드 필터링 후)`);

    // 관련 공고에 대해 상세 페이지 조회 및 정보 추출
    for (const { slug, title } of items) {
      const detailUrl = `${source.detail_base_url}${slug}`;

      // 매칭된 키워드 확인
      const matchedKeywords = REQUIRED_KEYWORDS.filter(k =>
        title.toLowerCase().includes(k.toLowerCase())
      );

      // 상세 페이지에서 정보 추출
      const detailInfo = await fetchGECDetail(detailUrl);

      announcements.push({
        title: `[${source.name}] ${title}`,
        content: detailInfo.content,
        source_url: detailUrl,
        published_at: new Date().toISOString(),
        application_period_start: detailInfo.application_period_start,
        application_period_end: detailInfo.application_period_end,
        budget: detailInfo.budget,
        target_description: detailInfo.target_description,
        support_amount: detailInfo.support_amount,
        keywords_matched: matchedKeywords,
      });
    }

    return announcements;

  } catch (error) {
    console.error(`[CRAWLER-P2] ${source.name} 크롤링 오류:`, error);
    return [];
  }
}

// 전남녹색환경지원센터 (JNGEC) 크롤링 - RPM CMS 패턴
// URL 패턴: rpm.php?...&no={ID}
async function crawlGEC_JNGEC(source: Phase2Source): Promise<CrawledAnnouncement[]> {
  const announcements: CrawledAnnouncement[] = [];

  try {
    console.log(`[CRAWLER-P2] ${source.name} 크롤링 시작 (RPM CMS, 키워드 필터링 적용)`);

    const response = await fetch(source.announcement_url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'ko-KR,ko;q=0.9',
      },
      signal: AbortSignal.timeout(15000),
    });

    if (!response.ok) {
      console.error(`[CRAWLER-P2] ${source.name} HTTP 오류: ${response.status}`);
      return [];
    }

    const html = await response.text();

    // JNGEC 링크 패턴: no=XXX 파라미터
    const linkPatterns = [
      /no=(\d+)[^>]*>([^<]+)</gi,
      /doit=view[^>]*no=(\d+)[^>]*>([^<]+)</gi,
    ];

    const items: { id: string; title: string }[] = [];

    for (const pattern of linkPatterns) {
      let match;
      while ((match = pattern.exec(html)) !== null) {
        const id = match[1];
        const title = match[2].trim().replace(/\s+/g, ' ').replace(/&nbsp;/g, ' ');

        // 🔑 핵심: 관련 키워드가 제목에 포함된 경우만 추가
        if (id && title.length > 3 && !items.find(i => i.id === id) && isRelevantTitle(title)) {
          items.push({ id, title });
          console.log(`[CRAWLER-P2] ✅ 관련 공고 발견: ${title}`);
        }
      }
    }

    console.log(`[CRAWLER-P2] ${source.name}: ${items.length}개 관련 공고 발견 (키워드 필터링 후)`);

    // 관련 공고에 대해 상세 페이지 조회 및 정보 추출
    for (const { id, title } of items) {
      const detailUrl = `${source.detail_base_url}${id}`;

      // 매칭된 키워드 확인
      const matchedKeywords = REQUIRED_KEYWORDS.filter(k =>
        title.toLowerCase().includes(k.toLowerCase())
      );

      // 상세 페이지에서 정보 추출
      const detailInfo = await fetchGECDetail(detailUrl);

      announcements.push({
        title: `[${source.name}] ${title}`,
        content: detailInfo.content,
        source_url: detailUrl,
        published_at: new Date().toISOString(),
        application_period_start: detailInfo.application_period_start,
        application_period_end: detailInfo.application_period_end,
        budget: detailInfo.budget,
        target_description: detailInfo.target_description,
        support_amount: detailInfo.support_amount,
        keywords_matched: matchedKeywords,
      });
    }

    return announcements;

  } catch (error) {
    console.error(`[CRAWLER-P2] ${source.name} 크롤링 오류:`, error);
    return [];
  }
}

// ============================================================
// 광역시도 환경과 공지사항 크롤링 함수들
// ============================================================

// 대구광역시 환경국 크롤링 (ICMS CMS 패턴)
async function crawlMetroDaegu(source: Phase2Source): Promise<CrawledAnnouncement[]> {
  const announcements: CrawledAnnouncement[] = [];

  try {
    console.log(`[CRAWLER-METRO] ${source.name} 크롤링 시작 (키워드 필터링 적용)`);

    const response = await fetch(source.announcement_url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'ko-KR,ko;q=0.9',
      },
      signal: AbortSignal.timeout(15000),
    });

    if (!response.ok) {
      console.error(`[CRAWLER-METRO] ${source.name} HTTP 오류: ${response.status}`);
      return [];
    }

    const html = await response.text();

    // 대구시 ICMS 패턴: nttId=XXX 파라미터
    const linkPatterns = [
      /nttId=(\d+)[^>]*>([^<]+)</gi,
      /<a[^>]*href="[^"]*nttId=(\d+)[^"]*"[^>]*>([^<]+)<\/a>/gi,
    ];

    const items: { id: string; title: string }[] = [];

    for (const pattern of linkPatterns) {
      let match;
      while ((match = pattern.exec(html)) !== null) {
        const id = match[1];
        const title = match[2].trim().replace(/\s+/g, ' ').replace(/&nbsp;/g, ' ');

        // 🔑 관련 키워드가 제목에 포함된 경우만 추가
        if (id && title.length > 3 && !items.find(i => i.id === id) && isRelevantTitle(title)) {
          items.push({ id, title });
          console.log(`[CRAWLER-METRO] ✅ 관련 공고 발견: ${title}`);
        }
      }
    }

    console.log(`[CRAWLER-METRO] ${source.name}: ${items.length}개 관련 공고 발견`);

    for (const { id, title } of items) {
      const detailUrl = `${source.detail_base_url}${id}`;
      const matchedKeywords = REQUIRED_KEYWORDS.filter(k =>
        title.toLowerCase().includes(k.toLowerCase())
      );
      const detailInfo = await fetchGECDetail(detailUrl);

      announcements.push({
        title: `[${source.name}] ${title}`,
        content: detailInfo.content,
        source_url: detailUrl,
        published_at: new Date().toISOString(),
        application_period_start: detailInfo.application_period_start,
        application_period_end: detailInfo.application_period_end,
        budget: detailInfo.budget,
        target_description: detailInfo.target_description,
        support_amount: detailInfo.support_amount,
        keywords_matched: matchedKeywords,
      });
    }

    return announcements;

  } catch (error) {
    console.error(`[CRAWLER-METRO] ${source.name} 크롤링 오류:`, error);
    return [];
  }
}

// 경상북도 환경안전과 크롤링
async function crawlMetroGyeongbuk(source: Phase2Source): Promise<CrawledAnnouncement[]> {
  const announcements: CrawledAnnouncement[] = [];

  try {
    console.log(`[CRAWLER-METRO] ${source.name} 크롤링 시작 (키워드 필터링 적용)`);

    const response = await fetch(source.announcement_url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'ko-KR,ko;q=0.9',
      },
      signal: AbortSignal.timeout(15000),
    });

    if (!response.ok) {
      console.error(`[CRAWLER-METRO] ${source.name} HTTP 오류: ${response.status}`);
      return [];
    }

    const html = await response.text();

    // 경북도 패턴: B_NUM=XXX 파라미터
    const linkPatterns = [
      /B_NUM=(\d+)[^>]*>([^<]+)</gi,
      /<a[^>]*href="[^"]*B_NUM=(\d+)[^"]*"[^>]*>([^<]+)<\/a>/gi,
    ];

    const items: { id: string; title: string }[] = [];

    for (const pattern of linkPatterns) {
      let match;
      while ((match = pattern.exec(html)) !== null) {
        const id = match[1];
        const title = match[2].trim().replace(/\s+/g, ' ').replace(/&nbsp;/g, ' ');

        if (id && title.length > 3 && !items.find(i => i.id === id) && isRelevantTitle(title)) {
          items.push({ id, title });
          console.log(`[CRAWLER-METRO] ✅ 관련 공고 발견: ${title}`);
        }
      }
    }

    console.log(`[CRAWLER-METRO] ${source.name}: ${items.length}개 관련 공고 발견`);

    for (const { id, title } of items) {
      const detailUrl = `${source.detail_base_url}${id}`;
      const matchedKeywords = REQUIRED_KEYWORDS.filter(k =>
        title.toLowerCase().includes(k.toLowerCase())
      );
      const detailInfo = await fetchGECDetail(detailUrl);

      announcements.push({
        title: `[${source.name}] ${title}`,
        content: detailInfo.content,
        source_url: detailUrl,
        published_at: new Date().toISOString(),
        application_period_start: detailInfo.application_period_start,
        application_period_end: detailInfo.application_period_end,
        budget: detailInfo.budget,
        target_description: detailInfo.target_description,
        support_amount: detailInfo.support_amount,
        keywords_matched: matchedKeywords,
      });
    }

    return announcements;

  } catch (error) {
    console.error(`[CRAWLER-METRO] ${source.name} 크롤링 오류:`, error);
    return [];
  }
}

// 충청남도 환경산림국 크롤링
async function crawlMetroChungnam(source: Phase2Source): Promise<CrawledAnnouncement[]> {
  const announcements: CrawledAnnouncement[] = [];

  try {
    console.log(`[CRAWLER-METRO] ${source.name} 크롤링 시작 (키워드 필터링 적용)`);

    const response = await fetch(source.announcement_url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'ko-KR,ko;q=0.9',
      },
      signal: AbortSignal.timeout(15000),
    });

    if (!response.ok) {
      console.error(`[CRAWLER-METRO] ${source.name} HTTP 오류: ${response.status}`);
      return [];
    }

    const html = await response.text();

    // 충남도 패턴: nttId=XXX 파라미터
    const linkPatterns = [
      /nttId=(\d+)[^>]*>([^<]+)</gi,
      /<a[^>]*href="[^"]*nttId=(\d+)[^"]*"[^>]*>([^<]+)<\/a>/gi,
    ];

    const items: { id: string; title: string }[] = [];

    for (const pattern of linkPatterns) {
      let match;
      while ((match = pattern.exec(html)) !== null) {
        const id = match[1];
        const title = match[2].trim().replace(/\s+/g, ' ').replace(/&nbsp;/g, ' ');

        if (id && title.length > 3 && !items.find(i => i.id === id) && isRelevantTitle(title)) {
          items.push({ id, title });
          console.log(`[CRAWLER-METRO] ✅ 관련 공고 발견: ${title}`);
        }
      }
    }

    console.log(`[CRAWLER-METRO] ${source.name}: ${items.length}개 관련 공고 발견`);

    for (const { id, title } of items) {
      const detailUrl = `${source.detail_base_url}${id}`;
      const matchedKeywords = REQUIRED_KEYWORDS.filter(k =>
        title.toLowerCase().includes(k.toLowerCase())
      );
      const detailInfo = await fetchGECDetail(detailUrl);

      announcements.push({
        title: `[${source.name}] ${title}`,
        content: detailInfo.content,
        source_url: detailUrl,
        published_at: new Date().toISOString(),
        application_period_start: detailInfo.application_period_start,
        application_period_end: detailInfo.application_period_end,
        budget: detailInfo.budget,
        target_description: detailInfo.target_description,
        support_amount: detailInfo.support_amount,
        keywords_matched: matchedKeywords,
      });
    }

    return announcements;

  } catch (error) {
    console.error(`[CRAWLER-METRO] ${source.name} 크롤링 오류:`, error);
    return [];
  }
}

// 범용 광역시도 환경과 크롤링 (기본 링크 제공용)
async function crawlMetroGeneric(source: Phase2Source): Promise<CrawledAnnouncement[]> {
  const announcements: CrawledAnnouncement[] = [];

  try {
    console.log(`[CRAWLER-METRO] ${source.name} 크롤링 시작 (범용)`);

    const response = await fetch(source.announcement_url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'ko-KR,ko;q=0.9',
      },
      signal: AbortSignal.timeout(15000),
    });

    if (!response.ok) {
      console.error(`[CRAWLER-METRO] ${source.name} HTTP 오류: ${response.status}`);
      // HTTP 오류여도 기본 링크 제공
      return [{
        title: `[${source.name}] 환경 공지사항`,
        content: `${source.name}의 환경 관련 공지사항입니다.\n\n원문보기를 클릭하여 최신 공고를 확인하세요.`,
        source_url: source.announcement_url,
        published_at: new Date().toISOString(),
      }];
    }

    const html = await response.text();

    // 다양한 CMS 패턴 시도
    const linkPatterns = [
      // 일반 nttId 패턴
      /nttId=(\d+)[^>]*>([^<]+)</gi,
      // seq 패턴
      /seq=(\d+)[^>]*>([^<]+)</gi,
      // idx 패턴
      /idx=(\d+)[^>]*>([^<]+)</gi,
      // dataSid 패턴
      /dataSid=(\d+)[^>]*>([^<]+)</gi,
    ];

    const items: { id: string; title: string }[] = [];

    for (const pattern of linkPatterns) {
      let match;
      while ((match = pattern.exec(html)) !== null) {
        const id = match[1];
        const title = match[2].trim().replace(/\s+/g, ' ').replace(/&nbsp;/g, ' ');

        // 관련 키워드가 제목에 포함된 경우만 추가
        if (id && title.length > 3 && !items.find(i => i.id === id) && isRelevantTitle(title)) {
          items.push({ id, title });
          console.log(`[CRAWLER-METRO] ✅ 관련 공고 발견: ${title}`);
        }
      }
    }

    console.log(`[CRAWLER-METRO] ${source.name}: ${items.length}개 관련 공고 발견`);

    // 관련 공고가 없으면 기본 링크 제공
    if (items.length === 0) {
      return [{
        title: `[${source.name}] 환경 공지사항`,
        content: `${source.name}의 환경 관련 공지사항입니다.\n\n원문보기를 클릭하여 최신 공고를 확인하세요.`,
        source_url: source.announcement_url,
        published_at: new Date().toISOString(),
      }];
    }

    for (const { id, title } of items) {
      const matchedKeywords = REQUIRED_KEYWORDS.filter(k =>
        title.toLowerCase().includes(k.toLowerCase())
      );

      announcements.push({
        title: `[${source.name}] ${title}`,
        content: `${source.name}에서 게시한 환경 관련 공고입니다.\n\n원문보기를 클릭하여 상세 내용을 확인하세요.`,
        source_url: `${source.detail_base_url}${id}`,
        published_at: new Date().toISOString(),
        keywords_matched: matchedKeywords,
      });
    }

    return announcements;

  } catch (error) {
    console.error(`[CRAWLER-METRO] ${source.name} 크롤링 오류:`, error);
    // 오류 시에도 기본 링크 제공
    return [{
      title: `[${source.name}] 환경 공지사항`,
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
    case 'geca':
      return crawlGECA(source);
    case 'gec_gnuboard':
      return crawlGEC_Gnuboard(source);
    case 'gec_cms':
      return crawlGEC_CMS(source);
    case 'gec_igec':
      return crawlGEC_IGEC(source);
    case 'gec_jngec':
      return crawlGEC_JNGEC(source);
    // 광역시도 환경과 크롤러
    case 'metro_daegu':
      return crawlMetroDaegu(source);
    case 'metro_gyeongbuk':
      return crawlMetroGyeongbuk(source);
    case 'metro_chungnam':
      return crawlMetroChungnam(source);
    case 'metro_generic':
      return crawlMetroGeneric(source);
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
