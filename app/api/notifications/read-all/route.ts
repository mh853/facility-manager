import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Supabase 클라이언트 설정
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

// 토큰에서 사용자 정보 추출
function getUserFromToken(authHeader: string | null) {
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }

  try {
    const token = authHeader.substring(7);
    // 임시 사용자 정보 (실제로는 토큰에서 추출)
    return {
      id: 'user_1',
      name: '관리자',
      email: 'admin@blueon.kr'
    };
  } catch (error) {
    console.error('토큰 파싱 오류:', error);
    return null;
  }
}

// POST: 모든 알림 읽음 처리
export async function POST(request: NextRequest) {
  try {
    const user = getUserFromToken(request.headers.get('authorization'));
    if (!user) {
      return NextResponse.json(
        { success: false, error: { message: '인증이 필요합니다.' } },
        { status: 401 }
      );
    }

    // 현재 읽지 않은 알림 목록 조회 (user_notifications 테이블에서)
    const { data: unreadUserNotifications, error: userFetchError } = await supabase
      .from('user_notifications')
      .select('id, title')
      .eq('user_id', user.id)
      .eq('is_read', false)
      .gt('expires_at', new Date().toISOString());

    // 업무 알림도 조회
    const { data: unreadTaskNotifications, error: taskFetchError } = await supabase
      .from('task_notifications')
      .select('id, message')
      .eq('user_id', user.id)
      .eq('is_read', false);

    // 통합된 읽지 않은 알림 목록
    const unreadNotifications = [
      ...(unreadUserNotifications || []),
      ...(unreadTaskNotifications || []).map(item => ({ id: item.id, title: item.message }))
    ];

    if (userFetchError && taskFetchError) {
      console.error('읽지 않은 알림 조회 오류:', { userFetchError, taskFetchError });
      return NextResponse.json(
        { success: false, error: { message: '알림 조회에 실패했습니다.' } },
        { status: 500 }
      );
    }

    // 읽지 않은 알림이 없는 경우
    if (!unreadNotifications || unreadNotifications.length === 0) {
      return NextResponse.json({
        success: true,
        data: {
          processedCount: 0,
          message: '읽지 않은 알림이 없습니다.'
        }
      });
    }

    // 모든 읽지 않은 알림을 읽음 처리
    let totalProcessed = 0;

    // user_notifications 업데이트
    if (unreadUserNotifications && unreadUserNotifications.length > 0) {
      const userNotificationIds = unreadUserNotifications.map(n => n.id);
      const { data: updatedUserNotifications, error: userUpdateError } = await supabase
        .from('user_notifications')
        .update({
          is_read: true,
          read_at: new Date().toISOString()
        })
        .in('id', userNotificationIds)
        .eq('user_id', user.id)
        .select();

      if (userUpdateError) {
        console.error('사용자 알림 읽음 처리 오류:', userUpdateError);
      } else {
        totalProcessed += updatedUserNotifications?.length || 0;
      }
    }

    // task_notifications 업데이트
    if (unreadTaskNotifications && unreadTaskNotifications.length > 0) {
      const taskNotificationIds = unreadTaskNotifications.map(n => n.id);
      const { data: updatedTaskNotifications, error: taskUpdateError } = await supabase
        .from('task_notifications')
        .update({
          is_read: true,
          read_at: new Date().toISOString()
        })
        .in('id', taskNotificationIds)
        .eq('user_id', user.id)
        .select();

      if (taskUpdateError) {
        console.error('업무 알림 읽음 처리 오류:', taskUpdateError);
      } else {
        totalProcessed += updatedTaskNotifications?.length || 0;
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        processedCount: totalProcessed,
        readAt: new Date().toISOString(),
        message: `${totalProcessed}개의 알림이 읽음 처리되었습니다.`
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