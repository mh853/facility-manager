// app/api/announcements/[id]/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase';

/**
 * GET /api/announcements/[id]
 * 특정 공지사항 조회
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = createClient();
    const { id } = params;

    const { data, error } = await supabase
      .from('announcements')
      .select('*')
      .eq('id', id)
      .eq('is_deleted', false)
      .single();

    if (error) {
      console.error('[공지사항 조회 실패]', error);
      return NextResponse.json(
        { error: '공지사항을 찾을 수 없습니다.', details: error.message },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data
    });
  } catch (error) {
    console.error('[공지사항 조회 API 오류]', error);
    return NextResponse.json(
      { error: '공지사항 조회 API 처리 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/announcements/[id]
 * 공지사항 수정
 * - Level 3+ (SUPER_ADMIN) 수정 가능
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = createClient();
    const { id } = params;
    const body = await request.json();

    const { title, content, is_pinned } = body;

    // 수정할 필드만 업데이트
    const updateData: any = {};
    if (title !== undefined) updateData.title = title;
    if (content !== undefined) updateData.content = content;
    if (is_pinned !== undefined) updateData.is_pinned = is_pinned;

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json(
        { error: '수정할 내용이 없습니다.' },
        { status: 400 }
      );
    }

    const { data, error } = await supabase
      .from('announcements')
      .update(updateData)
      .eq('id', id)
      .eq('is_deleted', false)
      .select()
      .single();

    if (error) {
      console.error('[공지사항 수정 실패]', error);
      return NextResponse.json(
        { error: '공지사항 수정에 실패했습니다.', details: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      data
    });
  } catch (error) {
    console.error('[공지사항 수정 API 오류]', error);
    return NextResponse.json(
      { error: '공지사항 수정 API 처리 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/announcements/[id]
 * 공지사항 삭제 (Soft Delete)
 * - Level 3+ (SUPER_ADMIN) 삭제 가능
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = createClient();
    const { id } = params;

    // Soft delete
    const { data, error } = await supabase
      .from('announcements')
      .update({ is_deleted: true })
      .eq('id', id)
      .eq('is_deleted', false)
      .select()
      .single();

    if (error) {
      console.error('[공지사항 삭제 실패]', error);
      return NextResponse.json(
        { error: '공지사항 삭제에 실패했습니다.', details: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: '공지사항이 삭제되었습니다.',
      data
    });
  } catch (error) {
    console.error('[공지사항 삭제 API 오류]', error);
    return NextResponse.json(
      { error: '공지사항 삭제 API 처리 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
