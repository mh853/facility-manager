// app/api/calendar/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { queryAll, queryOne } from '@/lib/supabase-direct';

// Next.js 캐싱 완전 비활성화 - 실시간 이벤트 업데이트를 위해 필수
export const dynamic = 'force-dynamic';
export const revalidate = 0;

/**
 * GET /api/calendar
 * 캘린더 이벤트 목록 조회
 * - Level 1+ (AUTHENTICATED) 읽기 가능
 * - 날짜 범위, 이벤트 타입 필터링 지원
 * - is_deleted = false인 항목만 조회
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);

    // 쿼리 파라미터
    const startDate = searchParams.get('start_date');
    const endDate = searchParams.get('end_date');
    const eventType = searchParams.get('event_type'); // 'todo' or 'schedule'
    const showCompletedOnly = searchParams.get('completed') === 'true';
    const showPendingOnly = searchParams.get('pending') === 'true';

    // Direct PostgreSQL 쿼리 구성
    const conditions: string[] = ['is_deleted = $1'];
    const params: any[] = [false];
    let paramIndex = 2;

    // 날짜 범위 필터
    if (startDate) {
      conditions.push(`event_date >= $${paramIndex}`);
      params.push(startDate);
      paramIndex++;
    }
    if (endDate) {
      conditions.push(`event_date <= $${paramIndex}`);
      params.push(endDate);
      paramIndex++;
    }

    // 이벤트 타입 필터
    if (eventType === 'todo' || eventType === 'schedule') {
      conditions.push(`event_type = $${paramIndex}`);
      params.push(eventType);
      paramIndex++;
    }

    // 완료 상태 필터 (todo 타입만 해당)
    if (showCompletedOnly) {
      conditions.push(`event_type = $${paramIndex}`);
      params.push('todo');
      paramIndex++;
      conditions.push(`is_completed = $${paramIndex}`);
      params.push(true);
      paramIndex++;
    } else if (showPendingOnly) {
      conditions.push(`event_type = $${paramIndex}`);
      params.push('todo');
      paramIndex++;
      conditions.push(`is_completed = $${paramIndex}`);
      params.push(false);
      paramIndex++;
    }

    const whereClause = conditions.join(' AND ');

    // 데이터 조회
    const data = await queryAll(
      `SELECT * FROM calendar_events
       WHERE ${whereClause}
       ORDER BY event_date ASC, created_at DESC`,
      params
    );

    // 전체 개수 조회
    const countResult = await queryOne(
      `SELECT COUNT(*) as count FROM calendar_events WHERE ${whereClause}`,
      params
    );
    const count = parseInt(countResult?.count || '0');

    const response = NextResponse.json({
      success: true,
      data: data || [],
      total: count
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
    const body = await request.json();

    const { title, description, event_date, end_date, start_time, end_time, event_type, is_completed, author_id, author_name, attached_files, labels, business_id, business_name } = body;

    // 필수 필드 검증
    if (!title || !event_date || !event_type || !author_id || !author_name) {
      return NextResponse.json(
        { error: '제목, 날짜, 이벤트 타입, 작성자 정보는 필수입니다.' },
        { status: 400 }
      );
    }

    // 배열 필드 정규화: undefined → 빈 배열로 변환
    const normalizedAttachedFiles = Array.isArray(attached_files) ? attached_files : [];
    const normalizedLabels = Array.isArray(labels) ? labels : [];

    // 이벤트 타입 검증
    if (event_type !== 'todo' && event_type !== 'schedule') {
      return NextResponse.json(
        { error: '이벤트 타입은 todo 또는 schedule이어야 합니다.' },
        { status: 400 }
      );
    }

    // 종료일 유효성 검증
    if (end_date && end_date < event_date) {
      return NextResponse.json(
        { error: '종료일은 시작일보다 이전일 수 없습니다.' },
        { status: 400 }
      );
    }

    // 캘린더 이벤트 생성 - Direct PostgreSQL
    const data = await queryOne(
      `INSERT INTO calendar_events (
        title, description, event_date, end_date, start_time, end_time,
        event_type, is_completed, author_id, author_name, attached_files,
        labels, business_id, business_name
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
      RETURNING *`,
      [
        title,
        description || null,
        event_date,
        end_date || null,
        start_time || null,
        end_time || null,
        event_type,
        event_type === 'todo' ? (is_completed || false) : false,
        author_id,
        author_name,
        normalizedAttachedFiles,  // 정규화된 배열 사용
        normalizedLabels,           // 정규화된 배열 사용
        business_id || null,
        business_name || null
      ]
    );

    if (!data) {
      console.error('[캘린더 이벤트 생성 실패]');
      return NextResponse.json(
        { error: '캘린더 이벤트 생성에 실패했습니다.' },
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
