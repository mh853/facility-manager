// app/api/calendar/[id]/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';

// Next.js 캐싱 완전 비활성화 - 실시간 이벤트 업데이트를 위해 필수
export const dynamic = 'force-dynamic';
export const revalidate = 0;

/**
 * GET /api/calendar/[id]
 * 특정 캘린더 이벤트 조회
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = getSupabaseAdmin();
    const { id } = params;

    const { data, error } = await supabase
      .from('calendar_events')
      .select('*')
      .eq('id', id)
      .eq('is_deleted', false)
      .single();

    if (error) {
      console.error('[캘린더 이벤트 조회 실패]', error);
      return NextResponse.json(
        { error: '캘린더 이벤트를 찾을 수 없습니다.', details: error.message },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data
    });
  } catch (error) {
    console.error('[캘린더 조회 API 오류]', error);
    return NextResponse.json(
      { error: '캘린더 조회 API 처리 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/calendar/[id]
 * 캘린더 이벤트 수정
 * - Level 1+ (AUTHENTICATED) 수정 가능
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = getSupabaseAdmin();
    const { id } = params;
    const body = await request.json();

    const { title, description, event_date, end_date, event_type, is_completed, attached_files, labels } = body;

    // 종료일 유효성 검증 (event_date와 end_date가 모두 있는 경우)
    const finalEventDate = event_date !== undefined ? event_date : null;
    const finalEndDate = end_date !== undefined ? end_date : null;

    if (finalEndDate && finalEventDate && finalEndDate < finalEventDate) {
      return NextResponse.json(
        { error: '종료일은 시작일보다 이전일 수 없습니다.' },
        { status: 400 }
      );
    }

    // 수정할 필드만 업데이트
    const updateData: any = {};
    if (title !== undefined) updateData.title = title;
    if (description !== undefined) updateData.description = description;
    if (event_date !== undefined) updateData.event_date = event_date;
    if (end_date !== undefined) updateData.end_date = end_date;
    if (event_type !== undefined) {
      // 이벤트 타입 검증
      if (event_type !== 'todo' && event_type !== 'schedule') {
        return NextResponse.json(
          { error: '이벤트 타입은 todo 또는 schedule이어야 합니다.' },
          { status: 400 }
        );
      }
      updateData.event_type = event_type;
    }
    if (is_completed !== undefined) updateData.is_completed = is_completed;
    if (attached_files !== undefined) updateData.attached_files = attached_files;
    if (labels !== undefined) updateData.labels = labels;

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json(
        { error: '수정할 내용이 없습니다.' },
        { status: 400 }
      );
    }

    const { data, error } = await supabase
      .from('calendar_events')
      .update(updateData)
      .eq('id', id)
      .eq('is_deleted', false)
      .select()
      .single();

    if (error) {
      console.error('[캘린더 이벤트 수정 실패]', error);
      return NextResponse.json(
        { error: '캘린더 이벤트 수정에 실패했습니다.', details: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      data
    });
  } catch (error) {
    console.error('[캘린더 수정 API 오류]', error);
    return NextResponse.json(
      { error: '캘린더 수정 API 처리 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/calendar/[id]
 * 캘린더 이벤트 삭제 (Soft Delete)
 * - Level 1+ (AUTHENTICATED) 삭제 가능
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = getSupabaseAdmin();
    const { id } = params;

    // Soft delete
    const { data, error } = await supabase
      .from('calendar_events')
      .update({ is_deleted: true })
      .eq('id', id)
      .eq('is_deleted', false)
      .select();

    if (error) {
      console.error('[캘린더 이벤트 삭제 실패]', error);
      return NextResponse.json(
        { error: '캘린더 이벤트 삭제에 실패했습니다.', details: error.message },
        { status: 500 }
      );
    }

    // 삭제할 항목이 없는 경우 (이미 삭제되었거나 존재하지 않음)
    if (!data || data.length === 0) {
      return NextResponse.json(
        { error: '이미 삭제되었거나 존재하지 않는 캘린더 이벤트입니다.' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      message: '캘린더 이벤트가 삭제되었습니다.',
      data: data[0]
    });
  } catch (error) {
    console.error('[캘린더 삭제 API 오류]', error);
    return NextResponse.json(
      { error: '캘린더 삭제 API 처리 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
