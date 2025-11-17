// app/api/messages/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase';

/**
 * GET /api/messages
 * 전달사항 목록 조회
 * - Level 1+ (AUTHENTICATED) 읽기 가능
 * - 페이징, 정렬 지원
 * - is_deleted = false인 항목만 조회
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = createClient();
    const { searchParams } = new URL(request.url);

    // 쿼리 파라미터
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '10');
    const offset = (page - 1) * limit;

    // 기본 쿼리
    const query = supabase
      .from('messages')
      .select('*', { count: 'exact' })
      .eq('is_deleted', false)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    const { data, error, count } = await query;

    if (error) {
      console.error('[전달사항 조회 실패]', error);
      return NextResponse.json(
        { error: '전달사항을 조회하는데 실패했습니다.', details: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      data: data || [],
      pagination: {
        page,
        limit,
        total: count || 0,
        totalPages: Math.ceil((count || 0) / limit)
      }
    });
  } catch (error) {
    console.error('[전달사항 API 오류]', error);
    return NextResponse.json(
      { error: '전달사항 API 처리 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/messages
 * 전달사항 생성
 * - Level 1+ (AUTHENTICATED) 쓰기 가능
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = createClient();
    const body = await request.json();

    const { title, content, author_id, author_name } = body;

    // 필수 필드 검증
    if (!title || !content || !author_id || !author_name) {
      return NextResponse.json(
        { error: '제목, 내용, 작성자 정보는 필수입니다.' },
        { status: 400 }
      );
    }

    // 전달사항 생성
    const { data, error } = await supabase
      .from('messages')
      .insert({
        title,
        content,
        author_id,
        author_name
      })
      .select()
      .single();

    if (error) {
      console.error('[전달사항 생성 실패]', error);
      return NextResponse.json(
        { error: '전달사항 생성에 실패했습니다.', details: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      data
    }, { status: 201 });
  } catch (error) {
    console.error('[전달사항 생성 API 오류]', error);
    return NextResponse.json(
      { error: '전달사항 생성 API 처리 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
