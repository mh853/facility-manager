import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import type { AnnouncementFilters, AnnouncementsResponse, SubsidyAnnouncement } from '@/types/subsidy';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

// GET: 공고 목록 조회
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);

    // 필터 파라미터
    const page = parseInt(searchParams.get('page') || '1');
    const pageSize = parseInt(searchParams.get('pageSize') || '20');
    const status = searchParams.get('status') || 'all';
    const isRelevant = searchParams.get('isRelevant');
    const isRead = searchParams.get('isRead');
    const isManual = searchParams.get('isManual');
    const regionCode = searchParams.get('regionCode');
    const regionType = searchParams.get('regionType');
    const search = searchParams.get('search');
    const sortBy = searchParams.get('sortBy') || 'published_at';
    const sortOrder = searchParams.get('sortOrder') || 'desc';

    // 쿼리 빌드
    let query = supabase
      .from('subsidy_announcements')
      .select('*', { count: 'exact' });

    // 필터 적용
    if (status && status !== 'all') {
      query = query.eq('status', status);
    }

    if (isRelevant !== null && isRelevant !== undefined) {
      if (isRelevant === 'true') {
        // 관련 공고만 표시: relevance_score >= 0.75 (75% 이상)
        query = query.eq('is_relevant', true).gte('relevance_score', 0.75);
      } else if (isRelevant === 'false') {
        query = query.eq('is_relevant', false);
      }
      // 'all'인 경우 필터링 없음
    }

    if (isRead !== null && isRead !== undefined) {
      query = query.eq('is_read', isRead === 'true');
    }

    if (isManual !== null && isManual !== undefined) {
      query = query.eq('is_manual', isManual === 'true');
    }

    if (regionCode) {
      query = query.eq('region_code', regionCode);
    }

    if (regionType) {
      query = query.eq('region_type', regionType);
    }

    if (search) {
      query = query.or(`title.ilike.%${search}%,content.ilike.%${search}%,region_name.ilike.%${search}%`);
    }

    // 정렬
    query = query.order(sortBy, { ascending: sortOrder === 'asc' });

    // 페이지네이션
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;
    query = query.range(from, to);

    const { data, error, count } = await query;

    if (error) {
      console.error('공고 조회 오류:', error);
      return NextResponse.json({
        success: false,
        error: error.message
      } as AnnouncementsResponse, { status: 500 });
    }

    const total = count || 0;
    const hasMore = from + (data?.length || 0) < total;

    return NextResponse.json({
      success: true,
      data: {
        announcements: data as SubsidyAnnouncement[],
        total,
        page,
        pageSize,
        hasMore
      }
    } as AnnouncementsResponse);

  } catch (error) {
    console.error('공고 API 오류:', error);
    return NextResponse.json({
      success: false,
      error: '서버 오류가 발생했습니다.'
    } as AnnouncementsResponse, { status: 500 });
  }
}

// PATCH: 공고 상태 업데이트
export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, ...updates } = body;

    if (!id) {
      return NextResponse.json({
        success: false,
        error: '공고 ID가 필요합니다.'
      }, { status: 400 });
    }

    // 허용된 필드만 업데이트
    const allowedFields = ['status', 'is_read', 'notes'];
    const filteredUpdates: Record<string, any> = {};

    for (const field of allowedFields) {
      if (updates[field] !== undefined) {
        filteredUpdates[field] = updates[field];
      }
    }

    if (Object.keys(filteredUpdates).length === 0) {
      return NextResponse.json({
        success: false,
        error: '업데이트할 필드가 없습니다.'
      }, { status: 400 });
    }

    const { data, error } = await supabase
      .from('subsidy_announcements')
      .update(filteredUpdates)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('공고 업데이트 오류:', error);
      return NextResponse.json({
        success: false,
        error: error.message
      }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      data: data as SubsidyAnnouncement
    });

  } catch (error) {
    console.error('공고 업데이트 API 오류:', error);
    return NextResponse.json({
      success: false,
      error: '서버 오류가 발생했습니다.'
    }, { status: 500 });
  }
}
