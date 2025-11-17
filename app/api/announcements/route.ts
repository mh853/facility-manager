// app/api/announcements/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';

/**
 * GET /api/announcements
 * 공지사항 목록 조회
 * - Level 1+ (AUTHENTICATED) 읽기 가능
 * - 페이징, 정렬 지원
 * - is_deleted = false인 항목만 조회
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = getSupabaseAdmin();
    const { searchParams } = new URL(request.url);

    // 쿼리 파라미터
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '10');
    const offset = (page - 1) * limit;
    const showPinnedOnly = searchParams.get('pinned') === 'true';

    // 기본 쿼리
    let query = supabase
      .from('announcements')
      .select('*', { count: 'exact' })
      .eq('is_deleted', false);

    // 상단 고정 필터
    if (showPinnedOnly) {
      query = query.eq('is_pinned', true);
    }

    // 정렬 (상단 고정 우선, 그 다음 최신순)
    query = query.order('is_pinned', { ascending: false });
    query = query.order('created_at', { ascending: false });

    // 페이징 (상단 고정만 조회하는 경우 페이징 제외)
    if (!showPinnedOnly) {
      query = query.range(offset, offset + limit - 1);
    }

    const { data, error, count } = await query;

    if (error) {
      console.error('[공지사항 조회 실패]', error);
      return NextResponse.json(
        { error: '공지사항을 조회하는데 실패했습니다.', details: error.message },
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
    console.error('[공지사항 API 오류]', error);
    return NextResponse.json(
      { error: '공지사항 API 처리 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/announcements
 * 공지사항 생성
 * - Level 3+ (SUPER_ADMIN) 쓰기 가능
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = getSupabaseAdmin();
    const body = await request.json();

    const { title, content, author_id, author_name, is_pinned } = body;

    // 필수 필드 검증
    if (!title || !content || !author_id || !author_name) {
      return NextResponse.json(
        { error: '제목, 내용, 작성자 정보는 필수입니다.' },
        { status: 400 }
      );
    }

    // 공지사항 생성
    const { data, error } = await supabase
      .from('announcements')
      .insert({
        title,
        content,
        author_id,
        author_name,
        is_pinned: is_pinned || false
      })
      .select()
      .single();

    if (error) {
      console.error('[공지사항 생성 실패]', error);
      return NextResponse.json(
        { error: '공지사항 생성에 실패했습니다.', details: error.message },
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
    console.error('[공지사항 생성 API 오류]', error);
    return NextResponse.json(
      { error: '공지사항 생성 API 처리 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
