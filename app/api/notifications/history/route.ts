// app/api/notifications/history/route.ts - 알림 히스토리 관리 API
import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import jwt from 'jsonwebtoken';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-this-in-production';

// JWT에서 사용자 정보 추출
async function getUserFromRequest(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return null;
    }

    const token = authHeader.substring(7);
    const decoded = jwt.verify(token, JWT_SECRET) as any;

    const { data: user } = await supabaseAdmin
      .from('employees')
      .select('id, name, email, permission_level')
      .eq('id', decoded.userId || decoded.id)
      .eq('is_active', true)
      .single();

    return user;
  } catch (error) {
    return null;
  }
}

// GET: 사용자의 알림 히스토리 조회
export async function GET(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ error: '인증이 필요합니다' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const page = Math.max(1, parseInt(searchParams.get('page') || '1'));
    const limit = Math.min(100, parseInt(searchParams.get('limit') || '20'));
    const search = searchParams.get('search')?.trim();
    const type = searchParams.get('type'); // 'global', 'task', or null for all
    const priority = searchParams.get('priority'); // 'low', 'medium', 'high', 'critical'
    const days = parseInt(searchParams.get('days') || '30'); // 기본 30일

    console.log('📚 [HISTORY] 알림 히스토리 조회:', {
      user: user.name,
      page,
      limit,
      search,
      type,
      priority,
      days
    });

    const offset = (page - 1) * limit;
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    // 기본 쿼리 구성
    let query = supabaseAdmin
      .from('user_notification_history')
      .select('*')
      .eq('user_id', user.id)
      .gte('notification_created_at', startDate.toISOString());

    // 필터링 적용
    if (type && ['global', 'task'].includes(type)) {
      query = query.eq('source_type', type);
    }

    if (priority && ['low', 'medium', 'high', 'critical'].includes(priority)) {
      query = query.eq('priority', priority);
    }

    // 검색 적용 (ILIKE 사용 - PostgreSQL 전문 검색)
    if (search && search.length > 2) {
      query = query.or(`title.ilike.%${search}%,message.ilike.%${search}%,business_name.ilike.%${search}%`);
    }

    // 정렬 및 페이징
    query = query.order('notification_created_at', { ascending: false });

    // 전체 카운트 조회 (페이징용)
    const { count: totalCount } = await query.select('*', { count: 'exact', head: true });

    // 데이터 조회
    const { data: history, error } = await query
      .range(offset, offset + limit - 1);

    if (error) {
      console.error('히스토리 조회 오류:', error);
      return NextResponse.json({
        error: '히스토리 조회에 실패했습니다',
        details: error.message
      }, { status: 500 });
    }

    // 통계 정보 계산
    const stats = {
      totalCount: totalCount || 0,
      currentPage: page,
      totalPages: Math.ceil((totalCount || 0) / limit),
      hasNext: page < Math.ceil((totalCount || 0) / limit),
      hasPrev: page > 1
    };

    // 유형별 카운트 (옵션)
    const { data: typeCounts } = await supabaseAdmin
      .from('user_notification_history')
      .select('source_type')
      .eq('user_id', user.id)
      .gte('notification_created_at', startDate.toISOString());

    const typeBreakdown = typeCounts?.reduce((acc, item) => {
      acc[item.source_type] = (acc[item.source_type] || 0) + 1;
      return acc;
    }, {} as Record<string, number>) || {};

    return NextResponse.json({
      success: true,
      history: history || [],
      stats,
      typeBreakdown,
      filters: { search, type, priority, days }
    });

  } catch (error) {
    console.error('히스토리 API 오류:', error);
    return NextResponse.json({
      success: false,
      error: '서버 오류가 발생했습니다'
    }, { status: 500 });
  }
}

