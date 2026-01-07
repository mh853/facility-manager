// app/api/estimates/route.ts - 견적서 조회 및 템플릿 수정 API
import { NextRequest, NextResponse } from 'next/server';
import { queryOne, queryAll } from '@/lib/supabase-direct';

// Force dynamic rendering for API routes
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// GET: 견적서 목록 조회
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const businessId = searchParams.get('business_id');
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');
    const offset = (page - 1) * limit;

    // Direct PostgreSQL query with optional business filter
    const params: any[] = [limit, offset];
    let whereClause = '';

    if (businessId) {
      whereClause = 'WHERE business_id = $3';
      params.push(businessId);
    }

    const data = await queryAll(
      `SELECT * FROM estimate_history
       ${whereClause}
       ORDER BY created_at DESC
       LIMIT $1 OFFSET $2`,
      params
    );

    // Get total count
    const countParams = businessId ? [businessId] : [];
    const countResult = await queryOne(
      `SELECT COUNT(*) as count FROM estimate_history ${whereClause ? 'WHERE business_id = $1' : ''}`,
      countParams
    );

    const count = parseInt(countResult?.count || '0');

    return NextResponse.json({
      success: true,
      data,
      pagination: {
        page,
        limit,
        total: count,
        total_pages: Math.ceil(count / limit)
      }
    });

  } catch (error) {
    console.error('견적서 조회 오류:', error);
    return NextResponse.json(
      { success: false, error: '서버 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}

// PUT: 템플릿 안내사항 수정
export async function PUT(request: NextRequest) {
  try {
    const { template_id, terms_and_conditions, updated_by } = await request.json();

    // Direct PostgreSQL update
    const data = await queryOne(
      `UPDATE estimate_templates
       SET terms_and_conditions = $1,
           updated_at = $2,
           created_by = $3
       WHERE id = $4
       RETURNING *`,
      [terms_and_conditions, new Date().toISOString(), updated_by, template_id]
    );

    if (!data) {
      return NextResponse.json(
        { success: false, error: '템플릿을 찾을 수 없습니다.' },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true, data });

  } catch (error) {
    console.error('템플릿 수정 오류:', error);
    return NextResponse.json(
      { success: false, error: '서버 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
