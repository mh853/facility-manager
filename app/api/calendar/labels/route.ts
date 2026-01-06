// app/api/calendar/labels/route.ts
import { NextResponse } from 'next/server';
import { queryAll } from '@/lib/supabase-direct';

// Next.js 캐싱 완전 비활성화 - 실시간 라벨 업데이트를 위해 필수
export const dynamic = 'force-dynamic';
export const revalidate = 0;

/**
 * GET /api/calendar/labels
 * 모든 캘린더 이벤트에서 사용된 고유한 라벨 목록 조회
 * calendar_events + survey_events 통합 조회
 */
export async function GET() {
  try {
    // 병렬로 일반 이벤트와 실사 이벤트의 라벨 조회 - Direct PostgreSQL
    const [calendarEvents, surveyEvents] = await Promise.all([
      // 일반 캘린더 이벤트 라벨
      queryAll(
        `SELECT labels FROM calendar_events
         WHERE is_deleted = $1 AND labels IS NOT NULL`,
        [false]
      ),

      // 실사 이벤트 라벨
      queryAll(
        `SELECT labels FROM survey_events
         WHERE event_type = $1 AND labels IS NOT NULL`,
        ['survey']
      )
    ]);

    // 중복 제거된 라벨 목록 생성 (일반 이벤트 + 실사 이벤트 통합)
    const allLabels = new Set<string>();

    // 일반 이벤트 라벨 추가
    calendarEvents?.forEach((event) => {
      if (event.labels && Array.isArray(event.labels)) {
        event.labels.forEach((label: string) => {
          if (label && label.trim()) {
            allLabels.add(label.trim());
          }
        });
      }
    });

    // 실사 이벤트 라벨 추가
    surveyEvents?.forEach((event) => {
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

    console.log(`✅ [라벨 조회 완료] 일반 이벤트: ${calendarEvents?.length || 0}개, 실사 이벤트: ${surveyEvents?.length || 0}개, 고유 라벨: ${uniqueLabels.length}개`);

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
