/**
 * POST /api/subsidy-crawler/manual
 *
 * 관리자 대시보드에서 수동으로 크롤링을 실행하는 엔드포인트
 * 인증 없이 사용 가능 (내부 관리자 전용)
 */

import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

interface ManualCrawlRequest {
  enable_phase2?: boolean;
  force?: boolean;
}

interface ManualCrawlResponse {
  success: boolean;
  run_id?: string;
  message?: string;
  error?: string;
}

export async function POST(
  request: NextRequest
): Promise<NextResponse<ManualCrawlResponse>> {
  try {
    const body: ManualCrawlRequest = await request.json().catch(() => ({}));
    const { enable_phase2 = true, force = false } = body;

    // CRAWLER_SECRET 가져오기
    const crawlerSecret = process.env.CRAWLER_SECRET || 'dev-secret';

    // 기존 크롤러 API 호출
    const crawlerUrl = new URL('/api/subsidy-crawler', request.url);
    const crawlerResponse = await fetch(crawlerUrl.toString(), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${crawlerSecret}`,
      },
      body: JSON.stringify({
        enable_phase2,
        force,
        batch_size: 5, // 기본값
      }),
    });

    const result = await crawlerResponse.json();

    if (!crawlerResponse.ok) {
      console.error('[Manual Crawler] API call failed:', result);
      return NextResponse.json(
        {
          success: false,
          error: result.error || 'Failed to start crawler',
        },
        { status: crawlerResponse.status }
      );
    }

    // run_id 추출 (응답 구조에 따라 조정 필요)
    const runId = result.run_id || result.data?.run_id || 'unknown';

    return NextResponse.json({
      success: true,
      run_id: runId,
      message: '크롤링이 시작되었습니다.',
    });
  } catch (error) {
    console.error('[Manual Crawler] Unexpected error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
