// app/api/messages/[id]/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase';

/**
 * GET /api/messages/[id]
 * 특정 전달사항 조회
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = createClient();
    const { id } = params;

    const { data, error } = await supabase
      .from('messages')
      .select('*')
      .eq('id', id)
      .eq('is_deleted', false)
      .single();

    if (error) {
      console.error('[전달사항 조회 실패]', error);
      return NextResponse.json(
        { error: '전달사항을 찾을 수 없습니다.', details: error.message },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data
    });
  } catch (error) {
    console.error('[전달사항 조회 API 오류]', error);
    return NextResponse.json(
      { error: '전달사항 조회 API 처리 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/messages/[id]
 * 전달사항 수정
 * - Level 1+ (AUTHENTICATED) 수정 가능
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = createClient();
    const { id } = params;
    const body = await request.json();

    const { title, content } = body;

    // 수정할 필드만 업데이트
    const updateData: any = {};
    if (title !== undefined) updateData.title = title;
    if (content !== undefined) updateData.content = content;

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json(
        { error: '수정할 내용이 없습니다.' },
        { status: 400 }
      );
    }

    const { data, error } = await supabase
      .from('messages')
      .update(updateData)
      .eq('id', id)
      .eq('is_deleted', false)
      .select()
      .single();

    if (error) {
      console.error('[전달사항 수정 실패]', error);
      return NextResponse.json(
        { error: '전달사항 수정에 실패했습니다.', details: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      data
    });
  } catch (error) {
    console.error('[전달사항 수정 API 오류]', error);
    return NextResponse.json(
      { error: '전달사항 수정 API 처리 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/messages/[id]
 * 전달사항 삭제 (Soft Delete)
 * - Level 1+ (AUTHENTICATED) 삭제 가능
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
      .from('messages')
      .update({ is_deleted: true })
      .eq('id', id)
      .eq('is_deleted', false)
      .select()
      .single();

    if (error) {
      console.error('[전달사항 삭제 실패]', error);
      return NextResponse.json(
        { error: '전달사항 삭제에 실패했습니다.', details: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: '전달사항이 삭제되었습니다.',
      data
    });
  } catch (error) {
    console.error('[전달사항 삭제 API 오류]', error);
    return NextResponse.json(
      { error: '전달사항 삭제 API 처리 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
