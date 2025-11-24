import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { analyzeAnnouncement, normalizeDate } from '@/lib/gemini';
import type { CrawlResult, CrawlRequest } from '@/types/subsidy';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

// 크롤러 인증 토큰 (GitHub Actions에서 사용)
const CRAWLER_SECRET = process.env.CRAWLER_SECRET || 'dev-secret';

// 샘플 지자체 공고 URL 패턴 (실제 운영 시 확장 필요)
const SAMPLE_GOVERNMENT_SOURCES = [
  {
    region_code: '11',
    region_name: '서울특별시',
    region_type: 'metropolitan' as const,
    announcement_url: 'https://www.seoul.go.kr/main/index.jsp', // 예시
  },
  {
    region_code: '26',
    region_name: '부산광역시',
    region_type: 'metropolitan' as const,
    announcement_url: 'https://www.busan.go.kr/', // 예시
  },
  // 실제 운영 시 226개 기초지자체 URL 추가
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
    let targets = SAMPLE_GOVERNMENT_SOURCES;
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
          // 중복 체크
          const { data: existing } = await supabase
            .from('subsidy_announcements')
            .select('id')
            .eq('source_url', announcement.source_url)
            .single();

          if (existing && !force) {
            continue; // 이미 존재하는 공고 스킵
          }

          // AI 분석
          const analysis = await analyzeAnnouncement(
            announcement.title,
            announcement.content || ''
          );

          // 데이터 저장
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
            application_period_start: normalizeDate(analysis.extracted_info.application_period_start),
            application_period_end: normalizeDate(analysis.extracted_info.application_period_end),
            budget: analysis.extracted_info.budget,
            target_description: analysis.extracted_info.target_description,
            support_amount: analysis.extracted_info.support_amount,
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

// 실제 지자체 사이트 크롤링 함수 (확장 필요)
async function crawlGovernmentSite(source: typeof SAMPLE_GOVERNMENT_SOURCES[0]) {
  // 🚧 실제 구현 시:
  // 1. 각 지자체별 공고 페이지 구조 분석
  // 2. Puppeteer/Playwright로 동적 페이지 처리
  // 3. 공고 목록 → 상세 페이지 순회
  // 4. 제목, 내용, 첨부파일 추출

  // 데모용 시뮬레이션 데이터
  const demoAnnouncements = [
    {
      title: `[${source.region_name}] 2025년 소규모 사업장 대기오염 방지시설 IoT 설치 지원사업 공고`,
      content: `
        ${source.region_name}에서는 관내 소규모 대기배출시설을 보유한 사업장을 대상으로
        대기오염 방지시설 IoT(사물인터넷) 설치를 지원합니다.

        ◈ 지원대상: 관내 1~3종 대기배출시설 보유 사업장
        ◈ 지원내용: 굴뚝 자동측정기기(TMS) 설치비 최대 500만원
        ◈ 신청기간: 2025년 3월 1일 ~ 2025년 4월 30일
        ◈ 총 예산: 5억원 (약 100개소)

        자세한 사항은 환경과로 문의 바랍니다.
      `,
      source_url: `${source.announcement_url}/notice/${Date.now()}`,
      published_at: new Date().toISOString(),
    },
  ];

  // 50% 확률로 데모 공고 반환 (테스트용)
  if (Math.random() > 0.5) {
    return demoAnnouncements;
  }

  return [];
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
        active_regions: regionCount || SAMPLE_GOVERNMENT_SOURCES.length,
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
