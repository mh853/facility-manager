// app/api/messages/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';

/**
 * GET /api/messages
 * 전달사항 목록 조회
 * - Level 1+ (AUTHENTICATED) 읽기 가능
 * - 페이징, 정렬 지원
 * - 검색 지원 (제목, 내용)
 * - is_deleted = false인 항목만 조회
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = getSupabaseAdmin();
    const { searchParams } = new URL(request.url);

    // 입력 검증 상수
    const MAX_SEARCH_LENGTH = 100;
    const MAX_LIMIT = 100;
    const MIN_PAGE = 1;
    const DEFAULT_LIMIT = 10;

    // 검색어 검증
    const searchQuery = searchParams.get('search')?.trim() || '';
    if (searchQuery.length > MAX_SEARCH_LENGTH) {
      return NextResponse.json(
        {
          success: false,
          error: `검색어는 ${MAX_SEARCH_LENGTH}자 이하여야 합니다.`
        },
        { status: 400 }
      );
    }

    // 페이지 파라미터 검증 및 정규화
    const pageParam = searchParams.get('page');
    const page = Math.max(MIN_PAGE, parseInt(pageParam || '1') || MIN_PAGE);

    // Limit 파라미터 검증 및 정규화
    const limitParam = searchParams.get('limit');
    const requestedLimit = parseInt(limitParam || DEFAULT_LIMIT.toString()) || DEFAULT_LIMIT;
    const limit = Math.min(Math.max(1, requestedLimit), MAX_LIMIT);

    const offset = (page - 1) * limit;

    // 기본 쿼리
    let query = supabase
      .from('messages')
      .select('*', { count: 'exact' })
      .eq('is_deleted', false);

    // 검색어가 있으면 제목 또는 내용에서 검색
    if (searchQuery) {
      query = query.or(`title.ilike.%${searchQuery}%,content.ilike.%${searchQuery}%`);
    }

    // 정렬 및 페이징
    query = query
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    const { data, error, count } = await query;

    if (error) {
      console.error('[전달사항 조회 실패]', error);
      return NextResponse.json(
        {
          success: false,
          error: '전달사항을 조회하는데 실패했습니다.',
          details: error.message
        },
        { status: 500 }
      );
    }

    const response = NextResponse.json({
      success: true,
      data: data || [],
      pagination: {
        page,
        limit,
        total: count || 0,
        totalPages: Math.ceil((count || 0) / limit)
      }
    });

    // 캐시 비활성화 (실시간 업데이트 필요)
    response.headers.set('Cache-Control', 'no-store, must-revalidate');

    return response;
  } catch (error) {
    console.error('[전달사항 API 오류]', error);
    return NextResponse.json(
      {
        success: false,
        error: '전달사항 API 처리 중 오류가 발생했습니다.'
      },
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
    const supabase = getSupabaseAdmin();
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

    const response = NextResponse.json({
      success: true,
      data
    }, { status: 201 });

    // 캐시 비활성화 (실시간 업데이트 필요)
    response.headers.set('Cache-Control', 'no-store, must-revalidate');

    return response;
  } catch (error) {
    console.error('[전달사항 생성 API 오류]', error);
    return NextResponse.json(
      { error: '전달사항 생성 API 처리 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
