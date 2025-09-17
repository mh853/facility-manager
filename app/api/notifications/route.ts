import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { verifyAuth } from '@/lib/auth/middleware';

// 알림 목록 조회 (GET)
export async function GET(request: NextRequest) {
  try {
    const { user, error: authError } = await verifyAuth(request);
    if (authError) {
      return NextResponse.json({ success: false, error: authError }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const unread_only = searchParams.get('unread_only') === 'true';
    const type = searchParams.get('type');
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');
    const offset = (page - 1) * limit;

    const supabase = supabaseAdmin;

    // 기본 쿼리 빌드
    let query = supabase
      .from('notification_dashboard')
      .select('*')
      .eq('recipient_id', user.id);

    // 필터 적용
    if (unread_only) {
      query = query.eq('is_read', false);
    }
    if (type) {
      query = query.eq('type', type);
    }

    // 페이징 및 정렬
    query = query
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    const { data: notifications, error: notificationsError } = await query;

    if (notificationsError) {
      console.error('알림 조회 오류:', notificationsError);
      return NextResponse.json({
        success: false,
        error: '알림 목록을 불러오는데 실패했습니다.'
      }, { status: 500 });
    }

    // 읽지 않은 알림 수 조회
    const { count: unreadCount } = await supabase
      .from('notifications')
      .select('*', { count: 'exact', head: true })
      .eq('recipient_id', user.id)
      .eq('is_read', false);

    // 전체 개수 조회 (페이징용)
    let countQuery = supabase
      .from('notifications')
      .select('*', { count: 'exact', head: true })
      .eq('recipient_id', user.id);

    if (unread_only) countQuery = countQuery.eq('is_read', false);
    if (type) countQuery = countQuery.eq('type', type);

    const { count } = await countQuery;

    return NextResponse.json({
      success: true,
      data: {
        notifications,
        unreadCount: unreadCount || 0,
        pagination: {
          current_page: page,
          total_pages: Math.ceil((count || 0) / limit),
          total_count: count || 0,
          limit
        }
      }
    });

  } catch (error) {
    console.error('알림 API 오류:', error);
    return NextResponse.json({
      success: false,
      error: '서버 오류가 발생했습니다.'
    }, { status: 500 });
  }
}

// 새 알림 생성 (POST)
export async function POST(request: NextRequest) {
  try {
    const { user, error: authError } = await verifyAuth(request);
    if (authError) {
      return NextResponse.json({ success: false, error: authError }, { status: 401 });
    }

    const body = await request.json();
    const {
      type,
      title,
      message,
      priority = '보통',
      recipient_id,
      related_project_id,
      related_task_id,
      action_url,
      metadata = {}
    } = body;

    // 필수 필드 검증
    if (!type || !title || !message || !recipient_id) {
      return NextResponse.json({
        success: false,
        error: '알림 유형, 제목, 메시지, 수신자는 필수입니다.'
      }, { status: 400 });
    }

    const supabase = supabaseAdmin;

    // 알림 생성
    const { data: notification, error: notificationError } = await supabase
      .from('notifications')
      .insert({
        type,
        title,
        message,
        priority,
        recipient_id,
        sender_id: user.id,
        related_project_id,
        related_task_id,
        action_url,
        metadata
      })
      .select()
      .single();

    if (notificationError) {
      console.error('알림 생성 오류:', notificationError);
      return NextResponse.json({
        success: false,
        error: '알림 생성에 실패했습니다.'
      }, { status: 500 });
    }

    // 수신자의 알림 설정 확인
    const { data: settings } = await supabase
      .from('notification_settings')
      .select('*')
      .eq('employee_id', recipient_id)
      .single();

    // 실시간 알림 전송 (WebSocket으로 전송 예정)
    // TODO: WebSocket 또는 Server-Sent Events로 실시간 알림 전송

    // 푸시 알림 전송 (설정이 켜져있는 경우)
    if (settings?.push_enabled) {
      // TODO: 브라우저 푸시 알림 전송 로직
      console.log('푸시 알림 전송 예정:', notification.id);
    }

    return NextResponse.json({
      success: true,
      data: notification,
      message: '알림이 성공적으로 전송되었습니다.'
    });

  } catch (error) {
    console.error('알림 생성 API 오류:', error);
    return NextResponse.json({
      success: false,
      error: '서버 오류가 발생했습니다.'
    }, { status: 500 });
  }
}

// 알림 일괄 읽음 처리 (PUT)
export async function PUT(request: NextRequest) {
  try {
    const { user, error: authError } = await verifyAuth(request);
    if (authError) {
      return NextResponse.json({ success: false, error: authError }, { status: 401 });
    }

    const body = await request.json();
    const { notification_ids, mark_all_read } = body;

    const supabase = supabaseAdmin;

    if (mark_all_read) {
      // 모든 알림 읽음 처리
      const { error: updateError } = await supabase
        .from('notifications')
        .update({
          is_read: true,
          read_at: new Date().toISOString()
        })
        .eq('recipient_id', user.id)
        .eq('is_read', false);

      if (updateError) {
        console.error('일괄 읽음 처리 오류:', updateError);
        return NextResponse.json({
          success: false,
          error: '알림 읽음 처리에 실패했습니다.'
        }, { status: 500 });
      }

      return NextResponse.json({
        success: true,
        message: '모든 알림이 읽음 처리되었습니다.'
      });
    }

    if (notification_ids && Array.isArray(notification_ids)) {
      // 선택한 알림들 읽음 처리
      const { error: updateError } = await supabase
        .from('notifications')
        .update({
          is_read: true,
          read_at: new Date().toISOString()
        })
        .eq('recipient_id', user.id)
        .in('id', notification_ids);

      if (updateError) {
        console.error('선택 읽음 처리 오류:', updateError);
        return NextResponse.json({
          success: false,
          error: '알림 읽음 처리에 실패했습니다.'
        }, { status: 500 });
      }

      return NextResponse.json({
        success: true,
        message: '선택한 알림이 읽음 처리되었습니다.'
      });
    }

    return NextResponse.json({
      success: false,
      error: '읽음 처리할 알림을 지정해주세요.'
    }, { status: 400 });

  } catch (error) {
    console.error('알림 읽음 처리 API 오류:', error);
    return NextResponse.json({
      success: false,
      error: '서버 오류가 발생했습니다.'
    }, { status: 500 });
  }
}