// POST: 알림 아카이브 (읽은 알림들을 히스토리로 이동)
export async function POST(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ error: '인증이 필요합니다' }, { status: 401 });
    }

    const { action, notificationIds, olderThanDays } = await request.json();

    if (action === 'archive_read') {
      // 읽은 알림 일괄 아카이브
      const days = olderThanDays || 7;

      const { data: result, error } = await supabaseAdmin
        .rpc('archive_read_notifications', {
          target_user_id: user.id,
          older_than_days: days
        });

      if (error) {
        console.error('일괄 아카이브 오류:', error);
        return NextResponse.json({
          error: '아카이브 처리에 실패했습니다',
          details: error.message
        }, { status: 500 });
      }

      const archived = result?.[0] || { archived_task_notifications: 0, archived_global_notifications: 0 };

      return NextResponse.json({
        success: true,
        message: `${archived.archived_task_notifications}개 업무 알림이 히스토리로 이동되었습니다`,
        archivedCount: archived.archived_task_notifications + archived.archived_global_notifications
      });

    } else if (action === 'archive_specific' && notificationIds && Array.isArray(notificationIds)) {
      // 특정 알림 아카이브
      let archivedCount = 0;
      const errors: string[] = [];

      for (const id of notificationIds) {
        try {
          const { error } = await supabaseAdmin
            .rpc('archive_task_notification', { notification_id: id });

          if (error) {
            errors.push(`${id}: ${error.message}`);
          } else {
            archivedCount++;
          }
        } catch (err) {
          errors.push(`${id}: ${err}`);
        }
      }

      return NextResponse.json({
        success: errors.length === 0,
        message: `${archivedCount}개 알림이 히스토리로 이동되었습니다`,
        archivedCount,
        errors: errors.length > 0 ? errors : undefined
      });

    } else {
      return NextResponse.json({
        error: '잘못된 액션입니다. "archive_read" 또는 "archive_specific"을 사용하세요.'
      }, { status: 400 });
    }

  } catch (error) {
    console.error('아카이브 API 오류:', error);
    return NextResponse.json({
      error: '서버 오류가 발생했습니다'
    }, { status: 500 });
  }
}

// DELETE: 히스토리에서 완전 삭제 (관리자만)
export async function DELETE(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);
    if (!user || user.permission_level < 3) {
      return NextResponse.json({ error: '관리자 권한이 필요합니다' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const historyId = searchParams.get('id');
    const olderThanMonths = parseInt(searchParams.get('olderThanMonths') || '0');

    if (historyId) {
      // 특정 히스토리 삭제
      const { error: globalError } = await supabaseAdmin
        .from('notification_history')
        .delete()
        .eq('id', historyId);

      const { error: taskError } = await supabaseAdmin
        .from('task_notification_history')
        .delete()
        .eq('id', historyId);

      if (globalError && taskError) {
        return NextResponse.json({
          error: '히스토리 삭제에 실패했습니다'
        }, { status: 500 });
      }

      return NextResponse.json({
        success: true,
        message: '히스토리가 삭제되었습니다'
      });

    } else if (olderThanMonths > 0) {
      // 오래된 히스토리 일괄 삭제
      const { data: result, error } = await supabaseAdmin
        .rpc('cleanup_old_notification_history');

      if (error) {
        return NextResponse.json({
          error: '히스토리 정리에 실패했습니다',
          details: error.message
        }, { status: 500 });
      }

      const cleaned = result?.[0] || { deleted_notification_history: 0, deleted_task_history: 0 };

      return NextResponse.json({
        success: true,
        message: `${cleaned.deleted_notification_history + cleaned.deleted_task_history}개 히스토리가 정리되었습니다`,
        deletedCount: cleaned.deleted_notification_history + cleaned.deleted_task_history
      });

    } else {
      return NextResponse.json({
        error: 'id 또는 olderThanMonths 매개변수가 필요합니다'
      }, { status: 400 });
    }

  } catch (error) {
    console.error('히스토리 삭제 API 오류:', error);
    return NextResponse.json({
      error: '서버 오류가 발생했습니다'
    }, { status: 500 });
  }
}