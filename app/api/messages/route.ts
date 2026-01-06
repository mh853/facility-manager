// app/api/messages/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { queryAll, queryOne } from '@/lib/supabase-direct';

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

    // Direct PostgreSQL 쿼리 구성
    let queryStr = `
      SELECT * FROM messages
      WHERE is_deleted = false
    `;
    const params: any[] = [];

    // 검색어가 있으면 제목 또는 내용에서 검색 (ILIKE)
    if (searchQuery) {
      queryStr += ` AND (title ILIKE $1 OR content ILIKE $1)`;
      params.push(`%${searchQuery}%`);
    }

    // 정렬 및 페이징
    queryStr += ` ORDER BY created_at DESC`;

    if (searchQuery) {
      queryStr += ` LIMIT $2 OFFSET $3`;
      params.push(limit, offset);
    } else {
      queryStr += ` LIMIT $1 OFFSET $2`;
      params.push(limit, offset);
    }

    const data = await queryAll(queryStr, params);

    // 전체 개수 조회
    let countQueryStr = `
      SELECT COUNT(*) as count FROM messages
      WHERE is_deleted = false
    `;
    const countParams: any[] = [];

    if (searchQuery) {
      countQueryStr += ` AND (title ILIKE $1 OR content ILIKE $1)`;
      countParams.push(`%${searchQuery}%`);
    }

    const countResult = await queryOne(countQueryStr, countParams);
    const count = parseInt(countResult?.count || '0');

    const response = NextResponse.json({
      success: true,
      data: data || [],
      pagination: {
        page,
        limit,
        total: count,
        totalPages: Math.ceil(count / limit)
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
    const body = await request.json();

    const { title, content, author_id, author_name } = body;

    // 필수 필드 검증
    if (!title || !content || !author_id || !author_name) {
      return NextResponse.json(
        { error: '제목, 내용, 작성자 정보는 필수입니다.' },
        { status: 400 }
      );
    }

    // 전달사항 생성 (Direct PostgreSQL)
    const data = await queryOne(
      `INSERT INTO messages (
        title, content, author_id, author_name
      )
      VALUES ($1, $2, $3, $4)
      RETURNING *`,
      [title, content, author_id, author_name]
    );

    if (!data) {
      console.error('[전달사항 생성 실패] - 데이터 반환 없음');
      return NextResponse.json(
        { error: '전달사항 생성에 실패했습니다.' },
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
