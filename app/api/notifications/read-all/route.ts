import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { verifyTokenHybrid } from '@/lib/secure-jwt';

// Force dynamic rendering
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// 사용자 권한 확인 헬퍼 함수 (Authorization 헤더 + httpOnly 쿠키 지원)
async function checkUserPermission(request: NextRequest) {
  // Authorization 헤더에서 토큰 확인
  const authHeader = request.headers.get('authorization');
  let token: string | null = null;

  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.replace('Bearer ', '');
  } else {
    // httpOnly 쿠키에서 토큰 확인
    const cookieToken = request.cookies.get('auth_token')?.value;
    if (cookieToken) {
      token = cookieToken;
    }
  }

  if (!token) {
    console.log('⚠️ [READ-ALL] 토큰 없음 (헤더/쿠키 모두 없음)');
    return { authorized: false, user: null };
  }

  try {
    const result = await verifyTokenHybrid(token);

    if (!result.user) {
      console.log('⚠️ [READ-ALL] 사용자 정보 없음:', result.error);
      return { authorized: false, user: null };
    }

    console.log('✅ [READ-ALL] 사용자 인증 성공:', {
      userId: result.user.id,
      userName: result.user.name
    });

    return {
      authorized: true,
      user: result.user
    };
  } catch (error) {
    console.error('❌ [READ-ALL] 권한 확인 오류:', error);
    return { authorized: false, user: null };
  }
}

// POST: 모든 알림 읽음 처리
export async function POST(request: NextRequest) {
  try {
    const { authorized, user } = await checkUserPermission(request);
    if (!authorized || !user) {
      return NextResponse.json(
        { success: false, error: { message: '인증이 필요합니다.' } },
        { status: 401 }
      );
    }

    console.log('🔄 [READ-ALL] 모든 알림 읽음 처리 시작:', {
      userId: user.id,
      userName: user.name
    });

    let totalProcessed = 0;

    // 1. 업무 알림 처리 (task_notifications 테이블의 안읽은 알림만)
    const { data: unreadTaskNotifications, error: taskFetchError } = await supabaseAdmin
      .from('task_notifications')
      .select('id, message, business_name')
      .eq('user_id', user.id)
      .eq('is_read', false);

    // 업무 알림 읽음 처리
    if (taskFetchError && !taskFetchError.message?.includes('relation')) {
      console.error('❌ [READ-ALL] 업무 알림 조회 오류:', taskFetchError);
    } else if (unreadTaskNotifications && unreadTaskNotifications.length > 0) {
      const taskNotificationIds = unreadTaskNotifications.map(n => n.id);

      console.log('🔄 [READ-ALL] 업무 알림 읽음 처리:', taskNotificationIds.length, '개');

      const { data: updatedTaskNotifications, error: taskUpdateError } = await supabaseAdmin
        .from('task_notifications')
        .update({
          is_read: true,
          read_at: new Date().toISOString()
        })
        .in('id', taskNotificationIds)
        .eq('user_id', user.id)
        .select();

      if (!taskUpdateError) {
        totalProcessed += updatedTaskNotifications?.length || 0;
        console.log('✅ [READ-ALL] 업무 알림', updatedTaskNotifications?.length || 0, '개 읽음 처리 완료');
      } else {
        console.error('❌ [READ-ALL] 업무 알림 읽음 처리 오류:', taskUpdateError);
      }
    }

    // 2. 일반 알림 처리 (notifications 테이블의 읽지 않은 알림만)
    // 읽지 않은 일반 알림 조회 (user_notification_reads에 없는 것들)
    const { data: unreadGeneralNotifications, error: generalFetchError } = await supabaseAdmin
      .from('notifications')
      .select('id, title, message')
      .not('id', 'in', `(SELECT notification_id FROM user_notification_reads WHERE user_id = '${user.id}')`)
      .gt('expiresAt', new Date().toISOString()); // 만료되지 않은 알림만

    console.log('📊 [READ-ALL] 일반 알림 조회 결과:', {
      generalNotifications: unreadGeneralNotifications?.length || 0,
      error: generalFetchError?.message || 'none'
    });

    // 일반 알림 읽음 처리
    if (generalFetchError && !generalFetchError.message?.includes('relation')) {
      console.error('❌ [READ-ALL] 일반 알림 조회 오류:', generalFetchError);
    } else if (unreadGeneralNotifications && unreadGeneralNotifications.length > 0) {
      console.log('🔄 [READ-ALL] 일반 알림 읽음 처리:', unreadGeneralNotifications.length, '개');

      // 각 일반 알림에 대해 읽음 기록 생성
      const readRecords = unreadGeneralNotifications.map(notification => ({
        notification_id: notification.id,
        user_id: user.id,
        user_name: user.name,
        read_at: new Date().toISOString()
      }));

      const { data: insertedReads, error: generalUpdateError } = await supabaseAdmin
        .from('user_notification_reads')
        .insert(readRecords)
        .select();

      if (!generalUpdateError) {
        totalProcessed += insertedReads?.length || 0;
        console.log('✅ [READ-ALL] 일반 알림', insertedReads?.length || 0, '개 읽음 처리 완료');
      } else {
        console.error('❌ [READ-ALL] 일반 알림 읽음 처리 오류:', generalUpdateError);
      }
    }

    console.log('✅ [READ-ALL] 모든 알림 읽음 처리 완료:', {
      totalProcessed,
      taskNotifications: unreadTaskNotifications?.length || 0,
      generalNotifications: unreadGeneralNotifications?.length || 0
    });

    return NextResponse.json({
      success: true,
      data: {
        processedCount: totalProcessed,
        readAt: new Date().toISOString(),
        message: totalProcessed > 0
          ? `${totalProcessed}개의 알림이 읽음 처리되었습니다.`
          : '읽지 않은 알림이 없습니다.'
      }
    });

  } catch (error) {
    console.error('모든 알림 읽음 처리 API 오류:', error);
    return NextResponse.json(
      { success: false, error: { message: '서버 내부 오류가 발생했습니다.' } },
      { status: 500 }
    );
  }
}