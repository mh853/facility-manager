// app/api/calendar/labels/route.ts
import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';

// Next.js 캐싱 완전 비활성화 - 실시간 라벨 업데이트를 위해 필수
export const dynamic = 'force-dynamic';
export const revalidate = 0;

/**
 * GET /api/calendar/labels
 * 모든 캘린더 이벤트에서 사용된 고유한 라벨 목록 조회
 */
export async function GET() {
  try {
    const supabase = getSupabaseAdmin();

    // 모든 이벤트의 라벨 배열 조회
    const { data, error } = await supabase
      .from('calendar_events')
      .select('labels')
      .eq('is_deleted', false)
      .not('labels', 'is', null);

    if (error) {
      console.error('[라벨 조회 실패]', error);
      return NextResponse.json(
        { error: '라벨 조회에 실패했습니다.', details: error.message },
        { status: 500 }
      );
    }

    // 중복 제거된 라벨 목록 생성
    const allLabels = new Set<string>();
    data?.forEach((event) => {
      if (event.labels && Array.isArray(event.labels)) {
        event.labels.forEach((label: string) => {
          if (label && label.trim()) {
            allLabels.add(label.trim());
          }
        });
      }
    });

    // Set을 배열로 변환하고 정렬
    const uniqueLabels = Array.from(allLabels).sort();

    const response = NextResponse.json({
      success: true,
      labels: uniqueLabels,
      total: uniqueLabels.length
    });

    // 캐시 비활성화 (실시간 업데이트 필요)
    response.headers.set('Cache-Control', 'no-store, must-revalidate');

    return response;
  } catch (error) {
    console.error('[라벨 API 오류]', error);
    return NextResponse.json(
      { error: '라벨 API 처리 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
