// app/api/calendar/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';

/**
 * GET /api/calendar
 * 캘린더 이벤트 목록 조회
 * - Level 1+ (AUTHENTICATED) 읽기 가능
 * - 날짜 범위, 이벤트 타입 필터링 지원
 * - is_deleted = false인 항목만 조회
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = getSupabaseAdmin();
    const { searchParams } = new URL(request.url);

    // 쿼리 파라미터
    const startDate = searchParams.get('start_date');
    const endDate = searchParams.get('end_date');
    const eventType = searchParams.get('event_type'); // 'todo' or 'schedule'
    const showCompletedOnly = searchParams.get('completed') === 'true';
    const showPendingOnly = searchParams.get('pending') === 'true';

    // 기본 쿼리
    let query = supabase
      .from('calendar_events')
      .select('*', { count: 'exact' })
      .eq('is_deleted', false);

    // 날짜 범위 필터
    if (startDate) {
      query = query.gte('event_date', startDate);
    }
    if (endDate) {
      query = query.lte('event_date', endDate);
    }

    // 이벤트 타입 필터
    if (eventType === 'todo' || eventType === 'schedule') {
      query = query.eq('event_type', eventType);
    }

    // 완료 상태 필터 (todo 타입만 해당)
    if (showCompletedOnly) {
      query = query.eq('event_type', 'todo').eq('is_completed', true);
    } else if (showPendingOnly) {
      query = query.eq('event_type', 'todo').eq('is_completed', false);
    }

    // 정렬 (날짜 오름차순)
    query = query.order('event_date', { ascending: true });
    query = query.order('created_at', { ascending: false });

    const { data, error, count } = await query;

    if (error) {
      console.error('[캘린더 조회 실패]', error);
      return NextResponse.json(
        { error: '캘린더 이벤트를 조회하는데 실패했습니다.', details: error.message },
        { status: 500 }
      );
    }

    const response = NextResponse.json({
      success: true,
      data: data || [],
      total: count || 0
    });

    // 캐시 비활성화 (실시간 업데이트 필요)
    response.headers.set('Cache-Control', 'no-store, must-revalidate');

    return response;
  } catch (error) {
    console.error('[캘린더 API 오류]', error);
    return NextResponse.json(
      { error: '캘린더 API 처리 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/calendar
 * 캘린더 이벤트 생성
 * - Level 1+ (AUTHENTICATED) 쓰기 가능
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = getSupabaseAdmin();
    const body = await request.json();

    const { title, description, event_date, event_type, is_completed, author_id, author_name, attached_files } = body;

    // 필수 필드 검증
    if (!title || !event_date || !event_type || !author_id || !author_name) {
      return NextResponse.json(
        { error: '제목, 날짜, 이벤트 타입, 작성자 정보는 필수입니다.' },
        { status: 400 }
      );
    }

    // 이벤트 타입 검증
    if (event_type !== 'todo' && event_type !== 'schedule') {
      return NextResponse.json(
        { error: '이벤트 타입은 todo 또는 schedule이어야 합니다.' },
        { status: 400 }
      );
    }

    // 캘린더 이벤트 생성
    const { data, error } = await supabase
      .from('calendar_events')
      .insert({
        title,
        description: description || null,
        event_date,
        event_type,
        is_completed: event_type === 'todo' ? (is_completed || false) : false,
        author_id,
        author_name,
        attached_files: attached_files || []
      })
      .select()
      .single();

    if (error) {
      console.error('[캘린더 이벤트 생성 실패]', error);
      return NextResponse.json(
        { error: '캘린더 이벤트 생성에 실패했습니다.', details: error.message },
        { status: 500 }
      );
    }

    const response = NextResponse.json({
      success: true,
      data
    }, { status: 201 });

    // 캐시 비활성화 (실시간 업데이트 필요)
    response.headers.set('Cache-Control', 'no-store, must-revalidate');

    return response;
  } catch (error) {
    console.error('[캘린더 생성 API 오류]', error);
    return NextResponse.json(
      { error: '캘린더 생성 API 처리 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
